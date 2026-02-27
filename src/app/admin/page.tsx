'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { collection, getDocs, doc, updateDoc, query, orderBy } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { db, auth } from '@/lib/firebase';
import { useRole } from '@/hooks/useRole';
import {
  Leaf, Users, ShieldCheck, Sprout, UserCircle2,
  LogOut, Loader2, RefreshCw, Search, ChevronDown, ChevronRight, ArrowLeft,
} from 'lucide-react';

type Role = 'admin' | 'gardener' | 'user';

interface UserRecord {
  uid:         string;
  email:       string;
  displayName: string;
  role:        Role;
  createdAt?:  { seconds: number } | null;
}

function RoleBadge({ role }: { role: Role }) {
  const styles: Record<Role, { bg: string; text: string; border: string }> = {
    admin:    { bg: 'rgba(168,85,247,0.12)',  text: '#d8b4fe', border: 'rgba(168,85,247,0.35)' },
    gardener: { bg: 'rgba(16,185,129,0.12)',  text: '#6ee7b7', border: 'rgba(16,185,129,0.35)' },
    user:     { bg: 'rgba(100,116,139,0.15)', text: '#94a3b8', border: 'rgba(100,116,139,0.3)'  },
  };
  const icons: Record<Role, React.ReactNode> = {
    admin:    <ShieldCheck className="w-3 h-3" />,
    gardener: <Sprout      className="w-3 h-3" />,
    user:     <UserCircle2 className="w-3 h-3" />,
  };
  const s = styles[role];
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border"
      style={{ background: s.bg, color: s.text, borderColor: s.border }}>
      {icons[role]} {role.charAt(0).toUpperCase() + role.slice(1)}
    </span>
  );
}

function RoleSelector({ uid, email, currentRole, onChanged, disabled }: {
  uid: string; email: string; currentRole: Role; onChanged: (uid: string, role: Role) => void; disabled?: boolean;
}) {
  const [open,   setOpen]   = useState(false);
  const [saving, setSaving] = useState(false);

  const isMainAdmin = email === 'griffonb130@gmail.com';
  if (isMainAdmin) {
    return <span className="text-xs font-medium" style={{ color: '#64748b' }}>Protected</span>;
  }

  const select = async (role: Role) => {
    setOpen(false);
    if (role === currentRole) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', uid), { role });
      onChanged(uid, role);
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  return (
    <div className="relative">
      <button onClick={() => setOpen(v => !v)} disabled={disabled || saving}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
        style={{ background: 'rgba(30,41,59,0.6)', border: '1px solid rgba(71,85,105,0.5)', color: '#94a3b8' }}>
        {saving && <Loader2 className="w-3 h-3 animate-spin" />}
        Change Role <ChevronDown className="w-3 h-3" />
      </button>
      {open && (
        <div className="absolute right-0 mt-1.5 z-20 rounded-2xl overflow-hidden shadow-2xl"
          style={{ background: '#0f1824', border: '1px solid rgba(71,85,105,0.5)', minWidth: 150 }}>
          {(['user', 'gardener', 'admin'] as Role[]).map(r => (
            <button key={r} onClick={() => select(r)}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-left transition-colors hover:bg-slate-700/50"
              style={{ color: r === currentRole ? '#6ee7b7' : r === 'admin' ? '#d8b4fe' : '#cbd5e1' }}>
              {r === 'gardener' ? <Sprout className="w-3.5 h-3.5" /> : r === 'admin' ? <ShieldCheck className="w-3.5 h-3.5" /> : <UserCircle2 className="w-3.5 h-3.5" />}
              {r.charAt(0).toUpperCase() + r.slice(1)}
              {r === currentRole && <span className="ml-auto text-emerald-400">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon, accent }: {
  label: string; value: number; icon: React.ReactNode; accent: string;
}) {
  return (
    <div className="card rounded-2xl p-4 flex items-center gap-3 hover:-translate-y-0.5 transition-all"
      style={{ borderLeft: `3px solid ${accent}` }}>
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: `${accent}18`, border: `1px solid ${accent}30` }}>
        {icon}
      </div>
      <div>
        <p className="stat-number text-2xl font-bold text-slate-100 leading-none">{value}</p>
        <p className="text-xs text-slate-400 mt-0.5">{label}</p>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const { role, loading: roleLoading } = useRole();

  const [users,    setUsers]    = useState<UserRecord[]>([]);
  const [fetching, setFetching] = useState(true);
  const [search,   setSearch]   = useState('');
  const [filter,   setFilter]   = useState<'all' | Role>('all');

  useEffect(() => {
    if (!roleLoading && role !== 'admin') router.replace('/dashboard');
  }, [role, roleLoading, router]);

  const fetchUsers = async () => {
    setFetching(true);
    try {
      const snap = await getDocs(query(collection(db, 'users'), orderBy('createdAt', 'desc')));
      setUsers(snap.docs.map(d => ({
        uid:         d.id,
        email:       d.data().email       ?? '',
        displayName: d.data().displayName ?? '',
        role:        d.data().role        ?? 'user',
        createdAt:   d.data().createdAt   ?? null,
      })));
    } catch (e) { console.error(e); }
    finally { setFetching(false); }
  };

  useEffect(() => { if (role === 'admin') fetchUsers(); }, [role]);

  const handleRoleChange = (uid: string, newRole: Role) =>
    setUsers(prev => prev.map(u => u.uid === uid ? { ...u, role: newRole } : u));

  const displayed = users.filter(u => {
    const q = search.toLowerCase();
    const matchSearch = !search || u.email.toLowerCase().includes(q) || u.displayName.toLowerCase().includes(q);
    return matchSearch && (filter === 'all' || u.role === filter);
  });

  const counts = {
    total:    users.length,
    admin:    users.filter(u => u.role === 'admin').length,
    gardener: users.filter(u => u.role === 'gardener').length,
    user:     users.filter(u => u.role === 'user').length,
  };

  if (roleLoading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0f1824' }}>
      <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen text-slate-100" style={{ background: '#0f1824', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&family=Space+Grotesk:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: #1e293b; }
        ::-webkit-scrollbar-thumb { background: #334155; border-radius: 2px; }
        .card { background: rgba(30,41,59,0.6); border: 1px solid rgba(71,85,105,0.35); backdrop-filter: blur(12px); }
        .stat-number { font-family: 'Space Grotesk', monospace; }
        .section-title { font-family: 'Space Grotesk', sans-serif; }
      `}</style>

      {/* Ambient blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(168,85,247,0.04) 0%, transparent 70%)' }} />
        <div className="absolute top-1/2 -left-40 w-[400px] h-[400px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.03) 0%, transparent 70%)' }} />
        <div className="absolute -bottom-40 right-1/3 w-[500px] h-[500px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.02) 0%, transparent 70%)' }} />
      </div>

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
            <span className="text-purple-400 font-medium">Admin Panel</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border bg-purple-500/10 border-purple-500/30 text-purple-400">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-purple-400" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-400" />
            </span>
            <span className="hidden sm:inline">Admin</span>
          </div>

          <button onClick={() => router.push('/dashboard')}
            className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
            style={{ background: 'rgba(30,41,59,0.6)', border: '1px solid rgba(71,85,105,0.4)', color: '#94a3b8' }}>
            ← Dashboard
          </button>

          <button onClick={async () => { await signOut(auth); router.replace('/login'); }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
            style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#fca5a5' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.15)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.08)'; }}>
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </header>

      {/* ── Main ── */}
      <div className="relative z-10 p-4 md:p-6 max-w-[1200px] mx-auto space-y-5">

        {/* Page title */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-purple-500/15 text-purple-400 border border-purple-500/25">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
              ADMIN PANEL
            </span>
          </div>
          <h1 className="section-title text-3xl md:text-4xl font-bold text-slate-100" style={{ letterSpacing: '-0.02em' }}>
            User Management
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Promote users to <span className="text-emerald-400 font-semibold">Gardener</span> to grant farm access
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard label="Total Users"   value={counts.total}    accent="#10b981" icon={<Users       className="w-5 h-5" style={{ color: '#10b981' }} />} />
          <StatCard label="Admins"        value={counts.admin}    accent="#a855f7" icon={<ShieldCheck className="w-5 h-5" style={{ color: '#a855f7' }} />} />
          <StatCard label="Gardeners"     value={counts.gardener} accent="#06b6d4" icon={<Sprout      className="w-5 h-5" style={{ color: '#06b6d4' }} />} />
          <StatCard label="Pending Users" value={counts.user}     accent="#f59e0b" icon={<UserCircle2 className="w-5 h-5" style={{ color: '#f59e0b' }} />} />
        </div>

        {/* ── Users Table Card ── */}
        <div className="card rounded-2xl overflow-hidden">
          {/* Card header */}
          <div className="px-5 py-4 border-b flex items-center gap-3"
            style={{ borderColor: 'rgba(71,85,105,0.3)', background: 'rgba(168,85,247,0.05)', borderLeft: '3px solid #a855f7' }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.3)' }}>
              <Users className="w-4 h-4 text-purple-400" />
            </div>
            <div className="flex-1">
              <h3 className="section-title font-semibold text-sm text-slate-100">All Users</h3>
              <p className="text-xs text-slate-400 mt-0.5">Manage roles for registered accounts</p>
            </div>
          </div>

          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center px-5 py-3 border-b"
            style={{ borderColor: 'rgba(71,85,105,0.2)', background: 'rgba(15,24,36,0.3)' }}>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
              <input type="text" placeholder="Search by name or email…" value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full py-2 pl-9 pr-4 rounded-xl text-xs outline-none transition-all"
                style={{ background: 'rgba(15,24,36,0.8)', border: '1px solid rgba(71,85,105,0.5)', color: '#f1f5f9' }}
                onFocus={e => { e.currentTarget.style.borderColor = 'rgba(168,85,247,0.5)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(168,85,247,0.08)'; }}
                onBlur={e => { e.currentTarget.style.borderColor = 'rgba(71,85,105,0.5)'; e.currentTarget.style.boxShadow = 'none'; }} />
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {(['all', 'user', 'gardener', 'admin'] as const).map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition-all"
                  style={{
                    background: filter === f ? '#10b981' : 'rgba(30,41,59,0.6)',
                    border: `1px solid ${filter === f ? '#10b981' : 'rgba(71,85,105,0.4)'}`,
                    color: filter === f ? '#051c12' : '#64748b',
                  }}>
                  {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
            <button onClick={fetchUsers}
              className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-emerald-400 ml-auto transition-colors">
              <RefreshCw className={`w-3.5 h-3.5 ${fetching ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>

          {/* Table */}
          {fetching ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
            </div>
          ) : displayed.length === 0 ? (
            <div className="py-20 text-center text-slate-500 text-sm">No users found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(71,85,105,0.25)' }}>
                    {['User', 'Email', 'Role', 'Joined', 'Action'].map(h => (
                      <th key={h} className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider"
                        style={{ color: '#64748b' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayed.map((u, i) => (
                    <tr key={u.uid} className="transition-colors"
                      style={{ borderBottom: i < displayed.length - 1 ? '1px solid rgba(71,85,105,0.15)' : undefined }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(30,41,59,0.4)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                            style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.2), rgba(6,182,212,0.2))', border: '1px solid rgba(16,185,129,0.25)' }}>
                            <span className="text-xs font-bold text-emerald-400">
                              {(u.displayName || u.email || '?')[0].toUpperCase()}
                            </span>
                          </div>
                          <span className="font-semibold text-slate-200">{u.displayName || '—'}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-slate-400 text-xs">{u.email}</td>
                      <td className="px-5 py-3.5"><RoleBadge role={u.role} /></td>
                      <td className="px-5 py-3.5">
                        <span className="text-xs text-slate-500">
                          {u.createdAt?.seconds
                            ? new Date(u.createdAt.seconds * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                            : '—'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <RoleSelector uid={u.uid} email={u.email} currentRole={u.role} onChanged={handleRoleChange} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="px-5 py-3 border-t flex justify-between text-xs"
            style={{ borderColor: 'rgba(71,85,105,0.25)', color: '#475569', background: 'rgba(15,24,36,0.2)' }}>
            <span>Showing {displayed.length} of {users.length} users</span>
            <span>Role changes take effect immediately</span>
          </div>
        </div>

        {/* ── Role Permissions Guide ── */}
        <div className="card rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b flex items-center gap-3"
            style={{ borderColor: 'rgba(71,85,105,0.3)', background: 'rgba(16,185,129,0.05)', borderLeft: '3px solid #10b981' }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)' }}>
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h3 className="section-title font-semibold text-sm text-slate-100">Role Permissions</h3>
              <p className="text-xs text-slate-400 mt-0.5">Access levels for each account type</p>
            </div>
          </div>
          <div className="p-5 grid sm:grid-cols-3 gap-4">
            {[
              { role: 'user'     as Role, desc: 'Default role. Can view public info only. Cannot access live sensor data or controls.' },
              { role: 'gardener' as Role, desc: 'Can view the dashboard, live sensors, AI agronomist, and irrigation scheduling.' },
              { role: 'admin'    as Role, desc: 'Full access including this admin panel. Can change roles for any other user.' },
            ].map(r => (
              <div key={r.role} className="p-4 rounded-xl"
                style={{ background: 'rgba(15,24,36,0.5)', border: '1px solid rgba(71,85,105,0.25)' }}>
                <RoleBadge role={r.role} />
                <p className="text-xs text-slate-400 leading-relaxed mt-2">{r.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between text-xs py-2 pb-8 text-slate-600">
          <span>Role changes apply immediately across all sessions.</span>
          <span>SmartFarm v1.0 · Kenya</span>
        </div>

      </div>
    </div>
  );
}