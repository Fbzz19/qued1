import { useEffect, useState } from 'react';
import { ArrowLeft, Film, Star, SlidersHorizontal, LayoutGrid, List } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { WatchedEntry } from '../lib/supabase';
import { posterUrl } from '../lib/tmdb';
import { useI18n } from '../context/I18nContext';

interface DiaryPageProps {
  userId: string;
  username?: string;
  onBack: () => void;
  onMediaClick: (id: number, type: 'movie' | 'tv') => void;
}

interface DiaryEntry extends WatchedEntry {
  rating?: number;
  reviewContent?: string;
}

type DiarySort = 'recent' | 'highest' | 'month';
type DiaryView = 'list' | 'grid';

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatMonth(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function groupByMonth(entries: DiaryEntry[]): Map<string, DiaryEntry[]> {
  const map = new Map<string, DiaryEntry[]>();
  for (const e of entries) {
    const key = formatMonth(e.watched_date);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(e);
  }
  return map;
}

function StarDisplay({ rating }: { rating?: number }) {
  if (rating == null) return null;
  return (
    <div style={{ display: 'flex', gap: 1.5, justifyContent: 'center', flexWrap: 'nowrap' }}>
      {Array.from({ length: 5 }).map((_, i) => {
        const full = i + 1 <= Math.floor(rating);
        const half = !full && i + 0.5 <= rating;
        const c = full || half ? '#f59e0b' : '#2e2e2e';
        return <Star key={i} size={9} color={c} fill={c} />;
      })}
    </div>
  );
}

export default function DiaryPage({ userId, username, onBack, onMediaClick }: DiaryPageProps) {
  const { t } = useI18n();
  const [entries,  setEntries]  = useState<DiaryEntry[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [sort,     setSort]     = useState<DiarySort>('recent');
  const [showSort, setShowSort] = useState(false);
  const [view,     setView]     = useState<DiaryView>(() => {
    try { return (localStorage.getItem('diary_view') as DiaryView) || 'list'; }
    catch { return 'list'; }
  });

  function setViewPref(v: DiaryView) {
    setView(v);
    try { localStorage.setItem('diary_view', v); } catch { /* ignore */ }
  }

  useEffect(() => {
    async function load() {
      const [{ data: w }, { data: r }, { data: rev }] = await Promise.all([
        supabase.from('watched').select('*').eq('user_id', userId).order('watched_date', { ascending: false }),
        supabase.from('ratings').select('tmdb_id, media_type, rating').eq('user_id', userId),
        supabase.from('reviews').select('tmdb_id, media_type, content, rating').eq('user_id', userId).eq('is_public', true),
      ]);

      const ratingMap: Record<string, number> = {};
      (r ?? []).forEach((row: { tmdb_id: number; media_type: string; rating: number }) => {
        ratingMap[`${row.tmdb_id}-${row.media_type}`] = row.rating;
      });

      const reviewMap: Record<string, { content: string; rating?: number }> = {};
      (rev ?? []).forEach((row: { tmdb_id: number; media_type: string; content: string; rating?: number }) => {
        reviewMap[`${row.tmdb_id}-${row.media_type}`] = { content: row.content, rating: row.rating ?? undefined };
      });

      const merged: DiaryEntry[] = (w ?? []).map((entry: WatchedEntry) => {
        const key = `${entry.tmdb_id}-${entry.media_type}`;
        return {
          ...entry,
          rating: ratingMap[key] ?? reviewMap[key]?.rating,
          reviewContent: reviewMap[key]?.content,
        };
      });

      setEntries(merged);
      setLoading(false);
    }
    load();
  }, [userId]);

  const sorted = [...entries].sort((a, b) => {
    if (sort === 'highest') return (b.rating ?? 0) - (a.rating ?? 0);
    return 0;
  });

  const SORT_LABELS: Record<DiarySort, string> = {
    recent:  'Most Recent',
    highest: 'Highest Rated',
    month:   'By Month',
  };

  const byMonth = sort === 'month' ? groupByMonth(sorted) : null;

  return (
    <div style={{ minHeight: '100vh', background: '#000', paddingBottom: 96 }} className="animate-fade-in">
      {/* Header */}
      <div style={{ position: 'sticky', top: 56, zIndex: 10, background: 'rgba(0,0,0,.92)', backdropFilter: 'blur(8px)', borderBottom: '1px solid #1a1a1a', padding: '14px clamp(16px,4vw,48px)' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={onBack}
            style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontFamily: 'inherit', transition: 'color .2s', flexShrink: 0 }}
            onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
            onMouseLeave={e => (e.currentTarget.style.color = '#888')}>
            <ArrowLeft size={16} />
          </button>
          <h1 style={{ margin: 0, color: '#fff', fontSize: 17, fontWeight: 700, flex: 1 }}>
            {username ? `${username}'s Diary` : t('diary_title')}
            {!loading && <span style={{ color: '#555', fontSize: 13, fontWeight: 400, marginLeft: 8 }}>({entries.length})</span>}
          </h1>

          {/* View toggle */}
          <div style={{ display: 'flex', background: '#111', border: '1px solid #2e2e2e', borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
            {(['list', 'grid'] as DiaryView[]).map(v => (
              <button key={v} onClick={() => setViewPref(v)}
                style={{ width: 34, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s',
                  background: view === v ? '#f59e0b' : 'transparent',
                  color: view === v ? '#000' : '#555',
                }}>
                {v === 'list' ? <List size={14} /> : <LayoutGrid size={14} />}
              </button>
            ))}
          </div>

          {/* Sort */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <button onClick={() => setShowSort(s => !s)}
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 14px', background: '#111', border: '1px solid #2e2e2e', borderRadius: 10, cursor: 'pointer', fontSize: 12, color: '#ccc', fontFamily: 'inherit', transition: 'border-color .2s' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = '#f59e0b')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = '#2e2e2e')}>
              <SlidersHorizontal size={13} />
              {SORT_LABELS[sort]}
            </button>
            {showSort && (
              <div className="animate-slide-down" style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: 12, overflow: 'hidden', minWidth: 160, zIndex: 20 }}>
                {(Object.entries(SORT_LABELS) as [DiarySort, string][]).map(([key, label]) => (
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
      </div>

      <div style={{ maxWidth: view === 'grid' ? 1100 : 900, margin: '0 auto', padding: '24px clamp(16px,4vw,48px) 0' }}>
        {loading ? (
          view === 'grid' ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
              {Array.from({ length: 15 }).map((_, i) => (
                <div key={i}>
                  <div className="shimmer" style={{ aspectRatio: '2/3', borderRadius: 8, marginBottom: 8 }} />
                  <div className="shimmer" style={{ height: 10, width: '80%', borderRadius: 4, margin: '0 auto' }} />
                </div>
              ))}
            </div>
          ) : (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} style={{ display: 'flex', gap: 14, padding: '14px 0', borderBottom: '1px solid #1a1a1a' }}>
                <div className="shimmer" style={{ width: 56, height: 84, borderRadius: 8, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div className="shimmer" style={{ height: 16, width: '60%', borderRadius: 4, marginBottom: 8 }} />
                  <div className="shimmer" style={{ height: 12, width: '40%', borderRadius: 4, marginBottom: 8 }} />
                  <div className="shimmer" style={{ height: 12, width: '80%', borderRadius: 4 }} />
                </div>
              </div>
            ))
          )
        ) : sorted.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <Film size={36} color="#2e2e2e" style={{ margin: '0 auto 12px', display: 'block' }} />
            <p style={{ margin: 0, color: '#555', fontSize: 14 }}>No diary entries yet.</p>
          </div>
        ) : view === 'grid' ? (
          <GridView entries={byMonth ? Array.from(byMonth.values()).flat() : sorted} onMediaClick={onMediaClick} byMonth={byMonth} />
        ) : byMonth ? (
          Array.from(byMonth.entries()).map(([month, items]) => (
            <div key={month} style={{ marginBottom: 32 }}>
              <h2 style={{ margin: '0 0 14px', color: '#888', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.12em' }}>{month}</h2>
              {items.map(entry => <DiaryRow key={entry.id} entry={entry} onMediaClick={onMediaClick} />)}
            </div>
          ))
        ) : (
          sorted.map(entry => <DiaryRow key={entry.id} entry={entry} onMediaClick={onMediaClick} />)
        )}
      </div>
    </div>
  );
}

function GridView({ entries, onMediaClick, byMonth }: { entries: DiaryEntry[]; onMediaClick: (id: number, type: 'movie' | 'tv') => void; byMonth: Map<string, DiaryEntry[]> | null }) {
  if (byMonth) {
    return (
      <>
        {Array.from(byMonth.entries()).map(([month, items]) => (
          <div key={month} style={{ marginBottom: 36 }}>
            <h2 style={{ margin: '0 0 14px', color: '#888', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.12em' }}>{month}</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
              {items.map(entry => <GridPoster key={entry.id} entry={entry} onMediaClick={onMediaClick} />)}
            </div>
          </div>
        ))}
      </>
    );
  }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
      {entries.map(entry => <GridPoster key={entry.id} entry={entry} onMediaClick={onMediaClick} />)}
    </div>
  );
}

function GridPoster({ entry, onMediaClick }: { entry: DiaryEntry; onMediaClick: (id: number, type: 'movie' | 'tv') => void }) {
  const ps = posterUrl(entry.poster_path, 'w185');
  return (
    <div
      onClick={() => onMediaClick(entry.tmdb_id, entry.media_type)}
      style={{ cursor: 'pointer' }}
    >
      <div className="poster-card" style={{ aspectRatio: '2/3', width: '100%', marginBottom: 7, borderRadius: 8, overflow: 'hidden', background: '#1a1a1a' }}>
        {ps
          ? <img src={ps} alt={entry.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
          : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Film size={14} color="#555" /></div>}
      </div>
      {entry.rating != null ? (
        <StarDisplay rating={entry.rating} />
      ) : (
        <div style={{ height: 12 }} />
      )}
    </div>
  );
}

function DiaryRow({ entry, onMediaClick }: { entry: DiaryEntry; onMediaClick: (id: number, type: 'movie' | 'tv') => void }) {
  const ps = posterUrl(entry.poster_path, 'w92');
  const snippet = entry.reviewContent ? entry.reviewContent.slice(0, 120) + (entry.reviewContent.length > 120 ? '...' : '') : null;

  return (
    <div
      onClick={() => onMediaClick(entry.tmdb_id, entry.media_type)}
      style={{ display: 'flex', gap: 14, padding: '14px 0', borderBottom: '1px solid #111', cursor: 'pointer', transition: 'background .15s', borderRadius: 4 }}
      onMouseEnter={e => (e.currentTarget.style.background = '#0a0a0a')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      {/* Poster */}
      <div style={{ width: 52, height: 78, borderRadius: 8, overflow: 'hidden', background: '#1a1a1a', flexShrink: 0, border: '1px solid #2e2e2e' }}>
        {ps
          ? <img src={ps} alt={entry.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
          : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Film size={14} color="#555" /></div>}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 4 }}>
          <p style={{ margin: 0, color: '#fff', fontSize: 15, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.title}</p>
          {entry.rating != null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
              {Array.from({ length: 5 }).map((_, i) => {
                const full = i + 1 <= Math.floor(entry.rating!);
                const half = !full && i + 0.5 <= entry.rating!;
                const c = full || half ? '#f59e0b' : '#2e2e2e';
                return <Star key={i} size={11} color={c} fill={c} />;
              })}
              <span style={{ fontSize: 11, color: '#f59e0b', fontWeight: 700, marginLeft: 2 }}>{entry.rating}</span>
            </div>
          )}
        </div>
        <p style={{ margin: '0 0 6px', color: '#555', fontSize: 12 }}>{formatDate(entry.watched_date)}</p>
        {snippet && (
          <p style={{ margin: 0, color: '#888', fontSize: 13, lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
            {snippet}
          </p>
        )}
      </div>
    </div>
  );
}
