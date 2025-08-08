import { create } from 'zustand';

interface WorkoutState {
  activeWorkoutId: string | null;
  setActiveWorkoutId: (id: string | null) => void;
  units: 'kg'|'lb';
  setUnits: (u: 'kg'|'lb') => void;
}

export const useWorkoutStore = create<WorkoutState>((set) => ({
  activeWorkoutId: null,
  setActiveWorkoutId: (id) => set({ activeWorkoutId: id }),
  units: 'kg',
  setUnits: (u) => set({ units: u }),
}));