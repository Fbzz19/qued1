import { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, X, Check, User, Heart, MessageSquare, Trophy, UserPlus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import type { Notification } from '../lib/supabase';

interface NotificationPanelProps {
  onNavigate?: (type: string, refId: string | null) => void;
}

interface NotifWithActor extends Notification {
  actor_username?: string;
  actor_avatar?: string;
  requestResolved?: 'accepted' | 'declined';
}

function notifIcon(type: string) {
  switch (type) {
    case 'follow': return <User size={14} color="#60a5fa" />;
    case 'review_like': return <Heart size={14} color="#f87171" />;
    case 'review_comment': return <MessageSquare size={14} color="#34d399" />;
    case 'achievement': return <Trophy size={14} color="#fbbf24" />;
    case 'friend_request': return <UserPlus size={14} color="#f59e0b" />;
    default: return <Bell size={14} color="#888" />;
  }
}

function notifColor(type: string) {
  switch (type) {
    case 'follow': return 'rgba(96,165,250,.12)';
    case 'review_like': return 'rgba(248,113,113,.12)';
    case 'review_comment': return 'rgba(52,211,153,.12)';
    case 'achievement': return 'rgba(251,191,36,.12)';
    case 'friend_request': return 'rgba(245,158,11,.12)';
    default: return 'rgba(136,136,136,.08)';
  }
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function useNotificationCount() {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  const fetchCount = useCallback(async () => {
    if (!user) { setCount(0); return; }
    const { count: c } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('seen', false);
    setCount(c ?? 0);
  }, [user]);

  useEffect(() => {
    fetchCount();
    const interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  }, [fetchCount]);

  return { count, refresh: fetchCount };
}

export default function NotificationPanel({ onNavigate }: NotificationPanelProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState<NotifWithActor[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const fetchNotifs = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(40);

    if (!data) { setLoading(false); return; }

    // Enrich with actor usernames
    const actorIds = [...new Set(data.filter(n => n.actor_id).map(n => n.actor_id as string))];
    let actorMap: Record<string, { username: string; avatar_url: string }> = {};
    if (actorIds.length) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .in('id', actorIds);
      (profiles ?? []).forEach((p: { id: string; username: string; avatar_url: string }) => {
        actorMap[p.id] = { username: p.username, avatar_url: p.avatar_url };
      });
    }

    const enriched: NotifWithActor[] = data.map(n => ({
      ...n,
      actor_username: n.actor_id ? actorMap[n.actor_id]?.username : undefined,
      actor_avatar: n.actor_id ? actorMap[n.actor_id]?.avatar_url : undefined,
    }));

    setNotifs(enriched);
    setUnread(enriched.filter(n => !n.seen).length);
    setLoading(false);
  }, [user]);

  // Poll for count
  useEffect(() => {
    if (!user) return;
    const poll = async () => {
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('seen', false);
      setUnread(count ?? 0);
    };
    poll();
    const interval = setInterval(poll, 30000);
    return () => clearInterval(interval);
  }, [user]);

  // Load when opened
  useEffect(() => {
    if (open) fetchNotifs();
  }, [open, fetchNotifs]);

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  async function markAllRead() {
    if (!user) return;
    await supabase
      .from('notifications')
      .update({ seen: true })
      .eq('user_id', user.id)
      .eq('seen', false);
    setNotifs(ns => ns.map(n => ({ ...n, seen: true })));
    setUnread(0);
  }

  async function markRead(id: string) {
    await supabase.from('notifications').update({ seen: true }).eq('id', id);
    setNotifs(ns => ns.map(n => n.id === id ? { ...n, seen: true } : n));
    setUnread(u => Math.max(0, u - 1));
  }

  async function respondToRequest(n: NotifWithActor, accept: boolean) {
    if (!user || !n.actor_id) return;
    const status = accept ? 'accepted' : 'declined';

    await supabase.from('follow_requests')
      .update({ status })
      .eq('requester_id', n.actor_id)
      .eq('target_id', user.id);

    if (accept) {
      // Create the actual follow relationship
      await supabase.from('follows').upsert(
        { follower_id: n.actor_id, following_id: user.id },
        { onConflict: 'follower_id,following_id' }
      );
      // Notify the requester their request was accepted
      await supabase.from('notifications').insert({
        user_id: n.actor_id,
        type: 'follow',
        actor_id: user.id,
        message: 'accepted your follow request',
        reference_id: user.id,
        seen: false,
      });
    }

    markRead(n.id);
    setNotifs(ns => ns.map(x => x.id === n.id ? { ...x, requestResolved: status, seen: true } : x));
  }

  function handleClick(n: NotifWithActor) {
    if (n.type === 'friend_request') return; // handled by accept/decline buttons
    if (!n.seen) markRead(n.id);
    if (onNavigate) onNavigate(n.type, n.reference_id);
    setOpen(false);
  }

  if (!user) return null;

  return (
    <div ref={panelRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        title="Notifications"
        style={{
          width: 34, height: 34, borderRadius: 8, border: 'none',
          background: open ? 'rgba(245,158,11,.12)' : 'none',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: open ? '#f59e0b' : '#888', transition: 'color .2s, background .2s',
          position: 'relative',
        }}
        onMouseEnter={e => { if (!open) (e.currentTarget as HTMLButtonElement).style.color = '#ccc'; }}
        onMouseLeave={e => { if (!open) (e.currentTarget as HTMLButtonElement).style.color = '#888'; }}
      >
        <Bell size={16} />
        {unread > 0 && (
          <span style={{
            position: 'absolute', top: 4, right: 4,
            width: 16, height: 16, borderRadius: '50%',
            background: '#ef4444', color: '#fff',
            fontSize: 9, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid #050505',
          }}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="animate-slide-down"
          style={{
            position: 'absolute', top: 42, right: 0,
            width: 340, maxHeight: 480,
            background: '#0f0f0f', border: '1px solid #1e1e1e',
            borderRadius: 14, overflow: 'hidden',
            boxShadow: '0 20px 60px rgba(0,0,0,.8)',
            zIndex: 300,
            display: 'flex', flexDirection: 'column',
          }}
        >
          {/* Header */}
          <div style={{ padding: '14px 16px', borderBottom: '1px solid #1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Bell size={14} color="#f59e0b" />
              <span style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>Notifications</span>
              {unread > 0 && (
                <span style={{ background: '#ef4444', color: '#fff', fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 99 }}>{unread}</span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {unread > 0 && (
                <button
                  onClick={markAllRead}
                  title="Mark all read"
                  style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', color: '#888', fontSize: 11, fontWeight: 500, padding: '4px 8px', borderRadius: 6, transition: 'color .2s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#f59e0b'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#888'; }}
                >
                  <Check size={11} /> Mark all read
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                style={{ width: 24, height: 24, borderRadius: 6, border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555' }}
              >
                <X size={13} />
              </button>
            </div>
          </div>

          {/* List */}
          <div style={{ overflowY: 'auto', flex: 1 }} className="no-scrollbar">
            {loading && (
              <div style={{ padding: 24, textAlign: 'center', color: '#555', fontSize: 13 }}>Loading...</div>
            )}
            {!loading && notifs.length === 0 && (
              <div style={{ padding: 32, textAlign: 'center' }}>
                <Bell size={28} color="#2a2a2a" style={{ marginBottom: 10 }} />
                <p style={{ margin: 0, color: '#555', fontSize: 13 }}>No notifications yet</p>
              </div>
            )}
            {!loading && notifs.map(n => (
              <div
                key={n.id}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10, width: '100%',
                  padding: '12px 16px', background: n.seen ? 'none' : 'rgba(245,158,11,.04)',
                  borderBottom: '1px solid #111',
                  cursor: n.type === 'friend_request' ? 'default' : 'pointer',
                  transition: 'background .15s',
                }}
                onClick={() => handleClick(n)}
                onMouseEnter={e => { if (n.type !== 'friend_request') (e.currentTarget as HTMLDivElement).style.background = '#141414'; }}
                onMouseLeave={e => { if (n.type !== 'friend_request') (e.currentTarget as HTMLDivElement).style.background = n.seen ? 'none' : 'rgba(245,158,11,.04)'; }}
              >
                {/* Icon badge */}
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: notifColor(n.type), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                  {notifIcon(n.type)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: '0 0 2px', color: n.seen ? '#aaa' : '#e5e5e5', fontSize: 13, lineHeight: 1.4 }}>
                    {n.actor_username && <strong style={{ color: '#fff' }}>{n.actor_username} </strong>}
                    {n.message ?? 'New notification'}
                  </p>
                  <p style={{ margin: '0 0 6px', color: '#555', fontSize: 11 }}>{timeAgo(n.created_at)}</p>
                  {/* Accept / decline for follow requests */}
                  {n.type === 'friend_request' && (
                    n.requestResolved ? (
                      <p style={{ margin: 0, fontSize: 11, color: n.requestResolved === 'accepted' ? '#4ade80' : '#888', fontWeight: 600 }}>
                        {n.requestResolved === 'accepted' ? 'Accepted' : 'Declined'}
                      </p>
                    ) : (
                      <div style={{ display: 'flex', gap: 6 }} onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => respondToRequest(n, true)}
                          style={{ padding: '5px 12px', borderRadius: 7, border: 'none', background: '#f59e0b', color: '#000', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'background .15s' }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#fbbf24')}
                          onMouseLeave={e => (e.currentTarget.style.background = '#f59e0b')}
                        >
                          Accept
                        </button>
                        <button
                          onClick={() => respondToRequest(n, false)}
                          style={{ padding: '5px 12px', borderRadius: 7, border: '1px solid #2e2e2e', background: 'none', color: '#888', fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s' }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = '#ef4444'; e.currentTarget.style.color = '#f87171'; }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = '#2e2e2e'; e.currentTarget.style.color = '#888'; }}
                        >
                          Decline
                        </button>
                      </div>
                    )
                  )}
                </div>
                {!n.seen && n.type !== 'friend_request' && (
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#f59e0b', flexShrink: 0, marginTop: 5 }} />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
