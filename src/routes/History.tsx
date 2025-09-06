import { useEffect, useMemo, useState } from "react";
import { getExercises, listRecentDays, listSetsByDay, updateSet, deleteSet, listExerciseBadgesForDays, getPRs, recomputePRs } from "../lib/api";
import { formatNumber } from "../utils/format";
import EditSetModal from "../components/EditSetModal";
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
    volumePR: { value: number; dateISO: string } | null;
  }>>([]);
  const [prsExpanded, setPRsExpanded] = useState(false);
  const [prsMetric, setPRsMetric] = useState<'weight' | '1rm' | 'volume'>('weight');
  const [clubExpanded, setClubExpanded] = useState(false);

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

  // 1000 lb club progress (Bench, Deadlift, Back Squat based on 1RM PRs)
  const thousandLb = useMemo(() => {
    if (!prs?.length) {
      return {
        benchKg: null as number | null,
        deadliftKg: null as number | null,
        squatKg: null as number | null,
        totalKg: 0,
        percent: 0,
      };
    }

    const lower = (s: string) => s.toLowerCase();

    // Helper to pick best matching exercise by name rules
    function pickPR(match: (name: string) => boolean, exclude?: (name: string) => boolean) {
      const candidates = prs
        .filter(p => !!p.oneRMPR)
        .filter(p => match(lower(p.exerciseName)))
        .filter(p => !exclude || !exclude(lower(p.exerciseName)));
      if (!candidates.length) return null as { value: number; dateISO: string } | null;
      // pick highest 1RM among candidates
      return candidates.reduce((best, cur) => {
        if (!best || (cur.oneRMPR!.value > best.value)) return cur.oneRMPR!;
        return best;
      }, null as { value: number; dateISO: string } | null);
    }

    // Bench: name includes 'bench'
    const bench = pickPR(name => name.includes('bench'));

    // Deadlift: includes 'deadlift' or 'dead lift'
    const deadlift = pickPR(name => name.includes('deadlift') || name.includes('dead lift'));

    // Squat: prefer names including 'back' + 'squat'; else any 'squat' that is not front/overhead
    const squatPreferred = pickPR(name => name.includes('squat') && name.includes('back'));
    const squatFallback = squatPreferred ?? pickPR(
      name => name.includes('squat'),
      name => name.includes('front') || name.includes('overhead') || name.includes('zercher')
    );
    const squat = squatFallback;

    const benchKg = bench?.value ?? null;
    const deadliftKg = deadlift?.value ?? null;
    const squatKg = squat?.value ?? null;

    const partials = [benchKg, deadliftKg, squatKg].filter((v): v is number => typeof v === 'number');
    const totalKg = partials.reduce((a, b) => a + b, 0);
    const targetKg = 1000 * 0.45359237; // 1000 lb in kg
    const percent = Math.max(0, Math.min(100, (totalKg / targetKg) * 100));

    return { benchKg, deadliftKg, squatKg, totalKg, percent };
  }, [prs]);

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
          <h3 className="page-title mb-0">
            🏆 PRs
            {prs.length > 0 && prsExpanded && (
              <span className="page-subtitle">
                ({prs.filter(pr => (
                  prsMetric === 'weight' ? pr.weightPR : prsMetric === '1rm' ? pr.oneRMPR : pr.volumePR
                )).length} {prsMetric === 'weight' ? 'weight' : prsMetric === '1rm' ? '1RM' : 'volume'} PR{prs.filter(pr => (
                  prsMetric === 'weight' ? pr.weightPR : prsMetric === '1rm' ? pr.oneRMPR : pr.volumePR
                )).length > 1 ? 's' : ''})
              </span>
            )}
          </h3>
          <button 
            className="ghost btn-icon" 
            onClick={() => setPRsExpanded(!prsExpanded)}
          >
            {prsExpanded ? '▲' : '▼'}
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
                  <button
                    className={`btn-toggle ${prsMetric === 'volume' ? 'is-active' : ''}`}
                    onClick={() => setPRsMetric('volume')}
                  >
                    Volume PRs
                  </button>
                </div>
                
                {/* PR Cards */}
                <div className="pr-grid">
                  {prs
                    .filter(pr => (prsMetric === 'weight' ? pr.weightPR : prsMetric === '1rm' ? pr.oneRMPR : pr.volumePR))
                    .map((pr) => {
                      const prData = prsMetric === 'weight' ? pr.weightPR : prsMetric === '1rm' ? pr.oneRMPR : pr.volumePR;
                      if (!prData) return null;
                      
                      return (
                        <div key={pr.exerciseId} className="pr-stat">
                          <div className="row justify-between items-center">
                            <div className="font-semibold text-small">
                              {pr.exerciseName}
                            </div>
                            <div className="text-right">
                              <div className="font-bold text-large">
                                {formatNumber(Number(prData.value))} {prsMetric === 'volume' ? 'kg·reps' : 'kg'}
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

      {/* 1000 lb Club Progress */}
      <div className="card">
        <div className="row justify-between items-center">
          <h3 className="page-title mb-0">🏅 1000 lb Club</h3>
          <button
            className="ghost btn-icon"
            onClick={() => setClubExpanded(!clubExpanded)}
          >
            {clubExpanded ? '▲' : '▼'}
          </button>
        </div>
        {clubExpanded && (
          <>
            <div className="mb-base">
              {/* Progress bar */}
              {(() => {
                const targetKg = 1000 * 0.45359237;
                const pct = thousandLb.percent;
                return (
                  <div>
                    <div className="row justify-between items-center mb-sm">
                      <div className="text-small opacity-70">Progress</div>
                      <div className="text-small">
                        {formatNumber(thousandLb.totalKg)} / {formatNumber(targetKg)} kg
                        {" "}
                        <span className="opacity-60">({formatNumber(Number(pct))}%)</span>
                      </div>
                    </div>
                    <div style={{ background: 'var(--border-color, #e5e7eb)', height: 10, borderRadius: 6, overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: 'var(--accent, #3b82f6)' }} />
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Breakdown */}
            <div className="pr-grid">
              <div className="pr-stat">
                <div className="row justify-between items-center">
                  <div className="font-semibold text-small">Bench Press 1RM</div>
                  <div className="text-right font-bold text-large">{thousandLb.benchKg != null ? `${formatNumber(thousandLb.benchKg)} kg` : '—'}</div>
                </div>
              </div>
              <div className="pr-stat">
                <div className="row justify-between items-center">
                  <div className="font-semibold text-small">Deadlift 1RM</div>
                  <div className="text-right font-bold text-large">{thousandLb.deadliftKg != null ? `${formatNumber(thousandLb.deadliftKg)} kg` : '—'}</div>
                </div>
              </div>
              <div className="pr-stat">
                <div className="row justify-between items-center">
                  <div className="font-semibold text-small">Back Squat 1RM</div>
                  <div className="text-right font-bold text-large">{thousandLb.squatKg != null ? `${formatNumber(thousandLb.squatKg)} kg` : '—'}</div>
                </div>
              </div>
            </div>
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
                <div className="day-header">
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
                <button className="ghost btn-icon" onClick={() => toggleDay(day)} aria-label={daySets ? 'Collapse day' : 'Expand day'}>
                  {daySets ? '▲' : '▼'}
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

      {/* Edit Set Modal for History */}
      <EditSetModal
        open={!!editingSet}
        set={editingSet?.set ?? null}
        exercises={exercises}
        onClose={() => setEditingSet(null)}
        onSave={async (patch) => {
          if (!editingSet) return;
          await updateSet(editingSet.set.id, patch);
          await recomputePRs();
          getPRs().then(setPRs);
          await refreshDay(editingSet.day);
          setEditingSet(null);
        }}
        onDelete={editingSet ? (async () => {
          if (!confirm("Delete this set?")) return;
          await deleteSet(editingSet.set.id);
          await recomputePRs();
          getPRs().then(setPRs);
          await refreshDay(editingSet.day);
          setEditingSet(null);
        }) : undefined}
      />
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
    <div className="space-y-lg">
      {names.map((name) => {
        const group = groups[name];
        const first = group[0];
        const badge = first?.exercise?.short_name ?? first?.exercise?.name ?? name;
        return (
          <div key={name} className="exercise-group">
            <div className="exercise-header">
              <div className="exercise-badge">{badge}</div>
              <div className="exercise-count">{group.length} set{group.length > 1 ? 's' : ''}</div>
            </div>

            <div className="exercise-sets">
              {group.map((s) => (
                <div key={s.id} className="set-row">
                  <div className="set-info">
                    <span className="set-weight">{formatNumber(Number(s.weight))}</span>
                    <span className="set-separator">×</span>
                    <span className="set-reps">{s.reps}</span>
                    {s.rpe && (
                      <>
                        <span className="set-separator">(</span>
                        <span className="set-rpe">{s.rpe}</span>
                        <span className="set-separator">)</span>
                      </>
                    )}
                    {s.failed && <span className="set-failed">❌</span>}
                  </div>
                  <div className="set-actions">
                    <button
                      className="ghost btn-icon"
                      onClick={() => onEdit(s)}
                      aria-label={`Edit set: ${formatNumber(Number(s.weight))} kg × ${s.reps} reps`}
                    >
                      ✏️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
