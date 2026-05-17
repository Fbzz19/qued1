import { useEffect, useState } from 'react';
import { Layers, Lock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { posterUrl } from '../lib/tmdb';
import { useAuth } from '../context/AuthContext';
import { FRANCHISE_LIST } from './FranchisePage';
import { PageHeader } from './FilmsPage';

interface WatchOrderPageProps {
  onFranchiseClick: (id: string) => void;
  onSignUp: () => void;
}

const FRANCHISE_COVER_POSTERS: Record<string, string> = {
  marvel: '/ulzhLuWrPK07P1YkdWQLZnQh1JL.jpg',
  star_wars: '/6FfCtAuVAW8XJjZ7eWeLibRLWTw.jpg',
  dc: '/v4ncgZjG2Zu8ZW5al1vIZTsSjqX.jpg',
  fast_furious: '/ktofZ9Htrjiy0P6LEowsDaxd3Ri.jpg',
  james_bond: '/d0IVecFQvsGdSbnMAHqiYsNYaJT.jpg',
  harry_potter: '/wuMc08IPKEatf9rnMNXvIDxqP4W.jpg',
  lotr: '/6oom5QYQ2yQTMJIbnvbkBL9cHo6.jpg',
  john_wick: '/wXqWR7dHncNRbxoEGybEy7QTe9h.jpg',
  mission_impossible: '/AkJQpZp9WoNdj7pLYSj1L0RcMMN.jpg',
  jurassic_park: '/maFjKnJ62hDQ9E66dKqDZgbUy0H.jpg',
  indiana_jones: '/ceG9VzoRAVGwivFU403Wc3AHRys.jpg',
  alien: '/vfrQk5IPloGg1v9Rzbh2Eg3VGyM.jpg',
  terminator: '/qvktm0BHcnmDpul4Hz01GIazWPr.jpg',
  transformers: '/1P7w3AImoEOWJX7nn3fdaKDfEQA.jpg',
};

const FRANCHISE_LOGOS: Record<string, string> = {
  marvel: '/mIkZDuulwMPzESbzF9lg3rD8CcO.png',
  star_wars: '/vswPivs3yuUsk5aW6DbnyeNQ4GX.png',
  dc: '/2Tc1P3Ac8M479naPp1kYT3izLS5.png',
  fast_furious: '/1c8iuk79l4uFA7xq7o2TCsJDFi1.png',
  james_bond: '/pxvf5usDNAzPEc9j0yluQA2I2Ud.png',
  harry_potter: '/n7Pj4doQ1yfElCiGTGFTvzoQkpf.png',
  lotr: '/87sl6r7n7Qx0fALtLZFxM3mU3KM.png',
  john_wick: '/eVXvH6j4qM8ZEqZfw5bZ6JGQxqZ.png',
  mission_impossible: '/d4Nk4FAlEoHLNEny88SQ7Jk9ZsZ.png',
  jurassic_park: '/ec4wy0iZFkHTxw04HyX4r06DwrH.png',
  indiana_jones: '/tPI0BNiiGbVAPIrO8kcBWajM6He.png',
  alien: '/riI33EA1vYQ1szTtMe0NR7TwV1p.png',
  terminator: '/rKa9Nx344BrH7TCwGIArSbf0zqT.png',
  transformers: '/ozzvPYVLxYwXgspOrF5CyDP2A8S.png',
};

const LOGO_BACKGROUND_LAYOUT = [
  { id: 'marvel', top: '7%', left: '4%', width: 280, rotate: -10, opacity: 0.075 },
  { id: 'star_wars', top: '8%', right: '8%', width: 230, rotate: 8, opacity: 0.075 },
  { id: 'dc', top: '20%', left: '45%', width: 150, rotate: -7, opacity: 0.07 },
  { id: 'jurassic_park', top: '30%', left: '-2%', width: 230, rotate: 10, opacity: 0.065 },
  { id: 'harry_potter', top: '31%', right: '3%', width: 260, rotate: -9, opacity: 0.07 },
  { id: 'alien', top: '49%', left: '8%', width: 300, rotate: -3, opacity: 0.058 },
  { id: 'terminator', top: '50%', right: '11%', width: 255, rotate: 8, opacity: 0.062 },
  { id: 'transformers', top: '66%', left: '34%', width: 290, rotate: -7, opacity: 0.063 },
  { id: 'lotr', bottom: '8%', left: '2%', width: 310, rotate: 8, opacity: 0.06 },
  { id: 'fast_furious', bottom: '6%', right: '2%', width: 270, rotate: -10, opacity: 0.065 },
  { id: 'james_bond', top: '77%', left: '58%', width: 190, rotate: 6, opacity: 0.064 },
  { id: 'john_wick', top: '17%', left: '22%', width: 240, rotate: 5, opacity: 0.058 },
  { id: 'mission_impossible', top: '72%', left: '18%', width: 245, rotate: -9, opacity: 0.06 },
  { id: 'indiana_jones', top: '16%', right: '31%', width: 240, rotate: -4, opacity: 0.06 },
];

function FranchiseLogoBackground() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
        background: 'radial-gradient(circle at 16% 12%, rgba(245,158,11,.09), transparent 28%), radial-gradient(circle at 86% 18%, rgba(148,163,184,.08), transparent 26%), radial-gradient(circle at 52% 108%, rgba(255,255,255,.055), transparent 34%), #000',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.12,
          backgroundImage: 'linear-gradient(90deg, rgba(255,255,255,.12) 0 1px, transparent 1px), linear-gradient(rgba(255,255,255,.08) 0 1px, transparent 1px)',
          backgroundSize: '96px 96px',
          maskImage: 'linear-gradient(to bottom, rgba(0,0,0,.8), rgba(0,0,0,.34) 58%, rgba(0,0,0,.86))',
        }}
      />
      {LOGO_BACKGROUND_LAYOUT.map(item => {
        const franchise = FRANCHISE_LIST.find(f => f.id === item.id);
        const logoPath = FRANCHISE_LOGOS[item.id];
        if (!franchise || !logoPath) return null;
        return (
          <img
            key={item.id}
            src={posterUrl(logoPath, 'w342') ?? undefined}
            alt=""
            draggable={false}
            loading="lazy"
            decoding="async"
            style={{
              position: 'absolute',
              top: item.top,
              right: item.right,
              bottom: item.bottom,
              left: item.left,
              width: `clamp(${Math.round(item.width * 0.56)}px, ${Math.round(item.width / 12)}vw, ${item.width}px)`,
              maxHeight: item.id === 'dc' || item.id === 'jurassic_park' ? 170 : 96,
              objectFit: 'contain',
              opacity: item.opacity,
              transform: `rotate(${item.rotate}deg)`,
              filter: `grayscale(1) brightness(1.45) contrast(1.08) drop-shadow(0 0 24px ${franchise.color}33)`,
            }}
          />
        );
      })}
    </div>
  );
}

export default function WatchOrderPage({ onFranchiseClick, onSignUp }: WatchOrderPageProps) {
  const { user } = useAuth();
  const [progressMap, setProgressMap] = useState<Record<string, { watched: number; total: number }>>({});

  useEffect(() => {
    const timer = window.setTimeout(() => {
      Object.values(FRANCHISE_COVER_POSTERS).slice(0, 6).forEach(path => {
        const img = new Image();
        img.src = posterUrl(path, 'w342') ?? '';
      });
    }, 900);
    return () => window.clearTimeout(timer);
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
    <div style={{ minHeight: '100vh', background: '#000', paddingBottom: 80, position: 'relative', overflow: 'hidden' }}>
      <FranchiseLogoBackground />
      <div style={{ position: 'relative', zIndex: 1 }}>
        <PageHeader title="Watch Orders" subtitle="Complete franchise guides with every film and show in order" />
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '28px clamp(16px,3vw,32px) 0', position: 'relative', zIndex: 1 }}>
        <div style={{ position: 'relative' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(clamp(150px,42vw,260px),1fr))', gap: 'clamp(12px,3vw,20px)', filter: !user ? 'blur(6px)' : 'none', pointerEvents: !user ? 'none' : 'auto', userSelect: !user ? 'none' : 'auto', transition: 'filter .3s' }}>
          {FRANCHISE_LIST.map((f, index) => {
            const posterPath = FRANCHISE_COVER_POSTERS[f.id];
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
                    ? <img src={posterUrl(posterPath, 'w342')!} alt={f.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading={index < 4 ? 'eager' : 'lazy'} decoding="async" />
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
