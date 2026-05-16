import { useEffect, useState, useCallback, useRef } from 'react';
import { Film, Activity, Heart, Star, BookOpen, Trophy, UserPlus, Bookmark, Bell, RefreshCw, MessageCircle, Send, X, Eye } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { posterUrl } from '../lib/tmdb';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/I18nContext';

interface FeedActivity {
  id: string;
  user_id: string;
  activity_type: string;
  tmdb_id: number | null;
  media_type: string | null;
  title: string | null;
  poster_path: string | null;
  achievement_id: string | null;
  target_user_id: string | null;
  rating: number | null;
  review_content: string | null;
  like_count: number;
  created_at: string;
  profile: { username: string; avatar_url: string | null } | null;
}

interface FeedComment {
  id: string;
  activity_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profile: { username: string; avatar_url: string | null } | null;
}

interface ActivityFeedPageProps {
  onMediaClick: (id: number, type: 'movie' | 'tv') => void;
  onMemberClick: (userId: string) => void;
  onSignIn: () => void;
  onSignUp: () => void;
}

export default function ActivityFeedPage({ onMediaClick, onMemberClick, onSignIn, onSignUp }: ActivityFeedPageProps) {
  const { user } = useAuth();
  const { t } = useI18n();
  const [activities,   setActivities]   = useState<FeedActivity[]>([]);
  const [likedSet,     setLikedSet]     = useState<Set<string>>(new Set());
  const [loading,      setLoading]      = useState(true);
  const [hasNew,       setHasNew]       = useState(false);
  const [unseenCount,  setUnseenCount]  = useState(0);
  const [, setLastLoadTime] = useState(Date.now());
  const [openComments, setOpenComments] = useState<string | null>(null);
  const [commentMap,   setCommentMap]   = useState<Record<string, FeedComment[]>>({});
  const [commentCount, setCommentCount] = useState<Record<string, number>>({});

  const load = useCallback(async (showNew = false) => {
    if (!showNew) setLoading(true);

    let feedUserIds: string[] = [];

    if (user) {
      // Logged-in: show own + followed activity
      const { data: follows } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user.id);
      const followedIds = (follows ?? []).map((f: { following_id: string }) => f.following_id);
      feedUserIds = [...followedIds, user.id];
    }

    let query = supabase
      .from('activity_feed')
      .select('*, profile:profiles!activity_feed_user_id_fkey(username, avatar_url)')
      .order('created_at', { ascending: false })
      .limit(80);

    if (user && feedUserIds.length > 0) {
      query = query.in('user_id', feedUserIds);
    }
    // Guests: load latest public activity (no filter needed — RLS handles it)

    const { data } = await query;
    const items = (data ?? []) as FeedActivity[];
    setActivities(items);

    if (user && items.length > 0) {
      const ids = items.map(a => a.id);
      const { data: liked } = await supabase
        .from('activity_likes')
        .select('activity_id')
        .eq('user_id', user.id)
        .in('activity_id', ids);
      setLikedSet(new Set((liked ?? []).map((r: { activity_id: string }) => r.activity_id)));
    }

    if (showNew) {
      setHasNew(false);
      setUnseenCount(0);
      setLastLoadTime(Date.now());
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  // Realtime subscription for new activity
  useEffect(() => {
    const channel = supabase
      .channel('activity-feed-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_feed' }, (payload) => {
        // Only flag as new if the new item is from someone we follow (or ourselves)
        const newItem = payload.new as { user_id: string; created_at: string };
        setActivities(prev => {
          // Check if this item's user is in our feed
          const userIds = prev.length > 0 ? new Set(prev.map(a => a.user_id)) : null;
          if (user && userIds && !userIds.has(newItem.user_id) && newItem.user_id !== user.id) {
            // Not from followed user — but signal new count for guest or followed-user check
          }
          return prev;
        });
        setHasNew(true);
        setUnseenCount(c => c + 1);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // Fallback poll every 60s
  useEffect(() => {
    const interval = setInterval(() => {
      setHasNew(true);
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  async function toggleLike(activityId: string) {
    if (!user) return;
    const isLiked = likedSet.has(activityId);
    setLikedSet(prev => { const n = new Set(prev); if (isLiked) n.delete(activityId); else n.add(activityId); return n; });
    const current = activities.find(a => a.id === activityId);
    const newCount = (current?.like_count ?? 0) + (isLiked ? -1 : 1);
    setActivities(prev => prev.map(a => a.id === activityId ? { ...a, like_count: Math.max(0, newCount) } : a));
    if (isLiked) {
      await supabase.from('activity_likes').delete().eq('user_id', user.id).eq('activity_id', activityId);
      await supabase.from('activity_feed').update({ like_count: Math.max(0, newCount) }).eq('id', activityId);
    } else {
      await supabase.from('activity_likes').insert({ user_id: user.id, activity_id: activityId });
      await supabase.from('activity_feed').update({ like_count: newCount }).eq('id', activityId);
    }
  }

  async function loadComments(activityId: string) {
    const { data } = await supabase
      .from('activity_feed_comments')
      .select('*, profile:profiles!activity_feed_comments_user_id_fkey(username, avatar_url)')
      .eq('activity_id', activityId)
      .order('created_at', { ascending: true })
      .limit(50);
    const comments = (data ?? []) as FeedComment[];
    setCommentMap(prev => ({ ...prev, [activityId]: comments }));
    setCommentCount(prev => ({ ...prev, [activityId]: comments.length }));
  }

  function toggleComments(activityId: string) {
    if (openComments === activityId) { setOpenComments(null); return; }
    setOpenComments(activityId);
    if (!commentMap[activityId]) loadComments(activityId);
  }

  async function submitComment(activityId: string, content: string) {
    if (!user || !content.trim()) return;
    const { data, error } = await supabase
      .from('activity_feed_comments')
      .insert({ activity_id: activityId, user_id: user.id, content: content.trim() })
      .select('*, profile:profiles!activity_feed_comments_user_id_fkey(username, avatar_url)')
      .single();
    if (!error && data) {
      const newComment = data as FeedComment;
      setCommentMap(prev => ({ ...prev, [activityId]: [...(prev[activityId] ?? []), newComment] }));
      setCommentCount(prev => ({ ...prev, [activityId]: (prev[activityId] ?? 0) + 1 }));
    }
  }

  async function deleteComment(activityId: string, commentId: string) {
    if (!user) return;
    await supabase.from('activity_feed_comments').delete().eq('id', commentId).eq('user_id', user.id);
    setCommentMap(prev => ({ ...prev, [activityId]: (prev[activityId] ?? []).filter(c => c.id !== commentId) }));
    setCommentCount(prev => ({ ...prev, [activityId]: Math.max(0, (prev[activityId] ?? 1) - 1) }));
  }

  return (
    <div style={{ minHeight: '100vh', background: '#000', paddingBottom: 96 }} className="animate-fade-in">
      <div style={{ position: 'sticky', top: 56, zIndex: 10, background: 'rgba(0,0,0,.92)', backdropFilter: 'blur(8px)', borderBottom: '1px solid #1a1a1a', padding: '14px clamp(16px,4vw,48px)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Activity size={16} color="#f59e0b" />
          <h1 style={{ margin: 0, color: '#fff', fontSize: 17, fontWeight: 700 }}>{t('feed_title')}</h1>
          {unseenCount > 0 && (
            <div style={{ background: '#f59e0b', color: '#000', borderRadius: '50%', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800 }}>
              {unseenCount > 9 ? '9+' : unseenCount}
            </div>
          )}
        </div>
        <button
          onClick={() => load(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: hasNew ? 'rgba(245,158,11,.15)' : 'none', border: hasNew ? '1px solid rgba(245,158,11,.4)' : '1px solid #2e2e2e', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 12, color: hasNew ? '#fbbf24' : '#555', fontFamily: 'inherit', transition: 'all .2s' }}
          onMouseEnter={e => { if (!hasNew) e.currentTarget.style.borderColor = '#3a3a3a'; }}
          onMouseLeave={e => { if (!hasNew) e.currentTarget.style.borderColor = '#2e2e2e'; }}
        >
          <Bell size={12} />
          {hasNew ? `${unseenCount} new` : 'Refresh'}
          <RefreshCw size={11} style={{ marginLeft: 2 }} />
        </button>
      </div>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '8px clamp(16px,4vw,32px) 0' }}>

        {/* Guest banner — prompt to sign in for personalised feed */}
        {!user && !loading && activities.length > 0 && (
          <div style={{ margin: '12px 0 4px', padding: '12px 16px', background: 'rgba(245,158,11,.06)', border: '1px solid rgba(245,158,11,.2)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Eye size={14} color="#f59e0b" />
              <span style={{ color: '#888', fontSize: 13 }}>Viewing public activity — <span style={{ color: '#fbbf24' }}>sign in</span> to see your friends' feed</span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={onSignIn} className="btn-ghost" style={{ padding: '6px 16px', borderRadius: 8, fontSize: 12 }}>Sign In</button>
              <button onClick={onSignUp} className="btn-gold" style={{ padding: '6px 16px', borderRadius: 8, fontSize: 12 }}>Join</button>
            </div>
          </div>
        )}

        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, padding: '16px 0', borderBottom: '1px solid #111' }}>
              <div className="shimmer" style={{ width: 40, height: 40, borderRadius: '50%', flexShrink: 0 }} />
              <div style={{ flex: 1, display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div className="shimmer" style={{ height: 14, width: '60%', borderRadius: 4, marginBottom: 6 }} />
                  <div className="shimmer" style={{ height: 12, width: '40%', borderRadius: 4 }} />
                </div>
                <div className="shimmer" style={{ width: 44, height: 66, borderRadius: 6, flexShrink: 0 }} />
              </div>
            </div>
          ))
        ) : activities.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <Activity size={36} color="#2e2e2e" style={{ margin: '0 auto 12px', display: 'block' }} />
            <p style={{ margin: '0 0 8px', color: '#fff', fontSize: 16, fontWeight: 600 }}>{user ? t('feed_empty') : 'No public activity yet'}</p>
            <p style={{ margin: '0 0 20px', color: '#555', fontSize: 14, lineHeight: 1.6 }}>
              {user ? 'Follow some members to see their activity here.' : 'Be the first to join and start tracking films.'}
            </p>
            {!user && (
              <button onClick={onSignUp} className="btn-gold" style={{ padding: '11px 24px', borderRadius: 12, fontSize: 14 }}>
                Create Account
              </button>
            )}
          </div>
        ) : (
          activities.map(activity => (
            <ActivityItem
              key={activity.id}
              activity={activity}
              isLiked={likedSet.has(activity.id)}
              onMediaClick={onMediaClick}
              onMemberClick={onMemberClick}
              onLike={user ? toggleLike : () => onSignIn()}
              onToggleComments={toggleComments}
              isCommentsOpen={openComments === activity.id}
              comments={commentMap[activity.id] ?? null}
              commentCount={commentCount[activity.id] ?? 0}
              onSubmitComment={user ? submitComment : async () => { onSignIn(); }}
              onDeleteComment={deleteComment}
              currentUserId={user?.id ?? ''}
              isGuest={!user}
              onRequireAuth={onSignIn}
              t={t}
            />
          ))
        )}
      </div>
    </div>
  );
}

function ActivityItem({
  activity, isLiked, onMediaClick, onMemberClick, onLike,
  onToggleComments, isCommentsOpen, comments, onSubmitComment, onDeleteComment,
  currentUserId, isGuest, onRequireAuth, t,
}: {
  activity: FeedActivity;
  isLiked: boolean;
  onMediaClick: (id: number, type: 'movie' | 'tv') => void;
  onMemberClick: (userId: string) => void;
  onLike: (id: string) => void;
  onToggleComments: (id: string) => void;
  isCommentsOpen: boolean;
  comments: FeedComment[] | null;
  commentCount: number;
  onSubmitComment: (activityId: string, content: string) => Promise<void>;
  onDeleteComment: (activityId: string, commentId: string) => void;
  currentUserId: string;
  isGuest?: boolean;
  onRequireAuth?: () => void;
  t: ReturnType<typeof useI18n>['t'];
}) {
  const profile = activity.profile;
  const ps = activity.poster_path ? posterUrl(activity.poster_path, 'w92') : null;
  const isOwn = activity.user_id === currentUserId;
  const [commentInput, setCommentInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d`;
    return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };

  const { icon, text } = getActivityDetails(activity, t);

  async function handleSubmitComment() {
    if (!commentInput.trim() || submitting) return;
    setSubmitting(true);
    await onSubmitComment(activity.id, commentInput.trim());
    setCommentInput('');
    setSubmitting(false);
  }

  useEffect(() => {
    if (isCommentsOpen) inputRef.current?.focus();
  }, [isCommentsOpen]);

  const displayCommentCount = comments !== null ? comments.length : 0;

  return (
    <div style={{ borderBottom: '1px solid #0f0f0f', paddingBottom: 0 }}>
      {/* Main activity row */}
      <div style={{ display: 'flex', gap: 12, padding: '14px 0 10px' }}>
        {/* Avatar */}
        <button
          onClick={() => onMemberClick(activity.user_id)}
          style={{ width: 40, height: 40, borderRadius: '50%', overflow: 'hidden', background: '#1a1a1a', border: `2px solid ${isOwn ? 'rgba(245,158,11,.4)' : '#222'}`, flexShrink: 0, cursor: 'pointer', transition: 'border-color .2s', padding: 0 }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = '#f59e0b')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = isOwn ? 'rgba(245,158,11,.4)' : '#222')}
        >
          {profile?.avatar_url
            ? <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <span style={{ color: '#fbbf24', fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>
                {profile?.username?.[0]?.toUpperCase() ?? '?'}
              </span>}
        </button>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
            <div style={{ width: 20, height: 20, borderRadius: 5, background: 'rgba(245,158,11,.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {icon}
            </div>
            <button
              onClick={() => onMemberClick(activity.user_id)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: isOwn ? '#fbbf24' : '#fff', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', padding: 0, transition: 'color .2s' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#fbbf24')}
              onMouseLeave={e => (e.currentTarget.style.color = isOwn ? '#fbbf24' : '#fff')}
            >
              {profile?.username ?? 'Unknown'}
            </button>
            <span style={{ color: '#555', fontSize: 12 }}>{text}</span>
            <span style={{ color: '#333', fontSize: 11, marginLeft: 'auto' }}>{timeAgo(activity.created_at)}</span>
          </div>

          {/* Film title */}
          {activity.title && (
            <button
              onClick={() => activity.tmdb_id && onMediaClick(activity.tmdb_id, (activity.media_type as 'movie' | 'tv') ?? 'movie')}
              style={{ background: 'none', border: 'none', cursor: activity.tmdb_id ? 'pointer' : 'default', color: '#ddd', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', padding: 0, textAlign: 'left', transition: 'color .2s', marginBottom: 4, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}
              onMouseEnter={e => { if (activity.tmdb_id) (e.currentTarget as HTMLButtonElement).style.color = '#f59e0b'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#ddd'; }}
            >
              {activity.title}
            </button>
          )}

          {/* Star rating */}
          {activity.rating != null && (
            <div style={{ display: 'flex', gap: 2, alignItems: 'center', marginBottom: 5 }}>
              {Array.from({ length: 5 }).map((_, i) => {
                const filled = i < Math.floor(activity.rating!);
                const half = !filled && i < activity.rating!;
                return <Star key={i} size={11} color="#f59e0b" fill={filled ? '#f59e0b' : half ? '#f59e0b' : 'none'} style={{ opacity: filled || half ? 1 : 0.2 }} />;
              })}
              <span style={{ color: '#888', fontSize: 11, marginLeft: 3 }}>{activity.rating}</span>
            </div>
          )}

          {/* Review excerpt */}
          {activity.review_content && (
            <div style={{ background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 8, padding: '8px 12px', marginBottom: 6 }}>
              <p style={{ margin: 0, color: '#888', fontSize: 12, lineHeight: 1.6, fontStyle: 'italic', display: '-webkit-box', overflow: 'hidden', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
                "{activity.review_content}"
              </p>
            </div>
          )}

          {/* Action row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 4 }}>
            <button
              onClick={() => onLike(activity.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: isLiked ? '#f87171' : '#444', fontSize: 12, fontFamily: 'inherit', transition: 'color .2s' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#f87171')}
              onMouseLeave={e => (e.currentTarget.style.color = isLiked ? '#f87171' : '#444')}
              title={isGuest ? 'Sign in to like' : undefined}
            >
              <Heart size={13} fill={isLiked ? '#f87171' : 'none'} />
              {activity.like_count > 0 && <span>{activity.like_count}</span>}
            </button>

            <button
              onClick={() => isGuest ? onRequireAuth?.() : onToggleComments(activity.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: isCommentsOpen ? '#60a5fa' : '#444', fontSize: 12, fontFamily: 'inherit', transition: 'color .2s' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#60a5fa')}
              onMouseLeave={e => (e.currentTarget.style.color = isCommentsOpen ? '#60a5fa' : '#444')}
              title={isGuest ? 'Sign in to comment' : undefined}
            >
              <MessageCircle size={13} />
              {displayCommentCount > 0 && <span>{displayCommentCount}</span>}
            </button>
          </div>
        </div>

        {/* Poster */}
        {ps && activity.tmdb_id && (
          <div
            style={{ width: 46, height: 69, borderRadius: 6, overflow: 'hidden', background: '#1a1a1a', flexShrink: 0, cursor: 'pointer', border: '1px solid #222', transition: 'border-color .2s', alignSelf: 'flex-start' }}
            onClick={() => onMediaClick(activity.tmdb_id!, (activity.media_type as 'movie' | 'tv') ?? 'movie')}
            onMouseEnter={e => (e.currentTarget.style.borderColor = '#f59e0b')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = '#222')}
          >
            <img src={ps} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
          </div>
        )}
      </div>

      {/* Comments section */}
      {isCommentsOpen && (
        <div style={{ paddingLeft: 52, paddingBottom: 14 }}>
          {/* Comment list */}
          {comments === null ? (
            <div style={{ padding: '8px 0' }}>
              <div className="shimmer" style={{ height: 32, borderRadius: 8 }} />
            </div>
          ) : comments.length === 0 ? (
            <p style={{ margin: '0 0 10px', color: '#333', fontSize: 12 }}>No replies yet — be the first</p>
          ) : (
            <div style={{ marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {comments.map(comment => (
                <CommentRow
                  key={comment.id}
                  comment={comment}
                  currentUserId={currentUserId}
                  onDelete={() => onDeleteComment(activity.id, comment.id)}
                />
              ))}
            </div>
          )}

          {/* Input */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              ref={inputRef}
              value={commentInput}
              onChange={e => setCommentInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmitComment(); } }}
              placeholder="Write a reply..."
              maxLength={500}
              style={{ flex: 1, background: '#111', border: '1px solid #2a2a2a', borderRadius: 20, padding: '8px 14px', color: '#fff', fontSize: 12, outline: 'none', fontFamily: 'inherit', transition: 'border-color .2s' }}
              onFocus={e => (e.target.style.borderColor = '#3a3a3a')}
              onBlur={e  => (e.target.style.borderColor = '#2a2a2a')}
            />
            <button
              onClick={handleSubmitComment}
              disabled={!commentInput.trim() || submitting}
              style={{ width: 32, height: 32, borderRadius: '50%', background: commentInput.trim() ? '#f59e0b' : '#1a1a1a', border: 'none', cursor: commentInput.trim() ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background .2s', flexShrink: 0 }}
            >
              <Send size={13} color={commentInput.trim() ? '#000' : '#444'} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function CommentRow({ comment, currentUserId, onDelete }: { comment: FeedComment; currentUserId: string; onDelete: () => void }) {
  const profile = comment.profile;
  const isOwn = comment.user_id === currentUserId;
  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    return `${Math.floor(hrs / 24)}d`;
  };

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
      <div style={{ width: 28, height: 28, borderRadius: '50%', overflow: 'hidden', background: '#1a1a1a', border: '1px solid #222', flexShrink: 0 }}>
        {profile?.avatar_url
          ? <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <span style={{ color: '#fbbf24', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>
              {profile?.username?.[0]?.toUpperCase() ?? '?'}
            </span>}
      </div>
      <div style={{ flex: 1, background: '#0d0d0d', borderRadius: 10, padding: '7px 10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
          <span style={{ color: isOwn ? '#fbbf24' : '#ccc', fontSize: 11, fontWeight: 700 }}>{profile?.username ?? 'Unknown'}</span>
          <span style={{ color: '#333', fontSize: 10 }}>{timeAgo(comment.created_at)}</span>
          {isOwn && (
            <button onClick={onDelete} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#333', padding: 0, transition: 'color .2s', display: 'flex', alignItems: 'center' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
              onMouseLeave={e => (e.currentTarget.style.color = '#333')}>
              <X size={11} />
            </button>
          )}
        </div>
        <p style={{ margin: 0, color: '#999', fontSize: 12, lineHeight: 1.5 }}>{comment.content}</p>
      </div>
    </div>
  );
}

function getActivityDetails(activity: FeedActivity, t: ReturnType<typeof useI18n>['t']): { icon: React.ReactNode; text: string } {
  switch (activity.activity_type) {
    case 'watched':    return { icon: <Film size={11} color="#f59e0b" />,    text: t('feed_watched') };
    case 'rated':      return { icon: <Star size={11} color="#f59e0b" />,    text: t('feed_rated') };
    case 'reviewed':   return { icon: <BookOpen size={11} color="#60a5fa" />,text: t('feed_reviewed') };
    case 'watchlisted':return { icon: <Bookmark size={11} color="#888" />,   text: t('feed_watchlisted') };
    case 'achievement':return { icon: <Trophy size={11} color="#f59e0b" />,  text: t('feed_achievement') };
    case 'followed':   return { icon: <UserPlus size={11} color="#4ade80" />,text: t('feed_followed') };
    case 'liked':      return { icon: <Heart size={11} color="#f87171" />,   text: t('feed_liked') };
    default:           return { icon: <Activity size={11} color="#888" />,   text: activity.activity_type };
  }
}
