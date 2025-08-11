import { useState } from 'react';

function parseLocalizedDecimal(s: string): number | null {
  if (s.trim() === '') return null;
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

export default function SetEditor({
  onAdd,
  units,
}: {
  onAdd: (s: { weight: number; reps: number; rpe?: number | null; failed?: boolean; notes?: string | null }) => void;
  units: 'kg' | 'lb';
}) {
  // keep weight as a *string* to avoid Safari clearing on comma
  const [weightInput, setWeightInput] = useState<string>('');
  const [reps, setReps] = useState<number>(5);

  // RPE slider (optional)
  const [rpe, setRpe] = useState<number>(7);
  const [rpeNA, setRpeNA] = useState<boolean>(true);

  const [failed, setFailed] = useState(false);
  const [notes, setNotes] = useState<string>('');

  const submit = () => {
    const parsed = parseLocalizedDecimal(weightInput);
    if (parsed === null) {
      alert('Please enter a valid weight (e.g., 62,5 or 62.5)');
      return;
    }
    onAdd({
      weight: parsed,
      reps,
      rpe: rpeNA ? null : rpe,
      failed,
      notes: notes || null,
    });
  };

  return (
    <div className="card">
      <div className="row" style={{ gap: 12 }}>
        <div>
          <label>Weight ({units})</label>
          <input
            type="text"                 // ← text to allow comma
            inputMode="decimal"
            pattern="[0-9]*[.,]?[0-9]*" // hint for mobile keyboards
            value={weightInput}
            onChange={(e) => setWeightInput(e.target.value)}
            placeholder={units === 'kg' ? 'e.g., 62,5' : 'e.g., 137,5'}
          />
        </div>

        <div>
          <label>Reps</label>
          <input
            type="number"
            step={1}
            value={reps}
            onChange={(e) => setReps(parseInt(e.target.value || '0', 10))}
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