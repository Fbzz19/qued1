import { useState } from 'react';
import { ArrowLeft, Crown, ChartBar as BarChart2, Palette, Star, Zap, Shield, Check, Sparkles, Lock, ListVideo, Mail } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

interface ProPageProps {
  onBack: () => void;
  onUpgrade: () => void;
}

const PRO_FEATURES = [
  {
    icon: <BarChart2 size={22} color="#f59e0b" />,
    title: 'Advanced Stats',
    description: 'Genre breakdowns, rating trends, streaks, top directors and actors — your film life, quantified.',
  },
  {
    icon: <ListVideo size={22} color="#f59e0b" />,
    title: 'Unlimited Custom Lists',
    description: 'Create as many lists as you need. Organise your library exactly the way you want.',
  },
  {
    icon: <Sparkles size={22} color="#f59e0b" />,
    title: 'Enhanced AI',
    description: 'Unlimited QuedAI searches per day with deeper, more personalised recommendations.',
  },
  {
    icon: <Palette size={22} color="#f59e0b" />,
    title: 'Exclusive Profile Customisation',
    description: 'Custom accent colours, profile themes, and a gold Pro badge across your reviews and lists.',
  },
  {
    icon: <Zap size={22} color="#f59e0b" />,
    title: 'Early Access Features',
    description: 'Be first to try everything new before it rolls out to all users.',
  },
  {
    icon: <Shield size={22} color="#f59e0b" />,
    title: 'Ad-Free Experience',
    description: 'Browse Qued completely ad-free, everywhere on the platform.',
  },
  {
    icon: <Star size={22} color="#f59e0b" />,
    title: 'Priority Support',
    description: 'Jump the queue with dedicated support from the Qued team.',
  },
  {
    icon: <Crown size={22} color="#f59e0b" />,
    title: 'Pro Badge',
    description: 'A distinctive gold badge on your profile that sets you apart.',
  },
];

export default function ProPage({ onBack }: ProPageProps) {
  const { profile } = useAuth();
  const isPro = profile?.role === 'pro' || profile?.role === 'admin';
  const [email,     setEmail]     = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');

  async function handleNotify(e: React.FormEvent) {
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
    <div style={{ minHeight: '100vh', background: '#000', paddingBottom: 96, overflowX: 'hidden' }} className="animate-fade-in">
      {/* Ambient glow */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
        <div style={{ position: 'absolute', top: '5%', left: '50%', transform: 'translateX(-50%)', width: 700, height: 500, background: 'radial-gradient(ellipse, rgba(245,158,11,.06) 0%, transparent 70%)', filter: 'blur(60px)' }} />
        <div style={{ position: 'absolute', bottom: '20%', right: '10%', width: 300, height: 300, background: 'radial-gradient(ellipse, rgba(251,191,36,.04) 0%, transparent 70%)', filter: 'blur(50px)' }} />
      </div>

      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* Back nav */}
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px clamp(20px,4vw,48px) 0' }}>
          <button onClick={onBack} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#666', fontSize: 14, fontFamily: 'inherit', padding: 0, transition: 'color .2s' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
            onMouseLeave={e => (e.currentTarget.style.color = '#666')}>
            <ArrowLeft size={16} /> Back
          </button>
        </div>

        {/* Hero */}
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '40px clamp(20px,4vw,48px) 56px', textAlign: 'center' }}>
          {/* Coming Soon badge */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(245,158,11,.1)', border: '1px solid rgba(245,158,11,.3)', borderRadius: 100, padding: '6px 18px' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#f59e0b', animation: 'pulse 1.5s ease-in-out infinite' }} />
              <span style={{ color: '#f59e0b', fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Coming Soon</span>
            </div>
          </div>

          {/* Crown icon with glow ring */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 32 }}>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', inset: -24, borderRadius: '50%', background: 'radial-gradient(circle, rgba(245,158,11,.18) 0%, transparent 70%)', animation: 'pulse 3s ease-in-out infinite' }} />
              <div style={{
                width: 88, height: 88, borderRadius: 24,
                background: 'linear-gradient(135deg, #1a1505 0%, #0d0d0d 100%)',
                border: '1px solid rgba(245,158,11,.45)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 0 48px rgba(245,158,11,.25), inset 0 1px 0 rgba(245,158,11,.2)',
                position: 'relative',
              }}>
                <Crown size={40} color="#f59e0b" />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 14 }}>
            <Crown size={15} color="#f59e0b" />
            <span style={{ color: '#f59e0b', fontSize: 13, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Qued Pro</span>
          </div>

          <h1 style={{ margin: '0 0 18px', color: '#fff', fontSize: 'clamp(32px,6vw,56px)', fontWeight: 800, letterSpacing: '-1.5px', lineHeight: 1.05 }}>
            Your film obsession,<br />
            <span style={{ background: 'linear-gradient(90deg, #f59e0b 0%, #fbbf24 50%, #f59e0b 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              elevated.
            </span>
          </h1>

          <p style={{ margin: '0 auto 40px', color: '#666', fontSize: 'clamp(15px,2vw,18px)', lineHeight: 1.7, maxWidth: 540 }}>
            Everything you need to track, discover, and obsess over films and TV — taken to the next level.
          </p>

          {isPro ? (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: 'rgba(245,158,11,.12)', border: '1px solid rgba(245,158,11,.3)', borderRadius: 14, padding: '14px 28px' }}>
              <Crown size={18} color="#f59e0b" />
              <span style={{ color: '#fbbf24', fontSize: 15, fontWeight: 700 }}>You're a Pro member</span>
            </div>
          ) : (
            /* Disabled CTA — coming soon */
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
              <button
                disabled
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 10,
                  padding: '15px 36px', borderRadius: 14,
                  background: 'rgba(245,158,11,.08)',
                  border: '1px solid rgba(245,158,11,.25)',
                  color: 'rgba(245,158,11,.4)',
                  fontSize: 16, fontWeight: 700, fontFamily: 'inherit',
                  cursor: 'not-allowed',
                  boxShadow: '0 0 32px rgba(245,158,11,.08)',
                }}
              >
                <Lock size={17} />
                Coming Soon
              </button>
              <span style={{ color: '#444', fontSize: 13 }}>Launching soon — join the waitlist below</span>
            </div>
          )}
        </div>

        {/* Features grid */}
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 clamp(20px,4vw,48px) 56px' }}>
          {/* Gradient border card wrapper */}
          <div style={{
            position: 'relative',
            borderRadius: 24,
            padding: 1,
            background: 'linear-gradient(135deg, rgba(245,158,11,.4) 0%, rgba(245,158,11,.08) 40%, rgba(245,158,11,.15) 70%, rgba(245,158,11,.4) 100%)',
          }}>
            <div style={{ background: '#080808', borderRadius: 23, padding: 'clamp(24px,4vw,40px)' }}>
              <h2 style={{ margin: '0 0 28px', color: '#fff', fontSize: 17, fontWeight: 700, textAlign: 'center' }}>What's included in Pro</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
                {PRO_FEATURES.map(feat => (
                  <div key={feat.title} style={{
                    display: 'flex', gap: 14, padding: '18px 20px',
                    background: 'rgba(255,255,255,.025)',
                    border: '1px solid rgba(255,255,255,.06)',
                    borderRadius: 14,
                    transition: 'border-color .2s, background .2s',
                  }}
                    onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(245,158,11,.2)'; (e.currentTarget as HTMLDivElement).style.background = 'rgba(245,158,11,.04)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,.06)'; (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,.025)'; }}
                  >
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {feat.icon}
                    </div>
                    <div>
                      <p style={{ margin: '0 0 4px', color: '#fff', fontSize: 14, fontWeight: 600 }}>{feat.title}</p>
                      <p style={{ margin: 0, color: '#555', fontSize: 12, lineHeight: 1.55 }}>{feat.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Comparison row */}
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 clamp(20px,4vw,48px) 56px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {/* Free tier */}
            <div style={{ background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 20, padding: '28px 24px' }}>
              <p style={{ margin: '0 0 4px', color: '#888', fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Free</p>
              <p style={{ margin: '0 0 20px', color: '#fff', fontSize: 22, fontWeight: 800 }}>£0 / month</p>
              {['Track films & TV', 'Rate & review', '3 AI searches/day', 'Basic watchlist', 'Follow friends'].map(f => (
                <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <Check size={14} color="#4ade80" />
                  <span style={{ color: '#888', fontSize: 13 }}>{f}</span>
                </div>
              ))}
            </div>

            {/* Pro tier */}
            <div style={{
              position: 'relative',
              borderRadius: 20,
              padding: 1,
              background: 'linear-gradient(135deg, rgba(245,158,11,.5) 0%, rgba(245,158,11,.1) 50%, rgba(245,158,11,.4) 100%)',
            }}>
              <div style={{ background: '#0d0d0d', borderRadius: 19, padding: '28px 24px', height: '100%', boxSizing: 'border-box' }}>
                <p style={{ margin: '0 0 4px', color: '#f59e0b', fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Pro</p>
                <p style={{ margin: '0 0 20px', color: '#fff', fontSize: 22, fontWeight: 800 }}>
                  £3.99 <span style={{ fontSize: 14, fontWeight: 400, color: '#555' }}>/ month</span>
                </p>
                {['Everything in Free', 'Unlimited AI searches', 'Advanced stats', 'Unlimited custom lists', 'Profile customisation', 'Pro badge', 'Early access', 'Ad-free'].map(f => (
                  <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <Check size={14} color="#f59e0b" />
                    <span style={{ color: '#ccc', fontSize: 13 }}>{f}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Waitlist CTA */}
        {!isPro && (
          <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 clamp(20px,4vw,48px)' }}>
            <div style={{
              position: 'relative',
              borderRadius: 24,
              padding: 1,
              background: 'linear-gradient(135deg, rgba(245,158,11,.35) 0%, rgba(245,158,11,.07) 50%, rgba(245,158,11,.3) 100%)',
              overflow: 'hidden',
            }}>
              <div style={{ background: 'linear-gradient(135deg, #0d0d0d 0%, #111 100%)', borderRadius: 23, padding: 'clamp(32px,5vw,56px)', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
                {/* Inner glow top */}
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: 'linear-gradient(90deg, transparent, rgba(245,158,11,.4), transparent)' }} />

                <Crown size={32} color="#f59e0b" style={{ marginBottom: 16 }} />
                <h2 style={{ margin: '0 0 10px', color: '#fff', fontSize: 'clamp(20px,3vw,28px)', fontWeight: 800 }}>Be first when Pro launches</h2>
                <p style={{ margin: '0 auto 28px', color: '#666', fontSize: 15, lineHeight: 1.6, maxWidth: 440 }}>
                  Leave your email and we will notify you the moment Qued Pro goes live.
                </p>

                {submitted ? (
                  <div className="animate-slide-up" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: 'rgba(74,222,128,.08)', border: '1px solid rgba(74,222,128,.25)', borderRadius: 14, padding: '14px 24px' }}>
                    <Check size={17} color="#4ade80" />
                    <span style={{ color: '#4ade80', fontSize: 15, fontWeight: 600 }}>You're on the list!</span>
                  </div>
                ) : (
                  <form onSubmit={handleNotify}>
                    <div style={{ display: 'flex', gap: 10, maxWidth: 440, margin: '0 auto', flexWrap: 'wrap', justifyContent: 'center' }}>
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
                )}
                <p style={{ margin: '16px 0 0', color: '#333', fontSize: 12 }}>No spam. Unsubscribe anytime.</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
