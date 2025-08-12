export type Mood = 'tired'|'energized'|'focused'|'stressed'|'sore'|'meh'|'ok';
export type Feeling = Mood; // same enum for now

export type Profile = { id: string; display_name: string | null };
export type Exercise = { id: string; user_id: string | null; name: string; short_name?: string; category: string | null; is_bodyweight: boolean };
export type Workout = { id: string; user_id: string; date: string; notes: string | null; mood: Mood | null; feelings: Feeling[]; sleep_hours: number | null };
export type SetEntry = { id: string; user_id: string; workout_id: string; exercise_id: string; weight: number; reps: number; rpe: number | null; failed: boolean; notes: string | null; created_at: string };