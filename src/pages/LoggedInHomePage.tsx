import { useEffect, useRef, useState, useCallback } from 'react';
import { Film, Tv, Users, Play, BookmarkPlus, Clock, ChevronLeft, ChevronRight, TrendingUp, Star, Eye, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { tmdb, posterUrl, backdropUrl } from '../lib/tmdb';
import type { TMDBMedia } from '../lib/tmdb';
import { useAuth } from '../context/AuthContext';
import { formatWatchTimeCompact } from '../lib/formatWatchTime';

interface LoggedInHomePageProps {
  onMediaClick: (id: number, type: 'movie' | 'tv') => void;
  onMembersClick: () => void;
  onFilmsClick: () => void;
  onMemberProfileClick: (userId: string) => void;
}

// Map onboarding genre labels → TMDB genre IDs
const GENRE_TMDB_MAP: Record<string, number> = {
  action: 28, comedy: 35, drama: 18, thriller: 53, horror: 27,
  'sci-fi': 878, romance: 10749, documentary: 99, animation: 16,
  fantasy: 14, crime: 80, adventure: 12,
};
const GENRE_LABEL: Record<string, string> = {
  action: 'Action', comedy: 'Comedy', drama: 'Drama', thriller: 'Thriller',
  horror: 'Horror', 'sci-fi': 'Sci-Fi', romance: 'Romance', documentary: 'Documentary',
  animation: 'Animation', fantasy: 'Fantasy', crime: 'Crime', adventure: 'Adventure',
};

interface ContinueItem {
  id: string;
  tmdb_id: number;
  media_type: 'movie' | 'tv';
  title: string;
  poster_path: string | null;
  season_number: number | null;
  episode_number: number | null;
  episode_name: string | null;
}

interface FriendActivity {
  tmdb_id: number;
  media_type: string;
  title: string;
  poster_path: string | null;
  user_id: string;
  username: string;
  avatar_url: string | null;
}

interface RecentlyViewedItem {
  tmdb_id: number;
  media_type: string;
  title: string;
  poster_path: string | null;
}

// Intersection observer for fade-in-on-scroll
function useFadeIn() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.08 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return { ref, visible };
}

function FadeSection({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const { ref, visible } = useFadeIn();
  return (
    <div ref={ref} style={{
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(24px)',
      transition: `opacity 0.5s ease ${delay}ms, transform 0.5s ease ${delay}ms`,
    }}>
      {children}
    </div>
  );
}

function HScroll({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  function scroll(dir: 'left' | 'right') {
    ref.current?.scrollBy({ left: dir === 'left' ? -360 : 360, behavior: 'smooth' });
  }
  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => scroll('left')} style={{ position: 'absolute', left: -14, top: '50%', transform: 'translateY(-50%)', zIndex: 5, width: 30, height: 44, borderRadius: 8, background: 'rgba(10,10,10,.92)', border: '1px solid #2e2e2e', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = '#f59e0b')}
        onMouseLeave={e => (e.currentTarget.style.borderColor = '#2e2e2e')}>
        <ChevronLeft size={15} color="#888" />
      </button>
      <div ref={ref} className="no-scrollbar" style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
        {children}
      </div>
      <button onClick={() => scroll('right')} style={{ position: 'absolute', right: -14, top: '50%', transform: 'translateY(-50%)', zIndex: 5, width: 30, height: 44, borderRadius: 8, background: 'rgba(10,10,10,.92)', border: '1px solid #2e2e2e', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = '#f59e0b')}
        onMouseLeave={e => (e.currentTarget.style.borderColor = '#2e2e2e')}>
        <ChevronRight size={15} color="#888" />
      </button>
    </div>
  );
}

function SectionHeader({ title, icon, action }: { title: string; icon: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {icon}
        <h2 style={{ margin: 0, color: '#fff', fontSize: 'clamp(15px,2vw,19px)', fontWeight: 700, letterSpacing: '-0.3px' }}>{title}</h2>
      </div>
      {action}
    </div>
  );
}

function EmptyState({ icon, message, action }: { icon: React.ReactNode; message: string; action?: React.ReactNode }) {
  return (
    <div style={{ padding: '28px 20px', background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center' }}>
      <div style={{ color: '#333' }}>{icon}</div>
      <p style={{ margin: 0, color: '#555', fontSize: 14, lineHeight: 1.6, maxWidth: 280 }}>{message}</p>
      {action}
    </div>
  );
}

function PosterThumb({ media_type, title, poster_path, onClick }: {
  tmdb_id?: number; media_type: string; title: string; poster_path: string | null; onClick: () => void;
}) {
  const url = posterUrl(poster_path ?? null);
  return (
    <div onClick={onClick} style={{ flexShrink: 0, width: 'clamp(80px,10vw,118px)', cursor: 'pointer' }}>
      <div className="poster-card" style={{ aspectRatio: '2/3', width: '100%' }}>
        {url
          ? <img src={url} alt={title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" decoding="async" />
          : <div style={{ width: '100%', height: '100%', background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {media_type === 'tv' ? <Tv size={18} color="#555" /> : <Film size={18} color="#555" />}
            </div>}
      </div>
    </div>
  );
}

function SkeletonRow({ count = 8 }: { count?: number }) {
  return (
    <div style={{ display: 'flex', gap: 10 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ flexShrink: 0, width: 'clamp(80px,10vw,118px)' }}>
          <div className="shimmer" style={{ aspectRatio: '2/3', borderRadius: 8 }} />
        </div>
      ))}
    </div>
  );
}

function greetingPrefix() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function useGreeting(username: string) {
  const [prefix, setPrefix] = useState(greetingPrefix);
  useEffect(() => {
    // Recalculate at the top of every minute
    function tick() { setPrefix(greetingPrefix()); }
    const now = new Date();
    const msUntilNextMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();
    const initial = setTimeout(() => {
      tick();
      const interval = setInterval(tick, 60_000);
      return () => clearInterval(interval);
    }, msUntilNextMinute);
    return () => clearTimeout(initial);
  }, []);
  return `${prefix}, ${username}`;
}


export default function LoggedInHomePage({ onMediaClick, onMembersClick, onFilmsClick, onMemberProfileClick }: LoggedInHomePageProps) {
  const { user, profile } = useAuth();
  const greetingText = useGreeting(profile?.username ?? 'there');

  // Hero data
  const [heroBackdrop, setHeroBackdrop] = useState<string | null>(null);
  const [heroStats, setHeroStats] = useState({ films: 0, watchMins: 0, followers: 0, following: 0 });
  const [heroStatsLoading, setHeroStatsLoading] = useState(true);

  // Continue watching
  const [continueItems, setContinueItems] = useState<ContinueItem[]>([]);
  const [continueLoading, setContinueLoading] = useState(true);

  // Because you watched (2 most recent, each with recommendations)
  const [becauseWatched, setBecauseWatched] = useState<{ title: string; tmdb_id: number; media_type: 'movie' | 'tv'; recs: TMDBMedia[] }[]>([]);
  const [becauseLoading, setBecauseLoading] = useState(true);

  // Genre rows (up to 3)
  const [genreRows, setGenreRows] = useState<{ genreId: string; label: string; items: TMDBMedia[] }[]>([]);
  const [genreLoading, setGenreLoading] = useState(true);

  // Friends watching
  const [friendsActivity, setFriendsActivity] = useState<FriendActivity[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(true);

  // Watchlist preview
  const [watchlistItems, setWatchlistItems] = useState<{ tmdb_id: number; media_type: string; title: string; poster_path: string | null }[]>([]);
  const [watchlistLoading, setWatchlistLoading] = useState(true);

  // Recently viewed
  const [recentlyViewed, setRecentlyViewed] = useState<RecentlyViewedItem[]>([]);
  const [recentlyViewedLoading, setRecentlyViewedLoading] = useState(true);

  // Trending (reuse from global for bottom sections)
  const [trendFilms, setTrendFilms] = useState<TMDBMedia[]>([]);
  const [trendTV, setTrendTV] = useState<TMDBMedia[]>([]);
  const [topRated, setTopRated] = useState<TMDBMedia[]>([]);
  const [trendLoading, setTrendLoading] = useState(true);

  // Track in-progress action feedback
  const [pausingId, setPausingId] = useState<string | null>(null);

  // Standalone stats loader — runs immediately and on any watched/follows change
  const loadStats = useCallback(async () => {
    if (!user) return;
    const [
      { data: watchedRows },
      { data: followersRows },
      { data: followingRows },
    ] = await Promise.all([
      supabase.from('watched').select('runtime_minutes').eq('user_id', user.id),
      supabase.from('follows').select('id').eq('following_id', user.id),
      supabase.from('follows').select('id').eq('follower_id', user.id),
    ]);
    const watchMins = (watchedRows ?? []).reduce((s: number, w: { runtime_minutes: number | null }) => s + (w.runtime_minutes ?? 0), 0);
    setHeroStats({
      films: (watchedRows ?? []).length,
      watchMins,
      followers: (followersRows ?? []).length,
      following: (followingRows ?? []).length,
    });
    setHeroStatsLoading(false);
  }, [user]);

  const loadAll = useCallback(async () => {
    if (!user) return;

    // ── Watched history for recommendations ─────────────
    const [
      { data: watchedRows },
      { data: watchlistIds },
      { data: cwRows },
    ] = await Promise.all([
      supabase.from('watched').select('runtime_minutes, media_type, tmdb_id, title, poster_path, genre_ids').eq('user_id', user.id).order('watched_date', { ascending: false }),
      supabase.from('watchlist').select('tmdb_id').eq('user_id', user.id),
      supabase.from('continue_watching').select('*').eq('user_id', user.id).order('updated_at', { ascending: false }).limit(10),
    ]);

    const allWatched = (watchedRows ?? []) as { runtime_minutes: number | null; media_type: string; tmdb_id: number; title: string; poster_path: string | null; genre_ids?: number[] | null }[];
    const watchedIdSet = new Set(allWatched.map(w => w.tmdb_id));
    const watchlistIdSet = new Set((watchlistIds ?? []).map((w: { tmdb_id: number }) => w.tmdb_id));

    // Load hero backdrop: prefer user's custom choice, fall back to last watched
    const { data: profileData } = await supabase.from('profiles').select('hero_background').eq('id', user.id).maybeSingle();
    type HeroBg = { tmdb_id: number; media_type: string; backdrop_path: string | null; poster_path: string | null } | null;
    const heroBackground = (profileData as { hero_background?: HeroBg } | null)?.hero_background ?? null;

    if (heroBackground) {
      if (heroBackground.backdrop_path) {
        setHeroBackdrop(backdropUrl(heroBackground.backdrop_path, 'w1280'));
      } else if (heroBackground.poster_path) {
        setHeroBackdrop(posterUrl(heroBackground.poster_path, 'w500'));
      }
    } else {
      const lastWatched = allWatched[0];
      if (lastWatched) {
        try {
          const detail = lastWatched.media_type === 'tv'
            ? await tmdb.tvDetails(lastWatched.tmdb_id)
            : await tmdb.movieDetails(lastWatched.tmdb_id);
          if (detail.backdrop_path) setHeroBackdrop(backdropUrl(detail.backdrop_path, 'w1280'));
        } catch { /* fallback */ }
      }
    }

    // ── Continue watching ───────────────────────────────
    setContinueItems((cwRows ?? []) as ContinueItem[]);
    setContinueLoading(false);

    // ── Because you watched ─────────────────────────────
    // Use TMDB similar + recommendations endpoints, filtered by same genre(s)
    setBecauseLoading(true);
    const recent2 = allWatched.slice(0, 2);
    const becauseResults: typeof becauseWatched = [];

    for (const w of recent2) {
      try {
        const mediaType = (w.media_type as 'movie' | 'tv') ?? 'movie';

        // Fetch genre IDs for this item from TMDB if not cached
        let genreIds: number[] = [];
        try {
          const detail = mediaType === 'tv'
            ? await tmdb.tvDetails(w.tmdb_id)
            : await tmdb.movieDetails(w.tmdb_id);
          genreIds = (detail.genres ?? []).map(g => g.id);
        } catch { /* skip */ }

        // Pull both similar and recommendations in parallel
        const [simRes, recRes] = await Promise.allSettled([
          tmdb.similar(mediaType, w.tmdb_id),
          tmdb.recommendations(mediaType, w.tmdb_id),
        ]);

        const simItems = simRes.status === 'fulfilled' ? (simRes.value.results ?? []) : [];
        const recItems = recRes.status === 'fulfilled' ? (recRes.value.results ?? []) : [];

        // Merge, dedupe, filter
        const merged = new Map<number, TMDBMedia>();
        for (const r of [...simItems, ...recItems]) merged.set(r.id, r);

        let recs = Array.from(merged.values())
          .filter(r =>
            r.id !== w.tmdb_id &&
            !watchedIdSet.has(r.id) &&
            !watchlistIdSet.has(r.id) &&
            r.vote_average >= 6.5 &&
            r.vote_count > 50
          );

        // Prioritise genre match — same genre(s) first
        if (genreIds.length > 0) {
          recs.sort((a, b) => {
            const aMatch = (a.genre_ids ?? []).filter(id => genreIds.includes(id)).length;
            const bMatch = (b.genre_ids ?? []).filter(id => genreIds.includes(id)).length;
            if (bMatch !== aMatch) return bMatch - aMatch;
            return b.vote_average - a.vote_average;
          });
          // If we have enough genre-matched results, only show those
          const genreMatched = recs.filter(r => (r.genre_ids ?? []).some(id => genreIds.includes(id)));
          if (genreMatched.length >= 6) recs = genreMatched;
        }

        // Fallback: if too few results, use discover filtered by genre
        if (recs.length < 4 && genreIds.length > 0) {
          try {
            const discoverRes = await tmdb.discover(mediaType, {
              with_genres: genreIds[0].toString(),
              sort_by: 'popularity.desc',
              'vote_average.gte': '6.5',
              'vote_count.gte': '100',
            });
            const extra = (discoverRes.results ?? [])
              .filter(r => r.id !== w.tmdb_id && !watchedIdSet.has(r.id) && !watchlistIdSet.has(r.id))
              .map(r => ({ ...r, media_type: mediaType }));
            // Add any new ones not already in recs
            const existingIds = new Set(recs.map(r => r.id));
            for (const r of extra) {
              if (!existingIds.has(r.id)) recs.push(r);
            }
          } catch { /* skip */ }
        }

        const finalRecs = recs.slice(0, 14).map(r => ({ ...r, media_type: r.media_type ?? mediaType }));
        if (finalRecs.length > 0) {
          becauseResults.push({ title: w.title, tmdb_id: w.tmdb_id, media_type: mediaType, recs: finalRecs });
        }
      } catch { /* skip */ }
    }
    setBecauseWatched(becauseResults);
    setBecauseLoading(false);

    // ── Genre rows — weighted by actual watch history ───
    setGenreLoading(true);

    // Tally genres from watch history
    const genreCount: Record<number, number> = {};
    for (const w of allWatched) {
      for (const gid of (w.genre_ids ?? [])) {
        genreCount[gid] = (genreCount[gid] ?? 0) + 1;
      }
    }

    // Also pull onboarding genres as fallback
    const { data: onboarding } = await supabase
      .from('onboarding_completed')
      .select('genres')
      .eq('user_id', user.id)
      .maybeSingle();
    const onboardingGenres: string[] = (onboarding as { genres?: string[] } | null)?.genres ?? [];

    // Build ranked genre list: watch history first (sorted by count), then onboarding
    const watchHistoryGenres = Object.entries(genreCount)
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => {
        const found = Object.entries(GENRE_TMDB_MAP).find(([, tmdbId]) => tmdbId === Number(id));
        return found ? found[0] : null;
      })
      .filter(Boolean) as string[];

    // Merge: history genres first, then any onboarding genres not already covered
    const rankedGenres = [...new Set([...watchHistoryGenres, ...onboardingGenres])].slice(0, 3);
    // Use onboarding if no watch history
    const genresToUse = rankedGenres.length > 0 ? rankedGenres : onboardingGenres.slice(0, 3);

    const rows: typeof genreRows = [];
    for (const g of genresToUse) {
      const tmdbId = GENRE_TMDB_MAP[g];
      if (!tmdbId) continue;
      try {
        const res = await tmdb.discover('movie', {
          with_genres: String(tmdbId),
          sort_by: 'popularity.desc',
          'vote_average.gte': '6.5',
          'vote_count.gte': '200',
        });
        const items = (res.results ?? [])
          .filter(r => !watchedIdSet.has(r.id) && !watchlistIdSet.has(r.id))
          .slice(0, 14)
          .map(r => ({ ...r, media_type: 'movie' as const }));
        if (items.length > 0) rows.push({ genreId: g, label: GENRE_LABEL[g] ?? g, items });
      } catch { /* skip */ }
    }
    setGenreRows(rows);
    setGenreLoading(false);

    // ── Friends watching ────────────────────────────────
    setFriendsLoading(true);
    const { data: followingIds } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', user.id);
    const ids = (followingIds ?? []).map((f: { following_id: string }) => f.following_id);

    if (ids.length > 0) {
      const { data: fwRows } = await supabase
        .from('watched')
        .select('tmdb_id, media_type, title, poster_path, user_id, profiles!inner(username, avatar_url, is_public)')
        .in('user_id', ids)
        .order('created_at', { ascending: false })
        .limit(30);

      type FWRow = { tmdb_id: number; media_type: string; title: string; poster_path: string | null; user_id: string; profiles: { username: string; avatar_url: string | null; is_public: boolean }[] };
      const seen = new Set<number>();
      const friends: FriendActivity[] = ((fwRows ?? []) as FWRow[])
        .filter(r => {
          const pub = Array.isArray(r.profiles) ? r.profiles[0]?.is_public !== false : true;
          if (!pub || seen.has(r.tmdb_id)) return false;
          seen.add(r.tmdb_id);
          return true;
        })
        .slice(0, 8)
        .map(r => ({
          tmdb_id: r.tmdb_id,
          media_type: r.media_type,
          title: r.title,
          poster_path: r.poster_path,
          user_id: r.user_id,
          username: (Array.isArray(r.profiles) ? r.profiles[0]?.username : (r.profiles as unknown as { username: string })?.username) ?? 'Someone',
          avatar_url: (Array.isArray(r.profiles) ? r.profiles[0]?.avatar_url : null) ?? null,
        }));
      setFriendsActivity(friends);
    }
    setFriendsLoading(false);

    // ── Watchlist ────────────────────────────────────────
    setWatchlistLoading(true);
    const { data: wlRows } = await supabase
      .from('watchlist')
      .select('tmdb_id, media_type, title, poster_path')
      .eq('user_id', user.id)
      .order('added_at', { ascending: false })
      .limit(8);
    setWatchlistItems((wlRows ?? []) as { tmdb_id: number; media_type: string; title: string; poster_path: string | null }[]);
    setWatchlistLoading(false);

    // ── Recently viewed ──────────────────────────────────
    setRecentlyViewedLoading(true);
    const { data: rvRows } = await supabase
      .from('recently_viewed')
      .select('tmdb_id, media_type, title, poster_path')
      .eq('user_id', user.id)
      .order('viewed_at', { ascending: false })
      .limit(8);
    setRecentlyViewed((rvRows ?? []) as RecentlyViewedItem[]);
    setRecentlyViewedLoading(false);

    // ── Trending / top-rated (bottom) ────────────────────
    setTrendLoading(true);
    try {
      const [m, tv, tr] = await Promise.all([
        tmdb.trendingMovies('1'),
        tmdb.trendingTV('1'),
        tmdb.topRated('movie', '1'),
      ]);
      setTrendFilms((m.results ?? []).slice(0, 20).map(r => ({ ...r, media_type: 'movie' as const })));
      setTrendTV((tv.results ?? []).slice(0, 20).map(r => ({ ...r, media_type: 'tv' as const })));
      setTopRated((tr.results ?? []).slice(0, 20).map(r => ({ ...r, media_type: 'movie' as const })));
    } catch { /* skip */ }
    setTrendLoading(false);
  }, [user]);

  useEffect(() => {
    // Load stats immediately — independent of the heavy loadAll
    loadStats();
    // Load all recommendations/sections in parallel
    loadAll();
  }, [loadStats, loadAll]);

  // Realtime: re-fetch stats whenever watched or follows change for this user
  useEffect(() => {
    if (!user) return;

    const watchedSub = supabase
      .channel(`home-watched-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'watched', filter: `user_id=eq.${user.id}` }, () => loadStats())
      .subscribe();

    const followsSub = supabase
      .channel(`home-follows-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'follows' }, () => loadStats())
      .subscribe();

    return () => {
      supabase.removeChannel(watchedSub);
      supabase.removeChannel(followsSub);
    };
  }, [user, loadStats]);

  async function removeContinueWatching(id: string) {
    setPausingId(id);
    await supabase.from('continue_watching').delete().eq('id', id);
    setContinueItems(prev => prev.filter(c => c.id !== id));
    setPausingId(null);
  }

  const pad = 'clamp(16px,4vw,48px)';

  return (
    <div style={{ minHeight: '100vh', background: '#000', paddingBottom: 96 }}>

      {/* ── Personalised Hero ─────────────────────────────── */}
      <div style={{ position: 'relative', minHeight: 'clamp(300px,45vh,460px)', overflow: 'hidden', display: 'flex', alignItems: 'flex-end' }}>
        {/* Custom backdrop */}
        {heroBackdrop
          ? <img src={heroBackdrop} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', filter: 'brightness(0.86) saturate(1.08)', transform: 'scale(1.01)' }} decoding="async" />
          : <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #0a0a0a 0%, #111 100%)' }} />}
        {/* Gradient overlay */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, #000 0%, rgba(0,0,0,.34) 46%, rgba(0,0,0,.08) 100%)' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, rgba(0,0,0,.62) 0%, rgba(0,0,0,.22) 42%, rgba(0,0,0,.08) 100%)' }} />
        {/* Content */}
        <div style={{ position: 'relative', width: '100%', maxWidth: 1400, margin: '0 auto', padding: `clamp(32px,5vw,64px) ${pad} clamp(36px,5vw,56px)` }}>
          <p style={{ margin: '0 0 6px', color: 'rgba(245,158,11,.75)', fontSize: 13, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Welcome back</p>
          <h1 style={{ margin: '0 0 28px', color: '#fff', fontSize: 'clamp(26px,5vw,52px)', fontWeight: 800, letterSpacing: '-1px', lineHeight: 1.1 }}>
            <span style={{ color: '#f59e0b' }} className="gold-glow">{greetingText.split(',')[0]},</span>
            <br />
            <span>{greetingText.split(',').slice(1).join(',').trim()}</span>
          </h1>
          {/* Stats strip */}
          <div style={{ display: 'flex', gap: 'clamp(20px,4vw,40px)', flexWrap: 'wrap' }}>
            {[
              { label: 'Films & Shows', value: heroStats.films.toLocaleString(), icon: <Film size={14} /> },
              { label: 'Watch Time', value: formatWatchTimeCompact(heroStats.watchMins), icon: <Clock size={14} /> },
              { label: 'Following', value: heroStats.following.toLocaleString(), icon: <Users size={14} /> },
              { label: 'Followers', value: heroStats.followers.toLocaleString(), icon: <Users size={14} /> },
            ].map(s => (
              <div key={s.label} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#888' }}>
                  {s.icon}
                  <span style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{s.label}</span>
                </div>
                {heroStatsLoading
                  ? <div className="shimmer" style={{ width: 56, height: 26, borderRadius: 4, marginTop: 2 }} />
                  : <span style={{ color: '#fff', fontSize: 'clamp(18px,2.5vw,26px)', fontWeight: 800, lineHeight: 1 }}>{s.value}</span>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── All sections ──────────────────────────────────── */}
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: `40px ${pad} 0`, display: 'flex', flexDirection: 'column', gap: 52 }}>

        {/* Continue Tracking */}
        <FadeSection>
          <SectionHeader
            title="Continue Tracking"
            icon={<Play size={18} color="#f59e0b" fill="#f59e0b" />}
          />
          {continueLoading ? (
            <SkeletonRow />
          ) : continueItems.length === 0 ? (
            <EmptyState
              icon={<Play size={32} />}
              message="Nothing paused — start tracking something new."
              action={<button onClick={onFilmsClick} className="btn-gold" style={{ fontSize: 13, padding: '8px 20px', borderRadius: 10 }}>Browse</button>}
            />
          ) : (
            <HScroll>
              {continueItems.map(item => {
                const url = posterUrl(item.poster_path ?? null);
                return (
                  <div key={item.id} style={{ flexShrink: 0, width: 'clamp(120px,14vw,160px)', cursor: 'pointer' }}
                    onClick={() => onMediaClick(item.tmdb_id, item.media_type)}>
                    <div className="poster-card" style={{ aspectRatio: '2/3', width: '100%', position: 'relative', marginBottom: 8 }}>
                      {url
                        ? <img src={url} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" decoding="async" />
                        : <div style={{ width: '100%', height: '100%', background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{item.media_type === 'tv' ? <Tv size={22} color="#555" /> : <Film size={22} color="#555" />}</div>}
                      {/* X remove button always visible */}
                      <button
                        onClick={e => { e.stopPropagation(); removeContinueWatching(item.id); }}
                        disabled={pausingId === item.id}
                        style={{ position: 'absolute', top: 5, right: 5, width: 20, height: 20, borderRadius: '50%', background: 'rgba(0,0,0,.82)', border: '1px solid rgba(255,255,255,.15)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ccc', transition: 'all .2s', zIndex: 2 }}
                        title="Remove"
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#ef4444'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#ef4444'; (e.currentTarget as HTMLButtonElement).style.color = '#fff'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,0,0,.82)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,.15)'; (e.currentTarget as HTMLButtonElement).style.color = '#ccc'; }}
                      >
                        <X size={10} />
                      </button>
                    </div>
                    <p style={{ margin: '0 0 2px', color: '#fff', fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</p>
                    {item.media_type === 'tv' && item.season_number != null && (
                      <p style={{ margin: 0, color: '#888', fontSize: 11 }}>S{item.season_number} E{item.episode_number}</p>
                    )}
                    <button onClick={e => { e.stopPropagation(); onMediaClick(item.tmdb_id, item.media_type); }}
                      style={{ marginTop: 6, width: '100%', padding: '5px 0', background: '#f59e0b', border: 'none', borderRadius: 6, color: '#000', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                      <Play size={10} fill="#000" /> Resume
                    </button>
                  </div>
                );
              })}
            </HScroll>
          )}
        </FadeSection>

        {/* Because you watched */}
        {!becauseLoading && becauseWatched.length > 0 && becauseWatched.map((row, i) => (
          <FadeSection key={row.tmdb_id} delay={i * 60}>
            <SectionHeader
              title={`Because you watched ${row.title}`}
              icon={<Eye size={18} color="#f59e0b" />}
            />
            <HScroll>
              {row.recs.map(item => (
                <PosterThumb
                  key={item.id}
                  tmdb_id={item.id}
                  media_type={item.media_type ?? row.media_type}
                  title={item.title ?? item.name ?? ''}
                  poster_path={item.poster_path}
                  onClick={() => onMediaClick(item.id, (item.media_type as 'movie' | 'tv') ?? row.media_type)}
                />
              ))}
            </HScroll>
          </FadeSection>
        ))}
        {becauseLoading && (
          <FadeSection>
            <SectionHeader title="Because you watched..." icon={<Eye size={18} color="#f59e0b" />} />
            <SkeletonRow />
          </FadeSection>
        )}

        {/* Based on your taste — genre rows */}
        {genreLoading ? (
          <FadeSection>
            <SectionHeader title="Based on your taste" icon={<Star size={18} color="#f59e0b" />} />
            <SkeletonRow />
          </FadeSection>
        ) : genreRows.length > 0 ? (
          genreRows.map((row, i) => (
            <FadeSection key={row.genreId} delay={i * 60}>
              <SectionHeader
                title={`Because you love ${row.label}`}
                icon={<Star size={18} color="#f59e0b" />}
              />
              <HScroll>
                {row.items.map(item => (
                  <PosterThumb
                    key={item.id}
                    tmdb_id={item.id}
                    media_type="movie"
                    title={item.title ?? item.name ?? ''}
                    poster_path={item.poster_path}
                    onClick={() => onMediaClick(item.id, 'movie')}
                  />
                ))}
              </HScroll>
            </FadeSection>
          ))
        ) : null}

        {/* Friends are watching */}
        <FadeSection>
          <SectionHeader
            title="Friends are watching"
            icon={<Users size={18} color="#f59e0b" />}
          />
          {friendsLoading ? (
            <SkeletonRow />
          ) : friendsActivity.length === 0 ? (
            <EmptyState
              icon={<Users size={32} />}
              message="Follow other members to see what they are watching."
              action={<button onClick={onMembersClick} className="btn-gold" style={{ fontSize: 13, padding: '8px 20px', borderRadius: 10 }}>Find Members</button>}
            />
          ) : (
            <HScroll>
              {friendsActivity.map(item => {
                const url = posterUrl(item.poster_path ?? null);
                return (
                  <div key={`${item.tmdb_id}-${item.user_id}`} style={{ flexShrink: 0, width: 'clamp(80px,10vw,118px)' }}>
                    <div className="poster-card" style={{ aspectRatio: '2/3', width: '100%', marginBottom: 8, cursor: 'pointer' }}
                      onClick={() => onMediaClick(item.tmdb_id, (item.media_type as 'movie' | 'tv') ?? 'movie')}>
                      {url
                        ? <img src={url} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" decoding="async" />
                        : <div style={{ width: '100%', height: '100%', background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Film size={16} color="#555" /></div>}
                    </div>
                    <button onClick={() => onMemberProfileClick(item.user_id)}
                      style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>
                      <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#2e2e2e', overflow: 'hidden', flexShrink: 0 }}>
                        {item.avatar_url
                          ? <img src={item.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <span style={{ fontSize: 9, fontWeight: 700, color: '#fbbf24' }}>{item.username[0]?.toUpperCase()}</span>
                            </div>}
                      </div>
                      <span style={{ color: '#666', fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.username}</span>
                    </button>
                  </div>
                );
              })}
            </HScroll>
          )}
        </FadeSection>

        {/* Up next in your queue */}
        <FadeSection>
          <SectionHeader
            title="Up next in your queue"
            icon={<BookmarkPlus size={18} color="#f59e0b" />}
          />
          {watchlistLoading ? (
            <SkeletonRow />
          ) : watchlistItems.length === 0 ? (
            <EmptyState
              icon={<BookmarkPlus size={32} />}
              message="Your queue is empty — add something to watch next."
              action={<button onClick={onFilmsClick} className="btn-gold" style={{ fontSize: 13, padding: '8px 20px', borderRadius: 10 }}>Browse</button>}
            />
          ) : (
            <HScroll>
              {watchlistItems.map(item => (
                <PosterThumb
                  key={item.tmdb_id}
                  tmdb_id={item.tmdb_id}
                  media_type={item.media_type}
                  title={item.title}
                  poster_path={item.poster_path}
                  onClick={() => onMediaClick(item.tmdb_id, (item.media_type as 'movie' | 'tv') ?? 'movie')}
                />
              ))}
            </HScroll>
          )}
        </FadeSection>

        {/* Recently viewed */}
        <FadeSection>
          <SectionHeader
            title="You looked at these..."
            icon={<Eye size={18} color="#f59e0b" />}
          />
          {recentlyViewedLoading ? (
            <SkeletonRow />
          ) : recentlyViewed.length === 0 ? (
            <EmptyState
              icon={<Eye size={32} />}
              message="Films and shows you browse will appear here."
            />
          ) : (
            <HScroll>
              {recentlyViewed.map(item => (
                <PosterThumb
                  key={item.tmdb_id}
                  tmdb_id={item.tmdb_id}
                  media_type={item.media_type}
                  title={item.title}
                  poster_path={item.poster_path}
                  onClick={() => onMediaClick(item.tmdb_id, (item.media_type as 'movie' | 'tv') ?? 'movie')}
                />
              ))}
            </HScroll>
          )}
        </FadeSection>

        {/* Trending Films */}
        <FadeSection>
          <SectionHeader title="Trending Films This Week" icon={<TrendingUp size={18} color="#f59e0b" />} />
          {trendLoading ? <SkeletonRow /> : (
            <HScroll>
              {trendFilms.map(item => (
                <PosterThumb key={item.id} tmdb_id={item.id} media_type="movie" title={item.title ?? ''} poster_path={item.poster_path} onClick={() => onMediaClick(item.id, 'movie')} />
              ))}
            </HScroll>
          )}
        </FadeSection>

        {/* Trending TV */}
        <FadeSection>
          <SectionHeader title="Trending TV Shows This Week" icon={<Tv size={18} color="#f59e0b" />} />
          {trendLoading ? <SkeletonRow /> : (
            <HScroll>
              {trendTV.map(item => (
                <PosterThumb key={item.id} tmdb_id={item.id} media_type="tv" title={item.name ?? ''} poster_path={item.poster_path} onClick={() => onMediaClick(item.id, 'tv')} />
              ))}
            </HScroll>
          )}
        </FadeSection>

        {/* Top Rated */}
        <FadeSection>
          <SectionHeader title="Top Rated Films" icon={<Star size={18} color="#f59e0b" />} />
          {trendLoading ? <SkeletonRow /> : (
            <HScroll>
              {topRated.map(item => (
                <PosterThumb key={item.id} tmdb_id={item.id} media_type="movie" title={item.title ?? ''} poster_path={item.poster_path} onClick={() => onMediaClick(item.id, 'movie')} />
              ))}
            </HScroll>
          )}
        </FadeSection>

      </div>
    </div>
  );
}

// Helper exported so MediaDetailPage can record recently viewed
export async function recordRecentlyViewed(userId: string, item: { tmdb_id: number; media_type: string; title: string; poster_path: string | null }) {
  await supabase.from('recently_viewed').upsert(
    { user_id: userId, tmdb_id: item.tmdb_id, media_type: item.media_type, title: item.title, poster_path: item.poster_path, viewed_at: new Date().toISOString() },
    { onConflict: 'user_id,tmdb_id,media_type' }
  );
}

// Helper exported so detail pages can set/remove continue watching
export async function setPaused(userId: string, item: {
  tmdb_id: number; media_type: 'movie' | 'tv'; title: string; poster_path: string | null;
  season_number?: number | null; episode_number?: number | null; episode_name?: string | null;
}) {
  await supabase.from('continue_watching').upsert(
    { user_id: userId, tmdb_id: item.tmdb_id, media_type: item.media_type, title: item.title, poster_path: item.poster_path, season_number: item.season_number ?? null, episode_number: item.episode_number ?? null, episode_name: item.episode_name ?? null, updated_at: new Date().toISOString() },
    { onConflict: 'user_id,tmdb_id,media_type' }
  );
}

export async function clearPaused(userId: string, tmdb_id: number, media_type: string) {
  await supabase.from('continue_watching').delete().eq('user_id', userId).eq('tmdb_id', tmdb_id).eq('media_type', media_type);
}
