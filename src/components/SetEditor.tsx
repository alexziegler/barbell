import useSessionState from '../hooks/useSessionState';

function parseLocalizedDecimal(s: string): number | null {
  if (s.trim() === '') return null;
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

const STORAGE_BASE_KEY = 'log:set-editor';

export default function SetEditor({
  onAdd,
  units,
}: {
  onAdd: (s: { weight: number; reps: number; rpe?: number|null; failed?: boolean; performed_at?: string }) => void;
  units: 'kg'|'lb';
}) {
  const [weightInput, setWeightInput] = useSessionState<string>(`${STORAGE_BASE_KEY}:weight:${units}`, '');
  const [reps, setReps] = useSessionState<number>(`${STORAGE_BASE_KEY}:reps:${units}`, 5);
  const [rpe, setRpe] = useSessionState<number>(`${STORAGE_BASE_KEY}:rpe:${units}`, 5);
  const [failed, setFailed] = useSessionState<boolean>(`${STORAGE_BASE_KEY}:failed`, false);

  const submit = () => {
    const parsed = parseLocalizedDecimal(weightInput);
    if (parsed === null) { alert('Please enter a valid weight'); return; }
    // Use current time for new sets
    const performedISO = new Date().toISOString();

    onAdd({
      weight: parsed,
      reps,
      rpe: rpe, // Always include RPE (defaults to 5)
      failed,
      performed_at: performedISO,
    });
  };

  return (
    <div className="set-editor">
      <div className="form-row">
        <div className="form-field weight-field">
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

        <div className="form-field reps-field">
          <label>Reps</label>
          <input type="number" step={1} value={reps} onChange={e => setReps(parseInt(e.target.value || '0', 10))} />
        </div>
      </div>

      <div className="form-row">
        <div className="form-field rpe-field">
          <label>RPE (1–10)</label>
          <div className="rpe-container">
            <input
              className="rpe-slider"
              type="range"
              min={1}
              max={10}
              step={1}
              value={rpe}
              onChange={(e) => setRpe(parseInt(e.target.value))}
            />
            <span className="rpe-value">{rpe}</span>
          </div>
        </div>

        <div className="form-field failed-field">
          <label>Failed</label>
          <input type="checkbox" checked={failed} onChange={e => setFailed(e.target.checked)} />
        </div>
      </div>

      <div className="form-actions">
        <button className="primary" onClick={submit}>Add set</button>
      </div>
    </div>
  );
}
