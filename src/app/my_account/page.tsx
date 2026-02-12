'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  onAuthStateChanged,
  updateProfile,
  updateEmail,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  sendEmailVerification,
  User,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import {
  Leaf, User as UserIcon, Mail, Lock, Camera, Edit2, Check, X,
  AlertCircle, CheckCircle, Loader2, Shield, LogOut, Eye, EyeOff,
  Calendar, Globe, Phone,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
type Toast = { type: 'success' | 'error' | 'info'; message: string } | null;
type EditingField = 'name' | 'email' | 'phone' | 'password' | null;

// ─── Avatar initials helper ───────────────────────────────────────────────────
function getInitials(name: string | null, email: string | null): string {
  if (name) {
    const parts = name.trim().split(' ');
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : parts[0].slice(0, 2).toUpperCase();
  }
  if (email) return email.slice(0, 2).toUpperCase();
  return 'U';
}

// ─── Provider badge ───────────────────────────────────────────────────────────
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

// ─── Section card ─────────────────────────────────────────────────────────────
function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl p-6 ${className}`}
      style={{ background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(51,65,85,0.6)' }}>
      {children}
    </div>
  );
}

// ─── Inline editable field ────────────────────────────────────────────────────
function InfoRow({
  icon,
  label,
  value,
  placeholder = '—',
  editable = false,
  onEdit,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null | undefined;
  placeholder?: string;
  editable?: boolean;
  onEdit?: () => void;
}) {
  return (
    <div className="flex items-center justify-between py-3.5"
      style={{ borderBottom: '1px solid rgba(51,65,85,0.4)' }}>
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xs text-slate-500 mb-0.5" style={{ fontFamily: 'DM Sans, sans-serif' }}>{label}</p>
          <p className="text-sm font-medium text-slate-200 truncate">
            {value || <span className="text-slate-600 italic">{placeholder}</span>}
          </p>
        </div>
      </div>
      {editable && onEdit && (
        <button onClick={onEdit} type="button"
          className="ml-4 flex-shrink-0 p-1.5 rounded-lg text-slate-500 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all">
          <Edit2 style={{ width: 14, height: 14 }} />
        </button>
      )}
    </div>
  );
}

// ─── Main Profile Page ────────────────────────────────────────────────────────
export default function ProfilePage() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  // editing state
  const [editingField, setEditingField] = useState<EditingField>(null);
  const [fieldValue, setFieldValue] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [saving, setSaving] = useState(false);

  const [toast, setToast] = useState<Toast>(null);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 60);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) {
        router.replace('/');
      } else {
        setUser(u);
      }
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
  const isGoogleProvider = user?.providerData.some(p => p.providerId === 'google.com');

  // ── Open edit panel ──────────────────────────────────────
  const openEdit = (field: EditingField) => {
    setFieldValue(
      field === 'name' ? user?.displayName || '' :
      field === 'email' ? user?.email || '' :
      field === 'phone' ? user?.phoneNumber || '' : ''
    );
    setNewPassword('');
    setConfirmPassword('');
    setCurrentPassword('');
    setShowPw(false);
    setShowNewPw(false);
    setShowConfirmPw(false);
    setEditingField(field);
  };

  const cancelEdit = () => setEditingField(null);

  // ── Re-authenticate helper ───────────────────────────────
  const reauth = async () => {
    if (!user?.email) throw new Error('No email on account');
    const cred = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, cred);
  };

  // ── Save handlers ────────────────────────────────────────
  const handleSaveName = async () => {
    if (!fieldValue.trim()) {
      setToast({ type: 'error', message: 'Name cannot be empty.' });
      return;
    }
    setSaving(true);
    try {
      await updateProfile(user!, { displayName: fieldValue.trim() });
      setUser({ ...user! });        // trigger re-render
      setToast({ type: 'success', message: 'Name updated successfully.' });
      setEditingField(null);
    } catch {
      setToast({ type: 'error', message: 'Failed to update name. Try again.' });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEmail = async () => {
    if (!fieldValue.trim()) {
      setToast({ type: 'error', message: 'Email cannot be empty.' });
      return;
    }
    if (!currentPassword) {
      setToast({ type: 'error', message: 'Enter your current password to change email.' });
      return;
    }
    setSaving(true);
    try {
      await reauth();
      await updateEmail(user!, fieldValue.trim());
      await sendEmailVerification(user!);
      setToast({ type: 'success', message: 'Email updated. Check your inbox to verify.' });
      setEditingField(null);
    } catch (err: any) {
      const msg =
        err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential'
          ? 'Incorrect current password.'
          : err.code === 'auth/email-already-in-use'
          ? 'This email is already in use.'
          : err.code === 'auth/invalid-email'
          ? 'Please enter a valid email.'
          : 'Failed to update email. Try again.';
      setToast({ type: 'error', message: msg });
    } finally {
      setSaving(false);
    }
  };

  const handleSavePassword = async () => {
    if (!currentPassword) {
      setToast({ type: 'error', message: 'Enter your current password.' });
      return;
    }
    if (newPassword.length < 6) {
      setToast({ type: 'error', message: 'New password must be at least 6 characters.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setToast({ type: 'error', message: 'New passwords do not match.' });
      return;
    }
    setSaving(true);
    try {
      await reauth();
      await updatePassword(user!, newPassword);
      setToast({ type: 'success', message: 'Password updated successfully.' });
      setEditingField(null);
    } catch (err: any) {
      const msg =
        err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential'
          ? 'Incorrect current password.'
          : err.code === 'auth/weak-password'
          ? 'New password is too weak.'
          : 'Failed to update password. Try again.';
      setToast({ type: 'error', message: msg });
    } finally {
      setSaving(false);
    }
  };

  const handleSave = () => {
    if (editingField === 'name') return handleSaveName();
    if (editingField === 'email') return handleSaveEmail();
    if (editingField === 'password') return handleSavePassword();
  };

  const handleSignOut = async () => {
    await auth.signOut();
    router.replace('/');
  };

  const handleSendVerification = async () => {
    if (!user) return;
    try {
      await sendEmailVerification(user);
      setToast({ type: 'info', message: 'Verification email sent. Check your inbox.' });
    } catch {
      setToast({ type: 'error', message: 'Could not send verification email.' });
    }
  };

  // ── Loading / unauthenticated ────────────────────────────
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#060910' }}>
        <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  const initials = getInitials(user.displayName, user.email);
  const joinDate = user.metadata.creationTime
    ? new Date(user.metadata.creationTime).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : 'Unknown';

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#060910', fontFamily: "'Sora', 'DM Sans', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;600;700;800&family=DM+Sans:wght@400;500;600&display=swap');

        .page-appear {
          opacity: 0;
          transform: translateY(20px);
          transition: opacity 0.5s cubic-bezier(.22,.68,0,1.2), transform 0.5s cubic-bezier(.22,.68,0,1.2);
        }
        .page-appear.show { opacity: 1; transform: translateY(0); }

        .stagger-1 { transition-delay: 0.05s; }
        .stagger-2 { transition-delay: 0.12s; }
        .stagger-3 { transition-delay: 0.19s; }
        .stagger-4 { transition-delay: 0.26s; }

        .input-field {
          width: 100%;
          background: rgba(30,41,59,0.6);
          border: 1px solid rgba(71,85,105,0.6);
          border-radius: 10px;
          padding: 11px 40px 11px 40px;
          color: #f1f5f9;
          font-size: 14px;
          font-family: inherit;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
        }
        .input-field.no-icon { padding-left: 14px; }
        .input-field::placeholder { color: #475569; }
        .input-field:focus {
          border-color: rgba(16,185,129,0.6);
          box-shadow: 0 0 0 3px rgba(16,185,129,0.1);
          background: rgba(30,41,59,0.9);
        }

        .btn-save {
          padding: 10px 20px;
          border-radius: 10px;
          background: #10b981;
          color: #060910;
          font-weight: 700;
          font-size: 13px;
          font-family: inherit;
          border: none;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          transition: background 0.2s, box-shadow 0.2s, transform 0.15s;
        }
        .btn-save:hover:not(:disabled) {
          background: #34d399;
          box-shadow: 0 6px 20px rgba(16,185,129,0.3);
          transform: translateY(-1px);
        }
        .btn-save:disabled { opacity: 0.5; cursor: not-allowed; }

        .btn-cancel {
          padding: 10px 20px;
          border-radius: 10px;
          background: rgba(30,41,59,0.8);
          border: 1px solid rgba(71,85,105,0.5);
          color: #94a3b8;
          font-weight: 600;
          font-size: 13px;
          font-family: inherit;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          transition: background 0.2s, color 0.2s;
        }
        .btn-cancel:hover { background: rgba(30,41,59,1); color: #cbd5e1; }

        .btn-danger {
          padding: 10px 20px;
          border-radius: 10px;
          background: rgba(239,68,68,0.1);
          border: 1px solid rgba(239,68,68,0.3);
          color: #fca5a5;
          font-weight: 600;
          font-size: 13px;
          font-family: inherit;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          transition: background 0.2s, border-color 0.2s;
        }
        .btn-danger:hover { background: rgba(239,68,68,0.18); border-color: rgba(239,68,68,0.5); }

        .edit-panel {
          margin-top: 16px;
          padding: 18px;
          border-radius: 14px;
          background: rgba(15,23,42,0.9);
          border: 1px solid rgba(16,185,129,0.2);
          animation: panelIn 0.25s cubic-bezier(.22,.68,0,1.2);
        }
        @keyframes panelIn {
          from { opacity: 0; transform: translateY(-8px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }

        .toast-enter { animation: toastIn 0.35s cubic-bezier(.22,.68,0,1.2) both; }
        @keyframes toastIn {
          from { opacity:0; transform: translateY(-12px) scale(0.95); }
          to   { opacity:1; transform: translateY(0) scale(1); }
        }

        .avatar-ring {
          background: conic-gradient(#10b981, #06b6d4, #10b981);
          padding: 3px;
          border-radius: 50%;
        }
        .avatar-inner {
          background: #060910;
          border-radius: 50%;
          padding: 3px;
        }

        .grid-bg {
          background-image:
            linear-gradient(rgba(16,185,129,0.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(16,185,129,0.025) 1px, transparent 1px);
          background-size: 48px 48px;
        }

        .orb {
          position: absolute;
          border-radius: 50%;
          pointer-events: none;
          filter: blur(90px);
        }
      `}</style>

      {/* ── Background ──────────────────────────────────────── */}
      <div className="fixed inset-0 grid-bg pointer-events-none" />
      <div className="orb fixed w-[600px] h-[600px] top-[-200px] right-[-100px]"
        style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.08) 0%, transparent 70%)' }} />
      <div className="orb fixed w-[400px] h-[400px] bottom-[-100px] left-[-100px]"
        style={{ background: 'radial-gradient(circle, rgba(6,182,212,0.07) 0%, transparent 70%)' }} />

      {/* ── Toast ───────────────────────────────────────────── */}
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 toast-enter" style={{ minWidth: 300, maxWidth: 420 }}>
          <div className={`flex items-start gap-3 px-5 py-4 rounded-2xl border text-sm font-medium shadow-2xl ${
            toast.type === 'success' ? 'bg-emerald-950 border-emerald-500/40 text-emerald-300' :
            toast.type === 'info'    ? 'bg-blue-950 border-blue-500/40 text-blue-300' :
                                       'bg-red-950 border-red-500/40 text-red-300'
          }`}>
            {toast.type === 'success' ? <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-emerald-400" /> :
             toast.type === 'info'    ? <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-400" /> :
                                        <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-red-400" />}
            {toast.message}
          </div>
        </div>
      )}

      {/* ── Page content ────────────────────────────────────── */}
      <div className="relative z-10 max-w-2xl mx-auto px-4 py-10">

        {/* ── Top nav bar ─────────────────────────────────── */}
        <div className={`flex items-center justify-between mb-10 page-appear ${mounted ? 'show' : ''}`}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
              <Leaf style={{ width: 16, height: 16 }} className="text-emerald-400" />
            </div>
            <span className="font-bold text-lg tracking-tight text-slate-100">
              smart<span className="text-emerald-400">farm</span>
            </span>
          </div>
          <button onClick={handleSignOut} className="btn-danger" type="button">
            <LogOut style={{ width: 14, height: 14 }} />
            Sign Out
          </button>
        </div>

        {/* ── Hero avatar card ─────────────────────────────── */}
        <Card className={`mb-6 page-appear stagger-1 ${mounted ? 'show' : ''}`}>
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              <div className="avatar-ring">
                <div className="avatar-inner">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt="Profile" className="w-20 h-20 rounded-full object-cover" />
                  ) : (
                    <div className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-extrabold"
                      style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.3), rgba(6,182,212,0.3))', color: '#34d399' }}>
                      {initials}
                    </div>
                  )}
                </div>
              </div>
              {/* Online indicator */}
              <span className="absolute bottom-1 right-1 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2"
                style={{ borderColor: '#060910' }} />
            </div>

            {/* Name + meta */}
            <div className="flex-1 text-center sm:text-left">
              <h1 className="text-2xl font-extrabold text-slate-100 mb-1" style={{ letterSpacing: '-0.02em' }}>
                {user.displayName || 'smartfarm User'}
              </h1>
              <p className="text-slate-400 text-sm mb-3" style={{ fontFamily: 'DM Sans, sans-serif' }}>
                {user.email}
              </p>
              <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                {user.providerData.map(p => (
                  <ProviderBadge key={p.providerId} providerId={p.providerId} />
                ))}
                {!user.emailVerified && isEmailProvider && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
                    style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', color: '#fcd34d' }}>
                    <AlertCircle style={{ width: 11, height: 11 }} />
                    Email unverified
                  </span>
                )}
                {user.emailVerified && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
                    style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', color: '#6ee7b7' }}>
                    <CheckCircle style={{ width: 11, height: 11 }} />
                    Verified
                  </span>
                )}
              </div>
            </div>

            {/* Stats */}
            <div className="flex sm:flex-col gap-4 sm:gap-2 text-center sm:text-right flex-shrink-0">
              <div>
                <p className="text-xs text-slate-500 mb-0.5" style={{ fontFamily: 'DM Sans, sans-serif' }}>Member since</p>
                <p className="text-sm font-semibold text-emerald-400">{joinDate}</p>
              </div>
            </div>
          </div>
        </Card>

        {/* ── Profile info ─────────────────────────────────── */}
        <Card className={`mb-6 page-appear stagger-2 ${mounted ? 'show' : ''}`}>
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4"
            style={{ fontFamily: 'DM Sans, sans-serif' }}>
            Profile Information
          </h2>

          {/* Name row */}
          <InfoRow
            icon={<UserIcon style={{ width: 14, height: 14 }} className="text-emerald-400" />}
            label="Full Name"
            value={user.displayName}
            placeholder="Not set"
            editable
            onEdit={() => openEdit('name')}
          />
          {editingField === 'name' && (
            <div className="edit-panel">
              <p className="text-xs font-semibold text-slate-400 mb-3 uppercase tracking-wide"
                style={{ fontFamily: 'DM Sans, sans-serif' }}>Edit Full Name</p>
              <div className="relative mb-4">
                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500"
                  style={{ width: 15, height: 15 }} />
                <input type="text" className="input-field" placeholder="Your full name"
                  value={fieldValue} onChange={e => setFieldValue(e.target.value)} autoFocus />
              </div>
              <div className="flex gap-2">
                <button className="btn-save" onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check style={{ width: 14, height: 14 }} />}
                  Save
                </button>
                <button className="btn-cancel" onClick={cancelEdit} type="button">
                  <X style={{ width: 14, height: 14 }} /> Cancel
                </button>
              </div>
            </div>
          )}

          {/* Email row */}
          <InfoRow
            icon={<Mail style={{ width: 14, height: 14 }} className="text-emerald-400" />}
            label="Email Address"
            value={user.email}
            editable={isEmailProvider}
            onEdit={() => openEdit('email')}
          />
          {editingField === 'email' && (
            <div className="edit-panel">
              <p className="text-xs font-semibold text-slate-400 mb-3 uppercase tracking-wide"
                style={{ fontFamily: 'DM Sans, sans-serif' }}>Edit Email Address</p>
              <div className="space-y-3 mb-4">
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500"
                    style={{ width: 15, height: 15 }} />
                  <input type="email" className="input-field" placeholder="New email address"
                    value={fieldValue} onChange={e => setFieldValue(e.target.value)} autoFocus />
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500"
                    style={{ width: 15, height: 15 }} />
                  <input type={showPw ? 'text' : 'password'} className="input-field" placeholder="Current password to confirm"
                    value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} style={{ paddingRight: 44 }} />
                  <button type="button" onClick={() => setShowPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors" tabIndex={-1}>
                    {showPw ? <EyeOff style={{ width: 15, height: 15 }} /> : <Eye style={{ width: 15, height: 15 }} />}
                  </button>
                </div>
              </div>
              <div className="flex gap-2">
                <button className="btn-save" onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check style={{ width: 14, height: 14 }} />}
                  Save
                </button>
                <button className="btn-cancel" onClick={cancelEdit} type="button">
                  <X style={{ width: 14, height: 14 }} /> Cancel
                </button>
              </div>
            </div>
          )}

          {/* Joined row (read-only) */}
          <div className="flex items-center gap-3 py-3.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}>
              <Calendar style={{ width: 14, height: 14 }} className="text-emerald-400" />
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-0.5" style={{ fontFamily: 'DM Sans, sans-serif' }}>Joined</p>
              <p className="text-sm font-medium text-slate-200">{joinDate}</p>
            </div>
          </div>
        </Card>

        {/* ── Security ──────────────────────────────────────── */}
        <Card className={`mb-6 page-appear stagger-3 ${mounted ? 'show' : ''}`}>
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4"
            style={{ fontFamily: 'DM Sans, sans-serif' }}>
            Security
          </h2>

          {/* Password row — only for email/password accounts */}
          {isEmailProvider ? (
            <>
              <InfoRow
                icon={<Lock style={{ width: 14, height: 14 }} className="text-emerald-400" />}
                label="Password"
                value="••••••••••"
                editable
                onEdit={() => openEdit('password')}
              />
              {editingField === 'password' && (
                <div className="edit-panel">
                  <p className="text-xs font-semibold text-slate-400 mb-3 uppercase tracking-wide"
                    style={{ fontFamily: 'DM Sans, sans-serif' }}>Change Password</p>
                  <div className="space-y-3 mb-4">
                    {/* current password */}
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500"
                        style={{ width: 15, height: 15 }} />
                      <input type={showPw ? 'text' : 'password'} className="input-field" placeholder="Current password"
                        value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} autoFocus style={{ paddingRight: 44 }} />
                      <button type="button" onClick={() => setShowPw(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors" tabIndex={-1}>
                        {showPw ? <EyeOff style={{ width: 15, height: 15 }} /> : <Eye style={{ width: 15, height: 15 }} />}
                      </button>
                    </div>
                    {/* new password */}
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500"
                        style={{ width: 15, height: 15 }} />
                      <input type={showNewPw ? 'text' : 'password'} className="input-field" placeholder="New password (min. 6 chars)"
                        value={newPassword} onChange={e => setNewPassword(e.target.value)} style={{ paddingRight: 44 }} />
                      <button type="button" onClick={() => setShowNewPw(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors" tabIndex={-1}>
                        {showNewPw ? <EyeOff style={{ width: 15, height: 15 }} /> : <Eye style={{ width: 15, height: 15 }} />}
                      </button>
                    </div>
                    {/* confirm new password */}
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500"
                        style={{ width: 15, height: 15 }} />
                      <input type={showConfirmPw ? 'text' : 'password'} className="input-field" placeholder="Confirm new password"
                        value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} style={{ paddingRight: 44 }} />
                      <button type="button" onClick={() => setShowConfirmPw(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors" tabIndex={-1}>
                        {showConfirmPw ? <EyeOff style={{ width: 15, height: 15 }} /> : <Eye style={{ width: 15, height: 15 }} />}
                      </button>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button className="btn-save" onClick={handleSave} disabled={saving}>
                      {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check style={{ width: 14, height: 14 }} />}
                      Update Password
                    </button>
                    <button className="btn-cancel" onClick={cancelEdit} type="button">
                      <X style={{ width: 14, height: 14 }} /> Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Email verification */}
              {!user.emailVerified && (
                <div className="mt-4 flex items-center justify-between py-3 px-4 rounded-xl"
                  style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
                  <div className="flex items-center gap-3">
                    <AlertCircle style={{ width: 16, height: 16, color: '#fcd34d' }} />
                    <p className="text-sm text-amber-300" style={{ fontFamily: 'DM Sans, sans-serif' }}>
                      Your email is not verified
                    </p>
                  </div>
                  <button onClick={handleSendVerification} type="button"
                    className="text-xs font-semibold text-amber-400 hover:text-amber-300 transition-colors whitespace-nowrap ml-4">
                    Send link →
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center gap-3 py-3 px-4 rounded-xl"
              style={{ background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.15)' }}>
              <Shield style={{ width: 16, height: 16 }} className="text-emerald-400 flex-shrink-0" />
              <p className="text-sm text-slate-400" style={{ fontFamily: 'DM Sans, sans-serif' }}>
                Password is managed by <span className="text-emerald-400 font-semibold">Google</span>. Sign in with Google to change it.
              </p>
            </div>
          )}

          {/* Last sign-in */}
          <div className="flex items-center gap-3 mt-4 py-3.5"
            style={{ borderTop: '1px solid rgba(51,65,85,0.4)' }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}>
              <Globe style={{ width: 14, height: 14 }} className="text-emerald-400" />
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-0.5" style={{ fontFamily: 'DM Sans, sans-serif' }}>Last sign-in</p>
              <p className="text-sm font-medium text-slate-200">
                {user.metadata.lastSignInTime
                  ? new Date(user.metadata.lastSignInTime).toLocaleString('en-US', {
                      month: 'short', day: 'numeric', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })
                  : 'Unknown'}
              </p>
            </div>
          </div>
        </Card>

        {/* ── Sign out ──────────────────────────────────────── */}
        <div className={`page-appear stagger-4 ${mounted ? 'show' : ''}`}>
          <button onClick={handleSignOut} className="btn-danger w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm" type="button"
            style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
            <LogOut style={{ width: 15, height: 15 }} />
            Sign Out of smartfarm
          </button>
          <p className="text-center text-xs text-slate-600 mt-4" style={{ fontFamily: 'DM Sans, sans-serif' }}>
            smartfarm · Protected by Firebase Auth · {new Date().getFullYear()}
          </p>
        </div>

      </div>
    </div>
  );
}