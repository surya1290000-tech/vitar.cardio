'use client';
import { Suspense, useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useVerifyOTP, useResendOTP } from '@/hooks/useAuth';

function VerifyForm() {
  const searchParams = useSearchParams();
  const userId = searchParams.get('userId') || '';
  const next = searchParams.get('next') === 'order' ? 'order' : undefined;
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const { verify, loading, error } = useVerifyOTP();
  const { resend, loading: resending, success: resendSuccess, error: resendError } = useResendOTP();

  useEffect(() => { inputs.current[0]?.focus(); }, []);

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);
    if (value && index < 5) inputs.current[index + 1]?.focus();
    if (index === 5 && value) {
      const code = newOtp.join('');
      if (code.length === 6) verify(userId, code, next);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) inputs.current[index - 1]?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) { setOtp(pasted.split('')); verify(userId, pasted, next); }
  };

  return (
    <div style={{ minHeight:'100vh', background:'#0D0D0F', display:'flex', alignItems:'center', justifyContent:'center', padding:'2rem', fontFamily:"'DM Sans',sans-serif" }}>
      <div style={{ width:'100%', maxWidth:'440px' }}>
        <Link href="/" style={{ fontFamily:"'DM Serif Display',serif", fontSize:'1.5rem', letterSpacing:'0.12em', color:'#F9F8F6', textDecoration:'none', display:'block', marginBottom:'2.5rem' }}>
          VITAR<span style={{ color:'#C0392B' }}>.</span>
        </Link>
        <div style={{ background:'#1A1A1C', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'8px', padding:'2.5rem', textAlign:'center' }}>
          <div style={{ width:'64px', height:'64px', borderRadius:'50%', background:'rgba(192,57,43,0.1)', border:'2px solid rgba(192,57,43,0.3)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.5rem', margin:'0 auto 1.5rem' }}>✉</div>
          <h1 style={{ fontFamily:"'DM Serif Display',serif", fontSize:'1.8rem', color:'#F9F8F6', marginBottom:'0.5rem' }}>Check your email</h1>
          <p style={{ fontSize:'0.85rem', color:'#8A8A8E', lineHeight:'1.7', marginBottom:'2rem' }}>
            We sent a 6-digit code to your email. Enter it below.
          </p>
          {(error || resendError) && (
            <div style={{ background:'rgba(192,57,43,0.1)', border:'1px solid rgba(192,57,43,0.3)', borderRadius:'4px', padding:'0.8rem 1rem', fontSize:'0.82rem', color:'#E74C3C', marginBottom:'1.2rem' }}>
              {error || resendError}
            </div>
          )}
          {resendSuccess && (
            <div style={{ background:'rgba(46,204,113,0.1)', border:'1px solid rgba(46,204,113,0.3)', borderRadius:'4px', padding:'0.8rem 1rem', fontSize:'0.82rem', color:'#2ECC71', marginBottom:'1.2rem' }}>
              New code sent! Check your email.
            </div>
          )}
          <form onSubmit={e => { e.preventDefault(); const code = otp.join(''); if (code.length === 6) verify(userId, code, next); }}>
            <div style={{ display:'flex', gap:'0.6rem', justifyContent:'center', marginBottom:'1.5rem' }}>
              {otp.map((digit, i) => (
                <input key={i} ref={el => { inputs.current[i] = el; }} type="text" inputMode="numeric" maxLength={1} value={digit}
                  onChange={e => handleChange(i, e.target.value)}
                  onKeyDown={e => handleKeyDown(i, e)}
                  onPaste={handlePaste}
                  style={{ width:'52px', height:'60px', background:'#0D0D0F', border:`1px solid ${digit ? '#C0392B' : 'rgba(255,255,255,0.1)'}`, borderRadius:'6px', textAlign:'center', fontSize:'1.4rem', color:'#F9F8F6', outline:'none' }}
                />
              ))}
            </div>
            <button type="submit" disabled={loading || otp.join('').length < 6} style={{ width:'100%', background:'#C0392B', color:'#F9F8F6', border:'none', borderRadius:'3px', padding:'0.95rem', fontSize:'0.9rem', fontWeight:500, letterSpacing:'0.05em', textTransform:'uppercase', cursor:'pointer', opacity:(loading || otp.join('').length < 6) ? 0.6 : 1 }}>
              {loading ? 'Verifying...' : 'Verify Email'}
            </button>
          </form>
          <p style={{ marginTop:'1.5rem', fontSize:'0.82rem', color:'#8A8A8E' }}>
            Didn&apos;t get a code?{' '}
            <button onClick={() => resend(userId)} disabled={resending} style={{ background:'none', border:'none', color:'#C0392B', fontSize:'0.82rem', cursor:'pointer', padding:0 }}>
              {resending ? 'Sending...' : 'Resend'}
            </button>
          </p>
          <p style={{ marginTop:'0.5rem', fontSize:'0.72rem', color:'rgba(255,255,255,0.3)' }}>Code expires in 10 minutes</p>
        </div>
        <p style={{ textAlign:'center', marginTop:'1.5rem', fontSize:'0.82rem', color:'#8A8A8E' }}>
          Wrong email? <Link href="/signup" style={{ color:'#C0392B', textDecoration:'none' }}>Sign up again</Link>
        </p>
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<div style={{ minHeight:'100vh', background:'#0D0D0F', display:'flex', alignItems:'center', justifyContent:'center', color:'#8A8A8E', fontFamily:'DM Sans,sans-serif' }}>Loading...</div>}>
      <VerifyForm />
    </Suspense>
  );
}
