export function estimate1RM(weight: number, reps: number) {
  // Epley
  return weight * (1 + reps / 30);
}