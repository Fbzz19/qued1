import { useEffect, useState } from 'react';
import { ArrowLeft, Film } from 'lucide-react';
import { tmdb, posterUrl, profileUrl } from '../lib/tmdb';
import type { TMDBPerson } from '../lib/tmdb';

interface Props {
  id: number;
  onBack: () => void;
  onMediaClick: (id: number, type: 'movie' | 'tv') => void;
}

export default function ActorPage({ id, onBack, onMediaClick }: Props) {
  const [person,      setPerson]      = useState<TMDBPerson | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [showFullBio, setShowFullBio] = useState(false);

  useEffect(() => {
    tmdb.personDetails(id).then(d => { setPerson(d); setLoading(false); });
  }, [id]);

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#000' }}>
      <div style={{ position: 'sticky', top: 0, background: '#000', borderBottom: '1px solid #1a1a1a', padding: '12px 16px' }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
          <ArrowLeft size={18} /> Back
        </button>
      </div>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px clamp(16px,4vw,48px)' }}>
        <div style={{ display: 'flex', gap: 32 }}>
          <div className="shimmer" style={{ width: 160, height: 200, borderRadius: 16, flexShrink: 0 }} />
          <div style={{ flex: 1, paddingTop: 8 }}>
            <div className="shimmer" style={{ height: 32, width: '50%', borderRadius: 4, marginBottom: 10 }} />
            <div className="shimmer" style={{ height: 16, width: '30%', borderRadius: 4 }} />
          </div>
        </div>
      </div>
    </div>
  );

  if (!person) return null;

  const photo   = profileUrl(person.profile_path, 'w342');
  const credits = (person.combined_credits?.cast ?? [])
    .filter(c => c.poster_path && (c.media_type === 'movie' || c.media_type === 'tv'))
    .sort((a, b) => {
      const ya = (a.release_date || a.first_air_date || '').slice(0, 4);
      const yb = (b.release_date || b.first_air_date || '').slice(0, 4);
      return yb.localeCompare(ya);
    })
    .slice(0, 50);

  const BIO_LIMIT = 500;
  const bioTruncated = person.biography && person.biography.length > BIO_LIMIT;

  return (
    <div style={{ minHeight: '100vh', background: '#000', paddingBottom: 96 }} className="animate-fade-in">
      <div style={{ position: 'sticky', top: 56, zIndex: 10, background: 'rgba(0,0,0,.9)', backdropFilter: 'blur(8px)', borderBottom: '1px solid #1a1a1a', padding: '12px clamp(16px,4vw,48px)' }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontFamily: 'inherit' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
          onMouseLeave={e => (e.currentTarget.style.color = '#888')}>
          <ArrowLeft size={18} /> Back
        </button>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px clamp(16px,4vw,48px) 0' }}>
        {/* Two-column on desktop */}
        <div style={{ display: 'flex', gap: 'clamp(20px,4vw,48px)', alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 40 }}>

          {/* Left: photo + vitals */}
          <div style={{ flexShrink: 0, width: 'clamp(140px,18vw,220px)' }}>
            <div style={{ borderRadius: 18, overflow: 'hidden', background: '#1a1a1a', border: '2px solid #2e2e2e', marginBottom: 16 }}>
              {photo
                ? <img src={photo} alt={person.name} style={{ width: '100%', display: 'block' }} />
                : <div style={{ aspectRatio: '2/3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ color: '#888', fontSize: 48, fontWeight: 700 }}>{person.name[0]}</span>
                  </div>}
            </div>
            {person.known_for_department && <p style={{ margin: '0 0 6px', color: '#fbbf24', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{person.known_for_department}</p>}
            {person.birthday       && <p style={{ margin: '0 0 3px', color: '#888', fontSize: 12 }}>Born {person.birthday}</p>}
            {person.place_of_birth && <p style={{ margin: 0, color: '#888', fontSize: 12 }}>{person.place_of_birth}</p>}
          </div>

          {/* Right: name + bio */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ margin: '0 0 20px', color: '#fff', fontSize: 'clamp(24px,4vw,40px)', fontWeight: 800, letterSpacing: '-0.5px' }}>{person.name}</h1>

            {person.biography && (
              <div>
                <h2 style={{ margin: '0 0 10px', color: '#555', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.12em' }}>Biography</h2>
                <p style={{ margin: 0, color: '#ccc', fontSize: 14, lineHeight: 1.7 }}>
                  {showFullBio || !bioTruncated ? person.biography : `${person.biography.slice(0, BIO_LIMIT)}...`}
                </p>
                {bioTruncated && (
                  <button onClick={() => setShowFullBio(!showFullBio)}
                    style={{ background: 'none', border: 'none', color: '#fbbf24', fontSize: 13, cursor: 'pointer', marginTop: 8, padding: 0, fontFamily: 'inherit' }}>
                    {showFullBio ? 'Show less' : 'Read more'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Filmography */}
        {credits.length > 0 && (
          <div>
            <h2 style={{ margin: '0 0 16px', color: '#555', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.12em' }}>
              Filmography <span style={{ color: '#3a3a3a', fontWeight: 400 }}>({credits.length})</span>
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(clamp(80px,10vw,130px), 1fr))', gap: 10 }}>
              {credits.map(item => {
                const mediaType = item.media_type as 'movie' | 'tv';
                const url       = posterUrl(item.poster_path);
                const title     = item.title || item.name || '';
                const year      = (item.release_date || item.first_air_date || '').slice(0, 4);
                return (
                  <div key={`${item.id}-${item.media_type}`} className="poster-card" style={{ aspectRatio: '2/3' }} onClick={() => onMediaClick(item.id, mediaType)}>
                    {url
                      ? <img src={url} alt={title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                      : <div style={{ width: '100%', height: '100%', background: '#1a1a1a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, padding: 8 }}>
                          <Film size={20} color="#555" />
                          <p style={{ margin: 0, color: '#888', fontSize: 10, textAlign: 'center' }}>{title}</p>
                        </div>}
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,.85), transparent)', opacity: 0, transition: 'opacity .2s' }}
                      onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                      onMouseLeave={e => (e.currentTarget.style.opacity = '0')}>
                      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '8px 8px 6px' }}>
                        <p style={{ margin: '0 0 2px', color: '#fff', fontSize: 11, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</p>
                        {year && <p style={{ margin: 0, color: '#888', fontSize: 10 }}>{year}</p>}
                      </div>
                    </div>
                    <div style={{ position: 'absolute', top: 5, right: 5 }}>
                      <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, fontWeight: 600, background: mediaType === 'movie' ? 'rgba(245,158,11,.8)' : 'rgba(59,130,246,.8)', color: mediaType === 'movie' ? '#000' : '#fff' }}>
                        {mediaType === 'movie' ? 'Film' : 'TV'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
