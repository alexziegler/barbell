// src/routes/History.tsx
import { useEffect, useMemo, useState } from 'react';
import { listWorkouts, listSetsByWorkout, updateSet, deleteSet, getExercises } from '../lib/api';
import { supabase } from '../lib/supabaseClient';
import { getPRs } from '../lib/api';
import InlineSetEditor from '../components/InlineSetEditor';

type PR = { exerciseId: string; exerciseName: string; weight: number; dateISO: string };

function formatDate(iso: string | number | Date) {
  return new Date(iso).toLocaleDateString('en-GB'); // DD/MM/YYYY
}

export default function History() {
  const [workouts, setWorkouts] = useState<any[]>([]);
  const [expanded, setExpanded] = useState<Record<string, any[]>>({});
  const [prs, setPrs] = useState<PR[]>([]);
  const [loadingPRs, setLoadingPRs] = useState(true);

  // Filters
  const [allExercises, setAllExercises] = useState<{ id: string; name: string }[]>([]);
  const [filterExerciseId, setFilterExerciseId] = useState('');
  const [filterText, setFilterText] = useState('');
  const [workoutExercises, setWorkoutExercises] = useState<Record<string, Set<string>>>({});

  // Editing
  const [editingSet, setEditingSet] = useState<{ workoutId: string; set: any } | null>(null);

  // Load workouts & exercises
  useEffect(() => {
    (async () => {
      setLoadingPRs(true);
      try {
        const results = await getPRs();
        setPrs(results);
      } finally {
        setLoadingPRs(false);
      }
    })();
  }, []);

  // Load PRs
  useEffect(() => {
    (async () => {
      setLoadingPRs(true);
      try {
        const exs = await getExercises();
        const results: PR[] = [];
        for (const ex of exs) {
          const { data } = await supabase
            .from('sets')
            .select('weight, workout:workouts(date)')
            .eq('exercise_id', ex.id)
            .order('weight', { ascending: false })
            .limit(1);

          if (data && data.length) {
            const row: any = data[0];
            const dateISO = row.workout?.date || row.created_at;
            if (dateISO) results.push({ exerciseId: ex.id, exerciseName: ex.name, weight: Number(row.weight), dateISO });
          }
        }
        setPrs(results.sort((a, b) => a.exerciseName.localeCompare(b.exerciseName)));
      } finally {
        setLoadingPRs(false);
      }
    })();
  }, []);

  const refreshWorkoutSets = async (workoutId: string) => {
    const sets = await listSetsByWorkout(workoutId);
    setExpanded(e => ({ ...e, [workoutId]: sets }));
  };

  const toggleExpand = async (id: string) => {
    if (expanded[id]) {
      const { [id]: _, ...rest } = expanded;
      setExpanded(rest);
    } else {
      await refreshWorkoutSets(id);
    }
  };

  const filteredWorkouts = useMemo(() => {
    const text = filterText.trim().toLowerCase();
    const selectedName = filterExerciseId ? allExercises.find(e => e.id === filterExerciseId)?.name : '';
    return workouts.filter(w => {
      if (filterExerciseId) {
        const names = workoutExercises[w.id];
        if (!names || !names.has(selectedName!)) return false;
      }
      if (text) {
        const names = Array.from(workoutExercises[w.id] ?? []);
        const hay = [w.notes || '', w.mood || '', ...names].join(' ').toLowerCase();
        if (!hay.includes(text)) return false;
      }
      return true;
    });
  }, [workouts, workoutExercises, filterExerciseId, filterText, allExercises]);

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
      {/* PRs */}
      <div className="card">
        <h3>🏆 Personal Records</h3>
        {loadingPRs ? (
          <p>Calculating PRs…</p>
        ) : prs.length ? (
          <div className="grid" style={{ gap: 8, gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
            {prs.map(p => (
              <div key={p.exerciseId} style={{ padding: 8, border: '1px solid #232733', borderRadius: 8 }}>
                <div style={{ fontSize: 12, opacity: 0.8 }}>{p.exerciseName}</div>
                <div style={{ fontWeight: 700 }}>{p.weight} kg</div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>{formatDate(p.dateISO)}</div>
              </div>
            ))}
          </div>
        ) : <p>No sets logged yet.</p>}
      </div>

      {/* Filters */}
      <div className="card">
        <div className="row" style={{ gap: 12, alignItems: 'end' }}>
          <div>
            <label>Filter by exercise</label>
            <select value={filterExerciseId} onChange={e => setFilterExerciseId(e.target.value)}>
              <option value="">All</option>
              {allExercises.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label>Search (exercise/mood/notes)</label>
            <input value={filterText} onChange={e => setFilterText(e.target.value)} />
          </div>
          {(filterExerciseId || filterText) && (
            <button className="ghost" onClick={() => { setFilterExerciseId(''); setFilterText(''); }}>Clear</button>
          )}
        </div>
      </div>

      {/* Workout list */}
      {itemsWithMonthHeaders.map(item =>
        item.type === 'header' ? (
          <div key={item.monthKey} className="card" style={{ background: '#0f1116', position: 'sticky', top: 0 }}>
            <strong>{item.label}</strong>
          </div>
        ) : (
          <div key={item.id} className="card">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <div>
                <strong>{formatDate(item.w.date)}</strong>
                {item.w.mood && <> • {item.w.mood}</>}
                {item.w.notes && <> • {item.w.notes}</>}
              </div>
              <button className="ghost" onClick={() => toggleExpand(item.id!)}>
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

      {/* Editor */}
      {editingSet && (
        <div className="card" style={{ borderStyle: 'dashed' }}>
          <h4>Edit set</h4>
          <table style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Time</th><th>Exercise</th><th>Weight</th><th>Reps</th><th>RPE</th><th>Failed</th><th>Notes</th><th></th>
              </tr>
            </thead>
            <tbody>
              <InlineSetEditor
                set={editingSet.set}
                exercises={allExercises as any}
                onSave={async (patch) => {
                  await updateSet(editingSet.set.id, patch);
                  await refreshWorkoutSets(editingSet.workoutId);
                  setEditingSet(null);
                }}
                onCancel={() => setEditingSet(null)}
                onDelete={async () => {
                  if (!confirm('Delete this set?')) return;
                  await deleteSet(editingSet.set.id);
                  await refreshWorkoutSets(editingSet.workoutId);
                  setEditingSet(null);
                }}
              />
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// Helper: group sets by exercise, then render with inline row editor
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
  // Build { exerciseName -> Set[] }
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
              {name}{' '}
              <span style={{ opacity: 0.6 }}>
                ({group.length} set{group.length > 1 ? 's' : ''})
              </span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>Time</th>
                  <th>Weight (kg)</th>
                  <th>Reps</th>
                  <th>RPE</th>
                  <th>Failed</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {group.map((s) =>
                  s.id === editingSetId ? (
                    // Inline editor replaces this row
                    <InlineSetEditor
                      key={s.id}
                      set={s}
                      exercises={exercises as any}
                      onSave={onSave}
                      onCancel={onCancel}
                      onDelete={onDelete}
                    />
                  ) : (
                    <tr key={s.id}>
                      <td>{new Date(s.created_at).toLocaleTimeString()}</td>
                      <td style={{ textAlign: 'center' }}>{s.weight}</td>
                      <td style={{ textAlign: 'center' }}>{s.reps}</td>
                      <td style={{ textAlign: 'center' }}>{s.rpe ?? '—'}</td>
                      <td style={{ textAlign: 'center' }}>{s.failed ? '✔︎' : ''}</td>
                      <td className="row" style={{ gap: 6, justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          className="ghost"
                          onClick={() => onEdit(s)}
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}