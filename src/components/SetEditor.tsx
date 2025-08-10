import { useState } from 'react';

export default function SetEditor({
  onAdd,
  units,
}: {
  onAdd: (s: { weight: number; reps: number; rpe?: number | null; failed?: boolean; notes?: string | null }) => void;
  units: 'kg' | 'lb';
}) {
  const [weight, setWeight] = useState<number>(0);
  const [reps, setReps] = useState<number>(5);

  // RPE slider (optional)
  const [rpe, setRpe] = useState<number>(7);      // default position
  const [rpeNA, setRpeNA] = useState<boolean>(true); // start as "not recorded"

  const [failed, setFailed] = useState(false);
  const [notes, setNotes] = useState<string>('');

  const submit = () => {
    onAdd({
      weight,
      reps,
      rpe: rpeNA ? null : rpe,
      failed,
      notes: notes || null,
    });
    // keep your current behavior (don’t reset everything unless you want to)
  };

  return (
    <div className="card">
      <div className="row" style={{ gap: 12 }}>
        <div>
          <label>Weight ({units})</label>
          <input
            type="number"
            inputMode="decimal"
            value={weight}
            onChange={(e) => setWeight(parseFloat(e.target.value))}
          />
        </div>

        <div>
          <label>Reps</label>
          <input
            type="number"
            value={reps}
            onChange={(e) => setReps(parseInt(e.target.value))}
          />
        </div>

        <div className="rpe-wrap">
          <label>RPE (1–10)</label>
          <div className="rpe-row">
            <input
              className="rpe-slider"
              type="range"
              min={1}
              max={10}
              step={1}
              value={rpe}
              onChange={(e) => setRpe(parseInt(e.target.value))}
              disabled={rpeNA}
            />
            <span className="rpe-value">{rpeNA ? '—' : rpe}</span>
          </div>
          <label className="rpe-na">
            <input
              type="checkbox"
              checked={rpeNA}
              onChange={(e) => setRpeNA(e.target.checked)}
            />
            Don’t record RPE for this set
          </label>
        </div>

        <div>
          <label>Failed</label>
          <input
            type="checkbox"
            checked={failed}
            onChange={(e) => setFailed(e.target.checked)}
          />
        </div>

        <div style={{ flex: 1 }}>
          <label>Notes</label>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional"
          />
        </div>
      </div>

      <div className="row" style={{ justifyContent: 'flex-end', marginTop: 8 }}>
        <button className="primary" onClick={submit}>Add set</button>
      </div>
    </div>
  );
}