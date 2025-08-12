// src/routes/History.tsx
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import {
  listWorkouts,
  listSetsByWorkout,
  updateSet,
  deleteSet,
  getExercises,
  getPRs, // reads from personal_records
} from '../lib/api';
import InlineSetEditor from '../components/InlineSetEditor';

type PR = { exerciseId: string; exerciseName: string; weight: number; dateISO: string };
type PRRow = {
  exerciseId: string;
  exerciseName: string;
  weightPR: { value: number; dateISO: string } | null;
  oneRMPR: { value: number; dateISO: string } | null;
};

function formatDate(iso: string | number | Date) {
  return new Date(iso).toLocaleDateString('en-GB'); // DD/MM/YYYY
}

export default function History() {
  const [workouts, setWorkouts] = useState<any[]>([]);
  const [expanded, setExpanded] = useState<Record<string, any[]>>({});
  const [workoutExercises, setWorkoutExercises] = useState<Record<string, Set<string>>>({});

  // Filters
  const [allExercises, setAllExercises] = useState<{ id: string; name: string }[]>([]);
  const [filterExerciseId, setFilterExerciseId] = useState('');
  const [filterText, setFilterText] = useState('');

  // PRs
  const [prs, setPrs] = useState<PRRow[]>([]);
  const [loadingPRs, setLoadingPRs] = useState(true);
  const [prMetric, setPrMetric] = useState<'weight' | '1rm'>('weight');
  const [prOpen, setPrOpen] = useState(false); // collapsed by default

  // Inline edit (one row at a time)
  const [editingSet, setEditingSet] = useState<{ workoutId: string; set: any } | null>(null);

  // 1) Load workouts + exercises (once)
  useEffect(() => {
    let alive = true;
    (async () => {
      const ws = await listWorkouts(400);
      if (!alive) return;
      setWorkouts(ws);

      const exs = await getExercises();
      if (!alive) return;
      setAllExercises(exs.map((e) => ({ id: e.id, name: e.name })));
    })();
    return () => {
      alive = false;
    };
  }, []);

  // 2) Build workout -> exercises map whenever workouts change
  useEffect(() => {
  let alive = true;
  (async () => {
    const ids = workouts.map((w) => w.id);
    if (!ids.length) { if (alive) setWorkoutExercises({}); return; }

    const { data, error } = await supabase
      .from('sets')
      .select('workout_id, exercise:exercises(name, short_name)')
      .in('workout_id', ids);

    if (!alive) return;
    if (error || !data) { setWorkoutExercises({}); return; }

    const map: Record<string, Set<string>> = {};
    for (const row of data as any[]) {
      const wid = row.workout_id as string;
      const label = (row.exercise?.short_name ?? row.exercise?.name ?? '—') as string;
      if (!map[wid]) map[wid] = new Set();
      map[wid].add(label);
    }
    setWorkoutExercises(map);
  })();
  return () => { alive = false; };
}, [workouts]);

  // 3) Load PRs from precomputed table (fast)
  // load PRs fast
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoadingPRs(true);
      try {
        const rows = await getPRs(); // now returns both metrics
        if (alive) setPrs(rows as any);
      } finally {
        if (alive) setLoadingPRs(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  // Refresh sets for one workout
  const refreshWorkoutSets = async (workoutId: string) => {
    const sets = await listSetsByWorkout(workoutId);
    setExpanded((e) => ({ ...e, [workoutId]: sets }));
  };

  // Toggle expand
  const toggle = async (id: string) => {
    if (expanded[id]) {
      const { [id]: _, ...rest } = expanded;
      setExpanded(rest);
      return;
    }
    await refreshWorkoutSets(id);
  };

  // Filters (tolerant while map loads)
  const filteredWorkouts = useMemo(() => {
    const text = filterText.trim().toLowerCase();
    const selectedName =
      filterExerciseId ? allExercises.find((e) => e.id === filterExerciseId)?.name : '';

    return workouts.filter((w) => {
      if (filterExerciseId) {
        const names = workoutExercises[w.id];
        if (names === undefined) return true; // don't exclude until known
        if (!selectedName) return true;
        if (!names.has(selectedName)) return false;
      }
      if (text) {
        const names = Array.from(workoutExercises[w.id] ?? []);
        const hay = [w.notes || '', w.mood || '', ...names].join(' ').toLowerCase();
        if (!hay.includes(text)) return false;
      }
      return true;
    });
  }, [workouts, workoutExercises, filterExerciseId, filterText, allExercises]);

  // Group filtered workouts by month for sticky headers
  const itemsWithMonthHeaders = useMemo(() => {
    const items: Array<{ type: 'header' | 'workout'; id?: string; monthKey?: string; label?: string; w?: any }> =
      [];
    let lastKey: string | null = null;
    const fmt = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' });
    for (const w of filteredWorkouts) {
      const d = new Date(w.date);
      const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
      if (key !== lastKey) {
        items.push({ type: 'header', monthKey: key, label: fmt.format(d) });
        lastKey = key;
      }
      items.push({ type: 'workout', id: w.id, w });
    }
    return items;
  }, [filteredWorkouts]);

  return (
    <div className="grid" style={{ gap: 12 }}>
      {/* PRs panel */}
      <div className="pr-card">
        <button
          className="pr-card__header"
          onClick={() => setPrOpen(o => !o)}
          aria-expanded={prOpen}
          aria-controls="pr-accordion-body"
        >
          <h3 className="pr-card__title">🏆 Personal Records</h3>
          <span style={{ transform: prOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>›</span>
        </button>

        {prOpen && (
          <div id="pr-accordion-body" className="pr-card__body">
            {/* Metric selector (Heaviest / Best 1RM) */}
            <div className="pr-toggle" role="tablist" aria-label="PR Metric">
              <button
                type="button"
                className={`btn ${prMetric === 'weight' ? 'is-active' : ''}`}
                onClick={() => setPrMetric('weight')}
              >
                Heaviest
              </button>
              <button
                type="button"
                className={`btn ${prMetric === '1rm' ? 'is-active' : ''}`}
                onClick={() => setPrMetric('1rm')}
              >
                Best 1RM
              </button>
            </div>

            {loadingPRs ? (
              <p style={{ marginTop: 10 }}>Loading PRs…</p>
            ) : prs.length ? (
              <div className="pr-grid" style={{ marginTop: 10 }}>
                {prs
                  .slice()
                  .sort((a: any, b: any) => {
                    const av = prMetric === 'weight' ? a.weightPR?.value ?? -Infinity : a.oneRMPR?.value ?? -Infinity;
                    const bv = prMetric === 'weight' ? b.weightPR?.value ?? -Infinity : b.oneRMPR?.value ?? -Infinity;
                    return bv - av;
                  })
                  .map((p: any) => {
                    const chosen =
                      prMetric === 'weight'
                        ? p.weightPR && { value: p.weightPR.value, dateISO: p.weightPR.dateISO }
                        : p.oneRMPR && { value: p.oneRMPR.value, dateISO: p.oneRMPR.dateISO };

                    return (
                      <div key={p.exerciseId} className="pr-stat">
                        <div className="pr-stat__name">{p.exerciseName}</div>
                        {chosen ? (
                          <>
                            <div className="pr-stat__value">{Math.round(chosen.value)} kg</div>
                            <div className="pr-stat__date">
                              {new Date(chosen.dateISO).toLocaleDateString('en-GB')}
                            </div>
                          </>
                        ) : (
                          <div className="pr-stat__date">No PR yet</div>
                        )}
                      </div>
                    );
                  })}
              </div>
            ) : (
              <p style={{ marginTop: 10 }}>No PRs yet.</p>
            )}
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="card">
        <div className="row" style={{ gap: 12, alignItems: 'end' }}>
          <div>
            <label>Filter by exercise</label>
            <select value={filterExerciseId} onChange={(e) => setFilterExerciseId(e.target.value)}>
              <option value="">All</option>
              {allExercises.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
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
            <button
              className="ghost"
              onClick={() => {
                setFilterExerciseId('');
                setFilterText('');
              }}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Empty state when filters hide everything */}
      {filteredWorkouts.length === 0 && (
        <div className="card row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <div>No workouts match the current filters.</div>
          {(filterExerciseId || filterText) && (
            <button
              className="ghost"
              onClick={() => {
                setFilterExerciseId('');
                setFilterText('');
              }}
            >
              Clear filters
            </button>
          )}
        </div>
      )}

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
              <div className="workout-header">
                <strong>{formatDate(item.w!.date)}</strong>

                {/* exercise badges inline */}
                {workoutExercises[item.id!] && workoutExercises[item.id!].size > 0 && (
                  <>
                    {' • '}
                    {Array.from(workoutExercises[item.id!] ?? []).map(shortName => (
                      <span key={shortName} className="tag">{shortName}</span>
                    ))}
                  </>
                )}

                {/* mood inline */}
                {item.w!.mood && (
                  <>
                    {' • '}
                    <span className="mood">{item.w!.mood}</span>
                  </>
                )}
              </div>
              <button onClick={() => toggle(item.id!)} className="ghost">
                {expanded[item.id!] ? 'Hide' : 'View'} sets
              </button>
            </div>

            {expanded[item.id!] && (
              <div style={{ marginTop: 8 }}>
                <GroupedSets
                  sets={expanded[item.id!] as any[]}
                  exercises={allExercises}
                  editingSetId={
                    editingSet?.workoutId === item.id! ? editingSet.set.id : null
                  }
                  onEdit={(s) => setEditingSet({ workoutId: item.id!, set: s })}
                  onSave={async (patch) => {
                    if (!editingSet) return;
                    await updateSet(editingSet.set.id, patch);
                    await refreshWorkoutSets(item.id!);
                    setEditingSet(null);
                  }}
                  onCancel={() => setEditingSet(null)}
                  onDelete={async () => {
                    if (!editingSet) return;
                    if (!confirm('Delete this set?')) return;
                    await deleteSet(editingSet.set.id);
                    await refreshWorkoutSets(item.id!);
                    setEditingSet(null);
                  }}
                />
              </div>
            )}
          </div>
        )
      )}
    </div>
  );
}

// Helper: group sets by exercise, render with inline editor rows
function GroupedSets({
  sets,
  exercises,
  editingSetId,
  onEdit,
  onSave,
  onCancel,
  onDelete,
}: {
  sets: any[];
  exercises: { id: string; name: string }[];
  editingSetId: string | null;
  onEdit: (s: any) => void;
  onSave: (patch: {
    exercise_id: string;
    weight: number;
    reps: number;
    rpe: number | null;
    failed: boolean;
    notes: string | null;
  }) => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const byExercise: Record<string, any[]> = {};
  for (const s of sets) {
    const name = s.exercise?.name ?? '—';
    if (!byExercise[name]) byExercise[name] = [];
    byExercise[name].push(s);
  }
  const names = Object.keys(byExercise).sort();

  return (
    <div className="grid" style={{ gap: 12 }}>
      {names.map((name) => (
        <div key={name} style={{ padding: 8, border: '1px solid #232733', borderRadius: 8 }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>
            {name}{' '}
            <span style={{ opacity: 0.6 }}>
              ({byExercise[name].length} set{byExercise[name].length > 1 ? 's' : ''})
            </span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Exercise</th>
                <th>Weight (kg)</th>
                <th>Reps</th>
                <th>RPE</th>
                <th>Failed</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {byExercise[name].map((s) =>
                s.id === editingSetId ? (
                  <InlineSetEditor
                    key={s.id}
                    set={s}
                    exercises={exercises as any}
                    onSave={onSave}
                    onCancel={onCancel}
                    onDelete={onDelete}
                    showTime={false}
                  />
                ) : (
                  <tr key={s.id}>
                    <td />
                    <td style={{ textAlign: 'center' }}>{s.weight}</td>
                    <td style={{ textAlign: 'center' }}>{s.reps}</td>
                    <td style={{ textAlign: 'center' }}>{s.rpe ?? '—'}</td>
                    <td style={{ textAlign: 'center' }}>{s.failed ? '✔︎' : ''}</td>
                    <td className="row" style={{ gap: 6, justifyContent: 'flex-end' }}>
                      <button type="button" className="ghost" onClick={() => onEdit(s)}>
                        Edit
                      </button>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}