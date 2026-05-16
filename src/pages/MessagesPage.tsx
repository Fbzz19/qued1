import { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Send, MessageSquare, User, CircleAlert as AlertCircle, Flag, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { containsOffensiveContent, MODERATION_ERROR, recordOffensiveStrike, isUserSuspended } from '../lib/moderation';
import type { DirectMessage } from '../lib/supabase';

interface MessagesPageProps {
  onBack: () => void;
  initialUserId?: string;
}

interface Thread {
  userId: string;
  username: string;
  avatar_url: string;
  lastMessage: string;
  lastAt: string;
  unread: number;
}

interface MessageWithSender extends DirectMessage {
  sender_username?: string;
  sender_avatar?: string;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export default function MessagesPage({ onBack, initialUserId }: MessagesPageProps) {
  const { user, profile } = useAuth();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeUserId, setActiveUserId] = useState<string | null>(initialUserId ?? null);
  const [activeUsername, setActiveUsername] = useState('');
  const [messages, setMessages] = useState<MessageWithSender[]>([]);
  const [text, setText] = useState('');
  const [sendError, setSendError] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [reportTarget, setReportTarget] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [reportSent, setReportSent] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadThreads = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('direct_messages')
      .select('*')
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order('created_at', { ascending: false });

    if (!data) { setLoadingThreads(false); return; }

    // Group by conversation partner
    const threadMap = new Map<string, { msgs: DirectMessage[]; unread: number }>();
    for (const msg of data) {
      const partnerId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;
      if (!threadMap.has(partnerId)) threadMap.set(partnerId, { msgs: [], unread: 0 });
      const t = threadMap.get(partnerId)!;
      t.msgs.push(msg);
      if (!msg.seen && msg.receiver_id === user.id) t.unread++;
    }

    // Fetch partner profiles
    const partnerIds = [...threadMap.keys()];
    let profileMap: Record<string, { username: string; avatar_url: string }> = {};
    if (partnerIds.length) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .in('id', partnerIds);
      (profiles ?? []).forEach((p: { id: string; username: string; avatar_url: string }) => {
        profileMap[p.id] = { username: p.username, avatar_url: p.avatar_url };
      });
    }

    const result: Thread[] = partnerIds.map(id => {
      const { msgs, unread } = threadMap.get(id)!;
      const latest = msgs[0];
      return {
        userId: id,
        username: profileMap[id]?.username ?? 'Unknown',
        avatar_url: profileMap[id]?.avatar_url ?? '',
        lastMessage: latest.content,
        lastAt: latest.created_at,
        unread,
      };
    }).sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime());

    setThreads(result);
    setLoadingThreads(false);
  }, [user]);

  const loadMessages = useCallback(async (partnerId: string) => {
    if (!user) return;
    const { data } = await supabase
      .from('direct_messages')
      .select('*')
      .or(
        `and(sender_id.eq.${user.id},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${user.id})`
      )
      .order('created_at', { ascending: true });

    const msgs = data ?? [];

    // Fetch partner username
    const { data: partnerProfile } = await supabase
      .from('profiles')
      .select('username, avatar_url')
      .eq('id', partnerId)
      .maybeSingle();
    setActiveUsername(partnerProfile?.username ?? 'Unknown');

    // Mark unread as seen
    const unreadIds = msgs.filter(m => m.receiver_id === user.id && !m.seen).map(m => m.id);
    if (unreadIds.length) {
      await supabase.from('direct_messages').update({ seen: true }).in('id', unreadIds);
      setThreads(ts => ts.map(t => t.userId === partnerId ? { ...t, unread: 0 } : t));
    }

    setMessages(msgs.map(m => ({
      ...m,
      sender_username: m.sender_id === user.id ? profile?.username : partnerProfile?.username,
      sender_avatar: m.sender_id === user.id ? profile?.avatar_url : partnerProfile?.avatar_url,
    })));
  }, [user, profile]);

  useEffect(() => { loadThreads(); }, [loadThreads]);

  useEffect(() => {
    if (activeUserId) loadMessages(activeUserId);
  }, [activeUserId, loadMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Poll for new messages
  useEffect(() => {
    if (!activeUserId) return;
    const interval = setInterval(() => loadMessages(activeUserId), 10000);
    return () => clearInterval(interval);
  }, [activeUserId, loadMessages]);

  async function sendMessage() {
    if (!user || !activeUserId || !text.trim()) return;
    setSendError('');

    const suspended = await isUserSuspended(user.id, supabase);
    if (suspended) { setSendError('Your account is suspended.'); return; }

    if (containsOffensiveContent(text)) {
      await recordOffensiveStrike(user.id, supabase);
      setSendError(MODERATION_ERROR);
      return;
    }

    // Check blocked
    const { data: block } = await supabase
      .from('blocked_users')
      .select('id')
      .or(`and(blocker_id.eq.${user.id},blocked_id.eq.${activeUserId}),and(blocker_id.eq.${activeUserId},blocked_id.eq.${user.id})`)
      .maybeSingle();
    if (block) { setSendError('You cannot message this user.'); return; }

    setSending(true);
    const content = text.trim();
    setText('');

    const { data: newMsg } = await supabase
      .from('direct_messages')
      .insert({ sender_id: user.id, receiver_id: activeUserId, content })
      .select()
      .single();

    if (newMsg) {
      setMessages(ms => [...ms, {
        ...newMsg,
        sender_username: profile?.username,
        sender_avatar: profile?.avatar_url,
      }]);

      // Create notification for receiver
      await supabase.from('notifications').insert({
        user_id: activeUserId,
        type: 'dm',
        actor_id: user.id,
        message: `sent you a message`,
        seen: false,
      });
    }

    setSending(false);
    loadThreads();
  }

  async function submitReport() {
    if (!user || !reportTarget || !reportReason) return;
    await supabase.from('reports').insert({
      reporter_id: user.id,
      reported_user_id: reportTarget,
      reason: reportReason,
      content_type: 'message',
    });
    setReportSent(true);
    setTimeout(() => { setReportTarget(null); setReportSent(false); setReportReason(''); }, 2000);
  }

  const REPORT_REASONS = ['Offensive content', 'Spam', 'Harassment', 'Threats', 'Other'];

  if (!user) return null;

  return (
    <div style={{ minHeight: '100vh', background: '#000', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ position: 'sticky', top: 56, zIndex: 10, background: 'rgba(5,5,5,0.97)', backdropFilter: 'blur(12px)', borderBottom: '1px solid #1a1a1a', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', display: 'flex', padding: 4 }}>
          <ArrowLeft size={20} />
        </button>
        <MessageSquare size={18} color="#f59e0b" />
        <h1 style={{ margin: 0, color: '#fff', fontSize: 18, fontWeight: 700 }}>Messages</h1>
      </div>

      <div style={{ display: 'flex', flex: 1, maxWidth: 1000, margin: '0 auto', width: '100%' }}>
        {/* Thread list */}
        <div style={{ width: 280, borderRight: '1px solid #1a1a1a', overflowY: 'auto', flexShrink: 0 }} className="no-scrollbar">
          {loadingThreads && (
            <div style={{ padding: 24, textAlign: 'center', color: '#555', fontSize: 13 }}>Loading...</div>
          )}
          {!loadingThreads && threads.length === 0 && (
            <div style={{ padding: 32, textAlign: 'center' }}>
              <MessageSquare size={32} color="#2a2a2a" style={{ marginBottom: 12 }} />
              <p style={{ margin: 0, color: '#555', fontSize: 13 }}>No messages yet</p>
              <p style={{ margin: '6px 0 0', color: '#444', fontSize: 12 }}>Visit a user's profile to start a conversation</p>
            </div>
          )}
          {threads.map(t => (
            <button
              key={t.userId}
              onClick={() => setActiveUserId(t.userId)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '14px 16px',
                background: activeUserId === t.userId ? '#141414' : 'none',
                border: 'none', borderBottom: '1px solid #111', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                transition: 'background .15s',
              }}
              onMouseEnter={e => { if (activeUserId !== t.userId) (e.currentTarget as HTMLButtonElement).style.background = '#0d0d0d'; }}
              onMouseLeave={e => { if (activeUserId !== t.userId) (e.currentTarget as HTMLButtonElement).style.background = 'none'; }}
            >
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#1e1e1e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#fbbf24', flexShrink: 0, overflow: 'hidden' }}>
                {t.avatar_url
                  ? <img src={t.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : t.username[0]?.toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ color: '#e5e5e5', fontSize: 13, fontWeight: t.unread > 0 ? 700 : 500 }}>{t.username}</span>
                  <span style={{ color: '#555', fontSize: 10 }}>{timeAgo(t.lastAt)}</span>
                </div>
                <p style={{ margin: '2px 0 0', color: '#666', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {t.lastMessage}
                </p>
              </div>
              {t.unread > 0 && (
                <span style={{ background: '#f59e0b', color: '#000', fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 99, flexShrink: 0 }}>{t.unread}</span>
              )}
            </button>
          ))}
        </div>

        {/* Conversation area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {!activeUserId ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
              <MessageSquare size={48} color="#1e1e1e" style={{ marginBottom: 16 }} />
              <p style={{ margin: 0, color: '#555', fontSize: 15 }}>Select a conversation</p>
            </div>
          ) : (
            <>
              {/* Conversation header */}
              <div style={{ padding: '12px 20px', borderBottom: '1px solid #1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#1e1e1e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fbbf24' }}>
                    {activeUsername[0]?.toUpperCase()}
                  </div>
                  <span style={{ color: '#e5e5e5', fontSize: 14, fontWeight: 600 }}>{activeUsername}</span>
                </div>
                <button
                  onClick={() => setReportTarget(activeUserId)}
                  title="Report"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#555', display: 'flex', padding: 6 }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#ef4444'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#555'; }}
                >
                  <Flag size={14} />
                </button>
              </div>

              {/* Messages */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 8 }} className="no-scrollbar">
                {messages.map(m => {
                  const isOwn = m.sender_id === user.id;
                  return (
                    <div key={m.id} style={{ display: 'flex', justifyContent: isOwn ? 'flex-end' : 'flex-start', gap: 8, alignItems: 'flex-end' }}>
                      {!isOwn && (
                        <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#1e1e1e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fbbf24', flexShrink: 0 }}>
                          {m.sender_username?.[0]?.toUpperCase() ?? <User size={10} />}
                        </div>
                      )}
                      <div style={{ maxWidth: '70%' }}>
                        <div style={{
                          padding: '8px 12px', borderRadius: isOwn ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                          background: isOwn ? '#f59e0b' : '#1a1a1a',
                          color: isOwn ? '#000' : '#e5e5e5',
                          fontSize: 13, lineHeight: 1.5,
                        }}>
                          {m.content}
                        </div>
                        <p style={{ margin: '3px 0 0', color: '#444', fontSize: 10, textAlign: isOwn ? 'right' : 'left' }}>
                          {formatTime(m.created_at)}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Send error */}
              {sendError && (
                <div style={{ margin: '0 16px', padding: '8px 12px', background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
                  <AlertCircle size={13} color="#ef4444" />
                  <span style={{ color: '#ef4444', fontSize: 12 }}>{sendError}</span>
                </div>
              )}

              {/* Input */}
              <div style={{ padding: '12px 16px', borderTop: '1px solid #1a1a1a', display: 'flex', gap: 10, alignItems: 'flex-end' }}>
                <textarea
                  value={text}
                  onChange={e => { setText(e.target.value); setSendError(''); }}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  placeholder="Type a message..."
                  rows={1}
                  style={{
                    flex: 1, background: '#111', border: '1px solid #2e2e2e', borderRadius: 10,
                    padding: '10px 14px', color: '#e5e5e5', fontSize: 13, resize: 'none',
                    fontFamily: 'inherit', outline: 'none', lineHeight: 1.5,
                    maxHeight: 120, overflowY: 'auto',
                  }}
                />
                <button
                  onClick={sendMessage}
                  disabled={!text.trim() || sending}
                  style={{
                    width: 38, height: 38, borderRadius: 10, border: 'none',
                    background: text.trim() && !sending ? '#f59e0b' : '#1a1a1a',
                    cursor: text.trim() && !sending ? 'pointer' : 'default',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, transition: 'background .2s',
                  }}
                >
                  <Send size={15} color={text.trim() && !sending ? '#000' : '#333'} />
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Report modal */}
      {reportTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500, padding: 24 }}
          onClick={() => setReportTarget(null)}>
          <div style={{ background: '#111', border: '1px solid #2e2e2e', borderRadius: 16, padding: 28, width: '100%', maxWidth: 360 }}
            onClick={e => e.stopPropagation()}>
            {reportSent ? (
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(34,197,94,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                  <Flag size={20} color="#22c55e" />
                </div>
                <p style={{ margin: 0, color: '#e5e5e5', fontWeight: 600 }}>Report submitted</p>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <h3 style={{ margin: 0, color: '#fff', fontSize: 16, fontWeight: 700 }}>Report User</h3>
                  <button onClick={() => setReportTarget(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#555' }}><X size={16} /></button>
                </div>
                <p style={{ margin: '0 0 16px', color: '#888', fontSize: 13 }}>Select a reason:</p>
                {REPORT_REASONS.map(r => (
                  <button key={r} onClick={() => setReportReason(r)} style={{ display: 'block', width: '100%', padding: '10px 14px', marginBottom: 8, background: reportReason === r ? 'rgba(239,68,68,.1)' : '#1a1a1a', border: `1px solid ${reportReason === r ? 'rgba(239,68,68,.4)' : '#2e2e2e'}`, borderRadius: 10, color: reportReason === r ? '#ef4444' : '#aaa', fontSize: 13, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', transition: 'all .15s' }}>
                    {r}
                  </button>
                ))}
                <button
                  onClick={submitReport}
                  disabled={!reportReason}
                  className="btn-gold"
                  style={{ width: '100%', padding: '12px', borderRadius: 10, marginTop: 8, fontSize: 13, opacity: reportReason ? 1 : 0.5 }}
                >
                  Submit Report
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
