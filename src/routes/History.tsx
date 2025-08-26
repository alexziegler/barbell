import { useEffect, useMemo, useState } from "react";
import { getExercises, listRecentDays, listSetsByDay, updateSet, deleteSet, listExerciseBadgesForDays } from "../lib/api";
import InlineSetEditor from "../components/InlineSetEditor";
import type { Exercise } from "../types";

/** DD/MM/YYYY */
function formatDate(isoLike: string | Date) {
  return new Date(isoLike).toLocaleDateString("en-GB");
}

type DayKey = string; // "YYYY-MM-DD"

export default function History() {
  // Days & sets
  const [days, setDays] = useState<DayKey[]>([]);
  const [expanded, setExpanded] = useState<Record<DayKey, any[]>>({});

  // Exercises (for badges and editor dropdown)
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [badgesByDay, setBadgesByDay] = useState<Record<DayKey, string[]>>({});

  // Filters
  const [filterExerciseId, setFilterExerciseId] = useState<string>("");
  const [filterText, setFilterText] = useState("");

  // Editing
  const [editingSet, setEditingSet] = useState<{ day: DayKey; set: any } | null>(null);

  // Load recent days + exercises
  useEffect(() => {
    (async () => {
      const ds = await listRecentDays(60);
      setDays(ds);
      // fetch badges for all visible days
      const map = await listExerciseBadgesForDays(ds);
      setBadgesByDay(map);
    })();
    getExercises().then(setExercises);
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

    const text = filterText.trim().toLowerCase();
    const wantExerciseId = filterExerciseId || null;

    return sets.filter((s) => {
      const matchesExercise = wantExerciseId ? s.exercise_id === wantExerciseId : true;
      if (!matchesExercise) return false;

      if (text) {
        const ex = exMap.get(s.exercise_id);
        const hay = [
          ex?.name ?? "",
          ex?.short ?? "",
          String(s.weight ?? ""),
          String(s.reps ?? ""),
          String(s.rpe ?? ""),
          s.failed ? "failed" : "",
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(text)) return false;
      }
      return true;
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
  }, [filterExerciseId, filterText]);

  return (
    <div className="grid" style={{ gap: 12 }}>
      {/* Filter bar */}
      <div className="card">
        <div className="row" style={{ gap: 12, alignItems: "end" }}>
          <div>
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
          <div style={{ flex: 1 }}>
            <label>Search (exercise/weight/reps/RPE/failed)</label>
            <input
              placeholder="e.g., squat, 132.5, failed"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
            />
          </div>
          {(filterExerciseId || filterText) && (
            <button
              className="ghost"
              onClick={() => {
                setFilterExerciseId("");
                setFilterText("");
              }}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Day list */}
      {days.map((day) => {
        const daySets = expanded[day];
        const badges = badgesByDay[day] ?? []; // ← use precomputed badges even when collapsed

        return (
          <div key={day} className="card">
            <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
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
              <div style={{ marginTop: 8 }}>
                <GroupedSets
                  day={day}
                  sets={daySets}
                  exercises={exercises}
                  onEdit={(s) => setEditingSet({ day, set: s })}
                />
              </div>
            )}
          </div>
        );
      })}

      {/* Inline editor row */}
      {editingSet && (
        <div className="card" style={{ borderStyle: "dashed" }}>
          <h4 style={{ marginTop: 0 }}>Edit set</h4>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left" }}>Exercise</th>
                <th>Weight (kg)</th>
                <th>Reps</th>
                <th>RPE</th>
                <th>Failed</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              <InlineSetEditor
                set={editingSet.set}
                exercises={exercises}
                showTime={false}
                showNotes={false}
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
    <div className="grid" style={{ gap: 12 }}>
      {names.map((name) => {
        const group = groups[name];
        return (
          <div key={name} className="card" style={{ background: "#0f1116" }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>
              {name} <span style={{ opacity: 0.6 }}>({group.length} set{group.length > 1 ? "s" : ""})</span>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>Exercise</th>
                  <th>Weight (kg)</th>
                  <th>Reps</th>
                  <th>RPE</th>
                  <th>Failed</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {group.map((s) => (
                  <tr key={s.id}>
                    {/* empty exercise cell to align with editor dropdown column */}
                    <td />
                    <td style={{ textAlign: "center" }}>{s.weight}</td>
                    <td style={{ textAlign: "center" }}>{s.reps}</td>
                    <td style={{ textAlign: "center" }}>{s.rpe ?? "—"}</td>
                    <td style={{ textAlign: "center" }}>{s.failed ? "✔︎" : ""}</td>
                    <td className="row" style={{ gap: 6, justifyContent: "flex-end" }}>
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