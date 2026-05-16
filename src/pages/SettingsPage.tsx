import { useEffect, useState, useRef } from 'react';
import { ArrowLeft, Globe, Lock, Key, Trash2, Eye, EyeOff, AtSign, Camera, FileText, UserX, Upload, Download, X, Search, Image, RotateCcw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { containsOffensiveContent, MODERATION_ERROR } from '../lib/moderation';
import { tmdb, backdropUrl, posterUrl } from '../lib/tmdb';
import type { TMDBMedia } from '../lib/tmdb';
import LetterboxdImportModal from '../components/LetterboxdImportModal';
import AvatarCropModal from '../components/AvatarCropModal';

interface SettingsPageProps {
  onBack: () => void;
}

interface BlockedUser {
  id: string;
  blocked_id: string;
  blocked_username: string;
  blocked_avatar: string;
  created_at: string;
}

export default function SettingsPage({ onBack }: SettingsPageProps) {
  const { user, profile, refreshProfile, signOut } = useAuth();
  const [isPublic,       setIsPublic]  = useState(true);
  const [loading,        setLoading]   = useState(true);


  // My Profile section
  const [editBio,        setEditBio]        = useState('');
  const [savingBio,      setSavingBio]      = useState(false);
  const [bioMsg,         setBioMsg]         = useState('');
  const [cropFile, setCropFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Change username
  const [showChangeUser,   setShowChangeUser]   = useState(false);
  const [newUsername,      setNewUsername]      = useState('');
  const [usernameAvail,    setUsernameAvail]    = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
  const [usernameMsg,      setUsernameMsg]      = useState('');
  const [usernameLoading,  setUsernameLoading]  = useState(false);
  const [usernameNextDate, setUsernameNextDate] = useState<string | null>(null);
  const usernameTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Change password
  const [showChangePwd, setShowChangePwd] = useState(false);
  const [currentPwd,    setCurrentPwd]    = useState('');
  const [newPwd,        setNewPwd]        = useState('');
  const [showPwd,       setShowPwd]       = useState(false);
  const [showCurPwd,    setShowCurPwd]    = useState(false);
  const [pwdLoading,    setPwdLoading]    = useState(false);
  const [pwdMsg,        setPwdMsg]        = useState('');

  // Block users
  const [blockedUsers,  setBlockedUsers]  = useState<BlockedUser[]>([]);
  const [unblocking,    setUnblocking]    = useState<string | null>(null);

  // Delete account
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirm,   setDeleteConfirm]   = useState('');
  const [deleteLoading,   setDeleteLoading]   = useState(false);
  const [deleteError,     setDeleteError]     = useState('');

  // Hero background
  const [heroSearch,         setHeroSearch]        = useState('');
  const [heroResults,        setHeroResults]        = useState<TMDBMedia[]>([]);
  const [heroSearching,      setHeroSearching]      = useState(false);
  const [heroCurrent,        setHeroCurrent]        = useState<{ tmdb_id: number; media_type: string; title: string; backdrop_path: string | null; poster_path: string | null } | null>(null);
  const [heroPending,        setHeroPending]        = useState<{ tmdb_id: number; media_type: string; title: string; backdrop_path: string | null; poster_path: string | null } | null>(null);
  const [heroSaving,         setHeroSaving]         = useState(false);
  const [heroMsg,            setHeroMsg]            = useState('');
  const heroSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Letterboxd import modal
  const [importModalOpen, setImportModalOpen] = useState(false);

  // Data export
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!user) return;
    async function load() {
      const { data: p } = await supabase.from('profiles').select('is_public, username_changed_at, bio, hero_background').eq('id', user!.id).maybeSingle();
      if (p) {
        setIsPublic((p as { is_public: boolean }).is_public !== false);
        setEditBio((p as { bio: string }).bio ?? '');
        const hb = (p as { hero_background?: { tmdb_id: number; media_type: string; title: string; backdrop_path: string | null; poster_path: string | null } | null }).hero_background;
        if (hb) setHeroCurrent(hb);
        const changedAt = (p as { username_changed_at: string | null }).username_changed_at;
        if (changedAt) {
          const daysSince = (Date.now() - new Date(changedAt).getTime()) / (1000 * 60 * 60 * 24);
          if (daysSince < 30) {
            const nextDate = new Date(new Date(changedAt).getTime() + 30 * 24 * 60 * 60 * 1000);
            setUsernameNextDate(nextDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }));
          }
        }
      }
      setLoading(false);
    }
    load();
    loadBlockedUsers();
  }, [user]);

  async function loadBlockedUsers() {
    if (!user) return;
    const { data } = await supabase
      .from('blocked_users')
      .select('id, blocked_id, created_at')
      .eq('blocker_id', user.id)
      .order('created_at', { ascending: false });
    if (!data) return;
    // Fetch usernames for blocked users
    const ids = data.map((r: { blocked_id: string }) => r.blocked_id);
    if (ids.length === 0) { setBlockedUsers([]); return; }
    const { data: profiles } = await supabase.from('profiles').select('id, username, avatar_url').in('id', ids);
    const profileMap: Record<string, { username: string; avatar_url: string }> = {};
    (profiles ?? []).forEach((p: { id: string; username: string; avatar_url: string }) => { profileMap[p.id] = p; });
    setBlockedUsers(data.map((r: { id: string; blocked_id: string; created_at: string }) => ({
      id: r.id,
      blocked_id: r.blocked_id,
      blocked_username: profileMap[r.blocked_id]?.username ?? 'Unknown',
      blocked_avatar: profileMap[r.blocked_id]?.avatar_url ?? '',
      created_at: r.created_at,
    })));
  }

  async function unblockUser(blockId: string) {
    setUnblocking(blockId);
    await supabase.from('blocked_users').delete().eq('id', blockId);
    setBlockedUsers(prev => prev.filter(b => b.id !== blockId));
    setUnblocking(null);
  }

  function onHeroSearchInput(val: string) {
    setHeroSearch(val);
    setHeroResults([]);
    if (heroSearchTimer.current) clearTimeout(heroSearchTimer.current);
    if (!val.trim()) return;
    setHeroSearching(true);
    heroSearchTimer.current = setTimeout(async () => {
      const res = await tmdb.search(val);
      setHeroResults((res.results ?? []).filter((r: TMDBMedia) => r.media_type === 'movie' || r.media_type === 'tv').slice(0, 8));
      setHeroSearching(false);
    }, 350);
  }

  async function saveHeroBackground() {
    if (!user || !heroPending) return;
    setHeroSaving(true);
    setHeroMsg('');
    const { error } = await supabase.from('profiles').update({ hero_background: heroPending }).eq('id', user.id);
    if (error) { setHeroMsg(error.message); }
    else {
      setHeroCurrent(heroPending);
      setHeroPending(null);
      setHeroSearch('');
      setHeroResults([]);
      setHeroMsg('Background saved.');
      setTimeout(() => setHeroMsg(''), 2500);
    }
    setHeroSaving(false);
  }

  async function resetHeroBackground() {
    if (!user) return;
    setHeroSaving(true);
    await supabase.from('profiles').update({ hero_background: null }).eq('id', user.id);
    setHeroCurrent(null);
    setHeroPending(null);
    setHeroSearch('');
    setHeroResults([]);
    setHeroMsg('Background reset to default.');
    setTimeout(() => setHeroMsg(''), 2500);
    setHeroSaving(false);
  }

  async function saveBio() {
    if (!user) return;
    if (containsOffensiveContent(editBio)) { setBioMsg(MODERATION_ERROR); return; }
    setSavingBio(true);
    setBioMsg('');
    const { error } = await supabase.from('profiles').update({ bio: editBio }).eq('id', user.id);
    if (error) setBioMsg(error.message);
    else { await refreshProfile(); setBioMsg('Bio updated.'); setTimeout(() => setBioMsg(''), 2000); }
    setSavingBio(false);
  }

  function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Reset input so re-selecting same file triggers onChange again
    e.target.value = '';
    if (!file || !user) return;
    setCropFile(file);
  }

  function onUsernameInput(val: string) {
    setNewUsername(val);
    setUsernameMsg('');
    setUsernameAvail('idle');
    if (usernameTimerRef.current) clearTimeout(usernameTimerRef.current);
    if (!val.trim()) return;
    if (containsOffensiveContent(val)) { setUsernameAvail('invalid'); setUsernameMsg(MODERATION_ERROR); return; }
    const invalid = !/^[a-zA-Z0-9_]{3,20}$/.test(val);
    if (invalid) { setUsernameAvail('invalid'); return; }
    if (val === profile?.username) { setUsernameAvail('idle'); return; }
    setUsernameAvail('checking');
    usernameTimerRef.current = setTimeout(async () => {
      const { data } = await supabase.from('profiles').select('id').eq('username', val).maybeSingle();
      setUsernameAvail(data ? 'taken' : 'available');
    }, 500);
  }

  async function changeUsername() {
    if (!user || !newUsername.trim()) return;
    if (usernameAvail !== 'available') return;
    if (usernameNextDate) { setUsernameMsg(`You can next change your username on ${usernameNextDate}.`); return; }
    setUsernameLoading(true);
    setUsernameMsg('');
    const { error } = await supabase.from('profiles').update({ username: newUsername.trim(), username_changed_at: new Date().toISOString() }).eq('id', user.id);
    if (error) {
      setUsernameMsg(error.message);
    } else {
      await refreshProfile();
      const nextDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      setUsernameNextDate(nextDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }));
      setUsernameMsg('Username changed successfully.');
      setShowChangeUser(false);
      setNewUsername('');
      setUsernameAvail('idle');
    }
    setUsernameLoading(false);
  }

  async function togglePrivacy() {
    if (!user) return;
    const next = !isPublic;
    setIsPublic(next);
    await supabase.from('profiles').update({ is_public: next }).eq('id', user.id);
  }

  async function changePassword() {
    if (!currentPwd) { setPwdMsg('Current password is required.'); return; }
    if (!newPwd || newPwd.length < 6) { setPwdMsg('New password must be at least 6 characters.'); return; }
    setPwdLoading(true);
    // Re-authenticate first
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: user?.email ?? '', password: currentPwd });
    if (signInError) { setPwdMsg('Current password is incorrect.'); setPwdLoading(false); return; }
    const { error } = await supabase.auth.updateUser({ password: newPwd });
    if (error) setPwdMsg(error.message);
    else { setPwdMsg('Password updated successfully.'); setNewPwd(''); setCurrentPwd(''); setShowChangePwd(false); }
    setPwdLoading(false);
  }


  const [showExportConfirm, setShowExportConfirm] = useState(false);

  async function exportLetterboxdCSV() {
    if (!user) return;
    setExporting(true);
    setShowExportConfirm(false);
    try {
      const [
        { data: watchedData },
        { data: ratingsData },
        { data: reviewsData },
        { data: watchlistData },
      ] = await Promise.all([
        supabase.from('watched').select('*').eq('user_id', user.id).order('watched_date', { ascending: false }),
        supabase.from('ratings').select('*').eq('user_id', user.id),
        supabase.from('reviews').select('*').eq('user_id', user.id),
        supabase.from('watchlist').select('*').eq('user_id', user.id),
      ]);

      // Letterboxd-compatible CSV format
      const csvLines = [
        'Title,Year,WatchedDate,Rating10,Review,Tags',
        ...(watchedData ?? []).map(w => {
          const rating = ratingsData?.find(r => r.tmdb_id === w.tmdb_id && r.media_type === w.media_type)?.rating;
          const rating10 = rating != null ? Math.round(rating * 2) : '';
          const review = reviewsData?.find(r => r.tmdb_id === w.tmdb_id && r.media_type === w.media_type)?.content ?? '';
          const date = w.watched_date ? w.watched_date.split('T')[0] : '';
          const title = (w.title ?? '').replace(/"/g, '""');
          const year = w.year ?? '';
          return `"${title}",${year},${date},${rating10},"${review.replace(/"/g, '""')}",${ w.media_type === 'tv' ? 'tv' : ''}`;
        }),
      ];

      // Watchlist sheet
      const watchlistLines = [
        'Title,Year,DateAdded',
        ...(watchlistData ?? []).map(w => {
          const title = (w.title ?? '').replace(/"/g, '""');
          const year = w.year ?? '';
          const date = w.added_at ? w.added_at.split('T')[0] : '';
          return `"${title}",${year},${date}`;
        }),
      ];

      const combined = [...csvLines, '', '# Watchlist', ...watchlistLines].join('\n');
      const csvBlob = new Blob([combined], { type: 'text/csv' });
      const csvUrl = URL.createObjectURL(csvBlob);
      const a = document.createElement('a');
      a.href = csvUrl;
      a.download = `qued-letterboxd-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(csvUrl);
    } catch {
      // silently fail
    }
    setExporting(false);
  }

  async function deleteAccount() {
    if (deleteConfirm !== profile?.username || !user) return;
    setDeleteLoading(true);
    setDeleteError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-account`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session?.access_token ?? ''}`,
            'Content-Type': 'application/json',
          },
        }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setDeleteError(body.error ?? 'Something went wrong. Please try again.');
        setDeleteLoading(false);
        return;
      }
      // Success — sign out locally
      await signOut();
    } catch {
      setDeleteError('Network error. Please try again.');
      setDeleteLoading(false);
    }
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ display: 'flex', gap: 8 }}>
        {[0, 150, 300].map(d => (
          <div key={d} style={{ width: 8, height: 8, background: '#f59e0b', borderRadius: '50%', animation: `bounceDot 1.4s ${d}ms infinite` }} />
        ))}
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#000', paddingBottom: 96 }} className="animate-fade-in">
      {/* Header */}
      <div style={{ position: 'sticky', top: 56, zIndex: 10, background: 'rgba(0,0,0,.92)', backdropFilter: 'blur(8px)', borderBottom: '1px solid #1a1a1a', padding: '14px clamp(16px,4vw,48px)', display: 'flex', alignItems: 'center', gap: 14 }}>
        <button onClick={onBack}
          style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontFamily: 'inherit', transition: 'color .2s' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
          onMouseLeave={e => (e.currentTarget.style.color = '#888')}>
          <ArrowLeft size={16} />
        </button>
        <h1 style={{ margin: 0, color: '#fff', fontSize: 17, fontWeight: 700 }}>Settings</h1>
      </div>

      <div style={{ maxWidth: 600, margin: '0 auto', padding: '28px clamp(16px,4vw,32px) 0' }}>

        {/* My Profile */}
        <SettingsSection title="My Profile">
          {/* Avatar */}
          <div style={{ padding: '16px 0', borderBottom: '1px solid #111', display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <div
                onClick={() => fileInputRef.current?.click()}
                style={{ width: 60, height: 60, borderRadius: 16, overflow: 'hidden', background: '#1a1a1a', border: '2px solid #2e2e2e', cursor: 'pointer', transition: 'border-color .2s', position: 'relative' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = '#f59e0b')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = '#2e2e2e')}
              >
                {profile?.avatar_url
                  ? <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ color: '#ccc', fontSize: 22, fontWeight: 700 }}>{profile?.username?.[0]?.toUpperCase() ?? '?'}</span>
                    </div>}
              </div>
              <div style={{ position: 'absolute', bottom: -3, right: -3, width: 20, height: 20, borderRadius: '50%', background: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #000', pointerEvents: 'none' }}>
                <Camera size={9} color="#000" />
              </div>
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleAvatarUpload} style={{ display: 'none' }} />
            </div>
            <div>
              <p style={{ margin: '0 0 2px', color: '#fff', fontSize: 14, fontWeight: 600 }}>{profile?.username}</p>
              <button onClick={() => fileInputRef.current?.click()} style={{ background: 'none', border: 'none', color: '#f59e0b', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', padding: 0 }}>Change photo</button>
            </div>
          </div>

          {/* Bio */}
          <div style={{ padding: '14px 0', borderBottom: '1px solid #111' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <FileText size={14} color="#888" />
              <span style={{ color: '#ccc', fontSize: 14, fontWeight: 500 }}>Bio</span>
            </div>
            <textarea
              value={editBio}
              onChange={e => setEditBio(e.target.value)}
              rows={3}
              maxLength={200}
              placeholder="Tell people about yourself..."
              style={{ width: '100%', background: '#111', border: '1px solid #2e2e2e', borderRadius: 10, padding: '10px 14px', color: '#fff', fontSize: 13, outline: 'none', fontFamily: 'inherit', resize: 'none', boxSizing: 'border-box' }}
              onFocus={e => (e.target.style.borderColor = '#f59e0b')}
              onBlur={e => (e.target.style.borderColor = '#2e2e2e')}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
              <button onClick={saveBio} disabled={savingBio} className="btn-gold" style={{ fontSize: 12, padding: '7px 16px', borderRadius: 8 }}>
                {savingBio ? 'Saving...' : 'Save Bio'}
              </button>
              <span style={{ color: '#555', fontSize: 11 }}>{editBio.length}/200</span>
              {bioMsg && <span style={{ color: bioMsg.includes('violates') ? '#f87171' : '#4ade80', fontSize: 12 }}>{bioMsg}</span>}
            </div>
          </div>

          {/* Change Username */}
          <button onClick={() => { setShowChangeUser(s => !s); setShowChangePwd(false); setUsernameMsg(''); setNewUsername(''); setUsernameAvail('idle'); }}
            style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '12px 0', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', borderBottom: '1px solid #111' }}>
            <AtSign size={16} color="#888" />
            <div style={{ flex: 1 }}>
              <span style={{ color: '#ccc', fontSize: 14, fontWeight: 500, display: 'block' }}>Change Username</span>
              {usernameNextDate && !showChangeUser && (
                <span style={{ color: '#555', fontSize: 11 }}>Next change available {usernameNextDate}</span>
              )}
            </div>
            <span style={{ color: '#555', fontSize: 12 }}>{showChangeUser ? 'Cancel' : 'Change'}</span>
          </button>
          {showChangeUser && (
            <div style={{ padding: '14px 0', display: 'flex', flexDirection: 'column', gap: 10 }} className="animate-slide-down">
              {usernameNextDate ? (
                <p style={{ margin: 0, color: '#f87171', fontSize: 13, lineHeight: 1.5 }}>
                  Username can only be changed once every 30 days.<br />
                  <span style={{ color: '#888' }}>Next change available: <strong style={{ color: '#fbbf24' }}>{usernameNextDate}</strong></span>
                </p>
              ) : (
                <>
                  <div style={{ position: 'relative' }}>
                    <input
                      value={newUsername}
                      onChange={e => onUsernameInput(e.target.value)}
                      placeholder={`Current: ${profile?.username ?? ''}`}
                      style={{ width: '100%', background: '#111', border: `1px solid ${usernameAvail === 'available' ? '#4ade80' : usernameAvail === 'taken' || usernameAvail === 'invalid' ? '#f87171' : '#2e2e2e'}`, borderRadius: 10, padding: '11px 40px 11px 14px', color: '#fff', fontSize: 14, outline: 'none', fontFamily: 'inherit', transition: 'border-color .2s', boxSizing: 'border-box' }}
                      maxLength={20}
                    />
                    {usernameAvail === 'checking' && (
                      <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, border: '2px solid #f59e0b', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                    )}
                  </div>
                  {usernameAvail === 'available' && <p style={{ margin: 0, color: '#4ade80', fontSize: 12 }}>Username is available</p>}
                  {usernameAvail === 'taken' && <p style={{ margin: 0, color: '#f87171', fontSize: 12 }}>Username already taken</p>}
                  {usernameAvail === 'invalid' && <p style={{ margin: 0, color: '#f87171', fontSize: 12 }}>3–20 characters, letters, numbers, and underscores only</p>}
                  {usernameMsg && <p style={{ margin: 0, color: usernameMsg.includes('violates') || usernameMsg.includes('Qued') ? '#f87171' : '#4ade80', fontSize: 12 }}>{usernameMsg}</p>}
                  <p style={{ margin: 0, color: '#555', fontSize: 11 }}>Username can only be changed once every 30 days.</p>
                  <button onClick={changeUsername} disabled={usernameLoading || usernameAvail !== 'available'} className="btn-gold"
                    style={{ alignSelf: 'flex-start', padding: '9px 20px', borderRadius: 10, fontSize: 13, opacity: usernameAvail !== 'available' ? 0.5 : 1 }}>
                    {usernameLoading ? 'Saving...' : 'Save Username'}
                  </button>
                </>
              )}
            </div>
          )}
        </SettingsSection>

        {/* Homepage Background */}
        <SettingsSection title="Homepage Background">
          <div style={{ padding: '14px 0' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 14 }}>
              <Image size={16} color="#888" style={{ marginTop: 2, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <p style={{ margin: '0 0 4px', color: '#fff', fontSize: 14, fontWeight: 500 }}>Custom Hero Background</p>
                <p style={{ margin: 0, color: '#555', fontSize: 12, lineHeight: 1.6 }}>
                  Choose a film or TV show backdrop to personalise your homepage. Only you will see this.
                </p>
              </div>
            </div>

            {/* Current background preview */}
            {heroCurrent && !heroPending && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, padding: '10px 12px', background: '#111', borderRadius: 12, border: '1px solid #2e2e2e' }}>
                {(heroCurrent.backdrop_path || heroCurrent.poster_path) && (
                  <img
                    src={heroCurrent.backdrop_path ? (backdropUrl(heroCurrent.backdrop_path, 'w300') ?? undefined) : (posterUrl(heroCurrent.poster_path) ?? undefined)}
                    alt=""
                    style={{ width: 60, height: 36, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }}
                  />
                )}
                <div style={{ flex: 1 }}>
                  <p style={{ margin: '0 0 2px', color: '#fff', fontSize: 13, fontWeight: 500 }}>{heroCurrent.title}</p>
                  <p style={{ margin: 0, color: '#555', fontSize: 11, textTransform: 'capitalize' }}>{heroCurrent.media_type}</p>
                </div>
                <button
                  onClick={resetHeroBackground}
                  disabled={heroSaving}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 8, border: '1px solid #2e2e2e', background: 'none', color: '#888', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#f87171'; e.currentTarget.style.color = '#f87171'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#2e2e2e'; e.currentTarget.style.color = '#888'; }}
                >
                  <RotateCcw size={10} /> Reset
                </button>
              </div>
            )}

            {/* Pending selection preview */}
            {heroPending && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, padding: '10px 12px', background: 'rgba(245,158,11,.05)', borderRadius: 12, border: '1px solid rgba(245,158,11,.25)' }}>
                {(heroPending.backdrop_path || heroPending.poster_path) && (
                  <img
                    src={heroPending.backdrop_path ? (backdropUrl(heroPending.backdrop_path, 'w300') ?? undefined) : (posterUrl(heroPending.poster_path) ?? undefined)}
                    alt=""
                    style={{ width: 60, height: 36, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }}
                  />
                )}
                <div style={{ flex: 1 }}>
                  <p style={{ margin: '0 0 2px', color: '#fbbf24', fontSize: 13, fontWeight: 500 }}>{heroPending.title}</p>
                  <p style={{ margin: 0, color: '#888', fontSize: 11, textTransform: 'capitalize' }}>Selected — click Save to apply</p>
                </div>
                <button onClick={() => { setHeroPending(null); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#555', flexShrink: 0 }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#555')}>
                  <X size={14} />
                </button>
              </div>
            )}

            {/* Search */}
            <div style={{ position: 'relative', marginBottom: 8 }}>
              <Search size={13} color="#888" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              <input
                value={heroSearch}
                onChange={e => onHeroSearchInput(e.target.value)}
                placeholder="Search for a film or TV show..."
                style={{ width: '100%', background: '#111', border: '1px solid #2e2e2e', borderRadius: 10, padding: '10px 12px 10px 34px', color: '#fff', fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', transition: 'border-color .2s' }}
                onFocus={e => (e.target.style.borderColor = '#f59e0b')}
                onBlur={e  => (e.target.style.borderColor = '#2e2e2e')}
              />
              {heroSearching && (
                <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', width: 13, height: 13, border: '2px solid #f59e0b', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              )}
            </div>

            {/* Search results */}
            {heroResults.length > 0 && (
              <div style={{ marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 3 }}>
                {heroResults.map(item => {
                  const title = item.title || item.name || '';
                  const year  = (item.release_date || item.first_air_date || '').slice(0, 4);
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setHeroPending({ tmdb_id: item.id, media_type: item.media_type ?? 'movie', title, backdrop_path: item.backdrop_path ?? null, poster_path: item.poster_path ?? null });
                        setHeroSearch('');
                        setHeroResults([]);
                      }}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 10, background: '#111', border: '1px solid transparent', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', transition: 'border-color .15s' }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = '#f59e0b')}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = 'transparent')}
                    >
                      {item.poster_path
                        ? <img src={posterUrl(item.poster_path, 'w92') ?? undefined} alt="" style={{ width: 28, height: 40, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }} />
                        : <div style={{ width: 28, height: 40, background: '#2e2e2e', borderRadius: 4, flexShrink: 0 }} />}
                      <div>
                        <p style={{ margin: '0 0 1px', color: '#fff', fontSize: 13, fontWeight: 500 }}>{title}</p>
                        <p style={{ margin: 0, color: '#666', fontSize: 11 }}>{year}{year && ' · '}<span style={{ textTransform: 'capitalize' }}>{item.media_type}</span></p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Save/message row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
              <button
                onClick={saveHeroBackground}
                disabled={heroSaving || !heroPending}
                className="btn-gold"
                style={{ fontSize: 12, padding: '7px 16px', borderRadius: 8, opacity: !heroPending ? 0.4 : 1, cursor: !heroPending ? 'not-allowed' : 'pointer' }}
              >
                {heroSaving ? 'Saving...' : 'Save Background'}
              </button>
              {heroMsg && <span style={{ color: heroMsg.includes('error') || heroMsg.includes('Error') ? '#f87171' : '#4ade80', fontSize: 12 }}>{heroMsg}</span>}
            </div>
          </div>
        </SettingsSection>

        {/* Security */}
        <SettingsSection title="Security">
          <div style={{ padding: '4px 0' }}>
            <button onClick={() => { setShowChangePwd(s => !s); setShowChangeUser(false); }}
              style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '12px 0', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
              <Key size={16} color="#888" />
              <span style={{ color: '#ccc', fontSize: 14, fontWeight: 500, flex: 1 }}>Change Password</span>
              <span style={{ color: '#555', fontSize: 12 }}>{showChangePwd ? 'Cancel' : 'Change'}</span>
            </button>
            {showChangePwd && (
              <div style={{ padding: '14px 0', display: 'flex', flexDirection: 'column', gap: 10 }} className="animate-slide-down">
                {/* Current password */}
                <div style={{ position: 'relative' }}>
                  <input
                    type={showCurPwd ? 'text' : 'password'} value={currentPwd} onChange={e => setCurrentPwd(e.target.value)}
                    placeholder="Current password"
                    style={{ width: '100%', background: '#111', border: '1px solid #2e2e2e', borderRadius: 10, padding: '11px 40px 11px 14px', color: '#fff', fontSize: 14, outline: 'none', fontFamily: 'inherit', transition: 'border-color .2s', boxSizing: 'border-box' }}
                    onFocus={e => (e.target.style.borderColor = '#f59e0b')} onBlur={e => (e.target.style.borderColor = '#2e2e2e')}
                  />
                  <button onClick={() => setShowCurPwd(s => !s)} type="button"
                    style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#555' }}>
                    {showCurPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {/* New password */}
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPwd ? 'text' : 'password'} value={newPwd} onChange={e => setNewPwd(e.target.value)}
                    placeholder="New password (min 6 characters)"
                    style={{ width: '100%', background: '#111', border: '1px solid #2e2e2e', borderRadius: 10, padding: '11px 40px 11px 14px', color: '#fff', fontSize: 14, outline: 'none', fontFamily: 'inherit', transition: 'border-color .2s', boxSizing: 'border-box' }}
                    onFocus={e => (e.target.style.borderColor = '#f59e0b')} onBlur={e => (e.target.style.borderColor = '#2e2e2e')}
                  />
                  <button onClick={() => setShowPwd(s => !s)} type="button"
                    style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#555' }}>
                    {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {pwdMsg && <p style={{ margin: 0, color: pwdMsg.includes('successfully') ? '#4ade80' : '#f87171', fontSize: 12 }}>{pwdMsg}</p>}
                <button onClick={changePassword} disabled={pwdLoading} className="btn-gold" style={{ alignSelf: 'flex-start', padding: '9px 20px', borderRadius: 10, fontSize: 13 }}>
                  {pwdLoading ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            )}
          </div>
        </SettingsSection>

        {/* Profile Privacy */}
        <SettingsSection title="Profile Privacy">
          <SettingsRow
            icon={isPublic ? <Globe size={16} color="#4ade80" /> : <Lock size={16} color="#888" />}
            label="Profile Visibility"
            description={isPublic ? 'Your profile is visible to everyone' : 'Only followers can see your activity'}
            action={<Toggle checked={isPublic} onChange={togglePrivacy} />}
          />
        </SettingsSection>

        {/* Data & Privacy */}
        <SettingsSection title="Data &amp; Privacy">
          {/* Letterboxd Import */}
          <div style={{ padding: '14px 0', borderBottom: '1px solid #111' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              <Upload size={16} color="#888" style={{ marginTop: 2, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <p style={{ margin: '0 0 4px', color: '#fff', fontSize: 14, fontWeight: 500 }}>Import from Letterboxd</p>
                <p style={{ margin: '0 0 12px', color: '#555', fontSize: 12, lineHeight: 1.6 }}>
                  Import your watched films, diary, ratings, reviews, or watchlist from a Letterboxd export CSV. Preview every item before confirming.
                </p>
                <button
                  onClick={() => setImportModalOpen(true)}
                  className="btn-gold"
                  style={{ fontSize: 12, padding: '8px 16px', borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <Upload size={12} /> Import from Letterboxd
                </button>
              </div>
            </div>
          </div>

          {/* Download My Data */}
          <div style={{ padding: '14px 0' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              <Download size={16} color="#888" style={{ marginTop: 2, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <p style={{ margin: '0 0 4px', color: '#fff', fontSize: 14, fontWeight: 500 }}>Download My Data</p>
                <p style={{ margin: '0 0 12px', color: '#555', fontSize: 12, lineHeight: 1.6 }}>
                  Export your entire film diary as a Letterboxd-compatible CSV. Includes film title, year, date watched, rating, review, and watchlist. This is your right under GDPR.
                </p>
                <button onClick={() => setShowExportConfirm(true)} disabled={exporting} className="btn-gold" style={{ fontSize: 12, padding: '8px 16px', borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 6, opacity: exporting ? 0.5 : 1, cursor: exporting ? 'not-allowed' : 'pointer' }}>
                  {exporting
                    ? <><div style={{ width: 12, height: 12, border: '2px solid #000', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> Exporting...</>
                    : <><Download size={12} /> Download as CSV</>}
                </button>
              </div>
            </div>
          </div>
        </SettingsSection>

        {/* Blocked Users */}
        <SettingsSection title="Blocked Users">
          <div style={{ padding: '4px 0' }}>
            {blockedUsers.length === 0 ? (
              <div style={{ padding: '16px 0', display: 'flex', alignItems: 'center', gap: 10 }}>
                <UserX size={16} color="#555" />
                <p style={{ margin: 0, color: '#555', fontSize: 13 }}>No blocked users</p>
              </div>
            ) : (
              blockedUsers.map(b => (
                <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid #111' }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#1a1a1a', overflow: 'hidden', flexShrink: 0 }}>
                    {b.blocked_avatar
                      ? <img src={b.blocked_avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <span style={{ color: '#888', fontSize: 14, fontWeight: 700 }}>{b.blocked_username[0]?.toUpperCase()}</span>
                        </div>}
                  </div>
                  <p style={{ margin: 0, color: '#ccc', fontSize: 14, flex: 1 }}>{b.blocked_username}</p>
                  <button
                    onClick={() => unblockUser(b.id)}
                    disabled={unblocking === b.id}
                    style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #2e2e2e', background: 'none', color: '#888', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', transition: 'all .2s' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#4ade80'; e.currentTarget.style.color = '#4ade80'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#2e2e2e'; e.currentTarget.style.color = '#888'; }}
                  >
                    {unblocking === b.id ? 'Unblocking...' : 'Unblock'}
                  </button>
                </div>
              ))
            )}
          </div>
        </SettingsSection>

        {/* Danger Zone */}
        <SettingsSection title="Danger Zone">
          <div style={{ padding: '4px 0' }}>
            <button
              onClick={() => { setShowDeleteModal(true); setDeleteConfirm(''); setDeleteError(''); }}
              style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '14px 0', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              <Trash2 size={16} color="#f87171" />
              <div style={{ flex: 1 }}>
                <p style={{ margin: '0 0 2px', color: '#f87171', fontSize: 14, fontWeight: 500 }}>Delete Account</p>
                <p style={{ margin: 0, color: '#555', fontSize: 12 }}>Permanently remove your account and all associated data</p>
              </div>
            </button>
          </div>
        </SettingsSection>
      </div>

      {/* Avatar Crop Modal */}
      {cropFile && (
        <AvatarCropModal
          file={cropFile}
          onClose={() => setCropFile(null)}
          onSaved={() => { setCropFile(null); }}
        />
      )}

      {/* Letterboxd Import Modal */}
      {importModalOpen && <LetterboxdImportModal onClose={() => setImportModalOpen(false)} />}

      {/* Export Confirmation Modal */}
      {showExportConfirm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.85)', backdropFilter: 'blur(6px)', padding: 20 }}>
          <div className="animate-slide-up" style={{ background: '#0d0d0d', border: '1px solid #242424', borderRadius: 20, padding: '32px 28px', maxWidth: 420, width: '100%', position: 'relative' }}>
            <button onClick={() => setShowExportConfirm(false)} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', cursor: 'pointer', color: '#555', padding: 4, transition: 'color .2s' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
              onMouseLeave={e => (e.currentTarget.style.color = '#555')}>
              <X size={16} />
            </button>
            <div style={{ width: 52, height: 52, borderRadius: 16, background: 'rgba(245,158,11,.1)', border: '1px solid rgba(245,158,11,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
              <Download size={22} color="#f59e0b" />
            </div>
            <h2 style={{ margin: '0 0 10px', color: '#fff', fontSize: 20, fontWeight: 800 }}>Download your data?</h2>
            <p style={{ margin: '0 0 20px', color: '#888', fontSize: 14, lineHeight: 1.65 }}>
              This will generate a Letterboxd-compatible CSV file containing your complete film diary, ratings, reviews, and watchlist.
            </p>
            <ul style={{ margin: '0 0 24px', padding: '0 0 0 16px', color: '#666', fontSize: 13, lineHeight: 2 }}>
              <li>Film title and year</li>
              <li>Date watched and rating</li>
              <li>Reviews and watchlist</li>
            </ul>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowExportConfirm(false)} className="btn-ghost" style={{ flex: 1, padding: '11px 0', borderRadius: 10, fontSize: 13 }}>
                Cancel
              </button>
              <button onClick={exportLetterboxdCSV} className="btn-gold" style={{ flex: 1, padding: '11px 0', borderRadius: 10, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <Download size={13} /> Download CSV
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Account Modal */}
      {showDeleteModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.85)', backdropFilter: 'blur(6px)', padding: 20 }}>
          <div className="animate-slide-up" style={{ background: '#0d0d0d', border: '1px solid rgba(239,68,68,.3)', borderRadius: 20, padding: '32px 28px', maxWidth: 420, width: '100%', position: 'relative' }}>
            {/* Close */}
            <button
              onClick={() => { setShowDeleteModal(false); setDeleteConfirm(''); setDeleteError(''); }}
              style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', cursor: 'pointer', color: '#555', padding: 4, transition: 'color .2s' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
              onMouseLeave={e => (e.currentTarget.style.color = '#555')}
            >
              <X size={16} />
            </button>

            {/* Icon */}
            <div style={{ width: 52, height: 52, borderRadius: 16, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
              <Trash2 size={22} color="#f87171" />
            </div>

            <h2 style={{ margin: '0 0 10px', color: '#fff', fontSize: 20, fontWeight: 800 }}>Delete your account?</h2>
            <p style={{ margin: '0 0 6px', color: '#f87171', fontSize: 14, fontWeight: 600 }}>This action is permanent and cannot be undone.</p>
            <p style={{ margin: '0 0 20px', color: '#666', fontSize: 13, lineHeight: 1.65 }}>
              All of your data will be permanently deleted in accordance with UK GDPR right to erasure, including:
            </p>

            <ul style={{ margin: '0 0 20px', padding: '0 0 0 16px', color: '#555', fontSize: 12, lineHeight: 2 }}>
              <li>Your profile, username, and email</li>
              <li>Watched history, ratings, and reviews</li>
              <li>Watchlist and custom lists</li>
              <li>Followers, following, and activity</li>
              <li>Comments, likes, and messages</li>
            </ul>

            <p style={{ margin: '0 0 12px', color: '#888', fontSize: 13 }}>
              Type <strong style={{ color: '#fbbf24' }}>{profile?.username}</strong> to confirm:
            </p>
            <input
              value={deleteConfirm}
              onChange={e => { setDeleteConfirm(e.target.value); setDeleteError(''); }}
              placeholder={`Type "${profile?.username}" to confirm`}
              autoFocus
              style={{ width: '100%', background: '#111', border: `1px solid ${deleteConfirm === profile?.username ? 'rgba(239,68,68,.5)' : '#2e2e2e'}`, borderRadius: 10, padding: '11px 14px', color: '#fff', fontSize: 13, outline: 'none', fontFamily: 'inherit', marginBottom: 12, boxSizing: 'border-box', transition: 'border-color .2s' }}
              onFocus={e => (e.target.style.borderColor = 'rgba(239,68,68,.4)')}
              onBlur={e  => (e.target.style.borderColor = deleteConfirm === profile?.username ? 'rgba(239,68,68,.5)' : '#2e2e2e')}
            />

            {deleteError && (
              <p style={{ margin: '0 0 12px', color: '#f87171', fontSize: 12 }}>{deleteError}</p>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => { setShowDeleteModal(false); setDeleteConfirm(''); setDeleteError(''); }}
                className="btn-ghost"
                style={{ flex: 1, padding: '11px 0', borderRadius: 10, fontSize: 13 }}
              >
                Cancel
              </button>
              <button
                onClick={deleteAccount}
                disabled={deleteConfirm !== profile?.username || deleteLoading}
                style={{
                  flex: 1, padding: '11px 0', borderRadius: 10, border: 'none', fontFamily: 'inherit',
                  cursor: deleteConfirm === profile?.username && !deleteLoading ? 'pointer' : 'not-allowed',
                  background: deleteConfirm === profile?.username ? '#ef4444' : '#1a1a1a',
                  color: deleteConfirm === profile?.username ? '#fff' : '#444',
                  fontSize: 13, fontWeight: 600,
                  transition: 'background .2s',
                }}
              >
                {deleteLoading ? (
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <span style={{ width: 12, height: 12, border: '2px solid rgba(255,255,255,.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />
                    Deleting...
                  </span>
                ) : 'Delete My Account'}
              </button>
            </div>

            <p style={{ margin: '14px 0 0', color: '#333', fontSize: 11, textAlign: 'center' }}>
              A confirmation will be sent to {user?.email}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <h3 style={{ margin: '0 0 14px', color: '#555', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.12em' }}>{title}</h3>
      <div style={{ background: '#0d0d0d', borderRadius: 16, border: '1px solid #1a1a1a', padding: '4px 16px' }}>
        {children}
      </div>
    </div>
  );
}

function SettingsRow({ icon, label, description, action }: { icon: React.ReactNode; label: string; description: string; action: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 0', borderBottom: '1px solid #111' }}>
      <div style={{ flexShrink: 0 }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <p style={{ margin: '0 0 2px', color: '#fff', fontSize: 14, fontWeight: 500 }}>{label}</p>
        <p style={{ margin: 0, color: '#555', fontSize: 12 }}>{description}</p>
      </div>
      {action}
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      style={{ width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', position: 'relative', background: checked ? '#f59e0b' : '#2e2e2e', transition: 'background .2s', flexShrink: 0 }}
    >
      <div style={{ position: 'absolute', top: 3, left: checked ? 23 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left .2s', boxShadow: '0 1px 4px rgba(0,0,0,.4)' }} />
    </button>
  );
}
