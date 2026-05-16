import { useEffect, useState } from 'react';
import { ArrowLeft, Film, Tv, Clock, Heart, UserPlus, UserMinus, BookOpen, Star, Flag, Check, UserX, X, BadgeCheck, ExternalLink, Crown, UserCheck, Send } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { WatchedEntry } from '../lib/supabase';
import { posterUrl } from '../lib/tmdb';
import { useAuth } from '../context/AuthContext';
import FollowListModal from '../components/FollowListModal';

interface PublicProfilePageProps {
  userId: string;
  onBack: () => void;
  onMediaClick: (id: number, type: 'movie' | 'tv') => void;
  onWatchedClick?: (userId: string, username: string) => void;
  onDiaryClick?: (userId: string, username: string) => void;
}

interface ProfileData {
  id: string;
  username: string;
  bio: string;
  avatar_url: string;
  banner_url?: string | null;
  twitter?: string | null;
  instagram?: string | null;
  letterboxd?: string | null;
  is_verified?: boolean;
  role?: string;
  favourite_films: { tmdb_id: number; title: string; poster_path: string; media_type: 'movie' | 'tv' }[];
  is_public: boolean;
  created_at: string | null;
}

interface DiaryEntry extends WatchedEntry {
  rating?: number;
  reviewContent?: string;
}

type PublicTab = 'films' | 'diary';

export default function PublicProfilePage({ userId, onBack, onMediaClick, onWatchedClick, onDiaryClick }: PublicProfilePageProps) {
  const { user } = useAuth();
  const [profile,       setProfile]       = useState<ProfileData | null>(null);
  const [watched,       setWatched]       = useState<WatchedEntry[]>([]);
  const [diary,         setDiary]         = useState<DiaryEntry[]>([]);
  const [stats,         setStats]         = useState({ movies: 0, shows: 0, hours: 0, mins: 0 });
  const [loading,       setLoading]       = useState(true);
  const [isFollowing,   setIsFollowing]   = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [followers,     setFollowers]     = useState(0);

  const [activeTab,     setActiveTab]     = useState<PublicTab>('films');
  const [followModal,   setFollowModal]   = useState<'followers' | 'following' | null>(null);
  const [reported,      setReported]      = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason,  setReportReason]  = useState('');
  const [reportDone,    setReportDone]    = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [isBlocked,     setIsBlocked]     = useState(false);
  const [blockLoading,  setBlockLoading]  = useState(false);

  // Friend / follow request state
  const [requestStatus, setRequestStatus] = useState<'none' | 'pending' | 'accepted' | 'declined'>('none');
  const [requestLoading, setRequestLoading] = useState(false);

  useEffect(() => {
    async function load() {
      const [{ data: p }, { data: flr }, { data: fgr }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
        supabase.from('follows').select('id').eq('following_id', userId),
        user ? supabase.from('follows').select('id').eq('follower_id', user.id).eq('following_id', userId) : { data: [] },
      ]);

      if (p) {
        setProfile(p as ProfileData);
        setFollowers(flr?.length ?? 0);
        const following = (fgr?.length ?? 0) > 0;
        setIsFollowing(following);

        {
          const [{ data: w }, { data: r }, { data: rev }] = await Promise.all([
            supabase.from('watched').select('*').eq('user_id', userId).order('watched_date', { ascending: false }),
            supabase.from('ratings').select('tmdb_id, media_type, rating').eq('user_id', userId),
            supabase.from('reviews').select('tmdb_id, media_type, content, rating').eq('user_id', userId).eq('is_public', true),
          ]);
          const entries = (w ?? []) as WatchedEntry[];
          setWatched(entries);
          const totalMins = entries.reduce((s, e) => s + (e.runtime_minutes ?? 0), 0);
          setStats({
            movies: entries.filter(e => e.media_type === 'movie').length,
            shows:  entries.filter(e => e.media_type === 'tv').length,
            hours:  Math.floor(totalMins / 60),
            mins:   totalMins % 60,
          });

          const ratingMap: Record<string, number> = {};
          (r ?? []).forEach((row: { tmdb_id: number; media_type: string; rating: number }) => {
            ratingMap[`${row.tmdb_id}-${row.media_type}`] = row.rating;
          });
          const reviewMap: Record<string, { content: string; rating?: number }> = {};
          (rev ?? []).forEach((row: { tmdb_id: number; media_type: string; content: string; rating?: number }) => {
            reviewMap[`${row.tmdb_id}-${row.media_type}`] = { content: row.content, rating: row.rating ?? undefined };
          });
          setDiary(entries.map(e => {
            const key = `${e.tmdb_id}-${e.media_type}`;
            return { ...e, rating: ratingMap[key] ?? reviewMap[key]?.rating, reviewContent: reviewMap[key]?.content };
          }));
        }
      }
      setLoading(false);
    }
    load();
  }, [userId, user]);

  // Load follow request status for private profiles
  useEffect(() => {
    if (!user || !profile || profile.is_public || user.id === userId || isFollowing) return;
    supabase.from('follow_requests').select('status')
      .eq('requester_id', user.id).eq('target_id', userId).maybeSingle()
      .then(({ data }) => setRequestStatus((data?.status as typeof requestStatus) ?? 'none'));
  }, [user, profile, userId, isFollowing]);

  async function toggleFollow() {
    if (!user) return;
    setFollowLoading(true);
    if (isFollowing) {
      await supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', userId);
      setIsFollowing(false);
      setFollowers(f => Math.max(0, f - 1));
    } else {
      await supabase.from('follows').insert({ follower_id: user.id, following_id: userId });
      setIsFollowing(true);
      setFollowers(f => f + 1);
    }
    setFollowLoading(false);
  }

  async function sendFollowRequest() {
    if (!user || !profile) return;
    setRequestLoading(true);
    if (requestStatus === 'pending') {
      // Cancel the request
      await supabase.from('follow_requests').delete().eq('requester_id', user.id).eq('target_id', userId);
      setRequestStatus('none');
    } else {
      // Send request and create notification for the target
      await supabase.from('follow_requests').upsert(
        { requester_id: user.id, target_id: userId, status: 'pending' },
        { onConflict: 'requester_id,target_id' }
      );
      // Notify the profile owner
      const { data: requesterProfile } = await supabase.from('profiles').select('username').eq('id', user.id).maybeSingle();
      await supabase.from('notifications').insert({
        user_id: userId,
        type: 'friend_request',
        actor_id: user.id,
        message: `wants to follow you`,
        reference_id: user.id,
        seen: false,
      });
      setRequestStatus('pending');
      // Suppress unused variable warning
      void requesterProfile;
    }
    setRequestLoading(false);
  }

  // Check block status
  useEffect(() => {
    if (!user || user.id === userId) return;
    supabase.from('blocked_users').select('id').eq('blocker_id', user.id).eq('blocked_id', userId).maybeSingle()
      .then(({ data }) => setIsBlocked(!!data));
  }, [user, userId]);

  async function toggleBlock() {
    if (!user) return;
    setBlockLoading(true);
    if (isBlocked) {
      await supabase.from('blocked_users').delete().eq('blocker_id', user.id).eq('blocked_id', userId);
      setIsBlocked(false);
    } else {
      await supabase.from('blocked_users').insert({ blocker_id: user.id, blocked_id: userId });
      setIsBlocked(true);
    }
    setBlockLoading(false);
  }

  async function submitReport() {
    if (!user || !reportReason) return;
    setReportLoading(true);
    await supabase.from('reports').insert({
      reporter_id: user.id,
      reported_user_id: userId,
      reason: reportReason,
      content_type: 'profile',
    });
    const { count } = await supabase.from('reports').select('id', { count: 'exact', head: true }).eq('reported_user_id', userId);
    if (count && count >= 10) {
      await supabase.from('flagged_accounts').upsert({ user_id: userId, report_count: count, flagged_at: new Date().toISOString() }, { onConflict: 'user_id' });
    }
    setReported(true);
    setReportDone(true);
    setReportLoading(false);
    setTimeout(() => setShowReportModal(false), 2000);
  }

  const isOwnProfile = user?.id === userId;

  return (
    <div style={{ minHeight: '100vh', background: '#000', paddingBottom: 96 }} className="animate-fade-in">
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px clamp(16px,4vw,48px) 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
          <button onClick={onBack}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 14, fontFamily: 'inherit' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
            onMouseLeave={e => (e.currentTarget.style.color = '#888')}>
            <ArrowLeft size={16} /> Back
          </button>
          {profile && (
            <div style={{ display: 'flex', gap: 8 }}>
              {user && !isOwnProfile && (
                <>
                  <button
                    onClick={toggleBlock}
                    disabled={blockLoading}
                    title={isBlocked ? 'Unblock user' : 'Block user'}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', background: '#111', border: `1px solid ${isBlocked ? 'rgba(239,68,68,.3)' : '#2e2e2e'}`, borderRadius: 10, cursor: 'pointer', fontSize: 12, color: isBlocked ? '#f87171' : '#555', fontFamily: 'inherit', transition: 'all .2s' }}
                    onMouseEnter={e => { if (!isBlocked) { e.currentTarget.style.borderColor = 'rgba(239,68,68,.3)'; e.currentTarget.style.color = '#f87171'; } }}
                    onMouseLeave={e => { if (!isBlocked) { e.currentTarget.style.borderColor = '#2e2e2e'; e.currentTarget.style.color = '#555'; } }}>
                    <UserX size={13} />
                    {blockLoading ? '...' : isBlocked ? 'Unblock' : 'Block'}
                  </button>
                  <button
                    onClick={() => { if (!reported) setShowReportModal(true); }}
                    title="Report this user"
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', background: '#111', border: '1px solid #2e2e2e', borderRadius: 10, cursor: reported ? 'default' : 'pointer', fontSize: 12, color: reported ? '#f87171' : '#555', fontFamily: 'inherit', transition: 'all .2s' }}
                    onMouseEnter={e => { if (!reported) e.currentTarget.style.color = '#f87171'; }}
                    onMouseLeave={e => { if (!reported) e.currentTarget.style.color = '#555'; }}>
                    <Flag size={13} />
                    {reported ? 'Reported' : 'Report'}
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {loading ? (
          <div style={{ display: 'flex', gap: 24 }}>
            <div className="shimmer" style={{ width: 100, height: 100, borderRadius: '50%', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div className="shimmer" style={{ height: 28, width: 200, borderRadius: 4, marginBottom: 10 }} />
              <div className="shimmer" style={{ height: 16, width: 300, borderRadius: 4 }} />
            </div>
          </div>
        ) : !profile ? (
          <p style={{ color: '#555' }}>Profile not found.</p>
        ) : (
          <>
            {/* Banner image */}
            {profile.banner_url && (
              <div style={{ height: 140, borderRadius: 16, overflow: 'hidden', marginBottom: 20, position: 'relative' }}>
                <img src={profile.banner_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent, rgba(0,0,0,.5))' }} />
              </div>
            )}

            {/* Profile header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 24, marginBottom: 36, flexWrap: 'wrap' }}>
              <div style={{ width: 96, height: 96, borderRadius: '50%', overflow: 'hidden', background: '#1a1a1a', border: '3px solid #2e2e2e', flexShrink: 0 }}>
                {profile.avatar_url
                  ? <img src={profile.avatar_url} alt={profile.username} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ color: '#fbbf24', fontSize: 36, fontWeight: 700 }}>{profile.username[0]?.toUpperCase()}</span>
                    </div>}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <h1 style={{ margin: 0, color: '#fff', fontSize: 'clamp(22px,3vw,32px)', fontWeight: 700 }}>{profile.username}</h1>
                    {profile.is_verified && <BadgeCheck size={22} color="#60a5fa" />}
                    {profile.role === 'pro' && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(245,158,11,.15)', border: '1px solid rgba(245,158,11,.35)', borderRadius: 100, padding: '3px 9px' }}>
                        <Crown size={11} color="#f59e0b" />
                        <span style={{ color: '#f59e0b', fontSize: 10, fontWeight: 700 }}>PRO</span>
                      </span>
                    )}
                  </div>
                  {!isOwnProfile && user && (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {/* Public profile: follow/unfollow */}
                      {profile.is_public && (
                        <button
                          onClick={toggleFollow}
                          disabled={followLoading}
                          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 10, border: isFollowing ? '1px solid #2e2e2e' : 'none', background: isFollowing ? 'transparent' : '#f59e0b', color: isFollowing ? '#888' : '#000', cursor: 'pointer', fontSize: 13, fontWeight: 600, transition: 'all .2s', fontFamily: 'inherit' }}
                          onMouseEnter={e => { if (!isFollowing) (e.currentTarget as HTMLButtonElement).style.background = '#fbbf24'; }}
                          onMouseLeave={e => { if (!isFollowing) (e.currentTarget as HTMLButtonElement).style.background = '#f59e0b'; }}
                        >
                          {isFollowing ? <UserMinus size={13} /> : <UserPlus size={13} />}
                          {followLoading ? '...' : isFollowing ? 'Unfollow' : 'Follow'}
                        </button>
                      )}
                      {/* Private profile + already following: show unfollow */}
                      {!profile.is_public && isFollowing && (
                        <button
                          onClick={toggleFollow}
                          disabled={followLoading}
                          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 10, border: '1px solid #2e2e2e', background: 'transparent', color: '#888', cursor: 'pointer', fontSize: 13, fontWeight: 600, transition: 'all .2s', fontFamily: 'inherit' }}>
                          <UserMinus size={13} />
                          {followLoading ? '...' : 'Unfollow'}
                        </button>
                      )}
                      {/* Private profile + not following: request button */}
                      {!profile.is_public && !isFollowing && (
                        <button
                          onClick={sendFollowRequest}
                          disabled={requestLoading || requestStatus === 'accepted'}
                          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 10, border: 'none', cursor: requestLoading ? 'default' : 'pointer', fontSize: 13, fontWeight: 600, transition: 'all .2s', fontFamily: 'inherit',
                            background: requestStatus === 'pending' ? 'rgba(245,158,11,.15)' : '#f59e0b',
                            color: requestStatus === 'pending' ? '#f59e0b' : '#000',
                          }}
                          onMouseEnter={e => { if (requestStatus !== 'pending') (e.currentTarget as HTMLButtonElement).style.background = '#fbbf24'; }}
                          onMouseLeave={e => { if (requestStatus !== 'pending') (e.currentTarget as HTMLButtonElement).style.background = '#f59e0b'; }}
                        >
                          {requestStatus === 'pending' ? <><UserCheck size={13} /> Request Sent</> : <><Send size={13} /> Request to Follow</>}
                        </button>
                      )}
                    </div>
                  )}
                </div>
                {profile.bio && <p style={{ margin: '0 0 8px', color: '#888', fontSize: 14, lineHeight: 1.6 }}>{profile.bio}</p>}

                {/* Social links */}
                {(profile.twitter || profile.instagram || profile.letterboxd) && (
                  <div style={{ display: 'flex', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
                    {profile.twitter && (
                      <a href={`https://twitter.com/${profile.twitter}`} target="_blank" rel="noopener noreferrer"
                        style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#1d9bf0', fontSize: 12, textDecoration: 'none', padding: '3px 10px', background: 'rgba(29,155,240,.08)', borderRadius: 6, border: '1px solid rgba(29,155,240,.2)' }}>
                        <ExternalLink size={11} /> @{profile.twitter}
                      </a>
                    )}
                    {profile.instagram && (
                      <a href={`https://instagram.com/${profile.instagram}`} target="_blank" rel="noopener noreferrer"
                        style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#e1306c', fontSize: 12, textDecoration: 'none', padding: '3px 10px', background: 'rgba(225,48,108,.08)', borderRadius: 6, border: '1px solid rgba(225,48,108,.2)' }}>
                        <ExternalLink size={11} /> @{profile.instagram}
                      </a>
                    )}
                    {profile.letterboxd && (
                      <a href={`https://letterboxd.com/${profile.letterboxd}`} target="_blank" rel="noopener noreferrer"
                        style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#40bcf4', fontSize: 12, textDecoration: 'none', padding: '3px 10px', background: 'rgba(64,188,244,.08)', borderRadius: 6, border: '1px solid rgba(64,188,244,.2)' }}>
                        <ExternalLink size={11} /> {profile.letterboxd}
                      </a>
                    )}
                  </div>
                )}

                {profile.created_at && (
                  <p style={{ margin: '0 0 12px', color: '#444', fontSize: 11 }}>
                    Member since {new Date(profile.created_at).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
                  </p>
                )}
                <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
                  <button onClick={() => setFollowModal('followers')}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0, display: 'flex', alignItems: 'center', gap: 6, transition: 'opacity .2s' }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = '.7')}
                    onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
                    <span style={{ color: '#fff', fontWeight: 700, fontSize: 20 }}>{followers}</span>
                    <span style={{ color: '#555', fontSize: 13 }}>Followers</span>
                  </button>
                  <StatBadge value={stats.movies} label="Films"    icon={<Film size={14} />} />
                  <StatBadge value={stats.shows}  label="Shows"    icon={<Tv size={14} />} />
                  <StatBadge value={null} rawLabel={`${stats.hours}h ${stats.mins}m`} label="Watch Time" icon={<Clock size={14} />} />
                </div>
              </div>
            </div>

            <>
                {/* Top 5 Favourite Films & Shows */}
                {(profile.favourite_films ?? []).length > 0 && (
                  <div style={{ marginBottom: 36 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                      <Star size={14} color="#f59e0b" />
                      <h3 style={{ margin: 0, color: '#fff', fontSize: 14, fontWeight: 700 }}>Top 5 Favourite Films</h3>
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                      {profile.favourite_films.map((fav, idx) => {
                        const ps = fav.poster_path ? posterUrl(fav.poster_path, 'w185') : null;
                        return (
                          <div key={fav.tmdb_id} style={{ flex: 1, maxWidth: 120, position: 'relative', cursor: 'pointer' }}
                            onClick={() => onMediaClick(fav.tmdb_id, fav.media_type)}>
                            <div className="poster-card" style={{ aspectRatio: '2/3', borderRadius: 10, overflow: 'hidden', border: '1px solid #2a2a2a', transition: 'border-color .2s' }}
                              onMouseEnter={e => (e.currentTarget.style.borderColor = '#f59e0b')}
                              onMouseLeave={e => (e.currentTarget.style.borderColor = '#2a2a2a')}>
                              {ps
                                ? <img src={ps} alt={fav.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                                : <div style={{ width: '100%', height: '100%', background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Film size={18} color="#555" /></div>}
                              <div style={{ position: 'absolute', top: 5, left: 5, width: 20, height: 20, borderRadius: '50%', background: 'rgba(0,0,0,.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(245,158,11,.3)' }}>
                                <span style={{ color: '#f59e0b', fontSize: 9, fontWeight: 800 }}>{idx + 1}</span>
                              </div>
                              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '16px 5px 5px', background: 'linear-gradient(to top, rgba(0,0,0,.9) 0%, transparent 100%)' }}>
                                <p style={{ margin: 0, color: '#fff', fontSize: 9, fontWeight: 600, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fav.title}</p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Tabs */}
                <div style={{ display: 'flex', background: '#111', borderRadius: 14, padding: 3, marginBottom: 20, gap: 3 }}>
                  {([['films', `Films (${watched.length})`, Film], ['diary', 'Diary', BookOpen]] as const).map(([t, label, Icon]) => (
                    <button key={t} onClick={() => setActiveTab(t)}
                      style={{ flex: 1, padding: '8px 0', borderRadius: 11, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500, transition: 'all .2s', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        background: activeTab === t ? '#f59e0b' : 'transparent', color: activeTab === t ? '#000' : '#888' }}>
                      <Icon size={13} />
                      {label}
                    </button>
                  ))}
                </div>

                {activeTab === 'films' ? (
                  watched.length > 0 ? (
                    <>
                      {onWatchedClick && (
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
                          <button onClick={() => onWatchedClick(userId, profile.username)} className="btn-ghost" style={{ fontSize: 12, padding: '6px 14px', borderRadius: 8 }}>
                            View All ({watched.length})
                          </button>
                        </div>
                      )}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(clamp(70px,8vw,110px), 1fr))', gap: 10 }}>
                        {watched.slice(0, 24).map(item => {
                          const ps = posterUrl(item.poster_path);
                          return (
                            <div key={item.id} className="poster-card" style={{ aspectRatio: '2/3', borderRadius: 8 }} onClick={() => onMediaClick(item.tmdb_id, item.media_type)}>
                              {ps
                                ? <img src={ps} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                                : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Film size={14} color="#555" /></div>}
                              {item.liked && (
                                <div style={{ position: 'absolute', bottom: 4, right: 4 }}>
                                  <Heart size={10} color="#f87171" fill="#f87171" />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <p style={{ color: '#555', fontSize: 14 }}>Nothing logged yet.</p>
                  )
                ) : (
                  diary.length === 0 ? (
                    <p style={{ color: '#555', fontSize: 14 }}>No diary entries yet.</p>
                  ) : (
                    <>
                      {onDiaryClick && (
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                          <button onClick={() => onDiaryClick(userId, profile.username)} className="btn-ghost" style={{ fontSize: 12, padding: '6px 14px', borderRadius: 8 }}>
                            View All
                          </button>
                        </div>
                      )}
                      {diary.slice(0, 10).map(entry => {
                        const ps = posterUrl(entry.poster_path, 'w92');
                        const d = new Date(entry.watched_date + 'T00:00:00');
                        const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                        const snippet = entry.reviewContent ? entry.reviewContent.slice(0, 100) + (entry.reviewContent.length > 100 ? '...' : '') : null;
                        return (
                          <div key={entry.id} onClick={() => onMediaClick(entry.tmdb_id, entry.media_type)}
                            style={{ display: 'flex', gap: 14, padding: '14px 0', borderBottom: '1px solid #111', cursor: 'pointer', transition: 'background .15s', borderRadius: 4 }}
                            onMouseEnter={e => (e.currentTarget.style.background = '#0a0a0a')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                            <div style={{ width: 52, height: 78, borderRadius: 8, overflow: 'hidden', background: '#1a1a1a', flexShrink: 0, border: '1px solid #2e2e2e' }}>
                              {ps ? <img src={ps} alt={entry.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" /> : <Film size={12} color="#555" />}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 4 }}>
                                <p style={{ margin: 0, color: '#fff', fontSize: 15, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.title}</p>
                                {entry.rating != null && (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
                                    <Star size={11} color="#f59e0b" fill="#f59e0b" />
                                    <span style={{ fontSize: 11, color: '#f59e0b', fontWeight: 700 }}>{entry.rating}</span>
                                  </div>
                                )}
                              </div>
                              <p style={{ margin: '0 0 5px', color: '#555', fontSize: 12 }}>{dateStr}</p>
                              {snippet && <p style={{ margin: 0, color: '#888', fontSize: 13, lineHeight: 1.5 }}>{snippet}</p>}
                            </div>
                          </div>
                        );
                      })}
                    </>
                  )
                )}
            </>
          </>
        )}
      </div>

      {followModal && (
        <FollowListModal
          userId={userId}
          mode={followModal}
          onClose={() => setFollowModal(null)}
          onMemberClick={() => setFollowModal(null)}
        />
      )}

      {/* Report Modal */}
      {showReportModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)', backdropFilter: 'blur(6px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={e => { if (e.target === e.currentTarget) setShowReportModal(false); }}>
          <div style={{ background: '#111', borderRadius: 20, border: '1px solid #2e2e2e', padding: 28, width: '100%', maxWidth: 400, position: 'relative' }}>
            <button onClick={() => setShowReportModal(false)}
              style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', cursor: 'pointer', color: '#555', padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8 }}
              onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
              onMouseLeave={e => (e.currentTarget.style.color = '#555')}>
              <X size={18} />
            </button>

            {reportDone ? (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(74,222,128,.15)', border: '1px solid rgba(74,222,128,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                  <Check size={22} color="#4ade80" />
                </div>
                <p style={{ margin: '0 0 6px', color: '#fff', fontSize: 16, fontWeight: 600 }}>Report submitted</p>
                <p style={{ margin: 0, color: '#888', fontSize: 13 }}>Thank you for your report. We will review it shortly.</p>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(239,68,68,.15)', border: '1px solid rgba(239,68,68,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Flag size={16} color="#f87171" />
                  </div>
                  <div>
                    <p style={{ margin: 0, color: '#fff', fontSize: 15, fontWeight: 600 }}>Report {profile?.username}</p>
                    <p style={{ margin: 0, color: '#555', fontSize: 12 }}>Help us keep Qued safe</p>
                  </div>
                </div>
                <p style={{ margin: '0 0 12px', color: '#888', fontSize: 13 }}>Select a reason for your report:</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                  {['Offensive content', 'Spam', 'Spoilers', 'Fake account', 'Other'].map(reason => (
                    <button key={reason} onClick={() => setReportReason(reason)}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderRadius: 12, border: `1px solid ${reportReason === reason ? 'rgba(239,68,68,.5)' : '#2e2e2e'}`, background: reportReason === reason ? 'rgba(239,68,68,.1)' : '#0d0d0d', cursor: 'pointer', color: reportReason === reason ? '#f87171' : '#888', fontSize: 13, fontFamily: 'inherit', textAlign: 'left', transition: 'all .15s' }}
                      onMouseEnter={e => { if (reportReason !== reason) { e.currentTarget.style.borderColor = '#3a3a3a'; e.currentTarget.style.color = '#ccc'; } }}
                      onMouseLeave={e => { if (reportReason !== reason) { e.currentTarget.style.borderColor = '#2e2e2e'; e.currentTarget.style.color = '#888'; } }}>
                      <div style={{ width: 16, height: 16, borderRadius: '50%', border: `2px solid ${reportReason === reason ? '#f87171' : '#3a3a3a'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'border-color .15s' }}>
                        {reportReason === reason && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#f87171' }} />}
                      </div>
                      {reason}
                    </button>
                  ))}
                </div>
                <button onClick={submitReport} disabled={!reportReason || reportLoading}
                  style={{ width: '100%', padding: '12px', borderRadius: 12, border: 'none', cursor: reportReason && !reportLoading ? 'pointer' : 'not-allowed', fontSize: 14, fontWeight: 600, fontFamily: 'inherit', transition: 'all .2s',
                    background: reportReason ? '#ef4444' : '#1a1a1a', color: reportReason ? '#fff' : '#555' }}>
                  {reportLoading ? 'Submitting...' : 'Submit Report'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StatBadge({ value, rawLabel, label, icon }: { value: number | null; rawLabel?: string; label: string; icon?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {icon && <span style={{ color: '#fbbf24' }}>{icon}</span>}
      <span style={{ color: '#fff', fontWeight: 700, fontSize: 20 }}>{rawLabel ?? value}</span>
      <span style={{ color: '#555', fontSize: 13 }}>{label}</span>
    </div>
  );
}
