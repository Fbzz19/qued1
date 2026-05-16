import { useEffect, useState } from 'react';
import { X, Film } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { posterUrl } from '../lib/tmdb';

interface FollowListModalProps {
  userId: string;
  mode: 'followers' | 'following';
  onClose: () => void;
  onMemberClick: (userId: string) => void;
}

interface FollowUser {
  id: string;
  username: string;
  avatar_url: string;
  favourite_films: { poster_path: string }[];
}

export default function FollowListModal({ userId, mode, onClose, onMemberClick }: FollowListModalProps) {
  const [users, setUsers] = useState<FollowUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (mode === 'followers') {
        const { data } = await supabase
          .from('follows')
          .select('follower_id')
          .eq('following_id', userId);
        const ids = (data ?? []).map((r: { follower_id: string }) => r.follower_id);
        if (ids.length === 0) { setLoading(false); return; }
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, username, avatar_url, favourite_films')
          .in('id', ids);
        setUsers((profiles ?? []) as FollowUser[]);
      } else {
        const { data } = await supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', userId);
        const ids = (data ?? []).map((r: { following_id: string }) => r.following_id);
        if (ids.length === 0) { setLoading(false); return; }
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, username, avatar_url, favourite_films')
          .in('id', ids);
        setUsers((profiles ?? []) as FollowUser[]);
      }
      setLoading(false);
    }
    load();
  }, [userId, mode]);

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.8)', backdropFilter: 'blur(6px)', padding: 16 }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="animate-slide-up"
        style={{ width: '100%', maxWidth: 440, background: '#111', borderRadius: 20, border: '1px solid #242424', overflow: 'hidden', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid #1a1a1a', flexShrink: 0 }}>
          <h2 style={{ margin: 0, color: '#fff', fontSize: 16, fontWeight: 700 }}>
            {mode === 'followers' ? 'Followers' : 'Following'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', transition: 'color .2s' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
            onMouseLeave={e => (e.currentTarget.style.color = '#555')}>
            <X size={18} />
          </button>
        </div>

        <div style={{ overflowY: 'auto', padding: '12px 16px', flex: 1 }}>
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 8px' }}>
                <div className="shimmer" style={{ width: 44, height: 44, borderRadius: '50%', flexShrink: 0 }} />
                <div className="shimmer" style={{ height: 16, width: 140, borderRadius: 4 }} />
              </div>
            ))
          ) : users.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#555', fontSize: 14, padding: '32px 0' }}>
              No {mode === 'followers' ? 'followers' : 'following'} yet.
            </p>
          ) : (
            users.map(u => (
              <button
                key={u.id}
                onClick={() => { onMemberClick(u.id); onClose(); }}
                style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', padding: '10px 8px', background: 'none', border: 'none', borderRadius: 12, cursor: 'pointer', transition: 'background .15s', fontFamily: 'inherit' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#1a1a1a')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
              >
                <div style={{ width: 44, height: 44, borderRadius: '50%', overflow: 'hidden', background: '#1a1a1a', border: '2px solid #2e2e2e', flexShrink: 0 }}>
                  {u.avatar_url
                    ? <img src={u.avatar_url} alt={u.username} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ color: '#fbbf24', fontSize: 18, fontWeight: 700 }}>{u.username?.[0]?.toUpperCase()}</span>
                      </div>}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, color: '#fff', fontSize: 14, fontWeight: 600 }}>{u.username}</p>
                </div>
                {(u.favourite_films ?? []).slice(0, 3).map((f, i) => {
                  const ps = posterUrl(f.poster_path, 'w92');
                  return ps ? (
                    <img key={i} src={ps} alt="" style={{ width: 28, height: 42, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }} />
                  ) : (
                    <div key={i} style={{ width: 28, height: 42, background: '#1a1a1a', borderRadius: 4, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Film size={10} color="#555" />
                    </div>
                  );
                })}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
