// src/components/ExercisePicker.tsx
import { useEffect, useState } from 'react';
import type { Exercise } from '../types';
import { getExercises } from '../lib/api';

export default function ExercisePicker({
  value,
  onChange,
  disabled = false,
}: {
  value: string | null;
  onChange: (id: string) => void;
  disabled?: boolean;
}) {
  const [exs, setExs] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    getExercises()
      .then((list) => alive && setExs(list))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  if (loading) return <div>Loading exercises…</div>;

  return (
    <div>
      <label>Exercise</label>
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      >
        <option value="" disabled>
          Select…
        </option>
        {exs.map((e) => (
          <option key={e.id} value={e.id}>
            {e.name}
          </option>
        ))}
      </select>
    </div>
  );
}