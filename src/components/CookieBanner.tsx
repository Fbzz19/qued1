import { useState, useEffect } from 'react';
import { Cookie, X } from 'lucide-react';
import { useI18n } from '../context/I18nContext';

const STORAGE_KEY = 'qued_cookie_consent';

export default function CookieBanner() {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) setVisible(true);
  }, []);

  function accept() {
    localStorage.setItem(STORAGE_KEY, 'accepted');
    setVisible(false);
  }

  function decline() {
    localStorage.setItem(STORAGE_KEY, 'declined');
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      className="animate-slide-up"
      style={{ position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)', zIndex: 300, width: 'calc(100% - 32px)', maxWidth: 520, background: '#111', border: '1px solid #2e2e2e', borderRadius: 18, padding: '16px 18px', boxShadow: '0 8px 40px rgba(0,0,0,.8)', display: 'flex', alignItems: 'flex-start', gap: 14 }}
    >
      <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(245,158,11,.1)', border: '1px solid rgba(245,158,11,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
        <Cookie size={16} color="#f59e0b" />
      </div>
      <div style={{ flex: 1 }}>
        <p style={{ margin: '0 0 4px', color: '#fff', fontSize: 14, fontWeight: 600 }}>{t('cookie_title')}</p>
        <p style={{ margin: '0 0 12px', color: '#888', fontSize: 12, lineHeight: 1.6 }}>
          {t('cookie_desc')}
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={accept} className="btn-gold" style={{ padding: '8px 18px', borderRadius: 10, fontSize: 13 }}>{t('btn_accept')}</button>
          <button onClick={decline} className="btn-ghost" style={{ padding: '8px 18px', borderRadius: 10, fontSize: 13 }}>{t('btn_decline')}</button>
        </div>
      </div>
      <button onClick={decline} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', flexShrink: 0 }}
        onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
        onMouseLeave={e => (e.currentTarget.style.color = '#555')}>
        <X size={16} />
      </button>
    </div>
  );
}
