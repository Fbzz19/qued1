import { useState, useEffect, useCallback, useRef } from 'react';
import { Clapperboard } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { I18nProvider } from './context/I18nContext';
import HomePage from './pages/HomePage';
import SearchPage from './pages/SearchPage';
import MediaDetailPage from './pages/MediaDetailPage';
import ActorPage from './pages/ActorPage';
import ProfilePage from './pages/ProfilePage';
import AIComingSoonPage from './pages/AIComingSoonPage';
import ActivityFeedPage from './pages/ActivityFeedPage';
import FilmsPage from './pages/FilmsPage';
import TVShowsPage from './pages/TVShowsPage';
import MembersPage from './pages/MembersPage';
import PublicProfilePage from './pages/PublicProfilePage';
import WatchedPage from './pages/WatchedPage';
import DiaryPage from './pages/DiaryPage';
import SettingsPage from './pages/SettingsPage';
import PrivacyPage from './pages/PrivacyPage';
import TermsPage from './pages/TermsPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import FranchisePage from './pages/FranchisePage';
import WatchOrderPage from './pages/WatchOrderPage';
import AdminPage from './pages/AdminPage';
import ProPage from './pages/ProPage';
import LeaderboardsPage from './pages/LeaderboardsPage';
import StatsPage from './pages/StatsPage';
import TopNav from './components/TopNav';
import type { NavTab } from './components/TopNav';
import BottomNav from './components/BottomNav';
import QuickAddModal from './components/QuickAddModal';
import type { QuickAddMedia } from './components/QuickAddModal';
import AuthModal from './components/AuthModal';
import CookieBanner from './components/CookieBanner';
import Footer from './components/Footer';
import OnboardingFlow from './components/OnboardingFlow';
import { supabase } from './lib/supabase';

type Screen =
  | { kind: 'tab';      tab: NavTab }
  | { kind: 'media';    id: number; mediaType: 'movie' | 'tv'; from: NavTab }
  | { kind: 'actor';    id: number; from: NavTab }
  | { kind: 'member';   userId: string; from: NavTab }
  | { kind: 'profile' }
  | { kind: 'watched';  userId: string; username?: string }
  | { kind: 'diary';    userId: string; username?: string }
  | { kind: 'settings' }
  | { kind: 'privacy' }
  | { kind: 'terms' }
  | { kind: 'reset-password' }
  | { kind: 'franchise'; franchiseId: string; from: NavTab }
  | { kind: 'admin' }
  | { kind: 'pro' }
  | { kind: 'leaderboards' }
  | { kind: 'stats' };

// ── Login Transition Overlay ──────────────────────────────────────────────────
// Steps: 0-400ms fade to black → 400-900ms logo fades in + pulse → 900-1200ms welcome text
// → 1800ms hold → 2100-2400ms fade out → 2400-3000ms homepage fades in via CSS on content
function LoginTransition({ anim, username }: { anim: 'idle' | 'playing' | 'done'; username?: string }) {
  const [step, setStep] = useState<'black' | 'logo' | 'text' | 'fadeout'>('black');

  useEffect(() => {
    if (anim !== 'playing') { setStep('black'); return; }
    // Step 1: start fully black immediately
    setStep('black');
    const t1 = setTimeout(() => setStep('logo'),    400);   // logo in at 400ms
    const t2 = setTimeout(() => setStep('text'),    900);   // text in at 900ms
    const t3 = setTimeout(() => setStep('fadeout'), 2100);  // fade out at 2100ms
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [anim]);

  if (anim === 'idle' || anim === 'done') return null;

  const opacity = step === 'fadeout' ? 0 : 1;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: '#000',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 20,
      opacity,
      transition: step === 'fadeout' ? 'opacity 0.5s ease-in' : 'opacity 0.4s ease-in',
      pointerEvents: anim === 'playing' ? 'all' : 'none',
    }}>
      {/* Logo */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        opacity: step === 'black' ? 0 : 1,
        transition: 'opacity 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
        animation: step === 'logo' || step === 'text' ? 'loginLogoPulse 1.2s ease-out' : 'none',
      }}>
        <div style={{ position: 'relative' }}>
          <Clapperboard size={40} color="#f59e0b" />
          <div style={{
            position: 'absolute', inset: -8, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(245,158,11,0.25) 0%, transparent 70%)',
            animation: step === 'logo' || step === 'text' ? 'loginGoldGlow 1.2s ease-out' : 'none',
          }} />
        </div>
        <span style={{
          fontSize: 36, fontWeight: 800, color: '#fff',
          letterSpacing: '-1px', fontFamily: 'Inter, system-ui, sans-serif',
        }}>
          Qu<span style={{ color: '#f59e0b' }}>e</span>d
        </span>
      </div>
      {/* Welcome text */}
      <div style={{
        textAlign: 'center',
        opacity: step === 'text' || step === 'fadeout' ? 1 : 0,
        transform: step === 'text' || step === 'fadeout' ? 'translateY(0)' : 'translateY(8px)',
        transition: 'opacity 0.4s ease-out, transform 0.4s ease-out',
        letterSpacing: step === 'text' || step === 'fadeout' ? '0em' : '0.06em',
      }}>
        <p style={{ margin: 0, fontSize: 18, color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', fontWeight: 400 }}>
          Welcome back,{' '}
          <span style={{ color: '#f59e0b', fontWeight: 700 }}>{username ?? 'there'}</span>
        </p>
      </div>
    </div>
  );
}

function AppContent() {
  const { user, profile, loading } = useAuth();
  const [screen,        setScreen]        = useState<Screen>({ kind: 'tab', tab: 'home' });
  const [quickAddOpen,  setQuickAddOpen]  = useState(false);
  const [quickAddMedia, setQuickAddMedia] = useState<QuickAddMedia | null>(null);
  const [authModal,     setAuthModal]     = useState<{ mode: 'login' | 'signup'; reason?: string } | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  // Login transition animation: idle → playing → done
  const [loginAnim, setLoginAnim] = useState<'idle' | 'playing' | 'done'>('idle');
  const prevUserRef = useRef<string | null>(null);

  // On mount: handle recovery token or push initial history entry
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes('type=recovery') || window.location.search.includes('reset=true')) {
      const s: Screen = { kind: 'reset-password' };
      window.history.replaceState({ screen: s }, '', window.location.pathname);
      setScreen(s);
      return;
    }
    // Push initial state so popstate works from first page
    window.history.replaceState({ screen: { kind: 'tab', tab: 'home' } }, '', window.location.pathname);
  }, []);

  // Listen for browser back/forward
  useEffect(() => {
    function onPopState(e: PopStateEvent) {
      const s = e.state?.screen as Screen | undefined;
      if (s) {
        setScreen(s);
      } else {
        setScreen({ kind: 'tab', tab: 'home' });
      }
    }
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Login transition: detect transition from logged-out → logged-in
  useEffect(() => {
    if (loading) return;
    const prevId = prevUserRef.current;
    const currId = user?.id ?? null;
    if (prevId === null && currId !== null) {
      // Just logged in — play animation (total ~3s)
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        setLoginAnim('playing');
        setTimeout(() => setLoginAnim('done'), 3000);
      }
    }
    prevUserRef.current = currId;
  }, [user, loading]);

  // Check if new user needs onboarding
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from('onboarding_completed').select('user_id').eq('user_id', user.id).maybeSingle();
      if (!data) setShowOnboarding(true);
    })();
  }, [user]);

  // On sign-out: redirect to home and clear protected screens
  useEffect(() => {
    if (!user && !loading) {
      const protectedKinds: Screen['kind'][] = ['profile', 'settings', 'watched', 'diary'];
      setScreen(s => {
        if (protectedKinds.includes(s.kind)) {
          const home: Screen = { kind: 'tab', tab: 'home' };
          window.history.replaceState({ screen: home }, '');
          return home;
        }
        return s;
      });
      setQuickAddOpen(false);
      setQuickAddMedia(null);
    }
  }, [user, loading]);

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      switch (e.key) {
        case 's': case 'S':
          e.preventDefault();
          setScreen(_s => { const next: Screen = { kind: 'tab', tab: 'search' }; window.history.pushState({ screen: next }, ''); return next; });
          break;
        case 'n': case 'N':
          break; // notifications panel — handled by NotificationPanel itself
        case 'l': case 'L':
          if (user) { setQuickAddOpen(true); }
          break;
        case 'Escape':
          setQuickAddOpen(false);
          setAuthModal(null);
          setShortcutsOpen(false);
          break;
        case '?':
          setShortcutsOpen(o => !o);
          break;
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [user]);

  const navigate = useCallback((next: Screen) => {
    window.history.pushState({ screen: next }, '');
    setScreen(next);
  }, []);

  const goBack = useCallback(() => {
    window.history.back();
  }, []);

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ display: 'flex', gap: 8 }}>
        {[0, 150, 300].map(d => (
          <div key={d} style={{ width: 8, height: 8, background: '#f59e0b', borderRadius: '50%', animation: `bounceDot 1.4s ${d}ms infinite` }} />
        ))}
      </div>
    </div>
  );

  const activeTab: NavTab = screen.kind === 'tab' ? screen.tab
    : screen.kind === 'profile' || screen.kind === 'settings' ? 'home'
    : screen.kind === 'watched' || screen.kind === 'diary' ? 'home'
    : screen.kind === 'privacy' || screen.kind === 'terms' || screen.kind === 'reset-password' ? 'home'
    : screen.kind === 'franchise' ? 'watchorder'
    : screen.kind === 'admin' || screen.kind === 'pro' || screen.kind === 'leaderboards' || screen.kind === 'stats' ? 'home'
    : 'from' in screen ? screen.from : 'home';

  function goTab(tab: NavTab) {
    const s: Screen = { kind: 'tab', tab };
    window.history.pushState({ screen: s }, '');
    setScreen(s);
  }

  function goMedia(id: number, mediaType: 'movie' | 'tv') {
    navigate({ kind: 'media', id, mediaType, from: activeTab });
  }
  function goActor(id: number) {
    navigate({ kind: 'actor', id, from: activeTab });
  }
  function openQuickAdd(media?: QuickAddMedia) {
    if (!user) { setAuthModal({ mode: 'login', reason: 'Sign in to log films to your diary.' }); return; }
    setQuickAddMedia(media ?? null);
    setQuickAddOpen(true);
  }
  function requireAuth(action: () => void, reason?: string) {
    if (!user) { setAuthModal({ mode: 'login', reason }); return; }
    action();
  }
  function goMyProfile() {
    if (!user) { setAuthModal({ mode: 'login', reason: 'Sign in to view your profile.' }); return; }
    navigate({ kind: 'profile' });
  }
  function goMyWatched() {
    if (!user) return;
    navigate({ kind: 'watched', userId: user.id, username: profile?.username });
  }
  function goMyDiary() {
    if (!user) return;
    navigate({ kind: 'diary', userId: user.id, username: profile?.username });
  }
  function goMemberWatched(userId: string, username: string) {
    navigate({ kind: 'watched', userId, username });
  }
  function goMemberDiary(userId: string, username: string) {
    navigate({ kind: 'diary', userId, username });
  }
  function goFranchise(franchiseId: string) {
    navigate({ kind: 'franchise', franchiseId, from: activeTab });
  }
  function goAdmin() {
    if (profile?.role !== 'admin') return;
    navigate({ kind: 'admin' });
  }
  function goPro() {
    navigate({ kind: 'pro' });
  }
  function goLeaderboards() {
    navigate({ kind: 'leaderboards' });
  }
  function goStats() {
    navigate({ kind: 'stats' });
  }
  function handleNotificationNavigate(type: string, _refId: string | null) {
    if (type === 'follow' || type === 'review_like' || type === 'review_comment') navigate({ kind: 'profile' });
    else navigate({ kind: 'tab', tab: 'feed' });
  }

  const showFooter = screen.kind === 'tab' || screen.kind === 'privacy' || screen.kind === 'terms';

  return (
    <div style={{ minHeight: '100vh', background: '#000' }}>
      <TopNav
        activeTab={activeTab}
        onTabChange={goTab}
        onSignIn={() => setAuthModal({ mode: 'login' })}
        onSignUp={() => setAuthModal({ mode: 'signup' })}
        onMyProfile={goMyProfile}
        isLoggedIn={!!user}
        username={profile?.username}
        avatarUrl={profile?.avatar_url}
        isAdmin={profile?.role === 'admin'}
        onAdmin={goAdmin}
        onPro={goPro}
        onQuickAdd={() => openQuickAdd()}
        onNotificationNavigate={handleNotificationNavigate}
      />

      <main style={{ paddingTop: 56 }}>
        {screen.kind === 'tab' && screen.tab === 'home'    && <HomePage    onMediaClick={goMedia} onSignUp={() => setAuthModal({ mode: 'signup' })} onFilmsClick={() => goTab('films')} onSearchClick={() => goTab('search')} onMembersClick={() => goTab('members')} onMemberProfileClick={userId => navigate({ kind: 'member', userId, from: 'home' })} />}
        {screen.kind === 'tab' && screen.tab === 'films'   && <FilmsPage   onMediaClick={goMedia} />}
        {screen.kind === 'tab' && screen.tab === 'tv'      && <TVShowsPage onMediaClick={goMedia} />}
        {screen.kind === 'tab' && screen.tab === 'members' && <MembersPage onMemberClick={userId => navigate({ kind: 'member', userId, from: activeTab })} />}
        {screen.kind === 'tab' && screen.tab === 'search'  && <SearchPage  onMediaClick={goMedia} />}
        {screen.kind === 'tab' && screen.tab === 'ai'         && <AIComingSoonPage />}
        {screen.kind === 'tab' && screen.tab === 'watchorder' && (
          <WatchOrderPage
            onFranchiseClick={goFranchise}
            onSignUp={() => setAuthModal({ mode: 'signup' })}
          />
        )}
        {screen.kind === 'tab' && screen.tab === 'feed'    && (
          <ActivityFeedPage
            onMediaClick={goMedia}
            onMemberClick={userId => navigate({ kind: 'member', userId, from: 'feed' })}
            onSignIn={() => setAuthModal({ mode: 'login' })}
            onSignUp={() => setAuthModal({ mode: 'signup' })}
          />
        )}

        {screen.kind === 'profile' && (
          <ProfilePage
            onMediaClick={goMedia}
            onWatchedClick={goMyWatched}
            onDiaryClick={goMyDiary}
            onMemberClick={userId => navigate({ kind: 'member', userId, from: activeTab })}
            onSettingsClick={() => navigate({ kind: 'settings' })}
            onStatsClick={goStats}
            onLeaderboardsClick={goLeaderboards}
            onProClick={goPro}
          />
        )}

        {screen.kind === 'settings'        && <SettingsPage        onBack={goBack} />}
        {screen.kind === 'privacy'         && <PrivacyPage         onBack={goBack} />}
        {screen.kind === 'terms'           && <TermsPage           onBack={goBack} />}
        {screen.kind === 'reset-password'  && <ResetPasswordPage   onDone={() => goTab('home')} />}
        {screen.kind === 'franchise' && (
          <FranchisePage
            franchiseId={screen.franchiseId}
            onBack={goBack}
            onMediaClick={goMedia}
          />
        )}

        {screen.kind === 'watched' && (
          <WatchedPage
            userId={screen.userId}
            username={screen.username}
            onBack={goBack}
            onMediaClick={goMedia}
          />
        )}

        {screen.kind === 'diary' && (
          <DiaryPage
            userId={screen.userId}
            username={screen.username}
            onBack={goBack}
            onMediaClick={goMedia}
          />
        )}

        {screen.kind === 'media' && (
          <MediaDetailPage
            id={screen.id}
            type={screen.mediaType}
            onBack={goBack}
            onActorClick={goActor}
            onQuickAdd={openQuickAdd}
            requireAuth={(reason) => requireAuth(() => {}, reason)}
          />
        )}
        {screen.kind === 'actor' && (
          <ActorPage id={screen.id} onBack={goBack} onMediaClick={goMedia} />
        )}
        {screen.kind === 'member' && (
          <PublicProfilePage
            userId={screen.userId}
            onBack={goBack}
            onMediaClick={goMedia}
            onWatchedClick={goMemberWatched}
            onDiaryClick={goMemberDiary}
          />
        )}
        {screen.kind === 'admin' && (
          <AdminPage onBack={goBack} onMediaClick={goMedia} />
        )}
        {screen.kind === 'pro' && (
          <ProPage onBack={goBack} onUpgrade={() => {}} />
        )}
        {screen.kind === 'leaderboards' && (
          <LeaderboardsPage
            onBack={goBack}
            onMemberClick={userId => navigate({ kind: 'member', userId, from: activeTab })}
          />
        )}
        {screen.kind === 'stats' && (
          <StatsPage onBack={goBack} onProClick={goPro} />
        )}

        {showFooter && (
          <Footer
            onPrivacyClick={() => navigate({ kind: 'privacy' })}
            onTermsClick={() => navigate({ kind: 'terms' })}
            onProClick={goPro}
            onLeaderboardsClick={goLeaderboards}
          />
        )}
      </main>

      <BottomNav
        activeTab={activeTab}
        onTabChange={goTab}
        onQuickAdd={() => openQuickAdd()}
        onMyProfile={goMyProfile}
      />

      {quickAddOpen && (
        <QuickAddModal
          media={quickAddMedia}
          onClose={() => { setQuickAddOpen(false); setQuickAddMedia(null); }}
        />
      )}

      {authModal && (
        <AuthModal
          defaultMode={authModal.mode}
          reason={authModal.reason}
          onClose={() => setAuthModal(null)}
        />
      )}

      <CookieBanner />

      {showOnboarding && user && (
        <OnboardingFlow onComplete={() => setShowOnboarding(false)} />
      )}

      <LoginTransition anim={loginAnim} username={profile?.username} />

      {shortcutsOpen && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,.8)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={() => setShortcutsOpen(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="animate-slide-up"
            style={{ background: '#111', border: '1px solid #242424', borderRadius: 20, padding: 32, width: '100%', maxWidth: 420 }}
          >
            <h2 style={{ color: '#fff', fontSize: 18, fontWeight: 700, margin: '0 0 24px' }}>Keyboard Shortcuts</h2>
            {[
              { key: 'S', desc: 'Go to Search' },
              { key: 'L', desc: 'Log a film' },
              { key: 'Esc', desc: 'Close modals' },
              { key: '?', desc: 'Show/hide shortcuts' },
            ].map(s => (
              <div key={s.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #1a1a1a' }}>
                <span style={{ color: '#888', fontSize: 14 }}>{s.desc}</span>
                <kbd style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: 6, padding: '3px 10px', color: '#fbbf24', fontSize: 12, fontFamily: 'monospace', fontWeight: 700 }}>{s.key}</kbd>
              </div>
            ))}
            <button onClick={() => setShortcutsOpen(false)} style={{ marginTop: 24, width: '100%', padding: '11px', borderRadius: 12, background: '#1a1a1a', border: '1px solid #2e2e2e', color: '#888', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <I18nProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </I18nProvider>
  );
}
