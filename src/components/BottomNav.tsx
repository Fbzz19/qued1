import { Hop as Home, Search, Activity, User, Plus } from 'lucide-react';
import type { NavTab } from './TopNav';

interface BottomNavProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  onQuickAdd: () => void;
  isLoggedIn?: boolean;
  onMyProfile: () => void;
}

export default function BottomNav({ activeTab, onTabChange, onQuickAdd, onMyProfile }: BottomNavProps) {
  return (
    <nav className="mobile-only" style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 40,
      background: 'rgba(10,10,10,0.97)',
      backdropFilter: 'blur(12px)',
      borderTop: '1px solid #1a1a1a',
      paddingBottom: 'env(safe-area-inset-bottom, 0px)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', padding: '8px 8px 10px', maxWidth: 512, margin: '0 auto' }}>
        <NavBtn label="Home" icon={<Home size={22} />}     active={activeTab === 'home'}    onClick={() => onTabChange('home')} />
        <NavBtn label="Search" icon={<Search size={22} />}   active={activeTab === 'search'}  onClick={() => onTabChange('search')} />

        <button
          onClick={onQuickAdd}
          aria-label="Log a film"
          style={{
            marginTop: -20,
            width: 56, height: 56,
            borderRadius: '50%',
            border: 'none',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'linear-gradient(135deg, #f59e0b, #d97706)',
            boxShadow: '0 0 20px rgba(245,158,11,.5), 0 4px 16px rgba(0,0,0,.4)',
            transition: 'transform .15s',
            flexShrink: 0,
          }}
          onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.08)')}
          onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
          onMouseDown={e  => (e.currentTarget.style.transform = 'scale(.93)')}
          onMouseUp={e    => (e.currentTarget.style.transform = 'scale(1)')}
        >
          <Plus size={26} color="#000" strokeWidth={2.5} />
        </button>

        <NavBtn label="Activity" icon={<Activity size={22} />} active={activeTab === 'feed'} onClick={() => onTabChange('feed')} />
        <NavBtn label="Profile" icon={<User size={22} />} active={false} onClick={onMyProfile} />
      </div>
    </nav>
  );
}

function NavBtn({ label, icon, active, onClick }: { label: string; icon: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      style={{
        background: 'none', border: 'none', cursor: 'pointer',
        padding: '8px 12px',
        color: active ? '#fbbf24' : '#555',
        filter: active ? 'drop-shadow(0 0 6px rgba(245,158,11,.5))' : 'none',
        transition: 'color .2s, filter .2s',
        flex: 1, display: 'flex', justifyContent: 'center',
      }}
    >
      {icon}
    </button>
  );
}
