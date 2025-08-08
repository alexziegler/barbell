import { useEffect, useState } from 'react';
import { getExercises, listWorkouts, listSetsByWorkout } from '../lib/api';
import type { Exercise } from '../types';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { estimate1RM } from '../utils/oneRM';

export default function Charts() {
  const [exs, setExs] = useState<Exercise[]>([]);
  const [exerciseId, setExerciseId] = useState<string>('');
  const [data, setData] = useState<{ date: string; oneRM: number }[]>([]);

  useEffect(() => { getExercises().then((e) => { setExs(e); if (e[0]) setExerciseId(e[0].id); }); }, []);

  useEffect(() => {
    (async () => {
      if (!exerciseId) return;
      const ws = await listWorkouts(180); // last 180 sessions
      const points: { date: string; oneRM: number }[] = [];
      for (const w of ws) {
        const sets = (await listSetsByWorkout(w.id)).filter(s => s.exercise_id === exerciseId);
        if (sets.length) {
          const best = Math.max(...sets.map(s => estimate1RM(s.weight, s.reps)));
          points.push({ date: new Date(w.date).toLocaleDateString(), oneRM: Math.round(best) });
        }
      }
      setData(points.reverse());
    })();
  }, [exerciseId]);

  return (
    <div className="card">
      <div className="row" style={{ alignItems: 'end' }}>
        <div>
          <label>Exercise</label>
          <select value={exerciseId} onChange={e => setExerciseId(e.target.value)}>
            {exs.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>
      </div>
      <div style={{ height: 360, marginTop: 16 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="oneRM" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}