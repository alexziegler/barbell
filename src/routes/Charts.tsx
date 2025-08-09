// src/routes/Charts.tsx
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { getExercises } from '../lib/api';
import { estimate1RM } from '../utils/oneRM';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

type Exercise = { id: string; name: string };
type Timeframe = 'all' | '6m' | '3m' | '1m';

type Point = {
  dateISO: string;          // full ISO for sorting
  dateLabel: string;        // DD/MM/YYYY for ticks
  heaviest: number | null;  // heaviest successful single-set weight
  oneRM: number | null;     // estimated 1RM (Epley)
  volume: number;           // sum(weight * reps) successful sets
};

function formatDDMMYYYY(iso: string | number | Date) {
  return new Date(iso).toLocaleDateString('en-GB');
}

function startDateFor(tf: Timeframe): Date | null {
  const d = new Date();
  if (tf === 'all') return null;
  if (tf === '6m') { d.setMonth(d.getMonth() - 6); return d; }
  if (tf === '3m') { d.setMonth(d.getMonth() - 3); return d; }
  if (tf === '1m') { d.setMonth(d.getMonth() - 1); return d; }
  return null;
}

export default function Charts() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [exerciseId, setExerciseId] = useState<string>('');
  const [timeframe, setTimeframe] = useState<Timeframe>('all');

  const [data, setData] = useState<Point[]>([]);
  const [loading, setLoading] = useState(false);

  // visibility toggles
  const [showHeaviest, setShowHeaviest] = useState(true); // blue
  const [showOneRM, setShowOneRM] = useState(true);       // red
  const [showVolume, setShowVolume] = useState(false);    // green (off by default)

  useEffect(() => {
    getExercises().then((list) => {
      setExercises(list.map((e: any) => ({ id: e.id, name: e.name })));
      if (list.length && !exerciseId) setExerciseId(list[0].id);
    });
  }, []); // load once

  useEffect(() => {
    if (!exerciseId) { setData([]); return; }
    const fetchData = async () => {
      setLoading(true);
      try {
        const sd = startDateFor(timeframe);
        let q = supabase
          .from('sets')
          .select('id, weight, reps, failed, workout:workouts(date)')
          .eq('exercise_id', exerciseId)
          .order('created_at', { ascending: true });

        if (sd) {
          // filter by workout date where available, else created_at
          q = q.gte('created_at', sd.toISOString());
        }

        const { data: rows, error } = await q;
        if (error) throw error;

        // Group by workout date (YYYY-MM-DD local) and compute metrics
        const byDay = new Map<string, { heaviest: number; oneRM: number; volume: number }>();

        for (const r of (rows ?? []) as any[]) {
          // skip failed
          if (r.failed) continue;

          const whenISO = r.workout?.date ?? r.created_at;
          const dayKey = new Date(whenISO);
          // Normalize to local YYYY-MM-DD
          const key = `${dayKey.getFullYear()}-${String(dayKey.getMonth() + 1).padStart(2, '0')}-${String(dayKey.getDate()).padStart(2, '0')}`;

          const oneRmEstimate = estimate1RM(Number(r.weight), Number(r.reps));
          const volume = Number(r.weight) * Number(r.reps);

          const cur = byDay.get(key) ?? { heaviest: 0, oneRM: 0, volume: 0 };
          byDay.set(key, {
            heaviest: Math.max(cur.heaviest, Number(r.weight)),
            oneRM: Math.max(cur.oneRM, oneRmEstimate),
            volume: cur.volume + volume,
          });
        }

        // Convert to sorted array
        const points: Point[] = Array.from(byDay.entries())
          .map(([key, v]) => {
            const [y, m, d] = key.split('-').map(Number);
            const dt = new Date(y, m - 1, d);
            return {
              dateISO: dt.toISOString(),
              dateLabel: formatDDMMYYYY(dt),
              heaviest: v.heaviest || null,
              oneRM: v.oneRM || null,
              volume: v.volume,
            };
          })
          .sort((a, b) => new Date(a.dateISO).getTime() - new Date(b.dateISO).getTime());

        setData(points);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [exerciseId, timeframe]);

  const exName = useMemo(() => exercises.find(e => e.id === exerciseId)?.name ?? '—', [exercises, exerciseId]);

  return (
    <div className="grid" style={{ gap: 12 }}>
      {/* Controls */}
      <div className="card">
        <div className="row" style={{ gap: 12, alignItems: 'end' }}>
          <div>
            <label>Exercise</label>
            <select value={exerciseId} onChange={(e) => setExerciseId(e.target.value)}>
              {exercises.map((e) => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label>Timeframe</label>
            <select value={timeframe} onChange={(e) => setTimeframe(e.target.value as Timeframe)}>
              <option value="all">All time</option>
              <option value="6m">Last 6 months</option>
              <option value="3m">Last 3 months</option>
              <option value="1m">Last month</option>
            </select>
          </div>

          <div className="row" style={{ gap: 8 }}>
            <div>
              <label style={{ display: 'block' }}>Series</label>
              <button className={showHeaviest ? 'primary' : 'ghost'} onClick={() => setShowHeaviest(v => !v)}>
                Heaviest
              </button>
              <button className={showOneRM ? 'primary' : 'ghost'} onClick={() => setShowOneRM(v => !v)}>
                1RM
              </button>
              <button className={showVolume ? 'primary' : 'ghost'} onClick={() => setShowVolume(v => !v)}>
                Volume
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="card" style={{ height: 380 }}>
        <h3 style={{ marginTop: 0 }}>{exName}</h3>
        {loading ? (
          <p>Loading…</p>
        ) : data.length === 0 ? (
          <p>No data for this selection.</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 12, right: 24, left: 8, bottom: 12 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="dateLabel" />
              <YAxis
                yAxisId="left"
                label={{ value: 'Weight / 1RM (kg)', angle: -90, position: 'insideLeft' }}
                allowDecimals={false}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                label={{ value: 'Volume (kg·reps)', angle: 90, position: 'insideRight' }}
                allowDecimals={false}
              />
              <Tooltip
                formatter={(value: any, name) => {
                  if (name === 'Volume') return [`${Math.round(value)}`, 'Volume (kg·reps)'];
                  return [`${Math.round(value)}`, name];
                }}
              />
              <Legend />
              {/* Blue: Heaviest successful single set */}
              <Line
                type="monotone"
                dataKey="heaviest"
                name="Heaviest"
                yAxisId="left"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
                hide={!showHeaviest}
              />
              {/* Red: Estimated 1RM */}
              <Line
                type="monotone"
                dataKey="oneRM"
                name="Estimated 1RM"
                yAxisId="left"
                stroke="#ef4444"
                strokeWidth={2}
                dot={false}
                hide={!showOneRM}
              />
              {/* Green: Volume (right axis) */}
              <Line
                type="monotone"
                dataKey="volume"
                name="Volume"
                yAxisId="right"
                stroke="#10b981"
                strokeWidth={2}
                dot={false}
                hide={!showVolume}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}