// =============================
// src/App.tsx
// =============================
import { Link, Outlet, useLocation } from 'react-router-dom';

export default function App() {
  const { pathname } = useLocation();
  return (
    <div className="container">
      <header className="row" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: 20, margin: 0 }}>🏋️ Gym Tracker</h1>
        <nav className="row" style={{ gap: 8 }}>
          <Tab to="/" label="Log" active={pathname === '/'} />
          <Tab to="/history" label="History" active={pathname.startsWith('/history')} />
          <Tab to="/charts" label="Charts" active={pathname.startsWith('/charts')} />
          <Tab to="/settings" label="Settings" active={pathname.startsWith('/settings')} />
        </nav>
      </header>
      <main style={{ marginTop: 16 }}>
        <Outlet />
      </main>
    </div>
  );
}

function Tab({ to, label, active }: { to: string; label: string; active: boolean }) {
  return (
    <Link to={to}>
      <button className={active ? 'primary' : 'ghost'}>{label}</button>
    </Link>
  );
}