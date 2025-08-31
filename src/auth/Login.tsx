import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

export default function Login() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'password'|'magic'>('password');

  const [err, setErr] = useState<string | null>(null);
  const [emailForPw, setEmailForPw] = useState('');
  const [password, setPassword] = useState('');

  const [emailForMagic, setEmailForMagic] = useState('');
  const [sent, setSent] = useState(false);

  // ⬇️ If already signed in, or when a sign-in occurs, go home
  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      if (data.session) navigate('/');
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      if (session) navigate('/');
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, [navigate]);

  const onPasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    const { error } = await supabase.auth.signInWithPassword({
      email: emailForPw.trim(),
      password,
    });
    if (error) setErr(error.message);
    else navigate('/'); // ⬅️ explicit redirect after success
  };

  const onMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    const redirectTo = import.meta.env.DEV ? 'http://localhost:5173' : window.location.origin;
    const { error } = await supabase.auth.signInWithOtp({
      email: emailForMagic.trim(),
      options: { emailRedirectTo: redirectTo },
    });
    if (error) setErr(error.message);
    else setSent(true);
  };

  const onForgot = async () => {
    setErr(null);
    const { error } = await supabase.auth.resetPasswordForEmail(emailForPw.trim(), {
      redirectTo: import.meta.env.DEV ? 'http://localhost:5173/login' : `${window.location.origin}/login`,
    });
    if (error) setErr(error.message);
    else alert('If that email exists, a reset link has been sent.');
  };

  return (
    <div className="container" style={{ maxWidth: 480 }}>
      <div className="card">
        <div className="row justify-between items-center">
          <h2 className="mt-0">Sign in</h2>
          <div className="row gap-md">
            <button className={mode === 'password' ? 'primary' : 'ghost'} onClick={() => setMode('password')}>Password</button>
            <button className={mode === 'magic' ? 'primary' : 'ghost'} onClick={() => setMode('magic')}>Magic link</button>
          </div>
        </div>

        {mode === 'password' ? (
          <form onSubmit={onPasswordLogin} className="form-grid">
            <div className="form-field">
              <label>Email</label>
              <input value={emailForPw} onChange={(e) => setEmailForPw(e.target.value)} placeholder="you@example.com" type="email" autoComplete="username" required />
            </div>
            <div className="form-field">
              <label>Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" required />
            </div>
            {err && <p className="text-danger">{err}</p>}
            <div className="row justify-between items-center">
              <button className="primary" type="submit">Sign in</button>
              <button type="button" className="ghost" onClick={onForgot}>Forgot password?</button>
            </div>
          </form>
        ) : (
          <form onSubmit={onMagicLink} className="form-grid">
            <div className="form-field">
              <label>Email</label>
              <input value={emailForMagic} onChange={(e) => setEmailForMagic(e.target.value)} placeholder="you@example.com" required type="email" />
            </div>
            {err && <p className="text-danger">{err}</p>}
            {!sent ? <button className="primary" type="submit">Send magic link</button> : <p>Check your email for a magic link.</p>}
          </form>
        )}
      </div>
    </div>
  );
}