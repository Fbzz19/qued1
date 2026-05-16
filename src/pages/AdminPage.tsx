import { useEffect, useState, useCallback } from 'react';
import { ArrowLeft, Users, Film, Star, Clock, Shield, Flag, ChartBar as BarChart2, Search, Ban, TriangleAlert as AlertTriangle, CircleCheck as CheckCircle, RefreshCw, Trash2, Eye, Plus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

interface AdminPageProps {
  onBack: () => void;
  onMediaClick: (id: number, type: 'movie' | 'tv') => void;
}

interface OverviewStats {
  totalUsers: number;
  dau: number;
  newSignupsThisWeek: number;
  totalFilmsLogged: number;
  totalReviews: number;
  totalWatchMins: number;
  waitlistCount: number;
  proCount: number;
}

interface UserRow {
  id: string;
  username: string;
  email?: string;
  role: string;
  is_banned: boolean;
  suspended_until: string | null;
  created_at: string;
  last_active_at: string | null;
}

interface ReportRow {
  id: string;
  reporter_id: string;
  reported_user_id: string | null;
  reason: string;
  content_type: string;
  content_id: string | null;
  notes: string | null;
  created_at: string;
  reporter_username?: string;
  reported_username?: string;
  resolved?: boolean;
}

interface StaffPickForm {
  tmdbId: string;
  mediaType: 'movie' | 'tv';
  title: string;
  note: string;
}

type AdminTab = 'overview' | 'users' | 'reports' | 'staff_picks';

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function AdminPage({ onBack }: AdminPageProps) {
  const { user, profile } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [staffPicks, setStaffPicks] = useState<{id: string; tmdb_id: number; media_type: string; title: string; note: string; active: boolean; created_at: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [suspendDays, setSuspendDays] = useState<Record<string, number>>({});
  const [pickForm, setPickForm] = useState<StaffPickForm>({ tmdbId: '', mediaType: 'movie', title: '', note: '' });
  const [addingPick, setAddingPick] = useState(false);

  // Guard: must be admin
  const isAdmin = profile?.role === 'admin';

  const loadStats = useCallback(async () => {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const dayAgo  = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

    const [
      { count: totalUsers },
      { count: dau },
      { count: newSignups },
      { count: totalFilms },
      { count: totalReviews },
      { data: watchData },
      { count: waitlist },
      { count: pro },
    ] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('last_active_at', dayAgo),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', weekAgo),
      supabase.from('watched').select('*', { count: 'exact', head: true }),
      supabase.from('reviews').select('*', { count: 'exact', head: true }),
      supabase.from('watched').select('runtime_minutes'),
      supabase.from('notification_emails').select('*', { count: 'exact', head: true }),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'pro'),
    ]);

    const totalMins = (watchData ?? []).reduce((s: number, r: { runtime_minutes: number }) => s + (r.runtime_minutes ?? 0), 0);

    setStats({
      totalUsers: totalUsers ?? 0,
      dau: dau ?? 0,
      newSignupsThisWeek: newSignups ?? 0,
      totalFilmsLogged: totalFilms ?? 0,
      totalReviews: totalReviews ?? 0,
      totalWatchMins: totalMins,
      waitlistCount: waitlist ?? 0,
      proCount: pro ?? 0,
    });
  }, []);

  const loadUsers = useCallback(async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, username, role, is_banned, suspended_until, created_at, last_active_at')
      .order('created_at', { ascending: false })
      .limit(200);
    setUsers((data ?? []) as UserRow[]);
  }, []);

  const loadReports = useCallback(async () => {
    const { data } = await supabase
      .from('reports')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    if (!data) return;

    const rIds = [...new Set([...data.map(r => r.reporter_id), ...data.filter(r => r.reported_user_id).map(r => r.reported_user_id!)])];
    const { data: profiles } = rIds.length ? await supabase.from('profiles').select('id, username').in('id', rIds) : { data: [] };
    const pmap: Record<string, string> = {};
    (profiles ?? []).forEach((p: { id: string; username: string }) => { pmap[p.id] = p.username; });

    setReports(data.map(r => ({
      ...r,
      reporter_username: pmap[r.reporter_id] ?? 'Unknown',
      reported_username: r.reported_user_id ? (pmap[r.reported_user_id] ?? 'Unknown') : 'N/A',
    })));
  }, []);

  const loadStaffPicks = useCallback(async () => {
    const { data } = await supabase.from('staff_picks').select('*').order('created_at', { ascending: false });
    setStaffPicks(data ?? []);
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    setLoading(true);
    Promise.all([loadStats(), loadUsers(), loadReports(), loadStaffPicks()]).then(() => setLoading(false));
  }, [isAdmin, loadStats, loadUsers, loadReports, loadStaffPicks]);

  async function adminAction(targetUserId: string, action: string, notes?: string) {
    if (!user || !profile) return;
    setActionLoading(targetUserId + action);

    const adminUsername = profile.username ?? 'admin';

    if (action === 'ban') {
      await supabase.from('profiles').update({ is_banned: true, ban_reason: notes ?? 'Violated community guidelines' }).eq('id', targetUserId);
    } else if (action === 'unban') {
      await supabase.from('profiles').update({ is_banned: false, ban_reason: null }).eq('id', targetUserId);
    } else if (action === 'suspend') {
      const days = suspendDays[targetUserId] || 7;
      const until = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
      await supabase.from('profiles').update({ suspended_until: until }).eq('id', targetUserId);
    } else if (action === 'unsuspend') {
      await supabase.from('profiles').update({ suspended_until: null }).eq('id', targetUserId);
    } else if (action === 'grant_pro') {
      const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      await supabase.from('profiles').update({ role: 'pro', pro_expires_at: expires }).eq('id', targetUserId);
    } else if (action === 'revoke_pro') {
      await supabase.from('profiles').update({ role: 'user', pro_expires_at: null }).eq('id', targetUserId);
    }

    await supabase.from('admin_actions').insert({
      admin_id: user.id,
      admin_username: adminUsername,
      target_user_id: targetUserId,
      action_type: action,
      notes: notes ?? null,
    });

    await loadUsers();
    setActionLoading(null);
  }

  async function resolveReport(reportId: string) {
    await supabase.from('reports').update({ notes: 'resolved' }).eq('id', reportId);
    setReports(rs => rs.map(r => r.id === reportId ? { ...r, resolved: true } : r));
  }

  async function addStaffPick() {
    if (!user || !pickForm.tmdbId || !pickForm.title) return;
    setAddingPick(true);
    await supabase.from('staff_picks').insert({
      admin_id: user.id,
      tmdb_id: parseInt(pickForm.tmdbId),
      media_type: pickForm.mediaType,
      title: pickForm.title,
      note: pickForm.note,
      active: true,
    });
    setPickForm({ tmdbId: '', mediaType: 'movie', title: '', note: '' });
    await loadStaffPicks();
    setAddingPick(false);
  }

  async function toggleStaffPickActive(id: string, active: boolean) {
    await supabase.from('staff_picks').update({ active: !active }).eq('id', id);
    setStaffPicks(sp => sp.map(p => p.id === id ? { ...p, active: !active } : p));
  }

  async function deleteStaffPick(id: string) {
    await supabase.from('staff_picks').delete().eq('id', id);
    setStaffPicks(sp => sp.filter(p => p.id !== id));
  }

  if (!isAdmin) {
    return (
      <div style={{ minHeight: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <Shield size={48} color="#1a1a1a" style={{ marginBottom: 16 }} />
          <p style={{ color: '#555', fontSize: 16 }}>Access denied.</p>
          <button onClick={onBack} className="btn-ghost" style={{ marginTop: 16, fontSize: 13, padding: '8px 20px', borderRadius: 8 }}>Go Home</button>
        </div>
      </div>
    );
  }

  const filteredUsers = users.filter(u =>
    !userSearch ||
    u.username?.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.role?.includes(userSearch.toLowerCase())
  );

  const TABS: { key: AdminTab; label: string; icon: React.ReactNode }[] = [
    { key: 'overview',    label: 'Overview',    icon: <BarChart2 size={14} /> },
    { key: 'users',       label: 'Users',       icon: <Users size={14} /> },
    { key: 'reports',     label: 'Reports',     icon: <Flag size={14} /> },
    { key: 'staff_picks', label: 'Staff Picks', icon: <Star size={14} /> },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#000', paddingBottom: 80 }}>
      {/* Header */}
      <div style={{ position: 'sticky', top: 56, zIndex: 20, background: 'rgba(5,5,5,0.98)', backdropFilter: 'blur(12px)', borderBottom: '1px solid #1a1a1a', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888' }}>
          <ArrowLeft size={20} />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(239,68,68,.15)', border: '1px solid rgba(239,68,68,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Shield size={16} color="#ef4444" />
          </div>
          <div>
            <h1 style={{ margin: 0, color: '#fff', fontSize: 17, fontWeight: 700 }}>Admin Dashboard</h1>
            <p style={{ margin: 0, color: '#555', fontSize: 11 }}>Signed in as {profile?.username}</p>
          </div>
        </div>
        {/* Tabs */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 500, transition: 'all .15s', background: activeTab === t.key ? '#1a1a1a' : 'none', color: activeTab === t.key ? '#fff' : '#666' }}>
              {t.icon} {t.label}
              {t.key === 'reports' && reports.filter(r => !r.resolved).length > 0 && (
                <span style={{ background: '#ef4444', color: '#fff', fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 99, marginLeft: 2 }}>{reports.filter(r => !r.resolved).length}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px clamp(16px,3vw,32px)' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#555' }}>Loading...</div>
        ) : (

          <>
            {/* ─── OVERVIEW ─── */}
            {activeTab === 'overview' && stats && (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14, marginBottom: 32 }}>
                  {[
                    { label: 'Total Users', value: stats.totalUsers.toLocaleString(), icon: <Users size={18} color="#60a5fa" />, bg: 'rgba(96,165,250,.08)' },
                    { label: 'Daily Active', value: stats.dau.toLocaleString(), icon: <Activity size={18} color="#34d399" />, bg: 'rgba(52,211,153,.08)' },
                    { label: 'New This Week', value: stats.newSignupsThisWeek.toLocaleString(), icon: <TrendUp size={18} color="#fbbf24" />, bg: 'rgba(251,191,36,.08)' },
                    { label: 'Films Logged', value: stats.totalFilmsLogged.toLocaleString(), icon: <Film size={18} color="#f59e0b" />, bg: 'rgba(245,158,11,.08)' },
                    { label: 'Reviews', value: stats.totalReviews.toLocaleString(), icon: <Star size={18} color="#fbbf24" />, bg: 'rgba(251,191,36,.08)' },
                    { label: 'Watch Time', value: `${Math.floor(stats.totalWatchMins / 60).toLocaleString()}h`, icon: <Clock size={18} color="#a78bfa" />, bg: 'rgba(167,139,250,.08)' },
                    { label: 'AI Waitlist', value: stats.waitlistCount.toLocaleString(), icon: <Sparkles size={18} color="#f59e0b" />, bg: 'rgba(245,158,11,.08)' },
                    { label: 'Pro Members', value: stats.proCount.toLocaleString(), icon: <Crown size={18} color="#fbbf24" />, bg: 'rgba(251,191,36,.1)' },
                  ].map(({ label, value, icon, bg }) => (
                    <div key={label} style={{ background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 14, padding: '20px 18px' }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>{icon}</div>
                      <p style={{ margin: '0 0 4px', color: '#fff', fontSize: 26, fontWeight: 800 }}>{value}</p>
                      <p style={{ margin: 0, color: '#555', fontSize: 12 }}>{label}</p>
                    </div>
                  ))}
                </div>

                {/* Recent admin actions */}
                <RecentAdminActions />
              </div>
            )}

            {/* ─── USERS ─── */}
            {activeTab === 'users' && (
              <div>
                <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center' }}>
                  <div style={{ position: 'relative', flex: 1, maxWidth: 360 }}>
                    <Search size={14} color="#555" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                    <input
                      value={userSearch}
                      onChange={e => setUserSearch(e.target.value)}
                      placeholder="Search by username or role..."
                      style={{ width: '100%', background: '#111', border: '1px solid #2e2e2e', borderRadius: 10, padding: '9px 12px 9px 34px', color: '#e5e5e5', fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
                    />
                  </div>
                  <button onClick={loadUsers} style={{ background: 'none', border: '1px solid #2e2e2e', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', color: '#666', display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, fontFamily: 'inherit' }}>
                    <RefreshCw size={13} /> Refresh
                  </button>
                  <span style={{ color: '#555', fontSize: 12 }}>{filteredUsers.length} users</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {filteredUsers.map(u => (
                    <div key={u.id} style={{ background: '#0d0d0d', border: `1px solid ${u.is_banned ? 'rgba(239,68,68,.2)' : u.suspended_until && new Date(u.suspended_until) > new Date() ? 'rgba(245,158,11,.2)' : '#1a1a1a'}`, borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                      {/* Avatar letter */}
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#1e1e1e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#fbbf24', flexShrink: 0 }}>
                        {u.username?.[0]?.toUpperCase()}
                      </div>

                      <div style={{ flex: 1, minWidth: 160 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ color: '#e5e5e5', fontSize: 14, fontWeight: 600 }}>{u.username}</span>
                          <RoleBadge role={u.role} />
                          {u.is_banned && <span style={{ fontSize: 10, color: '#f87171', background: 'rgba(239,68,68,.1)', padding: '2px 7px', borderRadius: 20, border: '1px solid rgba(239,68,68,.3)' }}>Banned</span>}
                          {u.suspended_until && new Date(u.suspended_until) > new Date() && (
                            <span style={{ fontSize: 10, color: '#fbbf24', background: 'rgba(245,158,11,.1)', padding: '2px 7px', borderRadius: 20, border: '1px solid rgba(245,158,11,.3)' }}>Suspended</span>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: 12, marginTop: 3 }}>
                          <span style={{ color: '#444', fontSize: 11 }}>Joined {new Date(u.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                          {u.last_active_at && <span style={{ color: '#444', fontSize: 11 }}>Active {timeAgo(u.last_active_at)}</span>}
                        </div>
                      </div>

                      {/* Actions */}
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                        {!u.is_banned ? (
                          <button onClick={() => adminAction(u.id, 'ban')} disabled={actionLoading === u.id + 'ban'}
                            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 7, border: '1px solid rgba(239,68,68,.3)', background: 'none', color: '#f87171', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
                            <Ban size={11} /> Ban
                          </button>
                        ) : (
                          <button onClick={() => adminAction(u.id, 'unban')} disabled={actionLoading === u.id + 'unban'}
                            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 7, border: '1px solid rgba(74,222,128,.3)', background: 'none', color: '#4ade80', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
                            <CheckCircle size={11} /> Unban
                          </button>
                        )}

                        {!(u.suspended_until && new Date(u.suspended_until) > new Date()) ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <input
                              type="number"
                              value={suspendDays[u.id] ?? 7}
                              onChange={e => setSuspendDays(d => ({ ...d, [u.id]: parseInt(e.target.value) || 7 }))}
                              min={1} max={365}
                              style={{ width: 40, background: '#111', border: '1px solid #2e2e2e', borderRadius: 6, padding: '4px 6px', color: '#ccc', fontSize: 11, textAlign: 'center', fontFamily: 'inherit' }}
                            />
                            <span style={{ color: '#555', fontSize: 10 }}>d</span>
                            <button onClick={() => adminAction(u.id, 'suspend')} disabled={actionLoading === u.id + 'suspend'}
                              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 7, border: '1px solid rgba(245,158,11,.3)', background: 'none', color: '#fbbf24', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
                              <AlertTriangle size={11} /> Suspend
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => adminAction(u.id, 'unsuspend')} disabled={actionLoading === u.id + 'unsuspend'}
                            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 7, border: '1px solid rgba(74,222,128,.3)', background: 'none', color: '#4ade80', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
                            <CheckCircle size={11} /> Unsuspend
                          </button>
                        )}

                        {u.role !== 'pro' && u.role !== 'admin' ? (
                          <button onClick={() => adminAction(u.id, 'grant_pro')} disabled={actionLoading === u.id + 'grant_pro'}
                            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 7, border: '1px solid rgba(251,191,36,.3)', background: 'none', color: '#fbbf24', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
                            Grant Pro
                          </button>
                        ) : u.role === 'pro' ? (
                          <button onClick={() => adminAction(u.id, 'revoke_pro')} disabled={actionLoading === u.id + 'revoke_pro'}
                            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 7, border: '1px solid #2e2e2e', background: 'none', color: '#666', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
                            Revoke Pro
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ─── REPORTS ─── */}
            {activeTab === 'reports' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <h2 style={{ margin: 0, color: '#fff', fontSize: 16, fontWeight: 700 }}>All Reports</h2>
                  <span style={{ color: '#555', fontSize: 12 }}>{reports.length} total · {reports.filter(r => !r.resolved).length} unresolved</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {reports.map(r => (
                    <div key={r.id} style={{ background: '#0d0d0d', border: `1px solid ${r.resolved ? '#1a1a1a' : 'rgba(239,68,68,.2)'}`, borderRadius: 12, padding: '14px 16px', opacity: r.resolved ? 0.5 : 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                            <span style={{ color: '#e5e5e5', fontSize: 13, fontWeight: 600 }}>{r.reported_username}</span>
                            <span style={{ fontSize: 10, color: '#888', background: '#1a1a1a', padding: '2px 7px', borderRadius: 20 }}>{r.content_type}</span>
                            <span style={{ fontSize: 10, color: '#f87171', background: 'rgba(239,68,68,.1)', padding: '2px 8px', borderRadius: 20 }}>{r.reason}</span>
                          </div>
                          <p style={{ margin: 0, color: '#555', fontSize: 12 }}>Reported by <span style={{ color: '#888' }}>{r.reporter_username}</span> · {timeAgo(r.created_at)}</p>
                          {r.notes === 'resolved' && <p style={{ margin: '4px 0 0', color: '#4ade80', fontSize: 11 }}>Resolved</p>}
                        </div>
                        {!r.resolved && (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button onClick={() => r.reported_user_id && adminAction(r.reported_user_id, 'ban')}
                              style={{ padding: '5px 10px', borderRadius: 7, border: '1px solid rgba(239,68,68,.3)', background: 'none', color: '#f87171', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
                              Ban User
                            </button>
                            <button onClick={() => r.reported_user_id && adminAction(r.reported_user_id, 'suspend')}
                              style={{ padding: '5px 10px', borderRadius: 7, border: '1px solid rgba(245,158,11,.3)', background: 'none', color: '#fbbf24', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
                              Suspend
                            </button>
                            <button onClick={() => resolveReport(r.id)}
                              style={{ padding: '5px 10px', borderRadius: 7, border: '1px solid rgba(74,222,128,.3)', background: 'none', color: '#4ade80', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
                              Resolve
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {reports.length === 0 && (
                    <div style={{ textAlign: 'center', padding: 40, color: '#555' }}>No reports yet</div>
                  )}
                </div>
              </div>
            )}

            {/* ─── STAFF PICKS ─── */}
            {activeTab === 'staff_picks' && (
              <div>
                {/* Add form */}
                <div style={{ background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 14, padding: 20, marginBottom: 24 }}>
                  <h3 style={{ margin: '0 0 16px', color: '#fff', fontSize: 15, fontWeight: 600 }}>Add Staff Pick</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: 10, marginBottom: 10 }}>
                    <input value={pickForm.tmdbId} onChange={e => setPickForm(f => ({ ...f, tmdbId: e.target.value }))} placeholder="TMDB ID" style={inputStyle} />
                    <select value={pickForm.mediaType} onChange={e => setPickForm(f => ({ ...f, mediaType: e.target.value as 'movie' | 'tv' }))} style={inputStyle}>
                      <option value="movie">Film</option>
                      <option value="tv">TV Show</option>
                    </select>
                    <input value={pickForm.title} onChange={e => setPickForm(f => ({ ...f, title: e.target.value }))} placeholder="Title" style={inputStyle} />
                  </div>
                  <input value={pickForm.note} onChange={e => setPickForm(f => ({ ...f, note: e.target.value }))} placeholder="Admin note (optional)" style={{ ...inputStyle, width: '100%', marginBottom: 10, boxSizing: 'border-box' as const }} />
                  <button onClick={addStaffPick} disabled={addingPick || !pickForm.tmdbId || !pickForm.title}
                    className="btn-gold" style={{ fontSize: 13, padding: '8px 20px', borderRadius: 9, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Plus size={14} /> Add Pick
                  </button>
                </div>

                {/* Current picks */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {staffPicks.map(p => (
                    <div key={p.id} style={{ background: '#0d0d0d', border: `1px solid ${p.active ? 'rgba(245,158,11,.2)' : '#1a1a1a'}`, borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ color: '#e5e5e5', fontSize: 14, fontWeight: 600 }}>{p.title}</span>
                          <span style={{ fontSize: 10, color: '#888', background: '#1a1a1a', padding: '2px 7px', borderRadius: 20 }}>{p.media_type}</span>
                          {p.active && <span style={{ fontSize: 10, color: '#fbbf24', background: 'rgba(245,158,11,.1)', padding: '2px 7px', borderRadius: 20 }}>Active</span>}
                        </div>
                        {p.note && <p style={{ margin: '3px 0 0', color: '#666', fontSize: 12 }}>{p.note}</p>}
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => toggleStaffPickActive(p.id, p.active)}
                          style={{ padding: '5px 10px', borderRadius: 7, border: '1px solid #2e2e2e', background: 'none', color: p.active ? '#888' : '#4ade80', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
                          {p.active ? 'Deactivate' : 'Activate'}
                        </button>
                        <button onClick={() => deleteStaffPick(p.id)}
                          style={{ padding: '5px 8px', borderRadius: 7, border: '1px solid rgba(239,68,68,.3)', background: 'none', color: '#f87171', fontSize: 11, cursor: 'pointer' }}>
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                  {staffPicks.length === 0 && (
                    <p style={{ color: '#555', fontSize: 13, textAlign: 'center', padding: 24 }}>No staff picks yet</p>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: '#111', border: '1px solid #2e2e2e', borderRadius: 8,
  padding: '9px 12px', color: '#e5e5e5', fontSize: 13, outline: 'none', fontFamily: 'inherit',
};

function RoleBadge({ role }: { role: string }) {
  if (role === 'admin') return <span style={{ fontSize: 10, color: '#ef4444', background: 'rgba(239,68,68,.1)', padding: '2px 7px', borderRadius: 20, border: '1px solid rgba(239,68,68,.25)' }}>Admin</span>;
  if (role === 'pro')   return <span style={{ fontSize: 10, color: '#fbbf24', background: 'rgba(245,158,11,.1)', padding: '2px 7px', borderRadius: 20, border: '1px solid rgba(245,158,11,.25)' }}>Pro</span>;
  return null;
}

function RecentAdminActions() {
  const [actions, setActions] = useState<{id: string; admin_username: string; action_type: string; created_at: string}[]>([]);

  useEffect(() => {
    supabase.from('admin_actions').select('id, admin_username, action_type, created_at').order('created_at', { ascending: false }).limit(10)
      .then(({ data }) => setActions(data ?? []));
  }, []);

  if (actions.length === 0) return null;

  return (
    <div>
      <h3 style={{ margin: '0 0 14px', color: '#666', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Recent Actions</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {actions.map(a => (
          <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', background: '#0d0d0d', borderRadius: 8, border: '1px solid #1a1a1a' }}>
            <Eye size={12} color="#555" />
            <span style={{ color: '#ccc', fontSize: 12 }}><span style={{ color: '#fbbf24' }}>{a.admin_username}</span> · {a.action_type}</span>
            <span style={{ marginLeft: 'auto', color: '#444', fontSize: 11 }}>{timeAgo(a.created_at)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Inline icon components to avoid lucide import issues
function Activity({ size, color }: { size: number; color: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>;
}
function TrendUp({ size, color }: { size: number; color: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>;
}
function Sparkles({ size, color }: { size: number; color: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.9 5.8L19.6 10l-5.8 1.9L12 17.6l-1.9-5.8L4.4 10l5.8-1.9L12 3z"/><path d="M5 3v4M3 5h4M19 17v4M17 19h4"/></svg>;
}
function Crown({ size, color }: { size: number; color: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 20h20M5 20l3-8 4 4 4-4 3 8"/><circle cx="12" cy="8" r="2"/></svg>;
}
