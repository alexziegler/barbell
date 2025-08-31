import { useEffect, useState } from 'react';
import type { Exercise } from '../types';

function parseLocalizedDecimal(s: string): number | null {
  if (s.trim() === '') return null;
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

export default function InlineSetEditor({
  set,
  exercises,
  onSave,
  onCancel,
  onDelete,
  showTime = true,
  showDate = false,
}: {
  set: any;
  exercises: Exercise[];
  onSave: (patch: { exercise_id: string; weight: number; reps: number; rpe: number|null; failed: boolean; performed_at?: string }) => void;
  onCancel: () => void;
  onDelete?: () => void;
  showTime?: boolean;
  showDate?: boolean;
}) {
  const [exerciseId, setExerciseId] = useState(set.exercise_id);
  const [reps, setReps] = useState<number>(set.reps);
  const [rpe, setRpe] = useState<number | ''>(set.rpe ?? '');
  const [failed, setFailed] = useState<boolean>(!!set.failed);
  const [weightStr, setWeightStr] = useState<string>(String(set.weight).replace('.', ','));
  const [performedAt, setPerformedAt] = useState<string>(
    set.performed_at ? new Date(set.performed_at).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16)
  );

  useEffect(() => {
    setExerciseId(set.exercise_id);
  }, [set.exercise_id]);

  return (
    <tr>
      {showTime && <td>{new Date(set.created_at).toLocaleTimeString()}</td>}
      <td>
        <select value={exerciseId} onChange={e => setExerciseId(e.target.value)}>
          {exercises.map(ex => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
        </select>
      </td>
      <td className="text-center">
        <input type="text" inputMode="decimal" pattern="[0-9]*[.,]?[0-9]*"
               value={weightStr} onChange={e => setWeightStr(e.target.value)} />
      </td>
      <td className="text-center">
        <input type="number" value={reps} onChange={e => setReps(parseInt(e.target.value))} />
      </td>
      <td className="text-center">
        <input type="number" value={rpe} onChange={e => setRpe(e.target.value === '' ? '' : parseFloat(e.target.value))} />
      </td>
      <td className="text-center">
        <input type="checkbox" checked={failed} onChange={e => setFailed(e.target.checked)} />
      </td>

      {showDate && (
        <td>
          <input 
            type="datetime-local" 
            value={performedAt} 
            onChange={e => setPerformedAt(e.target.value)}
          />
        </td>
      )}

      <td className="table-actions">
        <button className="primary" onClick={() => onSave({
          exercise_id: exerciseId,
          weight: parseLocalizedDecimal(weightStr) || 0,
          reps,
          rpe: rpe === '' ? null : rpe,
          failed,
          performed_at: showDate ? new Date(performedAt).toISOString() : undefined,
        })}>Save</button>
        <button className="ghost" onClick={onCancel}>Cancel</button>
        {onDelete && <button onClick={onDelete}>Delete</button>}
      </td>
    </tr>
  );
}