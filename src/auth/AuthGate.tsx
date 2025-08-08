import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useNavigate } from 'react-router-dom';

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setAuthed(!!data.session);
      setReady(true);
      if (!data.session) navigate('/login');
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      setAuthed(!!session);
      if (!session) navigate('/login');
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, [navigate]);

  if (!ready) return <div className="container">Loading…</div>;
  if (!authed) return null; // will be redirected
  return <>{children}</>;
}