import { supabase } from './supabaseClient';
import type { Exercise, Workout, SetEntry, Mood, Feeling } from '../types';

export async function getExercises(): Promise<Exercise[]> {
  const { data, error } = await supabase.from('exercises').select('*').order('name');
  if (error) throw error; return data as Exercise[];
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

export async function addSet(workout_id: string, set: { exercise_id: string; weight: number; reps: number; rpe?: number|null; failed?: boolean; notes?: string|null }): Promise<SetEntry> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const payload = { user_id: user.id, workout_id, exercise_id: set.exercise_id, weight: set.weight, reps: set.reps, rpe: set.rpe ?? null, failed: !!set.failed, notes: set.notes ?? null };
  const { data, error } = await supabase.from('sets').insert(payload).select('*').single();
  if (error) throw error; return data as SetEntry;
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