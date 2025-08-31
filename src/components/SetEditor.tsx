import { useState } from 'react';

function parseLocalizedDecimal(s: string): number | null {
  if (s.trim() === '') return null;
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function defaultDateTimeLocal() {
  const d = new Date();
  // ISO without seconds, in local time
  const pad = (n: number) => String(n).padStart(2, '0');
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

export default function SetEditor({
  onAdd,
  units,
}: {
  onAdd: (s: { weight: number; reps: number; rpe?: number|null; failed?: boolean; performed_at?: string }) => void;
  units: 'kg'|'lb';
}) {
  const [weightInput, setWeightInput] = useState('');
  const [reps, setReps] = useState(5);
  const [rpe, setRpe] = useState<number>(7);
  const [rpeNA, setRpeNA] = useState(true);
  const [failed, setFailed] = useState(false);
  const [when, setWhen] = useState(defaultDateTimeLocal());

  // keep gradient slider CSS you already have:
  // .rpe-slider with gradient track, etc.

  const submit = () => {
    const parsed = parseLocalizedDecimal(weightInput);
    if (parsed === null) { alert('Please enter a valid weight'); return; }
    // convert local datetime-local to ISO
    const performedISO = when ? new Date(when).toISOString() : undefined;

    onAdd({
      weight: parsed,
      reps,
      rpe: rpeNA ? null : rpe,
      failed,
      performed_at: performedISO,
    });
  };

  return (
    <div className="card">
      <div className="row" style={{ gap: 12 }}>
        <div>
          <label>Weight ({units})</label>
          <input
            type="text"
            inputMode="decimal"
            pattern="[0-9]*[.,]?[0-9]*"
            value={weightInput}
            onChange={(e) => setWeightInput(e.target.value)}
            placeholder={units === 'kg' ? 'e.g., 62,5' : 'e.g., 137,5'}
          />
        </div>

        <div>
          <label>Reps</label>
          <input type="number" step={1} value={reps} onChange={e => setReps(parseInt(e.target.value || '0', 10))} />
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
            <input type="checkbox" checked={rpeNA} onChange={e => setRpeNA(e.target.checked)} />
            Don’t record RPE
          </label>
        </div>

        <div>
          <label>Failed</label>
          <input type="checkbox" checked={failed} onChange={e => setFailed(e.target.checked)} />
        </div>

        <div>
          <label>Date & time</label>
          <input type="datetime-local" value={when} onChange={e => setWhen(e.target.value)} />
        </div>
      </div>

      <div className="row" style={{ justifyContent: 'flex-end', marginTop: 8 }}>
        <button className="primary" onClick={submit}>Add set</button>
      </div>
    </div>
  );
}