import { useEffect, useState } from 'react';
import { ArrowLeft, ChartBar as BarChart2, Lock, Crown, TrendingUp, Calendar, Flame } from 'lucide-react';
import { formatWatchTime } from '../lib/formatWatchTime';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { posterUrl } from '../lib/tmdb';

interface StatsPageProps {
  onBack: () => void;
  onProClick: () => void;
}

interface GenreCount { name: string; count: number; }
interface MonthCount { month: string; count: number; }
interface PersonCount { id: number; name: string; poster_path: string | null; count: number; }

const GENRE_MAP: Record<number, string> = {
  28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy', 80: 'Crime',
  99: 'Documentary', 18: 'Drama', 10751: 'Family', 14: 'Fantasy', 36: 'History',
  27: 'Horror', 10402: 'Music', 9648: 'Mystery', 10749: 'Romance', 878: 'Sci-Fi',
  53: 'Thriller', 10752: 'War', 37: 'Western',
};

export default function StatsPage({ onBack, onProClick }: StatsPageProps) {
  const { user, profile } = useAuth();
  const isPro = profile?.role === 'pro' || profile?.role === 'admin';

  const [genres,       setGenres]       = useState<GenreCount[]>([]);
  const [months,       setMonths]       = useState<MonthCount[]>([]);
  const [topActors,    setTopActors]    = useState<PersonCount[]>([]);
  const [topDirectors, setTopDirectors] = useState<PersonCount[]>([]);
  const [avgRating,    setAvgRating]    = useState<number | null>(null);
  const [streak,       setStreak]       = useState(0);
  const [mostActive,   setMostActive]   = useState('');
  const [totalMovies,  setTotalMovies]  = useState(0);
  const [totalShows,   setTotalShows]   = useState(0);
  const [totalMins,    setTotalMins]    = useState(0);
  const [loading,      setLoading]      = useState(true);

  useEffect(() => {
    if (!user || !isPro) { setLoading(false); return; }
    loadStats();
  }, [user, isPro]);

  async function loadStats() {
    setLoading(true);

    const [{ data: watched }, { data: ratings }] = await Promise.all([
      supabase.from('watched').select('*').eq('user_id', user!.id).order('watched_date', { ascending: true }),
      supabase.from('ratings').select('rating').eq('user_id', user!.id),
    ]);

    if (!watched) { setLoading(false); return; }

    setTotalMovies(watched.filter(w => w.media_type === 'movie').length);
    setTotalShows(watched.filter(w => w.media_type === 'tv').length);
    setTotalMins(watched.reduce((s, w) => s + (w.runtime_minutes ?? 0), 0));

    // Average rating
    if (ratings && ratings.length > 0) {
      const avg = ratings.reduce((s, r) => s + Number(r.rating), 0) / ratings.length;
      setAvgRating(Math.round(avg * 10) / 10);
    }

    // Month counts
    const monthMap: Record<string, number> = {};
    for (const w of watched) {
      if (!w.watched_date) continue;
      const m = w.watched_date.slice(0, 7);
      monthMap[m] = (monthMap[m] ?? 0) + 1;
    }
    const monthArr = Object.entries(monthMap).map(([month, count]) => ({ month, count })).sort((a, b) => a.month.localeCompare(b.month));
    setMonths(monthArr.slice(-12));

    // Most active month
    if (monthArr.length) {
      const best = monthArr.reduce((a, b) => b.count > a.count ? b : a);
      setMostActive(new Date(best.month + '-01').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }));
    }

    // Streak (consecutive days)
    const dates = [...new Set(watched.map(w => w.watched_date).filter(Boolean))].sort();
    let maxStreak = 0, cur = 1;
    for (let i = 1; i < dates.length; i++) {
      const prev = new Date(dates[i - 1]);
      const next = new Date(dates[i]);
      const diff = (next.getTime() - prev.getTime()) / 86400000;
      if (diff === 1) { cur++; maxStreak = Math.max(maxStreak, cur); }
      else cur = 1;
    }
    setStreak(maxStreak);

    // Genre counts — fetch TMDB details for genre_ids
    const tmdbIds = [...new Set(watched.map(w => w.tmdb_id))].slice(0, 60);
    const genreMap: Record<string, number> = {};
    await Promise.all(tmdbIds.map(async tmdbId => {
      try {
        const w = watched.find(x => x.tmdb_id === tmdbId);
        const type = w?.media_type === 'tv' ? 'tv' : 'movie';
        const res = await fetch(`https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=561cfec28927b6575f26079bed25fadf&language=en-US`);
        const data = await res.json();
        const ids: number[] = data.genre_ids ?? data.genres?.map((g: { id: number }) => g.id) ?? [];
        for (const gid of ids) {
          const name = GENRE_MAP[gid];
          if (name) genreMap[name] = (genreMap[name] ?? 0) + 1;
        }
      } catch { /* skip */ }
    }));
    const genreArr = Object.entries(genreMap).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 8);
    setGenres(genreArr);

    // Top cast/directors from credits
    const actorMap: Record<number, { name: string; poster_path: string | null; count: number }> = {};
    const directorMap: Record<number, { name: string; poster_path: string | null; count: number }> = {};
    await Promise.all(tmdbIds.slice(0, 30).map(async tmdbId => {
      try {
        const w = watched.find(x => x.tmdb_id === tmdbId);
        const type = w?.media_type === 'tv' ? 'tv' : 'movie';
        const res = await fetch(`https://api.themoviedb.org/3/${type}/${tmdbId}/credits?api_key=561cfec28927b6575f26079bed25fadf`);
        const data = await res.json();
        for (const cast of (data.cast ?? []).slice(0, 5)) {
          if (!actorMap[cast.id]) actorMap[cast.id] = { name: cast.name, poster_path: cast.profile_path, count: 0 };
          actorMap[cast.id].count++;
        }
        for (const crew of (data.crew ?? [])) {
          if (crew.job === 'Director') {
            if (!directorMap[crew.id]) directorMap[crew.id] = { name: crew.name, poster_path: crew.profile_path, count: 0 };
            directorMap[crew.id].count++;
          }
        }
      } catch { /* skip */ }
    }));
    setTopActors(Object.entries(actorMap).map(([id, v]) => ({ id: Number(id), ...v })).sort((a, b) => b.count - a.count).slice(0, 5));
    setTopDirectors(Object.entries(directorMap).map(([id, v]) => ({ id: Number(id), ...v })).sort((a, b) => b.count - a.count).slice(0, 5));

    setLoading(false);
  }

  const maxMonth = months.reduce((m, c) => Math.max(m, c.count), 0);
  const maxGenre = genres[0]?.count ?? 1;

  return (
    <div style={{ minHeight: '100vh', background: '#000', paddingBottom: 80 }}>
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '24px 20px' }}>
        <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#888', fontSize: 14, fontFamily: 'inherit', padding: '0 0 24px' }}>
          <ArrowLeft size={16} /> Back
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(245,158,11,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <BarChart2 size={20} color="#f59e0b" />
          </div>
          <div>
            <h1 style={{ color: '#fff', fontSize: 22, fontWeight: 800, margin: 0 }}>Advanced Stats</h1>
            <p style={{ color: '#555', fontSize: 13, margin: 0 }}>Deep insights into your viewing habits</p>
          </div>
        </div>

        {!isPro ? (
          <div style={{ textAlign: 'center', padding: '60px 24px', background: 'rgba(245,158,11,.04)', border: '1px solid rgba(245,158,11,.15)', borderRadius: 20 }}>
            <Lock size={32} color="#555" style={{ marginBottom: 16 }} />
            <h2 style={{ color: '#fff', fontSize: 20, fontWeight: 700, margin: '0 0 10px' }}>Pro Feature</h2>
            <p style={{ color: '#666', fontSize: 15, margin: '0 0 28px' }}>Advanced Stats are available exclusively to Qued Pro members.</p>
            <button onClick={onProClick} className="btn-gold" style={{ fontSize: 15, padding: '12px 32px', borderRadius: 12 }}>
              <Crown size={16} style={{ marginRight: 8 }} />
              Upgrade to Pro
            </button>
          </div>
        ) : loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              {[0, 150, 300].map(d => (
                <div key={d} style={{ width: 8, height: 8, background: '#f59e0b', borderRadius: '50%', animation: `bounceDot 1.4s ${d}ms infinite` }} />
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* Summary cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 32 }}>
              {[
                { label: 'Films watched', value: totalMovies.toLocaleString(), color: '#f59e0b' },
                { label: 'Shows watched', value: totalShows.toLocaleString(), color: '#60a5fa' },
                { label: 'Watch time', value: formatWatchTime(totalMins), color: '#4ade80' },
                { label: 'Avg rating', value: avgRating != null ? `${avgRating} ★` : '—', color: '#fbbf24' },
                { label: 'Longest streak', value: `${streak} days`, color: '#f87171' },
                { label: 'Most active', value: mostActive || '—', color: '#a78bfa' },
              ].map(s => (
                <div key={s.label} style={{ background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 14, padding: '16px 20px' }}>
                  <div style={{ color: s.color, fontSize: 20, fontWeight: 800, marginBottom: 4 }}>{s.value}</div>
                  <div style={{ color: '#555', fontSize: 12 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Genre breakdown */}
            {genres.length > 0 && (
              <div style={{ marginBottom: 32, background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 16, padding: 24 }}>
                <h3 style={{ color: '#fff', fontSize: 15, fontWeight: 700, margin: '0 0 20px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <BarChart2 size={16} color="#f59e0b" /> Genre Breakdown
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {genres.map(g => (
                    <div key={g.name}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                        <span style={{ color: '#ccc', fontSize: 13 }}>{g.name}</span>
                        <span style={{ color: '#888', fontSize: 12 }}>{g.count} films</span>
                      </div>
                      <div style={{ height: 6, background: '#1a1a1a', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', background: '#f59e0b', borderRadius: 3, width: `${(g.count / maxGenre) * 100}%`, transition: 'width .6s ease' }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Monthly activity */}
            {months.length > 0 && (
              <div style={{ marginBottom: 32, background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 16, padding: 24 }}>
                <h3 style={{ color: '#fff', fontSize: 15, fontWeight: 700, margin: '0 0 20px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <TrendingUp size={16} color="#f59e0b" /> Monthly Activity
                </h3>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 120 }}>
                  {months.map(m => (
                    <div key={m.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <span style={{ color: '#666', fontSize: 9 }}>{m.count}</span>
                      <div style={{ width: '100%', background: '#f59e0b', borderRadius: '3px 3px 0 0', height: `${Math.max(4, (m.count / maxMonth) * 90)}px`, transition: 'height .6s ease' }} />
                      <span style={{ color: '#444', fontSize: 8, transform: 'rotate(-45deg)', whiteSpace: 'nowrap' }}>
                        {new Date(m.month + '-01').toLocaleDateString('en-GB', { month: 'short' })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Top cast / directors */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 32 }}>
              {[
                { title: 'Most Watched Actors', items: topActors },
                { title: 'Most Watched Directors', items: topDirectors },
              ].map(section => (
                <div key={section.title} style={{ background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 16, padding: 20 }}>
                  <h3 style={{ color: '#fff', fontSize: 14, fontWeight: 700, margin: '0 0 16px' }}>{section.title}</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {section.items.length === 0 ? (
                      <p style={{ color: '#444', fontSize: 12, margin: 0 }}>Not enough data yet.</p>
                    ) : section.items.map((person, i) => (
                      <div key={person.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ color: '#444', fontSize: 11, width: 16, flexShrink: 0 }}>{i + 1}</span>
                        <div style={{ width: 30, height: 30, borderRadius: '50%', overflow: 'hidden', background: '#1a1a1a', flexShrink: 0 }}>
                          {person.poster_path
                            ? <img src={posterUrl(person.poster_path, 'w92') ?? ''} alt={person.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ color: '#888', fontSize: 10 }}>{person.name[0]}</span></div>}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ color: '#ccc', fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{person.name}</div>
                          <div style={{ color: '#555', fontSize: 11 }}>{person.count} films</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Streak visual */}
            {streak > 0 && (
              <div style={{ background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 16, padding: 24, display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ width: 56, height: 56, borderRadius: 14, background: 'rgba(248,113,113,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Flame size={28} color="#f87171" />
                </div>
                <div>
                  <div style={{ color: '#f87171', fontSize: 28, fontWeight: 800 }}>{streak} day streak</div>
                  <div style={{ color: '#555', fontSize: 13 }}>Your longest consecutive viewing streak</div>
                </div>
              </div>
            )}

            {months.length === 0 && genres.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 24px', color: '#555' }}>
                <Calendar size={32} style={{ marginBottom: 12 }} />
                <p style={{ margin: 0 }}>Log more films to unlock your stats.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
