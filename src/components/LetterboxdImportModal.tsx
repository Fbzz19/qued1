import { useState, useRef, useCallback } from 'react';
import { X, Upload, Check, TriangleAlert as AlertTriangle, Search, Film, Tv, ChevronDown, ChevronUp, RefreshCw, BookmarkPlus, ArrowLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { posterUrl } from '../lib/tmdb';
import { useAuth } from '../context/AuthContext';

// ─── Shared types ─────────────────────────────────────────────────────────────

type FileKind = 'watched' | 'diary' | 'ratings' | 'reviews' | 'watchlist' | 'unknown';
type MatchStatus = 'matched' | 'unmatched' | 'duplicate';
type Step = 'upload' | 'matching' | 'preview' | 'importing' | 'done';

interface ParsedRow {
  name: string;
  year: string;
  rating: string;
  review: string;
  watchedDate: string;
  tags: string;
}

interface TmdbResult {
  id: number;
  title: string;
  year: string;
  poster: string | null;
  mediaType: 'movie' | 'tv';
}

interface ImportItem {
  key: string;
  row: ParsedRow;
  fileKind: FileKind;
  status: MatchStatus;
  tmdbId: number | null;
  tmdbTitle: string;
  tmdbYear: string;
  tmdbPoster: string | null;
  tmdbMediaType: 'movie' | 'tv';
  // manual search state
  searchOpen: boolean;
  searchQuery: string;
  searchLoading: boolean;
  searchResults: TmdbResult[];
  // post-import result
  importResult?: 'imported' | 'updated' | 'error';
  importError?: string;
}

interface ImportSummary {
  imported: number;
  updated: number;
  duplicateSkipped: number;
  unmatched: number;
  errors: number;
  errorDetails: { title: string; reason: string }[];
}

// ─── CSV parsing ──────────────────────────────────────────────────────────────

function parseCSVLine(line: string): string[] {
  const cols: string[] = [];
  let inQuote = false;
  let cur = '';
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuote = !inQuote;
    } else if (ch === ',' && !inQuote) {
      cols.push(cur.trim()); cur = '';
    } else {
      cur += ch;
    }
  }
  cols.push(cur.trim());
  return cols;
}

function detectFileKind(header: string[]): FileKind {
  const h = header.join(' ');
  if (h.includes('watchlist')) return 'watchlist';
  if (h.includes('review') && h.includes('rating')) return 'reviews';
  if (h.includes('watched date') || h.includes('rewatch')) return 'diary';
  if (h.includes('rating') && !h.includes('review') && !h.includes('watched date')) return 'ratings';
  if (h.includes('name') && (h.includes('year') || h.includes('uri'))) return 'watched';
  return 'unknown';
}

interface ParseResult { fileKind: FileKind; rows: ParsedRow[] }

function parseCSVFile(text: string): ParseResult | { error: string } {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return { error: 'File is empty or has no data rows.' };

  const headerCols = parseCSVLine(lines[0]);
  const header = headerCols.map(h => h.toLowerCase().replace(/^"|"$/g, '').trim());
  if (!header.includes('name')) return { error: 'No "Name" column found. Please use a standard Letterboxd export CSV.' };

  const fileKind = detectFileKind(header);

  const idx = {
    name:        header.indexOf('name'),
    year:        header.indexOf('year'),
    rating:      header.indexOf('rating'),
    review:      header.indexOf('review'),
    watchedDate: header.indexOf('watched date') >= 0 ? header.indexOf('watched date') : header.indexOf('date'),
    tags:        header.indexOf('tags'),
  };

  const rows: ParsedRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    const name = cols[idx.name]?.trim() ?? '';
    if (!name) continue;
    rows.push({
      name,
      year:        idx.year >= 0        ? (cols[idx.year]?.trim() ?? '')        : '',
      rating:      idx.rating >= 0      ? (cols[idx.rating]?.trim() ?? '')      : '',
      review:      idx.review >= 0      ? (cols[idx.review]?.trim() ?? '')      : '',
      watchedDate: idx.watchedDate >= 0 ? (cols[idx.watchedDate]?.trim() ?? '') : '',
      tags:        idx.tags >= 0        ? (cols[idx.tags]?.trim() ?? '')        : '',
    });
  }

  return { fileKind, rows };
}

// ─── TMDB helpers ─────────────────────────────────────────────────────────────

const TMDB_KEY = '561cfec28927b6575f26079bed25fadf';
const TMDB = 'https://api.themoviedb.org/3';

async function tmdbSearchBest(name: string, year: string): Promise<TmdbResult | null> {
  try {
    // Movie search first (most Letterboxd content is movies)
    const params = new URLSearchParams({ api_key: TMDB_KEY, query: name, language: 'en-US' });
    if (year) { params.set('year', year); params.set('primary_release_year', year); }
    const movieRes = await fetch(`${TMDB}/search/movie?${params}`);
    const movieData = await movieRes.json();
    if (movieData.results?.length) {
      const m = movieData.results[0];
      return { id: m.id, title: m.title, year: (m.release_date ?? '').slice(0, 4), poster: m.poster_path, mediaType: 'movie' };
    }
    // Fallback: TV
    const tvParams = new URLSearchParams({ api_key: TMDB_KEY, query: name, language: 'en-US' });
    if (year) tvParams.set('first_air_date_year', year);
    const tvRes = await fetch(`${TMDB}/search/tv?${tvParams}`);
    const tvData = await tvRes.json();
    if (tvData.results?.length) {
      const t = tvData.results[0];
      return { id: t.id, title: t.name, year: (t.first_air_date ?? '').slice(0, 4), poster: t.poster_path, mediaType: 'tv' };
    }
  } catch { /* ignore */ }
  return null;
}

async function tmdbFetchRuntime(tmdbId: number, mediaType: 'movie' | 'tv'): Promise<number> {
  try {
    const res = await fetch(`${TMDB}/${mediaType}/${tmdbId}?api_key=${TMDB_KEY}&language=en-US`);
    const data = await res.json();
    if (mediaType === 'movie') return data.runtime ?? 0;
    // For TV, use episode_run_time average
    const runtimes: number[] = data.episode_run_time ?? [];
    if (runtimes.length) return Math.round(runtimes.reduce((a: number, b: number) => a + b, 0) / runtimes.length);
  } catch { /* ignore */ }
  return 0;
}

async function tmdbSearchManual(query: string): Promise<TmdbResult[]> {
  try {
    const params = new URLSearchParams({ api_key: TMDB_KEY, query, language: 'en-US' });
    const res = await fetch(`${TMDB}/search/multi?${params}`);
    const data = await res.json();
    return (data.results ?? [])
      .filter((r: { media_type: string }) => r.media_type === 'movie' || r.media_type === 'tv')
      .slice(0, 8)
      .map((r: { id: number; title?: string; name?: string; release_date?: string; first_air_date?: string; poster_path: string | null; media_type: string }) => ({
        id: r.id,
        title: r.title || r.name || '',
        year: (r.release_date || r.first_air_date || '').slice(0, 4),
        poster: r.poster_path,
        mediaType: r.media_type as 'movie' | 'tv',
      }));
  } catch { return []; }
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props { onClose: () => void }

export default function LetterboxdImportModal({ onClose }: Props) {
  const { user, refreshProfile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>('upload');
  const [dragOver, setDragOver] = useState(false);
  const [fileError, setFileError] = useState('');
  const [items, setItems] = useState<ImportItem[]>([]);
  const [matchProgress, setMatchProgress] = useState(0);
  const [matchTotal, setMatchTotal]       = useState(0);
  const [importProgress, setImportProgress] = useState(0);
  const [importTotal, setImportTotal]       = useState(0);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [filter, setFilter] = useState<'all' | MatchStatus>('all');
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  // ── File processing ───────────────────────────────────────────────────────

  async function processFile(file: File) {
    setFileError('');
    setStep('matching');
    let text: string;
    try { text = await file.text(); }
    catch { setFileError('Could not read the file.'); setStep('upload'); return; }

    const parsed = parseCSVFile(text);
    if ('error' in parsed) { setFileError(parsed.error); setStep('upload'); return; }
    const { fileKind, rows } = parsed;
    if (rows.length === 0) { setFileError('No data rows found in this file.'); setStep('upload'); return; }

    // Pre-load existing tmdb_ids to flag duplicates
    const existingWatched   = new Set<number>();
    const existingWatchlist = new Set<number>();
    if (user) {
      const [{ data: wd }, { data: wl }] = await Promise.all([
        supabase.from('watched').select('tmdb_id').eq('user_id', user.id),
        supabase.from('watchlist').select('tmdb_id').eq('user_id', user.id),
      ]);
      (wd ?? []).forEach((r: { tmdb_id: number }) => existingWatched.add(r.tmdb_id));
      (wl ?? []).forEach((r: { tmdb_id: number }) => existingWatchlist.add(r.tmdb_id));
    }

    // Only watched.csv and watchlist.csv treat pre-existing entries as "duplicates" to skip.
    // diary, ratings, and reviews all use upsert-merge — films already in the library show
    // as "matched" (will update the rating/date/review), never as "duplicate".
    const duplicateCheckKinds: FileKind[] = ['watched', 'watchlist'];
    const showDuplicates = duplicateCheckKinds.includes(fileKind);

    setMatchTotal(rows.length);
    setMatchProgress(0);

    const BATCH = 5;
    const built: ImportItem[] = [];

    for (let i = 0; i < rows.length; i += BATCH) {
      const chunk = rows.slice(i, i + BATCH);
      const results = await Promise.all(chunk.map(r => tmdbSearchBest(r.name, r.year)));
      chunk.forEach((row, j) => {
        const match = results[j];
        const isDup = showDuplicates && match
          ? (fileKind === 'watchlist' ? existingWatchlist.has(match.id) : existingWatched.has(match.id))
          : false;
        built.push({
          key: `${i + j}__${row.name}`,
          row,
          fileKind,
          status: match ? (isDup ? 'duplicate' : 'matched') : 'unmatched',
          tmdbId:       match?.id ?? null,
          tmdbTitle:    match?.title ?? '',
          tmdbYear:     match?.year ?? '',
          tmdbPoster:   match?.poster ?? null,
          tmdbMediaType: match?.mediaType ?? 'movie',
          searchOpen: false, searchQuery: row.name, searchLoading: false, searchResults: [],
        });
      });
      setMatchProgress(Math.min(i + BATCH, rows.length));
      await new Promise(r => setTimeout(r, 0));
    }

    setItems(built);
    setStep('preview');
  }

  function onFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (f) processFile(f);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) processFile(f);
  }

  // ── Manual search ─────────────────────────────────────────────────────────

  const openSearch = useCallback(async (key: string) => {
    const item = items.find(i => i.key === key);
    if (!item) return;
    setItems(prev => prev.map(i => i.key === key ? { ...i, searchOpen: true, searchLoading: true, searchResults: [] } : i));
    const results = await tmdbSearchManual(item.searchQuery);
    setItems(prev => prev.map(i => i.key === key ? { ...i, searchLoading: false, searchResults: results } : i));
  }, [items]);

  function setSearchQuery(key: string, q: string) {
    setItems(prev => prev.map(i => i.key === key ? { ...i, searchQuery: q } : i));
  }

  async function runSearch(key: string) {
    const item = items.find(i => i.key === key);
    if (!item) return;
    setItems(prev => prev.map(i => i.key === key ? { ...i, searchLoading: true, searchResults: [] } : i));
    const results = await tmdbSearchManual(item.searchQuery);
    setItems(prev => prev.map(i => i.key === key ? { ...i, searchLoading: false, searchResults: results } : i));
  }

  function applyMatch(key: string, result: TmdbResult) {
    setItems(prev => prev.map(i => i.key === key ? {
      ...i,
      status: 'matched',
      tmdbId: result.id, tmdbTitle: result.title, tmdbYear: result.year,
      tmdbPoster: result.poster, tmdbMediaType: result.mediaType,
      searchOpen: false,
    } : i));
  }

  function skipItem(key: string) {
    setItems(prev => prev.map(i => i.key === key ? { ...i, status: 'unmatched', tmdbId: null, searchOpen: false } : i));
  }

  // ── Import ────────────────────────────────────────────────────────────────

  async function runImport() {
    if (!user) return;
    const toImport = items.filter(i => i.status === 'matched' && i.tmdbId !== null);
    setImportTotal(toImport.length);
    setImportProgress(0);
    setStep('importing');

    let imported = 0, updated = 0, dupSkipped = 0, errors = 0;
    const errorDetails: { title: string; reason: string }[] = [];
    const BATCH = 8;

    // Pre-fetch existing watched entries so we can distinguish import vs update
    // Key includes watched_date so re-imports of the same entry are skipped but
    // rewatches on different dates are treated as new entries.
    const { data: existingWatchedRows } = await supabase
      .from('watched').select('tmdb_id,media_type,watched_date').eq('user_id', user.id);
    const existingWatchedSet = new Set(
      (existingWatchedRows ?? []).map((r: { tmdb_id: number; media_type: string; watched_date: string }) => `${r.tmdb_id}:${r.media_type}:${r.watched_date ?? ''}`)
    );
    // Separate set just for tmdb_id:media_type to track whether ANY watch exists (for wasExisting counter)
    const existingWatchedAnySet = new Set(
      (existingWatchedRows ?? []).map((r: { tmdb_id: number; media_type: string }) => `${r.tmdb_id}:${r.media_type}`)
    );

    const updatedItems = [...items];

    for (let i = 0; i < toImport.length; i += BATCH) {
      await Promise.all(toImport.slice(i, i + BATCH).map(async item => {
        const idx = updatedItems.findIndex(it => it.key === item.key);
        try {
          const { tmdbId, tmdbMediaType, tmdbTitle, tmdbPoster, row, fileKind } = item;
          if (!tmdbId) return;

          // Title: prefer TMDB title, fall back to original Letterboxd name — never null
          const title = (tmdbTitle || row.name || '').trim();
          if (!title) {
            errors++;
            const reason = 'Missing title — row skipped';
            errorDetails.push({ title: row.name || '(unknown)', reason });
            if (idx >= 0) updatedItems[idx] = { ...updatedItems[idx], importResult: 'error', importError: reason };
            return;
          }

          const posterPath = tmdbPoster ?? '';

          // Letterboxd uses 0.5–5 half-star scale, no conversion needed
          const rawRating = row.rating ? parseFloat(row.rating) : null;
          const rating = rawRating !== null && !isNaN(rawRating)
            ? Math.min(5, Math.max(0.5, rawRating))
            : null;
          const watchDate = row.watchedDate || new Date().toISOString().split('T')[0];
          const wasExisting = existingWatchedAnySet.has(`${tmdbId}:${tmdbMediaType}`);
          // Skip watched insert if this exact entry (same date) already exists in DB
          const watchedEntryExists = existingWatchedSet.has(`${tmdbId}:${tmdbMediaType}:${watchDate}`);

          // ── Watchlist ────────────────────────────────────────────────────
          if (fileKind === 'watchlist') {
            const { error: wlErr } = await supabase.from('watchlist').upsert(
              { user_id: user.id, tmdb_id: tmdbId, media_type: tmdbMediaType, title, poster_path: posterPath },
              { onConflict: 'user_id,tmdb_id,media_type' }
            );
            if (wlErr) {
              errors++;
              errorDetails.push({ title, reason: wlErr.message });
              if (idx >= 0) updatedItems[idx] = { ...updatedItems[idx], importResult: 'error', importError: wlErr.message };
            } else {
              if (wasExisting) updated++; else imported++;
              if (idx >= 0) updatedItems[idx] = { ...updatedItems[idx], importResult: wasExisting ? 'updated' : 'imported' };
            }
            return;
          }

          // ── Ratings-only: upsert rating + create watched entry if not exists ───
          if (fileKind === 'ratings') {
            if (!watchedEntryExists) {
              const runtime = await tmdbFetchRuntime(tmdbId, tmdbMediaType);
              const { error: wErr } = await supabase.from('watched').insert({
                user_id: user.id, tmdb_id: tmdbId, media_type: tmdbMediaType,
                title, poster_path: posterPath,
                watched_date: watchDate,
                liked: rating !== null ? rating >= 4 : false,
                ...(runtime > 0 ? { runtime_minutes: runtime } : {}),
              });
              if (wErr) {
                errors++;
                errorDetails.push({ title, reason: wErr.message });
                if (idx >= 0) updatedItems[idx] = { ...updatedItems[idx], importResult: 'error', importError: wErr.message };
                return;
              }
            }
            if (rating !== null) {
              await supabase.from('ratings').upsert(
                { user_id: user.id, tmdb_id: tmdbId, media_type: tmdbMediaType, rating },
                { onConflict: 'user_id,tmdb_id,media_type' }
              );
            }
            if (wasExisting) updated++; else imported++;
            if (idx >= 0) updatedItems[idx] = { ...updatedItems[idx], importResult: wasExisting ? 'updated' : 'imported' };
            return;
          }

          // ── Watched / Diary / Reviews: insert watched entry if not already present ──
          if (!watchedEntryExists) {
            const runtime = await tmdbFetchRuntime(tmdbId, tmdbMediaType);
            const { error: wErr } = await supabase.from('watched').insert({
              user_id: user.id, tmdb_id: tmdbId, media_type: tmdbMediaType,
              title, poster_path: posterPath,
              watched_date: watchDate,
              liked: rating !== null ? rating >= 4 : false,
              ...(runtime > 0 ? { runtime_minutes: runtime } : {}),
            });
            if (wErr) {
              errors++;
              errorDetails.push({ title, reason: wErr.message });
              if (idx >= 0) updatedItems[idx] = { ...updatedItems[idx], importResult: 'error', importError: wErr.message };
              return;
            }
          }

          // Rating (if present)
          if (rating !== null) {
            await supabase.from('ratings').upsert(
              { user_id: user.id, tmdb_id: tmdbId, media_type: tmdbMediaType, rating },
              { onConflict: 'user_id,tmdb_id,media_type' }
            );
          }

          // Review (if present)
          if (row.review.trim()) {
            await supabase.from('reviews').upsert(
              {
                user_id: user.id, tmdb_id: tmdbId, media_type: tmdbMediaType,
                content: row.review.trim().slice(0, 2000),
                is_public: true,
              },
              { onConflict: 'user_id,tmdb_id,media_type' }
            );
          }

          if (wasExisting) updated++; else imported++;
          if (idx >= 0) updatedItems[idx] = { ...updatedItems[idx], importResult: wasExisting ? 'updated' : 'imported' };
        } catch (e) {
          errors++;
          const reason = e instanceof Error ? e.message : 'Unknown error';
          errorDetails.push({ title: item.tmdbTitle || item.row.name, reason });
          if (idx >= 0) updatedItems[idx] = { ...updatedItems[idx], importResult: 'error', importError: reason };
        }
      }));
      setImportProgress(Math.min(i + BATCH, toImport.length));
    }

    setItems(updatedItems);
    setSummary({
      imported,
      updated,
      duplicateSkipped: dupSkipped + items.filter(i => i.status === 'duplicate').length,
      unmatched: items.filter(i => i.status === 'unmatched').length,
      errors,
      errorDetails,
    });

    // Refresh profile so stats (watched count, etc.) update immediately
    await refreshProfile();

    setStep('done');
  }

  // ── Counts ────────────────────────────────────────────────────────────────

  const matchedCount = items.filter(i => i.status === 'matched').length;
  const unmatchedCount = items.filter(i => i.status === 'unmatched').length;
  const dupCount = items.filter(i => i.status === 'duplicate').length;
  const fileKind = items[0]?.fileKind ?? 'unknown';
  const displayItems = filter === 'all' ? items : items.filter(i => i.status === filter);

  const isWatchlist = fileKind === 'watchlist';
  const importLabel = isWatchlist
    ? `Add ${matchedCount} to Watchlist`
    : `Import ${matchedCount} Film${matchedCount !== 1 ? 's' : ''}`;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(0,0,0,.88)', backdropFilter: 'blur(6px)', overflowY: 'auto', padding: '24px 16px 40px', display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}
      onClick={step === 'importing' ? undefined : onClose}
    >
      <div
        className="animate-slide-up"
        style={{ width: '100%', maxWidth: 680, background: '#111', border: '1px solid #222', borderRadius: 20, overflow: 'hidden', marginTop: 16 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: '18px 22px 16px', borderBottom: '1px solid #1a1a1a', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <h2 style={{ margin: '0 0 3px', color: '#fff', fontSize: 17, fontWeight: 700 }}>Import from Letterboxd</h2>
            <p style={{ margin: 0, color: '#555', fontSize: 12 }}>
              {step === 'upload'    && 'Upload any Letterboxd export CSV file'}
              {step === 'matching'  && `Matching with TMDB… ${matchProgress} / ${matchTotal}`}
              {step === 'preview'   && `${items.length} items · ${matchedCount} matched · ${unmatchedCount} unmatched · ${dupCount} duplicate${dupCount !== 1 ? 's' : ''}`}
              {step === 'importing' && `Saving to your account… ${importProgress} / ${importTotal}`}
              {step === 'done'      && 'Import complete'}
            </p>
          </div>
          {step !== 'importing' && (
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#555', padding: 4, flexShrink: 0, transition: 'color .15s' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
              onMouseLeave={e => (e.currentTarget.style.color = '#555')}
            ><X size={17} /></button>
          )}
        </div>

        {/* ── UPLOAD ── */}
        {step === 'upload' && (
          <div style={{ padding: 22 }}>
            {/* Drop zone */}
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${dragOver ? '#f59e0b' : '#2a2a2a'}`,
                borderRadius: 14, padding: '36px 20px', textAlign: 'center', cursor: 'pointer',
                transition: 'border-color .2s, background .2s',
                background: dragOver ? 'rgba(245,158,11,.04)' : '#0d0d0d',
              }}
              onMouseEnter={e => { if (!dragOver) (e.currentTarget as HTMLDivElement).style.borderColor = '#3a3a3a'; }}
              onMouseLeave={e => { if (!dragOver) (e.currentTarget as HTMLDivElement).style.borderColor = '#2a2a2a'; }}
            >
              <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(245,158,11,.1)', border: '1px solid rgba(245,158,11,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                <Upload size={20} color="#f59e0b" />
              </div>
              <p style={{ margin: '0 0 4px', color: '#ccc', fontSize: 14, fontWeight: 600 }}>Drop your CSV file here</p>
              <p style={{ margin: '0 0 4px', color: '#555', fontSize: 12 }}>or click to browse your files</p>
              <p style={{ margin: '0 0 18px', color: '#888', fontSize: 11 }}>Start with <strong style={{ color: '#fbbf24' }}>diary.csv</strong> to import watched films, dates &amp; ratings at once</p>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 20px', borderRadius: 10, background: '#f59e0b', color: '#000', fontSize: 13, fontWeight: 600 }}>
                <Upload size={12} /> Choose File
              </span>
            </div>
            <input ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={onFileInput} style={{ display: 'none' }} />

            {fileError && (
              <div style={{ marginTop: 14, display: 'flex', gap: 10, padding: '11px 14px', background: 'rgba(239,68,68,.07)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 10 }}>
                <AlertTriangle size={14} color="#f87171" style={{ flexShrink: 0, marginTop: 1 }} />
                <p style={{ margin: 0, color: '#f87171', fontSize: 12, lineHeight: 1.5 }}>{fileError}</p>
              </div>
            )}

            {/* Supported file types */}
            <p style={{ margin: '18px 0 10px', color: '#555', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.07em' }}>Supported export files</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 8 }}>
              {[
                { file: 'films.csv',   desc: 'All watched films',      icon: <Film size={12} color="#fbbf24" /> },
                { file: 'diary.csv',   desc: 'Diary with watch dates', icon: <Film size={12} color="#60a5fa" /> },
                { file: 'ratings.csv', desc: 'Your film ratings',      icon: <Film size={12} color="#4ade80" /> },
                { file: 'reviews.csv', desc: 'Reviews you wrote',      icon: <Film size={12} color="#c084fc" /> },
                { file: 'watchlist.csv', desc: 'Films to watch',       icon: <BookmarkPlus size={12} color="#fb923c" /> },
              ].map(({ file, desc, icon }) => (
                <div key={file} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 10 }}>
                  {icon}
                  <div>
                    <p style={{ margin: 0, color: '#ccc', fontSize: 12, fontWeight: 500 }}>{file}</p>
                    <p style={{ margin: 0, color: '#444', fontSize: 11 }}>{desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <p style={{ margin: '12px 0 0', color: '#3a3a3a', fontSize: 11, lineHeight: 1.6 }}>
              Export from Letterboxd: Settings → Import &amp; Export → Export Your Data. Upload each CSV file separately.
            </p>
          </div>
        )}

        {/* ── MATCHING ── */}
        {step === 'matching' && (
          <div style={{ padding: '48px 24px', textAlign: 'center' }}>
            <div style={{ width: 44, height: 44, border: '3px solid rgba(245,158,11,.2)', borderTopColor: '#f59e0b', borderRadius: '50%', animation: 'spin .8s linear infinite', margin: '0 auto 18px' }} />
            <p style={{ margin: '0 0 4px', color: '#fff', fontSize: 15, fontWeight: 600 }}>Matching films with TMDB</p>
            <p style={{ margin: '0 0 20px', color: '#555', fontSize: 13 }}>{matchProgress} of {matchTotal}</p>
            <div style={{ height: 5, background: '#1a1a1a', borderRadius: 3, overflow: 'hidden', maxWidth: 280, margin: '0 auto' }}>
              <div style={{ height: '100%', background: 'linear-gradient(90deg,#f59e0b,#fbbf24)', borderRadius: 3, transition: 'width .3s', width: `${matchTotal > 0 ? (matchProgress / matchTotal) * 100 : 0}%` }} />
            </div>
          </div>
        )}

        {/* ── PREVIEW ── */}
        {step === 'preview' && (
          <>
            {/* Tab bar */}
            <div style={{ display: 'flex', borderBottom: '1px solid #1a1a1a' }}>
              {([
                { value: 'all',       label: 'All',       count: items.length,   color: '#888' },
                { value: 'matched',   label: 'Matched',   count: matchedCount,   color: '#4ade80' },
                { value: 'unmatched', label: 'Unmatched', count: unmatchedCount, color: '#f87171' },
                { value: 'duplicate', label: 'Duplicate', count: dupCount,       color: '#fbbf24' },
              ] as const).map(tab => (
                <button key={tab.value} onClick={() => { setFilter(tab.value); setExpandedKey(null); }}
                  style={{ flex: 1, padding: '12px 6px', background: 'none', border: 'none', borderBottom: `2px solid ${filter === tab.value ? tab.color : 'transparent'}`, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s' }}>
                  <p style={{ margin: '0 0 1px', color: filter === tab.value ? tab.color : '#444', fontSize: 17, fontWeight: 700 }}>{tab.count}</p>
                  <p style={{ margin: 0, color: filter === tab.value ? tab.color : '#3a3a3a', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em' }}>{tab.label}</p>
                </button>
              ))}
            </div>

            {/* File kind hint */}
            <div style={{ padding: '8px 18px', display: 'flex', alignItems: 'center', gap: 8, background: '#0d0d0d', borderBottom: '1px solid #181818' }}>
              {isWatchlist ? <BookmarkPlus size={12} color="#fb923c" /> : <Film size={12} color="#fbbf24" />}
              <span style={{ color: '#444', fontSize: 11 }}>
                {isWatchlist ? 'Watchlist' : fileKind === 'diary' ? 'Diary' : fileKind === 'ratings' ? 'Ratings' : fileKind === 'reviews' ? 'Reviews' : 'Watched'} import
              </span>
              <span style={{ marginLeft: 'auto', color: '#333', fontSize: 11 }}>
                {matchedCount > 0 ? `${matchedCount} will be imported` : 'No items to import'}
              </span>
            </div>

            {/* Item list */}
            <div style={{ maxHeight: 400, overflowY: 'auto' }} className="no-scrollbar">
              {displayItems.length === 0
                ? <p style={{ padding: '28px 20px', textAlign: 'center', color: '#444', fontSize: 13, margin: 0 }}>No items in this category.</p>
                : displayItems.map(item => (
                    <PreviewRow
                      key={item.key}
                      item={item}
                      expanded={expandedKey === item.key}
                      onToggle={() => setExpandedKey(expandedKey === item.key ? null : item.key)}
                      onOpenSearch={() => openSearch(item.key)}
                      onSearchQueryChange={q => setSearchQuery(item.key, q)}
                      onSearch={() => runSearch(item.key)}
                      onApplyMatch={r => applyMatch(item.key, r)}
                      onSkip={() => skipItem(item.key)}
                    />
                  ))
              }
            </div>

            {/* Footer */}
            <div style={{ padding: '14px 18px', borderTop: '1px solid #1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', background: '#0d0d0d' }}>
              <button
                onClick={() => { setStep('upload'); setItems([]); setFilter('all'); setExpandedKey(null); setFileError(''); }}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 10, border: '1px solid #2a2a2a', background: 'none', color: '#666', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', transition: 'all .15s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#444'; e.currentTarget.style.color = '#aaa'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#2a2a2a'; e.currentTarget.style.color = '#666'; }}
              >
                <ArrowLeft size={13} /> Different file
              </button>
              <button
                onClick={runImport}
                disabled={matchedCount === 0}
                className="btn-gold"
                style={{ padding: '10px 22px', borderRadius: 11, fontSize: 13 }}
              >
                {importLabel}
              </button>
            </div>
          </>
        )}

        {/* ── IMPORTING ── */}
        {step === 'importing' && (
          <div style={{ padding: '48px 24px', textAlign: 'center' }}>
            <div style={{ width: 44, height: 44, border: '3px solid rgba(245,158,11,.2)', borderTopColor: '#f59e0b', borderRadius: '50%', animation: 'spin .8s linear infinite', margin: '0 auto 18px' }} />
            <p style={{ margin: '0 0 4px', color: '#fff', fontSize: 15, fontWeight: 600 }}>Saving to your account…</p>
            <p style={{ margin: '0 0 20px', color: '#555', fontSize: 13 }}>{importProgress} of {importTotal}</p>
            <div style={{ height: 5, background: '#1a1a1a', borderRadius: 3, overflow: 'hidden', maxWidth: 280, margin: '0 auto' }}>
              <div style={{ height: '100%', background: 'linear-gradient(90deg,#f59e0b,#fbbf24)', borderRadius: 3, transition: 'width .3s', width: `${importTotal > 0 ? (importProgress / importTotal) * 100 : 0}%` }} />
            </div>
          </div>
        )}

        {/* ── DONE ── */}
        {step === 'done' && summary && (
          <div style={{ padding: '36px 24px', textAlign: 'center' }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(74,222,128,.1)', border: '1px solid rgba(74,222,128,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Check size={24} color="#4ade80" />
            </div>
            <h3 style={{ margin: '0 0 4px', color: '#fff', fontSize: 20, fontWeight: 700 }}>Import complete!</h3>
            <p style={{ margin: '0 0 24px', color: '#555', fontSize: 13 }}>Your Letterboxd data has been added to Qued.</p>
            <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 20, marginBottom: summary.errorDetails.length > 0 ? 16 : 28 }}>
              {summary.imported > 0 && <SummaryPill value={summary.imported} label="Imported" color="#4ade80" />}
              {summary.updated > 0 && <SummaryPill value={summary.updated} label="Updated" color="#60a5fa" />}
              {summary.duplicateSkipped > 0 && <SummaryPill value={summary.duplicateSkipped} label="Skipped" color="#fbbf24" />}
              {summary.unmatched > 0 && <SummaryPill value={summary.unmatched} label="Not found" color="#f87171" />}
              {summary.errors > 0 && <SummaryPill value={summary.errors} label="Failed" color="#f87171" />}
            </div>
            {summary.errorDetails.length > 0 && (
              <div style={{ marginBottom: 24, textAlign: 'left', maxHeight: 140, overflowY: 'auto', background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 10, padding: '10px 14px' }} className="no-scrollbar">
                <p style={{ margin: '0 0 8px', color: '#f87171', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em' }}>Failed rows</p>
                {summary.errorDetails.map((e, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 5 }}>
                    <span style={{ color: '#888', fontSize: 12, flex: '0 0 120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.title}</span>
                    <span style={{ color: '#555', fontSize: 12, flex: 1 }}>{e.reason}</span>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
              <button
                onClick={() => { setStep('upload'); setItems([]); setSummary(null); setFilter('all'); setExpandedKey(null); setFileError(''); }}
                style={{ padding: '10px 20px', borderRadius: 11, border: '1px solid #2a2a2a', background: 'none', color: '#888', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', transition: 'all .15s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#444'; e.currentTarget.style.color = '#ccc'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#2a2a2a'; e.currentTarget.style.color = '#888'; }}
              >
                Import another file
              </button>
              <button onClick={onClose} className="btn-gold" style={{ padding: '10px 20px', borderRadius: 11, fontSize: 13 }}>Done</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SummaryPill({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div style={{ textAlign: 'center', minWidth: 80 }}>
      <p style={{ margin: '0 0 2px', color, fontSize: 30, fontWeight: 800, lineHeight: 1 }}>{value}</p>
      <p style={{ margin: 0, color: '#555', fontSize: 12 }}>{label}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: MatchStatus }) {
  const s: Record<MatchStatus, { label: string; bg: string; fg: string }> = {
    matched:   { label: 'Matched',   bg: 'rgba(74,222,128,.1)',  fg: '#4ade80' },
    unmatched: { label: 'Not found', bg: 'rgba(248,113,113,.1)', fg: '#f87171' },
    duplicate: { label: 'Duplicate', bg: 'rgba(251,191,36,.1)',  fg: '#fbbf24' },
  };
  const { label, bg, fg } = s[status];
  return (
    <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: bg, color: fg, whiteSpace: 'nowrap', flexShrink: 0 }}>{label}</span>
  );
}

interface PreviewRowProps {
  item: ImportItem;
  expanded: boolean;
  onToggle: () => void;
  onOpenSearch: () => void;
  onSearchQueryChange: (q: string) => void;
  onSearch: () => void;
  onApplyMatch: (r: TmdbResult) => void;
  onSkip: () => void;
}

function PreviewRow({ item, expanded, onToggle, onOpenSearch, onSearchQueryChange, onSearch, onApplyMatch, onSkip }: PreviewRowProps) {
  const hasMatch = item.status === 'matched' || item.status === 'duplicate';
  const displayTitle = hasMatch ? item.tmdbTitle : item.row.name;
  const displayYear  = hasMatch ? item.tmdbYear  : item.row.year;

  return (
    <div style={{ borderBottom: '1px solid #181818' }}>
      {/* Row */}
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 16px', cursor: 'pointer', transition: 'background .1s' }}
        onClick={onToggle}
        onMouseEnter={e => (e.currentTarget.style.background = '#141414')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      >
        {/* Poster thumbnail */}
        <div style={{ width: 30, height: 44, borderRadius: 5, overflow: 'hidden', background: '#1a1a1a', flexShrink: 0 }}>
          {hasMatch && item.tmdbPoster
            ? <img src={posterUrl(item.tmdbPoster, 'w92')!} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
            : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {item.tmdbMediaType === 'tv' ? <Tv size={11} color="#2e2e2e" /> : <Film size={11} color="#2e2e2e" />}
              </div>}
        </div>

        {/* Title + meta */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: '0 0 2px', color: '#e5e5e5', fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayTitle}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {hasMatch && item.row.name !== item.tmdbTitle && (
              <span style={{ color: '#3a3a3a', fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }}>{item.row.name}</span>
            )}
            <span style={{ color: '#444', fontSize: 11 }}>{displayYear}</span>
            {item.row.rating && <span style={{ color: '#fbbf24', fontSize: 11 }}>★ {item.row.rating}</span>}
          </div>
        </div>

        {/* Status + chevron */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <StatusBadge status={item.status} />
          {expanded ? <ChevronUp size={13} color="#3a3a3a" /> : <ChevronDown size={13} color="#3a3a3a" />}
        </div>
      </div>

      {/* Expanded panel */}
      {expanded && (
        <div style={{ padding: '0 16px 14px 16px', background: '#0a0a0a', borderTop: '1px solid #181818' }}>
          {/* Status-specific content */}
          {item.status === 'matched' && (
            <div style={{ paddingTop: 10 }}>
              <p style={{ margin: '0 0 8px', color: '#4ade80', fontSize: 12 }}>
                Matched to <strong>{item.tmdbTitle}</strong> ({item.tmdbYear}) · {item.tmdbMediaType === 'tv' ? 'TV Show' : 'Film'}
              </p>
              <button onClick={onOpenSearch}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px', background: 'none', border: '1px solid #2a2a2a', borderRadius: 7, color: '#555', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit', transition: 'all .15s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#f59e0b'; e.currentTarget.style.color = '#fbbf24'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#2a2a2a'; e.currentTarget.style.color = '#555'; }}>
                <RefreshCw size={11} /> Fix match
              </button>
            </div>
          )}

          {item.status === 'unmatched' && (
            <div style={{ paddingTop: 10 }}>
              <p style={{ margin: '0 0 10px', color: '#f87171', fontSize: 12 }}>
                Could not find <strong style={{ color: '#f87171' }}>{item.row.name}</strong> on TMDB. Search manually below.
              </p>
              <ManualSearch
                query={item.searchQuery}
                loading={item.searchLoading}
                results={item.searchResults}
                onQueryChange={onSearchQueryChange}
                onSearch={onSearch}
                onSelect={onApplyMatch}
                showResults={item.searchResults.length > 0 || item.searchLoading}
              />
              <button onClick={onSkip}
                style={{ marginTop: 8, background: 'none', border: 'none', color: '#3a3a3a', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', padding: 0, transition: 'color .15s' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#666')}
                onMouseLeave={e => (e.currentTarget.style.color = '#3a3a3a')}>
                Skip this item
              </button>
            </div>
          )}

          {item.status === 'duplicate' && (
            <div style={{ paddingTop: 10 }}>
              <p style={{ margin: 0, color: '#fbbf24', fontSize: 12 }}>
                <strong>{item.tmdbTitle}</strong> is already in your library and will be skipped.
              </p>
            </div>
          )}

          {/* Fix-match search panel (for matched items) */}
          {item.status === 'matched' && item.searchOpen && (
            <div style={{ marginTop: 12 }}>
              <ManualSearch
                query={item.searchQuery}
                loading={item.searchLoading}
                results={item.searchResults}
                onQueryChange={onSearchQueryChange}
                onSearch={onSearch}
                onSelect={onApplyMatch}
                showResults={item.searchResults.length > 0 || item.searchLoading}
              />
            </div>
          )}

          {/* Review preview */}
          {item.row.review && (
            <div style={{ marginTop: 10, padding: '8px 12px', background: '#111', border: '1px solid #1a1a1a', borderRadius: 8 }}>
              <p style={{ margin: 0, color: '#555', fontSize: 11, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {item.row.review}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface ManualSearchProps {
  query: string;
  loading: boolean;
  results: TmdbResult[];
  onQueryChange: (q: string) => void;
  onSearch: () => void;
  onSelect: (r: TmdbResult) => void;
  showResults: boolean;
}

function ManualSearch({ query, loading, results, onQueryChange, onSearch, onSelect, showResults }: ManualSearchProps) {
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: showResults ? 10 : 0 }}>
        <input
          value={query}
          onChange={e => onQueryChange(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && onSearch()}
          placeholder="Search by title…"
          autoFocus
          style={{ flex: 1, background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8, padding: '7px 12px', color: '#e5e5e5', fontSize: 13, outline: 'none', fontFamily: 'inherit' }}
          onFocus={e => (e.target.style.borderColor = '#f59e0b')}
          onBlur={e  => (e.target.style.borderColor = '#2a2a2a')}
        />
        <button
          onClick={onSearch}
          disabled={loading}
          style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: '#f59e0b', color: '#000', cursor: loading ? 'default' : 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5 }}
        >
          {loading ? <RefreshCw size={12} style={{ animation: 'spin .7s linear infinite' }} /> : <><Search size={12} /> Search</>}
        </button>
      </div>

      {showResults && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {loading && results.length === 0 && (
            <p style={{ margin: 0, color: '#444', fontSize: 12, padding: '4px 0' }}>Searching…</p>
          )}
          {!loading && results.length === 0 && (
            <p style={{ margin: 0, color: '#444', fontSize: 12, padding: '4px 0' }}>No results. Try a different title.</p>
          )}
          {results.map(r => (
            <button key={r.id} onClick={() => onSelect(r)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', background: '#141414', border: '1px solid #222', borderRadius: 9, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', transition: 'border-color .1s' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = '#f59e0b')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = '#222')}>
              <div style={{ width: 26, height: 38, borderRadius: 4, overflow: 'hidden', background: '#2a2a2a', flexShrink: 0 }}>
                {r.poster
                  ? <img src={posterUrl(r.poster, 'w92')!} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {r.mediaType === 'tv' ? <Tv size={9} color="#444" /> : <Film size={9} color="#444" />}
                    </div>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: '0 0 1px', color: '#ddd', fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</p>
                <p style={{ margin: 0, color: '#555', fontSize: 11 }}>{r.year} · {r.mediaType === 'tv' ? 'TV' : 'Film'}</p>
              </div>
              <Check size={12} color="#4ade80" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
