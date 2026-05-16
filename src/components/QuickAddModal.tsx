import { useState, useEffect } from 'react';
import { X, Heart, Calendar, List, Check, Plus, Search, Monitor } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { posterUrl, tmdb } from '../lib/tmdb';
import type { TMDBMedia } from '../lib/tmdb';
import StarRating from './StarRating';

export interface QuickAddMedia {
  tmdb_id: number;
  media_type: 'movie' | 'tv';
  title: string;
  poster_path: string;
}

interface QuickAddModalProps {
  media: QuickAddMedia | null;
  onClose: () => void;
}

type LogMode = 'watched' | 'watchlist';

export default function QuickAddModal({ media: initialMedia, onClose }: QuickAddModalProps) {
  const { user } = useAuth();

  const [searchQuery,   setSearchQuery]   = useState('');
  const [searchResults, setSearchResults] = useState<TMDBMedia[]>([]);
  const [searching,     setSearching]     = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<QuickAddMedia | null>(initialMedia);

  const [logMode,      setLogMode]      = useState<LogMode>('watched');
  const [rating,       setRating]       = useState(0);
  const [review,       setReview]       = useState('');
  const [reviewPublic, setReviewPublic] = useState(true);
  const [liked,        setLiked]        = useState(false);
  const [watchedDate,  setWatchedDate]  = useState(() => new Date().toISOString().split('T')[0]);
  const [showLists,    setShowLists]    = useState(false);
  const [lists,        setLists]        = useState<{ id: string; name: string }[]>([]);
  const [selectedList, setSelectedList] = useState<string | null>(null);
  const [platform, setPlatform] = useState('');
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);
  const [saveError, setSaveError] = useState('');
  const [ratingPrefilled, setRatingPrefilled] = useState(false);

  const PLATFORMS = ['Netflix', 'Prime Video', 'Disney+', 'Apple TV+', 'Cinema', 'DVD / Blu-ray', 'Other'];

  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      const d = await tmdb.search(searchQuery);
      setSearchResults(d.results.filter(r => r.media_type === 'movie' || r.media_type === 'tv').slice(0, 8));
      setSearching(false);
    }, 350);
    return () => clearTimeout(t);
  }, [searchQuery]);

  useEffect(() => {
    if (!user) return;
    supabase.from('lists').select('id,name').eq('user_id', user.id).then(({ data }) => setLists(data || []));
  }, [user]);

  // Pre-fill existing rating when a media item is selected
  useEffect(() => {
    if (!user || !selectedMedia) { setRatingPrefilled(false); return; }
    supabase
      .from('ratings')
      .select('rating')
      .eq('user_id', user.id)
      .eq('tmdb_id', selectedMedia.tmdb_id)
      .eq('media_type', selectedMedia.media_type)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.rating) {
          setRating(Number(data.rating));
          setRatingPrefilled(true);
        } else {
          setRatingPrefilled(false);
        }
      });
  }, [user, selectedMedia]);

  const media = selectedMedia;

  async function handleSave() {
    if (!user || !media) return;
    setSaving(true);
    setSaveError('');

    try {
      if (logMode === 'watchlist') {
        const { error } = await supabase.from('watchlist').upsert(
          { user_id: user.id, tmdb_id: media.tmdb_id, media_type: media.media_type, title: media.title, poster_path: media.poster_path },
          { onConflict: 'user_id,tmdb_id,media_type' }
        );
        if (error) throw error;
      } else {
        // Fetch runtime + year from TMDB in one call
        let runtime_minutes = 0;
        let mediaYear: number | null = null;
        try {
          if (media.media_type === 'movie') {
            const details = await tmdb.movieDetails(media.tmdb_id);
            runtime_minutes = details.runtime ?? 0;
            const yr = details.release_date?.slice(0, 4);
            if (yr) mediaYear = parseInt(yr, 10);
          } else {
            const details = await tmdb.tvDetails(media.tmdb_id);
            runtime_minutes = (details as unknown as { episode_run_time?: number[] }).episode_run_time?.[0] ?? 0;
            const yr = (details.first_air_date ?? '').slice(0, 4);
            if (yr) mediaYear = parseInt(yr, 10);
          }
        } catch { /* skip — save without runtime/year */ }

        const { error: watchedErr } = await supabase.from('watched').insert({
          user_id: user.id, tmdb_id: media.tmdb_id, media_type: media.media_type,
          title: media.title, poster_path: media.poster_path,
          watched_date: watchedDate, liked,
          runtime_minutes, platform: platform || null,
          year: mediaYear,
        });
        if (watchedErr) throw watchedErr;

        if (rating > 0) {
          await supabase.from('ratings').upsert(
            { user_id: user.id, tmdb_id: media.tmdb_id, media_type: media.media_type, rating, updated_at: new Date().toISOString() },
            { onConflict: 'user_id,tmdb_id,media_type' }
          );
        }

        if (review.trim()) {
          await supabase.from('reviews').upsert(
            { user_id: user.id, tmdb_id: media.tmdb_id, media_type: media.media_type,
              content: review.trim(), is_public: reviewPublic, updated_at: new Date().toISOString() },
            { onConflict: 'user_id,tmdb_id,media_type' }
          );
        }
      }

      if (selectedList) {
        await supabase.from('list_items').upsert(
          { list_id: selectedList, tmdb_id: media.tmdb_id, media_type: media.media_type, title: media.title, poster_path: media.poster_path },
          { onConflict: 'list_id,tmdb_id,media_type' }
        );
      }

      setSaving(false);
      setSaved(true);
      setTimeout(onClose, 700);
    } catch (err: unknown) {
      setSaving(false);
      setSaveError((err as { message?: string })?.message ?? 'Something went wrong. Please try again.');
    }
  }

  const posterSrc = media ? posterUrl(media.poster_path, 'w185') : null;

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', background: 'rgba(0,0,0,.8)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="animate-slide-up"
        style={{ width: '100%', maxWidth: 520, background: '#111', borderRadius: '24px 24px 0 0', borderTop: '1px solid #242424', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}
      >
        <div style={{ width: 40, height: 4, background: '#2e2e2e', borderRadius: 2, margin: '16px auto 0', flexShrink: 0 }} />

        <div style={{ overflowY: 'auto', padding: '16px 20px 32px', flex: 1 }} className="no-scrollbar">

          {!media ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <h2 style={{ margin: 0, color: '#fff', fontSize: 17, fontWeight: 700 }}>Log a film or show</h2>
                <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}><X size={20} /></button>
              </div>
              <div style={{ position: 'relative', marginBottom: 12 }}>
                <Search size={14} color="#888" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  autoFocus
                  value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search for a film or TV show..."
                  style={{ width: '100%', background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: 12, padding: '12px 12px 12px 34px', color: '#fff', fontSize: 14, outline: 'none', fontFamily: 'inherit' }}
                  onFocus={e  => (e.target.style.borderColor = '#f59e0b')}
                  onBlur={e   => (e.target.style.borderColor = '#2e2e2e')}
                />
              </div>
              {searching && <p style={{ color: '#888', fontSize: 13, textAlign: 'center', padding: '8px 0' }}>Searching...</p>}
              {searchResults.map(item => {
                const title = item.title || item.name || '';
                const year  = (item.release_date || item.first_air_date || '').slice(0, 4);
                const ps    = posterUrl(item.poster_path, 'w92');
                return (
                  <button key={item.id}
                    onClick={() => setSelectedMedia({ tmdb_id: item.id, media_type: (item.media_type as 'movie' | 'tv') ?? 'movie', title, poster_path: item.poster_path || '' })}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', padding: '10px', marginBottom: 4, background: '#1a1a1a', border: '1px solid transparent', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit', transition: 'border-color .15s' }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = '#2e2e2e')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = 'transparent')}>
                    {ps ? <img src={ps} alt="" style={{ width: 34, height: 50, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} /> : <div style={{ width: 34, height: 50, background: '#2e2e2e', borderRadius: 6, flexShrink: 0 }} />}
                    <div>
                      <p style={{ margin: 0, color: '#fff', fontSize: 14, fontWeight: 500 }}>{title}</p>
                      <p style={{ margin: 0, color: '#888', fontSize: 12 }}>{year}{year && ' · '}<span style={{ textTransform: 'capitalize' }}>{item.media_type}</span></p>
                    </div>
                  </button>
                );
              })}
            </>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 20 }}>
                {posterSrc && (
                  <img src={posterSrc} alt={media.title} style={{ width: 52, borderRadius: 8, aspectRatio: '2/3', objectFit: 'cover', flexShrink: 0 }} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h2 style={{ margin: '0 0 2px', color: '#fff', fontWeight: 700, fontSize: 17, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{media.title}</h2>
                  <p style={{ margin: 0, color: '#888', fontSize: 11, textTransform: 'capitalize' }}>{media.media_type}</p>
                  <button onClick={() => setSelectedMedia(null)} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 11, padding: '4px 0', marginTop: 2, fontFamily: 'inherit' }}>
                    ← Change
                  </button>
                </div>
                <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', flexShrink: 0 }}><X size={20} /></button>
              </div>

              <div style={{ display: 'flex', background: '#1a1a1a', borderRadius: 12, padding: 3, marginBottom: 20, gap: 3 }}>
                {(['watched', 'watchlist'] as LogMode[]).map(m => (
                  <button key={m} onClick={() => setLogMode(m)}
                    style={{ flex: 1, padding: '8px 0', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500, transition: 'all .2s', fontFamily: 'inherit',
                      background: logMode === m ? '#f59e0b' : 'transparent',
                      color: logMode === m ? '#000' : '#888' }}>
                    {m === 'watched' ? "I've Watched This" : 'Want to Watch'}
                  </button>
                ))}
              </div>

              {logMode === 'watched' && (
                <>
                  <Field label={<><Calendar size={11} /> Date Watched</>}>
                    <input type="date" value={watchedDate} onChange={e => setWatchedDate(e.target.value)}
                      style={{ width: '100%', background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: 12, padding: '11px 14px', color: '#fff', fontSize: 14, outline: 'none', colorScheme: 'dark', fontFamily: 'inherit' }} />
                  </Field>

                  <Field label="Rating">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                      <StarRating value={rating} onChange={setRating} size="lg" />
                      {rating > 0 && <span style={{ color: '#fbbf24', fontSize: 13, fontWeight: 600 }}>{rating}</span>}
                      {rating > 0 && <button onClick={() => setRating(0)} style={{ background: 'none', border: 'none', color: '#555', fontSize: 11, cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>clear</button>}
                      {ratingPrefilled && rating > 0 && <span style={{ color: '#555', fontSize: 10 }}>pre-filled from your last rating</span>}
                    </div>
                  </Field>

                  <div style={{ marginBottom: 16 }}>
                    <button onClick={() => setLiked(!liked)}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 12, fontSize: 14, cursor: 'pointer', transition: 'all .2s', fontFamily: 'inherit',
                        background: liked ? 'rgba(239,68,68,.15)' : '#1a1a1a',
                        border: liked ? '1px solid rgba(239,68,68,.35)' : '1px solid #2e2e2e',
                        color: liked ? '#f87171' : '#888' }}>
                      <Heart size={15} fill={liked ? '#f87171' : 'none'} />
                      {liked ? 'Liked' : 'Like this'}
                    </button>
                  </div>

                  <Field label={<><Monitor size={11} /> Where did you watch?</>}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {PLATFORMS.map(p => (
                        <button key={p} onClick={() => setPlatform(platform === p ? '' : p)}
                          style={{ padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: 'pointer', border: 'none', transition: 'all .15s', fontFamily: 'inherit',
                            background: platform === p ? '#f59e0b' : '#1a1a1a',
                            color: platform === p ? '#000' : '#666' }}>
                          {p}
                        </button>
                      ))}
                    </div>
                  </Field>

                  <Field label="Review (optional)">
                    <textarea value={review} onChange={e => setReview(e.target.value)}
                      placeholder="Share your thoughts..." rows={3}
                      style={{ width: '100%', background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: 12, padding: '11px 14px', color: '#fff', fontSize: 14, outline: 'none', resize: 'none', fontFamily: 'inherit' }}
                      onFocus={e  => (e.target.style.borderColor = '#f59e0b')}
                      onBlur={e   => (e.target.style.borderColor = '#2e2e2e')}
                    />
                    {review.trim() && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                        <span style={{ color: '#888', fontSize: 12 }}>Visibility:</span>
                        {(['public', 'hidden'] as const).map(v => (
                          <button key={v} onClick={() => setReviewPublic(v === 'public')}
                            style={{ padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 500, cursor: 'pointer', border: 'none', transition: 'all .15s', fontFamily: 'inherit',
                              background: (v === 'public') === reviewPublic ? '#f59e0b' : '#2e2e2e',
                              color:      (v === 'public') === reviewPublic ? '#000' : '#888' }}>
                            {v === 'public' ? 'Public' : 'Hidden'}
                          </button>
                        ))}
                      </div>
                    )}
                  </Field>
                </>
              )}

              <div style={{ marginBottom: 24 }}>
                <button onClick={() => setShowLists(!showLists)}
                  style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'inherit' }}>
                  <List size={13} /> {showLists ? 'Hide lists' : 'Add to a list'}
                </button>
                {showLists && (
                  <div style={{ marginTop: 8 }}>
                    {lists.length === 0
                      ? <p style={{ color: '#555', fontSize: 12 }}>No lists yet.</p>
                      : lists.map(l => (
                          <button key={l.id} onClick={() => setSelectedList(selectedList === l.id ? null : l.id)}
                            style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', marginBottom: 4, borderRadius: 10, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s',
                              background: selectedList === l.id ? 'rgba(245,158,11,.12)' : '#1a1a1a',
                              border: selectedList === l.id ? '1px solid rgba(245,158,11,.3)' : '1px solid transparent',
                              color: selectedList === l.id ? '#fbbf24' : '#ccc' }}>
                            {l.name}
                          </button>
                        ))}
                  </div>
                )}
              </div>

              {saveError && (
                <p style={{ color: '#ef4444', fontSize: 13, marginBottom: 10, textAlign: 'center' }}>{saveError}</p>
              )}
              <button onClick={handleSave} disabled={saving || saved} className="btn-gold"
                style={{ width: '100%', padding: '14px', borderRadius: 16, fontSize: 15 }}>
                {saved ? <><Check size={15} style={{ marginRight: 6 }} /> Saved!</>
                  : saving ? 'Saving...'
                  : logMode === 'watchlist' ? <><Plus size={15} style={{ marginRight: 6 }} /> Add to Watchlist</>
                  : <><Check size={15} style={{ marginRight: 6 }} /> Log Entry</>}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#888', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>{label}</label>
      {children}
    </div>
  );
}
