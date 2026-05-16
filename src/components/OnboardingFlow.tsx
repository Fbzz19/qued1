import { useState } from 'react';
import { Film, Tv, Check, ChevronRight, X, Star, Sparkles, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

interface OnboardingFlowProps {
  onComplete: () => void;
}

const GENRES = [
  { id: 'action', label: 'Action', emoji: '💥' },
  { id: 'comedy', label: 'Comedy', emoji: '😂' },
  { id: 'drama', label: 'Drama', emoji: '🎭' },
  { id: 'thriller', label: 'Thriller', emoji: '😰' },
  { id: 'horror', label: 'Horror', emoji: '👻' },
  { id: 'sci-fi', label: 'Sci-Fi', emoji: '🚀' },
  { id: 'romance', label: 'Romance', emoji: '💕' },
  { id: 'documentary', label: 'Documentary', emoji: '🎬' },
  { id: 'animation', label: 'Animation', emoji: '✨' },
  { id: 'fantasy', label: 'Fantasy', emoji: '🧙' },
  { id: 'crime', label: 'Crime', emoji: '🔍' },
  { id: 'adventure', label: 'Adventure', emoji: '🗺️' },
];

export default function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [completing, setCompleting] = useState(false);

  const totalSteps = 4;

  async function finish() {
    if (!user) return;
    setCompleting(true);
    await supabase.from('onboarding_completed').upsert(
      { user_id: user.id, genres: selectedGenres, completed_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    );
    onComplete();
  }

  function toggleGenre(id: string) {
    setSelectedGenres(gs => gs.includes(id) ? gs.filter(g => g !== id) : [...gs, id]);
  }

  const steps = [
    // Step 0: Welcome
    (
      <div style={{ textAlign: 'center', padding: '20px 0' }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(245,158,11,.1)', border: '2px solid rgba(245,158,11,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
          <Film size={32} color="#f59e0b" />
        </div>
        <h2 style={{ margin: '0 0 10px', color: '#fff', fontSize: 26, fontWeight: 800 }}>Welcome to Qued</h2>
        <p style={{ margin: '0 0 28px', color: '#888', fontSize: 15, lineHeight: 1.6 }}>
          Track every film and show you watch, discover what friends are watching, and get personalised recommendations.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 28 }}>
          {[
            { icon: <Film size={18} color="#f59e0b" />, label: 'Track Films' },
            { icon: <Tv size={18} color="#60a5fa" />, label: 'Track Shows' },
            { icon: <Sparkles size={18} color="#a78bfa" />, label: 'AI Picks' },
          ].map(({ icon, label }) => (
            <div key={label} style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 12, padding: '14px 10px', textAlign: 'center' }}>
              <div style={{ marginBottom: 8 }}>{icon}</div>
              <span style={{ color: '#ccc', fontSize: 12, fontWeight: 500 }}>{label}</span>
            </div>
          ))}
        </div>
        <button onClick={() => setStep(1)} className="btn-gold" style={{ width: '100%', padding: '14px', borderRadius: 12, fontSize: 15, fontWeight: 600 }}>
          Get Started <ChevronRight size={16} style={{ display: 'inline', marginLeft: 4 }} />
        </button>
      </div>
    ),

    // Step 1: Genres
    (
      <div>
        <h2 style={{ margin: '0 0 6px', color: '#fff', fontSize: 22, fontWeight: 700 }}>What do you love watching?</h2>
        <p style={{ margin: '0 0 20px', color: '#888', fontSize: 14 }}>Pick your favourite genres — we'll tailor your recommendations.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 24 }}>
          {GENRES.map(g => {
            const selected = selectedGenres.includes(g.id);
            return (
              <button
                key={g.id}
                onClick={() => toggleGenre(g.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
                  background: selected ? 'rgba(245,158,11,.1)' : '#111',
                  border: `1px solid ${selected ? 'rgba(245,158,11,.5)' : '#1e1e1e'}`,
                  borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s',
                  position: 'relative',
                }}
              >
                <span style={{ fontSize: 16 }}>{g.emoji}</span>
                <span style={{ color: selected ? '#fbbf24' : '#aaa', fontSize: 12, fontWeight: selected ? 600 : 400 }}>{g.label}</span>
                {selected && (
                  <div style={{ position: 'absolute', top: 5, right: 5, width: 14, height: 14, borderRadius: '50%', background: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Check size={8} color="#000" strokeWidth={3} />
                  </div>
                )}
              </button>
            );
          })}
        </div>
        <button
          onClick={() => setStep(2)}
          className="btn-gold"
          style={{ width: '100%', padding: '13px', borderRadius: 12, fontSize: 14, fontWeight: 600 }}
          disabled={selectedGenres.length === 0}
        >
          Continue ({selectedGenres.length} selected)
        </button>
        <button onClick={() => setStep(2)} style={{ display: 'block', width: '100%', marginTop: 10, background: 'none', border: 'none', cursor: 'pointer', color: '#555', fontSize: 13, fontFamily: 'inherit', padding: '8px' }}>
          Skip for now
        </button>
      </div>
    ),

    // Step 2: Social
    (
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(96,165,250,.1)', border: '2px solid rgba(96,165,250,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
          <Users size={28} color="#60a5fa" />
        </div>
        <h2 style={{ margin: '0 0 10px', color: '#fff', fontSize: 22, fontWeight: 700 }}>Discover Your Community</h2>
        <p style={{ margin: '0 0 24px', color: '#888', fontSize: 14, lineHeight: 1.6 }}>
          See what friends are watching in real time. Follow members, like their reviews, and share your own takes.
        </p>
        <div style={{ display: 'grid', gap: 10, marginBottom: 28 }}>
          {[
            { icon: <Users size={16} color="#60a5fa" />, text: 'Follow other Qued members' },
            { icon: <Star size={16} color="#fbbf24" />, text: 'Rate films from 0.5 to 5 stars' },
            { icon: <Film size={16} color="#f59e0b" />, text: 'Create custom watch lists' },
          ].map(({ icon, text }) => (
            <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#111', border: '1px solid #1e1e1e', borderRadius: 12, padding: '12px 16px' }}>
              {icon}
              <span style={{ color: '#ccc', fontSize: 13 }}>{text}</span>
            </div>
          ))}
        </div>
        <button onClick={() => setStep(3)} className="btn-gold" style={{ width: '100%', padding: '13px', borderRadius: 12, fontSize: 14, fontWeight: 600 }}>
          Next <ChevronRight size={15} style={{ display: 'inline', marginLeft: 4 }} />
        </button>
      </div>
    ),

    // Step 3: Ready
    (
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(34,197,94,.1)', border: '2px solid rgba(34,197,94,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
          <Check size={32} color="#22c55e" strokeWidth={2.5} />
        </div>
        <h2 style={{ margin: '0 0 10px', color: '#fff', fontSize: 24, fontWeight: 800 }}>You're all set!</h2>
        <p style={{ margin: '0 0 28px', color: '#888', fontSize: 14, lineHeight: 1.6 }}>
          Start by logging a film you've recently watched, or explore what's trending right now.
        </p>
        <button
          onClick={finish}
          disabled={completing}
          className="btn-gold"
          style={{ width: '100%', padding: '14px', borderRadius: 12, fontSize: 15, fontWeight: 600 }}
        >
          {completing ? 'Starting...' : 'Start Exploring'}
        </button>
      </div>
    ),
  ];

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 600, padding: '24px 16px' }}>
      <div style={{ background: '#0a0a0a', border: '1px solid #1e1e1e', borderRadius: 20, padding: '28px 28px 24px', width: '100%', maxWidth: 440, position: 'relative', maxHeight: '90vh', overflowY: 'auto' }} className="no-scrollbar">

        {/* Skip / close */}
        <button
          onClick={finish}
          style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', cursor: 'pointer', color: '#555', display: 'flex', padding: 6 }}
          title="Skip onboarding"
        >
          <X size={16} />
        </button>

        {/* Progress dots */}
        {step > 0 && (
          <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 24 }}>
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div key={i} style={{ width: i < step ? 16 : 6, height: 6, borderRadius: 3, background: i < step ? '#f59e0b' : i === step ? '#555' : '#222', transition: 'all .3s' }} />
            ))}
          </div>
        )}

        {steps[step]}
      </div>
    </div>
  );
}
