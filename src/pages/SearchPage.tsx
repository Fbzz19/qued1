import { useState, useEffect, useCallback } from 'react';
import { Search, X, Film, ChevronDown, ChevronUp } from 'lucide-react';
import { tmdb, posterUrl } from '../lib/tmdb';
import type { TMDBMedia } from '../lib/tmdb';
import { PosterSkeleton } from '../components/Skeleton';
import { useI18n } from '../context/I18nContext';

const DECADES = [1920,1930,1940,1950,1960,1970,1980,1990,2000,2010,2020];

interface SearchPageProps {
  onMediaClick: (id: number, type: 'movie' | 'tv') => void;
}

export default function SearchPage({ onMediaClick }: SearchPageProps) {
  const { t } = useI18n();
  const [query,    setQuery]    = useState('');
  const [results,  setResults]  = useState<TMDBMedia[]>([]);
  const [busy,     setBusy]     = useState(false);
  const [popular,  setPopular]  = useState<TMDBMedia[]>([]);
  const [topRated, setTopRated] = useState<TMDBMedia[]>([]);
  const [upcoming, setUpcoming] = useState<TMDBMedia[]>([]);
  const [decade,   setDecade]   = useState<number | null>(null);
  const [decadeItems, setDecadeItems] = useState<TMDBMedia[]>([]);
  const [decadeLoading, setDecadeLoading] = useState(false);
  const [sectionLoading, setSectionLoading] = useState(true);

  // "View More" expanded state per section key
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  // Full 50 items cache per section key
  const [fullItems, setFullItems] = useState<Record<string, TMDBMedia[]>>({});
  const [fullLoading, setFullLoading] = useState<Record<string, boolean>>({});

  useEffect(() => {
    Promise.all([
      tmdb.popular('movie'),
      tmdb.topRated('movie'),
      tmdb.upcoming(),
    ]).then(([p, t, u]) => {
      setPopular(p.results.slice(0, 10));
      setTopRated(t.results.slice(0, 10));
      setUpcoming(u.results.slice(0, 10));
      setSectionLoading(false);
    });
  }, []);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return; }
    setBusy(true);
    const data = await tmdb.search(q);
    setResults(data.results.filter(r => r.media_type === 'movie' || r.media_type === 'tv'));
    setBusy(false);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => doSearch(query), 400);
    return () => clearTimeout(t);
  }, [query, doSearch]);

  async function pickDecade(d: number) {
    if (decade === d) { setDecade(null); setDecadeItems([]); return; }
    setDecade(d);
    setDecadeLoading(true);
    const pages = await Promise.all([
      tmdb.byDecade('movie', d, 1),
      tmdb.byDecade('movie', d, 2),
      tmdb.byDecade('movie', d, 3),
      tmdb.byDecade('movie', d, 4),
      tmdb.byDecade('movie', d, 5),
    ]);
    const all = pages.flatMap(p => p.results).slice(0, 50);
    setDecadeItems(all);
    setDecadeLoading(false);
    setExpanded(prev => ({ ...prev, [`decade-${d}`]: false }));
  }

  async function handleViewMore(key: string, loader: () => Promise<TMDBMedia[]>) {
    if (expanded[key]) { setExpanded(prev => ({ ...prev, [key]: false })); return; }
    if (!fullItems[key]) {
      setFullLoading(prev => ({ ...prev, [key]: true }));
      const items = await loader();
      setFullItems(prev => ({ ...prev, [key]: items }));
      setFullLoading(prev => ({ ...prev, [key]: false }));
    }
    setExpanded(prev => ({ ...prev, [key]: true }));
  }

  const showSearch = query.trim().length > 0;

  return (
    <div style={{ minHeight: '100vh', background: '#000', paddingBottom: 96 }} className="animate-fade-in">
      {/* Sticky search bar */}
      <div style={{ position: 'sticky', top: 0, zIndex: 10, background: 'rgba(0,0,0,.95)', backdropFilter: 'blur(8px)', padding: '12px clamp(16px,4vw,48px)', borderBottom: '1px solid #1a1a1a' }}>
        <div style={{ position: 'relative', maxWidth: 640 }}>
          <Search size={16} color="#888" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text" value={query} onChange={e => setQuery(e.target.value)}
            placeholder={t('search_placeholder')}
            style={{ width: '100%', background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: 14, padding: '12px 40px 12px 38px', color: '#fff', fontSize: 14, outline: 'none', fontFamily: 'inherit' }}
            onFocus={e => (e.target.style.borderColor = '#f59e0b')}
            onBlur={e  => (e.target.style.borderColor = '#2e2e2e')}
          />
          {query && (
            <button onClick={() => { setQuery(''); setResults([]); }}
              style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}>
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {showSearch ? (
        <div style={{ padding: '16px clamp(16px,4vw,48px) 0' }}>
          {busy ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px,1fr))', gap: 10 }}>
              {Array.from({ length: 9 }).map((_, i) => <PosterSkeleton key={i} />)}
            </div>
          ) : results.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '64px 0' }}>
              <Film size={40} color="#2e2e2e" style={{ margin: '0 auto 12px' }} />
              <p style={{ color: '#888', fontSize: 14 }}>{t('search_no_results')}</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px,1fr))', gap: 10 }}>
              {results.map(item => {
                const type  = (item.media_type as 'movie' | 'tv') ?? 'movie';
                const url   = posterUrl(item.poster_path);
                const title = item.title || item.name || '';
                return (
                  <div key={item.id} className="poster-card" style={{ aspectRatio: '2/3' }} onClick={() => onMediaClick(item.id, type)}>
                    {url
                      ? <img src={url} alt={title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                      : <NoImg title={title} />}
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(to top,rgba(0,0,0,.9),transparent)', padding: '16px 6px 6px' }}>
                      <p style={{ margin: 0, color: '#fff', fontSize: 10, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div style={{ padding: '20px clamp(16px,4vw,48px) 0' }}>
          {/* Decade picker */}
          <SectionHeader title="Browse by Decade" />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
            {DECADES.map(d => (
              <button key={d} onClick={() => pickDecade(d)}
                style={{ padding: '6px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer', transition: 'all .2s', border: 'none',
                  background: decade === d ? '#f59e0b' : '#1a1a1a', color: decade === d ? '#000' : '#ccc' }}>
                {d}s
              </button>
            ))}
          </div>

          {decade !== null && (
            <div style={{ marginBottom: 24 }}>
              {decadeLoading ? (
                <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }} className="no-scrollbar">
                  {Array.from({ length: 10 }).map((_, i) => <div key={i} style={{ flexShrink: 0, width: 96 }}><PosterSkeleton /></div>)}
                </div>
              ) : (
                <PosterRow
                  items={decadeItems}
                  type="movie"
                  onMediaClick={onMediaClick}
                  sectionKey={`decade-${decade}`}
                  expanded={!!expanded[`decade-${decade}`]}
                  onToggleExpand={() => setExpanded(prev => ({ ...prev, [`decade-${decade}`]: !prev[`decade-${decade}`] }))}
                  showViewMore={decadeItems.length >= 10}
                  viewMoreLoading={false}
                />
              )}
            </div>
          )}

          <BrowseSection
            title="Most Popular"
            preview={popular}
            sectionKey="popular"
            type="movie"
            loading={sectionLoading}
            expanded={!!expanded['popular']}
            fullItems={fullItems['popular']}
            fullLoading={!!fullLoading['popular']}
            onViewMore={() => handleViewMore('popular', async () => {
              const pages = await Promise.all([1,2,3,4,5].map(p => tmdb.popular('movie', String(p))));
              return pages.flatMap(r => r.results).slice(0, 50);
            })}
            onMediaClick={onMediaClick}
          />

          <BrowseSection
            title="Highest Rated"
            preview={topRated}
            sectionKey="toprated"
            type="movie"
            loading={sectionLoading}
            expanded={!!expanded['toprated']}
            fullItems={fullItems['toprated']}
            fullLoading={!!fullLoading['toprated']}
            onViewMore={() => handleViewMore('toprated', async () => {
              const pages = await Promise.all([1,2,3,4,5].map(p => tmdb.topRated('movie', String(p))));
              return pages.flatMap(r => r.results).slice(0, 50);
            })}
            onMediaClick={onMediaClick}
          />

          <BrowseSection
            title="Most Anticipated"
            preview={upcoming}
            sectionKey="upcoming"
            type="movie"
            loading={sectionLoading}
            expanded={!!expanded['upcoming']}
            fullItems={fullItems['upcoming']}
            fullLoading={!!fullLoading['upcoming']}
            onViewMore={() => handleViewMore('upcoming', async () => {
              const pages = await Promise.all([1,2,3,4,5].map(p => tmdb.upcoming(String(p))));
              return pages.flatMap(r => r.results).slice(0, 50);
            })}
            onMediaClick={onMediaClick}
          />
        </div>
      )}
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return <h2 style={{ margin: '0 0 12px', color: '#fff', fontSize: 'clamp(14px,1.5vw,18px)', fontWeight: 600 }}>{title}</h2>;
}

function PosterRow({ items, type, onMediaClick, sectionKey: _key, expanded, onToggleExpand, showViewMore, viewMoreLoading }: {
  items: TMDBMedia[]; type: 'movie' | 'tv'; onMediaClick: (id: number, type: 'movie' | 'tv') => void;
  sectionKey: string; expanded: boolean; onToggleExpand: () => void; showViewMore: boolean; viewMoreLoading: boolean;
}) {
  const displayed = expanded ? items : items.slice(0, 10);

  if (expanded) {
    return (
      <>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(clamp(88px,10vw,140px),1fr))', gap: 'clamp(8px,1vw,12px)', marginBottom: 12 }}>
          {displayed.map(item => <PosterCell key={item.id} item={item} type={type} onMediaClick={onMediaClick} />)}
        </div>
        {showViewMore && (
          <ViewMoreBtn loading={false} expanded={true} onClick={onToggleExpand} />
        )}
      </>
    );
  }

  return (
    <>
      <div className="no-scrollbar" style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
        {displayed.map(item => (
          <div key={item.id} style={{ flexShrink: 0, width: 'clamp(88px,12vw,140px)' }}>
            <PosterCell item={item} type={type} onMediaClick={onMediaClick} />
          </div>
        ))}
      </div>
      {showViewMore && (
        <ViewMoreBtn loading={viewMoreLoading} expanded={false} onClick={onToggleExpand} />
      )}
    </>
  );
}

function BrowseSection({ title, preview, sectionKey, type, loading, expanded, fullItems, fullLoading, onViewMore, onMediaClick }: {
  title: string; preview: TMDBMedia[]; sectionKey: string; type: 'movie' | 'tv'; loading: boolean;
  expanded: boolean; fullItems?: TMDBMedia[]; fullLoading: boolean;
  onViewMore: () => void; onMediaClick: (id: number, type: 'movie' | 'tv') => void;
}) {
  const items = expanded && fullItems ? fullItems : preview;

  return (
    <div style={{ marginBottom: 28 }}>
      <SectionHeader title={title} />
      {loading ? (
        <div className="no-scrollbar" style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
          {Array.from({ length: 6 }).map((_, i) => <div key={i} style={{ flexShrink: 0, width: 96 }}><PosterSkeleton /></div>)}
        </div>
      ) : (
        <PosterRow
          items={items}
          type={type}
          onMediaClick={onMediaClick}
          sectionKey={sectionKey}
          expanded={expanded}
          onToggleExpand={onViewMore}
          showViewMore={true}
          viewMoreLoading={fullLoading}
        />
      )}
    </div>
  );
}

function PosterCell({ item, type, onMediaClick }: { item: TMDBMedia; type: 'movie' | 'tv'; onMediaClick: (id: number, t: 'movie' | 'tv') => void }) {
  const url = posterUrl(item.poster_path);
  return (
    <div className="poster-card" style={{ aspectRatio: '2/3' }} onClick={() => onMediaClick(item.id, (item.media_type as 'movie' | 'tv') ?? type)}>
      {url
        ? <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
        : <NoImg title={item.title || item.name || ''} />}
    </div>
  );
}

function ViewMoreBtn({ loading, expanded, onClick }: { loading: boolean; expanded: boolean; onClick: () => void }) {
  const { t } = useI18n();
  return (
    <button onClick={onClick} disabled={loading}
      style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, background: 'none', border: '1px solid #2e2e2e', borderRadius: 10, padding: '7px 14px', color: '#888', fontSize: 12, cursor: 'pointer', transition: 'all .2s', fontFamily: 'inherit' }}
      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#f59e0b'; (e.currentTarget as HTMLButtonElement).style.color = '#fbbf24'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#2e2e2e'; (e.currentTarget as HTMLButtonElement).style.color = '#888'; }}>
      {loading ? 'Loading...' : expanded ? <><ChevronUp size={13} /> {t('btn_show_less')}</> : <><ChevronDown size={13} /> {t('btn_view_more')}</>}
    </button>
  );
}

function NoImg({ title }: { title: string }) {
  return (
    <div style={{ width: '100%', height: '100%', background: '#1a1a1a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 8, gap: 4 }}>
      <Film size={18} color="#555" />
      <p style={{ margin: 0, color: '#888', fontSize: 9, textAlign: 'center', lineClamp: 2, overflow: 'hidden' }}>{title}</p>
    </div>
  );
}
