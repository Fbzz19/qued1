import { useState, useEffect } from 'react';
import { Sparkles, Send, Plus, Check, Film, Lock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { tmdb, posterUrl } from '../lib/tmdb';

interface Recommendation {
  title: string;
  year: string;
  type: 'movie' | 'tv';
  description: string;
  tmdbId?: number;
  posterPath?: string;
}

const DAILY_LIMIT = 3;

const EXAMPLES = [
  'a dark thriller from the 90s with a twist ending',
  'something like Parasite but set in America',
  'cosy comfort film to watch on a rainy Sunday',
  'mind-bending sci-fi with stunning visuals',
  'brutal crime drama from Scandinavia',
];

const EDGE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-recommender`;

function edgeHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
  };
}

export default function AIRecommenderPage({ onMediaClick, requireAuth }: { onMediaClick: (id: number, type: 'movie' | 'tv') => void; requireAuth?: (reason?: string) => void }) {
  const { user } = useAuth();
  const [prompt,          setPrompt]          = useState('');
  const [loading,         setLoading]         = useState(false);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [error,           setError]           = useState('');
  const [addedIds,        setAddedIds]        = useState<Set<number>>(new Set());
  const [used,            setUsed]            = useState(0);
  const [usageReady,      setUsageReady]      = useState(false);

  useEffect(() => {
    if (!user) return;
    fetch(EDGE_URL, { headers: edgeHeaders() })
      .then(r => r.json())
      .then(data => { setUsed(data.used ?? 0); setUsageReady(true); })
      .catch(() => setUsageReady(true));
  }, [user]);

  const remaining   = Math.max(0, DAILY_LIMIT - used);
  const limitReached = remaining === 0;

  async function getRecommendations() {
    if (!prompt.trim() || limitReached || loading) return;
    setLoading(true);
    setError('');
    setRecommendations([]);

    try {
      const res  = await fetch(EDGE_URL, {
        method: 'POST',
        headers: edgeHeaders(),
        body: JSON.stringify({ prompt: prompt.trim() }),
      });
      const data = await res.json();

      if (res.status === 429 || data.error === 'daily_limit_reached') {
        setUsed(DAILY_LIMIT);
        setLoading(false);
        return;
      }

      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      if (typeof data.used === 'number') setUsed(data.used);

      // Enrich with TMDB posters
      const enriched: Recommendation[] = await Promise.all(
        ((data.recommendations ?? []) as Recommendation[]).map(async rec => {
          try {
            const sr    = await tmdb.search(rec.title);
            const match = sr.results.find(r => r.media_type === 'movie' || r.media_type === 'tv');
            if (match) return { ...rec, tmdbId: match.id, posterPath: match.poster_path ?? undefined, type: (match.media_type as 'movie' | 'tv') ?? rec.type };
          } catch { /* skip */ }
          return rec;
        })
      );

      setRecommendations(enriched);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    }
    setLoading(false);
  }

  async function addToWatchlist(rec: Recommendation) {
    if (!user || !rec.tmdbId) return;
    await supabase.from('watchlist').upsert(
      { user_id: user.id, tmdb_id: rec.tmdbId, media_type: rec.type, title: rec.title, poster_path: rec.posterPath ?? '' },
      { onConflict: 'user_id,tmdb_id,media_type' }
    );
    setAddedIds(prev => new Set([...prev, rec.tmdbId!]));
  }

  if (!user) return (
    <div style={{ minHeight: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
      <div style={{ maxWidth: 420, textAlign: 'center' }}>
        <div style={{ width: 64, height: 64, background: '#1a1a1a', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
          <Sparkles size={28} color="#fbbf24" />
        </div>
        <h2 style={{ margin: '0 0 10px', color: '#fff', fontSize: 24, fontWeight: 700 }}>AI Film Recommender</h2>
        <p style={{ margin: '0 0 28px', color: '#888', fontSize: 15, lineHeight: 1.65 }}>
          Describe your mood and our AI will find the perfect film or show for you. Sign in to get started.
        </p>
        <button
          onClick={() => requireAuth?.('Sign in to use the AI recommender.')}
          className="btn-gold"
          style={{ padding: '12px 32px', fontSize: 14, borderRadius: 12 }}
        >
          Sign In to Continue
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#000', paddingBottom: 80 }} className="animate-fade-in">
      {/* Header */}
      <div style={{ borderBottom: '1px solid #1a1a1a', padding: '32px 32px 24px', maxWidth: 1400, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Sparkles size={22} color="#fbbf24" />
            <h1 style={{ margin: 0, color: '#fff', fontSize: 28, fontWeight: 700, letterSpacing: '-0.5px' }}>AI Recommender</h1>
          </div>
          {usageReady && <UsagePips used={used} limit={DAILY_LIMIT} />}
        </div>
        <p style={{ margin: '6px 0 0', color: '#555', fontSize: 14 }}>Describe what you're in the mood for and get personalised picks</p>
      </div>

      <div style={{ padding: '32px 32px 0', maxWidth: 720, margin: '0 auto' }}>
        {limitReached ? (
          <LimitReachedCard />
        ) : (
          <>
            <div style={{ position: 'relative', marginBottom: 6 }}>
              <textarea
                value={prompt} onChange={e => setPrompt(e.target.value)} rows={3}
                placeholder="e.g. a dark thriller from the 90s with a twist ending..."
                style={{ width: '100%', background: '#111', border: '1px solid #2e2e2e', borderRadius: 18, padding: '16px 52px 16px 16px', color: '#fff', fontSize: 14, outline: 'none', resize: 'none', fontFamily: 'inherit', transition: 'border-color .2s', boxSizing: 'border-box' }}
                onFocus={e  => (e.target.style.borderColor = '#f59e0b')}
                onBlur={e   => (e.target.style.borderColor = '#2e2e2e')}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); getRecommendations(); } }}
              />
              <button onClick={getRecommendations} disabled={loading || !prompt.trim()}
                style={{ position: 'absolute', bottom: 12, right: 12, width: 36, height: 36, borderRadius: 10, border: 'none', cursor: loading || !prompt.trim() ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .2s',
                  background: loading || !prompt.trim() ? '#2e2e2e' : '#f59e0b' }}>
                <Send size={14} color={loading || !prompt.trim() ? '#555' : '#000'} />
              </button>
            </div>
            {usageReady && (
              <p style={{ margin: '0 0 20px', color: '#555', fontSize: 12 }}>
                {remaining} of {DAILY_LIMIT} recommendations remaining today
              </p>
            )}
          </>
        )}

        {/* Examples */}
        {recommendations.length === 0 && !loading && !limitReached && (
          <div style={{ marginBottom: 24 }}>
            <p style={{ margin: '0 0 10px', color: '#555', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Try asking for...</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {EXAMPLES.map(ex => (
                <button key={ex} onClick={() => setPrompt(ex)}
                  style={{ textAlign: 'left', padding: '11px 14px', background: '#111', border: '1px solid #1a1a1a', borderRadius: 14, cursor: 'pointer', fontSize: 13, color: '#bbb', transition: 'all .2s', fontFamily: 'inherit' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(245,158,11,.4)'; (e.currentTarget as HTMLButtonElement).style.color = '#fff'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#1a1a1a'; (e.currentTarget as HTMLButtonElement).style.color = '#bbb'; }}>
                  "{ex}"
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div style={{ padding: '48px 0', textAlign: 'center' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              {[0, 150, 300].map(delay => (
                <div key={delay} style={{ width: 8, height: 8, background: '#f59e0b', borderRadius: '50%', animation: `bounceDot 1.4s ${delay}ms infinite` }} />
              ))}
            </div>
            <p style={{ margin: 0, color: '#888', fontSize: 14 }}>Finding the perfect picks for you...</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 14, padding: '12px 16px', marginBottom: 16 }}>
            <p style={{ margin: 0, color: '#f87171', fontSize: 14 }}>{error}</p>
          </div>
        )}

        {/* Results */}
        {recommendations.length > 0 && (
          <div className="animate-slide-up">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <Sparkles size={14} color="#fbbf24" />
              <p style={{ margin: 0, color: '#ccc', fontSize: 13 }}>3 picks based on your request</p>
            </div>
            {recommendations.map((rec, idx) => (
              <RecCard
                key={idx} rec={rec}
                isAdded={!!rec.tmdbId && addedIds.has(rec.tmdbId)}
                onAdd={() => addToWatchlist(rec)}
                onView={() => rec.tmdbId && onMediaClick(rec.tmdbId, rec.type)}
              />
            ))}
            <button onClick={() => { setRecommendations([]); setPrompt(''); }}
              style={{ width: '100%', padding: '12px', background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 13, marginTop: 4, fontFamily: 'inherit' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
              onMouseLeave={e => (e.currentTarget.style.color = '#888')}>
              Ask again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function UsagePips({ used, limit }: { used: number; limit: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      {Array.from({ length: limit }).map((_, i) => (
        <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: i < used ? '#2e2e2e' : '#f59e0b', border: i < used ? '1px solid #3a3a3a' : 'none', transition: 'background .3s' }} />
      ))}
    </div>
  );
}

function LimitReachedCard() {
  const now        = new Date();
  const midnight   = new Date(now.toDateString());
  midnight.setDate(midnight.getDate() + 1);
  const hoursLeft  = Math.ceil((midnight.getTime() - now.getTime()) / 3600000);
  return (
    <div style={{ background: '#111', borderRadius: 20, border: '1px solid #1a1a1a', padding: 32, textAlign: 'center', marginTop: 8 }}>
      <div style={{ width: 52, height: 52, background: '#1a1a1a', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
        <Lock size={22} color="#888" />
      </div>
      <h3 style={{ margin: '0 0 8px', color: '#fff', fontSize: 17, fontWeight: 600 }}>All recommendations used for today</h3>
      <p style={{ margin: '0 0 20px', color: '#888', fontSize: 14, lineHeight: 1.65 }}>
        You've used all 3 AI recommendations for today.<br />Come back tomorrow for 3 more.
      </p>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(245,158,11,.1)', border: '1px solid rgba(245,158,11,.2)', borderRadius: 20, padding: '6px 14px' }}>
        <Sparkles size={13} color="#fbbf24" />
        <span style={{ color: '#fbbf24', fontSize: 13, fontWeight: 500 }}>Resets in ~{hoursLeft}h</span>
      </div>
    </div>
  );
}

function RecCard({ rec, isAdded, onAdd, onView }: { rec: Recommendation; isAdded: boolean; onAdd: () => void; onView: () => void }) {
  const poster = rec.posterPath ? posterUrl(rec.posterPath) : null;
  return (
    <div style={{ background: '#111', borderRadius: 20, border: '1px solid #1a1a1a', overflow: 'hidden', marginBottom: 14 }}>
      <div style={{ display: 'flex', gap: 12, padding: '14px 14px 0' }}>
        <div style={{ flexShrink: 0, width: 82, borderRadius: 10, overflow: 'hidden', background: '#1a1a1a', aspectRatio: '2/3', cursor: poster ? 'pointer' : 'default' }} onClick={onView}>
          {poster
            ? <img src={poster} alt={rec.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Film size={22} color="#555" /></div>}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 onClick={onView}
            style={{ margin: '0 0 4px', color: '#fff', fontWeight: 600, fontSize: 15, cursor: 'pointer', transition: 'color .2s' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#fbbf24')}
            onMouseLeave={e => (e.currentTarget.style.color = '#fff')}>
            {rec.title}
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            {rec.year && <span style={{ color: '#888', fontSize: 12 }}>{rec.year}</span>}
            <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 600,
              background: rec.type === 'movie' ? 'rgba(245,158,11,.15)' : 'rgba(59,130,246,.15)',
              color:      rec.type === 'movie' ? '#fbbf24'              : '#60a5fa' }}>
              {rec.type === 'movie' ? 'Film' : 'TV'}
            </span>
          </div>
          <p style={{ margin: 0, color: '#aaa', fontSize: 12, lineHeight: 1.6 }}>{rec.description}</p>
        </div>
      </div>
      <div style={{ padding: '10px 14px 14px' }}>
        <button onClick={onAdd} disabled={isAdded || !rec.tmdbId}
          style={isAdded
            ? { width: '100%', padding: '9px', borderRadius: 12, border: '1px solid rgba(34,197,94,.3)', background: 'rgba(34,197,94,.1)', color: '#4ade80', cursor: 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, fontSize: 13, fontWeight: 500 }
            : { width: '100%', padding: '9px', borderRadius: 12, border: 'none', background: rec.tmdbId ? '#f59e0b' : '#2e2e2e', color: rec.tmdbId ? '#000' : '#555', cursor: rec.tmdbId ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, fontSize: 13, fontWeight: 600, transition: 'background .2s' }}>
          {isAdded ? <><Check size={13} /> Added to Watchlist</> : <><Plus size={13} /> Add to Watchlist</>}
        </button>
      </div>
    </div>
  );
}
