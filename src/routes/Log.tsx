import { useEffect, useMemo, useState } from 'react';
import ExercisePicker from '../components/ExercisePicker';
import SetEditor from '../components/SetEditor';
import InlineSetEditor from '../components/InlineSetEditor';
import { addSetBare, listSetsByDay, updateSet, deleteSet, getExercises, upsertPRForSet } from '../lib/api';
import type { Exercise } from '../types';
import { useWorkoutStore } from '../state/useWorkoutStore'; // we still use 'units'

function todayLocalISODate() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export default function Log() {
  const units = useWorkoutStore(s => s.units);

  const [exerciseId, setExerciseId] = useState<string | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [day, setDay] = useState<string>(todayLocalISODate());
  const [sets, setSets] = useState<any[]>([]);
  const [editingSetId, setEditingSetId] = useState<string | null>(null);

  useEffect(() => { getExercises().then(setExercises); }, []);
  useEffect(() => { listSetsByDay(day).then(setSets); }, [day]);

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

    listSetsByDay(day).then(setSets);
  };

  const onSaveSet = async (id: string, patch: any) => {
    await updateSet(id, patch);
    listSetsByDay(day).then(setSets);
    setEditingSetId(null);
  };

  const onDelete = async (id: string) => {
    if (!confirm('Delete this set?')) return;
    await deleteSet(id);
    listSetsByDay(day).then(setSets);
  };

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="card row" style={{ justifyContent: 'space-between', alignItems: 'end' }}>
        <div style={{ minWidth: 220 }}>
          <label>Exercise</label>
          <ExercisePicker value={exerciseId} onChange={setExerciseId} />
        </div>
        <div>
          <label>Day</label>
          <input type="date" value={day} onChange={e => setDay(e.target.value)} />
        </div>
      </div>

      <SetEditor
        onAdd={onAddSet}
        units={units}
      />

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Sets on {new Date(day).toLocaleDateString('en-GB')}</h3>
        {sets.length ? (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Exercise</th>
                <th>Weight (kg)</th>
                <th>Reps</th>
                <th>RPE</th>
                <th>Failed</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
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
                    showNotes={false}
                  />
                ) : (
                  <tr key={s.id}>
                    <td>{s.exercise?.short_name ?? s.exercise?.name ?? '—'}</td>
                    <td style={{ textAlign: 'center' }}>{s.weight}</td>
                    <td style={{ textAlign: 'center' }}>{s.reps}</td>
                    <td style={{ textAlign: 'center' }}>{s.rpe ?? '—'}</td>
                    <td style={{ textAlign: 'center' }}>{s.failed ? '✔︎' : ''}</td>
                    <td className="row" style={{ gap: 6, justifyContent: 'flex-end' }}>
                      <button className="ghost" onClick={() => setEditingSetId(s.id)}>Edit</button>
                      <button onClick={() => onDelete(s.id)}>Delete</button>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        ) : (
          <p>No sets for this day yet.</p>
        )}
      </div>
    </div>
  );
}