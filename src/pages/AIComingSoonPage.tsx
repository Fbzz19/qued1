import { useState, useEffect } from 'react';
import { Sparkles, Brain, Wand as Wand2, Mail, Check, Zap, Star, Film } from 'lucide-react';
import { supabase } from '../lib/supabase';

const PROMPTS = [
  '"A slow-burn psychological thriller set in rural Japan"',
  '"Something warm and funny for a rainy Sunday night"',
  '"Like Blade Runner but more emotional and hopeful"',
  '"A gripping heist film with a twist ending"',
  '"Comfort cinema — films that feel like a hug"',
];

export default function AIComingSoonPage() {
  const [email,      setEmail]      = useState('');
  const [submitted,  setSubmitted]  = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');
  const [promptIdx,  setPromptIdx]  = useState(0);
  const [visible,    setVisible]    = useState(true);

  useEffect(() => {
    const id = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setPromptIdx(i => (i + 1) % PROMPTS.length);
        setVisible(true);
      }, 400);
    }, 3000);
    return () => clearInterval(id);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError('');
    const { error: dbErr } = await supabase.from('notification_emails').insert({ email: email.trim().toLowerCase() });
    if (dbErr && dbErr.code !== '23505') {
      setError('Something went wrong. Please try again.');
    } else {
      setSubmitted(true);
    }
    setLoading(false);
  }

  return (
    <div style={{ minHeight: '100vh', background: '#000', paddingBottom: 80, overflowX: 'hidden' }} className="animate-fade-in">
      {/* Ambient background glow */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
        <div style={{ position: 'absolute', top: '10%', left: '50%', transform: 'translateX(-50%)', width: 600, height: 400, background: 'radial-gradient(ellipse, rgba(245,158,11,.07) 0%, transparent 70%)', filter: 'blur(40px)' }} />
        <div style={{ position: 'absolute', top: '40%', left: '20%', width: 300, height: 300, background: 'radial-gradient(ellipse, rgba(245,158,11,.04) 0%, transparent 70%)', filter: 'blur(60px)' }} />
        <div style={{ position: 'absolute', top: '30%', right: '15%', width: 250, height: 250, background: 'radial-gradient(ellipse, rgba(251,191,36,.04) 0%, transparent 70%)', filter: 'blur(50px)' }} />
      </div>

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 860, margin: '0 auto', padding: '56px clamp(20px,4vw,48px)' }}>

        {/* Coming Soon badge */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 40 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(245,158,11,.1)', border: '1px solid rgba(245,158,11,.3)', borderRadius: 100, padding: '6px 18px', animation: 'pulse 3s ease-in-out infinite' }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#f59e0b', animation: 'pulse 1.5s ease-in-out infinite' }} />
            <span style={{ color: '#f59e0b', fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Coming Soon</span>
          </div>
        </div>

        {/* Hero icon */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 32 }}>
          <div style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', inset: -20, borderRadius: '50%', background: 'radial-gradient(circle, rgba(245,158,11,.2) 0%, transparent 70%)', animation: 'pulse 2.5s ease-in-out infinite' }} />
            <div style={{
              width: 88, height: 88, borderRadius: 24,
              background: 'linear-gradient(135deg, #1a1a1a 0%, #0d0d0d 100%)',
              border: '1px solid rgba(245,158,11,.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 40px rgba(245,158,11,.2), inset 0 1px 0 rgba(245,158,11,.15)',
              position: 'relative',
            }}>
              <Brain size={40} color="#f59e0b" />
            </div>
          </div>
        </div>

        {/* Title */}
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 12 }}>
            <Sparkles size={16} color="#f59e0b" />
            <span style={{ color: '#f59e0b', fontSize: 13, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>QuedAI</span>
          </div>
          <h1 style={{ margin: '0 0 18px', color: '#fff', fontSize: 'clamp(32px,6vw,56px)', fontWeight: 800, letterSpacing: '-1.5px', lineHeight: 1.05 }}>
            Film discovery,<br />
            <span style={{ background: 'linear-gradient(90deg, #f59e0b, #fbbf24)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>powered by AI.</span>
          </h1>
          <p style={{ margin: '0 auto', color: '#666', fontSize: 'clamp(15px,2vw,18px)', lineHeight: 1.7, maxWidth: 520 }}>
            AI-powered recommendations, mood-based discovery, and personalized viewing suggestions — all tailored to your unique taste.
          </p>
        </div>

        {/* Animated prompt showcase */}
        <div style={{ marginBottom: 48 }}>
          <div style={{
            position: 'relative',
            background: 'rgba(13,13,13,.9)',
            border: '1px solid #1a1a1a',
            borderRadius: 20,
            padding: '28px 32px',
            backdropFilter: 'blur(20px)',
            overflow: 'hidden',
          }}>
            {/* Subtle top border glow */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: 'linear-gradient(90deg, transparent, rgba(245,158,11,.4), transparent)' }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(245,158,11,.1)', border: '1px solid rgba(245,158,11,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Wand2 size={15} color="#f59e0b" />
              </div>
              <div>
                <p style={{ margin: 0, color: '#fff', fontSize: 12, fontWeight: 700 }}>Try asking QuedAI...</p>
                <p style={{ margin: 0, color: '#444', fontSize: 11 }}>Describe your mood, genre, or vibe</p>
              </div>
            </div>

            {/* Animated prompt */}
            <div style={{ background: '#111', border: '1px solid #222', borderRadius: 12, padding: '14px 18px', minHeight: 48, display: 'flex', alignItems: 'center' }}>
              <p style={{
                margin: 0, color: '#888', fontSize: 14, fontStyle: 'italic',
                opacity: visible ? 1 : 0,
                transform: visible ? 'translateY(0)' : 'translateY(6px)',
                transition: 'opacity 0.4s ease, transform 0.4s ease',
              }}>
                {PROMPTS[promptIdx]}
              </p>
            </div>

            {/* Disabled launch button */}
            <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                disabled
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '11px 24px', borderRadius: 12,
                  background: 'rgba(245,158,11,.06)',
                  border: '1px solid rgba(245,158,11,.2)',
                  color: 'rgba(245,158,11,.4)',
                  fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
                  cursor: 'not-allowed',
                }}
              >
                <Sparkles size={14} />
                Launching Soon
              </button>
              <span style={{ color: '#333', fontSize: 12 }}>Available to all Qued members</span>
            </div>
          </div>
        </div>

        {/* Feature pills */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginBottom: 56 }}>
          {[
            { icon: <Brain size={13} color="#f59e0b" />, label: 'Mood-based search' },
            { icon: <Zap size={13} color="#f59e0b" />, label: 'Instant results' },
            { icon: <Star size={13} color="#f59e0b" />, label: 'Taste-aware AI' },
            { icon: <Film size={13} color="#f59e0b" />, label: 'Films & TV shows' },
            { icon: <Sparkles size={13} color="#f59e0b" />, label: 'Free for members' },
          ].map(f => (
            <div key={f.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 100, padding: '7px 14px' }}>
              {f.icon}
              <span style={{ color: '#888', fontSize: 12, fontWeight: 500 }}>{f.label}</span>
            </div>
          ))}
        </div>

        {/* Email waitlist */}
        <div style={{
          background: 'rgba(13,13,13,.8)',
          border: '1px solid #1a1a1a',
          borderRadius: 24,
          padding: 'clamp(28px,4vw,48px)',
          textAlign: 'center',
          backdropFilter: 'blur(20px)',
          position: 'relative',
          overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: 'linear-gradient(90deg, transparent, rgba(245,158,11,.3), transparent)' }} />

          {submitted ? (
            <div className="animate-slide-up" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(74,222,128,.1)', border: '1px solid rgba(74,222,128,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Check size={22} color="#4ade80" />
              </div>
              <div>
                <p style={{ margin: '0 0 6px', color: '#4ade80', fontSize: 17, fontWeight: 700 }}>You're on the list!</p>
                <p style={{ margin: 0, color: '#555', fontSize: 14 }}>We'll notify you the moment QuedAI goes live.</p>
              </div>
            </div>
          ) : (
            <>
              <p style={{ margin: '0 0 6px', color: '#fff', fontSize: 17, fontWeight: 700 }}>Be first to try QuedAI</p>
              <p style={{ margin: '0 0 24px', color: '#555', fontSize: 14 }}>Join the waitlist and get notified at launch.</p>
              <form onSubmit={handleSubmit}>
                <div style={{ display: 'flex', gap: 10, maxWidth: 440, margin: '0 auto', flexWrap: 'wrap' }}>
                  <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
                    <Mail size={14} color="#555" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                    <input
                      type="email" required value={email} onChange={e => setEmail(e.target.value)}
                      placeholder="your@email.com"
                      style={{ width: '100%', background: '#111', border: '1px solid #2e2e2e', borderRadius: 12, padding: '13px 14px 13px 38px', color: '#fff', fontSize: 14, outline: 'none', fontFamily: 'inherit', transition: 'border-color .2s', boxSizing: 'border-box' }}
                      onFocus={e => (e.target.style.borderColor = '#f59e0b')}
                      onBlur={e  => (e.target.style.borderColor = '#2e2e2e')}
                    />
                  </div>
                  <button type="submit" disabled={loading} className="btn-gold" style={{ padding: '13px 22px', borderRadius: 12, fontSize: 14, flexShrink: 0 }}>
                    {loading ? '...' : 'Notify Me'}
                  </button>
                </div>
                {error && <p style={{ margin: '10px 0 0', color: '#f87171', fontSize: 12 }}>{error}</p>}
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
