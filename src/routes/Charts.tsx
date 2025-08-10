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

function useCompact() {
  const [compact, setCompact] = useState<boolean>(() => window.innerWidth < 600);
  useEffect(() => {
    const onResize = () => setCompact(window.innerWidth < 600);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return compact;
}

export default function Charts() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [exerciseId, setExerciseId] = useState<string>('');
  const [timeframe, setTimeframe] = useState<Timeframe>('6m');

  const [data, setData] = useState<Point[]>([]);
  const [loading, setLoading] = useState(false);

  const compact = useCompact();
  const xTicks = useMemo(() => {
    if (!data.length) return [];
    const maxTicks = compact ? 5 : 8;
    const step = Math.max(1, Math.ceil(data.length / maxTicks));
    // Recharts XAxis uses values from dataKey; we use dateLabel
    return data.filter((_, i) => i % step === 0).map(p => p.dateLabel);
  }, [data, compact]);

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
        const { data: rows, error } = await supabase
          .from('sets')
          .select('id, weight, reps, failed, created_at, workout:workouts(date)')
          .eq('exercise_id', exerciseId)
          .order('created_at', { ascending: true }); // no server-side date filter
        if (error) throw error;

        const start = startDateFor(timeframe); // Date | null

        // Group by performed day and compute metrics
        const byDay = new Map<string, { heaviest: number; oneRM: number; volume: number }>();

        for (const r of (rows ?? []) as any[]) {
          if (r.failed) continue;

          const performedISO = r.workout?.date ?? r.created_at; // << actual training date
          const performed = new Date(performedISO);

          // Client-side timeframe filter based on performed date
          if (start && performed < start) continue;

          const key = `${performed.getFullYear()}-${String(performed.getMonth() + 1).padStart(2, '0')}-${String(performed.getDate()).padStart(2, '0')}`;

          const oneRmEstimate = estimate1RM(Number(r.weight), Number(r.reps));
          const volume = Number(r.weight) * Number(r.reps);

          const cur = byDay.get(key) ?? { heaviest: 0, oneRM: 0, volume: 0 };
          byDay.set(key, {
            heaviest: Math.max(cur.heaviest, Number(r.weight)),
            oneRM: Math.max(cur.oneRM, oneRmEstimate),
            volume: cur.volume + volume,
          });
        }

        const points = Array.from(byDay.entries())
          .map(([key, v]) => {
            const [y, m, d] = key.split('-').map(Number);
            const dt = new Date(y, m - 1, d);
            return {
              dateISO: dt.toISOString(),
              dateLabel: dt.toLocaleDateString('en-GB'),
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
      <div className="card controls">
        <div className="controls__row">
          <div className="controls__field">
            <label>Exercise</label>
            <select value={exerciseId} onChange={(e) => setExerciseId(e.target.value)}>
              {exercises.map((e) => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          </div>

          <div className="controls__field">
            <label>Timeframe</label>
            <select value={timeframe} onChange={(e) => setTimeframe(e.target.value as any)}>
              <option value="all">All time</option>
              <option value="6m">Last 6 months</option>
              <option value="3m">Last 3 months</option>
              <option value="1m">Last month</option>
            </select>
          </div>

          <div className="controls__field">
            <label>Series</label>
            <div className="controls__series">
              <button
                className={`btn-toggle ${showHeaviest ? 'is-active' : ''}`}
                onClick={() => setShowHeaviest(v => !v)}
                type="button"
              >Heaviest</button>
              <button
                className={`btn-toggle ${showOneRM ? 'is-active' : ''}`}
                onClick={() => setShowOneRM(v => !v)}
                type="button"
              >1RM</button>
              <button
                className={`btn-toggle ${showVolume ? 'is-active' : ''}`}
                onClick={() => setShowVolume(v => !v)}
                type="button"
              >Volume</button>
            </div>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="chart-card">
        <h3 className="chart-title">{exName}</h3>
        {loading ? (
          <p>Loading…</p>
        ) : data.length === 0 ? (
          <p>No data for this selection.</p>
        ) : (
          <ResponsiveContainer>
            <LineChart data={data} margin={{ top: 8, right: 0, left: 4, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="dateLabel"
                ticks={xTicks}
                tick={{ fontSize: compact ? 11 : 12 }}
              />
              <YAxis
                yAxisId="left"
                label={{ value: 'Weight / 1RM (kg)', angle: -90, position: 'outsideLeft' }}
                allowDecimals={false}
                hide={true}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                label={{ value: 'Volume (kg·reps)', angle: 90, position: 'outsideRight' }}
                allowDecimals={false}
                hide={true}
              />
              <Tooltip formatter={(v:any, name) => [Math.round(v).toString(), name]} />
              <Legend />
              <Line type="monotone" dataKey="heaviest" name="Heaviest" yAxisId="left" stroke="#3b82f6" strokeWidth={2} dot={false} hide={!showHeaviest} />
              <Line type="monotone" dataKey="oneRM"   name="Estimated 1RM" yAxisId="left" stroke="#ef4444" strokeWidth={2} dot={false} hide={!showOneRM} />
              <Line type="monotone" dataKey="volume"  name="Volume" yAxisId="right" stroke="#10b981" strokeWidth={2} dot={false} hide={!showVolume} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}