import { useEffect, useMemo, useState } from 'react';
import { listWorkouts, listSetsByWorkout } from '../lib/api';
import { supabase } from '../lib/supabaseClient';
import { getExercises } from '../lib/api';

type PR = { exerciseId: string; exerciseName: string; weight: number; dateISO: string };

function formatDate(iso: string | number | Date) {
  return new Date(iso).toLocaleDateString('en-GB'); // DD/MM/YYYY
}

export default function History() {
  const [workouts, setWorkouts] = useState<any[]>([]);
  const [expanded, setExpanded] = useState<Record<string, any[]>>({});
  const [prs, setPrs] = useState<PR[] | null>(null);
  const [loadingPRs, setLoadingPRs] = useState(true);

  // Filter bar state
  const [allExercises, setAllExercises] = useState<{ id: string; name: string }[]>([]);
  const [filterExerciseId, setFilterExerciseId] = useState<string>('');
  const [filterText, setFilterText] = useState('');

  // Map: workoutId -> Set of exercise names in that workout (for filtering list without expanding)
  const [workoutExercises, setWorkoutExercises] = useState<Record<string, Set<string>>>({});

  // Load recent workouts + exercises (tune the limit if needed)
  useEffect(() => {
    (async () => {
      const ws = await listWorkouts(400);
      setWorkouts(ws);
      const exs = await getExercises();
      setAllExercises(exs.map(e => ({ id: e.id, name: e.name })));

      // Build a single query to fetch all (workout_id, exercise.name) pairs for these workouts
      const ids = ws.map(w => w.id);
      if (ids.length) {
        const { data, error } = await supabase
          .from('sets')
          .select('workout_id, exercise:exercises(name)')
          .in('workout_id', ids);
        if (!error && data) {
          const map: Record<string, Set<string>> = {};
          for (const row of data as any[]) {
            const wid = row.workout_id as string;
            const name = (row.exercise?.name ?? '—') as string;
            if (!map[wid]) map[wid] = new Set();
            map[wid].add(name);
          }
          setWorkoutExercises(map);
        }
      }
    })();
  }, []);

  // Compute PRs (max weight set per exercise, with date)
  useEffect(() => {
    (async () => {
      setLoadingPRs(true);
      try {
        const exs = await getExercises(); // global + user exercises
        const results: PR[] = [];
        for (const ex of exs) {
          const { data, error } = await supabase
            .from('sets')
            .select('weight, workout:workouts(date)')
            .eq('exercise_id', ex.id)
            .order('weight', { ascending: false })
            .limit(1);
          if (error) throw error;
          if (data && data.length) {
            const row: any = data[0];
            const dateISO = row.workout?.date || row.created_at || null;
            if (dateISO) {
              results.push({
                exerciseId: ex.id,
                exerciseName: ex.name,
                weight: Number(row.weight),
                dateISO: dateISO,
              });
            }
          }
        }
        results.sort((a, b) => a.exerciseName.localeCompare(b.exerciseName));
        setPrs(results);
      } catch (e) {
        console.error(e);
        setPrs([]);
      } finally {
        setLoadingPRs(false);
      }
    })();
  }, []);

  // Toggle expand for a workout row and fetch sets if needed
  const toggle = async (id: string) => {
    if (expanded[id]) {
      const { [id]: _, ...rest } = expanded;
      setExpanded(rest);
      return;
    }
    const sets = await listSetsByWorkout(id);
    setExpanded((e) => ({ ...e, [id]: sets }));
  };

  // Apply filters to the workouts list
  const filteredWorkouts = useMemo(() => {
    const text = filterText.trim().toLowerCase();
    const selectedName = filterExerciseId ? allExercises.find(e => e.id === filterExerciseId)?.name : '';
    return workouts.filter(w => {
      // Filter by exercise dropdown
      if (filterExerciseId) {
        const names = workoutExercises[w.id];
        if (!names || !names.has(selectedName!)) return false;
      }
      // Filter by free text across exercise names and notes/mood
      if (text) {
        const names = Array.from(workoutExercises[w.id] ?? []);
        const hay = [w.notes || '', w.mood || '', ...names].join(' ').toLowerCase();
        if (!hay.includes(text)) return false;
      }
      return true;
    });
  }, [workouts, workoutExercises, filterExerciseId, filterText, allExercises]);

  // Group filtered workouts by month for section headers
  const itemsWithMonthHeaders = useMemo(() => {
    const items: Array<{ type: 'header' | 'workout'; id?: string; monthKey?: string; label?: string; w?: any }> = [];
    let lastKey: string | null = null;
    const formatter = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' });
    for (const w of filteredWorkouts) {
      const d = new Date(w.date);
      const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
      if (key !== lastKey) {
        items.push({ type: 'header', monthKey: key, label: formatter.format(d) });
        lastKey = key;
      }
      items.push({ type: 'workout', id: w.id, w });
    }
    return items;
  }, [filteredWorkouts]);

  return (
    <div className="grid" style={{ gap: 12 }}>
      {/* PRs panel */}
      <div className="card">
        <h3 style={{ marginTop: 0 }}>🏆 Personal Records</h3>
        {loadingPRs ? (
          <p>Calculating PRs…</p>
        ) : prs && prs.length ? (
          <div
            className="grid"
            style={{ gap: 8, gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}
          >
            {prs.map((p) => (
              <div key={p.exerciseId} style={{ padding: 8, border: '1px solid #232733', borderRadius: 8 }}>
                <div style={{ fontSize: 12, opacity: 0.8 }}>{p.exerciseName}</div>
                <div style={{ fontWeight: 700, fontSize: 18 }}>{p.weight} kg</div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>{formatDate(p.dateISO)}</div>
              </div>
            ))}
          </div>
        ) : (
          <p>No sets logged yet.</p>
        )}
      </div>

      {/* Filter bar */}
      <div className="card">
        <div className="row" style={{ gap: 12, alignItems: 'end' }}>
          <div>
            <label>Filter by exercise</label>
            <select value={filterExerciseId} onChange={(e) => setFilterExerciseId(e.target.value)}>
              <option value="">All exercises</option>
              {allExercises.map((e) => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label>Search (exercise/mood/notes)</label>
            <input
              placeholder="e.g., squat, sore, chin-up"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
            />
          </div>
          {(filterExerciseId || filterText) && (
            <button className="ghost" onClick={() => { setFilterExerciseId(''); setFilterText(''); }}>Clear</button>
          )}
        </div>
      </div>

      {/* Workout list with sticky month headers and grouped sets */}
      {itemsWithMonthHeaders.map((item) =>
        item.type === 'header' ? (
          <div
            key={item.monthKey}
            className="card"
            style={{
              background: '#0f1116',
              position: 'sticky',
              top: 0,
              zIndex: 5,
              border: '1px solid #232733',
            }}
          >
            <strong>{item.label}</strong>
          </div>
        ) : (
          <div key={item.id} className="card">
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong>{formatDate(item.w!.date)}</strong>
                {item.w!.mood && <span style={{ opacity: 0.7 }}> • mood: {item.w!.mood}</span>}
                {item.w!.notes && <span style={{ opacity: 0.7 }}> • {item.w!.notes}</span>}
              </div>
              <button onClick={() => toggle(item.id!)} className="ghost">
                {expanded[item.id!] ? 'Hide' : 'View'} sets
              </button>
            </div>

            {expanded[item.id!] && (
              <div style={{ marginTop: 8 }}>
                {/* Group sets by exercise for clearer layout */}
                <GroupedSets sets={expanded[item.id!] as any[]} />
              </div>
            )}
          </div>
        )
      )}
    </div>
  );
}

// Helper: group sets by exercise, then render indented set lines
function GroupedSets({ sets }: { sets: any[] }) {
  const byExercise: Record<string, any[]> = {};
  for (const s of sets) {
    const name = s.exercise?.name ?? '—';
    if (!byExercise[name]) byExercise[name] = [];
    byExercise[name].push(s);
  }

  const exerciseNames = Object.keys(byExercise).sort((a, b) => a.localeCompare(b));

  return (
    <div className="grid" style={{ gap: 12 }}>
      {exerciseNames.map((name) => {
        const group = byExercise[name];
        return (
          <div key={name} style={{ padding: 8, border: '1px solid #232733', borderRadius: 8 }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>
              {name} <span style={{ opacity: 0.6 }}>({group.length} set{group.length > 1 ? 's' : ''})</span>
            </div>
            <ul style={{ margin: 0, paddingLeft: 16, listStyle: 'none' }}>
              {group.map((s) => (
                <li key={s.id} style={{ padding: '2px 0' }}>
                  <span style={{ display: 'inline-block', width: 140 }}>
                    {s.weight} kg × {s.reps}
                  </span>
                  {s.rpe != null && <span style={{ opacity: 0.7, marginLeft: 8 }}>RPE {s.rpe}</span>}
                  {s.failed && <span style={{ color: '#ff7b7b', marginLeft: 8 }}>failed</span>}
                  {s.notes && <span style={{ opacity: 0.8, marginLeft: 8 }}>• {s.notes}</span>}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}