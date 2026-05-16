import { useState, useEffect } from 'react';
import { X, Film, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { useI18n } from '../context/I18nContext';
import VerificationModal from './VerificationModal';

interface AuthModalProps {
  defaultMode?: 'login' | 'signup';
  onClose: () => void;
  reason?: string;
}

type Mode = 'login' | 'signup' | 'forgot';

export default function AuthModal({ defaultMode = 'login', onClose, reason }: AuthModalProps) {
  const [mode,             setMode]             = useState<Mode>(defaultMode);
  const [email,            setEmail]            = useState('');
  const [password,         setPassword]         = useState('');
  const [username,         setUsername]         = useState('');
  const [error,            setError]            = useState('');
  const [info,             setInfo]             = useState('');
  const [loading,          setLoading]          = useState(false);
  const [showPwd,          setShowPwd]          = useState(false);
  const [confirmPassword,  setConfirmPassword]  = useState('');
  const [showConfirmPwd,   setShowConfirmPwd]   = useState(false);
  const [usernameTaken,    setUsernameTaken]    = useState(false);
  const [usernameChecking, setUsernameChecking] = useState(false);
  const [ageConfirmed,     setAgeConfirmed]     = useState(false);
  const [verifying,        setVerifying]        = useState(false);
  const { signIn, signUp, pendingVerification } = useAuth();
  const { t } = useI18n();

  useEffect(() => {
    if (mode !== 'signup' || username.length < 3) { setUsernameTaken(false); return; }
    setUsernameChecking(true);
    const t = setTimeout(async () => {
      const { data } = await supabase.from('profiles').select('id').eq('username', username.toLowerCase()).maybeSingle();
      setUsernameTaken(!!data);
      setUsernameChecking(false);
    }, 400);
    return () => clearTimeout(t);
  }, [username, mode]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setInfo('');
    setLoading(true);

    if (mode === 'forgot') {
      const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}?reset=true`,
      });
      if (err) setError(err.message);
      else setInfo(t('auth_reset_email_sent'));
      setLoading(false);
      return;
    }

    if (mode === 'login') {
      const { error: err } = await signIn(email, password);
      if (err) { setError(err.message); setLoading(false); return; }
      onClose();
    } else {
      if (username.length < 3) { setError('Username must be at least 3 characters'); setLoading(false); return; }
      if (usernameTaken) { setError('This username is already taken'); setLoading(false); return; }
      if (password !== confirmPassword) { setError('Passwords do not match'); setLoading(false); return; }
      if (!ageConfirmed) { setError('You must be 13 or older to use Qued'); setLoading(false); return; }
      const { error: err } = await signUp(email, password, username);
      if (err) { setError(err.message); setLoading(false); return; }
      setVerifying(true);
      setLoading(false);
      return;
    }
    setLoading(false);
  }

  function switchMode(m: Mode) { setMode(m); setError(''); setInfo(''); setConfirmPassword(''); }

  if (verifying && pendingVerification) {
    return (
      <VerificationModal
        onSuccess={onClose}
        onCancel={() => setVerifying(false)}
      />
    );
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.75)', backdropFilter: 'blur(6px)', padding: 16 }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="animate-slide-up"
        style={{ width: '100%', maxWidth: 400, background: '#111', borderRadius: 20, border: '1px solid #242424', padding: 32, position: 'relative' }}
      >
        <button onClick={onClose} aria-label="Close auth modal" style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', color: '#555', cursor: 'pointer', transition: 'color .2s' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
          onMouseLeave={e => (e.currentTarget.style.color = '#555')}>
          <X size={18} />
        </button>

        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 6 }}>
            <Film size={22} color="#f59e0b" />
            <span className="gold-glow" style={{ fontSize: 24, fontWeight: 800, color: '#f59e0b', letterSpacing: '-0.5px' }}>Qued</span>
          </div>
          {mode === 'forgot'
            ? <p style={{ margin: '6px 0 0', color: '#888', fontSize: 13 }}>Enter your email to reset your password</p>
            : reason && <p style={{ margin: '8px 0 0', color: '#888', fontSize: 13 }}>{reason}</p>}
        </div>

        {mode !== 'forgot' && (
          <div style={{ display: 'flex', background: '#1a1a1a', borderRadius: 12, padding: 3, marginBottom: 24, gap: 3 }}>
            {(['login', 'signup'] as const).map(m => (
              <button key={m} onClick={() => switchMode(m)}
                style={{ flex: 1, padding: '8px 0', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500, transition: 'all .2s', fontFamily: 'inherit',
                  background: mode === m ? '#f59e0b' : 'transparent', color: mode === m ? '#000' : '#888' }}>
                {m === 'login' ? t('auth_sign_in') : t('auth_sign_up')}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <>
              {mode === 'signup' && (
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', color: '#888', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>{t('auth_username')}</label>
                  <input
                    type="text" value={username}
                    onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    placeholder="@username" required minLength={3}
                    style={{ width: '100%', background: '#1a1a1a', border: `1px solid ${usernameTaken ? '#f87171' : '#2e2e2e'}`, borderRadius: 10, padding: '11px 14px', color: '#fff', fontSize: 14, outline: 'none', fontFamily: 'inherit', transition: 'border-color .2s', boxSizing: 'border-box' }}
                    onFocus={e  => { if (!usernameTaken) e.target.style.borderColor = '#f59e0b'; }}
                    onBlur={e   => { if (!usernameTaken) e.target.style.borderColor = '#2e2e2e'; }}
                  />
                  {username.length >= 3 && (
                    <p style={{ margin: '4px 0 0', fontSize: 11, color: usernameChecking ? '#555' : usernameTaken ? '#f87171' : '#4ade80' }}>
                      {usernameChecking ? t('auth_checking') : usernameTaken ? t('auth_username_taken') : t('auth_username_available')}
                    </p>
                  )}
                </div>
              )}
              <InputField label={t('auth_email')} type="email" value={email} onChange={setEmail} placeholder="you@example.com" />
              {mode !== 'forgot' && (
                <>
                  <div style={{ marginBottom: 14, position: 'relative' }}>
                    <label style={{ display: 'block', color: '#888', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>{t('auth_password')}</label>
                    <input
                      type={showPwd ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••" required minLength={6}
                      style={{ width: '100%', background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: 10, padding: '11px 40px 11px 14px', color: '#fff', fontSize: 14, outline: 'none', fontFamily: 'inherit', transition: 'border-color .2s', boxSizing: 'border-box' }}
                      onFocus={e  => (e.target.style.borderColor = '#f59e0b')}
                      onBlur={e   => (e.target.style.borderColor = '#2e2e2e')}
                    />
                    <button type="button" onClick={() => setShowPwd(s => !s)} aria-label={showPwd ? 'Hide password' : 'Show password'}
                      style={{ position: 'absolute', right: 12, bottom: 12, background: 'none', border: 'none', cursor: 'pointer', color: '#555', padding: 0 }}>
                      {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  {mode === 'signup' && (
                    <div style={{ marginBottom: 14, position: 'relative' }}>
                      <label style={{ display: 'block', color: '#888', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Confirm Password</label>
                      <input
                        type={showConfirmPwd ? 'text' : 'password'} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                        placeholder="••••••••" required minLength={6}
                        style={{ width: '100%', background: '#1a1a1a', border: `1px solid ${confirmPassword && confirmPassword !== password ? '#f87171' : '#2e2e2e'}`, borderRadius: 10, padding: '11px 40px 11px 14px', color: '#fff', fontSize: 14, outline: 'none', fontFamily: 'inherit', transition: 'border-color .2s', boxSizing: 'border-box' }}
                        onFocus={e  => (e.target.style.borderColor = confirmPassword && confirmPassword !== password ? '#f87171' : '#f59e0b')}
                        onBlur={e   => (e.target.style.borderColor = confirmPassword && confirmPassword !== password ? '#f87171' : '#2e2e2e')}
                      />
                      <button type="button" onClick={() => setShowConfirmPwd(s => !s)} aria-label={showConfirmPwd ? 'Hide confirm password' : 'Show confirm password'}
                        style={{ position: 'absolute', right: 12, bottom: confirmPassword && confirmPassword !== password ? 26 : 12, background: 'none', border: 'none', cursor: 'pointer', color: '#555', padding: 0 }}>
                        {showConfirmPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                      {confirmPassword && confirmPassword !== password && (
                        <p style={{ margin: '4px 0 0', fontSize: 11, color: '#f87171' }}>Passwords do not match</p>
                      )}
                      {confirmPassword && confirmPassword === password && (
                        <p style={{ margin: '4px 0 0', fontSize: 11, color: '#4ade80' }}>Passwords match</p>
                      )}
                    </div>
                  )}
                </>
              )}
          </>

          {mode === 'login' && (
            <div style={{ textAlign: 'right', marginTop: -6, marginBottom: 14 }}>
              <button type="button" onClick={() => switchMode('forgot')}
                style={{ background: 'none', border: 'none', color: '#888', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', transition: 'color .2s', padding: 0 }}
                onMouseEnter={e => (e.currentTarget.style.color = '#fbbf24')}
                onMouseLeave={e => (e.currentTarget.style.color = '#888')}>
                {t('auth_forgot_password')}
              </button>
            </div>
          )}

          {mode === 'signup' && (
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 14, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={ageConfirmed}
                onChange={e => setAgeConfirmed(e.target.checked)}
                style={{ marginTop: 2, accentColor: '#f59e0b', flexShrink: 0 }}
              />
              <span style={{ color: '#888', fontSize: 12, lineHeight: 1.5 }}>
                I confirm that I am 13 years of age or older
              </span>
            </label>
          )}

          {error && (
            <div style={{ background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 8, padding: '8px 12px', marginBottom: 14 }}>
              <p style={{ margin: 0, color: '#f87171', fontSize: 12 }}>{error}</p>
            </div>
          )}
          {info && (
            <div style={{ background: 'rgba(74,222,128,.08)', border: '1px solid rgba(74,222,128,.2)', borderRadius: 8, padding: '8px 12px', marginBottom: 14 }}>
              <p style={{ margin: 0, color: '#4ade80', fontSize: 12 }}>{info}</p>
            </div>
          )}

          <button type="submit" disabled={loading || (mode === 'signup' && usernameTaken)} className="btn-gold" style={{ width: '100%', padding: '13px', borderRadius: 12, fontSize: 14 }}>
            {loading ? t('auth_please_wait')
              : mode === 'login' ? t('auth_sign_in')
              : mode === 'signup' ? t('auth_create_account')
              : t('auth_send_reset')}
          </button>
        </form>

        {mode === 'forgot' && (
          <button type="button" onClick={() => switchMode('login')}
            style={{ width: '100%', marginTop: 12, background: 'none', border: 'none', color: '#888', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', transition: 'color .2s' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
            onMouseLeave={e => (e.currentTarget.style.color = '#888')}>
            {t('auth_sign_in')}
          </button>
        )}
      </div>
    </div>
  );
}

function InputField({ label, type, value, onChange, placeholder, minLength }: {
  label: string; type: string; value: string; onChange: (v: string) => void; placeholder: string; minLength?: number;
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', color: '#888', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} required minLength={minLength}
        style={{ width: '100%', background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: 10, padding: '11px 14px', color: '#fff', fontSize: 14, outline: 'none', fontFamily: 'inherit', transition: 'border-color .2s', boxSizing: 'border-box' }}
        onFocus={e  => (e.target.style.borderColor = '#f59e0b')}
        onBlur={e   => (e.target.style.borderColor = '#2e2e2e')}
      />
    </div>
  );
}
