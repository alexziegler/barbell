import { useState } from 'react';

export default function SetEditor({ onAdd, units }: { onAdd: (s: { weight: number; reps: number; rpe?: number|null; failed?: boolean; notes?: string|null }) => void; units: 'kg'|'lb' }) {
  const [weight, setWeight] = useState<number>(0);
  const [reps, setReps] = useState<number>(5);
  const [rpe, setRpe] = useState<number | ''>('');
  const [failed, setFailed] = useState(false);

  return (
    <div className="card">
      <div className="row">
        <div>
          <label>Weight ({units})</label>
          <input type="number" inputMode="decimal" value={weight} onChange={e => setWeight(parseFloat(e.target.value))} />
        </div>
        <div>
          <label>Reps</label>
          <input type="number" value={reps} onChange={e => setReps(parseInt(e.target.value))} />
        </div>
        <div>
          <label>RPE (1–10)</label>
          <input type="number" value={rpe} onChange={e => setRpe(e.target.value === '' ? '' : parseFloat(e.target.value))} />
        </div>
        <div style={{ alignSelf: 'end' }}>
          <label>Failed</label>
          <input type="checkbox" checked={failed} onChange={e => setFailed(e.target.checked)} />
        </div>
      </div>
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button className="primary" onClick={() => onAdd({ weight, reps, rpe: rpe === '' ? null : rpe, failed })}>Add set</button>
      </div>
    </div>
  );
}