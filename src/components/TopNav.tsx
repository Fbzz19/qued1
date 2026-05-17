import { useState, useRef, useEffect } from 'react';
import { Film, Plus, Search, Sparkles, Menu, X, ShieldCheck, Crown, User, Settings, LogOut, ChevronDown } from 'lucide-react';
import { useI18n } from '../context/I18nContext';
import NotificationPanel from './NotificationPanel';

export type NavTab = 'home' | 'films' | 'tv' | 'members' | 'search' | 'ai' | 'feed' | 'watchorder';

interface TopNavProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  onSignIn: () => void;
  onSignUp: () => void;
  onMyProfile: () => void;
  onSettings: () => void;
  onSignOut: () => void;
  onQuickAdd: () => void;
  onNotificationNavigate?: (type: string, refId: string | null) => void;
  isLoggedIn: boolean;
  username?: string;
  avatarUrl?: string;
  isAdmin?: boolean;
  onAdmin?: () => void;
  onPro?: () => void;
}

const NAV_H = 56;

export default function TopNav({
  activeTab, onTabChange, onSignIn, onSignUp, onMyProfile, onQuickAdd,
  onSettings, onSignOut, onNotificationNavigate, isLoggedIn, username, avatarUrl, isAdmin, onAdmin, onPro,
}: TopNavProps) {
  const { t } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    if (menuOpen) document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [menuOpen]);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) setProfileMenuOpen(false);
    }
    if (profileMenuOpen) document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [profileMenuOpen]);

  function go(tab: NavTab) { onTabChange(tab); setMenuOpen(false); setProfileMenuOpen(false); }

  function profileAction(action: () => void) {
    action();
    setProfileMenuOpen(false);
    setMenuOpen(false);
  }

  // Tabs in exact display order
  const tabs: { key: NavTab; label: string; icon?: React.ReactNode; authOnly?: boolean; special?: boolean }[] = [
    { key: 'films',      label: t('nav_films') },
    { key: 'tv',         label: t('nav_tv') },
    { key: 'members',    label: t('nav_members') },
    { key: 'watchorder', label: 'Watch Order', authOnly: true },
    { key: 'feed',       label: t('nav_feed'), authOnly: true },
    { key: 'ai',         label: 'QuedAI', icon: <Sparkles size={13} />, special: true },
  ];

  const visibleTabs = tabs.filter(tab => !tab.authOnly || isLoggedIn);

  function tabBtn(tab: typeof tabs[0]) {
    const active = activeTab === tab.key;
    return (
      <button
        key={tab.key}
        onClick={() => go(tab.key)}
        style={{
          background: 'none',
          border: 'none',
          borderBottom: active ? `2px solid #f59e0b` : '2px solid transparent',
          cursor: 'pointer',
          padding: '0 12px',
          height: NAV_H,
          fontSize: 14,
          fontWeight: tab.special ? 600 : 500,
          color: active ? '#fff' : tab.special ? '#f59e0b' : '#888',
          transition: 'color .15s',
          fontFamily: 'inherit',
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          flexShrink: 0,
          whiteSpace: 'nowrap',
        }}
        onMouseEnter={e => {
          if (!active) (e.currentTarget as HTMLButtonElement).style.color = tab.special ? '#fbbf24' : '#ccc';
        }}
        onMouseLeave={e => {
          if (!active) (e.currentTarget as HTMLButtonElement).style.color = tab.special ? '#f59e0b' : '#888';
        }}
      >
        {tab.icon}
        {tab.label}
      </button>
    );
  }

  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
      background: 'rgba(5,5,5,0.97)', backdropFilter: 'blur(12px)',
      borderBottom: '1px solid #1a1a1a',
      height: NAV_H,
    }}>
      {/* Single horizontal row — all items on one line */}
      <div style={{
        width: '100%', maxWidth: 1400, margin: '0 auto',
        padding: '0 20px',
        height: NAV_H,
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'nowrap',
        gap: 0,
      }}>

        {/* Logo */}
        <button
          onClick={() => go('home')}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '0 16px 0 0', flexShrink: 0,
            height: NAV_H,
          }}
        >
          <Film size={19} color="#f59e0b" />
          <span className="gold-glow" style={{ fontSize: 19, fontWeight: 800, color: '#f59e0b', letterSpacing: '-0.5px' }}>Qued</span>
        </button>

        {/* ── Desktop inline tabs ── */}
        <div
          className="desktop-only-flex"
          style={{
            display: 'none', /* overridden to flex by CSS at ≥768px */
            flexDirection: 'row',
            alignItems: 'center',
            flexWrap: 'nowrap',
            flex: 1,
            height: NAV_H,
            minWidth: 0,
          }}
        >
          {visibleTabs.map(tabBtn)}

          {/* Qued Pro — always visible, same row */}
          <button
            onClick={onPro}
            style={{
              background: 'none', border: 'none',
              borderBottom: '2px solid transparent',
              cursor: 'pointer', padding: '0 12px', height: NAV_H,
              fontSize: 14, fontWeight: 700, color: '#f59e0b',
              display: 'flex', alignItems: 'center', gap: 5,
              flexShrink: 0, fontFamily: 'inherit', whiteSpace: 'nowrap',
              transition: 'color .15s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#fbbf24'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#f59e0b'; }}
          >
            <Crown size={13} />
            Qued Pro
          </button>

          {/* Spacer pushes right-side controls to the end */}
          <div style={{ flex: 1 }} />

          {/* Search icon */}
          <button
            onClick={() => go('search')}
            aria-label="Search"
            title="Search"
            style={{
              width: 34, height: 34, borderRadius: 8,
              border: 'none', background: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: activeTab === 'search' ? '#f59e0b' : '#666',
              transition: 'color .2s', flexShrink: 0,
            }}
            onMouseEnter={e => { if (activeTab !== 'search') (e.currentTarget as HTMLButtonElement).style.color = '#ccc'; }}
            onMouseLeave={e => { if (activeTab !== 'search') (e.currentTarget as HTMLButtonElement).style.color = '#666'; }}
          >
            <Search size={16} />
          </button>

          {/* Quick add */}
          <button
            onClick={onQuickAdd}
            aria-label="Log a film"
            title="Log a film"
            style={{
              width: 34, height: 34, borderRadius: 8,
              border: 'none', background: '#f59e0b', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background .2s', flexShrink: 0, marginLeft: 4,
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#fbbf24'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#f59e0b'; }}
          >
            <Plus size={16} color="#000" strokeWidth={2.5} />
          </button>

          {/* Admin badge */}
          {isAdmin && (
            <button
              onClick={onAdmin}
              title="Admin Dashboard"
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                height: 30, padding: '0 10px', borderRadius: 8, marginLeft: 4,
                border: '1px solid rgba(239,68,68,.4)', background: 'rgba(239,68,68,.08)',
                cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#f87171',
                transition: 'all .2s', fontFamily: 'inherit', flexShrink: 0,
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,.16)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,.08)'; }}
            >
              <ShieldCheck size={12} />
              Admin
            </button>
          )}

          {/* Notifications */}
          {isLoggedIn && (
            <div style={{ flexShrink: 0, marginLeft: 2 }}>
              <NotificationPanel onNavigate={onNotificationNavigate} />
            </div>
          )}

          {/* Divider */}
          <div style={{ width: 1, height: 20, background: '#2e2e2e', margin: '0 6px', flexShrink: 0 }} />

          {/* Profile or Sign in / Sign up */}
          {isLoggedIn ? (
            <div ref={profileMenuRef} style={{ position: 'relative', flexShrink: 0 }}>
              <button
                onClick={() => setProfileMenuOpen(o => !o)}
                aria-haspopup="menu"
                aria-expanded={profileMenuOpen}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: profileMenuOpen ? 'rgba(245,158,11,.08)' : 'none', border: profileMenuOpen ? '1px solid #f59e0b' : '1px solid #2e2e2e', borderRadius: 8,
                  padding: '5px 9px 5px 5px', cursor: 'pointer', color: profileMenuOpen ? '#fff' : '#ccc',
                  fontSize: 13, fontWeight: 500, transition: 'all .2s',
                  fontFamily: 'inherit', whiteSpace: 'nowrap',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#f59e0b'; (e.currentTarget as HTMLButtonElement).style.color = '#fff'; }}
                onMouseLeave={e => {
                  if (!profileMenuOpen) {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = '#2e2e2e';
                    (e.currentTarget as HTMLButtonElement).style.color = '#ccc';
                  }
                }}
              >
                <span style={{ width: 24, height: 24, borderRadius: '50%', overflow: 'hidden', background: '#2e2e2e', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {avatarUrl
                    ? <img src={avatarUrl} alt={username} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <span style={{ fontSize: 11, fontWeight: 700, color: '#fbbf24' }}>{username?.[0]?.toUpperCase() ?? '?'}</span>}
                </span>
                {username}
                <ChevronDown size={13} style={{ transform: profileMenuOpen ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform .2s' }} />
              </button>

              {profileMenuOpen && (
                <div
                  role="menu"
                  className="animate-slide-down"
                  style={{
                    position: 'absolute',
                    top: 42,
                    right: 0,
                    width: 190,
                    background: '#0f0f0f',
                    border: '1px solid #1f1f1f',
                    borderRadius: 12,
                    boxShadow: '0 18px 48px rgba(0,0,0,.75)',
                    padding: 6,
                    zIndex: 350,
                  }}
                >
                  <ProfileMenuItem icon={<User size={14} />} label="My Profile" onClick={() => profileAction(onMyProfile)} />
                  <ProfileMenuItem icon={<Settings size={14} />} label="Settings" onClick={() => profileAction(onSettings)} />
                  <div style={{ height: 1, background: '#1a1a1a', margin: '6px 4px' }} />
                  <ProfileMenuItem icon={<LogOut size={14} />} label="Sign out" danger onClick={() => profileAction(onSignOut)} />
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              <button onClick={onSignIn} className="btn-ghost" style={{ fontSize: 13, padding: '7px 14px', borderRadius: 8 }}>{t('nav_sign_in')}</button>
              <button onClick={onSignUp} className="btn-gold"  style={{ fontSize: 13, padding: '7px 14px', borderRadius: 8 }}>{t('nav_sign_up')}</button>
            </div>
          )}
        </div>

        {/* ── Mobile: spacer + hamburger ── */}
        <div className="mobile-only" style={{ flex: 1 }} />
        <div className="mobile-only" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Quick add always visible on mobile */}
          <button
            onClick={onQuickAdd}
            aria-label="Log a film"
            style={{
              width: 32, height: 32, borderRadius: 8,
              border: 'none', background: '#f59e0b', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Plus size={15} color="#000" strokeWidth={2.5} />
          </button>
          <button
            onClick={() => setMenuOpen(o => !o)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            style={{ width: 34, height: 34, borderRadius: 8, border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888' }}
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* ── Mobile dropdown ── */}
      {menuOpen && (
        <div
          ref={menuRef}
          className="animate-slide-down"
          style={{
            position: 'absolute', top: NAV_H, left: 0, right: 0,
            background: 'rgba(10,10,10,0.98)', backdropFilter: 'blur(12px)',
            borderBottom: '1px solid #1a1a1a', padding: '10px 0 16px', zIndex: 200,
          }}
        >
          {visibleTabs.map(tab => {
            const active = activeTab === tab.key;
            return (
              <button key={tab.key} onClick={() => go(tab.key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                  padding: '13px 24px', background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 15, fontWeight: tab.special ? 600 : 500, fontFamily: 'inherit',
                  color: active ? '#fbbf24' : tab.special ? '#f59e0b' : '#ccc',
                  borderLeft: active ? '3px solid #f59e0b' : '3px solid transparent',
                  textAlign: 'left',
                }}
              >
                {tab.icon}
                {tab.label}
              </button>
            );
          })}

          <button onClick={() => { onPro?.(); setMenuOpen(false); }}
            style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '13px 24px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, fontFamily: 'inherit', color: '#f59e0b', fontWeight: 700, borderLeft: '3px solid transparent', textAlign: 'left' }}>
            <Crown size={15} /> Qued Pro
          </button>

          <button onClick={() => go('search')}
            style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '13px 24px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, fontFamily: 'inherit', color: activeTab === 'search' ? '#fbbf24' : '#ccc', borderLeft: activeTab === 'search' ? '3px solid #f59e0b' : '3px solid transparent', textAlign: 'left' }}>
            <Search size={15} /> Search
          </button>

          {isAdmin && (
            <button onClick={() => { onAdmin?.(); setMenuOpen(false); }}
              style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '13px 24px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, fontFamily: 'inherit', color: '#f87171', borderLeft: '3px solid transparent', textAlign: 'left' }}>
              <ShieldCheck size={15} /> Admin Dashboard
            </button>
          )}

          <div style={{ height: 1, background: '#1a1a1a', margin: '8px 0' }} />

          {isLoggedIn ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 24px 8px', color: '#777', fontSize: 12, fontWeight: 700 }}>
                <span style={{ width: 28, height: 28, borderRadius: '50%', overflow: 'hidden', background: '#2e2e2e', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {avatarUrl
                    ? <img src={avatarUrl} alt={username} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <span style={{ fontSize: 12, fontWeight: 700, color: '#fbbf24' }}>{username?.[0]?.toUpperCase() ?? '?'}</span>}
                </span>
                {username}
              </div>
              <button onClick={() => profileAction(onMyProfile)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '13px 24px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, fontFamily: 'inherit', color: '#ccc', borderLeft: '3px solid transparent', textAlign: 'left' }}>
                <User size={15} /> My Profile
              </button>
              <button onClick={() => profileAction(onSettings)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '13px 24px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, fontFamily: 'inherit', color: '#ccc', borderLeft: '3px solid transparent', textAlign: 'left' }}>
                <Settings size={15} /> Settings
              </button>
              <button onClick={() => profileAction(onSignOut)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '13px 24px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, fontFamily: 'inherit', color: '#f87171', borderLeft: '3px solid transparent', textAlign: 'left' }}>
                <LogOut size={15} /> Sign out
              </button>
            </>
          ) : (
            <div style={{ display: 'flex', gap: 10, padding: '8px 24px 0' }}>
              <button onClick={() => { onSignIn(); setMenuOpen(false); }} className="btn-ghost" style={{ flex: 1, fontSize: 14, padding: '10px', borderRadius: 10 }}>{t('nav_sign_in')}</button>
              <button onClick={() => { onSignUp(); setMenuOpen(false); }} className="btn-gold"  style={{ flex: 1, fontSize: 14, padding: '10px', borderRadius: 10 }}>{t('nav_sign_up')}</button>
            </div>
          )}
        </div>
      )}
    </nav>
  );
}

function ProfileMenuItem({ icon, label, onClick, danger = false }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        padding: '10px 11px',
        borderRadius: 8,
        border: 'none',
        background: 'none',
        color: danger ? '#f87171' : '#d4d4d8',
        cursor: 'pointer',
        fontSize: 13,
        fontWeight: 600,
        fontFamily: 'inherit',
        textAlign: 'left',
        transition: 'background .15s, color .15s',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = danger ? 'rgba(239,68,68,.1)' : '#181818';
        e.currentTarget.style.color = danger ? '#fca5a5' : '#fff';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'none';
        e.currentTarget.style.color = danger ? '#f87171' : '#d4d4d8';
      }}
    >
      {icon}
      {label}
    </button>
  );
}
