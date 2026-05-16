import { useState, useRef, useEffect } from 'react';
import { X, Film, RotateCcw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface VerificationModalProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export default function VerificationModal({ onSuccess, onCancel }: VerificationModalProps) {
  const { pendingVerification, verifyCode, resendCode, cancelVerification } = useAuth();
  const [digits,      setDigits]      = useState(['', '', '', '', '', '']);
  const [error,       setError]       = useState('');
  const [info,        setInfo]        = useState('');
  const [loading,     setLoading]     = useState(false);
  const [resending,   setResending]   = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => { inputRefs.current[0]?.focus(); }, []);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  function handleDigitChange(index: number, value: string) {
    const cleaned = value.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[index] = cleaned;
    setDigits(next);
    setError('');
    if (cleaned && index < 5) inputRefs.current[index + 1]?.focus();
    // Auto-submit when all 6 digits filled
    if (cleaned && index === 5) {
      const full = [...next].join('');
      if (full.length === 6) submitCode(full);
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    const next = [...digits];
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i];
    setDigits(next);
    const focusIdx = Math.min(pasted.length, 5);
    inputRefs.current[focusIdx]?.focus();
    if (pasted.length === 6) submitCode(pasted);
  }

  async function submitCode(code: string) {
    setLoading(true);
    setError('');
    const { error: err } = await verifyCode(code);
    setLoading(false);
    if (err) {
      setError(err.message);
      setDigits(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } else {
      onSuccess();
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const code = digits.join('');
    if (code.length < 6) { setError('Please enter the full 6-digit code'); return; }
    await submitCode(code);
  }

  async function handleResend() {
    setResending(true);
    setError('');
    setInfo('');
    const { error: err } = await resendCode();
    setResending(false);
    if (err) {
      setError(err.message);
    } else {
      setInfo('A new code has been sent to your email.');
      setDigits(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
      setResendCooldown(60);
    }
  }

  function handleCancel() {
    cancelVerification();
    onCancel();
  }

  const email = pendingVerification?.email ?? '';
  const maskedEmail = email.replace(/(.{2}).+(@.+)/, '$1***$2');

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.8)', backdropFilter: 'blur(6px)', padding: 16 }}
      onClick={handleCancel}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="animate-slide-up"
        style={{ width: '100%', maxWidth: 420, background: '#111', borderRadius: 20, border: '1px solid #242424', padding: 32, position: 'relative' }}
      >
        <button onClick={handleCancel}
          style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', color: '#555', cursor: 'pointer', transition: 'color .2s' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
          onMouseLeave={e => (e.currentTarget.style.color = '#555')}>
          <X size={18} />
        </button>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 6 }}>
            <Film size={22} color="#f59e0b" />
            <span className="gold-glow" style={{ fontSize: 24, fontWeight: 800, color: '#f59e0b', letterSpacing: '-0.5px' }}>Qued</span>
          </div>
          <h2 style={{ margin: '12px 0 6px', fontSize: 20, fontWeight: 700, color: '#fff' }}>Verify your email</h2>
          <p style={{ margin: 0, color: '#888', fontSize: 13, lineHeight: 1.5 }}>
            Enter the 6-digit code sent to<br />
            <span style={{ color: '#ccc' }}>{maskedEmail}</span>
          </p>
        </div>

        {/* Code inputs */}
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 24 }} onPaste={handlePaste}>
            {digits.map((d, i) => (
              <input
                key={i}
                ref={el => { inputRefs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={d}
                onChange={e => handleDigitChange(i, e.target.value)}
                onKeyDown={e => handleKeyDown(i, e)}
                style={{
                  width: 48, height: 56, textAlign: 'center', fontSize: 22, fontWeight: 700,
                  background: '#1a1a1a', border: `2px solid ${d ? '#f59e0b' : '#2e2e2e'}`,
                  borderRadius: 12, color: '#fff', outline: 'none', fontFamily: 'inherit',
                  transition: 'border-color .15s',
                }}
                onFocus={e => { e.target.style.borderColor = '#f59e0b'; }}
                onBlur={e => { e.target.style.borderColor = digits[i] ? '#f59e0b' : '#2e2e2e'; }}
              />
            ))}
          </div>

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

          <button type="submit" disabled={loading || digits.join('').length < 6} className="btn-gold"
            style={{ width: '100%', padding: '13px', borderRadius: 12, fontSize: 14, marginBottom: 12 }}>
            {loading ? 'Verifying...' : 'Verify Email'}
          </button>
        </form>

        {/* Resend */}
        <div style={{ textAlign: 'center' }}>
          <button
            type="button"
            onClick={handleResend}
            disabled={resending || resendCooldown > 0}
            style={{
              background: 'none', border: 'none', cursor: resendCooldown > 0 ? 'default' : 'pointer',
              color: resendCooldown > 0 ? '#444' : '#888', fontSize: 13, fontFamily: 'inherit',
              display: 'inline-flex', alignItems: 'center', gap: 6, transition: 'color .2s',
            }}
            onMouseEnter={e => { if (resendCooldown <= 0) e.currentTarget.style.color = '#fbbf24'; }}
            onMouseLeave={e => { if (resendCooldown <= 0) e.currentTarget.style.color = '#888'; }}
          >
            <RotateCcw size={13} />
            {resending ? 'Sending...' : resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend code'}
          </button>
        </div>

        <p style={{ textAlign: 'center', marginTop: 16, color: '#555', fontSize: 12 }}>
          Codes expire after 10 minutes
        </p>
      </div>
    </div>
  );
}
