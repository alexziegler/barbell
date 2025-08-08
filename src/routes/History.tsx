import { useEffect, useState } from 'react';
import { listWorkouts, listSetsByWorkout } from '../lib/api';

export default function History() {
  const [workouts, setWorkouts] = useState<any[]>([]);
  const [expanded, setExpanded] = useState<Record<string, any[]>>({});

  useEffect(() => {
    listWorkouts(30).then(setWorkouts);
  }, []);

  const toggle = async (id: string) => {
    if (expanded[id]) { const { [id]: _, ...rest } = expanded; setExpanded(rest); return; }
    const sets = await listSetsByWorkout(id);
    setExpanded((e) => ({ ...e, [id]: sets }));
  };

  return (
    <div className="grid" style={{ gap: 12 }}>
      {workouts.map(w => (
        <div key={w.id} className="card">
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <strong>{new Date(w.date).toLocaleString()}</strong>
              {w.mood && <span style={{ opacity: .7 }}> • mood: {w.mood}</span>}
              {w.notes && <span style={{ opacity: .7 }}> • {w.notes}</span>}
            </div>
            <button onClick={() => toggle(w.id)} className="ghost">{expanded[w.id] ? 'Hide' : 'View'} sets</button>
          </div>
          {expanded[w.id] && (
            <div style={{ marginTop: 8 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left' }}>Exercise</th>
                    <th>Weight (kg)</th>
                    <th>Reps</th>
                    <th>RPE</th>
                    <th>Failed</th>
                  </tr>
                </thead>
                <tbody>
                  {expanded[w.id].map(s => (
                    <tr key={s.id}>
                      <td>{s.exercise?.name ?? '—'}</td>
                      <td style={{ textAlign: 'center' }}>{s.weight}</td>
                      <td style={{ textAlign: 'center' }}>{s.reps}</td>
                      <td style={{ textAlign: 'center' }}>{s.rpe ?? '—'}</td>
                      <td style={{ textAlign: 'center' }}>{s.failed ? '✔︎' : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}