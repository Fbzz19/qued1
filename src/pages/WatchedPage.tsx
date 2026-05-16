import { useEffect, useState } from 'react';
import { ArrowLeft, Film, Search, Star, SlidersHorizontal } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { WatchedEntry } from '../lib/supabase';
import { posterUrl } from '../lib/tmdb';
import { useI18n } from '../context/I18nContext';

interface WatchedPageProps {
  userId: string;
  username?: string;
  onBack: () => void;
  onMediaClick: (id: number, type: 'movie' | 'tv') => void;
}

type SortOption = 'recent' | 'highest' | 'lowest' | 'az' | 'year' | 'genre';

interface RatingMap { [key: string]: number }

export default function WatchedPage({ userId, username, onBack, onMediaClick }: WatchedPageProps) {
  const { t } = useI18n();
  const [entries,   setEntries]   = useState<WatchedEntry[]>([]);
  const [ratings,   setRatings]   = useState<RatingMap>({});
  const [loading,   setLoading]   = useState(true);
  const [sort,      setSort]      = useState<SortOption>('recent');
  const [filter,    setFilter]    = useState<'all' | 'movie' | 'tv'>('all');
  const [search,    setSearch]    = useState('');
  const [showSort,  setShowSort]  = useState(false);

  useEffect(() => {
    async function load() {
      const [{ data: w }, { data: r }] = await Promise.all([
        supabase.from('watched').select('*').eq('user_id', userId).order('watched_date', { ascending: false }),
        supabase.from('ratings').select('tmdb_id, media_type, rating').eq('user_id', userId),
      ]);
      setEntries((w ?? []) as WatchedEntry[]);
      const map: RatingMap = {};
      (r ?? []).forEach((row: { tmdb_id: number; media_type: string; rating: number }) => {
        map[`${row.tmdb_id}-${row.media_type}`] = row.rating;
      });
      setRatings(map);
      setLoading(false);
    }
    load();
  }, [userId]);

  const filtered = entries
    .filter(e => filter === 'all' || e.media_type === filter)
    .filter(e => !search || e.title.toLowerCase().includes(search.toLowerCase()));

  const sorted = [...filtered].sort((a, b) => {
    const rA = ratings[`${a.tmdb_id}-${a.media_type}`] ?? 0;
    const rB = ratings[`${b.tmdb_id}-${b.media_type}`] ?? 0;
    if (sort === 'highest') return rB - rA;
    if (sort === 'lowest')  return rA - rB;
    if (sort === 'az')      return a.title.localeCompare(b.title);
    if (sort === 'year')    return b.watched_date.localeCompare(a.watched_date);
    return 0; // recent: already ordered by watched_date desc
  });

  const SORT_LABELS: Record<SortOption, string> = {
    recent:  'Most Recent',
    highest: 'Highest Rated',
    lowest:  'Lowest Rated',
    az:      'A to Z',
    year:    'By Year',
    genre:   'By Genre',
  };

  return (
    <div style={{ minHeight: '100vh', background: '#000', paddingBottom: 96 }} className="animate-fade-in">
      {/* Header */}
      <div style={{ position: 'sticky', top: 56, zIndex: 10, background: 'rgba(0,0,0,.92)', backdropFilter: 'blur(8px)', borderBottom: '1px solid #1a1a1a', padding: '14px clamp(16px,4vw,48px)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 16 }}>
          <button onClick={onBack}
            style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontFamily: 'inherit', transition: 'color .2s', flexShrink: 0 }}
            onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
            onMouseLeave={e => (e.currentTarget.style.color = '#888')}>
            <ArrowLeft size={16} />
          </button>
          <h1 style={{ margin: 0, color: '#fff', fontSize: 17, fontWeight: 700, flex: 1 }}>
            {username ? `${username}'s Films` : t('watched_title')}
            {!loading && <span style={{ color: '#555', fontSize: 13, fontWeight: 400, marginLeft: 8 }}>({sorted.length})</span>}
          </h1>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px clamp(16px,4vw,48px) 0' }}>
        {/* Controls */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Search */}
          <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
            <Search size={13} color="#555" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search..."
              style={{ width: '100%', background: '#111', border: '1px solid #2e2e2e', borderRadius: 10, padding: '9px 12px 9px 32px', color: '#fff', fontSize: 13, outline: 'none', fontFamily: 'inherit', transition: 'border-color .2s' }}
              onFocus={e => (e.target.style.borderColor = '#f59e0b')}
              onBlur={e => (e.target.style.borderColor = '#2e2e2e')}
            />
          </div>

          {/* Filter type */}
          <div style={{ display: 'flex', background: '#111', borderRadius: 10, padding: 3, gap: 3 }}>
            {(['all', 'movie', 'tv'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                style={{ padding: '7px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500, fontFamily: 'inherit', transition: 'all .2s',
                  background: filter === f ? '#f59e0b' : 'transparent', color: filter === f ? '#000' : '#888' }}>
                {f === 'all' ? 'All' : f === 'movie' ? 'Films' : 'Shows'}
              </button>
            ))}
          </div>

          {/* Sort */}
          <div style={{ position: 'relative' }}>
            <button onClick={() => setShowSort(s => !s)}
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 14px', background: '#111', border: '1px solid #2e2e2e', borderRadius: 10, cursor: 'pointer', fontSize: 12, color: '#ccc', fontFamily: 'inherit', transition: 'border-color .2s' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = '#f59e0b')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = '#2e2e2e')}>
              <SlidersHorizontal size={13} />
              {SORT_LABELS[sort]}
            </button>
            {showSort && (
              <div className="animate-slide-down" style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: 12, overflow: 'hidden', minWidth: 160, zIndex: 20 }}>
                {(Object.entries(SORT_LABELS) as [SortOption, string][]).map(([key, label]) => (
                  <button key={key} onClick={() => { setSort(key); setShowSort(false); }}
                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 16px', background: sort === key ? 'rgba(245,158,11,.1)' : 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: sort === key ? '#f59e0b' : '#ccc', fontFamily: 'inherit', transition: 'background .15s' }}
                    onMouseEnter={e => { if (sort !== key) e.currentTarget.style.background = '#242424'; }}
                    onMouseLeave={e => { if (sort !== key) e.currentTarget.style.background = 'none'; }}>
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Grid */}
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(clamp(80px,10vw,120px), 1fr))', gap: 10 }}>
            {Array.from({ length: 24 }).map((_, i) => (
              <div key={i} className="shimmer" style={{ aspectRatio: '2/3', borderRadius: 8 }} />
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <Film size={36} color="#2e2e2e" style={{ margin: '0 auto 12px', display: 'block' }} />
            <p style={{ margin: 0, color: '#555', fontSize: 14 }}>Nothing here yet.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(clamp(80px,10vw,120px), 1fr))', gap: 10 }}>
            {sorted.map(item => {
              const ps = posterUrl(item.poster_path);
              const rating = ratings[`${item.tmdb_id}-${item.media_type}`];
              return (
                <div key={item.id} className="poster-card" style={{ aspectRatio: '2/3' }} onClick={() => onMediaClick(item.tmdb_id, item.media_type)}>
                  {ps
                    ? <img src={ps} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                    : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Film size={14} color="#555" /></div>}
                  {rating != null && (
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(to top, rgba(0,0,0,.9) 0%, transparent 100%)', padding: '12px 5px 5px', display: 'flex', alignItems: 'center', gap: 3 }}>
                      <Star size={9} color="#f59e0b" fill="#f59e0b" />
                      <span style={{ fontSize: 10, color: '#fbbf24', fontWeight: 700 }}>{rating}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
