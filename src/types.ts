export type Exercise = {
  id: string;
  user_id: string | null;
  name: string;
  short_name?: string | null;
};

export type SetEntry = {
  id: string;
  user_id: string;
  exercise_id: string;
  weight: number;
  reps: number;
  rpe: number | null;
  failed: boolean;
  created_at: string;
  performed_at: string | null;
};
