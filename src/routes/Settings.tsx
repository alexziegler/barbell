import { useState } from 'react';
import { useWorkoutStore } from '../state/useWorkoutStore';
import { signOut } from '../lib/api';
import { supabase } from '../lib/supabaseClient';
import { recomputePRs } from '../lib/api';

export default function Settings() {
  const units = useWorkoutStore((s) => s.units);
  const setUnits = useWorkoutStore((s) => s.setUnits);

  function RebuildPRs() {
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState<string | null>(null);
    const [err, setErr] = useState<string | null>(null);

    const run = async () => {
      setBusy(true); setMsg(null); setErr(null);
      try {
        await recomputePRs();
        setMsg('PRs recomputed from your existing sets. 🎉');
      } catch (e: any) {
        setErr(e.message ?? 'Failed to recompute PRs');
      } finally {
        setBusy(false);
      }
    };

    return (
      <div className="grid" style={{ gap: 8 }}>
        <p style={{ opacity: 0.8 }}>
          One-time backfill: scan all your sets and store the best per exercise.
        </p>
        {msg && <div style={{ color: '#8eff8e' }}>{msg}</div>}
        {err && <div style={{ color: '#ff7b7b' }}>{err}</div>}
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="primary" onClick={run} disabled={busy}>
            {busy ? 'Rebuilding…' : 'Rebuild PRs'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid" style={{ gap: 12 }}>
      {/* Units */}
      <div className="card row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: 600 }}>Units</div>
          <div style={{ opacity: 0.8 }}>Current: {units.toUpperCase()}</div>
        </div>
        <div className="row">
          <button onClick={() => setUnits('kg')} className={units === 'kg' ? 'primary' : ''}>kg</button>
          <button onClick={() => setUnits('lb')} className={units === 'lb' ? 'primary' : ''}>lb</button>
        </div>
      </div>

      {/* Password */}
      <div className="card grid" style={{ gap: 12, maxWidth: 520 }}>
        <h3 style={{ marginTop: 0 }}>Password</h3>
        <PasswordChanger />
      </div>

      <div className="card grid" style={{ gap: 12, maxWidth: 520 }}>
        <h3 style={{ marginTop: 0 }}>Personal Records</h3>
        <RebuildPRs />
      </div>

      {/* Sign out */}
      <div className="card">
        <button className="ghost" onClick={() => signOut()}>Sign out</button>
      </div>
    </div>
  );
}

function PasswordChanger() {
  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  // fetch current user email (purely informational)
  useState(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  });

  const onSave = async () => {
    setErr(null);
    setMsg(null);
    if (!pw1 || pw1.length < 8) {
      setErr('Use at least 8 characters.');
      return;
    }
    if (pw1 !== pw2) {
      setErr('Passwords do not match.');
      return;
    }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: pw1 });
    setSaving(false);
    if (error) {
      setErr(error.message);
    } else {
      setMsg('Password updated.');
      setPw1('');
      setPw2('');
    }
  };

  return (
    <div className="grid" style={{ gap: 10 }}>
      {email && <div style={{ opacity: 0.8, fontSize: 14 }}>Signed in as <strong>{email}</strong></div>}
      <div>
        <label>New password</label>
        <input
          type="password"
          value={pw1}
          onChange={(e) => setPw1(e.target.value)}
          placeholder="••••••••"
          autoComplete="new-password"
        />
      </div>
      <div>
        <label>Confirm password</label>
        <input
          type="password"
          value={pw2}
          onChange={(e) => setPw2(e.target.value)}
          placeholder="••••••••"
          autoComplete="new-password"
        />
      </div>
      {err && <div style={{ color: '#ff7b7b' }}>{err}</div>}
      {msg && <div style={{ color: '#8eff8e' }}>{msg}</div>}
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button className="primary" onClick={onSave} disabled={saving}>Save password</button>
      </div>
    </div>
  );
}