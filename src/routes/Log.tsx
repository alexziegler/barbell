import { useEffect, useState, useMemo } from 'react';
import ExercisePicker from '../components/ExercisePicker';
import SetEditor from '../components/SetEditor';
import EditSetModal from '../components/EditSetModal';
import { addSetBare, listSetsByDay, updateSet, deleteSet, getExercises, upsertPRForSet, recomputePRs, getPRs } from '../lib/api';
import { formatNumber } from '../utils/format';
import type { Exercise } from '../types';
import { detectImprovedMetrics, computeThousandLbProgress, type ExercisePRSummary, type PRMetric } from '../utils/prs';
// Units fixed to kg

// Types
interface SetData {
  id: string;
  exercise_id: string;
  weight: number;
  reps: number;
  rpe: number | null;
  failed: boolean;
  created_at: string;
  exercise?: Exercise;
}

interface GroupedExercise {
  exercise: Exercise;
  sets: SetData[];
}

interface SetPatch {
  weight?: number;
  reps?: number;
  rpe?: number | null;
  failed?: boolean;
  performed_at?: string;
}

const METRIC_ORDER: PRMetric[] = ['weight', '1rm', 'volume'];
const METRIC_LABEL: Record<PRMetric, string> = {
  weight: 'Heaviest',
  '1rm': 'Best 1RM',
  volume: 'Best Volume',
};

// Helper functions
const getTodayDate = (): string => {
  return new Date().toISOString().split('T')[0]; // YYYY-MM-DD
};

const groupSetsByExercise = (sets: SetData[]): GroupedExercise[] => {
  const grouped = sets.reduce((acc, set) => {
    const exerciseId = set.exercise_id;
    if (!acc[exerciseId]) {
      acc[exerciseId] = {
        exercise: set.exercise!,
        sets: []
      };
    }
    acc[exerciseId].sets.push(set);
    return acc;
  }, {} as Record<string, GroupedExercise>);

  return Object.values(grouped);
};

export default function Log() {

  const [exerciseId, setExerciseId] = useState<string | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [sets, setSets] = useState<SetData[]>([]);
  const [prs, setPRs] = useState<ExercisePRSummary[]>([]);
  const [editingSetId, setEditingSetId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const editingSet = useMemo(() => sets.find(s => s.id === editingSetId) || null, [editingSetId, sets]);

  // Memoized values
  const groupedSets = useMemo(() => groupSetsByExercise(sets), [sets]);
  const selectedExercise = useMemo(() => 
    exercises.find(e => e.id === exerciseId), [exercises, exerciseId]
  );

  // Load data
  useEffect(() => { 
    getExercises().then(setExercises).catch(err => {
      console.error('Failed to load exercises:', err);
      setError('Failed to load exercises');
    }); 
  }, []);

  useEffect(() => {
    getPRs().then(setPRs).catch(err => {
      console.error('Failed to load PRs:', err);
    });
  }, []);

  useEffect(() => { 
    const today = getTodayDate();
    listSetsByDay(today).then(setSets).catch(err => {
      console.error('Failed to load sets:', err);
      setError('Failed to load today\'s sets');
    }); 
  }, []);

  // Refresh sets data
  const refreshSets = () => {
    const today = getTodayDate();
    listSetsByDay(today).then(setSets).catch(err => {
      console.error('Failed to refresh sets:', err);
      setError('Failed to refresh sets');
    });
  };

  const onAddSet = async (s: { weight: number; reps: number; rpe?: number|null; failed?: boolean; performed_at?: string }) => {
    if (!exerciseId) { 
      setError('Please select an exercise first');
      return; 
    }
    
    setError(null);
    try {
      const prevPR = prs.find(pr => pr.exerciseId === exerciseId) ?? null;
      const prevClub = computeThousandLbProgress(prs);

      const inserted = await addSetBare({
        exercise_id: exerciseId,
        weight: s.weight,
        reps: s.reps,
        rpe: s.rpe ?? null,
        failed: s.failed ?? false,
        performed_at: s.performed_at ?? undefined,
      });

      let prResponse: Awaited<ReturnType<typeof upsertPRForSet>> | null = null;
      try {
        prResponse = await upsertPRForSet(inserted.id);
      } catch (prError) {
        console.error('Failed to check PRs:', prError);
      }

      try {
        await recomputePRs();
      } catch (recomputeError) {
        console.error('Failed to recompute PRs after insert:', recomputeError);
      }

      let latestPRs = prs;
      try {
        latestPRs = await getPRs();
        setPRs(latestPRs);
      } catch (refreshError) {
        console.error('Failed to refresh PRs after insert:', refreshError);
      }

      const nextPR = latestPRs.find(pr => pr.exerciseId === exerciseId) ?? null;
      const metricsHit = new Set<PRMetric>();

      if (prResponse?.new_weight) metricsHit.add('weight');
      if (prResponse?.new_1rm) metricsHit.add('1rm');
      if (prResponse?.new_volume) metricsHit.add('volume');

      detectImprovedMetrics(prevPR, nextPR).forEach(metric => metricsHit.add(metric));

      if (metricsHit.size) {
        const exName = selectedExercise?.name ?? 'Exercise';
        const labels = METRIC_ORDER.filter(metric => metricsHit.has(metric)).map(metric => METRIC_LABEL[metric]);
        alert(`🎉 New PR (${labels.join(' & ')}): ${exName}`);
      }

      const nextClub = computeThousandLbProgress(latestPRs);
      const reachedClub = (!prevClub.reachedTarget && nextClub.reachedTarget) || !!prResponse?.club_reached_1000;
      if (reachedClub) {
        alert('💯 Congrats! You just reached the 1000 lb club!');
      }

      refreshSets();
    } catch (err) {
      console.error('Failed to add set:', err);
      setError('Failed to add set. Please try again.');
    }
  };

  const onSaveSet = async (id: string, patch: SetPatch) => {
    setError(null);
    try {
      await updateSet(id, patch);
      // Ensure PRs reflect the edited set
      await recomputePRs();
      try {
        const latestPRs = await getPRs();
        setPRs(latestPRs);
      } catch (refreshError) {
        console.error('Failed to refresh PRs after update:', refreshError);
      }
      refreshSets();
      setEditingSetId(null);
    } catch (err) {
      console.error('Failed to update set:', err);
      setError('Failed to update set. Please try again.');
    }
  };

  const onDelete = async (id: string) => {
    if (!confirm('Delete this set?')) return;
    
    setError(null);
    try {
      await deleteSet(id);
      // Deletions can change PRs
      await recomputePRs();
      try {
        const latestPRs = await getPRs();
        setPRs(latestPRs);
      } catch (refreshError) {
        console.error('Failed to refresh PRs after delete:', refreshError);
      }
      refreshSets();
    } catch (err) {
      console.error('Failed to delete set:', err);
      setError('Failed to delete set. Please try again.');
    }
  };

  return (
    <div className="page-container">
      {/* Error Display */}
      {error && (
        <div className="error-message">
          {error}
          <button 
            className="error-dismiss" 
            onClick={() => setError(null)}
            aria-label="Dismiss error"
          >
            ×
          </button>
        </div>
      )}

      {/* Log a Set Block */}
      <div className="card">
        <h3 className="page-title">
          📝 Log a Set
        </h3>
        
        {/* Exercise Selection */}
        <div className="mb-lg">
          <ExercisePicker value={exerciseId} onChange={setExerciseId} />
        </div>

        {/* Set Editor */}
        {exerciseId && (
          <SetEditor onAdd={onAddSet} units={'kg'} />
        )}
        
        {!exerciseId && (
          <div className="empty-state empty-state--small">
            <div className="empty-state__icon">🏋️</div>
            <div className="empty-state__title">Select an exercise to start logging sets</div>
          </div>
        )}
      </div>

      {/* Today's Sets Block */}
      <div className="card">
        <h3 className="page-title">
          📊 Today's Sets
          {sets.length > 0 && (
            <span className="page-subtitle">
              ({sets.length} set{sets.length > 1 ? 's' : ''})
            </span>
          )}
        </h3>
        
        {groupedSets.length ? (
          <div className="space-y-lg">
                  {groupedSets.map(({ exercise, sets: exerciseSets }) => (
                      <div key={exercise.id} className="exercise-group">
                        <div className="exercise-header">
                          <div className="exercise-badge">
                            {exercise.short_name ?? exercise.name}
                          </div>
                          <div className="exercise-count">
                            {exerciseSets.length} set{exerciseSets.length > 1 ? 's' : ''}
                          </div>
                        </div>
                        
                        <div className="exercise-sets">
                  {exerciseSets.map((s: SetData) => (
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
                            onClick={() => setEditingSetId(s.id)}
                            aria-label={`Edit set: ${formatNumber(Number(s.weight))} kg × ${s.reps} reps`}
                          >
                            ✏️
                          </button>
                          <button 
                            className="ghost btn-icon" 
                            onClick={() => onDelete(s.id)}
                            aria-label={`Delete set: ${formatNumber(Number(s.weight))} kg × ${s.reps} reps`}
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    ))}
                        </div>
                      </div>
                    ))}
                  </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state__icon">📊</div>
            <div className="empty-state__title">No sets logged today yet</div>
            <div className="empty-state__subtitle">Start by selecting an exercise above</div>
          </div>
        )}
      </div>
    {/* Edit Set Modal */}
    <EditSetModal
      open={!!editingSet}
      set={editingSet}
      exercises={exercises}
      onClose={() => setEditingSetId(null)}
      onDelete={editingSet ? (() => onDelete(editingSet.id)) : undefined}
      onSave={(patch) => {
        if (!editingSet) return;
        onSaveSet(editingSet.id, patch);
        setEditingSetId(null);
      }}
    />
    </div>
  );
}
