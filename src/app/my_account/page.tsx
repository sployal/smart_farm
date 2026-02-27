'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  onAuthStateChanged, updateProfile, updateEmail, updatePassword,
  reauthenticateWithCredential, EmailAuthProvider, User,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useRole } from '@/hooks/useRole';
import {
  Leaf, User as UserIcon, Mail, Lock, Edit2, Check, X,
  AlertCircle, CheckCircle, Loader2, Shield, LogOut, Eye, EyeOff,
  Calendar, Globe, ArrowLeft, Sprout, ShieldCheck, UserCircle2, ChevronRight,
  Activity, Database, Wifi, Cpu, BarChart3, Bell, Settings, Star,
  TrendingUp, Clock, MapPin,
} from 'lucide-react';

type Toast        = { type: 'success' | 'error' | 'info'; message: string } | null;
type EditingField = 'name' | 'email' | 'password' | null;

function getInitials(name: string | null, email: string | null): string {
  if (name) {
    const parts = name.trim().split(' ');
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : parts[0].slice(0, 2).toUpperCase();
  }
  return email ? email.slice(0, 2).toUpperCase() : 'U';
}

function RoleBadge({ role }: { role: string | null }) {
  if (!role) return null;
  const config: Record<string, { bg: string; border: string; color: string; icon: React.ReactNode; label: string }> = {
    admin: {
      bg: 'rgba(168,85,247,0.12)', border: 'rgba(168,85,247,0.35)', color: '#d8b4fe',
      icon: <ShieldCheck style={{ width: 11, height: 11 }} />, label: 'Admin',
    },
    gardener: {
      bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.35)', color: '#6ee7b7',
      icon: <Sprout style={{ width: 11, height: 11 }} />, label: 'Gardener',
    },
    user: {
      bg: 'rgba(100,116,139,0.12)', border: 'rgba(100,116,139,0.35)', color: '#94a3b8',
      icon: <UserCircle2 style={{ width: 11, height: 11 }} />, label: 'User',
    },
  };
  const c = config[role] ?? config.user;
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
      style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.color }}>
      {c.icon} {c.label}
    </span>
  );
}

function ProviderBadge({ providerId }: { providerId: string }) {
  const isGoogle = providerId === 'google.com';
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
      style={{
        background: isGoogle ? 'rgba(66,133,244,0.12)' : 'rgba(16,185,129,0.12)',
        border: `1px solid ${isGoogle ? 'rgba(66,133,244,0.3)' : 'rgba(16,185,129,0.3)'}`,
        color: isGoogle ? '#93c5fd' : '#6ee7b7',
      }}>
      {isGoogle ? (
        <svg className="w-3 h-3" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
      ) : (
        <Mail className="w-3 h-3" />
      )}
      {isGoogle ? 'Google Account' : 'Email & Password'}
    </span>
  );
}

function InputField({ type = 'text', placeholder, value, onChange, icon, rightSlot, autoFocus }: {
  type?: string; placeholder: string; value: string; onChange: (v: string) => void;
  icon?: React.ReactNode; rightSlot?: React.ReactNode; autoFocus?: boolean;
}) {
  return (
    <div className="relative">
      {icon && (
        <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#475569' }}>
          {icon}
        </div>
      )}
      <input
        type={type} placeholder={placeholder} value={value}
        onChange={e => onChange(e.target.value)} autoFocus={autoFocus}
        className="w-full rounded-xl text-sm outline-none transition-all"
        style={{
          background: 'rgba(15,24,36,0.8)', border: '1px solid rgba(71,85,105,0.5)',
          color: '#f1f5f9', fontFamily: 'inherit',
          padding: icon
            ? rightSlot ? '11px 44px 11px 38px' : '11px 14px 11px 38px'
            : rightSlot ? '11px 44px 11px 14px' : '11px 14px',
        }}
        onFocus={e => {
          e.currentTarget.style.borderColor = 'rgba(16,185,129,0.5)';
          e.currentTarget.style.boxShadow = '0 0 0 3px rgba(16,185,129,0.08)';
        }}
        onBlur={e => {
          e.currentTarget.style.borderColor = 'rgba(71,85,105,0.5)';
          e.currentTarget.style.boxShadow = 'none';
        }}
      />
      {rightSlot && <div className="absolute right-3 top-1/2 -translate-y-1/2">{rightSlot}</div>}
    </div>
  );
}

function EyeToggle({ show, onToggle }: { show: boolean; onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle} tabIndex={-1} style={{ color: '#475569' }}
      onMouseEnter={e => (e.currentTarget.style.color = '#94a3b8')}
      onMouseLeave={e => (e.currentTarget.style.color = '#475569')}>
      {show ? <EyeOff style={{ width: 15, height: 15 }} /> : <Eye style={{ width: 15, height: 15 }} />}
    </button>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const [user,        setUser]        = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const { role, loading: roleLoading } = useRole();

  const [editingField,    setEditingField]    = useState<EditingField>(null);
  const [fieldValue,      setFieldValue]      = useState('');
  const [newPassword,     setNewPassword]     = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [showPw,          setShowPw]          = useState(false);
  const [showNewPw,       setShowNewPw]       = useState(false);
  const [showConfirmPw,   setShowConfirmPw]   = useState(false);
  const [saving,          setSaving]          = useState(false);
  const [toast,           setToast]           = useState<Toast>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => {
      if (!u) router.replace('/'); else setUser(u);
      setAuthLoading(false);
    });
    return () => unsub();
  }, [router]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  const isEmailProvider = user?.providerData.some(p => p.providerId === 'password');

  const openEdit = (field: EditingField) => {
    setFieldValue(field === 'name' ? user?.displayName || '' : field === 'email' ? user?.email || '' : '');
    setNewPassword(''); setConfirmPassword(''); setCurrentPassword('');
    setShowPw(false); setShowNewPw(false); setShowConfirmPw(false);
    setEditingField(field);
  };

  const reauth = async () => {
    if (!user?.email) throw new Error('No email');
    const cred = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, cred);
  };

  const handleSaveName = async () => {
    if (!fieldValue.trim()) { setToast({ type: 'error', message: 'Name cannot be empty.' }); return; }
    setSaving(true);
    try {
      await updateProfile(user!, { displayName: fieldValue.trim() });
      setUser({ ...user! });
      setToast({ type: 'success', message: 'Name updated successfully.' });
      setEditingField(null);
    } catch { setToast({ type: 'error', message: 'Failed to update name. Try again.' }); }
    finally { setSaving(false); }
  };

  const handleSaveEmail = async () => {
    if (!fieldValue.trim()) { setToast({ type: 'error', message: 'Email cannot be empty.' }); return; }
    if (!currentPassword)   { setToast({ type: 'error', message: 'Enter your current password to change email.' }); return; }
    setSaving(true);
    try {
      await reauth();
      await updateEmail(user!, fieldValue.trim());
      setToast({ type: 'success', message: 'Email updated successfully.' });
      setEditingField(null);
    } catch (err: any) {
      const msg =
        err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential' ? 'Incorrect current password.'   :
        err.code === 'auth/email-already-in-use'                                      ? 'This email is already in use.' :
        err.code === 'auth/invalid-email'                                             ? 'Please enter a valid email.'   :
        'Failed to update email. Try again.';
      setToast({ type: 'error', message: msg });
    } finally { setSaving(false); }
  };

  const handleSavePassword = async () => {
    if (!currentPassword)                { setToast({ type: 'error', message: 'Enter your current password.' }); return; }
    if (newPassword.length < 6)          { setToast({ type: 'error', message: 'New password must be at least 6 characters.' }); return; }
    if (newPassword !== confirmPassword) { setToast({ type: 'error', message: 'New passwords do not match.' }); return; }
    setSaving(true);
    try {
      await reauth();
      await updatePassword(user!, newPassword);
      setToast({ type: 'success', message: 'Password updated successfully.' });
      setEditingField(null);
    } catch (err: any) {
      const msg =
        err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential' ? 'Incorrect current password.' :
        err.code === 'auth/weak-password'                                             ? 'New password is too weak.'   :
        'Failed to update password. Try again.';
      setToast({ type: 'error', message: msg });
    } finally { setSaving(false); }
  };

  const handleSave = () => {
    if (editingField === 'name')     return handleSaveName();
    if (editingField === 'email')    return handleSaveEmail();
    if (editingField === 'password') return handleSavePassword();
  };

  const handleSignOut = async () => { await auth.signOut(); router.replace('/'); };

  if (authLoading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0f1824' }}>
      <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
    </div>
  );
  if (!user) return null;

  const initials = getInitials(user.displayName, user.email);
  const joinDate = user.metadata.creationTime
    ? new Date(user.metadata.creationTime).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : 'Unknown';
  const lastSignIn = user.metadata.lastSignInTime
    ? new Date(user.metadata.lastSignInTime).toLocaleString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
      })
    : 'Unknown';

  const stats = [
    { icon: BarChart3,  label: 'Plots Monitored',  value: '6',    color: '#10b981', bg: 'rgba(16,185,129,0.08)'  },
    { icon: Activity,   label: 'Sensor Readings',  value: '1.2k', color: '#3b82f6', bg: 'rgba(59,130,246,0.08)'  },
    { icon: TrendingUp, label: 'AI Insights Used', value: '48',   color: '#a78bfa', bg: 'rgba(167,139,250,0.08)' },
    { icon: Star,       label: 'Harvest Events',   value: '3',    color: '#f59e0b', bg: 'rgba(245,158,11,0.08)'  },
  ];

  return (
    <div className="min-h-screen text-slate-100" style={{ background: '#0f1824', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&family=Space+Grotesk:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #1e293b; }
        ::-webkit-scrollbar-thumb { background: #334155; border-radius: 2px; }
        .card { background: rgba(30,41,59,0.6); border: 1px solid rgba(71,85,105,0.35); backdrop-filter: blur(12px); }
        .gradient-border { background: linear-gradient(#1e293b, #1e293b) padding-box, linear-gradient(135deg, #10b981, #06b6d4, #a78bfa) border-box; border: 1px solid transparent; }
        .stat-number { font-family: 'Space Grotesk', monospace; }
        .section-title { font-family: 'Space Grotesk', sans-serif; }
        .shimmer { background: linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.03) 50%, rgba(255,255,255,0) 100%); background-size: 200% 100%; animation: shimmer 2s infinite; }
        @keyframes shimmer { from { background-position: -200% 0; } to { background-position: 200% 0; } }
        @keyframes panelIn {
          from { opacity:0; transform:translateY(-6px) scale(.98) }
          to   { opacity:1; transform:translateY(0) scale(1) }
        }
        @keyframes toastIn {
          from { opacity:0; transform:translateY(-10px) scale(.96) }
          to   { opacity:1; transform:translateY(0) scale(1) }
        }
      `}</style>

      {/* Ambient blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.04) 0%, transparent 70%)' }} />
        <div className="absolute top-1/2 -left-40 w-[400px] h-[400px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.03) 0%, transparent 70%)' }} />
        <div className="absolute -bottom-40 right-1/3 w-[500px] h-[500px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(168,85,247,0.02) 0%, transparent 70%)' }} />
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50"
          style={{ minWidth: 300, maxWidth: 420, animation: 'toastIn .3s cubic-bezier(.22,.68,0,1.2) both' }}>
          <div className="flex items-start gap-3 px-5 py-4 rounded-2xl border text-sm font-medium shadow-2xl"
            style={{
              background: toast.type === 'success' ? 'rgba(5,46,22,0.95)'  :
                          toast.type === 'info'    ? 'rgba(7,34,62,0.95)'  : 'rgba(60,10,10,0.95)',
              borderColor: toast.type === 'success' ? 'rgba(16,185,129,0.4)' :
                           toast.type === 'info'    ? 'rgba(59,130,246,0.4)' : 'rgba(239,68,68,0.4)',
              color: toast.type === 'success' ? '#6ee7b7' : toast.type === 'info' ? '#93c5fd' : '#fca5a5',
            }}>
            {toast.type === 'success'
              ? <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: '#34d399' }} />
              : <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0"
                  style={{ color: toast.type === 'info' ? '#60a5fa' : '#f87171' }} />}
            {toast.message}
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <header className="relative z-40 sticky top-0 h-16 border-b flex items-center justify-between px-4 md:px-6 gap-4"
        style={{ background: 'rgba(15,24,36,0.85)', backdropFilter: 'blur(20px)', borderColor: 'rgba(71,85,105,0.3)' }}>
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Leaf className="w-4 h-4 text-emerald-500" />
            <span className="hidden sm:inline">Farm Dashboard</span>
            <ChevronRight className="w-3 h-3 hidden sm:inline" />
            <span className="text-slate-200 font-medium">My Profile</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border bg-emerald-500/10 border-emerald-500/30 text-emerald-400">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-emerald-400" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
            </span>
            <span className="hidden sm:inline">Connected</span>
          </div>

          <button onClick={handleSignOut}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
            style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#fca5a5' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.15)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.08)'; }}>
            <LogOut style={{ width: 15, height: 15 }} />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </header>

      {/* ── Main ── */}
      <div className="relative z-10 p-4 md:p-6 max-w-4xl mx-auto space-y-5">

        {/* ── Hero Banner ── */}
        <div className="relative rounded-2xl overflow-hidden gradient-border p-6 md:p-8"
          style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.08) 0%, rgba(15,24,36,0.95) 50%, rgba(6,182,212,0.05) 100%)' }}>
          <div className="absolute inset-0 pointer-events-none"
            style={{ backgroundImage: 'radial-gradient(circle at 80% 50%, rgba(16,185,129,0.06) 0%, transparent 60%)' }} />
          <div className="absolute inset-0 shimmer pointer-events-none" />

          <div className="relative flex flex-col sm:flex-row items-center sm:items-start gap-6">
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              <div className="p-0.5 rounded-full" style={{ background: 'conic-gradient(#10b981, #06b6d4, #a78bfa, #10b981)' }}>
                <div className="p-1 rounded-full" style={{ background: '#0f1824' }}>
                  {user.photoURL ? (
                    <img src={user.photoURL} alt="Profile" className="w-24 h-24 rounded-full object-cover" />
                  ) : (
                    <div className="w-24 h-24 rounded-full flex items-center justify-center text-3xl font-extrabold section-title"
                      style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.2), rgba(6,182,212,0.2))', color: '#34d399' }}>
                      {initials}
                    </div>
                  )}
                </div>
              </div>
              <span className="absolute bottom-2 right-2 w-4 h-4 rounded-full border-2"
                style={{ background: '#10b981', borderColor: '#0f1824' }} />
            </div>

            {/* Name / meta */}
            <div className="flex-1 text-center sm:text-left min-w-0">
              <div className="flex items-center gap-2 mb-2 justify-center sm:justify-start">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  ACTIVE FARMER
                </span>
              </div>
              <h1 className="section-title text-3xl md:text-4xl font-bold text-slate-100 mb-1" style={{ letterSpacing: '-0.02em' }}>
                {user.displayName || 'smartfarm User'}
              </h1>
              <p className="text-slate-400 text-sm mb-4">{user.email}</p>
              <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                {user.providerData.map(p => <ProviderBadge key={p.providerId} providerId={p.providerId} />)}
                {!roleLoading && <RoleBadge role={role} />}
                {user.emailVerified && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
                    style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', color: '#6ee7b7' }}>
                    <CheckCircle style={{ width: 11, height: 11 }} /> Verified
                  </span>
                )}
              </div>
            </div>

            {/* Member since card */}
            <div className="flex-shrink-0 px-5 py-4 rounded-2xl text-center card" style={{ minWidth: 130 }}>
              <Leaf className="w-5 h-5 text-emerald-400 mx-auto mb-2" />
              <p className="text-xs text-slate-500 mb-1">Member since</p>
              <p className="text-sm font-bold text-emerald-400 stat-number">{joinDate}</p>
              <div className="mt-2 h-px" style={{ background: 'rgba(71,85,105,0.3)' }} />
              <p className="text-xs text-slate-500 mt-2 mb-1">Farm region</p>
              <p className="text-xs font-semibold text-slate-300 flex items-center justify-center gap-1">
                <MapPin className="w-3 h-3 text-cyan-400" /> Kenya
              </p>
            </div>
          </div>
        </div>

        {/* ── Activity Stats ── */}
        <div>
          <h2 className="section-title text-sm font-semibold text-slate-400 uppercase tracking-widest mb-3">Farm Activity</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {stats.map(stat => (
              <div key={stat.label} className="card rounded-2xl p-4 flex items-center gap-3 hover:-translate-y-0.5 transition-all">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: stat.bg, border: `1px solid ${stat.color}25` }}>
                  <stat.icon className="w-5 h-5" style={{ color: stat.color }} />
                </div>
                <div>
                  <div className="stat-number text-xl font-bold text-slate-100">{stat.value}</div>
                  <div className="text-xs text-slate-500">{stat.label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Two-column layout ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* ── Profile Information ── */}
          <div className="card rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b flex items-center gap-3"
              style={{ borderColor: 'rgba(71,85,105,0.3)', background: 'rgba(16,185,129,0.05)', borderLeftWidth: 3, borderLeftStyle: 'solid', borderLeftColor: '#10b981' }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)' }}>
                <UserIcon className="w-4 h-4 text-emerald-400" />
              </div>
              <h2 className="section-title font-semibold text-sm text-slate-100">Profile Information</h2>
            </div>
            <div className="p-5">

              {/* Name row */}
              <div className="flex items-center justify-between py-3.5 border-b" style={{ borderColor: 'rgba(71,85,105,0.2)' }}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}>
                    <UserIcon className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-slate-500 mb-0.5">Full Name</p>
                    <p className="text-sm font-medium text-slate-200 truncate">
                      {user.displayName || <span className="text-slate-600 italic">Not set</span>}
                    </p>
                  </div>
                </div>
                <button onClick={() => openEdit('name')}
                  className="ml-4 flex-shrink-0 p-1.5 rounded-lg transition-all text-slate-500 hover:text-emerald-400 hover:bg-emerald-500/10">
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              </div>
              {editingField === 'name' && (
                <div className="py-3" style={{ animation: 'panelIn .22s cubic-bezier(.22,.68,0,1.2)' }}>
                  <div className="p-4 rounded-xl space-y-3" style={{ background: 'rgba(15,24,36,0.6)', border: '1px solid rgba(16,185,129,0.2)' }}>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Edit Full Name</p>
                    <InputField placeholder="Your full name" value={fieldValue} onChange={setFieldValue}
                      icon={<UserIcon className="w-3.5 h-3.5" />} autoFocus />
                    <div className="flex gap-2">
                      <button onClick={handleSave} disabled={saving}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all disabled:opacity-40"
                        style={{ background: '#10b981', color: '#051c12' }}>
                        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Save
                      </button>
                      <button onClick={() => setEditingField(null)}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-slate-400 border border-slate-700 hover:bg-slate-800 transition-all">
                        <X className="w-3.5 h-3.5" /> Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Email row */}
              <div className="flex items-center justify-between py-3.5 border-b" style={{ borderColor: 'rgba(71,85,105,0.2)' }}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}>
                    <Mail className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-slate-500 mb-0.5">Email Address</p>
                    <p className="text-sm font-medium text-slate-200 truncate">{user.email}</p>
                  </div>
                </div>
                {isEmailProvider && (
                  <button onClick={() => openEdit('email')}
                    className="ml-4 flex-shrink-0 p-1.5 rounded-lg transition-all text-slate-500 hover:text-emerald-400 hover:bg-emerald-500/10">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              {editingField === 'email' && (
                <div className="py-3" style={{ animation: 'panelIn .22s cubic-bezier(.22,.68,0,1.2)' }}>
                  <div className="p-4 rounded-xl space-y-3" style={{ background: 'rgba(15,24,36,0.6)', border: '1px solid rgba(16,185,129,0.2)' }}>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Edit Email Address</p>
                    <InputField type="email" placeholder="New email address" value={fieldValue} onChange={setFieldValue}
                      icon={<Mail className="w-3.5 h-3.5" />} autoFocus />
                    <InputField type={showPw ? 'text' : 'password'} placeholder="Current password to confirm"
                      value={currentPassword} onChange={setCurrentPassword}
                      icon={<Lock className="w-3.5 h-3.5" />}
                      rightSlot={<EyeToggle show={showPw} onToggle={() => setShowPw(v => !v)} />} />
                    <div className="flex gap-2">
                      <button onClick={handleSave} disabled={saving}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all disabled:opacity-40"
                        style={{ background: '#10b981', color: '#051c12' }}>
                        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Save
                      </button>
                      <button onClick={() => setEditingField(null)}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-slate-400 border border-slate-700 hover:bg-slate-800 transition-all">
                        <X className="w-3.5 h-3.5" /> Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Role */}
              <div className="flex items-center gap-3 py-3.5 border-b" style={{ borderColor: 'rgba(71,85,105,0.2)' }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}>
                  {role === 'admin' ? <ShieldCheck className="w-3.5 h-3.5 text-purple-400" /> :
                   role === 'gardener' ? <Sprout className="w-3.5 h-3.5 text-emerald-400" /> :
                   <UserCircle2 className="w-3.5 h-3.5 text-slate-400" />}
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Account Role</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    {roleLoading ? <span className="text-sm text-slate-500 italic">Loading…</span> : <RoleBadge role={role} />}
                    {role === 'user' && !roleLoading && (
                      <span className="text-xs text-slate-600">· Contact admin to upgrade</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Joined */}
              <div className="flex items-center gap-3 py-3.5">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}>
                  <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-0.5">Member Since</p>
                  <p className="text-sm font-medium text-slate-200">{joinDate}</p>
                </div>
              </div>
            </div>
          </div>

          {/* ── Security ── */}
          <div className="card rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b flex items-center gap-3"
              style={{ borderColor: 'rgba(71,85,105,0.3)', background: 'rgba(168,85,247,0.05)', borderLeftWidth: 3, borderLeftStyle: 'solid', borderLeftColor: '#a855f7' }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.3)' }}>
                <Shield className="w-4 h-4 text-purple-400" />
              </div>
              <h2 className="section-title font-semibold text-sm text-slate-100">Security</h2>
            </div>
            <div className="p-5">

              {isEmailProvider ? (
                <>
                  <div className="flex items-center justify-between py-3.5 border-b" style={{ borderColor: 'rgba(71,85,105,0.2)' }}>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.2)' }}>
                        <Lock className="w-3.5 h-3.5 text-purple-400" />
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 mb-0.5">Password</p>
                        <p className="text-sm font-medium text-slate-200 tracking-widest">••••••••••</p>
                      </div>
                    </div>
                    <button onClick={() => openEdit('password')}
                      className="ml-4 flex-shrink-0 p-1.5 rounded-lg transition-all text-slate-500 hover:text-purple-400 hover:bg-purple-500/10">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {editingField === 'password' && (
                    <div className="py-3" style={{ animation: 'panelIn .22s cubic-bezier(.22,.68,0,1.2)' }}>
                      <div className="p-4 rounded-xl space-y-3" style={{ background: 'rgba(15,24,36,0.6)', border: '1px solid rgba(168,85,247,0.2)' }}>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Change Password</p>
                        <InputField type={showPw ? 'text' : 'password'} placeholder="Current password"
                          value={currentPassword} onChange={setCurrentPassword}
                          icon={<Lock className="w-3.5 h-3.5" />}
                          rightSlot={<EyeToggle show={showPw} onToggle={() => setShowPw(v => !v)} />} autoFocus />
                        <InputField type={showNewPw ? 'text' : 'password'} placeholder="New password (min. 6 chars)"
                          value={newPassword} onChange={setNewPassword}
                          icon={<Lock className="w-3.5 h-3.5" />}
                          rightSlot={<EyeToggle show={showNewPw} onToggle={() => setShowNewPw(v => !v)} />} />
                        <InputField type={showConfirmPw ? 'text' : 'password'} placeholder="Confirm new password"
                          value={confirmPassword} onChange={setConfirmPassword}
                          icon={<Lock className="w-3.5 h-3.5" />}
                          rightSlot={<EyeToggle show={showConfirmPw} onToggle={() => setShowConfirmPw(v => !v)} />} />
                        <div className="flex gap-2">
                          <button onClick={handleSave} disabled={saving}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all disabled:opacity-40"
                            style={{ background: '#a855f7', color: '#fff' }}>
                            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                            Update Password
                          </button>
                          <button onClick={() => setEditingField(null)}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-slate-400 border border-slate-700 hover:bg-slate-800 transition-all">
                            <X className="w-3.5 h-3.5" /> Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex items-center gap-3 py-3.5 px-4 rounded-xl mb-3"
                  style={{ background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.15)' }}>
                  <Shield className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <p className="text-sm text-slate-400">
                    Password managed by <span style={{ color: '#34d399', fontWeight: 600 }}>Google</span>. Change it in your Google account.
                  </p>
                </div>
              )}

              {/* Last sign-in */}
              <div className="flex items-center gap-3 py-3.5 border-b" style={{ borderColor: 'rgba(71,85,105,0.2)' }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.2)' }}>
                  <Clock className="w-3.5 h-3.5 text-purple-400" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-0.5">Last Sign-in</p>
                  <p className="text-sm font-medium text-slate-200">{lastSignIn}</p>
                </div>
              </div>

              {/* 2FA */}
              <div className="flex items-center justify-between py-3.5 border-b" style={{ borderColor: 'rgba(71,85,105,0.2)' }}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}>
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-0.5">Two-Factor Auth</p>
                    <p className="text-sm font-medium text-slate-400">Not configured</p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">Optional</span>
              </div>

              {/* Auth provider */}
              <div className="flex items-center gap-3 py-3.5">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)' }}>
                  <Globe className="w-3.5 h-3.5 text-blue-400" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Auth Provider</p>
                  <div className="flex gap-2 flex-wrap">
                    {user.providerData.map(p => <ProviderBadge key={p.providerId} providerId={p.providerId} />)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── System Info ── */}
        <div className="card rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b flex items-center gap-3"
            style={{ borderColor: 'rgba(71,85,105,0.3)', background: 'rgba(59,130,246,0.04)', borderLeftWidth: 3, borderLeftStyle: 'solid', borderLeftColor: '#3b82f6' }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)' }}>
              <Database className="w-4 h-4 text-blue-400" />
            </div>
            <h2 className="section-title font-semibold text-sm text-slate-100">System Info</h2>
          </div>
          <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: Cpu,      label: 'Authentication',    value: 'Secure Auth', color: '#f97316', bg: 'rgba(249,115,22,0.08)'  },
              { icon: Database, label: 'Database',    value: 'Firestore',     color: '#3b82f6', bg: 'rgba(59,130,246,0.08)'  },
              { icon: Wifi,     label: 'Connection',  value: 'WebSocket',     color: '#10b981', bg: 'rgba(16,185,129,0.08)'  },
              { icon: Settings, label: 'App Version', value: 'v1.0.0-beta',   color: '#a78bfa', bg: 'rgba(167,139,250,0.08)' },
            ].map(item => (
              <div key={item.label} className="rounded-xl p-3.5 hover:-translate-y-0.5 transition-all"
                style={{ background: 'rgba(15,24,36,0.5)', border: '1px solid rgba(71,85,105,0.2)' }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-2"
                  style={{ backgroundColor: item.bg, border: `1px solid ${item.color}25` }}>
                  <item.icon className="w-4 h-4" style={{ color: item.color }} />
                </div>
                <p className="text-xs text-slate-500 mb-0.5">{item.label}</p>
                <p className="text-sm font-semibold text-slate-200 stat-number">{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Notification Preferences ── */}
        <div className="card rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b flex items-center gap-3"
            style={{ borderColor: 'rgba(71,85,105,0.3)', background: 'rgba(6,182,212,0.04)', borderLeftWidth: 3, borderLeftStyle: 'solid', borderLeftColor: '#06b6d4' }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(6,182,212,0.15)', border: '1px solid rgba(6,182,212,0.3)' }}>
              <Bell className="w-4 h-4 text-cyan-400" />
            </div>
            <h2 className="section-title font-semibold text-sm text-slate-100">Notification Preferences</h2>
          </div>
          <div className="p-5">
            {[
              { label: 'Sensor threshold alerts',     sub: 'Get notified when values go critical',     enabled: true  },
              { label: 'AI crop recommendations',     sub: 'Daily insights from the AI agronomist',    enabled: true  },
              { label: 'Harvest countdown reminders', sub: '7, 3, and 1 day before estimated harvest', enabled: false },
              { label: 'Weekly farm summary',         sub: 'Summary report every Monday morning',      enabled: true  },
            ].map((item, i, arr) => (
              <div key={item.label} className="flex items-center justify-between py-3.5"
                style={{ borderBottom: i < arr.length - 1 ? '1px solid rgba(71,85,105,0.2)' : 'none' }}>
                <div>
                  <p className="text-sm font-medium text-slate-200">{item.label}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{item.sub}</p>
                </div>
                <div className="relative ml-4 flex-shrink-0 w-10 h-5 rounded-full"
                  style={{ background: item.enabled ? 'rgba(16,185,129,0.3)' : 'rgba(71,85,105,0.4)', border: `1px solid ${item.enabled ? 'rgba(16,185,129,0.5)' : 'rgba(71,85,105,0.5)'}` }}>
                  <span className="absolute top-0.5 w-4 h-4 rounded-full transition-all"
                    style={{ left: item.enabled ? '21px' : '1px', background: item.enabled ? '#10b981' : '#475569', boxShadow: item.enabled ? '0 0 6px rgba(16,185,129,0.5)' : 'none' }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between text-xs py-2 pb-8 text-slate-600">
          <span>smartfarm · Secured by Firebase Auth · Protected at rest</span>
          <span className="stat-number">{new Date().getFullYear()}</span>
        </div>

      </div>
    </div>
  );
}