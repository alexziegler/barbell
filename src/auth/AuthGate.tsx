// src/auth/AuthGate.tsx
import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  const navigate = useNavigate();
  const loc = useLocation();

  useEffect(() => {
    let mounted = true;

    // initial check
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      const hasSession = !!data.session;
      setAuthed(hasSession);
      setReady(true);

      if (!hasSession && loc.pathname !== '/login') navigate('/login');
      if (hasSession && loc.pathname === '/login') navigate('/');
    });

    // react to changes (password login, magic link, sign out)
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      const hasSession = !!session;
      setAuthed(hasSession);
      if (!hasSession && loc.pathname !== '/login') navigate('/login');
      if (hasSession && loc.pathname === '/login') navigate('/');
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [navigate, loc.pathname]);

  if (!ready) return <div className="container">Loading…</div>;
  // While unauthenticated and redirecting to /login, render nothing to avoid flashes
  if (!authed && loc.pathname !== '/login') return null;

  return <>{children}</>;
}