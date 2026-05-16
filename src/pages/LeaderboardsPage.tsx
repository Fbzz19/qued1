import { useEffect, useState } from 'react';
import { ArrowLeft, Trophy, Film, Star, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

interface LeaderboardEntry {
  user_id: string;
  username: string;
  avatar_url: string | null;
  count: number;
  rank?: number;
}

type Board = 'films' | 'reviews' | 'followers';

const BOARDS: { key: Board; label: string; icon: React.ReactNode }[] = [
  { key: 'films',     label: 'Films Watched', icon: <Film size={15} /> },
  { key: 'reviews',  label: 'Reviews',        icon: <Star size={15} /> },
  { key: 'followers',label: 'Followers',      icon: <Users size={15} /> },
];

interface LeaderboardsPageProps {
  onBack: () => void;
  onMemberClick: (userId: string) => void;
}

export default function LeaderboardsPage({ onBack, onMemberClick }: LeaderboardsPageProps) {
  const { user } = useAuth();
  const [active, setActive] = useState<Board>('films');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [myEntry, setMyEntry] = useState<LeaderboardEntry | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setEntries([]);
    setMyEntry(null);
    loadBoard(active);
  }, [active]);

  async function loadBoard(board: Board) {
    let data: LeaderboardEntry[] = [];

    if (board === 'films') {
      const { data: rows } = await supabase
        .from('watched')
        .select('user_id, profiles!inner(username, avatar_url)')
        .limit(10000);

      if (rows) {
        const counts: Record<string, { username: string; avatar_url: string | null; count: number }> = {};
        for (const row of rows) {
          const p = row.profiles as unknown as { username: string; avatar_url: string | null };
          if (!counts[row.user_id]) counts[row.user_id] = { username: p.username, avatar_url: p.avatar_url, count: 0 };
          counts[row.user_id].count++;
        }
        data = Object.entries(counts)
          .map(([user_id, v]) => ({ user_id, ...v }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 50)
          .map((e, i) => ({ ...e, rank: i + 1 }));
      }
    } else if (board === 'reviews') {
      const { data: rows } = await supabase
        .from('reviews')
        .select('user_id, profiles!inner(username, avatar_url)')
        .limit(10000);

      if (rows) {
        const counts: Record<string, { username: string; avatar_url: string | null; count: number }> = {};
        for (const row of rows) {
          const p = row.profiles as unknown as { username: string; avatar_url: string | null };
          if (!counts[row.user_id]) counts[row.user_id] = { username: p.username, avatar_url: p.avatar_url, count: 0 };
          counts[row.user_id].count++;
        }
        data = Object.entries(counts)
          .map(([user_id, v]) => ({ user_id, ...v }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 50)
          .map((e, i) => ({ ...e, rank: i + 1 }));
      }
    } else {
      const { data: rows } = await supabase
        .from('follows')
        .select('following_id, profiles!follows_following_id_fkey(username, avatar_url)')
        .limit(10000);

      if (rows) {
        const counts: Record<string, { username: string; avatar_url: string | null; count: number }> = {};
        for (const row of rows) {
          const p = row.profiles as unknown as { username: string; avatar_url: string | null };
          if (!counts[row.following_id]) counts[row.following_id] = { username: p?.username ?? 'Unknown', avatar_url: p?.avatar_url ?? null, count: 0 };
          counts[row.following_id].count++;
        }
        data = Object.entries(counts)
          .map(([user_id, v]) => ({ user_id, ...v }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 50)
          .map((e, i) => ({ ...e, rank: i + 1 }));
      }
    }

    setEntries(data);

    // Find logged-in user's rank if not in top 50
    if (user) {
      const inTop = data.find(e => e.user_id === user.id);
      if (inTop) {
        setMyEntry(null);
      } else {
        // Fetch their count
        let count = 0;
        if (board === 'films') {
          const { count: c } = await supabase.from('watched').select('id', { count: 'exact', head: true }).eq('user_id', user.id);
          count = c ?? 0;
        } else if (board === 'reviews') {
          const { count: c } = await supabase.from('reviews').select('id', { count: 'exact', head: true }).eq('user_id', user.id);
          count = c ?? 0;
        } else {
          const { count: c } = await supabase.from('follows').select('id', { count: 'exact', head: true }).eq('following_id', user.id);
          count = c ?? 0;
        }
        const { data: prof } = await supabase.from('profiles').select('username, avatar_url').eq('id', user.id).maybeSingle();
        const rank = data.filter(e => e.count > count).length + 1;
        setMyEntry({ user_id: user.id, username: prof?.username ?? 'You', avatar_url: prof?.avatar_url ?? null, count, rank });
      }
    }

    setLoading(false);
  }

  const rankColor = (rank: number) =>
    rank === 1 ? '#f59e0b' : rank === 2 ? '#94a3b8' : rank === 3 ? '#d97706' : '#555';

  const rankLabel = (rank: number) =>
    rank === 1 ? '1st' : rank === 2 ? '2nd' : rank === 3 ? '3rd' : `${rank}th`;

  const unitLabel = (board: Board) =>
    board === 'films' ? 'films' : board === 'reviews' ? 'reviews' : 'followers';

  return (
    <div style={{ minHeight: '100vh', background: '#000', paddingBottom: 80 }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 20px' }}>
        {/* Back */}
        <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#888', fontSize: 14, fontFamily: 'inherit', padding: '0 0 24px' }}>
          <ArrowLeft size={16} /> Back
        </button>

        {/* Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(245,158,11,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Trophy size={20} color="#f59e0b" />
          </div>
          <div>
            <h1 style={{ color: '#fff', fontSize: 22, fontWeight: 800, margin: 0 }}>Leaderboards</h1>
            <p style={{ color: '#555', fontSize: 13, margin: 0 }}>Top 50 Qued members</p>
          </div>
        </div>

        {/* Tab switcher */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 28, background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 12, padding: 4 }}>
          {BOARDS.map(b => (
            <button
              key={b.key}
              onClick={() => setActive(b.key)}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, height: 38, borderRadius: 9, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', transition: 'all .2s',
                background: active === b.key ? '#f59e0b' : 'transparent',
                color: active === b.key ? '#000' : '#555',
              }}
            >
              {b.icon}
              {b.label}
            </button>
          ))}
        </div>

        {/* List */}
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              {[0, 150, 300].map(d => (
                <div key={d} style={{ width: 8, height: 8, background: '#f59e0b', borderRadius: '50%', animation: `bounceDot 1.4s ${d}ms infinite` }} />
              ))}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {entries.map((entry, i) => {
              const isMe = entry.user_id === user?.id;
              const top3 = (entry.rank ?? i + 1) <= 3;
              return (
                <div
                  key={entry.user_id}
                  onClick={() => onMemberClick(entry.user_id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 16,
                    padding: '14px 18px', borderRadius: 12, cursor: 'pointer',
                    background: isMe ? 'rgba(245,158,11,.06)' : top3 ? 'rgba(255,255,255,.02)' : 'transparent',
                    border: isMe ? '1px solid rgba(245,158,11,.2)' : '1px solid transparent',
                    transition: 'background .15s',
                  }}
                  onMouseEnter={e => { if (!isMe) (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,.03)'; }}
                  onMouseLeave={e => { if (!isMe) (e.currentTarget as HTMLDivElement).style.background = top3 ? 'rgba(255,255,255,.02)' : 'transparent'; }}
                >
                  {/* Rank */}
                  <div style={{ width: 36, textAlign: 'center', flexShrink: 0 }}>
                    {top3 ? (
                      <Trophy size={18} color={rankColor(entry.rank ?? i + 1)} />
                    ) : (
                      <span style={{ color: '#444', fontSize: 13, fontWeight: 600 }}>{entry.rank ?? i + 1}</span>
                    )}
                  </div>

                  {/* Avatar */}
                  <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#1a1a1a', flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {entry.avatar_url ? (
                      <img src={entry.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span style={{ color: '#f59e0b', fontWeight: 700, fontSize: 14 }}>{entry.username?.[0]?.toUpperCase()}</span>
                    )}
                  </div>

                  {/* Name */}
                  <div style={{ flex: 1 }}>
                    <span style={{ color: isMe ? '#fbbf24' : '#ccc', fontSize: 14, fontWeight: isMe ? 700 : 500 }}>
                      {entry.username}
                      {isMe && <span style={{ color: '#f59e0b', fontSize: 11, marginLeft: 8 }}>you</span>}
                    </span>
                  </div>

                  {/* Count + rank badge */}
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ color: top3 ? '#f59e0b' : '#888', fontSize: 15, fontWeight: 700 }}>{entry.count.toLocaleString()}</div>
                    <div style={{ color: '#444', fontSize: 11 }}>{unitLabel(active)}</div>
                  </div>

                  {top3 && (
                    <div style={{ width: 40, textAlign: 'right', flexShrink: 0 }}>
                      <span style={{ background: top3 ? `${rankColor(entry.rank ?? i + 1)}22` : 'transparent', color: rankColor(entry.rank ?? i + 1), fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 20 }}>
                        {rankLabel(entry.rank ?? i + 1)}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}

            {/* User rank outside top 50 */}
            {myEntry && (
              <>
                <div style={{ padding: '10px 18px', textAlign: 'center' }}>
                  <span style={{ color: '#333', fontSize: 12 }}>· · ·</span>
                </div>
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 18px', borderRadius: 12, background: 'rgba(245,158,11,.06)', border: '1px solid rgba(245,158,11,.2)' }}
                >
                  <div style={{ width: 36, textAlign: 'center', flexShrink: 0 }}>
                    <span style={{ color: '#888', fontSize: 13, fontWeight: 600 }}>#{myEntry.rank}</span>
                  </div>
                  <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#1a1a1a', flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {myEntry.avatar_url ? (
                      <img src={myEntry.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span style={{ color: '#f59e0b', fontWeight: 700, fontSize: 14 }}>{myEntry.username?.[0]?.toUpperCase()}</span>
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <span style={{ color: '#fbbf24', fontSize: 14, fontWeight: 700 }}>{myEntry.username} <span style={{ color: '#f59e0b', fontSize: 11 }}>you</span></span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ color: '#888', fontSize: 15, fontWeight: 700 }}>{myEntry.count.toLocaleString()}</div>
                    <div style={{ color: '#444', fontSize: 11 }}>{unitLabel(active)}</div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
