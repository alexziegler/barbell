import { Link, Outlet, useLocation } from 'react-router-dom';

export default function App() {
  const { pathname } = useLocation();
  return (
    <div className="container">
      <header className="app-header">
        <h1 className="app-title">🏋️ Gym Tracker</h1>
        <nav className="app-nav">
          <Tab to="/" label="Log" active={pathname === '/'} />
          <Tab to="/history" label="History" active={pathname.startsWith('/history')} />
          <Tab to="/charts" label="Charts" active={pathname.startsWith('/charts')} />
          <Tab to="/settings" label="Settings" active={pathname.startsWith('/settings')} />
        </nav>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}

function Tab({ to, label, active }: { to: string; label: string; active: boolean }) {
  return (
    <Link to={to} className="tab-link">
      <button className={`tab-button ${active ? 'primary' : 'ghost'}`}>{label}</button>
    </Link>
  );
}