import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function Login() {
  const [mode, setMode] = useState<'password'|'magic'>('password');

  const [err, setErr] = useState<string | null>(null);

  // password mode
  const [emailForPw, setEmailForPw] = useState('');
  const [password, setPassword] = useState('');

  // magic link mode
  const [emailForMagic, setEmailForMagic] = useState('');
  const [sent, setSent] = useState(false);

  const onPasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    const { error } = await supabase.auth.signInWithPassword({
      email: emailForPw.trim(),
      password,
    });
    if (error) setErr(error.message);
    // success will redirect via AuthGate
  };

  const onMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: emailForMagic.trim(),
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) setErr(error.message);
    else setSent(true);
  };

  const onForgot = async () => {
    setErr(null);
    const { error } = await supabase.auth.resetPasswordForEmail(emailForPw.trim(), {
      redirectTo: `${window.location.origin}/login`,
    });
    if (error) setErr(error.message);
    else alert('If that email exists, a reset link has been sent.');
  };

  return (
    <div className="container" style={{ maxWidth: 480 }}>
      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>Sign in</h2>
          <div className="row" style={{ gap: 8 }}>
            <button className={mode === 'password' ? 'primary' : 'ghost'} onClick={() => setMode('password')}>
              Password
            </button>
            <button className={mode === 'magic' ? 'primary' : 'ghost'} onClick={() => setMode('magic')}>
              Magic link
            </button>
          </div>
        </div>

        {mode === 'password' ? (
          <form onSubmit={onPasswordLogin} className="grid" style={{ gap: 12 }}>
            <div>
              <label>Email</label>
              <input
                value={emailForPw}
                onChange={(e) => setEmailForPw(e.target.value)}
                placeholder="you@example.com"
                type="email"
                autoComplete="username"
                required
              />
            </div>
            <div>
              <label>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
            </div>
            {err && <p style={{ color: '#ff7b7b' }}>{err}</p>}
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <button className="primary" type="submit">Sign in</button>
              <button type="button" className="ghost" onClick={onForgot}>Forgot password?</button>
            </div>
          </form>
        ) : (
          <form onSubmit={onMagicLink} className="grid" style={{ gap: 12 }}>
            <div>
              <label>Email</label>
              <input
                value={emailForMagic}
                onChange={(e) => setEmailForMagic(e.target.value)}
                placeholder="you@example.com"
                required
                type="email"
              />
            </div>
            {err && <p style={{ color: '#ff7b7b' }}>{err}</p>}
            {!sent ? (
              <button className="primary" type="submit">Send magic link</button>
            ) : (
              <p>Check your email for a magic link.</p>
            )}
          </form>
        )}
      </div>
    </div>
  );
}