'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  signInWithEmailAndPassword, signInWithPopup,
  createUserWithEmailAndPassword, sendPasswordResetEmail,
  onAuthStateChanged, updateProfile,
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, googleProvider, db } from '@/lib/firebase';
import {
  Leaf, Eye, EyeOff, ArrowRight, Mail, Lock, User,
  AlertCircle, CheckCircle, Loader2, Sparkles,
} from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────
const ADMIN_EMAIL = 'griffonb130@gmail.com';

// ─── Types ────────────────────────────────────────────────────────────────────
type Mode  = 'login' | 'signup' | 'reset';
type Toast = { type: 'success' | 'error'; message: string } | null;
type Role  = 'admin' | 'user' | 'gardener';

// ─── Firestore helper ─────────────────────────────────────────────────────────
async function ensureUserDoc(uid: string, email: string, displayName: string | null) {
  const ref  = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    const role: Role = email.toLowerCase() === ADMIN_EMAIL ? 'admin' : 'user';
    await setDoc(ref, { uid, email, displayName: displayName ?? '', role, createdAt: serverTimestamp() });
  }
}

// ─── Animated particle canvas ─────────────────────────────────────────────────
function Particles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let animId: number;
    const resize = () => { canvas.width = window.innerWidth / 2; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener('resize', resize);
    const dots = Array.from({ length: 55 }, () => ({
      x: Math.random() * canvas.width, y: Math.random() * canvas.height,
      r: Math.random() * 1.8 + 0.4,
      vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3,
      opacity: Math.random() * 0.35 + 0.08,
    }));
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      dots.forEach(d => {
        d.x += d.vx; d.y += d.vy;
        if (d.x < 0) d.x = canvas.width;  if (d.x > canvas.width)  d.x = 0;
        if (d.y < 0) d.y = canvas.height; if (d.y > canvas.height) d.y = 0;
        ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(16,185,129,${d.opacity})`; ctx.fill();
      });
      dots.forEach((a, i) => dots.slice(i + 1).forEach(b => {
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        if (dist < 120) {
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = `rgba(16,185,129,${0.05 * (1 - dist / 120)})`;
          ctx.lineWidth = 0.8; ctx.stroke();
        }
      }));
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize); };
  }, []);
  return <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" />;
}

// ─── Google icon ──────────────────────────────────────────────────────────────
function GoogleIcon() {
  return (
    <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function LoginPage() {
  const router = useRouter();

  const [mode,            setMode]            = useState<Mode>('login');
  const [name,            setName]            = useState('');
  const [email,           setEmail]           = useState('');
  const [password,        setPassword]        = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw,          setShowPw]          = useState(false);
  const [showConfirmPw,   setShowConfirmPw]   = useState(false);
  const [loading,         setLoading]         = useState(false);
  const [googleLoading,   setGoogleLoading]   = useState(false);
  const [toast,           setToast]           = useState<Toast>(null);
  const [mounted,         setMounted]         = useState(false);

  useEffect(() => { const t = setTimeout(() => setMounted(true), 60); return () => clearTimeout(t); }, []);
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, user => { if (user) router.replace('/dashboard'); });
    return () => unsub();
  }, [router]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const switchMode = (next: Mode) => {
    setName(''); setEmail(''); setPassword(''); setConfirmPassword('');
    setShowPw(false); setShowConfirmPw(false); setToast(null); setMode(next);
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { setToast({ type: 'error', message: 'Please fill in all fields.' }); return; }
    setLoading(true);
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      await ensureUserDoc(credential.user.uid, credential.user.email!, credential.user.displayName);
      setToast({ type: 'success', message: 'Welcome back! Redirecting…' });
      setTimeout(() => router.push('/dashboard'), 800);
    } catch (err: any) {
      const msg =
        err.code === 'auth/user-not-found'                                           ? 'No account found with this email.'        :
        err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential' ? 'Incorrect email or password.'              :
        err.code === 'auth/invalid-email'                                            ? 'Please enter a valid email address.'      :
        err.code === 'auth/too-many-requests'                                        ? 'Too many attempts. Please wait a moment.' :
        'Sign-in failed. Please try again.';
      setToast({ type: 'error', message: msg });
    } finally { setLoading(false); }
  };

  const handleEmailSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password || !confirmPassword) { setToast({ type: 'error', message: 'Please fill in all fields.' }); return; }
    if (password.length < 6) { setToast({ type: 'error', message: 'Password must be at least 6 characters.' }); return; }
    if (password !== confirmPassword) { setToast({ type: 'error', message: 'Passwords do not match.' }); return; }
    setLoading(true);
    try {
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(credential.user, { displayName: name });
      await ensureUserDoc(credential.user.uid, email, name);
      setToast({ type: 'success', message: 'Account created! Redirecting…' });
      setTimeout(() => router.push('/dashboard'), 800);
    } catch (err: any) {
      const msg =
        err.code === 'auth/email-already-in-use' ? 'An account with this email already exists.'        :
        err.code === 'auth/invalid-email'         ? 'Please enter a valid email address.'               :
        err.code === 'auth/weak-password'         ? 'Password is too weak. Use at least 6 characters.' :
        'Sign-up failed. Please try again.';
      setToast({ type: 'error', message: msg });
    } finally { setLoading(false); }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
      const credential = await signInWithPopup(auth, googleProvider);
      await ensureUserDoc(credential.user.uid, credential.user.email!, credential.user.displayName);
      setToast({ type: 'success', message: 'Signed in with Google! Redirecting…' });
      setTimeout(() => router.push('/dashboard'), 800);
    } catch (err: any) {
      if (err.code !== 'auth/popup-closed-by-user')
        setToast({ type: 'error', message: 'Google sign-in failed. Please try again.' });
    } finally { setGoogleLoading(false); }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) { setToast({ type: 'error', message: 'Enter your email to reset your password.' }); return; }
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setToast({ type: 'success', message: 'Reset link sent — check your inbox.' });
      setTimeout(() => switchMode('login'), 1500);
    } catch {
      setToast({ type: 'error', message: 'Could not send reset email. Check the address.' });
    } finally { setLoading(false); }
  };

  const headings = {
    login:  { title: 'Welcome back',   sub: 'Sign in to your smartfarm dashboard'           },
    signup: { title: 'Create account', sub: 'Start monitoring your farm today'              },
    reset:  { title: 'Reset password', sub: "Enter your email and we'll send a reset link"  },
  };

  return (
    <div className="min-h-screen flex overflow-hidden relative"
      style={{ background: '#0f1824', fontFamily: "'DM Sans', system-ui, sans-serif" }}>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&family=Space+Grotesk:wght@400;500;600;700&display=swap');

        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #1e293b; }
        ::-webkit-scrollbar-thumb { background: #334155; border-radius: 2px; }

        /* dashboard card */
        .card { background: rgba(30,41,59,0.6); border: 1px solid rgba(71,85,105,0.35); backdrop-filter: blur(12px); }
        .section-title { font-family: 'Space Grotesk', sans-serif; }
        .stat-number   { font-family: 'Space Grotesk', monospace; }

        /* gradient border — same as dashboard hero */
        .gradient-border {
          background: linear-gradient(#0f1824, #0f1824) padding-box,
                      linear-gradient(135deg, #10b981, #06b6d4, #a78bfa) border-box;
          border: 1px solid transparent;
        }

        /* grid dot background */
        .grid-bg {
          background-image:
            linear-gradient(rgba(16,185,129,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(16,185,129,0.03) 1px, transparent 1px);
          background-size: 60px 60px;
        }

        /* shimmer */
        @keyframes shimmer { from{background-position:-200% 0} to{background-position:200% 0} }
        .shimmer-text {
          background: linear-gradient(90deg, #10b981, #06b6d4, #a78bfa, #10b981);
          background-size: 200% auto;
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
          animation: shimmer 5s linear infinite;
        }

        /* left panel slide-in */
        .left-appear { opacity:0; transform:translateX(-28px); transition:opacity .6s cubic-bezier(.22,1,.36,1) var(--delay,0s),transform .6s cubic-bezier(.22,1,.36,1) var(--delay,0s); }
        .left-appear.show { opacity:1; transform:translateX(0); }

        /* form card slide-up */
        .card-appear { opacity:0; transform:translateY(24px) scale(0.98); transition:opacity .55s cubic-bezier(.22,.68,0,1.2),transform .55s cubic-bezier(.22,.68,0,1.2); }
        .card-appear.show { opacity:1; transform:translateY(0) scale(1); }

        /* toast */
        .toast-enter { animation:toastIn .35s cubic-bezier(.22,.68,0,1.2) both; }
        @keyframes toastIn { from{opacity:0;transform:translateY(-12px) scale(0.95)} to{opacity:1;transform:translateY(0) scale(1)} }

        /* input */
        .input-field {
          width:100%;
          background: rgba(15,24,36,0.7);
          border: 1px solid rgba(71,85,105,0.4);
          border-radius: 12px;
          padding: 13px 44px;
          color: #f1f5f9;
          font-size: 14px;
          font-family: inherit;
          outline: none;
          transition: border-color .2s, box-shadow .2s, background .2s;
        }
        .input-field::placeholder { color: #475569; }
        .input-field:focus {
          border-color: rgba(16,185,129,0.5);
          box-shadow: 0 0 0 3px rgba(16,185,129,0.08);
          background: rgba(15,24,36,0.9);
        }

        /* primary button */
        .btn-primary {
          width:100%; padding:13px; border-radius:12px;
          background: linear-gradient(135deg, #059669, #0891b2);
          color:#fff; font-weight:700; font-size:15px; font-family:'Space Grotesk',sans-serif;
          border:none; cursor:pointer;
          display:flex; align-items:center; justify-content:center; gap:8px;
          transition: opacity .2s, box-shadow .2s, transform .15s;
          box-shadow: 0 4px 14px rgba(5,150,105,0.25);
        }
        .btn-primary:hover:not(:disabled) { opacity:.9; box-shadow:0 8px 28px rgba(5,150,105,0.35); transform:translateY(-1px); }
        .btn-primary:active:not(:disabled) { transform:translateY(0); }
        .btn-primary:disabled { opacity:.45; cursor:not-allowed; }

        /* google button */
        .btn-google {
          width:100%; padding:12px; border-radius:12px;
          background: rgba(30,41,59,0.6);
          border: 1px solid rgba(71,85,105,0.4);
          color:#cbd5e1; font-weight:600; font-size:14px; font-family:inherit;
          cursor:pointer; display:flex; align-items:center; justify-content:center; gap:10px;
          backdrop-filter: blur(12px);
          transition: background .2s, border-color .2s, transform .15s;
        }
        .btn-google:hover:not(:disabled) { background:rgba(30,41,59,0.9); border-color:rgba(71,85,105,0.6); transform:translateY(-1px); }
        .btn-google:disabled { opacity:.45; cursor:not-allowed; }

        /* mode tabs */
        .mode-tab { flex:1; padding:9px; border-radius:10px; font-size:13px; font-weight:600; font-family:'Space Grotesk',sans-serif; border:none; cursor:pointer; transition:background .2s,color .2s; }
        .mode-tab.active   { background:linear-gradient(135deg,#059669,#0891b2); color:#fff; box-shadow:0 4px 12px rgba(5,150,105,0.25); }
        .mode-tab.inactive { background:transparent; color:#64748b; }
        .mode-tab.inactive:hover { color:#94a3b8; }

        /* stat pill */
        .stat-pill {
          display:flex; align-items:center; gap:8px;
          padding:10px 16px; border-radius:50px;
          background: rgba(16,185,129,0.07);
          border: 1px solid rgba(16,185,129,0.18);
          backdrop-filter: blur(8px);
          transition: background .2s, border-color .2s;
        }
        .stat-pill:hover { background:rgba(16,185,129,0.12); border-color:rgba(16,185,129,0.3); }

        /* orb glow blobs */
        .orb { position:absolute; border-radius:50%; pointer-events:none; filter:blur(80px); }

        /* divider */
        .divider-line { flex:1; height:1px; background:rgba(71,85,105,0.35); }

        /* glow-pulse CTA */
        @keyframes glow-pulse { 0%,100%{box-shadow:0 4px 14px rgba(5,150,105,0.2)} 50%{box-shadow:0 8px 28px rgba(5,150,105,0.4)} }
        .glow-btn { animation: glow-pulse 3s ease-in-out infinite; }
      `}</style>

      {/* ═══════════════════════════════════════════════════════════
          LEFT PANEL
      ════════════════════════════════════════════════════════════ */}
      <div className="hidden lg:flex flex-col justify-between w-[52%] relative overflow-hidden p-12 grid-bg"
        style={{ borderRight: '1px solid rgba(71,85,105,0.25)' }}>

        {/* Ambient blobs */}
        <div className="orb w-[500px] h-[500px] -top-24 -left-24"
          style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.12) 0%, transparent 70%)' }} />
        <div className="orb w-[400px] h-[400px] -bottom-20 -right-20"
          style={{ background: 'radial-gradient(circle, rgba(6,182,212,0.08) 0%, transparent 70%)' }} />
        <div className="orb w-[300px] h-[300px] top-1/2 right-1/4"
          style={{ background: 'radial-gradient(circle, rgba(168,85,247,0.05) 0%, transparent 70%)' }} />

        <Particles />

        {/* Logo */}
        <div className={`relative z-10 flex items-center gap-3 left-appear ${mounted ? 'show' : ''}`}
          style={{ '--delay': '0s' } as React.CSSProperties}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #059669, #0891b2)', boxShadow: '0 4px 12px rgba(5,150,105,0.3)' }}>
            <Leaf className="w-4.5 h-4.5 text-white" style={{ width: 18, height: 18 }} />
          </div>
          <span className="font-bold text-xl tracking-tight text-slate-100 section-title">
            smart<span style={{ color: '#10b981' }}>farm</span>
          </span>
        </div>

        {/* Hero copy */}
        <div className={`relative z-10 left-appear ${mounted ? 'show' : ''}`}
          style={{ '--delay': '0.12s' } as React.CSSProperties}>

          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 mb-7">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-semibold tracking-widest uppercase text-emerald-400 section-title">Real-time IoT Monitoring</span>
          </div>

          <h1 className="text-4xl xl:text-5xl font-extrabold text-slate-100 leading-tight mb-5 section-title"
            style={{ letterSpacing: '-0.025em' }}>
            Your Farm.<br />
            Always <span className="shimmer-text">in Your Hands.</span>
          </h1>

          <p className="text-slate-400 text-base leading-relaxed max-w-sm mb-10">
            Sign in to access live sensor data, AI-powered insights, and precision controls for your greenhouse, hydroponics, or open field.
          </p>

          {/* Feature pills */}
          <div className="flex flex-col gap-3">
            {[
              { emoji: '🌱', label: 'Live soil & climate sensors' },
              { emoji: '🤖', label: 'AI agronomist — ask anything' },
              { emoji: '💧', label: 'Smart irrigation scheduling'  },
            ].map(f => (
              <div key={f.label} className="stat-pill w-fit">
                <span className="text-base">{f.emoji}</span>
                <span className="text-sm font-medium text-slate-300">{f.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom stats */}
        <div className={`relative z-10 flex gap-8 left-appear ${mounted ? 'show' : ''}`}
          style={{ '--delay': '0.22s' } as React.CSSProperties}>
          {[
            { value: '40%', label: 'Water Saved'  },
            { value: '28%', label: 'Yield Boost'  },
            { value: '24/7', label: 'Monitoring'  },
          ].map(s => (
            <div key={s.label}>
              <p className="text-xl font-extrabold text-emerald-400 stat-number">{s.value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          RIGHT PANEL — FORM
      ════════════════════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-10 relative min-h-screen"
        style={{ background: 'rgba(9,16,26,0.4)' }}>

        {/* Ambient right-side blobs */}
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.04) 0%, transparent 70%)' }} />
        <div className="absolute -bottom-40 -right-20 w-[400px] h-[400px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.03) 0%, transparent 70%)' }} />

        {/* Mobile logo */}
        <div className="lg:hidden flex items-center gap-2.5 mb-10">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #059669, #0891b2)', boxShadow: '0 4px 12px rgba(5,150,105,0.25)' }}>
            <Leaf className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-lg tracking-tight text-slate-100 section-title">
            smart<span style={{ color: '#10b981' }}>farm</span>
          </span>
        </div>

        {/* Toast */}
        {toast && (
          <div className="absolute top-6 left-1/2 -translate-x-1/2 z-50 toast-enter" style={{ minWidth: 300, maxWidth: 400 }}>
            <div className={`flex items-start gap-3 px-5 py-4 rounded-2xl border text-sm font-medium shadow-2xl backdrop-blur-xl ${
              toast.type === 'success'
                ? 'bg-emerald-950/80 border-emerald-500/30 text-emerald-300'
                : 'bg-red-950/80 border-red-500/30 text-red-300'
            }`}>
              {toast.type === 'success'
                ? <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-emerald-400" />
                : <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-red-400" />}
              {toast.message}
            </div>
          </div>
        )}

        {/* Form card */}
        <div className={`card-appear ${mounted ? 'show' : ''} w-full`} style={{ maxWidth: 420 }}>

          {/* Mode tabs */}
          {mode !== 'reset' && (
            <div className="flex gap-1 p-1 rounded-xl mb-7"
              style={{ background: 'rgba(15,24,36,0.6)', border: '1px solid rgba(71,85,105,0.3)' }}>
              <button className={`mode-tab ${mode === 'login'  ? 'active' : 'inactive'}`} onClick={() => switchMode('login')}  type="button">Sign In</button>
              <button className={`mode-tab ${mode === 'signup' ? 'active' : 'inactive'}`} onClick={() => switchMode('signup')} type="button">Sign Up</button>
            </div>
          )}

          {/* Heading */}
          <div className="mb-6">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-100 mb-2 section-title"
              style={{ letterSpacing: '-0.02em' }}>
              {headings[mode].title}
            </h2>
            <p className="text-slate-500 text-sm">{headings[mode].sub}</p>
          </div>

          {/* ─── LOGIN ─────────────────────────────────────────── */}
          {mode === 'login' && (
            <div>
              <button className="btn-google mb-5" onClick={handleGoogleLogin} disabled={googleLoading || loading} type="button">
                {googleLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <GoogleIcon />}
                Continue with Google
              </button>

              <div className="flex items-center gap-4 mb-5">
                <div className="divider-line" />
                <span className="text-xs text-slate-600 font-medium whitespace-nowrap">or sign in with email</span>
                <div className="divider-line" />
              </div>

              <form onSubmit={handleEmailLogin} className="space-y-4">
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ width: 16, height: 16, color: '#475569' }} />
                  <input type="email" className="input-field" placeholder="you@example.com"
                    value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" disabled={loading} />
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ width: 16, height: 16, color: '#475569' }} />
                  <input type={showPw ? 'text' : 'password'} className="input-field" placeholder="Password"
                    value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" disabled={loading} style={{ paddingRight: 48 }} />
                  <button type="button" onClick={() => setShowPw(v => !v)} tabIndex={-1}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                    {showPw ? <EyeOff style={{ width: 16, height: 16 }} /> : <Eye style={{ width: 16, height: 16 }} />}
                  </button>
                </div>
                <div className="flex justify-end">
                  <button type="button" onClick={() => switchMode('reset')}
                    className="text-xs text-slate-500 hover:text-emerald-400 transition-colors">
                    Forgot password?
                  </button>
                </div>
                <button type="submit" className="btn-primary glow-btn" disabled={loading || googleLoading}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Sign In <ArrowRight style={{ width: 15, height: 15 }} /></>}
                </button>
              </form>
            </div>
          )}

          {/* ─── SIGN UP ───────────────────────────────────────── */}
          {mode === 'signup' && (
            <div>
              <button className="btn-google mb-5" onClick={handleGoogleLogin} disabled={googleLoading || loading} type="button">
                {googleLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <GoogleIcon />}
                Continue with Google
              </button>

              <div className="flex items-center gap-4 mb-5">
                <div className="divider-line" />
                <span className="text-xs text-slate-600 font-medium whitespace-nowrap">or sign up with email</span>
                <div className="divider-line" />
              </div>

              <form onSubmit={handleEmailSignup} className="space-y-4">
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ width: 16, height: 16, color: '#475569' }} />
                  <input type="text" className="input-field" placeholder="Full name"
                    value={name} onChange={e => setName(e.target.value)} autoComplete="name" disabled={loading} />
                </div>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ width: 16, height: 16, color: '#475569' }} />
                  <input type="email" className="input-field" placeholder="you@example.com"
                    value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" disabled={loading} />
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ width: 16, height: 16, color: '#475569' }} />
                  <input type={showPw ? 'text' : 'password'} className="input-field" placeholder="Password (min. 6 characters)"
                    value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" disabled={loading} style={{ paddingRight: 48 }} />
                  <button type="button" onClick={() => setShowPw(v => !v)} tabIndex={-1}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                    {showPw ? <EyeOff style={{ width: 16, height: 16 }} /> : <Eye style={{ width: 16, height: 16 }} />}
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ width: 16, height: 16, color: '#475569' }} />
                  <input type={showConfirmPw ? 'text' : 'password'} className="input-field" placeholder="Confirm password"
                    value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} autoComplete="new-password" disabled={loading} style={{ paddingRight: 48 }} />
                  <button type="button" onClick={() => setShowConfirmPw(v => !v)} tabIndex={-1}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                    {showConfirmPw ? <EyeOff style={{ width: 16, height: 16 }} /> : <Eye style={{ width: 16, height: 16 }} />}
                  </button>
                </div>
                <button type="submit" className="btn-primary glow-btn" disabled={loading || googleLoading}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Create Account <ArrowRight style={{ width: 15, height: 15 }} /></>}
                </button>
              </form>
            </div>
          )}

          {/* ─── RESET ─────────────────────────────────────────── */}
          {mode === 'reset' && (
            <div>
              <form onSubmit={handleReset} className="space-y-4">
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ width: 16, height: 16, color: '#475569' }} />
                  <input type="email" className="input-field" placeholder="you@example.com"
                    value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" disabled={loading} />
                </div>
                <button type="submit" className="btn-primary glow-btn" disabled={loading}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Send Reset Link <ArrowRight style={{ width: 15, height: 15 }} /></>}
                </button>
                <button type="button" onClick={() => switchMode('login')}
                  className="w-full text-sm text-slate-500 hover:text-slate-300 transition-colors pt-1">
                  ← Back to sign in
                </button>
              </form>
            </div>
          )}

          {/* Footer */}
          <div className="mt-8 pt-5 text-center text-xs text-slate-600"
            style={{ borderTop: '1px solid rgba(71,85,105,0.25)' }}>
            Protected by Firebase Auth · smartfarm {new Date().getFullYear()}
          </div>
        </div>
      </div>
    </div>
  );
}