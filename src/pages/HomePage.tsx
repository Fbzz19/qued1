import { useEffect, useRef, useState } from 'react';
import { Film, TrendingUp, Tv, Star, Clock, Users, Sparkles, ChevronLeft, ChevronRight, Clapperboard, Zap, ShieldCheck, Trophy, Brain, ChevronDown } from 'lucide-react';
import { tmdb, posterUrl, backdropUrl } from '../lib/tmdb';
import type { TMDBMedia } from '../lib/tmdb';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/I18nContext';
import LoggedInHomePage from './LoggedInHomePage';

interface HomePageProps {
  onMediaClick: (id: number, type: 'movie' | 'tv') => void;
  onSignUp?: () => void;
  onFilmsClick?: () => void;
  onSearchClick?: () => void;
  onMembersClick?: () => void;
  onMemberProfileClick?: (userId: string) => void;
}

const FEATURES = [
  { icon: <Film size={22} color="#f59e0b" />, title: 'Track Films & Shows', desc: 'Log everything you watch and build your personal collection.' },
  { icon: <Star size={22} color="#f59e0b" />, title: 'Rate & Review', desc: 'Share your thoughts with half-star ratings and in-depth reviews.' },
  { icon: <Clock size={22} color="#f59e0b" />, title: 'Track Watch Time', desc: 'See exactly how many hours you have spent watching.' },
  { icon: <Users size={22} color="#f59e0b" />, title: 'Join the Community', desc: 'Follow your favourite reviewers and see what they are watching.' },
];

function dedupe(items: TMDBMedia[]): TMDBMedia[] {
  const seen = new Set<number>();
  return items.filter(i => {
    if (seen.has(i.id)) return false;
    seen.add(i.id);
    return true;
  });
}

export default function HomePage({ onMediaClick, onSignUp, onFilmsClick, onSearchClick, onMembersClick, onMemberProfileClick }: HomePageProps) {
  const { user } = useAuth();
  const { t } = useI18n();

  // Logged-in users see the personalised homepage
  if (user) {
    return (
      <LoggedInHomePage
        onMediaClick={onMediaClick}
        onMembersClick={onMembersClick ?? (() => {})}
        onFilmsClick={onSearchClick ?? onFilmsClick ?? onSignUp ?? (() => {})}
        onMemberProfileClick={onMemberProfileClick ?? (() => {})}
      />
    );
  }
  const [heroItem,    setHeroItem]    = useState<TMDBMedia | null>(null);
  const [trendFilms,  setTrendFilms]  = useState<TMDBMedia[]>([]);
  const [trendTV,     setTrendTV]     = useState<TMDBMedia[]>([]);
  const [topMovies,   setTopMovies]   = useState<TMDBMedia[]>([]);
  const [anticipated, setAnticipated] = useState<TMDBMedia[]>([]);
  const [nowPlaying,      setNowPlaying]      = useState<TMDBMedia[]>([]);
  const [staffPicks,      setStaffPicks]      = useState<TMDBMedia[]>([]);
  const [fotw,            setFotw]            = useState<TMDBMedia | null>(null);
  const [popularThisWeek, setPopularThisWeek] = useState<{ tmdb_id: number; media_type: string; title: string; poster_path: string; count: number }[]>([]);
  const [userCount,       setUserCount]       = useState<number | null>(null);
  const [loading,         setLoading]         = useState(true);

  useEffect(() => {
    Promise.all([
      tmdb.trendingMovies('1'),
      tmdb.trendingMovies('2'),
      tmdb.trendingMovies('3'),
      tmdb.trendingTV('1'),
      tmdb.trendingTV('2'),
      tmdb.trendingTV('3'),
      tmdb.topRated('movie', '1'),
      tmdb.topRated('movie', '2'),
      tmdb.topRated('movie', '3'),
      tmdb.upcomingMovies('1'),
      tmdb.upcomingMovies('2'),
      tmdb.upcomingMovies('3'),
    ]).then(([mP1, mP2, mP3, tvP1, tvP2, tvP3, trP1, trP2, trP3, upP1, upP2, upP3]) => {
      const films = dedupe(
        [...mP1.results, ...mP2.results, ...mP3.results]
          .map(i => ({ ...i, media_type: 'movie' as const }))
      ).slice(0, 50);

      const tv = dedupe(
        [...tvP1.results, ...tvP2.results, ...tvP3.results]
          .map(i => ({ ...i, media_type: 'tv' as const }))
      ).slice(0, 50);

      const top = dedupe(
        [...trP1.results, ...trP2.results, ...trP3.results]
          .map(i => ({ ...i, media_type: 'movie' as const }))
      ).slice(0, 50);

      const today = new Date().toISOString().slice(0, 10);
      const upcoming = dedupe(
        [...upP1.results, ...upP2.results, ...upP3.results]
          .filter(i => (i.release_date ?? '') > today)
          .map(i => ({ ...i, media_type: 'movie' as const }))
      ).slice(0, 50);

      setTrendFilms(films);
      setTrendTV(tv);
      setTopMovies(top);
      setAnticipated(upcoming);
      const hero = films.find(i => i.backdrop_path);
      setHeroItem(hero ?? null);
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });

    // Now playing in cinemas
    tmdb.nowPlaying('1').then(r => setNowPlaying(
      r.results.slice(0, 20).map(i => ({ ...i, media_type: 'movie' as const }))
    )).catch(() => {});

    // Staff Picks from Supabase
    supabase.from('staff_picks').select('tmdb_id, media_type, title, poster_path').eq('active', true).limit(20)
      .then(({ data }) => {
        if (!data) return;
        setStaffPicks(data.map(p => ({
          id: p.tmdb_id, title: p.title, media_type: p.media_type,
          poster_path: p.poster_path, backdrop_path: null, overview: '',
          vote_average: 0, vote_count: 0,
        } as TMDBMedia)));
      });

    // Film of the Week — top voted nomination
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekStr = weekStart.toISOString().slice(0, 10);
    supabase.from('film_nominations').select('tmdb_id, media_type, title, poster_path').eq('week_start', weekStr)
      .order('vote_count', { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setFotw({
          id: data.tmdb_id, title: data.title, media_type: data.media_type,
          poster_path: data.poster_path, backdrop_path: null, overview: '',
          vote_average: 0, vote_count: 0,
        } as TMDBMedia);
      });

    // Popular this week among Qued users
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    supabase.from('watched').select('tmdb_id, media_type, title, poster_path').gte('created_at', weekAgo)
      .then(({ data }) => {
        if (!data) return;
        const counts: Record<number, { media_type: string; title: string; poster_path: string; count: number }> = {};
        for (const w of data) {
          if (!counts[w.tmdb_id]) counts[w.tmdb_id] = { media_type: w.media_type, title: w.title, poster_path: w.poster_path, count: 0 };
          counts[w.tmdb_id].count++;
        }
        const popular = Object.entries(counts)
          .map(([id, v]) => ({ tmdb_id: Number(id), ...v }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 20);
        setPopularThisWeek(popular);
      });

    // Total user count
    supabase.from('profiles').select('id', { count: 'exact', head: true })
      .then(({ count }) => { if (count != null) setUserCount(count); });
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: '#000', paddingBottom: 96 }} className="animate-fade-in">

      {/* Hero */}
      <div id="home">
        <HeroBanner
          item={heroItem}
          isLoggedIn={!!user}
          onSignUp={onSignUp}
          userCount={userCount}
        />
      </div>

      {/* Features bar */}
      <div style={{ background: '#0a0a0a', borderTop: '1px solid #1a1a1a', borderBottom: '1px solid #1a1a1a', padding: 'clamp(20px,4vw,40px) clamp(16px,4vw,80px)' }}>
        <div style={{ maxWidth: 1300, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20 }}>
          {FEATURES.map((f, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(245,158,11,.1)', border: '1px solid rgba(245,158,11,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {f.icon}
              </div>
              <div>
                <p style={{ margin: '0 0 3px', color: '#fff', fontSize: 13, fontWeight: 600 }}>{f.title}</p>
                <p style={{ margin: 0, color: '#888', fontSize: 12, lineHeight: 1.5 }}>{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Explore QuedAI scroll button */}
      <div style={{ display: 'flex', justifyContent: 'center', padding: '30px 16px 34px', background: '#0a0a0a', borderBottom: '1px solid #1a1a1a' }}>
        <ScrollPillButton label="Explore QuedAI" targetId="quedai" featured icon="ai" />
      </div>

      {/* QuedAI Feature Section */}
      <div id="quedai" style={{ background: 'linear-gradient(135deg, #0a0a0a 0%, #111 50%, #0a0a0a 100%)', borderTop: '1px solid #1a1a1a', borderBottom: '1px solid #1a1a1a', padding: 'clamp(40px,6vw,80px) clamp(20px,4vw,80px)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 48, alignItems: 'center' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(245,158,11,.12)', border: '1px solid rgba(245,158,11,.3)', borderRadius: 100, padding: '5px 14px', marginBottom: 20 }}>
              <Sparkles size={13} color="#f59e0b" />
              <span style={{ color: '#f59e0b', fontSize: 12, fontWeight: 700 }}>QuedAI</span>
            </div>
            <h2 style={{ margin: '0 0 16px', color: '#fff', fontSize: 'clamp(22px,3.5vw,38px)', fontWeight: 800, lineHeight: 1.15, letterSpacing: '-0.5px' }}>
              Describe your mood.<br />Get the perfect film.
            </h2>
            <p style={{ margin: '0 0 20px', color: '#666', fontSize: 15, lineHeight: 1.7 }}>
              QuedAI finds exactly what you want to watch — whether you are in the mood for "a slow burn thriller set in Japan" or "something funny but not too stupid". Just describe it and let AI do the rest.
            </p>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {[
                { label: 'Mood-based search', sub: 'Describe how you feel' },
                { label: 'Instant results', sub: 'AI understands context' },
                { label: 'Members only', sub: '3 free searches/day' },
              ].map(f => (
                <div key={f.label}>
                  <p style={{ margin: '0 0 2px', color: '#fff', fontSize: 13, fontWeight: 600 }}>{f.label}</p>
                  <p style={{ margin: 0, color: '#555', fontSize: 12 }}>{f.sub}</p>
                </div>
              ))}
            </div>
          </div>
          <div style={{ background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 20, padding: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(245,158,11,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Brain size={18} color="#f59e0b" />
              </div>
              <div>
                <p style={{ margin: 0, color: '#fff', fontSize: 13, fontWeight: 700 }}>QuedAI Recommender</p>
                <p style={{ margin: 0, color: '#555', fontSize: 11 }}>Coming soon for members</p>
              </div>
            </div>
            {[
              '"A psychological thriller with an unreliable narrator"',
              '"Comfort film, something warm and funny for a Sunday"',
              '"Like Blade Runner but more emotional"',
            ].map((ex, i) => (
              <div key={i} style={{ padding: '10px 14px', background: '#111', border: '1px solid #1a1a1a', borderRadius: 10, marginBottom: 8 }}>
                <p style={{ margin: 0, color: '#666', fontSize: 12, fontStyle: 'italic' }}>{ex}</p>
              </div>
            ))}
            <div style={{ marginTop: 16, padding: '10px 14px', background: 'rgba(245,158,11,.06)', border: '1px solid rgba(245,158,11,.2)', borderRadius: 10 }}>
              <p style={{ margin: 0, color: '#888', fontSize: 12 }}>Sign up to unlock <span style={{ color: '#fbbf24', fontWeight: 600 }}>3 free AI searches per day</span></p>
            </div>
          </div>
        </div>
      </div>

      {/* See Trending scroll button */}
      <div style={{ display: 'flex', justifyContent: 'center', padding: '28px 16px', background: 'linear-gradient(135deg, #0a0a0a 0%, #111 50%, #0a0a0a 100%)' }}>
        <ScrollPillButton label="See Trending This Week" targetId="trending" featured icon="trending" />
      </div>

      {/* Sections */}
      <div id="trending" style={{ maxWidth: 1400, margin: '0 auto', padding: '40px clamp(16px,4vw,48px) 0' }}>
        <PosterSection
          title={t('home_trending_films')}
          icon={<TrendingUp size={18} color="#f59e0b" />}
          items={trendFilms}
          loading={loading}
          onMediaClick={onMediaClick}
          mediaTypeOverride="movie"
          showRanks
          viewMoreLabel={t('btn_view_more')}
          showLessLabel={t('btn_show_less')}
        />

        <div style={{ marginTop: 48 }}>
          <PosterSection
            title={t('home_trending_tv')}
            icon={<Tv size={18} color="#f59e0b" />}
            items={trendTV}
            loading={loading}
            onMediaClick={onMediaClick}
            mediaTypeOverride="tv"
            showRanks
            viewMoreLabel={t('btn_view_more')}
            showLessLabel={t('btn_show_less')}
          />
        </div>

        <div style={{ marginTop: 48 }}>
          <PosterSection
            title={t('home_top_rated')}
            icon={<Star size={18} color="#f59e0b" />}
            items={topMovies}
            loading={loading}
            onMediaClick={onMediaClick}
            mediaTypeOverride="movie"
            showRanks
            viewMoreLabel={t('btn_view_more')}
            showLessLabel={t('btn_show_less')}
          />
        </div>

        <div style={{ marginTop: 48 }}>
          <PosterSection
            title={t('home_anticipated')}
            icon={<Clapperboard size={18} color="#f59e0b" />}
            items={anticipated}
            loading={loading}
            onMediaClick={onMediaClick}
            mediaTypeOverride="movie"
            showRanks
            viewMoreLabel={t('btn_view_more')}
            showLessLabel={t('btn_show_less')}
          />
        </div>

        {/* New Releases in Cinemas */}
        {nowPlaying.length > 0 && (
          <div style={{ marginTop: 48 }}>
            <PosterSection
              title="New in Cinemas"
              icon={<Zap size={18} color="#f59e0b" />}
              items={nowPlaying}
              loading={false}
              onMediaClick={onMediaClick}
              mediaTypeOverride="movie"
              viewMoreLabel="View more"
              showLessLabel="Show less"
            />
          </div>
        )}

        {/* Staff Picks */}
        {staffPicks.length > 0 && (
          <div style={{ marginTop: 48 }}>
            <PosterSection
              title="Staff Picks"
              icon={<ShieldCheck size={18} color="#f59e0b" />}
              items={staffPicks}
              loading={false}
              onMediaClick={onMediaClick}
              viewMoreLabel="View more"
              showLessLabel="Show less"
            />
          </div>
        )}

        {/* Popular This Week on Qued */}
        {popularThisWeek.length > 0 && (
          <div style={{ marginTop: 48 }}>
            <PosterSection
              title="Popular This Week on Qued"
              icon={<TrendingUp size={18} color="#f59e0b" />}
              items={popularThisWeek.map(p => ({
                id: p.tmdb_id, title: p.title, media_type: p.media_type,
                poster_path: p.poster_path, backdrop_path: null, overview: '',
                vote_average: 0, vote_count: p.count,
              } as TMDBMedia))}
              loading={false}
              onMediaClick={onMediaClick}
              viewMoreLabel="View more"
              showLessLabel="Show less"
            />
          </div>
        )}

        {/* Film of the Week */}
        {fotw && (
          <div style={{ marginTop: 48, marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <Trophy size={18} color="#f59e0b" />
              <h2 style={{ margin: 0, color: '#fff', fontSize: 17, fontWeight: 700 }}>Film of the Week</h2>
              <span style={{ color: '#555', fontSize: 12 }}>Community voted</span>
            </div>
            <div
              onClick={() => onMediaClick(fotw.id, (fotw.media_type as 'movie' | 'tv') ?? 'movie')}
              style={{ display: 'flex', gap: 16, alignItems: 'center', padding: 16, background: 'rgba(245,158,11,.06)', border: '1px solid rgba(245,158,11,.2)', borderRadius: 16, cursor: 'pointer', transition: 'background .15s' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(245,158,11,.10)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(245,158,11,.06)')}
            >
              {fotw.poster_path && (
                <img src={posterUrl(fotw.poster_path, 'w154') ?? ''} alt={fotw.title} style={{ width: 64, borderRadius: 8, aspectRatio: '2/3', objectFit: 'cover', flexShrink: 0 }} />
              )}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <Trophy size={14} color="#f59e0b" />
                  <span style={{ color: '#f59e0b', fontSize: 12, fontWeight: 700 }}>Film of the Week</span>
                </div>
                <p style={{ margin: 0, color: '#fff', fontSize: 18, fontWeight: 700 }}>{fotw.title}</p>
                <p style={{ margin: '4px 0 0', color: '#888', fontSize: 13 }}>Click to view details</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ScrollPillButton({ label, targetId, featured = false, icon = 'none' }: {
  label: string;
  targetId: string;
  featured?: boolean;
  icon?: 'ai' | 'trending' | 'none';
}) {
  const [hovered, setHovered] = useState(false);

  function scrollTo() {
    const el = document.getElementById(targetId);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <button
      onClick={scrollTo}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'inline-flex',
        flexDirection: featured ? 'row' : 'column',
        alignItems: 'center',
        gap: featured ? 10 : 6,
        padding: featured ? '14px 28px' : '12px 28px 10px',
        background: hovered ? 'rgba(245,158,11,.16)' : featured ? 'rgba(245,158,11,.10)' : 'rgba(245,158,11,.06)',
        border: `1px solid ${hovered ? 'rgba(245,158,11,.62)' : featured ? 'rgba(245,158,11,.38)' : 'rgba(245,158,11,.25)'}`,
        borderRadius: 100,
        cursor: 'pointer',
        fontFamily: 'inherit',
        transition: 'background .25s, border-color .25s, box-shadow .25s, transform .2s',
        boxShadow: hovered ? '0 0 30px rgba(245,158,11,.28)' : featured ? '0 0 22px rgba(245,158,11,.14)' : '0 0 0px rgba(245,158,11,0)',
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
      }}
    >
      {featured && icon === 'ai' && <Sparkles size={16} color="#f59e0b" />}
      {featured && icon === 'trending' && <TrendingUp size={16} color="#f59e0b" />}
      <span style={{ color: '#fbbf24', fontSize: featured ? 14 : 13, fontWeight: featured ? 800 : 600, letterSpacing: '0.02em', whiteSpace: 'nowrap' }}>{label}</span>
      <ChevronDown
        size={featured ? 18 : 16}
        color="#f59e0b"
        style={{ animation: 'chevronBounce 1.6s ease-in-out infinite' }}
      />
    </button>
  );
}

function HeroBanner({ item, isLoggedIn, onSignUp, userCount }: {
  item: TMDBMedia | null;
  isLoggedIn: boolean;
  onSignUp?: () => void;
  userCount: number | null;
}) {
  const backdrop = item?.backdrop_path ? backdropUrl(item.backdrop_path, 'original') : null;
  function scrollToTrending() {
    document.getElementById('trending')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div style={{ position: 'relative', minHeight: 'clamp(520px, 72vh, 700px)', overflow: 'hidden', display: 'flex', alignItems: 'flex-end' }}>
      {backdrop
        ? <img src={backdrop} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} loading="eager" />
        : <div style={{ position: 'absolute', inset: 0, background: '#0a0a0a' }} />}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, #000 0%, rgba(0,0,0,.85) 35%, rgba(0,0,0,.3) 70%, rgba(0,0,0,.15) 100%)' }} />
      <div style={{ position: 'relative', width: '100%', padding: 'clamp(32px,5vw,72px) clamp(20px,4vw,72px) clamp(48px,6vw,80px)', maxWidth: 1400, margin: '0 auto' }}>
        <div style={{ maxWidth: 680 }}>
          <h1 style={{ margin: '0 0 16px', color: '#fff', fontSize: 'clamp(32px,5vw,64px)', fontWeight: 850, letterSpacing: '-1.2px', lineHeight: 1.02 }}>
            Your films, shows, ratings, and watchlist in one cinematic home.
          </h1>
          <p style={{ margin: '0 0 28px', color: 'rgba(255,255,255,0.68)', fontSize: 'clamp(15px,1.8vw,19px)', fontWeight: 400, lineHeight: 1.6, maxWidth: 620 }}>
            Build your diary, follow other film lovers, and let QuedAI help you find the next thing worth watching.
          </p>
          {!isLoggedIn && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <button
                  onClick={() => onSignUp?.()}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '14px 28px', background: '#f59e0b', border: 'none', borderRadius: 14, color: '#000', fontSize: 16, fontWeight: 800, cursor: 'pointer', transition: 'background .2s, transform .15s, box-shadow .2s', fontFamily: 'inherit', boxShadow: '0 0 40px rgba(245,158,11,.5)' }}
                  onMouseEnter={e => { const b = e.currentTarget as HTMLButtonElement; b.style.background = '#fbbf24'; b.style.transform = 'scale(1.03)'; b.style.boxShadow = '0 0 60px rgba(245,158,11,.7)'; }}
                  onMouseLeave={e => { const b = e.currentTarget as HTMLButtonElement; b.style.background = '#f59e0b'; b.style.transform = 'scale(1)'; b.style.boxShadow = '0 0 40px rgba(245,158,11,.5)'; }}
                >
                  <Clapperboard size={18} />
                  Start Tracking Free
                </button>
                <button
                  onClick={scrollToTrending}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '13px 22px', background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.18)', borderRadius: 14, color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', transition: 'background .2s, border-color .2s, transform .15s', fontFamily: 'inherit', backdropFilter: 'blur(12px)' }}
                  onMouseEnter={e => { const b = e.currentTarget as HTMLButtonElement; b.style.background = 'rgba(255,255,255,.14)'; b.style.borderColor = 'rgba(255,255,255,.34)'; b.style.transform = 'translateY(-1px)'; }}
                  onMouseLeave={e => { const b = e.currentTarget as HTMLButtonElement; b.style.background = 'rgba(255,255,255,.08)'; b.style.borderColor = 'rgba(255,255,255,.18)'; b.style.transform = 'translateY(0)'; }}
                >
                  <TrendingUp size={17} />
                  Explore Trending
                </button>
              </div>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', color: 'rgba(255,255,255,.58)', fontSize: 12 }}>
                <span>Diary</span>
                <span>Watchlist</span>
                <span>Reviews</span>
                <span>QuedAI picks</span>
              </div>
              {userCount != null && userCount > 0 && (
                <p style={{ margin: 0, color: 'rgba(255,255,255,.45)', fontSize: 13 }}>
                  Join <strong style={{ color: 'rgba(255,255,255,.7)' }}>{userCount.toLocaleString()}</strong> film lovers already on Qued
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PosterSection({ title, icon, items, loading, onMediaClick, showRanks, mediaTypeOverride, viewMoreLabel = 'View More', showLessLabel = 'Show Less' }: {
  title: string;
  icon?: React.ReactNode;
  items: TMDBMedia[];
  loading: boolean;
  onMediaClick: (id: number, t: 'movie' | 'tv') => void;
  showRanks?: boolean;
  mediaTypeOverride?: 'movie' | 'tv';
  viewMoreLabel?: string;
  showLessLabel?: string;
}) {
  const scrollRef    = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [showAll, setShowAll] = useState(false);

  function scroll(dir: 'left' | 'right') {
    scrollRef.current?.scrollBy({ left: dir === 'left' ? -400 : 400, behavior: 'smooth' });
  }

  function toggleShowAll() {
    if (showAll) {
      const el = containerRef.current;
      if (el) {
        const rect = el.getBoundingClientRect();
        if (rect.top < 64) el.scrollIntoView({ block: 'start' });
      }
    }
    setShowAll(a => !a);
  }

  const POSTER_WIDTH = 'clamp(80px,10vw,120px)';
  const SKELETON_COUNT = 14;

  return (
    <div ref={containerRef}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {icon}
          <h2 style={{ margin: 0, color: '#fff', fontSize: 'clamp(15px,2vw,19px)', fontWeight: 700, letterSpacing: '-0.3px' }}>{title}</h2>
        </div>
        <button
          onClick={toggleShowAll}
          style={{ background: 'none', border: '1px solid #2e2e2e', borderRadius: 8, padding: '5px 13px', color: '#888', fontSize: 12, cursor: 'pointer', transition: 'all .2s', fontFamily: 'inherit', whiteSpace: 'nowrap' }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#f59e0b'; (e.currentTarget as HTMLButtonElement).style.color = '#fbbf24'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#2e2e2e'; (e.currentTarget as HTMLButtonElement).style.color = '#888'; }}
        >
          {showAll ? showLessLabel : viewMoreLabel}
        </button>
      </div>

      {showAll ? (
        /* Grid view — fixed columns so all rows have the same count */
        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(auto-fill, minmax(${POSTER_WIDTH}, ${POSTER_WIDTH}))`,
          gap: 10,
          justifyContent: 'start',
        }}>
          {loading
            ? Array.from({ length: SKELETON_COUNT }).map((_, i) => (
                <div key={i} className="shimmer" style={{ aspectRatio: '2/3', borderRadius: 8 }} />
              ))
            : items.map((item, idx) => (
                <PosterThumb key={item.id} item={item} idx={idx} onMediaClick={onMediaClick} showRank={showRanks} mediaTypeOverride={mediaTypeOverride} />
              ))
          }
        </div>
      ) : (
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => scroll('left')}
            style={{ position: 'absolute', left: -16, top: '50%', transform: 'translateY(-50%)', zIndex: 5, width: 32, height: 48, borderRadius: 8, background: 'rgba(10,10,10,.9)', border: '1px solid #2e2e2e', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'border-color .2s' }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = '#f59e0b')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = '#2e2e2e')}
          >
            <ChevronLeft size={16} color="#888" />
          </button>
          <div ref={scrollRef} className="no-scrollbar" style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
            {loading
              ? Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} style={{ flexShrink: 0, width: POSTER_WIDTH }}>
                    <div className="shimmer" style={{ aspectRatio: '2/3', borderRadius: 8 }} />
                  </div>
                ))
              : items.map((item, idx) => (
                  <div key={item.id} style={{ flexShrink: 0, width: POSTER_WIDTH }}>
                    <PosterThumb item={item} idx={idx} onMediaClick={onMediaClick} showRank={showRanks} mediaTypeOverride={mediaTypeOverride} />
                  </div>
                ))
            }
          </div>
          <button
            onClick={() => scroll('right')}
            style={{ position: 'absolute', right: -16, top: '50%', transform: 'translateY(-50%)', zIndex: 5, width: 32, height: 48, borderRadius: 8, background: 'rgba(10,10,10,.9)', border: '1px solid #2e2e2e', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'border-color .2s' }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = '#f59e0b')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = '#2e2e2e')}
          >
            <ChevronRight size={16} color="#888" />
          </button>
        </div>
      )}
    </div>
  );
}

function PosterThumb({ item, idx, onMediaClick, showRank, mediaTypeOverride }: {
  item: TMDBMedia;
  idx: number;
  onMediaClick: (id: number, t: 'movie' | 'tv') => void;
  showRank?: boolean;
  mediaTypeOverride?: 'movie' | 'tv';
}) {
  const url  = posterUrl(item.poster_path);
  const type = mediaTypeOverride ?? (item.media_type as 'movie' | 'tv') ?? 'movie';
  return (
    <div className="poster-card" style={{ aspectRatio: '2/3', width: '100%' }} onClick={() => onMediaClick(item.id, type)}>
      {url
        ? <img src={url} alt={item.title || item.name || ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading={idx < 10 ? 'eager' : 'lazy'} />
        : <div style={{ width: '100%', height: '100%', background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Film size={20} color="#555" /></div>}
      {showRank && (
        <div style={{ position: 'absolute', top: 5, left: 5 }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: idx === 0 ? '#000' : 'rgba(255,255,255,.85)', background: idx === 0 ? '#f59e0b' : 'rgba(0,0,0,.7)', minWidth: 18, height: 18, borderRadius: 18, padding: '0 4px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            {idx + 1}
          </span>
        </div>
      )}
    </div>
  );
}
