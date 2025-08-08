import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function Login() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } });
    if (error) setErr(error.message);
    else setSent(true);
  };

  return (
    <div className="container" style={{ maxWidth: 420 }}>
      <div className="card">
        <h2>Sign in</h2>
        {sent ? (
          <p>Check your email for a magic link.</p>
        ) : (
          <form onSubmit={onSubmit} className="grid" style={{ gap: 12 }}>
            <div>
              <label>Email</label>
              <input value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required type="email" />
            </div>
            {err && <p style={{ color: '#ff7b7b' }}>{err}</p>}
            <button className="primary" type="submit">Send magic link</button>
          </form>
        )}
      </div>
    </div>
  );
}