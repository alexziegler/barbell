import { useEffect, useState } from 'react';
import type { Exercise } from '../types';
import { getExercises } from '../lib/api';

export default function ExercisePicker({ value, onChange }: { value: string | null; onChange: (id: string) => void }) {
  const [exs, setExs] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    getExercises().then(setExs).finally(() => setLoading(false));
  }, []);
  if (loading) return <div>Loading exercises…</div>;
  return (
    <div>
      <label>Exercise</label>
      <select value={value ?? ''} onChange={e => onChange(e.target.value)}>
        <option value="" disabled>Select…</option>
        {exs.map(e => (
          <option key={e.id} value={e.id}>{e.name}</option>
        ))}
      </select>
    </div>
  );
}