import { supabase } from './supabaseClient';
import type { Exercise, SetEntry } from '../types';
import { estimate1RM } from '../utils/oneRM';

function localDayStartISO(dayISO: string) {
  // dayISO = 'YYYY-MM-DD' in local tz
  const d = new Date(`${dayISO}T00:00:00`);
  return d.toISOString(); // converts local midnight → UTC ISO for Supabase
}

function localNextDayStartISO(dayISO: string) {
  const d = new Date(`${dayISO}T00:00:00`);
  d.setDate(d.getDate() + 1);
  return d.toISOString();
}

export async function getExercises(): Promise<Exercise[]> {
  const { data, error } = await supabase
    .from('exercises')
    .select('id, user_id, name, short_name')
    .order('name', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Exercise[];
}

export async function updateSet(
  id: string,
  patch: Partial<Pick<SetEntry,'exercise_id'|'weight'|'reps'|'rpe'|'failed'>> & { performed_at?: string | null }
): Promise<SetEntry> {
  const { data, error } = await supabase.from('sets').update(patch).eq('id', id).select('*').single();
  if (error) throw error;
  return data as SetEntry;
}

export async function deleteSet(id: string): Promise<void> {
  const { error } = await supabase.from('sets').delete().eq('id', id);
  if (error) throw error;
}

export async function signOut() { await supabase.auth.signOut(); }

// After inserting a set, update PRs; returns which metrics are new PRs
export async function upsertPRForSet(setId: string): Promise<{
  new_weight?: boolean;
  new_1rm?: boolean;
  new_volume?: boolean;
  club_total_1rm?: number;       // sum of best Bench + Deadlift + Back Squat 1RM
  club_reached_1000?: boolean;   // true if just crossed >= 1000
}> {
  const { data, error } = await supabase.rpc('upsert_pr_for_set', { p_set_id: setId });
  if (error) throw error;
  // Return with safe defaults so callers don't crash if fields are missing
  return ({
    new_weight: false,
    new_1rm: false,
    new_volume: false,
    ...((data ?? {}) as any),
  });
}

export async function recomputePRs(): Promise<void> {
  // Try server-side recompute first
  const { error } = await supabase.rpc('recompute_prs');
  if (!error) return;
  // Fallback: client-side recompute if server function fails (e.g., stale SQL)
  await recomputePRsClient();
}

async function recomputePRsClient(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Fetch all sets for this user needed for PRs computation
  const { data: sets, error } = await supabase
    .from('sets')
    .select('id, exercise_id, weight, reps, failed, performed_at, created_at')
    .eq('user_id', user.id);
  if (error) throw error;

  type PRVal = { value: number; dateISO: string; setId: string };
  const weightPR: Record<string, PRVal> = {};
  const oneRMPR: Record<string, PRVal> = {};
  // For volume, compute per local day per exercise, then take max
  const volumeByExByDay: Record<string, Record<string, number>> = {};

  const toLocalDayKey = (iso: string) => new Date(iso).toLocaleDateString('en-CA'); // YYYY-MM-DD

  for (const r of (sets ?? []) as any[]) {
    const ok = !r.failed;
    const when = r.performed_at ?? r.created_at;
    const exId = r.exercise_id as string;
    if (!when || !exId) continue;

    if (ok) {
      // Weight PR
      const w = Number(r.weight);
      if (!isNaN(w)) {
        const cur = weightPR[exId];
        if (!cur || w > cur.value) weightPR[exId] = { value: w, dateISO: when, setId: r.id };
      }
      // 1RM PR (Epley)
      const reps = Number(r.reps);
      const w1rm = (!isNaN(reps) && !isNaN(Number(r.weight))) ? estimate1RM(Number(r.weight), reps) : NaN;
      if (!isNaN(w1rm)) {
        const cur = oneRMPR[exId];
        if (!cur || w1rm > cur.value) oneRMPR[exId] = { value: w1rm, dateISO: when, setId: r.id };
      }
      // Volume per day per exercise
      const vol = Number(r.weight) * Number(r.reps);
      if (!isNaN(vol)) {
        const day = toLocalDayKey(when);
        volumeByExByDay[exId] = volumeByExByDay[exId] || {};
        volumeByExByDay[exId][day] = (volumeByExByDay[exId][day] || 0) + vol;
      }
    }
  }

  // Reduce volume to PR per exercise
  const volumePR: Record<string, PRVal> = {};
  // To provide a representative set_id for volume PR (per-day aggregate),
  // pick the set with the highest weight*reps on that best day.
  for (const [exId, byDay] of Object.entries(volumeByExByDay)) {
    let bestDay: { day: string; total: number } | null = null;
    for (const [day, total] of Object.entries(byDay)) {
      const val = Number(total);
      if (!bestDay || val > bestDay.total) bestDay = { day, total: val };
    }
    if (!bestDay) continue;
    const dayISO = bestDay.day; // YYYY-MM-DD
    const start = new Date(`${dayISO}T00:00:00`).toISOString();
    const end = new Date(`${dayISO}T00:00:00`);
    end.setDate(end.getDate() + 1);
    const endISO = end.toISOString();
    // Among sets for that day+exercise, pick set with max weight*reps
    let bestSet: { id: string; when: string; score: number } | null = null;
    for (const r of (sets ?? []) as any[]) {
      if ((r.exercise_id as string) !== exId) continue;
      const when = r.performed_at ?? r.created_at;
      if (!when || when < start || when >= endISO) continue;
      if (r.failed) continue;
      const score = Number(r.weight) * Number(r.reps);
      if (isNaN(score)) continue;
      if (!bestSet || score > bestSet.score) bestSet = { id: r.id, when, score };
    }
    if (bestSet) {
      volumePR[exId] = { value: bestDay.total, dateISO: new Date(`${dayISO}T00:00:00`).toISOString(), setId: bestSet.id };
    }
  }

  // Prepare rows for personal_records; rebuild fully to avoid duplication
  const rows: any[] = [];
  const addRow = (exercise_id: string, metric: 'weight' | '1rm' | 'volume', pr?: PRVal) => {
    if (!pr) return;
    rows.push({
      user_id: user.id,
      exercise_id,
      metric,
      value: pr.value,
      performed_at: pr.dateISO,
      set_id: pr.setId,
    });
  };
  const exerciseIds = new Set<string>([
    ...Object.keys(weightPR),
    ...Object.keys(oneRMPR),
    ...Object.keys(volumePR),
  ]);
  for (const exId of exerciseIds) {
    addRow(exId, 'weight', weightPR[exId]);
    addRow(exId, '1rm', oneRMPR[exId]);
    addRow(exId, 'volume', volumePR[exId]);
  }

  // Replace personal_records for this user
  const { error: delErr } = await supabase.from('personal_records').delete().eq('user_id', user.id);
  if (delErr) throw delErr;
  if (rows.length) {
    const { error: insErr } = await supabase.from('personal_records').insert(rows);
    if (insErr) throw insErr;
  }
}

// Fetch precomputed PRs for the current user, both metrics
export async function getPRs(): Promise<Array<{
  exerciseId: string;
  exerciseName: string;
  weightPR: { value: number; dateISO: string } | null;
  oneRMPR: { value: number; dateISO: string } | null;
  volumePR: { value: number; dateISO: string } | null;
}>> {
  const { data, error } = await supabase
    .from('personal_records')
    .select('exercise_id, metric, value, performed_at, exercise:exercises(name)');
  if (error) throw error;

  const byEx: Record<string, {
    name: string;
    weight?: { value: number; dateISO: string };
    onerm?: { value: number; dateISO: string };
    volume?: { value: number; dateISO: string };
  }> = {};

  for (const r of (data ?? []) as any[]) {
    const exId = r.exercise_id as string;
    const metric = r.metric as string;
    const name = r.exercise?.name ?? '—';
    if (!byEx[exId]) byEx[exId] = { name };
    if (metric === 'weight') byEx[exId].weight = { value: Number(r.value), dateISO: r.performed_at };
    if (metric === '1rm') byEx[exId].onerm = { value: Number(r.value), dateISO: r.performed_at };
    if (metric === 'volume') byEx[exId].volume = { value: Number(r.value), dateISO: r.performed_at };
  }

  return Object.entries(byEx)
    .map(([exerciseId, v]) => ({
      exerciseId,
      exerciseName: v.name,
      weightPR: v.weight ?? null,
      oneRMPR: v.onerm ?? null,
      volumePR: v.volume ?? null,
    }))
    .sort((a, b) => a.exerciseName.localeCompare(b.exerciseName));
}


export async function createExercise(input: { name: string; short_name: string | null }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const payload = {
    user_id: user.id,
    name: input.name.trim(),
    short_name: input.short_name?.trim() || null,
  };
  const { data, error } = await supabase
    .from('exercises')
    .insert(payload)
    .select('*')
    .single();
  if (error) throw error;
  return data as Exercise;
}

// Create a set (sets-only; uses performed_at)
export async function addSetBare(set: {
  exercise_id: string;
  weight: number;
  reps: number;
  rpe?: number | null;
  failed?: boolean;
  performed_at?: string | null;   // ISO string
}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const payload: any = {
    user_id: user.id,
    exercise_id: set.exercise_id,
    weight: set.weight,
    reps: set.reps,
    rpe: set.rpe ?? null,
    failed: !!set.failed,
    performed_at: set.performed_at ?? null,
  };

  const { data, error } = await supabase
    .from('sets')
    .insert(payload)
    .select('*, exercise:exercises(*)')
    .single();
  if (error) throw error;
  return data as SetEntry & { exercise: Exercise };
}

// List sets for a specific local day [start, end)
export async function listSetsByDay(dayISO: string) {
  const startISO = localDayStartISO(dayISO);
  const endISO = localNextDayStartISO(dayISO);
  const { data, error } = await supabase
    .from('sets')
    .select('*, exercise:exercises(*)')
    .gte('performed_at', startISO)
    .lt('performed_at', endISO)
    .order('performed_at', { ascending: true });
  if (error) throw error;
  return data as (SetEntry & { exercise: Exercise })[];
}

// Recent days that have sets (for History)
export async function listRecentDays(limit = 30) {
  const { data, error } = await supabase
    .from('sets')
    .select('performed_at, created_at')  // ← include created_at as fallback
    .order('performed_at', { ascending: false })
    .limit(1000);
  if (error) throw error;

  const seen = new Set<string>();
  const days: string[] = [];
  for (const r of (data ?? []) as { performed_at: string | null; created_at: string }[]) {
    const d = new Date(r.performed_at ?? r.created_at);
    const key = d.toLocaleDateString('en-CA'); // YYYY-MM-DD
    if (!seen.has(key)) { seen.add(key); days.push(key); }
    if (days.length >= limit) break;
  }
  return days;
}


// Return a mapping of day ("YYYY-MM-DD") -> array of distinct exercise labels (short_name || name)
export async function listExerciseBadgesForDays(days: string[]) {
  if (!days.length) return {} as Record<string, string[]>;
  // Compute a single time window to fetch once
  const sorted = [...days].sort();
  const startISO = localDayStartISO(sorted[0]);
  const endISO = localNextDayStartISO(sorted[sorted.length - 1]);

  const { data, error } = await supabase
    .from('sets')
    .select('performed_at, exercise:exercises(name, short_name)')
    .gte('performed_at', startISO)
    .lt('performed_at', endISO);
  if (error) throw error;

  const map: Record<string, Set<string>> = {};
  for (const row of (data ?? []) as any[]) {
    const d = new Date(row.performed_at);
    const key = d.toLocaleDateString("en-CA"); // YYYY-MM-DD in local tz
    const label = row.exercise?.short_name ?? row.exercise?.name ?? "—";
    if (!map[key]) map[key] = new Set<string>();
    map[key].add(label);
  }

  const out: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(map)) out[k] = Array.from(v).sort();
  return out;
}
