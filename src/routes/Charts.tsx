import { useEffect, useMemo, useState } from 'react';
import { getExercises, listWorkouts, listSetsByWorkout } from '../lib/api';
import type { Exercise } from '../types';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { estimate1RM } from '../utils/oneRM';

// Timeframe options
const TIMEFRAMES = [
  { key: 'all', label: 'All time' },
  { key: '6m', label: 'Last 6 months' },
  { key: '3m', label: 'Last 3 months' },
  { key: '1m', label: 'Last month' },
] as const;

type TFKey = typeof TIMEFRAMES[number]['key'];

function cutoffDate(tf: TFKey): Date | null {
  const now = new Date();
  const d = new Date(now);
  if (tf === '6m') { d.setMonth(now.getMonth() - 6); return d; }
  if (tf === '3m') { d.setMonth(now.getMonth() - 3); return d; }
  if (tf === '1m') { d.setMonth(now.getMonth() - 1); return d; }
  return null; // all time
}

export default function Charts() {
  const [exs, setExs] = useState<Exercise[]>([]);
  const [exerciseId, setExerciseId] = useState<string>('');
  const [tf, setTf] = useState<TFKey>('all');

  const [chartData, setChartData] = useState<{ date: string; oneRM: number }[]>([]);
  const [tableData, setTableData] = useState<{
    dateISO: string;
    date: string;
    sets: number;
    minKg: number;
    maxKg: number;
    avgKg: number;
    bestOneRm: number;
  }[]>([]);

  // load exercises
  useEffect(() => {
    getExercises().then((e) => { setExs(e); if (e[0]) setExerciseId(e[0].id); });
  }, []);

  // load data for selected exercise + timeframe
  useEffect(() => {
    (async () => {
      if (!exerciseId) return;
      const cut = cutoffDate(tf);
      // Grab a decent number of recent workouts (increase if you have years of data)
      const ws = await listWorkouts(1000);

      const rows: { dateISO: string; date: string; sets: number; minKg: number; maxKg: number; avgKg: number; bestOneRm: number }[] = [];
      const points: { date: string; oneRM: number }[] = [];

      for (const w of ws) {
        const when = new Date(w.date);
        if (cut && when < cut) break; // workouts ordered desc
        const sets = (await listSetsByWorkout(w.id)).filter(s => s.exercise_id === exerciseId);
        if (!sets.length) continue;
        const weights = sets.map(s => s.weight);
        const reps = sets.map(s => s.reps);
        const oneRMs = sets.map(s => estimate1RM(s.weight, s.reps));
        const best = Math.max(...oneRMs);
        const avg = weights.reduce((a,b)=>a+b,0) / weights.length;
        rows.push({
          dateISO: new Date(w.date).toISOString(),
          date: new Date(w.date).toLocaleDateString(),
          sets: sets.length,
          minKg: Math.round(Math.min(...weights)*100)/100,
          maxKg: Math.round(Math.max(...weights)*100)/100,
          avgKg: Math.round(avg*100)/100,
          bestOneRm: Math.round(best),
        });
        points.push({ date: new Date(w.date).toLocaleDateString(), oneRM: Math.round(best) });
      }
      // Data came in newest-first; reverse for charts/table ascending by date
      rows.reverse();
      points.reverse();
      setTableData(rows);
      setChartData(points);
    })();
  }, [exerciseId, tf]);

  const exerciseName = useMemo(() => exs.find(e => e.id === exerciseId)?.name ?? '', [exs, exerciseId]);

  return (
    <div className="grid" style={{ gap: 12 }}>
      <div className="card">
        <div className="row" style={{ alignItems: 'end', justifyContent: 'space-between' }}>
          <div className="row" style={{ gap: 12 }}>
            <div>
              <label>Exercise</label>
              <select value={exerciseId} onChange={e => setExerciseId(e.target.value)}>
                {exs.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
            <div>
              <label>Timeframe</label>
              <select value={tf} onChange={e => setTf(e.target.value as TFKey)}>
                {TIMEFRAMES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div style={{ height: 360, marginTop: 16 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="oneRM" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <h3 style={{ margin: '8px 0 12px' }}>{exerciseName || 'Exercise'} — details</h3>
        {tableData.length ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>Date</th>
                  <th>Sets</th>
                  <th>Min (kg)</th>
                  <th>Max (kg)</th>
                  <th>Avg (kg)</th>
                  <th>Best est. 1RM</th>
                </tr>
              </thead>
              <tbody>
                {tableData.map(r => (
                  <tr key={r.dateISO}>
                    <td>{r.date}</td>
                    <td style={{ textAlign: 'center' }}>{r.sets}</td>
                    <td style={{ textAlign: 'center' }}>{r.minKg}</td>
                    <td style={{ textAlign: 'center' }}>{r.maxKg}</td>
                    <td style={{ textAlign: 'center' }}>{r.avgKg}</td>
                    <td style={{ textAlign: 'center' }}>{r.bestOneRm}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>No sessions for this timeframe.</p>
        )}
      </div>
    </div>
  );
}