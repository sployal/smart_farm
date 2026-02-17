'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  onAuthStateChanged, updateProfile, updateEmail, updatePassword,
  reauthenticateWithCredential, EmailAuthProvider, sendEmailVerification, User,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useRole } from '@/hooks/useRole';
import {
  Leaf, User as UserIcon, Mail, Lock, Edit2, Check, X,
  AlertCircle, CheckCircle, Loader2, Shield, LogOut, Eye, EyeOff,
  Calendar, Globe, ArrowLeft, Sprout, ShieldCheck, UserCircle2, ChevronRight,
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

function SectionCard({ children, accentColor = '#10b981', title, titleIcon }: {
  children: React.ReactNode; accentColor?: string; title?: string; titleIcon?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border backdrop-blur-sm overflow-hidden"
      style={{
        background: 'rgba(30,41,59,0.6)', borderColor: 'rgba(71,85,105,0.4)',
        borderLeftWidth: 3, borderLeftStyle: 'solid', borderLeftColor: accentColor,
      }}>
      {title && (
        <div className="flex items-center gap-3 px-5 py-4 border-b" style={{ borderColor: 'rgba(71,85,105,0.3)' }}>
          {titleIcon && (
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: `${accentColor}18`, border: `1px solid ${accentColor}30` }}>
              {titleIcon}
            </div>
          )}
          <h2 className="font-bold text-sm text-slate-100">{title}</h2>
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}

function InfoRow({ icon, label, value, placeholder = '—', editable = false, onEdit, noBorder = false }: {
  icon: React.ReactNode; label: string; value: string | null | undefined;
  placeholder?: string; editable?: boolean; onEdit?: () => void; noBorder?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-3.5"
      style={noBorder ? {} : { borderBottom: '1px solid rgba(71,85,105,0.25)' }}>
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xs text-slate-500 mb-0.5">{label}</p>
          <p className="text-sm font-medium text-slate-200 truncate">
            {value || <span className="text-slate-600 italic">{placeholder}</span>}
          </p>
        </div>
      </div>
      {editable && onEdit && (
        <button onClick={onEdit} type="button"
          className="ml-4 flex-shrink-0 p-1.5 rounded-lg transition-all"
          style={{ color: '#475569' }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.color = '#34d399';
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(52,211,153,0.1)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.color = '#475569';
            (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
          }}>
          <Edit2 style={{ width: 14, height: 14 }} />
        </button>
      )}
    </div>
  );
}

function EditPanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 p-4 rounded-2xl"
      style={{
        background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(16,185,129,0.2)',
        animation: 'panelIn .22s cubic-bezier(.22,.68,0,1.2)',
      }}>
      {children}
    </div>
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
          background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(71,85,105,0.5)',
          color: '#f1f5f9', fontFamily: 'inherit',
          padding: icon
            ? rightSlot ? '11px 44px 11px 38px' : '11px 14px 11px 38px'
            : rightSlot ? '11px 44px 11px 14px' : '11px 14px',
        }}
        onFocus={e => {
          e.currentTarget.style.borderColor = 'rgba(16,185,129,0.5)';
          e.currentTarget.style.boxShadow = '0 0 0 3px rgba(16,185,129,0.08)';
          e.currentTarget.style.background = 'rgba(15,23,42,0.8)';
        }}
        onBlur={e => {
          e.currentTarget.style.borderColor = 'rgba(71,85,105,0.5)';
          e.currentTarget.style.boxShadow = 'none';
          e.currentTarget.style.background = 'rgba(15,23,42,0.5)';
        }}
      />
      {rightSlot && <div className="absolute right-3 top-1/2 -translate-y-1/2">{rightSlot}</div>}
    </div>
  );
}

function SaveButton({ onClick, disabled, children }: {
  onClick: () => void; disabled?: boolean; children: React.ReactNode;
}) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
      style={{ background: '#10b981', color: '#051c12', boxShadow: disabled ? 'none' : '0 4px 14px rgba(16,185,129,0.25)' }}>
      {children}
    </button>
  );
}

function CancelButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} type="button"
      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
      style={{ background: 'rgba(30,41,59,0.6)', border: '1px solid rgba(71,85,105,0.5)', color: '#94a3b8' }}
      onMouseEnter={e => (e.currentTarget.style.color = '#cbd5e1')}
      onMouseLeave={e => (e.currentTarget.style.color = '#94a3b8')}>
      <X style={{ width: 14, height: 14 }} /> Cancel
    </button>
  );
}

function EyeToggle({ show, onToggle }: { show: boolean; onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle} tabIndex={-1}
      className="transition-colors" style={{ color: '#475569' }}
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
      await sendEmailVerification(user!);
      setToast({ type: 'success', message: 'Email updated. Check your inbox to verify.' });
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
    if (!currentPassword)            { setToast({ type: 'error', message: 'Enter your current password.' }); return; }
    if (newPassword.length < 6)      { setToast({ type: 'error', message: 'New password must be at least 6 characters.' }); return; }
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

  const handleSendVerification = async () => {
    if (!user) return;
    try {
      await sendEmailVerification(user);
      setToast({ type: 'info', message: 'Verification email sent. Check your inbox.' });
    } catch { setToast({ type: 'error', message: 'Could not send verification email.' }); }
  };

  if (authLoading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#1a2332' }}>
      <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
    </div>
  );
  if (!user) return null;

  const initials = getInitials(user.displayName, user.email);
  const joinDate = user.metadata.creationTime
    ? new Date(user.metadata.creationTime).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : 'Unknown';

  return (
    <div className="min-h-screen font-sans" style={{ background: '#1a2332', color: '#f1f5f9' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Sora:wght@300;400;600;800&display=swap');
        .grid-bg {
          background-image:
            linear-gradient(rgba(16,185,129,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(16,185,129,0.04) 1px, transparent 1px);
          background-size: 60px 60px;
        }
        @keyframes panelIn {
          from { opacity:0; transform:translateY(-6px) scale(.98) }
          to   { opacity:1; transform:translateY(0) scale(1) }
        }
        @keyframes toastIn {
          from { opacity:0; transform:translateY(-10px) scale(.96) }
          to   { opacity:1; transform:translateY(0) scale(1) }
        }
      `}</style>

      {/* ── Background layers ── */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 grid-bg" />
        <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.10) 0%, transparent 70%)', filter: 'blur(80px)' }} />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(6,182,212,0.07) 0%, transparent 70%)', filter: 'blur(80px)' }} />
      </div>

      {/* ── Toast ── */}
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

      <div className="relative z-10 max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 space-y-5">

        {/* ── Header bar ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-4 sm:py-6 border-b -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8"
          style={{ borderColor: 'rgba(100,116,139,0.3)', background: 'rgba(30,41,59,0.3)' }}>
          <div className="flex items-center gap-2 min-w-0">
            <button type="button" onClick={() => router.back()}
              className="md:hidden p-1.5 -ml-1 flex-shrink-0 text-slate-400 transition-colors">
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm mb-1 text-slate-400">
                <Leaf className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                <span>Farm Dashboard</span>
                <ChevronRight className="w-3 h-3 flex-shrink-0" />
                <span className="text-sky-400">Profile</span>
              </div>
              <h1 className="text-3xl font-black tracking-tight text-slate-100" style={{ letterSpacing: '-0.02em' }}>
                My Profile
              </h1>
              <p className="text-sm mt-1 text-slate-400">Manage your account details and security</p>
            </div>
          </div>
          <button onClick={handleSignOut}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all flex-shrink-0"
            style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#fca5a5' }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.15)';
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(239,68,68,0.45)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.08)';
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(239,68,68,0.25)';
            }}>
            <LogOut style={{ width: 15, height: 15 }} /> Sign Out
          </button>
        </div>

        {/* ── Hero avatar card ── */}
        <div className="rounded-2xl border backdrop-blur-sm overflow-hidden"
          style={{
            background: 'rgba(30,41,59,0.6)', borderColor: 'rgba(71,85,105,0.4)',
            borderLeftWidth: 3, borderLeftStyle: 'solid', borderLeftColor: '#10b981',
          }}>
          <div className="p-6 flex flex-col sm:flex-row items-center sm:items-start gap-6">
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              <div className="p-0.5 rounded-full"
                style={{ background: 'conic-gradient(#10b981, #06b6d4, #10b981)' }}>
                <div className="p-0.5 rounded-full" style={{ background: '#1a2332' }}>
                  {user.photoURL ? (
                    <img src={user.photoURL} alt="Profile" className="w-20 h-20 rounded-full object-cover" />
                  ) : (
                    <div className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-extrabold"
                      style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.25), rgba(6,182,212,0.25))', color: '#34d399' }}>
                      {initials}
                    </div>
                  )}
                </div>
              </div>
              <span className="absolute bottom-1 right-1 w-3.5 h-3.5 rounded-full border-2"
                style={{ background: '#10b981', borderColor: '#1a2332' }} />
            </div>

            {/* Name + meta */}
            <div className="flex-1 text-center sm:text-left min-w-0">
              <h2 className="text-2xl font-extrabold text-slate-100 mb-1" style={{ letterSpacing: '-0.02em' }}>
                {user.displayName || 'smartfarm User'}
              </h2>
              <p className="text-slate-400 text-sm mb-4">{user.email}</p>
              <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                {user.providerData.map(p => <ProviderBadge key={p.providerId} providerId={p.providerId} />)}
                {!roleLoading && <RoleBadge role={role} />}
                {!user.emailVerified && isEmailProvider && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
                    style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', color: '#fcd34d' }}>
                    <AlertCircle style={{ width: 11, height: 11 }} /> Unverified
                  </span>
                )}
                {user.emailVerified && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
                    style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', color: '#6ee7b7' }}>
                    <CheckCircle style={{ width: 11, height: 11 }} /> Verified
                  </span>
                )}
              </div>
            </div>

            {/* Member since */}
            <div className="flex-shrink-0 px-4 py-3 rounded-xl text-center"
              style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)' }}>
              <p className="text-xs text-slate-500 mb-1">Member since</p>
              <p className="text-sm font-bold text-emerald-400">{joinDate}</p>
            </div>
          </div>
        </div>

        {/* ── Profile Information ── */}
        <SectionCard
          title="Profile Information" accentColor="#10b981"
          titleIcon={<UserIcon style={{ width: 14, height: 14, color: '#10b981' }} />}>

          {/* Name */}
          <InfoRow icon={<UserIcon style={{ width: 14, height: 14, color: '#34d399' }} />}
            label="Full Name" value={user.displayName} placeholder="Not set" editable onEdit={() => openEdit('name')} />
          {editingField === 'name' && (
            <EditPanel>
              <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: '#475569' }}>Edit Full Name</p>
              <div className="mb-4">
                <InputField placeholder="Your full name" value={fieldValue} onChange={setFieldValue}
                  icon={<UserIcon style={{ width: 14, height: 14 }} />} autoFocus />
              </div>
              <div className="flex gap-2">
                <SaveButton onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check style={{ width: 14, height: 14 }} />}
                  Save
                </SaveButton>
                <CancelButton onClick={() => setEditingField(null)} />
              </div>
            </EditPanel>
          )}

          {/* Email */}
          <InfoRow icon={<Mail style={{ width: 14, height: 14, color: '#34d399' }} />}
            label="Email Address" value={user.email} editable={isEmailProvider} onEdit={() => openEdit('email')} />
          {editingField === 'email' && (
            <EditPanel>
              <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: '#475569' }}>Edit Email Address</p>
              <div className="space-y-3 mb-4">
                <InputField type="email" placeholder="New email address" value={fieldValue} onChange={setFieldValue}
                  icon={<Mail style={{ width: 14, height: 14 }} />} autoFocus />
                <InputField type={showPw ? 'text' : 'password'} placeholder="Current password to confirm"
                  value={currentPassword} onChange={setCurrentPassword}
                  icon={<Lock style={{ width: 14, height: 14 }} />}
                  rightSlot={<EyeToggle show={showPw} onToggle={() => setShowPw(v => !v)} />} />
              </div>
              <div className="flex gap-2">
                <SaveButton onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check style={{ width: 14, height: 14 }} />}
                  Save
                </SaveButton>
                <CancelButton onClick={() => setEditingField(null)} />
              </div>
            </EditPanel>
          )}

          {/* Role (read-only) */}
          <div className="flex items-center gap-3 py-3.5" style={{ borderBottom: '1px solid rgba(71,85,105,0.25)' }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}>
              {role === 'admin'    ? <ShieldCheck  style={{ width: 14, height: 14, color: '#d8b4fe' }} /> :
               role === 'gardener' ? <Sprout       style={{ width: 14, height: 14, color: '#34d399' }} /> :
                                     <UserCircle2  style={{ width: 14, height: 14, color: '#94a3b8' }} />}
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">Account Role</p>
              <div className="flex items-center gap-2 flex-wrap">
                {roleLoading
                  ? <span className="text-sm text-slate-500 italic">Loading…</span>
                  : <RoleBadge role={role} />}
                {role === 'user' && !roleLoading && (
                  <span className="text-xs" style={{ color: '#475569' }}>· Contact admin for Gardener access</span>
                )}
              </div>
            </div>
          </div>

          {/* Joined */}
          <div className="flex items-center gap-3 py-3.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}>
              <Calendar style={{ width: 14, height: 14, color: '#34d399' }} />
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-0.5">Joined</p>
              <p className="text-sm font-medium text-slate-200">{joinDate}</p>
            </div>
          </div>
        </SectionCard>

        {/* ── Security ── */}
        <SectionCard
          title="Security" accentColor="#a855f7"
          titleIcon={<Shield style={{ width: 14, height: 14, color: '#a855f7' }} />}>

          {isEmailProvider ? (
            <>
              <InfoRow icon={<Lock style={{ width: 14, height: 14, color: '#34d399' }} />}
                label="Password" value="••••••••••" editable onEdit={() => openEdit('password')}
                noBorder={!(!user.emailVerified)} />
              {editingField === 'password' && (
                <EditPanel>
                  <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: '#475569' }}>Change Password</p>
                  <div className="space-y-3 mb-4">
                    <InputField type={showPw ? 'text' : 'password'} placeholder="Current password"
                      value={currentPassword} onChange={setCurrentPassword}
                      icon={<Lock style={{ width: 14, height: 14 }} />}
                      rightSlot={<EyeToggle show={showPw} onToggle={() => setShowPw(v => !v)} />} autoFocus />
                    <InputField type={showNewPw ? 'text' : 'password'} placeholder="New password (min. 6 chars)"
                      value={newPassword} onChange={setNewPassword}
                      icon={<Lock style={{ width: 14, height: 14 }} />}
                      rightSlot={<EyeToggle show={showNewPw} onToggle={() => setShowNewPw(v => !v)} />} />
                    <InputField type={showConfirmPw ? 'text' : 'password'} placeholder="Confirm new password"
                      value={confirmPassword} onChange={setConfirmPassword}
                      icon={<Lock style={{ width: 14, height: 14 }} />}
                      rightSlot={<EyeToggle show={showConfirmPw} onToggle={() => setShowConfirmPw(v => !v)} />} />
                  </div>
                  <div className="flex gap-2">
                    <SaveButton onClick={handleSave} disabled={saving}>
                      {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check style={{ width: 14, height: 14 }} />}
                      Update Password
                    </SaveButton>
                    <CancelButton onClick={() => setEditingField(null)} />
                  </div>
                </EditPanel>
              )}
              {!user.emailVerified && (
                <div className="mt-4 flex items-center justify-between py-3 px-4 rounded-xl"
                  style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
                  <div className="flex items-center gap-3">
                    <AlertCircle style={{ width: 16, height: 16, color: '#fcd34d' }} />
                    <p className="text-sm" style={{ color: '#fcd34d' }}>Your email is not verified</p>
                  </div>
                  <button onClick={handleSendVerification} type="button"
                    className="text-xs font-semibold whitespace-nowrap ml-4 transition-colors"
                    style={{ color: '#f59e0b' }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#fcd34d')}
                    onMouseLeave={e => (e.currentTarget.style.color = '#f59e0b')}>
                    Send link →
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center gap-3 py-3 px-4 rounded-xl"
              style={{ background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.15)' }}>
              <Shield style={{ width: 16, height: 16, color: '#34d399' }} className="flex-shrink-0" />
              <p className="text-sm text-slate-400">
                Password is managed by <span style={{ color: '#34d399', fontWeight: 600 }}>Google</span>. Sign in with Google to change it.
              </p>
            </div>
          )}

          {/* Last sign-in */}
          <div className="flex items-center gap-3 mt-4 py-3.5" style={{ borderTop: '1px solid rgba(71,85,105,0.25)' }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.2)' }}>
              <Globe style={{ width: 14, height: 14, color: '#a855f7' }} />
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-0.5">Last sign-in</p>
              <p className="text-sm font-medium text-slate-200">
                {user.metadata.lastSignInTime
                  ? new Date(user.metadata.lastSignInTime).toLocaleString('en-US', {
                      month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
                    })
                  : 'Unknown'}
              </p>
            </div>
          </div>
        </SectionCard>

        {/* ── Sign out ── */}
        <button onClick={handleSignOut} type="button"
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-semibold transition-all"
          style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.22)', color: '#fca5a5' }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.13)';
            (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(239,68,68,0.4)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.07)';
            (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(239,68,68,0.22)';
          }}>
          <LogOut style={{ width: 15, height: 15 }} /> Sign Out of smartfarm
        </button>

        {/* Footer */}
        <div className="flex items-center justify-between text-xs py-2 pb-8 text-slate-500">
          <span>smartfarm · Protected by Firebase Auth</span>
          <span>{new Date().getFullYear()}</span>
        </div>

      </div>
    </div>
  );
}