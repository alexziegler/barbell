import { supabase } from './supabaseClient';
import type { Exercise, SetEntry } from '../types';

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
export async function upsertPRForSet(setId: string): Promise<{ new_weight: boolean; new_1rm: boolean }> {
  const { data, error } = await supabase.rpc('upsert_pr_for_set', { p_set_id: setId });
  if (error) throw error;
  return (data ?? { new_weight: false, new_1rm: false }) as any;
}

export async function recomputePRs(): Promise<void> {
  const { error } = await supabase.rpc('recompute_prs');
  if (error) throw error;
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
