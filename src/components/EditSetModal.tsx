import { useEffect, useState } from 'react';
import type { Exercise } from '../types';

function parseLocalizedDecimal(s: string): number | null {
  if (s.trim() === '') return null;
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

export default function EditSetModal({
  open,
  set,
  exercises,
  onClose,
  onSave,
  onDelete,
}: {
  open: boolean;
  set: any | null;
  exercises: Exercise[];
  onClose: () => void;
  onSave: (patch: { exercise_id: string; weight: number; reps: number; rpe: number | null; failed: boolean; performed_at?: string }) => void;
  onDelete?: () => void;
}) {
  const [exerciseId, setExerciseId] = useState<string>('');
  const [reps, setReps] = useState<number>(0);
  const [rpe, setRpe] = useState<number | ''>('');
  const [failed, setFailed] = useState<boolean>(false);
  const [weightStr, setWeightStr] = useState<string>('');
  const [performedAt, setPerformedAt] = useState<string>('');

  useEffect(() => {
    if (!open || !set) return;
    setExerciseId(set.exercise_id);
    setReps(Number(set.reps));
    setRpe(set.rpe ?? '');
    setFailed(!!set.failed);
    setWeightStr(String(set.weight).replace('.', ','));
    const base = set.performed_at || set.created_at || new Date().toISOString();
    setPerformedAt(new Date(base).toISOString().slice(0, 16));
  }, [open, set]);

  if (!open || !set) return null;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>✏️ Edit Set</h3>
        <form className="form-grid" onSubmit={(e) => { e.preventDefault(); onSave({
          exercise_id: exerciseId,
          weight: parseLocalizedDecimal(weightStr) || 0,
          reps,
          rpe: rpe === '' ? null : (rpe as number),
          failed,
          performed_at: new Date(performedAt).toISOString(),
        }); }}>
          <div className="form-field">
            <label>Exercise</label>
            <select value={exerciseId} onChange={(e) => setExerciseId(e.target.value)}>
              {exercises.map((ex) => (
                <option key={ex.id} value={ex.id}>{ex.name}</option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label>Weight (kg)</label>
            <input className="input-compact" type="text" inputMode="decimal" pattern="[0-9]*[.,]?[0-9]*" value={weightStr} onChange={(e) => setWeightStr(e.target.value)} />
          </div>

          <div className="form-field">
            <label>Reps</label>
            <input className="input-compact" type="number" value={reps} onChange={(e) => setReps(parseInt(e.target.value || '0', 10))} />
          </div>

          <div className="form-field">
            <label>RPE</label>
            <input className="input-compact" type="number" step={0.5} value={rpe} onChange={(e) => setRpe(e.target.value === '' ? '' : parseFloat(e.target.value))} />
          </div>

          <div className="form-field">
            <label>Failed</label>
            <input type="checkbox" checked={failed} onChange={(e) => setFailed(e.target.checked)} />
          </div>

          <div className="form-field">
            <label>Date & Time</label>
            <input type="datetime-local" value={performedAt} onChange={(e) => setPerformedAt(e.target.value)} />
          </div>

          <div className="form-actions">
            {onDelete && (
              <button type="button" onClick={onDelete}>Delete</button>
            )}
            <button type="button" className="ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="primary">Save</button>
          </div>
        </form>
      </div>
    </div>
  );
}

