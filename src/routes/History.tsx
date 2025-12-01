import { useEffect, useMemo, useState } from "react";
import { Trophy, Medal, Dumbbell, Search, ChevronDown, ChevronUp, Edit3, XOctagon } from "lucide-react";
import { getExercises, listRecentDays, listSetsByDay, updateSet, deleteSet, listExerciseBadgesForDays, getPRs, recomputePRs } from "../lib/api";
import { formatNumber } from "../utils/format";
import EditSetModal from "../components/EditSetModal";
import type { Exercise } from "../types";
import { computeThousandLbProgress, THOUSAND_LB_TARGET_KG, type ExercisePRSummary } from "../utils/prs";

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
type DaySummary = { labels: string[]; exerciseIds: string[] };

export default function History() {
  // Days & sets
  const [days, setDays] = useState<DayKey[]>([]);
  const [expanded, setExpanded] = useState<Record<DayKey, any[]>>({});

  // Exercises (for badges and editor dropdown)
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [badgesByDay, setBadgesByDay] = useState<Record<DayKey, DaySummary>>({});

  // Personal Records
  const [prs, setPRs] = useState<ExercisePRSummary[]>([]);
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
    setExpanded((cur) => ({ ...cur, [day]: applyFilters(sets) }));
  };

  // Filter logic applied per-day (client-side)
  const applyFilters = (sets: any[]) => {
    if (!sets?.length) return sets;
    if (!filterExerciseId) return sets;
    return sets.filter((s) => s.exercise_id === filterExerciseId);
  };

  // Helpers
  const refreshDay = async (day: DayKey) => {
    const sets = await listSetsByDay(day);
    setExpanded((cur) => ({ ...cur, [day]: applyFilters(sets) }));
    // update badges for this day from the fresh sets
    const labelSet = new Set<string>();
    const idSet = new Set<string>();
    for (const s of sets) {
      const ex = exMap.get(s.exercise_id);
      labelSet.add(ex?.short ?? ex?.name ?? "—");
      idSet.add(s.exercise_id);
    }
    const labels = Array.from(labelSet).sort();
    const exerciseIds = Array.from(idSet).sort();
    setBadgesByDay((cur) => ({ ...cur, [day]: { labels, exerciseIds } }));
  };

  const visibleDays = useMemo(() => {
    if (!filterExerciseId) return days;
    return days.filter((day) => {
      const summary = badgesByDay[day];
      if (summary?.exerciseIds.includes(filterExerciseId)) return true;
      const daySets = expanded[day];
      return !!daySets?.some((s) => s.exercise_id === filterExerciseId);
    });
  }, [days, badgesByDay, expanded, filterExerciseId]);

  const hasNoMatches = filterExerciseId !== "" && visibleDays.length === 0;

  // Re-apply filters when filter state changes
  useEffect(() => {
    if (!Object.keys(expanded).length) return;
    const next: Record<DayKey, any[]> = {};
    for (const [day, sets] of Object.entries(expanded)) next[day] = applyFilters(sets);
    setExpanded(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterExerciseId]);

  // 1000 lb club progress (Bench, Deadlift, Back Squat based on 1RM PRs)
  const thousandLb = useMemo(() => computeThousandLbProgress(prs), [prs]);
  const thousandLbSurplusKg = Math.max(0, thousandLb.totalKg - THOUSAND_LB_TARGET_KG);

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
            <Trophy size={18} className="text-primary" style={{ marginRight: 8 }} />
            PRs
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
            aria-label={prsExpanded ? 'Collapse PRs' : 'Expand PRs'}
          >
            {prsExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
        
        {prsExpanded && (
          <>
            {prs.length > 0 ? (
              <>
                {/* Metric Toggle */}
                <div className="row justify-center mb-base mt-lg">
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
                <div className="empty-state__icon text-primary">
                  <Dumbbell size={40} />
                </div>
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
          <h3 className="page-title mb-0">
            <Medal size={18} className="text-primary" style={{ marginRight: 8 }} />
            1000 lb Club
          </h3>
          <button
            className="ghost btn-icon"
            onClick={() => setClubExpanded(!clubExpanded)}
            aria-label={clubExpanded ? 'Collapse 1000 lb Club' : 'Expand 1000 lb Club'}
          >
            {clubExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
        {clubExpanded && (
          <>
            <div className="mb-base">
              {/* Progress bar */}
              {(() => {
                const pct = thousandLb.percent;
                return (
                  <div>
                    <div className="row justify-between items-center mb-sm mt-lg">
                      <div className="text-small opacity-70">Progress</div>
                      <div className="text-small">
                        {formatNumber(thousandLb.totalKg)} / {formatNumber(THOUSAND_LB_TARGET_KG)} kg{" "}
                        <span className="opacity-60">({formatNumber(Number(pct))}%)</span>
                        {thousandLb.reachedTarget && thousandLbSurplusKg > 0 && (
                          <span style={{ marginLeft: 8, color: "var(--color-success, #16a34a)" }}>
                            +{formatNumber(thousandLbSurplusKg)} kg over
                          </span>
                        )}
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
      {hasNoMatches ? (
        <div className="empty-state">
          <div className="empty-state__icon text-primary">
            <Search size={40} />
          </div>
          <div className="empty-state__title">No sets logged for that exercise</div>
          <div className="empty-state__subtitle">Try another exercise or clear the filter.</div>
        </div>
      ) : (
        visibleDays.map((day, index) => {
          const daySets = expanded[day];
          const summary = badgesByDay[day];
          const badges = summary?.labels ?? [];
          
          const prevDay = visibleDays[index - 1];
          const showMonthHeader = index === 0 ||
            !prevDay ||
            new Date(day).getMonth() !== new Date(prevDay).getMonth() ||
            new Date(day).getFullYear() !== new Date(prevDay).getFullYear();

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
                    {daySets ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                </div>
                {daySets && daySets.length > 0 && (
                  <div className="mt-lg">
                    <GroupedSets
                      day={day}
                      sets={daySets}
                      exercises={exercises}
                      onEdit={(s) => setEditingSet({ day, set: s })}
                    />
                  </div>
                )}
                {daySets && daySets.length === 0 && (
                  <div className="empty-state empty-state--small">
                    <div className="empty-state__title">No sets match this filter</div>
                  </div>
                )}
              </div>
            </div>
          );
        })
      )}

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
    <div className="grouped-sets">
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
                    {s.failed && (
                      <span className="set-failed text-danger">
                        <XOctagon size={14} />
                      </span>
                    )}
                  </div>
                  <div className="set-actions">
                    <button
                      className="ghost btn-icon"
                      onClick={() => onEdit(s)}
                      aria-label={`Edit set: ${formatNumber(Number(s.weight))} kg × ${s.reps} reps`}
                    >
                      <Edit3 size={16} className="text-primary" />
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
