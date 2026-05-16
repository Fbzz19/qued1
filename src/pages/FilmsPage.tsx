import { useEffect, useRef, useState, useCallback } from 'react';
import { Film, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { tmdb, posterUrl } from '../lib/tmdb';
import type { TMDBMedia, TMDBGenre } from '../lib/tmdb';
import { PosterSkeleton } from '../components/Skeleton';

/** Compute number of columns in an auto-fill grid from viewport width */
export function getGridCols(): number {
  const w = window.innerWidth;
  if (w >= 1400) return 8;
  if (w >= 1200) return 7;
  if (w >= 1000) return 6;
  if (w >= 800)  return 5;
  if (w >= 600)  return 4;
  if (w >= 400)  return 3;
  return 2;
}

/** Trim items array to a multiple of colCount so last row is always full */
export function trimToFullRows(items: TMDBMedia[], colCount: number): TMDBMedia[] {
  const full = Math.floor(items.length / colCount) * colCount;
  return items.slice(0, full);
}

const DECADES = [2020,2010,2000,1990,1980,1970,1960,1950,1940,1930,1920];
const SORT_OPTIONS = [
  { value: 'popularity.desc',     label: 'Most Popular' },
  { value: 'vote_average.desc',   label: 'Highest Rated' },
  { value: 'release_date.desc',   label: 'Newest First' },
  { value: 'release_date.asc',    label: 'Oldest First' },
];

interface FilmsPageProps {
  onMediaClick: (id: number, type: 'movie' | 'tv') => void;
}

export default function FilmsPage({ onMediaClick }: FilmsPageProps) {
  const [genres,        setGenres]        = useState<TMDBGenre[]>([]);
  const [items,         setItems]         = useState<TMDBMedia[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [loadingMore,   setLoadingMore]   = useState(false);
  const [page,          setPage]          = useState(1);
  const [totalPages,    setTotalPages]    = useState(1);
  const [gridCols,      setGridCols]      = useState(getGridCols);

  const [sortBy,        setSortBy]        = useState('popularity.desc');
  const [selectedGenre, setSelectedGenre] = useState<number | null>(null);
  const [selectedDecade, setSelectedDecade] = useState<number | null>(null);

  useEffect(() => {
    const handle = () => setGridCols(getGridCols());
    window.addEventListener('resize', handle);
    return () => window.removeEventListener('resize', handle);
  }, []);

  useEffect(() => {
    tmdb.genres('movie').then(d => setGenres(d.genres));
  }, []);

  const fetchPage = useCallback(async (pg: number, reset: boolean) => {
    if (reset) setLoading(true); else setLoadingMore(true);
    const params: Record<string, string> = { sort_by: sortBy, page: String(pg), 'vote_count.gte': '50' };
    if (selectedGenre) params.with_genres = String(selectedGenre);
    if (selectedDecade !== null) {
      params['primary_release_date.gte'] = `${selectedDecade}-01-01`;
      params['primary_release_date.lte'] = `${selectedDecade + 9}-12-31`;
    }
    const data = await tmdb.discover('movie', params);
    if (reset) setItems(data.results);
    else setItems(prev => [...prev, ...data.results]);
    setTotalPages(data.total_pages);
    setPage(pg);
    if (reset) setLoading(false); else setLoadingMore(false);
  }, [sortBy, selectedGenre, selectedDecade]);

  useEffect(() => { fetchPage(1, true); }, [fetchPage]);

  return (
    <div style={{ minHeight: '100vh', background: '#000', paddingBottom: 80 }}>
      <PageHeader title="Films" subtitle="Browse the world's greatest cinema" />

      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '0 clamp(16px,3vw,32px)' }}>
        {/* Filters */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 24, paddingTop: 28, alignItems: 'center' }}>
          {/* Sort */}
          <FilterSelect
            value={sortBy}
            onChange={v => { setSortBy(v); setSelectedDecade(null); }}
            options={SORT_OPTIONS}
          />

          {/* Genre pills */}
          <ScrollableRow style={{ flex: 1, minWidth: 0 }}>
            <FilterPill label="All Genres" active={selectedGenre === null} onClick={() => setSelectedGenre(null)} />
            {genres.map(g => (
              <FilterPill key={g.id} label={g.name} active={selectedGenre === g.id} onClick={() => setSelectedGenre(selectedGenre === g.id ? null : g.id)} />
            ))}
          </ScrollableRow>
        </div>

        {/* Decade row */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 28 }}>
          <FilterPill label="All Decades" active={selectedDecade === null} onClick={() => setSelectedDecade(null)} />
          {DECADES.map(d => (
            <FilterPill key={d} label={`${d}s`} active={selectedDecade === d} onClick={() => setSelectedDecade(selectedDecade === d ? null : d)} />
          ))}
        </div>

        {/* Grid */}
        {loading ? (
          <PosterGrid count={gridCols * 3} />
        ) : items.length === 0 ? (
          <EmptyState />
        ) : (
          <FullRowGrid items={items} gridCols={gridCols} mediaType="movie" onMediaClick={onMediaClick} page={page} totalPages={totalPages} loadingMore={loadingMore} onLoadMore={() => fetchPage(page + 1, false)} />
        )}
      </div>
    </div>
  );
}

export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ borderBottom: '1px solid #1a1a1a', padding: 'clamp(24px,4vw,40px) clamp(16px,3vw,32px) 20px', maxWidth: 1400, margin: '0 auto' }}>
      <h1 style={{ margin: 0, color: '#fff', fontSize: 'clamp(24px,3vw,36px)', fontWeight: 700, letterSpacing: '-0.5px' }}>{title}</h1>
      {subtitle && <p style={{ margin: '6px 0 0', color: '#555', fontSize: 14 }}>{subtitle}</p>}
    </div>
  );
}

export function PosterCard({ item, mediaType, onClick }: { item: TMDBMedia; mediaType: 'movie' | 'tv'; onClick: (id: number, t: 'movie' | 'tv') => void }) {
  const url   = posterUrl(item.poster_path);
  const title = item.title || item.name || '';
  const year  = (item.release_date || item.first_air_date || '').slice(0, 4);
  const type  = (item.media_type as 'movie' | 'tv') ?? mediaType;
  return (
    <div onClick={() => onClick(item.id, type)} style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div className="poster-card" style={{ aspectRatio: '2/3', borderRadius: 10 }}>
        {url
          ? <img src={url} alt={title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
          : <div style={{ width: '100%', height: '100%', background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Film size={24} color="#555" /></div>}
      </div>
      <div>
        <p style={{ margin: 0, color: '#e0e0e0', fontSize: 12, fontWeight: 500, lineHeight: 1.3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{title}</p>
        {year && <p style={{ margin: '2px 0 0', color: '#555', fontSize: 11 }}>{year}</p>}
      </div>
    </div>
  );
}

export function PosterGrid({ count }: { count: number }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(clamp(130px,13vw,180px), 1fr))', gap: 16 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i}>
          <PosterSkeleton />
          <div className="shimmer" style={{ height: 14, borderRadius: 4, marginTop: 8, width: '80%' }} />
        </div>
      ))}
    </div>
  );
}

export function FullRowGrid({ items, gridCols, mediaType, onMediaClick, page, totalPages, loadingMore, onLoadMore }: {
  items: TMDBMedia[];
  gridCols: number;
  mediaType: 'movie' | 'tv';
  onMediaClick: (id: number, t: 'movie' | 'tv') => void;
  page: number;
  totalPages: number;
  loadingMore: boolean;
  onLoadMore: () => void;
}) {
  const visible = trimToFullRows(items, gridCols);
  const hasMore = page < totalPages || visible.length < items.length;
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${gridCols}, 1fr)`, gap: 16 }}>
        {visible.map(item => (
          <PosterCard key={item.id} item={item} mediaType={mediaType} onClick={onMediaClick} />
        ))}
      </div>
      {hasMore && (
        <div style={{ textAlign: 'center', marginTop: 40 }}>
          <button onClick={onLoadMore} disabled={loadingMore} className="btn-ghost" style={{ padding: '12px 32px', fontSize: 14 }}>
            {loadingMore ? 'Loading...' : <><ChevronDown size={16} style={{ marginRight: 6 }} />Load More</>}
          </button>
        </div>
      )}
    </>
  );
}

function EmptyState() {
  return (
    <div style={{ textAlign: 'center', padding: '80px 0' }}>
      <Film size={48} color="#2e2e2e" style={{ margin: '0 auto 12px' }} />
      <p style={{ color: '#555', fontSize: 14 }}>No results found</p>
    </div>
  );
}

function FilterSelect({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: 8, padding: '7px 12px', color: '#ccc', fontSize: 13, outline: 'none', cursor: 'pointer', fontFamily: 'inherit', colorScheme: 'dark' }}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

export function ScrollableRow({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);
  const scroll = (dir: -1 | 1) => {
    ref.current?.scrollBy({ left: dir * 220, behavior: 'smooth' });
  };
  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 4, minWidth: 0, overflow: 'hidden', ...style }}>
      <button
        onClick={() => scroll(-1)}
        style={{ flexShrink: 0, width: 28, height: 28, borderRadius: 8, border: '1px solid #2e2e2e', background: '#111', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', transition: 'all .18s' }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#f59e0b'; (e.currentTarget as HTMLButtonElement).style.color = '#fbbf24'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#2e2e2e'; (e.currentTarget as HTMLButtonElement).style.color = '#888'; }}
      >
        <ChevronLeft size={14} />
      </button>
      <div ref={ref} className="no-scrollbar" style={{ display: 'flex', gap: 6, overflowX: 'auto', flex: 1 }}>
        {children}
      </div>
      <button
        onClick={() => scroll(1)}
        style={{ flexShrink: 0, width: 28, height: 28, borderRadius: 8, border: '1px solid #2e2e2e', background: '#111', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', transition: 'all .18s' }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#f59e0b'; (e.currentTarget as HTMLButtonElement).style.color = '#fbbf24'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#2e2e2e'; (e.currentTarget as HTMLButtonElement).style.color = '#888'; }}
      >
        <ChevronRight size={14} />
      </button>
    </div>
  );
}

export function FilterPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      style={{ flexShrink: 0, padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500, transition: 'all .18s', fontFamily: 'inherit', whiteSpace: 'nowrap',
        background: active ? '#f59e0b' : '#1a1a1a', color: active ? '#000' : '#888' }}
      onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLButtonElement).style.background = '#242424'; (e.currentTarget as HTMLButtonElement).style.color = '#ccc'; } }}
      onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLButtonElement).style.background = '#1a1a1a'; (e.currentTarget as HTMLButtonElement).style.color = '#888'; } }}>
      {label}
    </button>
  );
}
