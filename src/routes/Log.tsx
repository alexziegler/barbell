// src/routes/Log.tsx
import { useEffect, useMemo, useState } from 'react';
import ExercisePicker from '../components/ExercisePicker';
import SetEditor from '../components/SetEditor';
import InlineSetEditor from '../components/InlineSetEditor';
import { addSet, createWorkout, listSetsByWorkout, upsertWorkout, updateSet, deleteSet, getExercises } from '../lib/api';
import { useWorkoutStore } from '../state/useWorkoutStore';
import type { Mood, Exercise } from '../types';
import { upsertPRForSet } from '../lib/api';

const MOODS: Mood[] = ['tired','energized','focused','stressed','sore','meh','ok'];

// helpers for date/time inputs
function nowDateStr() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
function nowTimeStr() {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mi}`;
}
function localDateTimeToISO(dateStr: string, timeStr: string) {
  // combine local date+time into a Date and return ISO (with timezone)
  const [y,m,d] = dateStr.split('-').map(Number);
  const [hh,mm] = timeStr.split(':').map(Number);
  const local = new Date(y, (m - 1), d, hh, mm, 0, 0);
  return local.toISOString();
}

export default function Log() {
  const activeWorkoutId = useWorkoutStore(s => s.activeWorkoutId);
  const setActiveWorkoutId = useWorkoutStore(s => s.setActiveWorkoutId);
  const units = useWorkoutStore(s => s.units);

  const [exerciseId, setExerciseId] = useState<string | null>(null);
  const [sets, setSets] = useState<any[]>([]);
  const [mood, setMood] = useState<Mood | ''>('');
  const [notes, setNotes] = useState('');

  // NEW: date/time state for the workout (defaults to now)
  const [dateStr, setDateStr] = useState(nowDateStr());
  const [timeStr, setTimeStr] = useState(nowTimeStr());

  const [editingSetId, setEditingSetId] = useState<string | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);

  useEffect(() => { getExercises().then(setExercises); }, []);

  useEffect(() => {
    if (!activeWorkoutId) return;
    listSetsByWorkout(activeWorkoutId).then(setSets);
  }, [activeWorkoutId]);

  const startWorkout = async () => {
    const dateIso = localDateTimeToISO(dateStr, timeStr);
    const w = await createWorkout({ date: dateIso, mood: mood || null, notes: notes || null });
    setActiveWorkoutId(w.id);
  };

  const saveWorkoutDateTime = async () => {
    if (!activeWorkoutId) return;
    const dateIso = localDateTimeToISO(dateStr, timeStr);
    await upsertWorkout(activeWorkoutId, { date: dateIso });
  };

  const finishWorkout = async () => {
    if (!activeWorkoutId) return;
    await upsertWorkout(activeWorkoutId, { mood: mood || null, notes: notes || null });
    setActiveWorkoutId(null);
    setSets([]);
    setExerciseId(null);
    setNotes('');
    setMood('');
    setDateStr(nowDateStr());
    setTimeStr(nowTimeStr());
  };

  const onAddSet = async (s: { weight: number; reps: number; rpe?: number | null; failed?: boolean }) => {
  if (!activeWorkoutId || !exerciseId) {
    alert('Pick an exercise and start a workout first');
    return;
  }

  const kg = units === 'kg' ? s.weight : s.weight * 0.45359237;

  // Insert and get the new set back (your addSet returns the row with id)
  const inserted = await addSet(activeWorkoutId, {
    exercise_id: exerciseId,
    weight: kg,
    reps: s.reps,
    rpe: s.rpe ?? null,
    failed: s.failed ?? false,
  });

  // PR check (only if we got an ID)
  if (inserted?.id) {
    try {
      const isPR = await upsertPRForSet(inserted.id);
      if (isPR) {
        const exName = exercises.find((e) => e.id === exerciseId)?.name ?? 'Exercise';
        const pretty = Math.round((kg + Number.EPSILON) * 100) / 100;
        alert(`🎉 New PR: ${exName} — ${pretty} kg`);
      }
    } catch (e) {
      // Fail silently for PR calculation; logging is optional
      console.warn('PR upsert failed:', e);
    }
  }

  // Refresh sets in the UI
  const updated = await listSetsByWorkout(activeWorkoutId);
  setSets(updated);
};

  const onSaveSet = async (id: string, patch: any) => {
    if (!activeWorkoutId) return;
    await updateSet(id, patch);
    const updated = await listSetsByWorkout(activeWorkoutId);
    setSets(updated);
    setEditingSetId(null);
  };

  const onDeleteSet = async (id: string) => {
    if (!activeWorkoutId) return;
    if (!confirm('Delete this set?')) return;
    await deleteSet(id);
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

        {/* NEW: date + time pickers */}
        <div className="row">
          <div>
            <label>Workout date</label>
            <input type="date" value={dateStr} onChange={e => setDateStr(e.target.value)} />
          </div>
          <div>
            <label>Workout time</label>
            <input type="time" value={timeStr} onChange={e => setTimeStr(e.target.value)} />
          </div>
          {activeWorkoutId && (
            <div style={{ alignSelf: 'end' }}>
              <button className="ghost" onClick={saveWorkoutDateTime}>Save date/time</button>
            </div>
          )}
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
                    />
                  ) : (
                    <tr key={s.id}>
                      <td>{new Date(s.created_at).toLocaleTimeString()}</td>
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
          )
        ) : (
          <p>Pick a date/time and start a workout to begin logging sets.</p>
        )}
      </div>
    </div>
  );
}