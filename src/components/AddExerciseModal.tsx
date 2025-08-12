import { useEffect, useState } from 'react';
import { createExercise } from '../lib/api';

function suggestShort(name: string) {
  const n = name.trim();
  if (!n) return '';
  const specials: Record<string, string> = {
    'deadlift': 'DL', 'bench press': 'BP', 'press': 'P',
    'back squat': 'BS', 'squat': 'SQ', 'chin-up': 'CU', 'pull-up': 'PU', 'dip': 'D',
  };
  const key = n.toLowerCase();
  if (specials[key]) return specials[key];
  const parts = n
    .replace(/[()]/g, ' ')       // remove parentheses
    .split(/[^\p{L}\p{N}]+/u)    // split by non-word
    .filter(Boolean);
  const acronym = parts.slice(0, 3).map(w => w[0]!.toUpperCase()).join('');
  return acronym || n.slice(0, 3).toUpperCase();
}

export default function AddExerciseModal({
  open, onClose, onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (ex: {id: string; name: string; short_name: string | null}) => void;
}) {
  const [name, setName] = useState('');
  const [shortName, setShortName] = useState('');

  useEffect(() => {
    if (open) { setName(''); setShortName(''); }
  }, [open]);

  if (!open) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const s = shortName.trim() || suggestShort(name);
    const ex = await createExercise({ name, short_name: s || null });
    onCreated({ id: ex.id, name: ex.name, short_name: ex.short_name ?? null });
    onClose();
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal">
        <h3 style={{ marginTop: 0 }}>Add exercise</h3>
        <form onSubmit={submit} className="grid" style={{ gap: 10 }}>
          <div className="grid" style={{ gap: 6 }}>
            <label>Name</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!shortName) setShortName(suggestShort(e.target.value));
              }}
              placeholder="e.g., Front squat"
              required
            />
          </div>
          <div className="grid" style={{ gap: 6 }}>
            <label>Acronym (short)</label>
            <input
              value={shortName}
              onChange={(e) => setShortName(e.target.value.toUpperCase())}
              placeholder="e.g., FS"
              maxLength={8}
            />
            <small style={{ opacity: .75 }}>Used for compact tags and tables.</small>
          </div>
          <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" className="ghost" onClick={onClose}>Cancel</button>
            <button className="primary" type="submit">Save</button>
          </div>
        </form>
      </div>
    </div>
  );
}