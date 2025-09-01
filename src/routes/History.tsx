import { useEffect, useMemo, useState } from "react";
import { getExercises, listRecentDays, listSetsByDay, updateSet, deleteSet, listExerciseBadgesForDays, getPRs } from "../lib/api";
import InlineSetEditor from "../components/InlineSetEditor";
import type { Exercise } from "../types";

/** DD/MM/YYYY */
function formatDate(isoLike: string | Date) {
  return new Date(isoLike).toLocaleDateString("en-GB");
}

/** Format month and year for display */
function formatMonthYear(isoLike: string | Date) {
  return new Date(isoLike).toLocaleDateString("en-GB", { 
    month: "long", 
    year: "numeric" 
  });
}

type DayKey = string; // "YYYY-MM-DD"

export default function History() {
  // Days & sets
  const [days, setDays] = useState<DayKey[]>([]);
  const [expanded, setExpanded] = useState<Record<DayKey, any[]>>({});

  // Exercises (for badges and editor dropdown)
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [badgesByDay, setBadgesByDay] = useState<Record<DayKey, string[]>>({});

  // Personal Records
  const [prs, setPRs] = useState<Array<{
    exerciseId: string;
    exerciseName: string;
    weightPR: { value: number; dateISO: string } | null;
    oneRMPR: { value: number; dateISO: string } | null;
  }>>([]);
  const [prsExpanded, setPRsExpanded] = useState(false);
  const [prsMetric, setPRsMetric] = useState<'weight' | '1rm'>('weight');

  // Filters
  const [filterExerciseId, setFilterExerciseId] = useState<string>("");

  // Editing
  const [editingSet, setEditingSet] = useState<{ day: DayKey; set: any } | null>(null);

  // Load recent days + exercises + PRs
  useEffect(() => {
    (async () => {
      const ds = await listRecentDays(60);
      setDays(ds);
      // fetch badges for all visible days
      const map = await listExerciseBadgesForDays(ds);
      setBadgesByDay(map);
    })();
    getExercises().then(setExercises);
    getPRs().then(setPRs);
  }, []);

  // Computed: exercise map (id -> {name, short})
  const exMap = useMemo(() => {
    const m = new Map<string, { name: string; short?: string }>();
    for (const e of exercises) m.set(e.id, { name: e.name, short: (e as any).short_name });
    return m;
  }, [exercises]);

  // Fetch sets for a day on expand
  const toggleDay = async (day: DayKey) => {
    if (expanded[day]) {
      const { [day]: _, ...rest } = expanded;
      setExpanded(rest);
      return;
    }
    const sets = await listSetsByDay(day);
    setExpanded((cur) => ({ ...cur, [day]: sets }));
  };

  // Filter logic applied per-day (client-side)
  const applyFilters = (sets: any[]) => {
    if (!sets?.length) return sets;

    const wantExerciseId = filterExerciseId || null;

    return sets.filter((s) => {
      const matchesExercise = wantExerciseId ? s.exercise_id === wantExerciseId : true;
      return matchesExercise;
    });
  };

  // Helpers
  const refreshDay = async (day: DayKey) => {
    const sets = await listSetsByDay(day);
    setExpanded((cur) => ({ ...cur, [day]: applyFilters(sets) }));
    // update badges for this day from the fresh sets
    const labels = Array.from(
      new Set(
        sets.map((s: any) => {
          const ex = exMap.get(s.exercise_id);
          return ex?.short ?? ex?.name ?? "—";
        })
      )
    ).sort();
    setBadgesByDay((cur) => ({ ...cur, [day]: labels }));
  };

  // Re-apply filters when filter state changes
  useEffect(() => {
    if (!Object.keys(expanded).length) return;
    const next: Record<DayKey, any[]> = {};
    for (const [day, sets] of Object.entries(expanded)) next[day] = applyFilters(sets);
    setExpanded(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterExerciseId]);

  return (
    <div className="page-container">
      {/* Filter bar */}
      <div className="card">
        <div className="form-row items-end">
          <div className="form-field">
            <label>Filter by exercise</label>
            <select value={filterExerciseId} onChange={(e) => setFilterExerciseId(e.target.value)}>
              <option value="">All exercises</option>
              {exercises.map((e) => (
                <option key={e.id} value={e.id}>
                  {(e as any).short_name ? `${(e as any).short_name} — ${e.name}` : e.name}
                </option>
              ))}
            </select>
          </div>
          {filterExerciseId && (
            <button
              className="ghost"
              onClick={() => setFilterExerciseId("")}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Personal Records */}
      <div className="card">
        <div className="row justify-between items-center">
          <h3 className="page-title">
            🏆 PRs
            {prs.length > 0 && prsExpanded && (
              <span className="page-subtitle">
                ({prs.filter(pr => prsMetric === 'weight' ? pr.weightPR : pr.oneRMPR).length} {prsMetric === 'weight' ? 'weight' : '1RM'} PR{prs.filter(pr => prsMetric === 'weight' ? pr.weightPR : pr.oneRMPR).length > 1 ? 's' : ''})
              </span>
            )}
          </h3>
          <button 
            className="ghost btn-small" 
            onClick={() => setPRsExpanded(!prsExpanded)}
          >
            {prsExpanded ? '▼' : '▶'}
          </button>
        </div>
        
        {prsExpanded && (
          <>
            {prs.length > 0 ? (
              <>
                {/* Metric Toggle */}
                <div className="row justify-center mb-base">
                  <button
                    className={`btn-toggle ${prsMetric === 'weight' ? 'is-active' : ''}`}
                    onClick={() => setPRsMetric('weight')}
                  >
                    Weight PRs
                  </button>
                  <button
                    className={`btn-toggle ${prsMetric === '1rm' ? 'is-active' : ''}`}
                    onClick={() => setPRsMetric('1rm')}
                  >
                    1RM PRs
                  </button>
                </div>
                
                {/* PR Cards */}
                <div className="pr-grid">
                  {prs
                    .filter(pr => prsMetric === 'weight' ? pr.weightPR : pr.oneRMPR)
                    .map((pr) => {
                      const prData = prsMetric === 'weight' ? pr.weightPR : pr.oneRMPR;
                      if (!prData) return null;
                      
                      return (
                        <div key={pr.exerciseId} className="pr-stat">
                          <div className="row justify-between items-center">
                            <div className="font-semibold text-small">
                              {pr.exerciseName}
                            </div>
                            <div className="text-right">
                              <div className="font-bold text-large">
                                {Number(prData.value).toFixed(2)} kg
                              </div>
                              <div className="text-xs opacity-50">
                                {formatDate(prData.dateISO)}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </>
            ) : (
              <div className="empty-state">
                <div className="empty-state__icon">🏋️</div>
                <div className="empty-state__title">No personal records yet</div>
                <div className="empty-state__subtitle">Start logging sets to see your PRs here!</div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Day list */}
      {days.map((day, index) => {
        const daySets = expanded[day];
        const badges = badgesByDay[day] ?? []; // ← use precomputed badges even when collapsed
        
        // Check if we need to show a month header
        const showMonthHeader = index === 0 || 
          new Date(day).getMonth() !== new Date(days[index - 1]).getMonth() ||
          new Date(day).getFullYear() !== new Date(days[index - 1]).getFullYear();

        return (
          <div key={day}>
            {/* Month header */}
            {showMonthHeader && (
              <div className="month-header">
                <h3>
                  {formatMonthYear(day)}
                </h3>
              </div>
            )}
            
            {/* Day card */}
            <div className="card">
              <div className="row justify-between items-center">
                <div className="workout-header">
                  <strong>{formatDate(day)}</strong>
                  {badges.length > 0 && (
                    <>
                      {" • "}
                      {badges.map((b) => (
                        <span key={b} className="tag">{b}</span>
                      ))}
                    </>
                  )}
                </div>
                <button className="ghost" onClick={() => toggleDay(day)}>
                  {daySets ? "Hide sets" : "View sets"}
                </button>
              </div>
              {daySets && (
                <div className="mt-md">
                  <GroupedSets
                    day={day}
                    sets={daySets}
                    exercises={exercises}
                    onEdit={(s) => setEditingSet({ day, set: s })}
                  />
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Inline editor row */}
      {editingSet && (
        <div className="card border-dashed">
          <h4 className="mt-0">Edit set</h4>
          <table className="inline-editor-table">
            <thead>
              <tr>
                <th>Exercise</th>
                <th>Weight (kg)</th>
                <th>Reps</th>
                <th>RPE</th>
                <th>Failed</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              <InlineSetEditor
                set={editingSet.set}
                exercises={exercises}
                showTime={false}
                showDate={true}
                onSave={async (patch) => {
                  await updateSet(editingSet.set.id, patch);
                  await refreshDay(editingSet.day);
                  setEditingSet(null);
                }}
                onCancel={() => setEditingSet(null)}
                onDelete={async () => {
                  if (!confirm("Delete this set?")) return;
                  await deleteSet(editingSet.set.id);
                  await refreshDay(editingSet.day);
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

/** Groups a day's sets by exercise name and renders aligned tables. */
function GroupedSets({
  day,
  sets,
  exercises,
  onEdit,
}: {
  day: DayKey;
  sets: any[];
  exercises: Exercise[];
  onEdit: (s: any) => void;
}) {
  // group by exercise display name
  const groups: Record<string, any[]> = {};
  for (const s of sets) {
    const name = s.exercise?.name ?? "—";
    if (!groups[name]) groups[name] = [];
    groups[name].push(s);
  }
  const names = Object.keys(groups).sort((a, b) => a.localeCompare(b));

  return (
    <div className="grouped-sets">
      {names.map((name) => {
        const group = groups[name];
        return (
          <div key={name} className="grouped-set-card">
            <div className="grouped-set-title">
              {name} <span className="grouped-set-count">({group.length} set{group.length > 1 ? "s" : ""})</span>
            </div>
            <table className="table">
              <thead>
                <tr>
                  <th>Exercise</th>
                  <th>Weight (kg)</th>
                  <th>Reps</th>
                  <th>RPE</th>
                  <th>Failed</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {group.map((s) => (
                  <tr key={s.id}>
                    {/* empty exercise cell to align with editor dropdown column */}
                    <td />
                    <td className="text-center">{Number(s.weight).toFixed(2)}</td>
                    <td className="text-center">{s.reps}</td>
                    <td className="text-center">{s.rpe ?? "—"}</td>
                    <td className="text-center">{s.failed ? "✔︎" : ""}</td>
                    <td className="table-actions">
                      <button className="ghost" onClick={() => onEdit(s)}>
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
