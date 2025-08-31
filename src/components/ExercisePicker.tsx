import { useEffect, useState } from 'react';
import type { Exercise } from '../types';
import { getExercises } from '../lib/api';
import AddExerciseModal from './AddExerciseModal';

export default function ExercisePicker({
  value, onChange,
}: { value: string | null; onChange: (id: string) => void }) {
  const [exs, setExs] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    getExercises().then(setExs).finally(() => setLoading(false));
  }, []);

  return (
    <div className="exercise-picker">
      <label>Exercise</label>
      {loading ? (
        <div>Loading…</div>
      ) : (
        <div className="form-row">
          <select value={value ?? ''} onChange={e => onChange(e.target.value)}>
            <option value="" disabled>Select…</option>
            {exs.map(e => (
              <option key={e.id} value={e.id}>
                {(e as any).short_name ?? e.name}
              </option>
            ))}
          </select>
          <button type="button" onClick={() => setOpen(true)}>+ Add</button>
        </div>
      )}

      <AddExerciseModal
        open={open}
        onClose={() => setOpen(false)}
        onCreated={(ex) => {
          setExs(prev => [...prev, ex as any].sort((a,b)=>a.name.localeCompare(b.name)));
          onChange(ex.id);
        }}
      />
    </div>
  );
}