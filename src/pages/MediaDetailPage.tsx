import { useEffect, useState, useCallback } from 'react';
import { ArrowLeft, Plus, Check, Heart, Star, ChevronDown, ChevronUp, Film, TriangleAlert as AlertTriangle, Eye, EyeOff, MessageSquare, Send, BadgeCheck, Play, Pause } from 'lucide-react';
import { recordRecentlyViewed, setPaused, clearPaused } from './LoggedInHomePage';
import { containsOffensiveContent, likelyContainsSpoilers, MODERATION_ERROR, recordOffensiveStrike, isUserSuspended } from '../lib/moderation';
import { tmdb, posterUrl, profileUrl, backdropUrl } from '../lib/tmdb';
import type { TMDBMedia, TMDBCredits, TMDBSeason, TMDBSeasonDetails, TMDBWatchProvider, TMDBWatchRegion } from '../lib/tmdb';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/I18nContext';
import StarRating from '../components/StarRating';
import type { QuickAddMedia } from '../components/QuickAddModal';

const HALF_STARS = [0.5,1,1.5,2,2.5,3,3.5,4,4.5,5];

interface Props {
  id: number;
  type: 'movie' | 'tv';
  onBack: () => void;
  onActorClick: (id: number) => void;
  onQuickAdd: (media: QuickAddMedia) => void;
  requireAuth?: (reason?: string) => void;
}

interface ReviewWithUser {
  id: string;
  user_id: string;
  content: string;
  rating: number | null;
  is_public: boolean;
  has_spoilers?: boolean;
  like_count?: number;
  comment_count?: number;
  pinned?: boolean;
  created_at: string;
  username?: string;
  avatar_url?: string;
  is_verified?: boolean;
}

export default function MediaDetailPage({ id, type, onBack, onActorClick, onQuickAdd, requireAuth }: Props) {
  const { user, profile } = useAuth();
  const { t } = useI18n();
  const [media,          setMedia]          = useState<TMDBMedia | null>(null);
  const [credits,        setCredits]        = useState<TMDBCredits | null>(null);
  const [loading,        setLoading]        = useState(true);
  const [inWatchlist,    setInWatchlist]    = useState(false);
  const [hasWatched,     setHasWatched]     = useState(false);
  const [allRatings,     setAllRatings]     = useState<number[]>([]);
  const [seasons,        setSeasons]        = useState<TMDBSeason[]>([]);
  const [expandedSeason, setExpandedSeason] = useState<number | null>(null);
  const [seasonDetails,  setSeasonDetails]  = useState<Record<number, TMDBSeasonDetails>>({});
  const [episodeRatings, setEpisodeRatings] = useState<Record<string, number>>({});
  const [reviews,        setReviews]        = useState<ReviewWithUser[]>([]);
  const [watchRegion,    setWatchRegion]    = useState<TMDBWatchRegion | null>(null);
  const [likedReviewIds, setLikedReviewIds] = useState<Set<string>>(new Set());

  // Pause / continue-watching state
  const [isPaused,        setIsPaused]        = useState(false);
  const [pausedEpisode,   setPausedEpisode]   = useState<{ season: number; episode: number; name: string } | null>(null);
  const [savingPause,     setSavingPause]     = useState(false);

  // Combined rating+review form state
  const [userRating,    setUserRating]    = useState(0);
  const [userReview,    setUserReview]    = useState('');
  const [reviewPublic,  setReviewPublic]  = useState(true);
  const [savingReview,  setSavingReview]  = useState(false);
  const [reviewSaved,   setReviewSaved]   = useState(false);
  const [reviewError,   setReviewError]   = useState('');
  const [spoilerWarned, setSpoilerWarned] = useState(false);
  const [spoilerConfirmed, setSpoilerConfirmed] = useState(false);
  // Own review id (needed for upsert/update, loaded separately so private reviews are found)
  const [ownReviewId, setOwnReviewId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setReviews([]);
    setWatchRegion(null);
    Promise.all([
      type === 'movie' ? tmdb.movieDetails(id) : tmdb.tvDetails(id),
      type === 'movie' ? tmdb.movieCredits(id) : tmdb.tvCredits(id),
      tmdb.watchProviders(type, id),
    ]).then(([m, c, wp]) => {
      setMedia(m);
      setCredits(c);
      if (type === 'tv') setSeasons(((m as unknown as Record<string, unknown>).seasons as TMDBSeason[] ?? []).filter((s: TMDBSeason) => s.season_number > 0));
      setWatchRegion((wp as { results: Record<string, TMDBWatchRegion> }).results?.GB ?? null);
      setLoading(false);
    });
  }, [id, type]);

  // Record recently viewed and load pause state
  useEffect(() => {
    if (!user || !media) return;
    const title = media.title || media.name || '';
    recordRecentlyViewed(user.id, { tmdb_id: id, media_type: type, title, poster_path: media.poster_path ?? null }).catch(() => {});
    supabase.from('continue_watching').select('*').eq('user_id', user.id).eq('tmdb_id', id).eq('media_type', type).maybeSingle()
      .then(({ data }) => {
        if (data) {
          setIsPaused(true);
          if (data.season_number != null) {
            setPausedEpisode({ season: data.season_number, episode: data.episode_number ?? 1, name: data.episode_name ?? '' });
          }
        }
      });
  }, [user, media, id, type]);

  useEffect(() => {
    if (!user || !media) return;
    supabase.from('watchlist').select('id').eq('user_id', user.id).eq('tmdb_id', id).eq('media_type', type).maybeSingle()
      .then(({ data }) => setInWatchlist(!!data));
    supabase.from('watched').select('id').eq('user_id', user.id).eq('tmdb_id', id).eq('media_type', type).limit(1).maybeSingle()
      .then(({ data }) => setHasWatched(!!data));
    if (type === 'tv') {
      supabase.from('episode_ratings').select('season_number,episode_number,rating').eq('user_id', user.id).eq('tmdb_id', id)
        .then(({ data }) => {
          const map: Record<string, number> = {};
          data?.forEach(r => { map[`${r.season_number}-${r.episode_number}`] = r.rating; });
          setEpisodeRatings(map);
        });
    }
  }, [user, media, id, type]);

  // Load all ratings for histogram (from ratings table + reviews table)
  async function loadRatings() {
    const [{ data: ratingRows }, { data: reviewRows }] = await Promise.all([
      supabase.from('ratings').select('rating').eq('tmdb_id', id).eq('media_type', type),
      supabase.from('reviews').select('rating').eq('tmdb_id', id).eq('media_type', type).not('rating', 'is', null),
    ]);
    const combined = [
      ...(ratingRows ?? []).map(r => Number(r.rating)),
      ...(reviewRows ?? []).filter(r => r.rating != null).map(r => Number(r.rating)),
    ];
    // deduplicate: prefer ratings table, but include review ratings for users who only reviewed
    setAllRatings(combined);
  }

  useEffect(() => { loadRatings(); }, [id, type]);

  const loadReviews = useCallback(async () => {
    // Load public reviews for display
    const { data } = await supabase
      .from('reviews').select('*').eq('tmdb_id', id).eq('media_type', type).eq('is_public', true)
      .order('created_at', { ascending: false });

    const publicData = data ?? [];
    const userIds = [...new Set(publicData.map(r => r.user_id))];

    let pmap: Record<string, { username: string; avatar_url: string; is_verified?: boolean }> = {};
    if (userIds.length) {
      const { data: profiles } = await supabase.from('profiles').select('id,username,avatar_url,is_verified').in('id', userIds);
      profiles?.forEach((p: { id: string; username: string; avatar_url: string; is_verified?: boolean }) => {
        pmap[p.id] = { username: p.username, avatar_url: p.avatar_url, is_verified: p.is_verified };
      });
    }

    const mapped = publicData.map(r => ({
      ...r,
      username: pmap[r.user_id]?.username ?? 'Unknown',
      avatar_url: pmap[r.user_id]?.avatar_url ?? '',
      is_verified: pmap[r.user_id]?.is_verified ?? false,
    }));
    setReviews(mapped);

    // Load which reviews current user liked
    if (user && publicData.length) {
      const reviewIds = publicData.map(r => r.id);
      const { data: likedRows } = await supabase.from('review_likes').select('review_id').eq('user_id', user.id).in('review_id', reviewIds);
      setLikedReviewIds(new Set((likedRows ?? []).map((l: { review_id: string }) => l.review_id)));
    }

    // Load own review separately (may be private — not in public list above)
    if (user) {
      const { data: own } = await supabase
        .from('reviews').select('*').eq('tmdb_id', id).eq('media_type', type).eq('user_id', user.id).maybeSingle();
      if (own) {
        setOwnReviewId(own.id);
        setUserReview(own.content ?? '');
        setUserRating(Number(own.rating) || 0);
        setReviewPublic(own.is_public);
      } else {
        setOwnReviewId(null);
      }
    }
  }, [id, type, user]);

  useEffect(() => { if (media) loadReviews(); }, [media, id, type, user]);

  // Realtime: refresh ratings + reviews when other users post
  useEffect(() => {
    const channel = supabase
      .channel(`media-${type}-${id}-realtime`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reviews', filter: `tmdb_id=eq.${id}` }, () => {
        loadReviews();
        loadRatings();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ratings', filter: `tmdb_id=eq.${id}` }, () => {
        loadRatings();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id, type]);

  async function toggleWatchlist() {
    if (!user) { requireAuth?.('Sign in to save films to your watchlist.'); return; }
    if (!media) return;
    if (inWatchlist) {
      await supabase.from('watchlist').delete().eq('user_id', user.id).eq('tmdb_id', id).eq('media_type', type);
      setInWatchlist(false);
    } else {
      await supabase.from('watchlist').insert({ user_id: user.id, tmdb_id: id, media_type: type, title: media.title || media.name || '', poster_path: media.poster_path || '' });
      setInWatchlist(true);
    }
  }

  async function togglePause(episodeInfo?: { season: number; episode: number; name: string }) {
    if (!user || !media) { requireAuth?.('Sign in to track your progress.'); return; }
    setSavingPause(true);
    const title = media.title || media.name || '';
    if (isPaused && !episodeInfo) {
      await clearPaused(user.id, id, type);
      setIsPaused(false);
      setPausedEpisode(null);
    } else {
      const ep = episodeInfo ?? pausedEpisode;
      await setPaused(user.id, {
        tmdb_id: id, media_type: type, title, poster_path: media.poster_path ?? null,
        season_number: ep?.season ?? null,
        episode_number: ep?.episode ?? null,
        episode_name: ep?.name ?? null,
      });
      setIsPaused(true);
      if (episodeInfo) setPausedEpisode(episodeInfo);
    }
    setSavingPause(false);
  }

  async function submitRatingReview() {
    if (!user) { requireAuth?.('Sign in to rate or review.'); return; }
    setReviewError('');

    const trimmed = userReview.trim();
    if (trimmed && containsOffensiveContent(trimmed)) {
      setReviewError(MODERATION_ERROR);
      return;
    }
    if (trimmed && likelyContainsSpoilers(trimmed) && !spoilerConfirmed) {
      setSpoilerWarned(true);
      return;
    }

    setSavingReview(true);

    // ownReviewId is set if user has any existing review (public or private)
    const existingInList = reviews.find(r => r.user_id === user.id);
    const hasSpoiler = spoilerConfirmed || likelyContainsSpoilers(trimmed);
    const now = new Date().toISOString();

    // ── Optimistic update: update local state immediately ──────────────────
    if (userRating > 0) {
      setAllRatings(prev => {
        const withoutOld = existingInList?.rating != null
          ? (() => { let removed = false; return prev.filter(r => { if (!removed && r === existingInList.rating) { removed = true; return false; } return true; }); })()
          : prev;
        return [...withoutOld, userRating];
      });
    }

    if (trimmed || userRating > 0) {
      const optimisticReview: ReviewWithUser = {
        id: existingInList?.id ?? ownReviewId ?? `temp-${Date.now()}`,
        user_id: user.id,
        content: trimmed,
        rating: userRating > 0 ? userRating : null,
        is_public: reviewPublic,
        has_spoilers: hasSpoiler,
        like_count: existingInList?.like_count ?? 0,
        comment_count: existingInList?.comment_count ?? 0,
        pinned: existingInList?.pinned ?? false,
        created_at: existingInList?.created_at ?? now,
        username: profile?.username ?? 'You',
        avatar_url: profile?.avatar_url ?? '',
        is_verified: false,
      };

      if (existingInList) {
        setReviews(rs => rs.map(r => r.user_id === user.id ? { ...r, ...optimisticReview, id: r.id } : r));
      } else if (reviewPublic) {
        setReviews(rs => [optimisticReview, ...rs]);
      }
    }

    // ── Persist to Supabase ────────────────────────────────────────────────
    if (userRating > 0) {
      await supabase.from('ratings').upsert(
        { user_id: user.id, tmdb_id: id, media_type: type, rating: userRating, updated_at: now },
        { onConflict: 'user_id,tmdb_id,media_type' }
      );
    }

    if (trimmed || userRating > 0) {
      const reviewPayload = {
        user_id: user.id, tmdb_id: id, media_type: type,
        content: trimmed,
        rating: userRating > 0 ? userRating : null,
        is_public: reviewPublic,
        has_spoilers: hasSpoiler,
        updated_at: now,
      };

      // Always upsert — handles both first-save and re-save (unique: user_id,tmdb_id,media_type)
      const { data: upserted } = await supabase.from('reviews').upsert(
        { ...reviewPayload },
        { onConflict: 'user_id,tmdb_id,media_type' }
      ).select().maybeSingle();
      if (upserted) {
        setOwnReviewId(upserted.id);
        setReviews(rs => rs.map(r => r.id.startsWith('temp-') ? { ...r, id: upserted.id } : r));
      }
    }

    // Auto-add to diary when the user rates or reviews
    if (media) {
      const mediaTitle = media.title || media.name || '';
      const today = new Date().toISOString().slice(0, 10);

      // Get runtime for movies; use episode avg for TV
      let runtime = 0;
      try {
        if (type === 'movie') {
          runtime = media.runtime ?? 0;
          if (!runtime) {
            const d = await tmdb.movieDetails(id);
            runtime = d.runtime ?? 0;
          }
        } else {
          const d = await tmdb.tvDetails(id);
          runtime = (d as unknown as { episode_run_time?: number[] }).episode_run_time?.[0] ?? 0;
        }
      } catch { /* skip */ }

      // Insert diary entry for today if none already exists for this item+date
      const { data: existingDiary } = await supabase
        .from('watched').select('id')
        .eq('user_id', user.id).eq('tmdb_id', id).eq('media_type', type)
        .eq('watched_date', today).maybeSingle();
      if (!existingDiary) {
        await supabase.from('watched').insert({
          user_id: user.id, tmdb_id: id, media_type: type,
          title: mediaTitle, poster_path: media.poster_path || '',
          watched_date: today, liked: false, runtime_minutes: runtime,
        });
        setHasWatched(true);
      }
    }

    // Sync true DB state in background (no visual flicker since optimistic already applied)
    loadRatings();
    loadReviews();

    setSavingReview(false);
    setReviewSaved(true);
    setTimeout(() => setReviewSaved(false), 2000);
  }

  async function toggleReviewLike(reviewId: string, currentLiked: boolean, currentCount: number) {
    if (!user) { requireAuth?.('Sign in to like reviews.'); return; }
    const newLiked = !currentLiked;
    const newCount = currentCount + (newLiked ? 1 : -1);

    // Optimistic update
    setLikedReviewIds(s => { const n = new Set(s); newLiked ? n.add(reviewId) : n.delete(reviewId); return n; });
    setReviews(rs => rs.map(r => r.id === reviewId ? { ...r, like_count: Math.max(0, newCount) } : r));

    if (newLiked) {
      await supabase.from('review_likes').insert({ review_id: reviewId, user_id: user.id });
      await supabase.from('reviews').update({ like_count: newCount }).eq('id', reviewId);
      // Notify review owner
      const review = reviews.find(r => r.id === reviewId);
      if (review && review.user_id !== user.id) {
        await supabase.from('notifications').insert({
          user_id: review.user_id,
          type: 'review_like',
          actor_id: user.id,
          reference_id: reviewId,
          reference_type: 'review',
          message: `liked your review`,
          seen: false,
        });
      }
    } else {
      await supabase.from('review_likes').delete().eq('review_id', reviewId).eq('user_id', user.id);
      await supabase.from('reviews').update({ like_count: Math.max(0, newCount) }).eq('id', reviewId);
    }
  }

  async function loadSeason(n: number) {
    if (seasonDetails[n]) return;
    const data = await tmdb.seasonDetails(id, n);
    setSeasonDetails(prev => ({ ...prev, [n]: data }));
  }

  async function rateEpisode(season: number, episode: number, rating: number) {
    if (!user) return;
    setEpisodeRatings(prev => ({ ...prev, [`${season}-${episode}`]: rating }));
    await supabase.from('episode_ratings').upsert(
      { user_id: user.id, tmdb_id: id, season_number: season, episode_number: episode, rating },
      { onConflict: 'user_id,tmdb_id,season_number,episode_number' }
    );
  }

  function seasonAvg(n: number) {
    const det = seasonDetails[n];
    if (!det) return null;
    const rated = det.episodes.map(ep => episodeRatings[`${n}-${ep.episode_number}`]).filter(Boolean);
    if (!rated.length) return null;
    return Math.round(rated.reduce((a, b) => a + b, 0) / rated.length * 10) / 10;
  }

  const avgRating   = allRatings.length ? Math.round(allRatings.reduce((a, b) => a + b, 0) / allRatings.length * 10) / 10 : null;
  const maxBucket   = Math.max(1, ...HALF_STARS.map(s => allRatings.filter(r => r === s).length));
  const ratingCount = allRatings.length;
  const publicReviews = reviews.filter(r => r.is_public && r.content?.trim());

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#000' }}>
      <div style={{ height: 'clamp(200px,35vw,360px)', background: '#111', position: 'relative' }}>
        <button onClick={onBack} style={{ position: 'absolute', top: 16, left: 16, background: 'rgba(0,0,0,.6)', border: 'none', borderRadius: '50%', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <ArrowLeft size={18} color="#fff" />
        </button>
      </div>
    </div>
  );

  if (!media) return null;

  const title    = media.title || media.name || '';
  const year     = (media.release_date || media.first_air_date || '').slice(0, 4);
  const backdrop = backdropUrl(media.backdrop_path, 'original');
  const poster   = posterUrl(media.poster_path, 'w500');
  const director = credits?.crew.find(c => c.job === 'Director');
  const cast     = credits?.cast.slice(0, 20) ?? [];

  return (
    <div style={{ minHeight: '100vh', background: '#000', paddingBottom: 96 }} className="animate-fade-in">
      {/* Backdrop */}
      <div style={{ position: 'relative', height: 'clamp(200px,35vw,380px)' }}>
        {backdrop
          ? <img src={backdrop} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <div style={{ width: '100%', height: '100%', background: '#111' }} />}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,.2), rgba(0,0,0,.1) 50%, #000)' }} />
        <button onClick={onBack} style={{ position: 'absolute', top: 16, left: 16, background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(4px)', border: 'none', borderRadius: '50%', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <ArrowLeft size={18} color="#fff" />
        </button>
      </div>

      {/* Two-column layout */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 clamp(16px,4vw,48px)', marginTop: -80, position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', gap: 'clamp(20px,4vw,48px)', alignItems: 'flex-start', flexWrap: 'wrap' }}>

          {/* LEFT: poster + actions */}
          <div style={{ flexShrink: 0, width: 'clamp(120px,16vw,200px)' }}>
            <div style={{ borderRadius: 14, overflow: 'hidden', border: '1px solid #2e2e2e', boxShadow: '0 8px 32px rgba(0,0,0,.9)', marginBottom: 14 }}>
              {poster
                ? <img src={poster} alt={title} style={{ width: '100%', aspectRatio: '2/3', objectFit: 'cover', display: 'block' }} />
                : <div style={{ background: '#1a1a1a', aspectRatio: '2/3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Film size={24} color="#555" /></div>}
            </div>

            <button onClick={toggleWatchlist} style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px', borderRadius: 12, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500, transition: 'all .2s', marginBottom: 8, fontFamily: 'inherit',
              background: inWatchlist ? '#f59e0b' : '#1a1a1a', color: inWatchlist ? '#000' : '#ccc',
            }}>
              {inWatchlist ? <Check size={14} /> : <Plus size={14} />}
              {inWatchlist ? t('btn_in_watchlist') : t('btn_add_watchlist')}
            </button>

            <button onClick={() => onQuickAdd({ tmdb_id: id, media_type: type, title, poster_path: media.poster_path || '' })}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px', borderRadius: 12, border: '1px solid', cursor: 'pointer', fontSize: 13, fontWeight: 500, transition: 'all .2s', fontFamily: 'inherit', marginBottom: 8,
                background: hasWatched ? 'rgba(34,197,94,.1)' : '#1a1a1a',
                borderColor: hasWatched ? 'rgba(34,197,94,.35)' : '#2e2e2e',
                color: hasWatched ? '#4ade80' : '#888',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#f59e0b'; (e.currentTarget as HTMLButtonElement).style.color = '#fbbf24'; (e.currentTarget as HTMLButtonElement).style.background = 'rgba(245,158,11,.08)'; }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = hasWatched ? 'rgba(34,197,94,.35)' : '#2e2e2e';
                (e.currentTarget as HTMLButtonElement).style.color = hasWatched ? '#4ade80' : '#888';
                (e.currentTarget as HTMLButtonElement).style.background = hasWatched ? 'rgba(34,197,94,.1)' : '#1a1a1a';
              }}>
              {hasWatched ? <><Check size={14} /> You've Watched This</> : <><Heart size={14} /> {t('btn_log_film')}</>}
            </button>
            {hasWatched && (
              <p style={{ margin: '-4px 0 8px', color: '#555', fontSize: 11, textAlign: 'center' }}>
                Click to log again (rewatch)
              </p>
            )}

            {/* Pause / mark in-progress */}
            <button
              onClick={() => togglePause()}
              disabled={savingPause}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px', borderRadius: 12, border: '1px solid', cursor: 'pointer', fontSize: 13, fontWeight: 500, transition: 'all .2s', fontFamily: 'inherit', marginBottom: 8,
                background: isPaused ? 'rgba(245,158,11,.12)' : '#1a1a1a',
                borderColor: isPaused ? 'rgba(245,158,11,.4)' : '#2e2e2e',
                color: isPaused ? '#fbbf24' : '#888',
              }}
              onMouseEnter={e => { if (!isPaused) { (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(245,158,11,.4)'; (e.currentTarget as HTMLButtonElement).style.color = '#fbbf24'; } }}
              onMouseLeave={e => { if (!isPaused) { (e.currentTarget as HTMLButtonElement).style.borderColor = '#2e2e2e'; (e.currentTarget as HTMLButtonElement).style.color = '#888'; } }}
            >
              {isPaused ? <><Pause size={14} /> Pause Tracking</> : <><Play size={14} fill="currentColor" /> Start Tracking</>}
            </button>
            {isPaused && pausedEpisode && (
              <p style={{ margin: '-4px 0 8px', color: '#888', fontSize: 11, textAlign: 'center' }}>
                S{pausedEpisode.season} E{pausedEpisode.episode}
              </p>
            )}

            {/* Streaming availability */}
            {watchRegion && <WatchProviders region={watchRegion} />}

          </div>

          {/* RIGHT: content */}
          <div style={{ flex: 1, minWidth: 0, paddingTop: 80 }}>
            <h1 style={{ margin: '0 0 8px', color: '#fff', fontSize: 'clamp(20px,3vw,32px)', fontWeight: 800, lineHeight: 1.2 }}>{title}</h1>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 16 }}>
              {year && <span style={{ color: '#888', fontSize: 14 }}>{year}</span>}
              {media.runtime && <span style={{ color: '#555', fontSize: 13 }}>· {media.runtime}m</span>}
              {type === 'tv' && media.number_of_seasons && <span style={{ color: '#555', fontSize: 13 }}>· {media.number_of_seasons} seasons</span>}
              <span style={{ fontSize: 11, padding: '2px 10px', borderRadius: 20, background: type === 'movie' ? 'rgba(245,158,11,.15)' : 'rgba(59,130,246,.15)', color: type === 'movie' ? '#fbbf24' : '#60a5fa', fontWeight: 600 }}>
                {type === 'movie' ? 'Film' : 'TV'}
              </span>
            </div>

            {media.genres && media.genres.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
                {media.genres.map(g => (
                  <span key={g.id} style={{ background: '#1a1a1a', color: '#ccc', fontSize: 12, padding: '4px 12px', borderRadius: 20, border: '1px solid #2e2e2e' }}>{g.name}</span>
                ))}
              </div>
            )}

            {media.overview && (
              <div style={{ marginBottom: 20 }}>
                <p style={{ margin: 0, color: '#ccc', fontSize: 14, lineHeight: 1.7 }}>{media.overview}</p>
              </div>
            )}
            {media.tagline && <p style={{ margin: '0 0 16px', color: 'rgba(245,158,11,.6)', fontSize: 13, fontStyle: 'italic' }}>"{media.tagline}"</p>}
            {director && <p style={{ margin: '0 0 20px', color: '#555', fontSize: 13 }}>Directed by <span style={{ color: '#fff' }}>{director.name}</span></p>}

            {/* Cast */}
            {cast.length > 0 && (
              <div style={{ marginBottom: 32 }}>
                <h3 style={{ margin: '0 0 14px', color: '#888', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{t('media_cast')}</h3>
                <div className="no-scrollbar" style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 4 }}>
                  {cast.map(actor => {
                    const photo = profileUrl(actor.profile_path);
                    return (
                      <div key={actor.id} style={{ flexShrink: 0, width: 68, cursor: 'pointer', textAlign: 'center' }} onClick={() => onActorClick(actor.id)}>
                        <div style={{ width: 68, height: 68, borderRadius: '50%', overflow: 'hidden', background: '#1a1a1a', border: '2px solid #2e2e2e', marginBottom: 6, transition: 'border-color .2s' }}
                          onMouseEnter={e => (e.currentTarget.style.borderColor = '#f59e0b')}
                          onMouseLeave={e => (e.currentTarget.style.borderColor = '#2e2e2e')}>
                          {photo
                            ? <img src={photo} alt={actor.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                            : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <span style={{ color: '#888', fontSize: 20, fontWeight: 700 }}>{actor.name[0]}</span>
                              </div>}
                        </div>
                        <p style={{ margin: '0 0 2px', color: '#fff', fontSize: 10, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{actor.name}</p>
                        <p style={{ margin: 0, color: '#555', fontSize: 9, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{actor.character}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Rating Block ── */}
            <div style={{ background: '#0d0d0d', borderRadius: 20, padding: 24, border: '1px solid #1a1a1a', marginBottom: 32 }}>
              {/* Qued average — always visible */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <p style={{ margin: '0 0 4px', color: '#555', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Qued Rating</p>
                  {avgRating ? (
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                      <span style={{ color: '#fbbf24', fontSize: 36, fontWeight: 800, lineHeight: 1 }}>{avgRating}</span>
                      <Star size={16} color="#fbbf24" fill="#fbbf24" />
                      <span style={{ color: '#555', fontSize: 12 }}>from {ratingCount} rating{ratingCount !== 1 ? 's' : ''}</span>
                    </div>
                  ) : (
                    <span style={{ color: '#3a3a3a', fontSize: 14 }}>No ratings yet — be first</span>
                  )}
                </div>

                {/* Distribution histogram */}
                {ratingCount > 0 && (
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 52 }}>
                    {HALF_STARS.map(s => {
                      const count  = allRatings.filter(r => r === s).length;
                      const pct    = maxBucket > 0 ? count / maxBucket : 0;
                      const height = Math.max(4, Math.round(pct * 48));
                      const isUser = s === userRating;
                      const pctOfAll = ratingCount > 0 ? Math.round((count / ratingCount) * 100) : 0;
                      const tooltipText = count > 0
                        ? `${count} ${count === 1 ? 'person' : 'people'} rated this ${s} star${s !== 1 ? 's' : ''} — ${pctOfAll}% of ratings`
                        : `No ratings for ${s} stars`;
                      return (
                        <div key={s} style={{ width: 14, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, position: 'relative', cursor: 'pointer' }}
                          title={tooltipText}>
                          {count > 0 && <span style={{ color: '#555', fontSize: 8 }}>{count}</span>}
                          <div style={{ width: '100%', height, borderRadius: '3px 3px 0 0', background: isUser ? '#f59e0b' : 'rgba(245,158,11,.25)', transition: 'all .2s' }} />
                          <span style={{ color: isUser ? '#fbbf24' : '#2e2e2e', fontSize: 7 }}>{s}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Divider */}
              <div style={{ height: 1, background: '#1a1a1a', marginBottom: 20 }} />

              {/* Combined rate + review form */}
              {user ? (
                <div>
                  <p style={{ margin: '0 0 12px', color: '#aaa', fontSize: 13, fontWeight: 600 }}>{t('media_your_rating')}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                    <StarRating value={userRating} onChange={setUserRating} size="lg" />
                    {userRating > 0 && (
                      <>
                        <span style={{ color: '#fbbf24', fontWeight: 700, fontSize: 15 }}>{userRating}</span>
                        <button onClick={() => setUserRating(0)} style={{ background: 'none', border: 'none', color: '#555', fontSize: 11, cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>clear</button>
                      </>
                    )}
                  </div>
                  <textarea
                    value={userReview} onChange={e => { setUserReview(e.target.value); setReviewError(''); setSpoilerWarned(false); }} rows={3}
                    placeholder={t('media_write_review')}
                    style={{ width: '100%', background: '#1a1a1a', border: `1px solid ${reviewError ? 'rgba(239,68,68,.5)' : '#2e2e2e'}`, borderRadius: 12, padding: '11px 14px', color: '#fff', fontSize: 13, outline: 'none', resize: 'none', fontFamily: 'inherit', transition: 'border-color .2s', marginBottom: reviewError || spoilerWarned ? 8 : 12 }}
                    onFocus={e => (e.target.style.borderColor = reviewError ? 'rgba(239,68,68,.5)' : '#f59e0b')}
                    onBlur={e  => (e.target.style.borderColor = reviewError ? 'rgba(239,68,68,.5)' : '#2e2e2e')}
                  />
                  {reviewError && (
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '9px 12px', background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.25)', borderRadius: 10, marginBottom: 12 }}>
                      <AlertTriangle size={14} color="#f87171" style={{ flexShrink: 0, marginTop: 1 }} />
                      <p style={{ margin: 0, color: '#f87171', fontSize: 12, lineHeight: 1.5 }}>{reviewError}</p>
                    </div>
                  )}
                  {spoilerWarned && !spoilerConfirmed && (
                    <div style={{ padding: '10px 14px', background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.25)', borderRadius: 10, marginBottom: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <AlertTriangle size={14} color="#fbbf24" />
                        <p style={{ margin: 0, color: '#fbbf24', fontSize: 12, fontWeight: 600 }}>This review may contain spoilers</p>
                      </div>
                      <p style={{ margin: '0 0 10px', color: '#888', fontSize: 12 }}>Your review will be published with a spoiler warning. Continue?</p>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => { setSpoilerConfirmed(true); setSpoilerWarned(false); }}
                          style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: '#f59e0b', color: '#000', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                          Yes, post with warning
                        </button>
                        <button onClick={() => setSpoilerWarned(false)}
                          style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #2e2e2e', background: 'none', color: '#888', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                          Edit review
                        </button>
                      </div>
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                    {userReview.trim() && (
                      <div style={{ display: 'flex', gap: 6 }}>
                        {(['public', 'private'] as const).map(v => (
                          <button key={v} onClick={() => setReviewPublic(v === 'public')}
                            style={{ padding: '5px 12px', borderRadius: 8, fontSize: 11, fontWeight: 500, cursor: 'pointer', border: 'none', fontFamily: 'inherit', transition: 'all .15s',
                              background: (v === 'public') === reviewPublic ? '#f59e0b' : '#2e2e2e',
                              color: (v === 'public') === reviewPublic ? '#000' : '#888' }}>
                            {v === 'public' ? 'Public' : 'Private'}
                          </button>
                        ))}
                      </div>
                    )}
                    <button onClick={submitRatingReview}
                      disabled={savingReview || (!userRating && !userReview.trim())}
                      className="btn-gold" style={{ padding: '9px 20px', borderRadius: 12, fontSize: 13 }}>
                      {reviewSaved ? '✓ ' + t('media_save_review') : savingReview ? t('media_saving') : t('media_save_review')}
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={() => requireAuth?.('Sign in to rate or review this film.')}
                  style={{ width: '100%', padding: '12px', borderRadius: 12, background: '#1a1a1a', border: '1px solid #2e2e2e', color: '#888', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .2s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#f59e0b'; (e.currentTarget as HTMLButtonElement).style.color = '#fbbf24'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#2e2e2e'; (e.currentTarget as HTMLButtonElement).style.color = '#888'; }}>
                  Sign in to rate or review
                </button>
              )}
            </div>

            {/* Public reviews — visible to guests too */}
            {publicReviews.length > 0 && (
              <div style={{ marginBottom: 32 }}>
                <h3 style={{ margin: '0 0 16px', color: '#888', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  {t('media_reviews')} <span style={{ color: '#555', fontWeight: 400 }}>({publicReviews.length})</span>
                </h3>
                {!user && (
                  <div style={{ marginBottom: 12, padding: '8px 14px', background: 'rgba(245,158,11,.06)', border: '1px solid rgba(245,158,11,.15)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: '#888', fontSize: 12 }}>Sign in to like reviews and see replies</span>
                    <button onClick={() => requireAuth?.('Sign in to interact with reviews.')}
                      style={{ marginLeft: 'auto', padding: '4px 12px', borderRadius: 6, border: 'none', background: '#f59e0b', color: '#000', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
                      Sign in
                    </button>
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {publicReviews.map(r => (
                    <ReviewCard
                      key={r.id}
                      review={r}
                      currentUserId={user?.id}
                      isGuest={!user}
                      isLiked={likedReviewIds.has(r.id)}
                      onRequireAuth={() => requireAuth?.('Sign in to like reviews.')}
                      onToggleLike={() => toggleReviewLike(r.id, likedReviewIds.has(r.id), r.like_count ?? 0)}
                      onCommentCountChange={(delta) => setReviews(rs => rs.map(rv => rv.id === r.id ? { ...rv, comment_count: Math.max(0, (rv.comment_count ?? 0) + delta) } : rv))}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* TV Seasons */}
            {type === 'tv' && seasons.length > 0 && (
              <div style={{ marginBottom: 32 }}>
                <h3 style={{ margin: '0 0 12px', color: '#888', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Seasons &amp; Episodes</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {seasons.map(s => {
                    const isOpen = expandedSeason === s.season_number;
                    const avg    = seasonAvg(s.season_number);
                    return (
                      <div key={s.id} style={{ background: '#111', borderRadius: 14, border: '1px solid #1a1a1a', overflow: 'hidden' }}>
                        <button
                          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: 'none', border: 'none', cursor: 'pointer' }}
                          onClick={async () => { if (!isOpen) await loadSeason(s.season_number); setExpandedSeason(isOpen ? null : s.season_number); }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ textAlign: 'left' }}>
                              <p style={{ margin: 0, color: '#fff', fontSize: 14, fontWeight: 500 }}>{s.name}</p>
                              <p style={{ margin: 0, color: '#888', fontSize: 12 }}>{s.episode_count} episodes</p>
                            </div>
                            {avg && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <Star size={10} color="#fbbf24" fill="#fbbf24" />
                                <span style={{ color: '#fbbf24', fontSize: 12 }}>{avg}</span>
                              </div>
                            )}
                          </div>
                          {isOpen ? <ChevronUp size={15} color="#888" /> : <ChevronDown size={15} color="#888" />}
                        </button>
                        {isOpen && seasonDetails[s.season_number] && (
                          <div style={{ borderTop: '1px solid #1a1a1a' }}>
                            {seasonDetails[s.season_number].episodes.map(ep => {
                              const epRating = episodeRatings[`${s.season_number}-${ep.episode_number}`] ?? 0;
                              return (
                                <div key={ep.id} style={{ padding: '10px 14px', borderBottom: '1px solid rgba(26,26,26,.5)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <p style={{ margin: 0, color: '#ccc', fontSize: 12, fontWeight: 500 }}>E{ep.episode_number} · {ep.name}</p>
                                    {ep.air_date && <p style={{ margin: 0, color: '#555', fontSize: 11 }}>{ep.air_date}</p>}
                                  </div>
                                  <StarRating value={epRating} onChange={r => rateEpisode(s.season_number, ep.episode_number, r)} size="sm" />
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Platform link map for known providers
const PROVIDER_LINKS: Record<number, string> = {
  8:   'https://www.netflix.com',
  9:   'https://www.amazon.co.uk/Prime-Video',
  337: 'https://www.disneyplus.com',
  350: 'https://tv.apple.com',
  29:  'https://www.nowtv.com',
  118: 'https://www.nowtv.com',
  384: 'https://www.hbomax.com',
  15:  'https://www.hulu.com',
  283: 'https://www.crunchyroll.com',
  39:  'https://www.bbc.co.uk/iplayer',
  40:  'https://www.channel4.com',
};

function WatchProviders({ region }: { region: TMDBWatchRegion }) {
  const all: TMDBWatchProvider[] = [];
  const seen = new Set<number>();
  for (const list of [region.flatrate, region.ads, region.free, region.rent, region.buy]) {
    for (const p of list ?? []) {
      if (!seen.has(p.provider_id)) { seen.add(p.provider_id); all.push(p); }
    }
  }
  if (all.length === 0) return null;
  const link = region.link ?? '#';

  return (
    <div style={{ marginTop: 12 }}>
      <p style={{ margin: '0 0 8px', color: '#555', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Watch in UK</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {all.slice(0, 8).map(p => {
          const href = PROVIDER_LINKS[p.provider_id] ?? link;
          return (
            <a key={p.provider_id} href={href} target="_blank" rel="noopener noreferrer"
              title={p.provider_name}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 38, height: 38, borderRadius: 10, overflow: 'hidden', background: '#1a1a1a', border: '1px solid #2e2e2e', transition: 'border-color .2s, transform .15s', flexShrink: 0, textDecoration: 'none' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#f59e0b'; e.currentTarget.style.transform = 'scale(1.08)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#2e2e2e'; e.currentTarget.style.transform = 'scale(1)'; }}>
              <img src={`https://image.tmdb.org/t/p/w45${p.logo_path}`} alt={p.provider_name} style={{ width: 32, height: 32, objectFit: 'cover', borderRadius: 7 }} />
            </a>
          );
        })}
      </div>
    </div>
  );
}

function ReviewCard({ review, currentUserId, isGuest, isLiked, onRequireAuth, onToggleLike, onCommentCountChange }: {
  review: ReviewWithUser;
  currentUserId?: string;
  isGuest?: boolean;
  isLiked?: boolean;
  onRequireAuth?: () => void;
  onToggleLike?: () => void;
  onCommentCountChange?: (delta: number) => void;
}) {
  const { user } = useAuth();
  const isOwn = review.user_id === currentUserId;
  const [spoilerRevealed, setSpoilerRevealed] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<{id: string; user_id: string; content: string; like_count: number; created_at: string; username?: string; avatar_url?: string; isLiked?: boolean}[]>([]);
  const [commentText, setCommentText] = useState('');
  const [commentError, setCommentError] = useState('');
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [localCommentCount, setLocalCommentCount] = useState(review.comment_count ?? 0);
  const showSpoilerBlur = review.has_spoilers && !spoilerRevealed;

  async function loadComments() {
    const { data } = await supabase.from('review_comments').select('*').eq('review_id', review.id).order('created_at', { ascending: true });
    if (!data) return;
    const uids = [...new Set(data.map(c => c.user_id))];
    let pmap: Record<string, { username: string; avatar_url: string }> = {};
    if (uids.length) {
      const { data: profiles } = await supabase.from('profiles').select('id,username,avatar_url').in('id', uids);
      (profiles ?? []).forEach((p: { id: string; username: string; avatar_url: string }) => { pmap[p.id] = p; });
    }
    let likedSet = new Set<string>();
    if (user) {
      const { data: cl } = await supabase.from('comment_likes').select('comment_id').eq('user_id', user.id).in('comment_id', data.map(c => c.id));
      likedSet = new Set((cl ?? []).map((l: { comment_id: string }) => l.comment_id));
    }
    setComments(data.map(c => ({ ...c, username: pmap[c.user_id]?.username, avatar_url: pmap[c.user_id]?.avatar_url, isLiked: likedSet.has(c.id) })));
    setCommentsLoaded(true);
  }

  async function submitComment() {
    if (!user || !commentText.trim()) return;
    setCommentError('');
    if (containsOffensiveContent(commentText)) {
      await recordOffensiveStrike(user.id, supabase);
      setCommentError(MODERATION_ERROR);
      return;
    }
    const suspended = await isUserSuspended(user.id, supabase);
    if (suspended) { setCommentError('Your account is suspended.'); return; }

    const { data: newComment } = await supabase.from('review_comments').insert({ review_id: review.id, user_id: user.id, content: commentText.trim() }).select().single();
    if (newComment) {
      // Notify review owner
      if (review.user_id !== user.id) {
        await supabase.from('notifications').insert({ user_id: review.user_id, type: 'review_comment', actor_id: user.id, reference_id: review.id, reference_type: 'review', message: `commented on your review`, seen: false });
      }
      const newCount = localCommentCount + 1;
      // Update comment_count in DB and local state instantly
      await supabase.from('reviews').update({ comment_count: newCount }).eq('id', review.id);
      setLocalCommentCount(newCount);
      onCommentCountChange?.(1);
      setCommentText('');
      loadComments();
    }
  }

  async function toggleCommentLike(commentId: string, curLiked: boolean, curCount: number) {
    if (!user) return;
    const newCount = curCount + (curLiked ? -1 : 1);
    setComments(cs => cs.map(c => c.id === commentId ? { ...c, isLiked: !curLiked, like_count: Math.max(0, newCount) } : c));
    if (curLiked) {
      await supabase.from('comment_likes').delete().eq('comment_id', commentId).eq('user_id', user.id);
      await supabase.from('review_comments').update({ like_count: Math.max(0, newCount) }).eq('id', commentId);
    } else {
      await supabase.from('comment_likes').insert({ comment_id: commentId, user_id: user.id });
      await supabase.from('review_comments').update({ like_count: newCount }).eq('id', commentId);
    }
  }

  function handleToggleComments() {
    if (!commentsLoaded) loadComments();
    setShowComments(s => !s);
  }

  return (
    <div style={{ background: '#111', borderRadius: 16, padding: '16px 18px', border: `1px solid ${review.pinned ? 'rgba(245,158,11,.3)' : '#1a1a1a'}` }}>
      {review.pinned && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
          <Star size={11} color="#f59e0b" fill="#f59e0b" />
          <span style={{ color: '#f59e0b', fontSize: 11, fontWeight: 600 }}>Pinned Review</span>
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', overflow: 'hidden', background: '#2e2e2e', border: '1px solid #3a3a3a', flexShrink: 0 }}>
          {review.avatar_url
            ? <img src={review.avatar_url} alt={review.username} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ color: '#fbbf24', fontWeight: 700, fontSize: 14 }}>{review.username?.[0]?.toUpperCase()}</span>
              </div>}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ color: isOwn ? '#fbbf24' : '#fff', fontWeight: 600, fontSize: 13 }}>{review.username}{isOwn && ' (you)'}</span>
            {review.is_verified && <BadgeCheck size={14} color="#60a5fa" />}
            {/* Public/private indicator */}
            {isOwn && (
              <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 20, fontWeight: 600, border: '1px solid',
                background: review.is_public ? 'rgba(74,222,128,.08)' : 'rgba(156,163,175,.08)',
                borderColor: review.is_public ? 'rgba(74,222,128,.3)' : 'rgba(156,163,175,.25)',
                color: review.is_public ? '#4ade80' : '#9ca3af',
              }}>
                {review.is_public ? 'Public' : 'Private'}
              </span>
            )}
            {review.has_spoilers && (
              <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: 'rgba(245,158,11,.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,.25)', fontWeight: 600 }}>
                Spoilers
              </span>
            )}
            {review.rating != null && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                {Array.from({ length: 5 }).map((_, i) => {
                  const filled = (i + 1) <= (review.rating ?? 0);
                  const half   = !filled && (i + 0.5) < (review.rating ?? 0);
                  return (
                    <Star key={i} size={11} color="#fbbf24" fill={filled ? '#fbbf24' : half ? 'url(#half)' : 'none'} />
                  );
                })}
                <span style={{ color: '#fbbf24', fontSize: 12, fontWeight: 600, marginLeft: 2 }}>{review.rating}</span>
              </div>
            )}
          </div>
          <span style={{ color: '#555', fontSize: 11 }}>{new Date(review.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
        </div>
      </div>
      <div style={{ position: 'relative' }}>
        <p style={{ margin: 0, color: '#ccc', fontSize: 13, lineHeight: 1.65, filter: showSpoilerBlur ? 'blur(6px)' : 'none', userSelect: showSpoilerBlur ? 'none' : 'auto', transition: 'filter .2s' }}>
          {review.content}
        </p>
        {showSpoilerBlur && (
          <button onClick={() => setSpoilerRevealed(true)}
            style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'rgba(0,0,0,.1)', border: 'none', cursor: 'pointer', borderRadius: 8, fontFamily: 'inherit' }}>
            <Eye size={18} color="#f59e0b" />
            <span style={{ color: '#f59e0b', fontSize: 12, fontWeight: 600 }}>Reveal spoilers</span>
          </button>
        )}
        {review.has_spoilers && spoilerRevealed && (
          <button onClick={() => setSpoilerRevealed(false)}
            style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', color: '#555', fontSize: 11, fontFamily: 'inherit', padding: 0 }}
            onMouseEnter={e => (e.currentTarget.style.color = '#888')}
            onMouseLeave={e => (e.currentTarget.style.color = '#555')}>
            <EyeOff size={11} /> Hide spoilers
          </button>
        )}
      </div>

      {/* Bottom actions row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 12 }}>
        {/* Like button */}
        <button
          onClick={isGuest ? onRequireAuth : onToggleLike}
          style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: isLiked ? '#f87171' : '#555', fontSize: 12, fontFamily: 'inherit', transition: 'color .15s' }}
          onMouseEnter={e => { if (!isLiked) (e.currentTarget as HTMLButtonElement).style.color = '#f87171'; }}
          onMouseLeave={e => { if (!isLiked) (e.currentTarget as HTMLButtonElement).style.color = '#555'; }}
        >
          <Heart size={13} fill={isLiked ? 'currentColor' : 'none'} />
          <span>{review.like_count ?? 0}</span>
        </button>

        {/* Comments */}
        <button
          onClick={handleToggleComments}
          style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: showComments ? '#60a5fa' : '#555', fontSize: 12, fontFamily: 'inherit', transition: 'color .15s' }}
          onMouseEnter={e => { if (!showComments) (e.currentTarget as HTMLButtonElement).style.color = '#60a5fa'; }}
          onMouseLeave={e => { if (!showComments) (e.currentTarget as HTMLButtonElement).style.color = '#555'; }}
        >
          <MessageSquare size={13} />
          <span>{localCommentCount} {showComments ? 'Hide' : localCommentCount === 1 ? 'Reply' : 'Replies'}</span>
        </button>
      </div>

      {/* Comments section */}
      {showComments && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #1e1e1e' }}>
          {comments.map(c => (
            <div key={c.id} style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#1e1e1e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fbbf24', flexShrink: 0, overflow: 'hidden' }}>
                {c.avatar_url
                  ? <img src={c.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : c.username?.[0]?.toUpperCase()}
              </div>
              <div style={{ flex: 1, background: '#1a1a1a', borderRadius: '10px 10px 10px 2px', padding: '8px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 3 }}>
                  <span style={{ color: '#e5e5e5', fontSize: 12, fontWeight: 600 }}>{c.username}</span>
                  <span style={{ color: '#444', fontSize: 10 }}>{new Date(c.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                </div>
                <p style={{ margin: 0, color: '#bbb', fontSize: 12, lineHeight: 1.5 }}>{c.content}</p>
                <button
                  onClick={() => toggleCommentLike(c.id, c.isLiked ?? false, c.like_count)}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6, background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: c.isLiked ? '#f87171' : '#555', fontSize: 11, fontFamily: 'inherit' }}
                >
                  <Heart size={10} fill={c.isLiked ? 'currentColor' : 'none'} /> {c.like_count}
                </button>
              </div>
            </div>
          ))}

          {/* Comment error */}
          {commentError && <p style={{ color: '#ef4444', fontSize: 12, margin: '0 0 8px' }}>{commentError}</p>}

          {/* Comment input / sign-in prompt */}
          {user ? (
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <textarea
                value={commentText}
                onChange={e => { setCommentText(e.target.value); setCommentError(''); }}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitComment(); } }}
                placeholder="Add a reply..."
                rows={1}
                maxLength={500}
                style={{ flex: 1, background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: 10, padding: '8px 12px', color: '#e5e5e5', fontSize: 12, resize: 'none', fontFamily: 'inherit', outline: 'none', lineHeight: 1.5 }}
              />
              <button
                onClick={submitComment}
                disabled={!commentText.trim()}
                style={{ width: 30, height: 30, borderRadius: 8, border: 'none', background: commentText.trim() ? '#f59e0b' : '#1a1a1a', cursor: commentText.trim() ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background .2s' }}
              >
                <Send size={12} color={commentText.trim() ? '#000' : '#333'} />
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '8px 12px', background: '#1a1a1a', borderRadius: 10, border: '1px solid #2e2e2e' }}>
              <span style={{ color: '#555', fontSize: 12 }}>Sign in to reply</span>
              <button onClick={onRequireAuth} style={{ padding: '3px 10px', borderRadius: 6, border: 'none', background: '#f59e0b', color: '#000', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>Sign in</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
