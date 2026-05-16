import { useEffect, useState, useCallback } from 'react';
import { Film } from 'lucide-react';
import { tmdb } from '../lib/tmdb';
import type { TMDBMedia, TMDBGenre } from '../lib/tmdb';
import { PosterGrid, PageHeader, FilterPill, ScrollableRow, FullRowGrid, getGridCols } from './FilmsPage';

const DECADES = [2020,2010,2000,1990,1980,1970,1960,1950];
const SORT_OPTIONS = [
  { value: 'popularity.desc',    label: 'Most Popular' },
  { value: 'vote_average.desc',  label: 'Highest Rated' },
  { value: 'first_air_date.desc', label: 'Newest First' },
  { value: 'first_air_date.asc',  label: 'Oldest First' },
];

interface TVShowsPageProps {
  onMediaClick: (id: number, type: 'movie' | 'tv') => void;
}

export default function TVShowsPage({ onMediaClick }: TVShowsPageProps) {
  const [genres,         setGenres]         = useState<TMDBGenre[]>([]);
  const [items,          setItems]          = useState<TMDBMedia[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [loadingMore,    setLoadingMore]    = useState(false);
  const [page,           setPage]           = useState(1);
  const [totalPages,     setTotalPages]     = useState(1);
  const [gridCols,       setGridCols]       = useState(getGridCols);

  const [sortBy,         setSortBy]         = useState('popularity.desc');
  const [selectedGenre,  setSelectedGenre]  = useState<number | null>(null);
  const [selectedDecade, setSelectedDecade] = useState<number | null>(null);

  useEffect(() => {
    const handle = () => setGridCols(getGridCols());
    window.addEventListener('resize', handle);
    return () => window.removeEventListener('resize', handle);
  }, []);

  useEffect(() => {
    tmdb.genres('tv').then(d => setGenres(d.genres));
  }, []);

  const fetchPage = useCallback(async (pg: number, reset: boolean) => {
    if (reset) setLoading(true); else setLoadingMore(true);
    const params: Record<string, string> = { sort_by: sortBy, page: String(pg), 'vote_count.gte': '20' };
    if (selectedGenre) params.with_genres = String(selectedGenre);
    if (selectedDecade !== null) {
      params['first_air_date.gte'] = `${selectedDecade}-01-01`;
      params['first_air_date.lte'] = `${selectedDecade + 9}-12-31`;
    }
    const data = await tmdb.discover('tv', params);
    if (reset) setItems(data.results);
    else setItems(prev => [...prev, ...data.results]);
    setTotalPages(data.total_pages);
    setPage(pg);
    if (reset) setLoading(false); else setLoadingMore(false);
  }, [sortBy, selectedGenre, selectedDecade]);

  useEffect(() => { fetchPage(1, true); }, [fetchPage]);

  return (
    <div style={{ minHeight: '100vh', background: '#000', paddingBottom: 80 }}>
      <PageHeader title="TV Shows" subtitle="Discover the best television ever made" />

      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '0 clamp(16px,3vw,32px)' }}>
        {/* Filters */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16, paddingTop: 28 }}>
          <select value={sortBy} onChange={e => setSortBy(e.target.value)}
            style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: 8, padding: '7px 12px', color: '#ccc', fontSize: 13, outline: 'none', cursor: 'pointer', fontFamily: 'inherit', colorScheme: 'dark', flexShrink: 0 }}>
            {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <ScrollableRow style={{ flex: 1, minWidth: 0 }}>
            <FilterPill label="All Genres" active={selectedGenre === null} onClick={() => setSelectedGenre(null)} />
            {genres.map(g => (
              <FilterPill key={g.id} label={g.name} active={selectedGenre === g.id} onClick={() => setSelectedGenre(selectedGenre === g.id ? null : g.id)} />
            ))}
          </ScrollableRow>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 28 }}>
          <FilterPill label="All Decades" active={selectedDecade === null} onClick={() => setSelectedDecade(null)} />
          {DECADES.map(d => (
            <FilterPill key={d} label={`${d}s`} active={selectedDecade === d} onClick={() => setSelectedDecade(selectedDecade === d ? null : d)} />
          ))}
        </div>

        {loading ? (
          <PosterGrid count={gridCols * 3} />
        ) : items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <Film size={48} color="#2e2e2e" style={{ margin: '0 auto 12px' }} />
            <p style={{ color: '#555', fontSize: 14 }}>No results found</p>
          </div>
        ) : (
          <FullRowGrid items={items} gridCols={gridCols} mediaType="tv" onMediaClick={onMediaClick} page={page} totalPages={totalPages} loadingMore={loadingMore} onLoadMore={() => fetchPage(page + 1, false)} />
        )}
      </div>
    </div>
  );
}
