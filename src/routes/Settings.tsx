import { useEffect, useState } from 'react';
import { signOut } from '../lib/api';
import { supabase } from '../lib/supabaseClient';
import { recomputePRs } from '../lib/api';

export default function Settings() {

  function RebuildPRs() {
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState<string | null>(null);
    const [err, setErr] = useState<string | null>(null);

    const run = async () => {
      setBusy(true); setMsg(null); setErr(null);
      try {
        await recomputePRs();
        setMsg('PRs recomputed from your existing sets.');
      } catch (e: any) {
        setErr(e.message ?? 'Failed to recompute PRs');
      } finally {
        setBusy(false);
      }
    };

    return (
      <div className="form-grid">
        <p className="text-muted">
          One-time backfill: scan all your sets and store the best per exercise.
        </p>
        {msg && <div className="text-success">{msg}</div>}
        {err && <div className="text-danger">{err}</div>}
        <div className="form-actions">
          <button className="primary" onClick={run} disabled={busy}>
            {busy ? 'Rebuilding…' : 'Rebuild PRs'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      {/* Password */}
      <div className="card form-grid" style={{ maxWidth: 520 }}>
        <h3 className="mt-0">Password</h3>
        <PasswordChanger />
      </div>

      <div className="card form-grid" style={{ maxWidth: 520 }}>
        <h3 className="mt-0">Personal Records</h3>
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
  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      setEmail(data.user?.email ?? null);
    });
    return () => { mounted = false; };
  }, []);

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
    <div className="form-grid">
      {email && <div className="text-muted text-small">Signed in as <strong>{email}</strong></div>}
      <div className="form-field">
        <label>New password</label>
        <input
          type="password"
          value={pw1}
          onChange={(e) => setPw1(e.target.value)}
          placeholder="••••••••"
          autoComplete="new-password"
        />
      </div>
      <div className="form-field">
        <label>Confirm password</label>
        <input
          type="password"
          value={pw2}
          onChange={(e) => setPw2(e.target.value)}
          placeholder="••••••••"
          autoComplete="new-password"
        />
      </div>
      {err && <div className="text-danger">{err}</div>}
      {msg && <div className="text-success">{msg}</div>}
      <div className="form-actions">
        <button className="primary" onClick={onSave} disabled={saving}>Save password</button>
      </div>
    </div>
  );
}
