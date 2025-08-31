import { Link, Outlet, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';

export default function App() {
  const { pathname } = useLocation();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return (
    <div className="container">
      {!isMobile && (
        <header className="app-header">
          <h1 className="app-title">🏋️ Gym Tracker</h1>
          <nav className="app-nav">
            <Tab to="/" label="Log" active={pathname === '/'} />
            <Tab to="/history" label="History" active={pathname.startsWith('/history')} />
            <Tab to="/charts" label="Charts" active={pathname.startsWith('/charts')} />
            <Tab to="/settings" label="Settings" active={pathname.startsWith('/settings')} />
          </nav>
        </header>
      )}
      
      {isMobile && (
        <header className="mobile-header">
          <h1 className="mobile-title">🏋️ Gym Tracker</h1>
        </header>
      )}
      
      <main className={`app-main ${isMobile ? 'app-main-mobile' : ''}`}>
        <Outlet />
      </main>
      
      {isMobile && (
        <BottomTabBar currentPath={pathname} />
      )}
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

function BottomTabBar({ currentPath }: { currentPath: string }) {
  const tabs = [
    { to: '/', label: 'Log', icon: '📝', active: currentPath === '/' },
    { to: '/history', label: 'History', icon: '📊', active: currentPath.startsWith('/history') },
    { to: '/charts', label: 'Charts', icon: '📈', active: currentPath.startsWith('/charts') },
    { to: '/settings', label: 'Settings', icon: '⚙️', active: currentPath.startsWith('/settings') }
  ];

  return (
    <nav className="bottom-tab-bar">
      {tabs.map((tab) => (
        <Link key={tab.to} to={tab.to} className="bottom-tab-link">
          <div className={`bottom-tab ${tab.active ? 'active' : ''}`}>
            <span className="bottom-tab-icon">{tab.icon}</span>
            <span className="bottom-tab-label">{tab.label}</span>
          </div>
        </Link>
      ))}
    </nav>
  );
}