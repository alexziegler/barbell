import { supabase } from './supabaseClient';
import type { Exercise, Workout, SetEntry, Mood, Feeling } from '../types';

export async function getExercises() {
  const { data, error } = await supabase
    .from('exercises')
    .select('*')
    .order('name', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function createWorkout(opts: { date?: string; mood?: Mood|null; feelings?: Feeling[]; notes?: string|null }): Promise<Workout> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const payload = { user_id: user.id, date: opts.date ?? new Date().toISOString(), mood: opts.mood ?? null, feelings: opts.feelings ?? [], notes: opts.notes ?? null };
  const { data, error } = await supabase.from('workouts').insert(payload).select('*').single();
  if (error) throw error; return data as Workout;
}

export async function upsertWorkout(id: string, patch: Partial<Pick<Workout,'mood'|'feelings'|'notes'|'date'>>): Promise<Workout> {
  const { data, error } = await supabase.from('workouts').update(patch).eq('id', id).select('*').single();
  if (error) throw error; return data as Workout;
}

export async function addSet(
  workout_id: string,
  set: { exercise_id: string; weight: number; reps: number; rpe?: number|null; failed?: boolean; performed_at?: string | null }
): Promise<SetEntry> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const payload: any = {
    user_id: user.id,
    workout_id,
    exercise_id: set.exercise_id,
    weight: set.weight,
    reps: set.reps,
    rpe: set.rpe ?? null,
    failed: !!set.failed,
  };
  if (set.performed_at) payload.performed_at = set.performed_at;

  const { data, error } = await supabase.from('sets').insert(payload).select('*').single();
  if (error) throw error;
  return data as SetEntry;
}

export async function updateSet(id: string, patch: Partial<Pick<SetEntry,'exercise_id'|'weight'|'reps'|'rpe'|'failed'|'notes'>>): Promise<SetEntry> {
  const { data, error } = await supabase.from('sets').update(patch).eq('id', id).select('*').single();
  if (error) throw error; return data as SetEntry;
}

export async function deleteSet(id: string): Promise<void> {
  const { error } = await supabase.from('sets').delete().eq('id', id);
  if (error) throw error;
}

export async function listWorkouts(limit = 30): Promise<Workout[]> {
  const { data, error } = await supabase.from('workouts').select('*').order('date', { ascending: false }).limit(limit);
  if (error) throw error; return data as Workout[];
}

export async function listSetsByWorkout(workout_id: string): Promise<(SetEntry & { exercise: Exercise })[]> {
  const { data, error } = await supabase
    .from('sets')
    .select('*, exercise:exercises(*)')
    .eq('workout_id', workout_id)
    .order('created_at', { ascending: true });
  if (error) throw error; return data as any;
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
}>> {
  const { data, error } = await supabase
    .from('personal_records')
    .select('exercise_id, metric, value, performed_at, exercise:exercises(name)');
  if (error) throw error;

  const byEx: Record<string, {
    name: string;
    weight?: { value: number; dateISO: string };
    onerm?: { value: number; dateISO: string };
  }> = {};

  for (const r of (data ?? []) as any[]) {
    const exId = r.exercise_id as string;
    const metric = r.metric as string;
    const name = r.exercise?.name ?? '—';
    if (!byEx[exId]) byEx[exId] = { name };
    if (metric === 'weight') byEx[exId].weight = { value: Number(r.value), dateISO: r.performed_at };
    if (metric === '1rm') byEx[exId].onerm = { value: Number(r.value), dateISO: r.performed_at };
  }

  return Object.entries(byEx)
    .map(([exerciseId, v]) => ({
      exerciseId,
      exerciseName: v.name,
      weightPR: v.weight ?? null,
      oneRMPR: v.onerm ?? null,
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
    category: null,
    is_bodyweight: false,
  };
  const { data, error } = await supabase
    .from('exercises')
    .insert(payload)
    .select('*')
    .single();
  if (error) throw error;
  return data as Exercise;
}