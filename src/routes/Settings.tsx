import { useWorkoutStore } from '../state/useWorkoutStore';
import { signOut } from '../lib/api';

export default function Settings() {
  const units = useWorkoutStore(s => s.units);
  const setUnits = useWorkoutStore(s => s.setUnits);
  return (
    <div className="grid" style={{ gap: 12 }}>
      <div className="card row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: 600 }}>Units</div>
          <div style={{ opacity: .8 }}>Current: {units.toUpperCase()}</div>
        </div>
        <div className="row">
          <button onClick={() => setUnits('kg')} className={units === 'kg' ? 'primary' : ''}>kg</button>
          <button onClick={() => setUnits('lb')} className={units === 'lb' ? 'primary' : ''}>lb</button>
        </div>
      </div>

      <div className="card">
        <button className="ghost" onClick={() => signOut()}>Sign out</button>
      </div>
    </div>
  );
}