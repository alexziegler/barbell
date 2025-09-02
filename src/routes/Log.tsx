import { useEffect, useState, useMemo } from 'react';
import ExercisePicker from '../components/ExercisePicker';
import SetEditor from '../components/SetEditor';
import InlineSetEditor from '../components/InlineSetEditor';
import { addSetBare, listSetsByDay, updateSet, deleteSet, getExercises, upsertPRForSet, recomputePRs } from '../lib/api';
import type { Exercise } from '../types';
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
}

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
  const [editingSetId, setEditingSetId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      const inserted = await addSetBare({
        exercise_id: exerciseId,
        weight: s.weight,
        reps: s.reps,
        rpe: s.rpe ?? null,
        failed: s.failed ?? false,
        performed_at: s.performed_at ?? undefined,
      });

      // Check for PRs
      try {
        const res = await upsertPRForSet(inserted.id);
        if (res?.new_weight || res?.new_1rm) {
          const exName = selectedExercise?.name ?? 'Exercise';
          const parts: string[] = [];
          if (res.new_weight) parts.push('Heaviest');
          if (res.new_1rm) parts.push('Best 1RM');
          alert(`🎉 New PR (${parts.join(' & ')}): ${exName}`);
        }
      } catch (prError) {
        console.error('Failed to check PRs:', prError);
        // Don't show error to user for PR check failures
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
                  {exerciseSets.map((s: SetData) =>
                    editingSetId === s.id ? (
                      <InlineSetEditor
                        key={s.id}
                        set={s}
                        exercises={exercises}
                        onSave={(patch) => onSaveSet(s.id, patch)}
                        onCancel={() => setEditingSetId(null)}
                        onDelete={() => onDelete(s.id)}
                        showTime={false}
                      />
                    ) : (
                      <div key={s.id} className="set-row">
                        <div className="set-info">
                          <span className="set-weight">{Number(s.weight).toFixed(2)}</span>
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
                            aria-label={`Edit set: ${Number(s.weight).toFixed(2)} kg × ${s.reps} reps`}
                          >
                            ✏️
                          </button>
                          <button 
                            className="ghost btn-icon" 
                            onClick={() => onDelete(s.id)}
                            aria-label={`Delete set: ${Number(s.weight).toFixed(2)} kg × ${s.reps} reps`}
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    )
                  )}
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
    </div>
  );
}
