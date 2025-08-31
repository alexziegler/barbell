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
  trend?: number;           // trend line value based on previous 4 weeks
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

function calculateTrendLine(data: Point[]): Point[] {
  if (data.length < 2) return data;
  
  return data.map((point, index) => {
    const currentDate = new Date(point.dateISO);
    
    // Calculate the date 4 weeks ago from the current point
    const fourWeeksAgo = new Date(currentDate);
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28); // 4 weeks = 28 days
    
    // Get all data points from the last 4 weeks (including current point)
    const recentData = data.filter(p => {
      const pointDate = new Date(p.dateISO);
      return pointDate >= fourWeeksAgo && pointDate <= currentDate;
    });
    
    // Need at least 2 points for trend calculation
    if (recentData.length < 2) return point;
    
    // Group data by week for more stable trend calculation
    const weeklyData = new Map<string, number[]>();
    
    recentData.forEach(p => {
      const pointDate = new Date(p.dateISO);
      // Get the start of the week (Monday)
      const dayOfWeek = pointDate.getDay();
      const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const monday = new Date(pointDate);
      monday.setDate(monday.getDate() - daysToMonday);
      const weekKey = monday.toISOString().split('T')[0];
      
      if (p.heaviest !== null) {
        const existing = weeklyData.get(weekKey) || [];
        existing.push(p.heaviest);
        weeklyData.set(weekKey, existing);
      }
    });
    
    // Calculate weekly averages and sort by date
    const weeklyAverages = Array.from(weeklyData.entries())
      .map(([weekKey, weights]) => ({
        weekKey,
        date: new Date(weekKey),
        averageWeight: weights.reduce((sum, w) => sum + w, 0) / weights.length
      }))
      .sort((a, b) => a.date.getTime() - b.date.getTime());
    
    if (weeklyAverages.length < 2) return point;
    
    // Calculate linear regression using weekly averages
    const n = weeklyAverages.length;
    const xValues = weeklyAverages.map((_, i) => i);
    const yValues = weeklyAverages.map(w => w.averageWeight);
    
    // Calculate slope and intercept for linear regression
    const sumX = xValues.reduce((a, b) => a + b, 0);
    const sumY = yValues.reduce((a, b) => a + b, 0);
    const sumXY = xValues.reduce((a, b, i) => a + b * yValues[i], 0);
    const sumXX = xValues.reduce((a, b) => a + b * b, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    // Calculate trend value for current point
    // Use the slope to project forward from the last week's average
    const lastWeekIndex = n - 1;
    const trend = slope * lastWeekIndex + intercept;
    
    return { ...point, trend: Math.max(0, trend) };
  });
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
  const [showOneRM, setShowOneRM] = useState(false);      // red (disabled by default)
  const [showVolume, setShowVolume] = useState(false);    // green (off by default)
  const [showTrend, setShowTrend] = useState(true);       // purple (trend line)

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

        // Calculate trend line
        const pointsWithTrend = calculateTrendLine(points);
        setData(pointsWithTrend);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [exerciseId, timeframe]);

  const exName = useMemo(() => exercises.find(e => e.id === exerciseId)?.name ?? '—', [exercises, exerciseId]);

  return (
    <div className="page-container">
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
              <button
                className={`btn-toggle ${showTrend ? 'is-active' : ''}`}
                onClick={() => setShowTrend(v => !v)}
                type="button"
              >Trend</button>
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
              <Line 
                type="monotone" 
                dataKey="heaviest" 
                name="Heaviest" 
                yAxisId="left" 
                stroke="#3b82f6" 
                strokeWidth={2} 
                dot={false} 
                hide={!showHeaviest}
                isAnimationActive={false}
              />
              <Line 
                type="monotone" 
                dataKey="oneRM"   
                name="Estimated 1RM" 
                yAxisId="left" 
                stroke="#ef4444" 
                strokeWidth={2} 
                dot={false} 
                hide={!showOneRM}
                isAnimationActive={false}
              />
              <Line 
                type="monotone" 
                dataKey="volume"  
                name="Volume" 
                yAxisId="right" 
                stroke="#10b981" 
                strokeWidth={2} 
                dot={false} 
                hide={!showVolume}
                isAnimationActive={false}
              />
              <Line 
                type="monotone" 
                dataKey="trend"  
                name="Trend (4 weeks)" 
                yAxisId="left" 
                stroke="#8b5cf6" 
                strokeWidth={2} 
                dot={false} 
                hide={!showTrend}
                isAnimationActive={false}
                strokeDasharray="5 5"
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}