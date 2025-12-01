import { Link, Outlet, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { NotebookPen, History, LineChart, Settings as SettingsIcon } from 'lucide-react';

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
        <nav className="app-nav">
          <Tab to="/" label="Log" icon={NotebookPen} active={pathname === '/'} />
          <Tab to="/history" label="History" icon={History} active={pathname.startsWith('/history')} />
          <Tab to="/charts" label="Charts" icon={LineChart} active={pathname.startsWith('/charts')} />
          <Tab to="/settings" label="Settings" icon={SettingsIcon} active={pathname.startsWith('/settings')} />
        </nav>
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

function Tab({ to, label, active, icon: Icon }: { to: string; label: string; active: boolean; icon?: React.ComponentType<{ className?: string; size?: number }>; }) {
  return (
    <Link to={to} className="tab-link">
      <button className={`tab-button ${active ? 'primary' : 'ghost'}`}>
        {Icon && <Icon size={16} className="mr-sm" />}
        {label}
      </button>
    </Link>
  );
}

function BottomTabBar({ currentPath }: { currentPath: string }) {
  const tabs = [
    { to: '/', label: 'Log', icon: NotebookPen, active: currentPath === '/' },
    { to: '/history', label: 'History', icon: History, active: currentPath.startsWith('/history') },
    { to: '/charts', label: 'Charts', icon: LineChart, active: currentPath.startsWith('/charts') },
    { to: '/settings', label: 'Settings', icon: SettingsIcon, active: currentPath.startsWith('/settings') }
  ];

  return (
    <nav className="bottom-tab-bar">
      {tabs.map((tab) => (
        <Link key={tab.to} to={tab.to} className="bottom-tab-link">
          <div className={`bottom-tab ${tab.active ? 'active' : ''}`}>
            <span className="bottom-tab-icon">
              {tab.icon && <tab.icon size={20} />}
            </span>
            <span className="bottom-tab-label">{tab.label}</span>
          </div>
        </Link>
      ))}
    </nav>
  );
}