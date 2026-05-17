import { useEffect, useState, useRef } from 'react';
import { Film, Tv, Clock, Users, Heart, Star, BookOpen, Settings, Trash2, Trophy, Plus, X, Crown, ChartBar as BarChart2, Search } from 'lucide-react';
import { formatWatchTime } from '../lib/formatWatchTime';
import { supabase } from '../lib/supabase';
import type { WatchedEntry, WatchlistItem, Achievement } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { posterUrl, tmdb } from '../lib/tmdb';
import type { TMDBMedia } from '../lib/tmdb';
import FollowListModal from '../components/FollowListModal';

type FavFilmEntry = { tmdb_id: number; title: string; poster_path: string; media_type: 'movie' | 'tv' };

interface ProfilePageProps {
  onMediaClick: (id: number, type: 'movie' | 'tv') => void;
  onWatchedClick: () => void;
  onDiaryClick: () => void;
  onMemberClick: (userId: string) => void;
  onSettingsClick: () => void;
  onStatsClick?: () => void;
  onLeaderboardsClick?: () => void;
  onProClick?: () => void;
}

type ProfileTab = 'diary' | 'stats' | 'achievements';
type RatingMap = Record<string, number>;

export default function ProfilePage({ onMediaClick, onDiaryClick, onSettingsClick, onMemberClick, onStatsClick, onLeaderboardsClick, onProClick }: ProfilePageProps) {
  const { user, profile, signOut } = useAuth();

  const [watched,    setWatched]    = useState<WatchedEntry[]>([]);
  const [ratings,    setRatings]    = useState<RatingMap>({});
  const [watchlist,  setWatchlist]  = useState<WatchlistItem[]>([]);
  const [stats,      setStats]      = useState({ movies: 0, shows: 0, movieMins: 0, showMins: 0, followers: 0, following: 0, reviews: 0, likes: 0 });
  const [activeTab,  setActiveTab]  = useState<ProfileTab>('diary');
  const [loading,    setLoading]    = useState(true);

  const [followModal, setFollowModal] = useState<'followers' | 'following' | null>(null);
  const [removeConfirm, setRemoveConfirm] = useState<string | null>(null);

  const [achievements,     setAchievements]     = useState<Achievement[]>([]);
  const [userAchievements, setUserAchievements] = useState<Set<string>>(new Set());
  const [newAchievement,   setNewAchievement]   = useState<Achievement | null>(null);

  const [favFilms,     setFavFilms]     = useState<FavFilmEntry[]>([]);
  const [showFavSearch, setShowFavSearch] = useState(false);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    Promise.all([
      supabase.from('watched').select('*').eq('user_id', user.id).order('watched_date', { ascending: false }),
      supabase.from('watchlist').select('*').eq('user_id', user.id).order('added_at', { ascending: false }),
      supabase.from('follows').select('id').eq('following_id', user.id),
      supabase.from('follows').select('id').eq('follower_id', user.id),
      supabase.from('reviews').select('id').eq('user_id', user.id),
      supabase.from('likes').select('watched_id').eq('user_id', user.id),
      supabase.from('ratings').select('tmdb_id, media_type, rating').eq('user_id', user.id),
    ]).then(([wr, wlr, flr, fgr, revr, lkr, rr]) => {
      const w = (wr.data ?? []) as WatchedEntry[];
      const ratingMap: RatingMap = {};
      (rr.data ?? []).forEach((row: { tmdb_id: number; media_type: string; rating: number }) => {
        ratingMap[`${row.tmdb_id}-${row.media_type}`] = Number(row.rating);
      });
      setWatched(w);
      setRatings(ratingMap);
      setWatchlist((wlr.data ?? []) as WatchlistItem[]);
      const movies = w.filter(e => e.media_type === 'movie');
      const shows  = w.filter(e => e.media_type === 'tv');
      setStats({
        movies:    movies.length,
        shows:     shows.length,
        movieMins: movies.reduce((s, e) => s + (e.runtime_minutes ?? 0), 0),
        showMins:  shows.reduce((s, e) => s + (e.runtime_minutes ?? 0), 0),
        followers: flr.data?.length ?? 0,
        following: fgr.data?.length ?? 0,
        reviews:   revr.data?.length ?? 0,
        likes:     lkr.data?.length ?? 0,
      });
      setLoading(false);
    });
  }, [user]);

  useEffect(() => {
    if (profile) {
      const favs = (profile as unknown as Record<string, unknown>).favourite_films;
      if (Array.isArray(favs)) setFavFilms(favs as FavFilmEntry[]);
    }
  }, [profile]);

  useEffect(() => {
    if (!user) return;
    async function loadAchievements() {
      const [{ data: all }, { data: earned }] = await Promise.all([
        supabase.from('achievements').select('*').order('category').order('threshold'),
        supabase.from('user_achievements').select('achievement_id').eq('user_id', user!.id),
      ]);
      setAchievements((all ?? []) as Achievement[]);
      const earnedSet = new Set((earned ?? []).map((r: { achievement_id: string }) => r.achievement_id));
      setUserAchievements(earnedSet);
    }
    loadAchievements();
  }, [user]);

  async function checkAndAwardAchievement(achievementId: string) {
    if (!user || userAchievements.has(achievementId)) return;
    const { error } = await supabase.from('user_achievements').insert({ user_id: user.id, achievement_id: achievementId });
    if (!error) {
      setUserAchievements(s => new Set([...s, achievementId]));
      const achievement = achievements.find(a => a.id === achievementId);
      if (achievement) { setNewAchievement(achievement); setTimeout(() => setNewAchievement(null), 4000); }
    }
  }

  useEffect(() => {
    if (loading || achievements.length === 0) return;
    const totalFilms = stats.movies + stats.shows;
    if (totalFilms >= 1)    checkAndAwardAchievement('first_watch');
    if (stats.movies >= 10) checkAndAwardAchievement('ten_films');
    if (stats.movies >= 50) checkAndAwardAchievement('fifty_films');
    if (stats.movies >= 100) checkAndAwardAchievement('hundred_films');
    if (stats.movies >= 500) checkAndAwardAchievement('five_hundred');
    if (stats.movies >= 1000) checkAndAwardAchievement('thousand_films');
    if (stats.reviews >= 1) checkAndAwardAchievement('first_review');
    if (stats.reviews >= 10) checkAndAwardAchievement('ten_reviews');
    if (stats.followers >= 10) checkAndAwardAchievement('ten_followers');
    if (stats.followers >= 50) checkAndAwardAchievement('fifty_followers');
    if (stats.following >= 1) checkAndAwardAchievement('first_follow');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, stats, achievements]);

  async function saveFavFilms(films: FavFilmEntry[]) {
    if (!user) return;
    setFavFilms(films);
    await supabase.from('profiles').update({ favourite_films: films }).eq('id', user.id);
  }

  async function removeWatched(entryId: string) {
    const entry = watched.find(e => e.id === entryId);
    if (!entry || !user) return;
    await supabase.from('watched').delete().eq('id', entryId);
    setWatched(w => w.filter(e => e.id !== entryId));
    const mins = entry.runtime_minutes ?? 0;
    if (entry.media_type === 'movie') {
      setStats(s => ({ ...s, movieMins: Math.max(0, s.movieMins - mins), movies: s.movies - 1 }));
    } else {
      setStats(s => ({ ...s, showMins: Math.max(0, s.showMins - mins), shows: s.shows - 1 }));
    }
    setRemoveConfirm(null);
  }

  const totalMins  = stats.movieMins + stats.showMins;

  return (
    <div style={{ minHeight: '100vh', background: '#000', paddingBottom: 96 }} className="animate-fade-in">
      {/* Sticky header */}
      <div style={{ position: 'sticky', top: 56, zIndex: 10, background: 'rgba(0,0,0,.92)', backdropFilter: 'blur(8px)', borderBottom: '1px solid #1a1a1a', padding: '14px clamp(16px,4vw,48px)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ margin: 0, color: '#fff', fontSize: 17, fontWeight: 700 }}>My Qued</h1>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <button onClick={onSettingsClick}
            style={{ display: 'flex', alignItems: 'center', background: 'none', border: 'none', color: '#555', cursor: 'pointer', transition: 'color .2s', padding: 4 }}
            title="Settings"
            onMouseEnter={e => (e.currentTarget.style.color = '#fbbf24')}
            onMouseLeave={e => (e.currentTarget.style.color = '#555')}>
            <Settings size={16} />
          </button>
          <button onClick={signOut} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
            onMouseLeave={e => (e.currentTarget.style.color = '#888')}>Sign out</button>
        </div>
      </div>

      <div style={{ padding: '28px clamp(16px,4vw,48px) 0', maxWidth: 800, margin: '0 auto' }}>

        {/* Profile header — display only, no editing here */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20, marginBottom: 32 }}>
          <div style={{ width: 80, height: 80, borderRadius: 20, overflow: 'hidden', background: '#1a1a1a', border: '2px solid #2e2e2e', flexShrink: 0 }}>
            {profile?.avatar_url
              ? <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ color: '#ccc', fontSize: 28, fontWeight: 700 }}>{profile?.username?.[0]?.toUpperCase() ?? '?'}</span>
                </div>}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
              <h2 style={{ margin: 0, color: '#fff', fontSize: 22, fontWeight: 700 }}>{profile?.username ?? 'Anonymous'}</h2>
              {profile?.role === 'pro' && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(245,158,11,.15)', border: '1px solid rgba(245,158,11,.35)', borderRadius: 100, padding: '2px 8px' }}>
                  <Crown size={10} color="#f59e0b" />
                  <span style={{ color: '#f59e0b', fontSize: 10, fontWeight: 700 }}>PRO</span>
                </span>
              )}
            </div>
            <p style={{ margin: '0 0 10px', color: '#888', fontSize: 13, lineHeight: 1.5 }}>{profile?.bio || 'No bio yet'}</p>
            {profile?.created_at && (
              <p style={{ margin: '0 0 14px', color: '#444', fontSize: 11 }}>
                Member since {new Date(profile.created_at).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
              </p>
            )}
            <div style={{ display: 'flex', gap: 20 }}>
              <button onClick={() => setFollowModal('followers')}
                style={{ textAlign: 'center', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit', transition: 'opacity .2s' }}
                onMouseEnter={e => (e.currentTarget.style.opacity = '.7')}
                onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
                <p style={{ margin: 0, color: '#fff', fontWeight: 700, fontSize: 18 }}>{stats.followers}</p>
                <p style={{ margin: 0, color: '#888', fontSize: 11 }}>Followers</p>
              </button>
              <button onClick={() => setFollowModal('following')}
                style={{ textAlign: 'center', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit', transition: 'opacity .2s' }}
                onMouseEnter={e => (e.currentTarget.style.opacity = '.7')}
                onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
                <p style={{ margin: 0, color: '#fff', fontWeight: 700, fontSize: 18 }}>{stats.following}</p>
                <p style={{ margin: 0, color: '#888', fontSize: 11 }}>Following</p>
              </button>
            </div>
          </div>
        </div>

        {/* Quick links */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {onStatsClick && (
            <button onClick={onStatsClick} className="btn-ghost" style={{ fontSize: 12, padding: '7px 14px', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              <BarChart2 size={13} /> Advanced Stats
              {profile?.role !== 'pro' && profile?.role !== 'admin' && <Crown size={11} color="#f59e0b" />}
            </button>
          )}
          {onLeaderboardsClick && (
            <button onClick={onLeaderboardsClick} className="btn-ghost" style={{ fontSize: 12, padding: '7px 14px', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Trophy size={13} /> Leaderboards
            </button>
          )}
          {onProClick && profile?.role !== 'pro' && profile?.role !== 'admin' && (
            <button onClick={onProClick} style={{ fontSize: 12, padding: '7px 14px', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(245,158,11,.1)', border: '1px solid rgba(245,158,11,.3)', color: '#f59e0b', cursor: 'pointer', fontFamily: 'inherit', transition: 'all .2s' }}>
              <Crown size={13} /> Go Pro
            </button>
          )}
        </div>

        {/* Quick stats strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 28 }}>
          <MiniStat label="Films" value={String(stats.movies)} icon={<Film size={13} />} />
          <MiniStat label="Shows" value={String(stats.shows)} icon={<Tv size={13} />} />
          <MiniStat label="Watch Time" value={formatWatchTime(totalMins)} icon={<Clock size={13} />} />
        </div>

        {/* Top 5 Favourite Films & Shows */}
        <FavouriteFilmsSection
          films={favFilms}
          onSave={saveFavFilms}
          showSearch={showFavSearch}
          onToggleSearch={() => setShowFavSearch(s => !s)}
        />

        {/* Tabs: Diary, Stats, Achievements */}
        <div style={{ display: 'flex', background: '#111', borderRadius: 14, padding: 3, marginBottom: 20, gap: 3 }}>
          {([
            ['diary',        'Diary',        BookOpen],
            ['stats',        'Stats',        Star],
            ['achievements', 'Achievements', Trophy],
          ] as const).map(([t, label, Icon]) => (
            <button key={t} onClick={() => setActiveTab(t)}
              style={{ flex: 1, padding: '9px 0', borderRadius: 11, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500, transition: 'all .2s', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                background: activeTab === t ? '#f59e0b' : 'transparent', color: activeTab === t ? '#000' : '#888' }}>
              <Icon size={13} />
              {label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === 'diary' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
              <button onClick={onDiaryClick} className="btn-ghost" style={{ fontSize: 12, padding: '6px 14px', borderRadius: 8 }}>
                View All
              </button>
            </div>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, padding: '12px 0', borderBottom: '1px solid #111' }}>
                  <div className="shimmer" style={{ width: 44, height: 66, borderRadius: 6, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div className="shimmer" style={{ height: 14, width: '50%', borderRadius: 4, marginBottom: 6 }} />
                    <div className="shimmer" style={{ height: 11, width: '30%', borderRadius: 4 }} />
                  </div>
                </div>
              ))
            ) : watched.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 0' }}>
                <Film size={32} color="#2e2e2e" style={{ margin: '0 auto 8px', display: 'block' }} />
                <p style={{ margin: 0, color: '#555', fontSize: 14 }}>No diary entries yet</p>
              </div>
            ) : (
              watched.map(item => {
                const ps = posterUrl(item.poster_path);
                const rating = ratings[`${item.tmdb_id}-${item.media_type}`];
                const d = new Date(item.watched_date + 'T00:00:00');
                const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                return (
                  <div key={item.id}
                    style={{ display: 'flex', gap: 12, padding: '12px 0', borderBottom: '1px solid #111', borderRadius: 4, transition: 'background .15s', alignItems: 'center' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#0a0a0a')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <div onClick={() => onMediaClick(item.tmdb_id, item.media_type)} style={{ width: 44, height: 66, borderRadius: 6, overflow: 'hidden', background: '#1a1a1a', border: '1px solid #2e2e2e', flexShrink: 0, cursor: 'pointer' }}>
                      {ps ? <img src={ps} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" /> : <Film size={12} color="#555" />}
                    </div>
                    <div onClick={() => onMediaClick(item.tmdb_id, item.media_type)} style={{ flex: 1, cursor: 'pointer', minWidth: 0 }}>
                      <p style={{ margin: '0 0 3px', color: '#fff', fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <p style={{ margin: 0, color: '#555', fontSize: 12 }}>{dateStr}</p>
                        <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 20, background: item.media_type === 'movie' ? 'rgba(245,158,11,.15)' : 'rgba(96,165,250,.15)', color: item.media_type === 'movie' ? '#fbbf24' : '#60a5fa' }}>
                          {item.media_type === 'movie' ? 'Film' : 'TV'}
                        </span>
                        {rating != null && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: '#fbbf24', fontSize: 11, fontWeight: 700 }}>
                            <Star size={10} color="#f59e0b" fill="#f59e0b" />
                            {rating}
                          </span>
                        )}
                        {item.liked && <Heart size={10} color="#f87171" fill="#f87171" />}
                      </div>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); setRemoveConfirm(item.id); }}
                      style={{ flexShrink: 0, width: 28, height: 28, borderRadius: 8, background: 'none', border: '1px solid #2e2e2e', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555', transition: 'all .2s' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = '#ef4444'; e.currentTarget.style.color = '#ef4444'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = '#2e2e2e'; e.currentTarget.style.color = '#555'; }}
                      title="Remove from diary"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        )}

        {activeTab === 'stats' && (
          <div>
            {/* Watch time breakdown */}
            <div style={{ background: '#0d0d0d', borderRadius: 16, border: '1px solid #1a1a1a', padding: '18px 20px', marginBottom: 16 }}>
              <p style={{ margin: '0 0 14px', color: '#888', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Total Watch Time</p>
              <p style={{ margin: '0 0 6px', color: '#fff', fontSize: 22, fontWeight: 800, lineHeight: 1.3 }}>{formatWatchTime(totalMins)}</p>
              <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Film size={12} color="#fbbf24" />
                  <span style={{ color: '#888', fontSize: 12 }}>Films: <span style={{ color: '#fff', fontWeight: 600 }}>{formatWatchTime(stats.movieMins)}</span></span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Tv size={12} color="#60a5fa" />
                  <span style={{ color: '#888', fontSize: 12 }}>Shows: <span style={{ color: '#fff', fontWeight: 600 }}>{formatWatchTime(stats.showMins)}</span></span>
                </div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
              <StatCard label="Films Watched"   value={String(stats.movies)}      icon={<Film size={16} />} />
              <StatCard label="Shows Watched"   value={String(stats.shows)}       icon={<Tv size={16} />} />
              <StatCard label="Followers"       value={String(stats.followers)}   icon={<Users size={16} />} onClick={() => setFollowModal('followers')} />
              <StatCard label="Following"       value={String(stats.following)}   icon={<Users size={16} />} onClick={() => setFollowModal('following')} />
              <StatCard label="Reviews Written" value={String(stats.reviews)}     icon={<Star size={16} />} />
              <StatCard label="Likes Received"  value={String(stats.likes)}       icon={<Heart size={16} />} />
              <StatCard label="Watchlist"       value={String(watchlist.length)}  icon={<Plus size={16} />} />
            </div>
          </div>
        )}

        {activeTab === 'achievements' && (
          <AchievementsGrid achievements={achievements} unlocked={userAchievements} />
        )}
      </div>

      {/* Remove confirmation */}
      {removeConfirm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.7)', backdropFilter: 'blur(4px)', padding: 16 }}>
          <div className="animate-slide-up" style={{ background: '#111', borderRadius: 16, border: '1px solid #2e2e2e', padding: '24px 28px', maxWidth: 340, width: '100%', textAlign: 'center' }}>
            <Trash2 size={24} color="#f87171" style={{ margin: '0 auto 12px', display: 'block' }} />
            <p style={{ margin: '0 0 6px', color: '#fff', fontSize: 15, fontWeight: 600 }}>Remove from diary?</p>
            <p style={{ margin: '0 0 20px', color: '#888', fontSize: 13 }}>This will also subtract the runtime from your watch time.</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={() => removeWatched(removeConfirm)} style={{ padding: '9px 20px', borderRadius: 10, border: 'none', background: '#ef4444', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Remove</button>
              <button onClick={() => setRemoveConfirm(null)} className="btn-ghost" style={{ padding: '9px 20px', borderRadius: 10, fontSize: 13 }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {followModal && user && (
        <FollowListModal
          userId={user.id}
          mode={followModal}
          onClose={() => setFollowModal(null)}
          onMemberClick={onMemberClick}
        />
      )}

      {/* Achievement unlocked toast */}
      {newAchievement && (
        <div className="animate-slide-up" style={{ position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)', zIndex: 300, background: '#1a1200', border: '1px solid rgba(245,158,11,.5)', borderRadius: 16, padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 14, boxShadow: '0 8px 40px rgba(245,158,11,.2)', minWidth: 280, maxWidth: 360 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(245,158,11,.2)', border: '1px solid rgba(245,158,11,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Trophy size={18} color="#f59e0b" />
          </div>
          <div>
            <p style={{ margin: '0 0 2px', color: '#fbbf24', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Achievement Unlocked!</p>
            <p style={{ margin: '0 0 2px', color: '#fff', fontSize: 14, fontWeight: 700 }}>{newAchievement.title}</p>
            <p style={{ margin: 0, color: '#888', fontSize: 12 }}>{newAchievement.description}</p>
          </div>
          <button onClick={() => setNewAchievement(null)} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', padding: 0, marginLeft: 'auto', flexShrink: 0 }}>
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div style={{ background: '#0d0d0d', borderRadius: 12, padding: '12px 14px', border: '1px solid #1a1a1a', display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ color: '#fbbf24' }}>{icon}</span>
      <div>
        <p style={{ margin: 0, color: '#fff', fontWeight: 700, fontSize: 16 }}>{value}</p>
        <p style={{ margin: 0, color: '#555', fontSize: 10 }}>{label}</p>
      </div>
    </div>
  );
}

const CATEGORY_LABELS: Record<string, string> = {
  milestones: 'Milestones',
  genre: 'Genre Explorer',
  social: 'Social',
  hidden: 'Hidden',
};

function AchievementsGrid({ achievements, unlocked }: { achievements: Achievement[]; unlocked: Set<string> }) {
  const categories = ['milestones', 'genre', 'social', 'hidden'];
  const unlockedCount = achievements.filter(a => unlocked.has(a.id)).length;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, padding: '12px 16px', background: '#0d0d0d', borderRadius: 14, border: '1px solid #1a1a1a' }}>
        <Trophy size={16} color="#f59e0b" />
        <span style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>{unlockedCount}</span>
        <span style={{ color: '#555', fontSize: 14 }}>/ {achievements.length} achievements unlocked</span>
        <div style={{ flex: 1, height: 4, background: '#1a1a1a', borderRadius: 2, marginLeft: 8 }}>
          <div style={{ height: '100%', borderRadius: 2, background: '#f59e0b', width: `${achievements.length ? (unlockedCount / achievements.length) * 100 : 0}%`, transition: 'width .4s' }} />
        </div>
      </div>
      {categories.map(cat => {
        const group = achievements.filter(a => a.category === cat);
        if (group.length === 0) return null;
        return (
          <div key={cat} style={{ marginBottom: 24 }}>
            <h4 style={{ margin: '0 0 12px', color: '#555', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.12em' }}>
              {CATEGORY_LABELS[cat] ?? cat}
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
              {group.map(a => {
                const isUnlocked = unlocked.has(a.id);
                return (
                  <div key={a.id} style={{ background: isUnlocked ? 'rgba(245,158,11,.08)' : '#0d0d0d', border: `1px solid ${isUnlocked ? 'rgba(245,158,11,.3)' : '#1a1a1a'}`, borderRadius: 14, padding: '14px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 8, transition: 'all .2s', opacity: isUnlocked ? 1 : 0.4 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 12, background: isUnlocked ? 'rgba(245,158,11,.15)' : '#1a1a1a', border: `1px solid ${isUnlocked ? 'rgba(245,158,11,.3)' : '#2e2e2e'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Trophy size={16} color={isUnlocked ? '#f59e0b' : '#555'} />
                    </div>
                    <div>
                      <p style={{ margin: '0 0 3px', color: isUnlocked ? '#fff' : '#555', fontSize: 12, fontWeight: 700 }}>{a.title}</p>
                      <p style={{ margin: 0, color: '#555', fontSize: 10, lineHeight: 1.5 }}>{a.description}</p>
                    </div>
                    {isUnlocked && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#f59e0b' }} />
                        <span style={{ fontSize: 9, color: '#f59e0b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Unlocked</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function FavouriteFilmsSection({
  films, onSave, showSearch, onToggleSearch,
}: {
  films: FavFilmEntry[];
  onSave: (films: FavFilmEntry[]) => void;
  showSearch: boolean;
  onToggleSearch: () => void;
}) {
  const [query,   setQuery]   = useState('');
  const [results, setResults] = useState<TMDBMedia[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await tmdb.search(query);
        setResults(
          (data.results as TMDBMedia[])
            .filter(r => r.media_type === 'movie' || r.media_type === 'tv')
            .slice(0, 8)
        );
      } catch { /* ignore */ }
      setSearching(false);
    }, 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  function addFilm(item: TMDBMedia) {
    if (films.length >= 5) return;
    if (films.some(f => f.tmdb_id === item.id)) return;
    const title = item.title ?? item.name ?? '';
    const poster = item.poster_path ?? '';
    const entry: FavFilmEntry = { tmdb_id: item.id, title, poster_path: poster, media_type: (item.media_type as 'movie' | 'tv') ?? 'movie' };
    onSave([...films, entry]);
    setQuery('');
    setResults([]);
  }

  function removeFilm(tmdbId: number) {
    onSave(films.filter(f => f.tmdb_id !== tmdbId));
  }

  const slots = Array.from({ length: 5 });

  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Star size={14} color="#f59e0b" />
          <h3 style={{ margin: 0, color: '#fff', fontSize: 14, fontWeight: 700 }}>Top 5 Favourite Films</h3>
        </div>
        {films.length < 5 && (
          <button
            onClick={onToggleSearch}
            style={{ display: 'flex', alignItems: 'center', gap: 5, background: showSearch ? 'rgba(245,158,11,.1)' : 'none', border: `1px solid ${showSearch ? 'rgba(245,158,11,.3)' : '#2e2e2e'}`, borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontSize: 11, color: showSearch ? '#fbbf24' : '#666', fontFamily: 'inherit', transition: 'all .2s' }}
          >
            {showSearch ? <X size={11} /> : <Plus size={11} />}
            {showSearch ? 'Close' : 'Add film'}
          </button>
        )}
      </div>

      {/* 5 poster slots */}
      <div style={{ display: 'flex', gap: 10, marginBottom: showSearch ? 14 : 0 }}>
        {slots.map((_, i) => {
          const film = films[i];
          return (
            <div key={i} style={{ flex: 1, position: 'relative' }}>
              {film ? (
                <div style={{ position: 'relative', aspectRatio: '2/3' }}>
                  <div className="poster-card" style={{ width: '100%', height: '100%', borderRadius: 10, overflow: 'hidden', border: '1px solid #2a2a2a' }}>
                    {film.poster_path
                      ? <img src={posterUrl(film.poster_path, 'w185')!} alt={film.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                      : <div style={{ width: '100%', height: '100%', background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Film size={16} color="#555" /></div>}
                  </div>
                  <button
                    onClick={() => removeFilm(film.tmdb_id)}
                    style={{ position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: '50%', background: 'rgba(0,0,0,.85)', border: '1px solid #444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background .15s', padding: 0 }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#ef4444')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,0,0,.85)')}
                  >
                    <X size={10} color="#fff" />
                  </button>
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '20px 6px 5px', background: 'linear-gradient(to top, rgba(0,0,0,.9) 0%, transparent 100%)' }}>
                    <p style={{ margin: 0, color: '#fff', fontSize: 9, fontWeight: 600, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{film.title}</p>
                  </div>
                </div>
              ) : (
                <button
                  onClick={onToggleSearch}
                  style={{ width: '100%', aspectRatio: '2/3', background: '#0d0d0d', border: '1px dashed #2a2a2a', borderRadius: 10, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, transition: 'border-color .2s', padding: 0 }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(245,158,11,.3)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = '#2a2a2a')}
                >
                  <Plus size={14} color="#333" />
                  <span style={{ color: '#333', fontSize: 9 }}>{i + 1}</span>
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Search panel */}
      {showSearch && (
        <div style={{ background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 14, padding: 14 }}>
          <div style={{ position: 'relative', marginBottom: results.length > 0 ? 10 : 0 }}>
            <Search size={13} color="#555" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            <input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search for a film or show..."
              style={{ width: '100%', background: '#111', border: '1px solid #2e2e2e', borderRadius: 10, padding: '10px 12px 10px 32px', color: '#fff', fontSize: 13, outline: 'none', fontFamily: 'inherit', transition: 'border-color .2s', boxSizing: 'border-box' }}
              onFocus={e => (e.target.style.borderColor = '#f59e0b')}
              onBlur={e  => (e.target.style.borderColor = '#2e2e2e')}
            />
            {searching && <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, borderRadius: '50%', border: '2px solid #f59e0b', borderTopColor: 'transparent', animation: 'spin 0.6s linear infinite' }} />}
          </div>
          {results.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 280, overflowY: 'auto' }} className="no-scrollbar">
              {results.map(item => {
                const ps = posterUrl(item.poster_path, 'w92');
                const title = item.title ?? item.name ?? '';
                const year = (item.release_date ?? item.first_air_date ?? '').slice(0, 4);
                const alreadyAdded = films.some(f => f.tmdb_id === item.id);
                return (
                  <button
                    key={item.id}
                    onClick={() => !alreadyAdded && films.length < 5 && addFilm(item)}
                    disabled={alreadyAdded || films.length >= 5}
                    style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 10px', borderRadius: 8, background: 'transparent', border: 'none', cursor: alreadyAdded || films.length >= 5 ? 'default' : 'pointer', textAlign: 'left', fontFamily: 'inherit', transition: 'background .15s', opacity: alreadyAdded ? 0.45 : 1 }}
                    onMouseEnter={e => { if (!alreadyAdded) (e.currentTarget as HTMLButtonElement).style.background = '#1a1a1a'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                  >
                    <div style={{ width: 32, height: 48, borderRadius: 5, overflow: 'hidden', background: '#1a1a1a', flexShrink: 0 }}>
                      {ps ? <img src={ps} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Film size={12} color="#555" style={{ margin: '18px 10px' }} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: '0 0 2px', color: '#fff', fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</p>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        {year && <span style={{ color: '#555', fontSize: 11 }}>{year}</span>}
                        <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 20, background: item.media_type === 'movie' ? 'rgba(245,158,11,.1)' : 'rgba(96,165,250,.1)', color: item.media_type === 'movie' ? '#fbbf24' : '#60a5fa' }}>
                          {item.media_type === 'movie' ? 'Film' : 'TV'}
                        </span>
                      </div>
                    </div>
                    {alreadyAdded && <span style={{ color: '#4ade80', fontSize: 10, flexShrink: 0 }}>Added</span>}
                    {!alreadyAdded && films.length < 5 && <Plus size={13} color="#f59e0b" style={{ flexShrink: 0 }} />}
                  </button>
                );
              })}
            </div>
          )}
          {films.length >= 5 && (
            <p style={{ margin: '8px 0 0', color: '#666', fontSize: 11, textAlign: 'center' }}>Maximum 5 films reached. Remove one to add another.</p>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon, onClick }: { label: string; value: string; icon: React.ReactNode; onClick?: () => void }) {
  return (
    <div onClick={onClick}
      style={{ background: '#111', borderRadius: 16, padding: '16px 12px', textAlign: 'center', border: '1px solid #1a1a1a', cursor: onClick ? 'pointer' : 'default', transition: onClick ? 'border-color .2s' : undefined }}
      onMouseEnter={e => onClick && (e.currentTarget.style.borderColor = '#2e2e2e')}
      onMouseLeave={e => onClick && (e.currentTarget.style.borderColor = '#1a1a1a')}>
      <div style={{ display: 'flex', justifyContent: 'center', color: '#fbbf24', marginBottom: 6 }}>{icon}</div>
      <p style={{ margin: '0 0 3px', color: '#fff', fontWeight: 700, fontSize: 20 }}>{value}</p>
      <p style={{ margin: 0, color: '#888', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</p>
    </div>
  );
}
