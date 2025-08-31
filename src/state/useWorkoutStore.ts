import { create } from 'zustand';

interface WorkoutState {
  units: 'kg'|'lb';
  setUnits: (u: 'kg'|'lb') => void;
}

export const useWorkoutStore = create<WorkoutState>((set) => ({
  units: 'kg',
  setUnits: (u) => set({ units: u }),
}));