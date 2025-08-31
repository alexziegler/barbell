import { useEffect, useState } from 'react';
import ExercisePicker from '../components/ExercisePicker';
import SetEditor from '../components/SetEditor';
import InlineSetEditor from '../components/InlineSetEditor';
import { addSetBare, listSetsByDay, updateSet, deleteSet, getExercises, upsertPRForSet } from '../lib/api';
import type { Exercise } from '../types';
import { useWorkoutStore } from '../state/useWorkoutStore'; // we still use 'units'



export default function Log() {
  const units = useWorkoutStore(s => s.units);

  const [exerciseId, setExerciseId] = useState<string | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [sets, setSets] = useState<any[]>([]);
  const [editingSetId, setEditingSetId] = useState<string | null>(null);

  useEffect(() => { getExercises().then(setExercises); }, []);
  useEffect(() => { 
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    listSetsByDay(today).then(setSets); 
  }, []);

  const onAddSet = async (s: { weight: number; reps: number; rpe?: number|null; failed?: boolean; performed_at?: string }) => {
    if (!exerciseId) { alert('Pick an exercise'); return; }
    const kg = units === 'kg' ? s.weight : s.weight * 0.45359237;

    const inserted = await addSetBare({
      exercise_id: exerciseId,
      weight: kg,
      reps: s.reps,
      rpe: s.rpe ?? null,
      failed: s.failed ?? false,
      performed_at: s.performed_at ?? undefined,
    });

    try {
      const res = await upsertPRForSet(inserted.id);
      if (res?.new_weight || res?.new_1rm) {
        const exName = exercises.find(e => e.id === exerciseId)?.name ?? 'Exercise';
        const parts:string[] = [];
        if (res.new_weight) parts.push('Heaviest');
        if (res.new_1rm) parts.push('Best 1RM');
        alert(`🎉 New PR (${parts.join(' & ')}): ${exName}`);
      }
    } catch {}

    const today = new Date().toISOString().split('T')[0];
    listSetsByDay(today).then(setSets);
  };

  const onSaveSet = async (id: string, patch: any) => {
    await updateSet(id, patch);
    const today = new Date().toISOString().split('T')[0];
    listSetsByDay(today).then(setSets);
    setEditingSetId(null);
  };

  const onDelete = async (id: string) => {
    if (!confirm('Delete this set?')) return;
    await deleteSet(id);
    const today = new Date().toISOString().split('T')[0];
    listSetsByDay(today).then(setSets);
  };

    return (
    <div className="page-container">
      {/* Log a Set Block */}
      <div className="card">
        <h3 className="page-title">
          📝 Log a Set
        </h3>
        
        {/* Exercise Selection */}
        <div className="mb-lg">
          <ExercisePicker value={exerciseId} onChange={setExerciseId} />
        </div>

        {/* Set Editor */}
        {exerciseId && (
          <SetEditor
            onAdd={onAddSet}
            units={units}
          />
        )}
        
        {!exerciseId && (
          <div className="empty-state empty-state--small">
            <div className="empty-state__icon">🏋️</div>
            <div className="empty-state__title">Select an exercise to start logging sets</div>
          </div>
        )}
      </div>

      {/* Today's Sets Block */}
      <div className="card">
        <h3 className="page-title">
          📊 Today's Sets
          {sets.length > 0 && (
            <span className="page-subtitle">
              ({sets.length} set{sets.length > 1 ? 's' : ''})
            </span>
          )}
        </h3>
        
        {sets.length ? (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Exercise</th>
                  <th className="text-center">Weight (kg)</th>
                  <th className="text-center">Reps</th>
                  <th className="text-center">RPE</th>
                  <th className="text-center">Failed</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sets.map((s: any) =>
                  editingSetId === s.id ? (
                    <InlineSetEditor
                      key={s.id}
                      set={s}
                      exercises={exercises}
                      onSave={(patch) => onSaveSet(s.id, patch)}
                      onCancel={() => setEditingSetId(null)}
                      onDelete={() => onDelete(s.id)}
                      showTime={false}
                    />
                  ) : (
                    <tr key={s.id}>
                      <td>
                        <div className="font-medium">
                          {s.exercise?.short_name ?? s.exercise?.name ?? '—'}
                        </div>
                      </td>
                      <td className="text-center font-bold">
                        {Number(s.weight).toFixed(2)}
                      </td>
                      <td className="text-center">{s.reps}</td>
                      <td className="text-center">{s.rpe ?? '—'}</td>
                      <td className="text-center">
                        {s.failed ? <span className="text-danger">✔</span> : ''}
                      </td>
                      <td className="table-actions">
                        <button className="ghost btn-small" onClick={() => setEditingSetId(s.id)}>
                          Edit
                        </button>
                        <button className="btn-small" onClick={() => onDelete(s.id)}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state__icon">📊</div>
            <div className="empty-state__title">No sets logged today yet</div>
            <div className="empty-state__subtitle">Start by selecting an exercise above</div>
          </div>
        )}
      </div>
    </div>
  );
}