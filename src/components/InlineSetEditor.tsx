import { useEffect, useState } from 'react';
import type { Exercise } from '../types';

export default function InlineSetEditor({
  set,
  exercises,
  onSave,
  onCancel,
  onDelete,
  showTime = true,
}: {
  set: any;
  exercises: Exercise[];
  onSave: (patch: { exercise_id: string; weight: number; reps: number; rpe: number|null; failed: boolean; notes: string|null }) => void;
  onCancel: () => void;
  onDelete?: () => void;
  showTime?: boolean;
}) {
  const [exerciseId, setExerciseId] = useState(set.exercise_id);
  const [weight, setWeight] = useState<number>(set.weight);
  const [reps, setReps] = useState<number>(set.reps);
  const [rpe, setRpe] = useState<number | ''>(set.rpe ?? '');
  const [failed, setFailed] = useState<boolean>(!!set.failed);
  const [notes, setNotes] = useState<string>(set.notes ?? '');

  useEffect(() => {
    setExerciseId(set.exercise_id);
  }, [set.exercise_id]);

  return (
    <tr>
      {showTime && (                    // ← NEW
        <td>{new Date(set.created_at).toLocaleTimeString()}</td>
      )}
      <td>
        <select value={exerciseId} onChange={e => setExerciseId(e.target.value)}>
          {exercises.map(ex => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
        </select>
      </td>
      <td style={{ textAlign: 'center' }}>
        <input type="number" value={weight} onChange={e => setWeight(parseFloat(e.target.value))} style={{ width: 90 }} />
      </td>
      <td style={{ textAlign: 'center' }}>
        <input type="number" value={reps} onChange={e => setReps(parseInt(e.target.value))} style={{ width: 70 }} />
      </td>
      <td style={{ textAlign: 'center' }}>
        <input type="number" value={rpe} onChange={e => setRpe(e.target.value === '' ? '' : parseFloat(e.target.value))} style={{ width: 70 }} />
      </td>
      <td style={{ textAlign: 'center' }}>
        <input type="checkbox" checked={failed} onChange={e => setFailed(e.target.checked)} />
      </td>
      <td>
        <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes" />
      </td>
      <td className="row" style={{ gap: 6, justifyContent: 'flex-end' }}>
        <button className="primary" onClick={() => onSave({ exercise_id: exerciseId, weight, reps, rpe: rpe === '' ? null : rpe, failed, notes: notes || null })}>Save</button>
        <button className="ghost" onClick={onCancel}>Cancel</button>
        {onDelete && <button onClick={onDelete}>Delete</button>}
      </td>
    </tr>
  );
}