import { useEffect, useState } from 'react';
import { Layers, Lock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { tmdb, posterUrl } from '../lib/tmdb';
import { useAuth } from '../context/AuthContext';
import { FRANCHISE_LIST } from './FranchisePage';
import { PageHeader } from './FilmsPage';

interface WatchOrderPageProps {
  onFranchiseClick: (id: string) => void;
  onSignUp: () => void;
}

// Representative "hero" TMDB IDs for each franchise cover poster
const FRANCHISE_COVER_IDS: Record<string, { id: number; type: 'movie' | 'tv' }> = {
  marvel:            { id: 299534,  type: 'movie' }, // Avengers: Endgame
  star_wars:         { id: 11,      type: 'movie' }, // A New Hope
  dc:                { id: 297762,  type: 'movie' }, // Wonder Woman
  fast_furious:      { id: 168259,  type: 'movie' }, // Furious 7
  james_bond:        { id: 37724,   type: 'movie' }, // Skyfall
  harry_potter:      { id: 671,     type: 'movie' }, // Philosopher's Stone
  lotr:              { id: 120,     type: 'movie' }, // Fellowship of the Ring
  john_wick:         { id: 245891,  type: 'movie' }, // John Wick
  mission_impossible:{ id: 353081,  type: 'movie' }, // Fallout (corrected)
  jurassic_park:     { id: 329,     type: 'movie' }, // Jurassic Park
  indiana_jones:     { id: 85,      type: 'movie' }, // Raiders of the Lost Ark
  alien:             { id: 348,     type: 'movie' }, // Alien
  terminator:        { id: 218,     type: 'movie' }, // The Terminator
  transformers:      { id: 1858,    type: 'movie' }, // Transformers
};

export default function WatchOrderPage({ onFranchiseClick, onSignUp }: WatchOrderPageProps) {
  const { user } = useAuth();
  const [coverPosters, setCoverPosters] = useState<Record<string, string | null>>({});
  const [progressMap, setProgressMap] = useState<Record<string, { watched: number; total: number }>>({});

  // Fetch cover posters
  useEffect(() => {
    const entries = Object.entries(FRANCHISE_COVER_IDS);
    Promise.all(entries.map(async ([franchiseId, { id, type }]) => {
      try {
        const data = type === 'movie' ? await tmdb.movieDetails(id) : await tmdb.tvDetails(id);
        return { franchiseId, path: data.poster_path as string | null };
      } catch {
        return { franchiseId, path: null };
      }
    })).then(results => {
      const map: Record<string, string | null> = {};
      results.forEach(r => { map[r.franchiseId] = r.path; });
      setCoverPosters(map);
    });
  }, []);

  // Fetch watched progress for logged-in users
  useEffect(() => {
    if (!user) return;
    // We need to import FRANCHISES but it's not exported — use FRANCHISE_LIST + known totals
    // We'll fetch from the DB and approximate progress per franchise using watched tmdb_ids
    async function loadProgress() {
      const { data } = await supabase.from('watched').select('tmdb_id').eq('user_id', user!.id);
      const watchedSet = new Set((data ?? []).map((r: { tmdb_id: number }) => r.tmdb_id));
      // Import franchise entry counts from the page module
      const { FRANCHISES_DATA } = await import('./FranchisePage');
      const pm: Record<string, { watched: number; total: number }> = {};
      for (const [id, f] of Object.entries(FRANCHISES_DATA)) {
        const total = f.entries.length;
        const watched = f.entries.filter(e => watchedSet.has(e.id)).length;
        pm[id] = { watched, total };
      }
      setProgressMap(pm);
    }
    loadProgress();
  }, [user]);

  return (
    <div style={{ minHeight: '100vh', background: '#000', paddingBottom: 80 }}>
      <PageHeader title="Watch Orders" subtitle="Complete franchise guides with every film and show in order" />

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '28px clamp(16px,3vw,32px) 0' }}>
        <div style={{ position: 'relative' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(clamp(200px,22vw,260px),1fr))', gap: 20, filter: !user ? 'blur(6px)' : 'none', pointerEvents: !user ? 'none' : 'auto', userSelect: !user ? 'none' : 'auto', transition: 'filter .3s' }}>
          {FRANCHISE_LIST.map(f => {
            const posterPath = coverPosters[f.id];
            const prog = progressMap[f.id];
            const pct = prog && prog.total > 0 ? (prog.watched / prog.total) * 100 : 0;
            return (
              <button
                key={f.id}
                onClick={() => onFranchiseClick(f.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0, fontFamily: 'inherit' }}
              >
                <div
                  className="poster-card"
                  style={{ position: 'relative', aspectRatio: '3/4', borderRadius: 14, overflow: 'hidden', border: `1px solid ${f.color}22`, marginBottom: 10 }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = `${f.color}66`)}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = `${f.color}22`)}
                >
                  {posterPath
                    ? <img src={posterUrl(posterPath)!} alt={f.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                    : <div style={{ width: '100%', height: '100%', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Layers size={32} color="#333" />
                      </div>}
                  {/* Gradient overlay */}
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,.85) 0%, transparent 50%)' }} />
                  {/* Franchise name at bottom */}
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '12px 14px' }}>
                    <p style={{ margin: 0, color: '#fff', fontSize: 14, fontWeight: 700, lineHeight: 1.3 }}>{f.name}</p>
                    {prog && (
                      <p style={{ margin: '3px 0 0', color: '#888', fontSize: 11 }}>{prog.watched}/{prog.total} watched</p>
                    )}
                  </div>
                  {/* Color accent bar */}
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: f.color }} />
                </div>
                {/* Progress bar below poster */}
                {user && prog && (
                  <div style={{ height: 3, background: '#1a1a1a', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: f.color, width: `${pct}%`, transition: 'width .4s', borderRadius: 2 }} />
                  </div>
                )}
              </button>
            );
          })}
          </div>
          {!user && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24, zIndex: 10 }}>
              <div style={{ background: 'rgba(0,0,0,.85)', backdropFilter: 'blur(8px)', border: '1px solid rgba(245,158,11,.25)', borderRadius: 20, padding: '32px 40px', textAlign: 'center', maxWidth: 420, boxShadow: '0 8px 40px rgba(0,0,0,.6)' }}>
                <div style={{ width: 52, height: 52, borderRadius: 16, background: 'rgba(245,158,11,.12)', border: '1px solid rgba(245,158,11,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                  <Lock size={22} color="#f59e0b" />
                </div>
                <h3 style={{ margin: '0 0 8px', color: '#fff', fontSize: 18, fontWeight: 700 }}>Members Only</h3>
                <p style={{ margin: '0 0 20px', color: '#888', fontSize: 14, lineHeight: 1.6 }}>
                  Create a free account to access franchise watch orders and track your progress.
                </p>
                <button onClick={onSignUp} className="btn-gold" style={{ fontSize: 14, padding: '11px 28px', borderRadius: 12 }}>
                  Create Free Account
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
