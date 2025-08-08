import { useEffect, useState } from 'react';
import ExercisePicker from '../components/ExercisePicker';
import SetEditor from '../components/SetEditor';
import { addSet, createWorkout, listSetsByWorkout, upsertWorkout } from '../lib/api';
import { useWorkoutStore } from '../state/useWorkoutStore';
import type { Mood } from '../types';

const MOODS: Mood[] = ['tired','energized','focused','stressed','sore','meh','ok'];

export default function Log() {
  const activeWorkoutId = useWorkoutStore(s => s.activeWorkoutId);
  const setActiveWorkoutId = useWorkoutStore(s => s.setActiveWorkoutId);
  const units = useWorkoutStore(s => s.units);

  const [exerciseId, setExerciseId] = useState<string | null>(null);
  const [sets, setSets] = useState<any[]>([]);
  const [mood, setMood] = useState<Mood | ''>('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!activeWorkoutId) return;
    listSetsByWorkout(activeWorkoutId).then(setSets);
  }, [activeWorkoutId]);

  const startWorkout = async () => {
    const w = await createWorkout({ mood: mood || null, notes: notes || null });
    setActiveWorkoutId(w.id);
  };

  const finishWorkout = async () => {
    if (!activeWorkoutId) return;
    await upsertWorkout(activeWorkoutId, { mood: mood || null, notes: notes || null });
    setActiveWorkoutId(null);
    setSets([]);
    setExerciseId(null);
    setNotes('');
    setMood('');
  };

  const onAddSet = async (s: { weight: number; reps: number; rpe?: number|null; failed?: boolean }) => {
    if (!activeWorkoutId || !exerciseId) {
      alert('Pick an exercise and start a workout first');
      return;
    }
    const kg = units === 'kg' ? s.weight : s.weight * 0.45359237;
    await addSet(activeWorkoutId, { exercise_id: exerciseId, weight: kg, reps: s.reps, rpe: s.rpe ?? null, failed: s.failed ?? false });
    const updated = await listSetsByWorkout(activeWorkoutId);
    setSets(updated);
  };

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="card grid" style={{ gap: 12 }}>
        <div className="row">
          <ExercisePicker value={exerciseId} onChange={setExerciseId} />
          <div>
            <label>Mood</label>
            <select value={mood} onChange={e => setMood(e.target.value as Mood | '')}>
              <option value="">—</option>
              {MOODS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label>Notes</label>
            <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional" />
          </div>
        </div>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <button onClick={startWorkout} disabled={!!activeWorkoutId} className="primary">Start workout</button>
          <button onClick={finishWorkout} disabled={!activeWorkoutId}>Finish workout</button>
        </div>
      </div>

      <SetEditor onAdd={onAddSet} units={units} />

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Sets this workout</h3>
        {activeWorkoutId ? (
          sets.length ? (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>Time</th>
                  <th style={{ textAlign: 'left' }}>Exercise</th>
                  <th>Weight (kg)</th>
                  <th>Reps</th>
                  <th>RPE</th>
                  <th>Failed</th>
                </tr>
              </thead>
              <tbody>
                {sets.map((s, i) => (
                  <tr key={s.id}>
                    <td>{new Date(s.created_at).toLocaleTimeString()}</td>
                    <td>{s.exercise?.name ?? '—'}</td>
                    <td style={{ textAlign: 'center' }}>{s.weight}</td>
                    <td style={{ textAlign: 'center' }}>{s.reps}</td>
                    <td style={{ textAlign: 'center' }}>{s.rpe ?? '—'}</td>
                    <td style={{ textAlign: 'center' }}>{s.failed ? '✔︎' : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>No sets yet.</p>
          )
        ) : (
          <p>Start a workout to begin logging sets.</p>
        )}
      </div>
    </div>
  );
}