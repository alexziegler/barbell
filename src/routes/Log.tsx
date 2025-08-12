import { useEffect, useState } from 'react';
import ExercisePicker from '../components/ExercisePicker';
import SetEditor from '../components/SetEditor';
import InlineSetEditor from '../components/InlineSetEditor';
import { addSet, createWorkout, listSetsByWorkout, updateSet, deleteSet, getExercises, upsertPRForSet } from '../lib/api';
import { useWorkoutStore } from '../state/useWorkoutStore';
import type { Exercise } from '../types';

export default function Log() {
  const activeWorkoutId = useWorkoutStore(s => s.activeWorkoutId);
  const setActiveWorkoutId = useWorkoutStore(s => s.setActiveWorkoutId);
  const units = useWorkoutStore(s => s.units);

  const [exerciseId, setExerciseId] = useState<string | null>(null);
  const [sets, setSets] = useState<any[]>([]);
  const [editingSetId, setEditingSetId] = useState<string | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);

  useEffect(() => { getExercises().then(setExercises); }, []);
  useEffect(() => { if (activeWorkoutId) listSetsByWorkout(activeWorkoutId).then(setSets); }, [activeWorkoutId]);

  const startWorkout = async () => {
    const w = await createWorkout({}); // no mood/notes in this flow
    setActiveWorkoutId(w.id);
  };

  const finishWorkout = async () => {
    setActiveWorkoutId(null);
    setSets([]);
    setExerciseId(null);
  };

  const onAddSet = async (s: { weight: number; reps: number; rpe?: number|null; failed?: boolean; performed_at?: string }) => {
    if (!activeWorkoutId || !exerciseId) { alert('Start a workout and pick an exercise'); return; }
    const kg = units === 'kg' ? s.weight : s.weight * 0.45359237;

    const inserted = await addSet(activeWorkoutId, {
      exercise_id: exerciseId,
      weight: kg,
      reps: s.reps,
      rpe: s.rpe ?? null,
      failed: s.failed ?? false,
      performed_at: s.performed_at ?? null,
    });

    // PR check + celebration
    try {
      const res = await upsertPRForSet(inserted.id);
      if (res?.new_weight || res?.new_1rm) {
        const exName = exercises.find(e => e.id === exerciseId)?.name ?? 'Exercise';
        const parts = [];
        if (res.new_weight) parts.push('Heaviest');
        if (res.new_1rm) parts.push('Best 1RM');
        alert(`🎉 New PR (${parts.join(' & ')}): ${exName}`);
      }
    } catch {}

    const updated = await listSetsByWorkout(activeWorkoutId);
    setSets(updated);
  };

  const onSaveSet = async (id: string, patch: any) => {
    await updateSet(id, patch);
    if (activeWorkoutId) {
      const updated = await listSetsByWorkout(activeWorkoutId);
      setSets(updated);
      setEditingSetId(null);
    }
  };

  const onDeleteSet = async (id: string) => {
    if (!activeWorkoutId) return;
    if (!confirm('Delete this set?')) return;
    await deleteSet(id);
    const updated = await listSetsByWorkout(activeWorkoutId);
    setSets(updated);
  };

  // —— UI —— //

  // 1) Initial state: only start button
  if (!activeWorkoutId) {
    return (
      <div className="grid" style={{ gap: 16 }}>
        <div className="card row" style={{ justifyContent: 'center' }}>
          <button className="primary" onClick={startWorkout}>Start workout</button>
        </div>
      </div>
    );
  }

  // 2) Workout in progress
  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="card row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="row" style={{ gap: 12, alignItems: 'center' }}>
          <ExercisePicker value={exerciseId} onChange={setExerciseId} />
        </div>
        <button onClick={finishWorkout}>Finish workout</button>
      </div>

      <SetEditor onAdd={onAddSet} units={units} />

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Sets this workout</h3>
        {sets.length ? (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {/* no time column here either; History already hides it */}
                <th style={{ textAlign: 'left' }}>Exercise</th>
                <th>Weight (kg)</th>
                <th>Reps</th>
                <th>RPE</th>
                <th>Failed</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sets.map((s: any) => (
                editingSetId === s.id ? (
                  <InlineSetEditor
                    key={s.id}
                    set={s}
                    exercises={exercises}
                    onSave={(patch) => onSaveSet(s.id, patch)}
                    onCancel={() => setEditingSetId(null)}
                    onDelete={() => onDeleteSet(s.id)}
                    showTime={false}
                  />
                ) : (
                  <tr key={s.id}>
                    <td>{s.exercise?.name ?? '—'}</td>
                    <td style={{ textAlign: 'center' }}>{s.weight}</td>
                    <td style={{ textAlign: 'center' }}>{s.reps}</td>
                    <td style={{ textAlign: 'center' }}>{s.rpe ?? '—'}</td>
                    <td style={{ textAlign: 'center' }}>{s.failed ? '✔︎' : ''}</td>
                    <td className="row" style={{ gap: 6, justifyContent: 'flex-end' }}>
                      <button className="ghost" onClick={() => setEditingSetId(s.id)}>Edit</button>
                      <button onClick={() => onDeleteSet(s.id)}>Delete</button>
                    </td>
                  </tr>
                )
              ))}
            </tbody>
          </table>
        ) : (
          <p>No sets yet.</p>
        )}
      </div>
    </div>
  );
}