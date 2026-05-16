import { useState } from 'react';
import { Film, Eye, EyeOff, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useI18n } from '../context/I18nContext';

interface ResetPasswordPageProps {
  onDone: () => void;
}

export default function ResetPasswordPage({ onDone }: ResetPasswordPageProps) {
  const { t } = useI18n();
  const [password,    setPassword]    = useState('');
  const [confirm,     setConfirm]     = useState('');
  const [showPwd,     setShowPwd]     = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');
  const [done,        setDone]        = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setLoading(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    if (err) { setError(err.message); setLoading(false); return; }
    setDone(true);
    setTimeout(() => onDone(), 3000);
    setLoading(false);
  }

  return (
    <div style={{ minHeight: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} className="animate-fade-in">
      <div style={{ width: '100%', maxWidth: 400, background: '#111', borderRadius: 20, border: '1px solid #242424', padding: 36 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8 }}>
            <Film size={22} color="#f59e0b" />
            <span style={{ fontSize: 24, fontWeight: 800, color: '#f59e0b', letterSpacing: '-0.5px' }}>Qued</span>
          </div>
          <h2 style={{ margin: 0, color: '#fff', fontSize: 18, fontWeight: 700 }}>{t('reset_title')}</h2>
          <p style={{ margin: '6px 0 0', color: '#888', fontSize: 13 }}>{t('reset_subtitle')}</p>
        </div>

        {done ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(74,222,128,.1)', border: '2px solid rgba(74,222,128,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Check size={24} color="#4ade80" />
            </div>
            <p style={{ margin: '0 0 8px', color: '#fff', fontSize: 16, fontWeight: 700 }}>{t('reset_success')}</p>
            <p style={{ margin: 0, color: '#888', fontSize: 13 }}>{t('reset_redirecting')}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 14, position: 'relative' }}>
              <label style={{ display: 'block', color: '#888', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>{t('reset_new_password')}</label>
              <input
                type={showPwd ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                placeholder="Minimum 6 characters" required minLength={6}
                style={{ width: '100%', background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: 10, padding: '11px 40px 11px 14px', color: '#fff', fontSize: 14, outline: 'none', fontFamily: 'inherit', transition: 'border-color .2s', boxSizing: 'border-box' }}
                onFocus={e => (e.target.style.borderColor = '#f59e0b')}
                onBlur={e  => (e.target.style.borderColor = '#2e2e2e')}
              />
              <button type="button" onClick={() => setShowPwd(s => !s)}
                style={{ position: 'absolute', right: 12, bottom: 12, background: 'none', border: 'none', cursor: 'pointer', color: '#555', padding: 0 }}>
                {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>

            <div style={{ marginBottom: 20, position: 'relative' }}>
              <label style={{ display: 'block', color: '#888', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>{t('reset_confirm')}</label>
              <input
                type={showConfirm ? 'text' : 'password'} value={confirm} onChange={e => setConfirm(e.target.value)}
                placeholder="Repeat your password" required
                style={{ width: '100%', background: '#1a1a1a', border: `1px solid ${confirm && confirm !== password ? '#f87171' : '#2e2e2e'}`, borderRadius: 10, padding: '11px 40px 11px 14px', color: '#fff', fontSize: 14, outline: 'none', fontFamily: 'inherit', transition: 'border-color .2s', boxSizing: 'border-box' }}
                onFocus={e => (e.target.style.borderColor = confirm !== password ? '#f87171' : '#f59e0b')}
                onBlur={e  => (e.target.style.borderColor = confirm && confirm !== password ? '#f87171' : '#2e2e2e')}
              />
              <button type="button" onClick={() => setShowConfirm(s => !s)}
                style={{ position: 'absolute', right: 12, bottom: 12, background: 'none', border: 'none', cursor: 'pointer', color: '#555', padding: 0 }}>
                {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>

            {confirm && password !== confirm && (
              <p style={{ margin: '-12px 0 12px', color: '#f87171', fontSize: 12 }}>Passwords do not match</p>
            )}

            {error && (
              <div style={{ background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 8, padding: '8px 12px', marginBottom: 14 }}>
                <p style={{ margin: 0, color: '#f87171', fontSize: 12 }}>{error}</p>
              </div>
            )}

            <button type="submit" disabled={loading || password !== confirm || password.length < 6} className="btn-gold" style={{ width: '100%', padding: '13px', borderRadius: 12, fontSize: 14 }}>
              {loading ? t('settings_updating') : t('reset_update')}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
