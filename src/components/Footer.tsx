import { Film } from 'lucide-react';

interface FooterProps {
  onPrivacyClick: () => void;
  onTermsClick: () => void;
  onProClick?: () => void;
  onLeaderboardsClick?: () => void;
}

export default function Footer({ onPrivacyClick, onTermsClick, onProClick, onLeaderboardsClick }: FooterProps) {
  return (
    <footer style={{ background: '#0a0a0a', borderTop: '1px solid #1a1a1a', padding: '32px clamp(16px,4vw,48px)', marginTop: 64 }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Film size={18} color="#f59e0b" />
          <span style={{ color: '#f59e0b', fontSize: 16, fontWeight: 800, letterSpacing: '-0.3px' }}>Qued</span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'center' }}>
          {onProClick && (
            <button onClick={onProClick}
              style={{ background: 'none', border: 'none', color: '#f59e0b', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', transition: 'color .2s', padding: 0, fontWeight: 600 }}
              onMouseEnter={e => (e.currentTarget.style.color = '#fbbf24')}
              onMouseLeave={e => (e.currentTarget.style.color = '#f59e0b')}>
              Qued Pro
            </button>
          )}
          {onLeaderboardsClick && (
            <button onClick={onLeaderboardsClick}
              style={{ background: 'none', border: 'none', color: '#555', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', transition: 'color .2s', padding: 0 }}
              onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
              onMouseLeave={e => (e.currentTarget.style.color = '#555')}>
              Leaderboards
            </button>
          )}
          <button onClick={onPrivacyClick}
            style={{ background: 'none', border: 'none', color: '#555', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', transition: 'color .2s', padding: 0 }}
            onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
            onMouseLeave={e => (e.currentTarget.style.color = '#555')}>
            Privacy Policy
          </button>
          <button onClick={onTermsClick}
            style={{ background: 'none', border: 'none', color: '#555', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', transition: 'color .2s', padding: 0 }}
            onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
            onMouseLeave={e => (e.currentTarget.style.color = '#555')}>
            Terms of Service
          </button>
          <a href="mailto:hello@myqued.com"
            style={{ color: '#555', fontSize: 13, textDecoration: 'none', transition: 'color .2s' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
            onMouseLeave={e => (e.currentTarget.style.color = '#555')}>
            Contact
          </a>
        </div>
        <p style={{ margin: 0, color: '#3a3a3a', fontSize: 12 }}>© {new Date().getFullYear()} Qued. All rights reserved.</p>
      </div>
    </footer>
  );
}
