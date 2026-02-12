
// ...existing code...
// Replacing with login page content
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  getAuth,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  onAuthStateChanged,
} from 'firebase/auth';
import { getApp } from 'firebase/app';
import { Leaf, Eye, EyeOff, ArrowRight, Mail, Lock, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { database } from '@/lib/firebase';
const auth = getAuth(); // getAuth uses default app
const googleProvider = new GoogleAuthProvider();
type Mode = 'login' | 'reset';
type Toast = { type: 'success' | 'error'; message: string } | null;

function Particles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);
    const dots = Array.from({ length: 55 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.8 + 0.4,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      opacity: Math.random() * 0.4 + 0.1,
    }));
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      dots.forEach(d => {
        d.x += d.vx;
        d.y += d.vy;
        if (d.x < 0) d.x = canvas.width;
        if (d.x > canvas.width) d.x = 0;
        if (d.y < 0) d.y = canvas.height;
        if (d.y > canvas.height) d.y = 0;
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(16,185,129,${d.opacity})`;
        ctx.fill();
      });
      dots.forEach((a, i) => {
        dots.slice(i + 1).forEach(b => {
          const dist = Math.hypot(a.x - b.x, a.y - b.y);
          if (dist < 120) {
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = `rgba(16,185,129,${0.06 * (1 - dist / 120)})`;
            ctx.lineWidth = 0.8;
            ctx.stroke();
          }
        });
      });
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);
  return <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" />;
}

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

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [toast, setToast] = useState<Toast>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 60);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, user => {
      if (user) router.replace('/dashboard');
    });
    return () => unsub();
  }, [router]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);
  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setToast({ type: 'error', message: 'Please fill in all fields.' });
      return;
    }
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      setToast({ type: 'success', message: 'Welcome back! Redirecting…' });
      setTimeout(() => router.push('/dashboard'), 800);
    } catch (err: any) {
      const msg =
        err.code === 'auth/user-not-found'
          ? 'No account found with this email.'
          : err.code === 'auth/wrong-password'
          ? 'Incorrect password. Try again.'
          : err.code === 'auth/invalid-email'
          ? 'Please enter a valid email address.'
          : err.code === 'auth/too-many-requests'
          ? 'Too many attempts. Please wait a moment.'
          : 'Sign-in failed. Please try again.';
      setToast({ type: 'error', message: msg });
    } finally {
      setLoading(false);
    }
  };
  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
      setToast({ type: 'success', message: 'Signed in with Google! Redirecting…' });
      setTimeout(() => router.push('/dashboard'), 800);
    } catch (err: any) {
      if (err.code !== 'auth/popup-closed-by-user') {
        setToast({ type: 'error', message: 'Google sign-in failed. Please try again.' });
      }
    } finally {
      setGoogleLoading(false);
    }
  };
  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setToast({ type: 'error', message: 'Enter your email to reset your password.' });
      return;
    }
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setToast({ type: 'success', message: 'Reset link sent — check your inbox.' });
      setTimeout(() => setMode('login'), 1500);
    } catch {
      setToast({ type: 'error', message: 'Could not send reset email. Check the address.' });
    } finally {
      setLoading(false);
    }
  };
  return (
    <div
      className="min-h-screen flex overflow-hidden relative"
      style={{ backgroundColor: '#060910', fontFamily: "'Sora', 'DM Sans', system-ui, sans-serif" }}
    >
      {/* ...existing login page JSX... */}
    </div>
  );
}
