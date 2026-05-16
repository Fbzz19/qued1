import { useEffect, useState, useRef } from 'react';
import { Users, Film, Search, UserPlus, UserCheck, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { posterUrl } from '../lib/tmdb';
import { PageHeader } from './FilmsPage';
import { useI18n } from '../context/I18nContext';
import { useAuth } from '../context/AuthContext';

type FavFilm = { tmdb_id: number; title: string; poster_path: string; media_type: 'movie' | 'tv' };

interface Member {
  id: string;
  username: string;
  bio: string;
  avatar_url: string;
  favourite_films: FavFilm[];
  watched_count?: number;
  recent_watched?: FavFilm[];
}

interface MembersPageProps {
  onMemberClick: (userId: string) => void;
}

export default function MembersPage({ onMemberClick }: MembersPageProps) {
  const { t } = useI18n();
  const { user } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  // Search
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Member[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Follow state: set of userIds the current user follows
  const [followingSet, setFollowingSet] = useState<Set<string>>(new Set());
  const [followingInProgress, setFollowingInProgress] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function load() {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, bio, avatar_url, favourite_films')
        .eq('is_public', true)
        .order('created_at', { ascending: false })
        .limit(100);

      if (!profiles) { setLoading(false); return; }

      const ids = profiles.map(p => p.id);

      // Watched counts + recent diary for members who have < 5 fav films
      const needsRecent = profiles
        .filter(p => ((p.favourite_films as FavFilm[] | null) ?? []).length < 5)
        .map(p => p.id);

      const [{ data: watchCounts }, { data: recentRows }] = await Promise.all([
        supabase.from('watched').select('user_id').in('user_id', ids),
        needsRecent.length > 0
          ? supabase.from('watched')
              .select('user_id, tmdb_id, title, poster_path, media_type')
              .in('user_id', needsRecent)
              .order('watched_date', { ascending: false })
          : Promise.resolve({ data: [] }),
      ]);

      const countMap: Record<string, number> = {};
      watchCounts?.forEach(r => { countMap[r.user_id] = (countMap[r.user_id] ?? 0) + 1; });

      // Build recent map: pick first 5 unique tmdb_ids per user
      const recentMap: Record<string, FavFilm[]> = {};
      (recentRows ?? []).forEach((r: { user_id: string; tmdb_id: number; title: string; poster_path: string | null; media_type: string }) => {
        if (!recentMap[r.user_id]) recentMap[r.user_id] = [];
        if (recentMap[r.user_id].length < 5 && !recentMap[r.user_id].find(x => x.tmdb_id === r.tmdb_id)) {
          recentMap[r.user_id].push({ tmdb_id: r.tmdb_id, title: r.title, poster_path: r.poster_path ?? '', media_type: r.media_type as 'movie' | 'tv' });
        }
      });

      setMembers(profiles.map(p => ({
        ...p,
        favourite_films: (p.favourite_films as FavFilm[] | null) ?? [],
        watched_count: countMap[p.id] ?? 0,
        recent_watched: recentMap[p.id] ?? [],
      })));
      setLoading(false);
    }
    load();
  }, []);

  // Load current user's follows
  useEffect(() => {
    if (!user) return;
    supabase.from('follows').select('following_id').eq('follower_id', user.id).then(({ data }) => {
      setFollowingSet(new Set((data ?? []).map((r: { following_id: string }) => r.following_id)));
    });
  }, [user]);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setSearchResults([]);
      setSearched(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearchLoading(true);
      setSearched(true);
      const { data } = await supabase
        .from('profiles')
        .select('id, username, bio, avatar_url, favourite_films')
        .ilike('username', `%${query.trim()}%`)
        .eq('is_public', true)
        .limit(20);

      if (!data) { setSearchResults([]); setSearchLoading(false); return; }

      const ids = data.map(p => p.id);
      const needsRecent = data.filter(p => ((p.favourite_films as FavFilm[] | null) ?? []).length < 5).map(p => p.id);

      const [{ data: watchCounts }, { data: recentRows }] = await Promise.all([
        supabase.from('watched').select('user_id').in('user_id', ids),
        needsRecent.length > 0
          ? supabase.from('watched').select('user_id, tmdb_id, title, poster_path, media_type').in('user_id', needsRecent).order('watched_date', { ascending: false })
          : Promise.resolve({ data: [] }),
      ]);

      const countMap: Record<string, number> = {};
      watchCounts?.forEach(r => { countMap[r.user_id] = (countMap[r.user_id] ?? 0) + 1; });

      const recentMap: Record<string, FavFilm[]> = {};
      (recentRows ?? []).forEach((r: { user_id: string; tmdb_id: number; title: string; poster_path: string | null; media_type: string }) => {
        if (!recentMap[r.user_id]) recentMap[r.user_id] = [];
        if (recentMap[r.user_id].length < 5 && !recentMap[r.user_id].find(x => x.tmdb_id === r.tmdb_id)) {
          recentMap[r.user_id].push({ tmdb_id: r.tmdb_id, title: r.title, poster_path: r.poster_path ?? '', media_type: r.media_type as 'movie' | 'tv' });
        }
      });

      setSearchResults(data.map(p => ({ ...p, favourite_films: (p.favourite_films as FavFilm[] | null) ?? [], watched_count: countMap[p.id] ?? 0, recent_watched: recentMap[p.id] ?? [] })));
      setSearchLoading(false);
    }, 280);
  }, [query]);

  async function toggleFollow(memberId: string) {
    if (!user || followingInProgress.has(memberId)) return;
    setFollowingInProgress(s => new Set([...s, memberId]));
    const isFollowing = followingSet.has(memberId);
    if (isFollowing) {
      await supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', memberId);
      setFollowingSet(s => { const n = new Set(s); n.delete(memberId); return n; });
    } else {
      await supabase.from('follows').insert({ follower_id: user.id, following_id: memberId });
      setFollowingSet(s => new Set([...s, memberId]));
    }
    setFollowingInProgress(s => { const n = new Set(s); n.delete(memberId); return n; });
  }

  const displayList = query.trim() ? searchResults : members;
  const isEmpty = query.trim() ? (!searchLoading && searchResults.length === 0 && searched) : (!loading && members.length === 0);

  return (
    <div style={{ minHeight: '100vh', background: '#000', paddingBottom: 80 }}>
      <PageHeader title={t('members_title')} subtitle="Discover film lovers using Qued" />

      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '32px 32px 0' }}>
        {/* Search bar */}
        <div style={{ position: 'relative', maxWidth: 480, marginBottom: 32 }}>
          <Search size={15} color="#555" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search members by username…"
            style={{ width: '100%', padding: '11px 38px 11px 40px', background: '#111', border: '1px solid #2e2e2e', borderRadius: 12, color: '#fff', fontSize: 14, outline: 'none', fontFamily: 'inherit', transition: 'border-color .2s' }}
            onFocus={e => (e.target.style.borderColor = '#f59e0b')}
            onBlur={e => (e.target.style.borderColor = '#2e2e2e')}
          />
          {query && (
            <button onClick={() => setQuery('')} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#555', display: 'flex', alignItems: 'center', padding: 2 }}>
              <X size={13} />
            </button>
          )}
        </div>

        {searchLoading && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            {[0, 150, 300].map(d => (
              <div key={d} style={{ width: 6, height: 6, background: '#f59e0b', borderRadius: '50%', animation: `bounceDot 1.4s ${d}ms infinite` }} />
            ))}
          </div>
        )}

        {isEmpty && query.trim() && (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <Users size={40} color="#2e2e2e" style={{ margin: '0 auto 12px', display: 'block' }} />
            <p style={{ color: '#555', fontSize: 14, margin: 0 }}>No members found with that username</p>
          </div>
        )}

        {isEmpty && !query.trim() && (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <Users size={48} color="#2e2e2e" style={{ margin: '0 auto 12px' }} />
            <p style={{ color: '#555', fontSize: 14 }}>No public members yet</p>
          </div>
        )}

        {!isEmpty && (loading && !query.trim()) ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} style={{ background: '#111', borderRadius: 16, padding: 20, border: '1px solid #1a1a1a' }}>
                <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                  <div className="shimmer" style={{ width: 52, height: 52, borderRadius: '50%', flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div className="shimmer" style={{ height: 16, width: '60%', borderRadius: 4, marginBottom: 6 }} />
                    <div className="shimmer" style={{ height: 12, width: '40%', borderRadius: 4 }} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {Array.from({ length: 5 }).map((_, j) => (
                    <div key={j} className="shimmer" style={{ flex: 1, aspectRatio: '2/3', borderRadius: 6 }} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
            {displayList.map(member => (
              <MemberCard
                key={member.id}
                member={member}
                onClick={() => onMemberClick(member.id)}
                isFollowing={followingSet.has(member.id)}
                isCurrentUser={user?.id === member.id}
                followInProgress={followingInProgress.has(member.id)}
                onFollow={user ? () => toggleFollow(member.id) : undefined}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MemberCard({ member, onClick, isFollowing, isCurrentUser, followInProgress, onFollow }: {
  member: Member & { recent_watched?: FavFilm[] };
  onClick: () => void;
  isFollowing: boolean;
  isCurrentUser: boolean;
  followInProgress: boolean;
  onFollow?: () => void;
}) {
  return (
    <div
      style={{ background: '#111', borderRadius: 16, padding: 20, border: '1px solid #1a1a1a', cursor: 'pointer', transition: 'border-color .2s, box-shadow .2s' }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = '#2e2e2e'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 20px rgba(0,0,0,.4)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = '#1a1a1a'; (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'; }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <div onClick={onClick} style={{ width: 48, height: 48, borderRadius: '50%', overflow: 'hidden', background: '#1a1a1a', border: '2px solid #2e2e2e', flexShrink: 0 }}>
          {member.avatar_url
            ? <img src={member.avatar_url} alt={member.username} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ color: '#fbbf24', fontSize: 18, fontWeight: 700 }}>{member.username[0]?.toUpperCase()}</span>
              </div>}
        </div>
        <div onClick={onClick} style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, color: '#fff', fontWeight: 600, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{member.username}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <Film size={11} color="#555" />
            <span style={{ color: '#555', fontSize: 12 }}>{member.watched_count ?? 0} watched</span>
          </div>
          {member.bio && <p style={{ margin: '2px 0 0', color: '#888', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{member.bio}</p>}
        </div>
        {/* Follow button */}
        {onFollow && !isCurrentUser && (
          <button
            onClick={e => { e.stopPropagation(); onFollow(); }}
            disabled={followInProgress}
            style={{
              flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5,
              padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: followInProgress ? 'default' : 'pointer',
              border: isFollowing ? '1px solid #2e2e2e' : '1px solid rgba(245,158,11,.5)',
              background: isFollowing ? 'transparent' : 'rgba(245,158,11,.12)',
              color: isFollowing ? '#555' : '#f59e0b',
              transition: 'all .2s',
            }}
            onMouseEnter={e => {
              if (!isFollowing) { e.currentTarget.style.background = 'rgba(245,158,11,.22)'; }
              else { e.currentTarget.style.borderColor = '#ef4444'; e.currentTarget.style.color = '#ef4444'; }
            }}
            onMouseLeave={e => {
              if (!isFollowing) { e.currentTarget.style.background = 'rgba(245,158,11,.12)'; }
              else { e.currentTarget.style.borderColor = '#2e2e2e'; e.currentTarget.style.color = '#555'; }
            }}
          >
            {isFollowing ? <UserCheck size={12} /> : <UserPlus size={12} />}
            {isFollowing ? 'Following' : 'Follow'}
          </button>
        )}
      </div>

      {/* Favourite films — fill empty slots with recent diary entries */}
      <div onClick={onClick} style={{ display: 'flex', gap: 5 }}>
        {Array.from({ length: 5 }).map((_, i) => {
          const favs = member.favourite_films ?? [];
          const recent = member.recent_watched ?? [];
          // Use fav if available, otherwise backfill from recent diary
          const fav = favs[i] ?? recent[i - favs.length] ?? null;
          const psrc = fav ? posterUrl(fav.poster_path, 'w92') : null;
          const isRecent = !favs[i] && !!fav;
          return (
            <div key={i} style={{ flex: 1, aspectRatio: '2/3', borderRadius: 6, overflow: 'hidden', background: '#1a1a1a', border: `1px solid ${isRecent ? '#1e1e1e' : '#242424'}`, position: 'relative' }}>
              {psrc
                ? <img src={psrc} alt={fav!.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Film size={10} color="#3a3a3a" /></div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
