import { useState } from 'react';
import { Film, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import VerificationModal from '../components/VerificationModal';

export default function AuthPage() {
  const [mode,     setMode]     = useState<'login' | 'signup'>('login');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error,    setError]    = useState('');
  const [loading,         setLoading]         = useState(false);
  const [verifying,       setVerifying]       = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPwd,         setShowPwd]         = useState(false);
  const [showConfirmPwd,  setShowConfirmPwd]  = useState(false);
  const { signIn, signUp, pendingVerification } = useAuth();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    if (mode === 'login') {
      const { error } = await signIn(email, password);
      if (error) setError(error.message);
    } else {
      if (username.length < 3) { setError('Username must be at least 3 characters'); setLoading(false); return; }
      if (password !== confirmPassword) { setError('Passwords do not match'); setLoading(false); return; }
      const { error } = await signUp(email, password, username);
      if (error) { setError(error.message); setLoading(false); return; }
      setVerifying(true);
      setLoading(false);
      return;
    }
    setLoading(false);
  }

  if (verifying && pendingVerification) {
    return (
      <VerificationModal
        onSuccess={() => { /* AuthContext signs in; App re-renders away from AuthPage */ }}
        onCancel={() => setVerifying(false)}
      />
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#000', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 360 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8 }}>
            <Film size={30} color="#f59e0b" />
            <h1 className="gold-glow" style={{ margin: 0, fontSize: 40, fontWeight: 700, letterSpacing: '-1px', color: '#f59e0b' }}>Qued</h1>
          </div>
          <p style={{ margin: 0, color: '#888', fontSize: 12, letterSpacing: '0.2em', textTransform: 'uppercase' }}>Queue That Film</p>
        </div>

        <div style={{ background: '#111', borderRadius: 20, padding: 24, border: '1px solid #242424' }}>
          {/* Tab switcher */}
          <div style={{ display: 'flex', background: '#1a1a1a', borderRadius: 12, padding: 4, marginBottom: 24 }}>
            {(['login', 'signup'] as const).map(m => (
              <button key={m} onClick={() => { setMode(m); setError(''); setConfirmPassword(''); }}
                style={{ flex: 1, padding: '8px 0', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 500, transition: 'all .2s',
                  background: mode === m ? '#f59e0b' : 'transparent',
                  color: mode === m ? '#000' : '#888' }}>
                {m === 'login' ? 'Sign In' : 'Sign Up'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit}>
            {mode === 'signup' && (
              <InputField label="Username" type="text" value={username} onChange={setUsername} placeholder="@username" />
            )}
            <InputField label="Email" type="email" value={email} onChange={setEmail} placeholder="you@example.com" />
            <div style={{ marginBottom: 16, position: 'relative' }}>
              <label style={{ display: 'block', color: '#888', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Password</label>
              <input
                type={showPwd ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••" required minLength={6}
                style={{ width: '100%', background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: 10, padding: '12px 40px 12px 16px', color: '#fff', fontSize: 14, outline: 'none', fontFamily: 'inherit', transition: 'border-color .2s', boxSizing: 'border-box' }}
                onFocus={e => (e.target.style.borderColor = '#f59e0b')}
                onBlur={e  => (e.target.style.borderColor = '#2e2e2e')}
              />
              <button type="button" onClick={() => setShowPwd(s => !s)}
                style={{ position: 'absolute', right: 12, top: 34, background: 'none', border: 'none', cursor: 'pointer', color: '#555', padding: 0 }}>
                {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {mode === 'signup' && (
              <div style={{ marginBottom: 16, position: 'relative' }}>
                <label style={{ display: 'block', color: '#888', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Confirm Password</label>
                <input
                  type={showConfirmPwd ? 'text' : 'password'} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="••••••••" required minLength={6}
                  style={{ width: '100%', background: '#1a1a1a', border: `1px solid ${confirmPassword && confirmPassword !== password ? '#f87171' : '#2e2e2e'}`, borderRadius: 10, padding: '12px 40px 12px 16px', color: '#fff', fontSize: 14, outline: 'none', fontFamily: 'inherit', transition: 'border-color .2s', boxSizing: 'border-box' }}
                  onFocus={e => (e.target.style.borderColor = confirmPassword && confirmPassword !== password ? '#f87171' : '#f59e0b')}
                  onBlur={e  => (e.target.style.borderColor = confirmPassword && confirmPassword !== password ? '#f87171' : '#2e2e2e')}
                />
                <button type="button" onClick={() => setShowConfirmPwd(s => !s)}
                  style={{ position: 'absolute', right: 12, top: 34, background: 'none', border: 'none', cursor: 'pointer', color: '#555', padding: 0 }}>
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

            {error && (
              <div style={{ background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 8, padding: '8px 12px', marginBottom: 12 }}>
                <p style={{ margin: 0, color: '#f87171', fontSize: 12 }}>{error}</p>
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-gold" style={{ width: '100%', padding: '14px', marginTop: 4, borderRadius: 12, fontSize: 15 }}>
              {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', marginTop: 24, color: '#555', fontSize: 12 }}>
          Track films & shows. Build your watchlist.
        </p>
      </div>
    </div>
  );
}

function InputField({ label, type, value, onChange, placeholder, minLength }: {
  label: string; type: string; value: string; onChange: (v: string) => void; placeholder: string; minLength?: number;
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', color: '#888', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} required minLength={minLength}
        style={{ width: '100%', background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: 10, padding: '12px 16px', color: '#fff', fontSize: 14, outline: 'none', fontFamily: 'inherit',
          transition: 'border-color .2s' }}
        onFocus={e  => (e.target.style.borderColor = '#f59e0b')}
        onBlur={e   => (e.target.style.borderColor = '#2e2e2e')}
      />
    </div>
  );
}
