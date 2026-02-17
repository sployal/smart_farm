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

// ─── Role badge ───────────────────────────────────────────────────────────────
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
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border"
      style={{ background: s.bg, color: s.text, borderColor: s.border }}
    >
      {icons[role]} {role.charAt(0).toUpperCase() + role.slice(1)}
    </span>
  );
}

// ─── Role selector dropdown ───────────────────────────────────────────────────
function RoleSelector({ uid, currentRole, onChanged, disabled }: {
  uid: string; currentRole: Role; onChanged: (uid: string, role: Role) => void; disabled?: boolean;
}) {
  const [open,   setOpen]   = useState(false);
  const [saving, setSaving] = useState(false);

  if (currentRole === 'admin') {
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
      <button
        onClick={() => setOpen(v => !v)}
        disabled={disabled || saving}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
        style={{ background: 'rgba(30,41,59,0.6)', border: '1px solid rgba(71,85,105,0.5)', color: '#94a3b8' }}
      >
        {saving && <Loader2 className="w-3 h-3 animate-spin" />}
        Change Role <ChevronDown className="w-3 h-3" />
      </button>
      {open && (
        <div className="absolute right-0 mt-1.5 z-20 rounded-2xl overflow-hidden shadow-2xl"
          style={{ background: '#1e293b', border: '1px solid rgba(71,85,105,0.5)', minWidth: 150 }}>
          {(['user', 'gardener'] as Role[]).map(r => (
            <button key={r} onClick={() => select(r)}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-left transition-colors hover:bg-slate-700/50"
              style={{ color: r === currentRole ? '#6ee7b7' : '#cbd5e1' }}>
              {r === 'gardener' ? <Sprout className="w-3.5 h-3.5" /> : <UserCircle2 className="w-3.5 h-3.5" />}
              {r.charAt(0).toUpperCase() + r.slice(1)}
              {r === currentRole && <span className="ml-auto text-emerald-400">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, icon, accent }: {
  label: string; value: number; icon: React.ReactNode; accent: string;
}) {
  return (
    <div className="rounded-2xl border backdrop-blur-sm p-4 flex items-center gap-3"
      style={{
        background: 'rgba(30,41,59,0.6)', borderColor: 'rgba(71,85,105,0.4)',
        borderLeftWidth: 3, borderLeftStyle: 'solid', borderLeftColor: accent,
      }}>
      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: `${accent}18`, border: `1px solid ${accent}30` }}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-black text-slate-100 leading-none">{value}</p>
        <p className="text-xs text-slate-400 mt-0.5 font-medium">{label}</p>
      </div>
    </div>
  );
}

// ─── Main Admin Page ──────────────────────────────────────────────────────────
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
        uid: d.id,
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
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#1a2332' }}>
      <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen font-sans" style={{ background: '#1a2332', color: '#f1f5f9' }}>

      {/* Ambient blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-0 right-0 w-96 h-96 rounded-full blur-3xl"
          style={{ background: 'rgba(168,85,247,0.02)' }} />
        <div className="absolute bottom-0 left-0 w-80 h-80 rounded-full blur-3xl"
          style={{ background: 'rgba(16,185,129,0.015)' }} />
      </div>

      <div className="relative z-10 max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-4 sm:py-6 border-b -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8"
          style={{ borderColor: 'rgba(100,116,139,0.3)', background: 'rgba(30,41,59,0.3)' }}>
          <div className="flex items-center gap-2 min-w-0">
            <button type="button" onClick={() => router.back()}
              className="md:hidden p-1.5 -ml-1 flex-shrink-0 text-slate-400">
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm mb-1 text-slate-400">
                <Leaf className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                <span>Farm Dashboard</span>
                <ChevronRight className="w-3 h-3 flex-shrink-0" />
                <span className="text-purple-400">Admin Panel</span>
              </div>
              <h1 className="text-3xl font-black tracking-tight text-slate-100" style={{ letterSpacing: '-0.02em' }}>
                User Management
              </h1>
              <p className="text-sm mt-1 text-slate-400">
                Promote users to <span className="text-emerald-400 font-semibold">Gardener</span> to grant farm access
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={() => router.push('/dashboard')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
              style={{ background: 'rgba(30,41,59,0.6)', border: '1px solid rgba(71,85,105,0.5)', color: '#94a3b8' }}>
              ← Dashboard
            </button>
            <button onClick={async () => { await signOut(auth); router.replace('/login'); }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors hover:text-red-300"
              style={{ background: 'rgba(30,41,59,0.6)', border: '1px solid rgba(71,85,105,0.5)', color: '#94a3b8' }}>
              <LogOut className="w-4 h-4" /> Sign out
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard label="Total Users"   value={counts.total}    accent="#10b981" icon={<Users       className="w-4 h-4" style={{ color: '#10b981' }} />} />
          <StatCard label="Admins"        value={counts.admin}    accent="#a855f7" icon={<ShieldCheck className="w-4 h-4" style={{ color: '#a855f7' }} />} />
          <StatCard label="Gardeners"     value={counts.gardener} accent="#10b981" icon={<Sprout      className="w-4 h-4" style={{ color: '#10b981' }} />} />
          <StatCard label="Pending Users" value={counts.user}     accent="#f59e0b" icon={<UserCircle2 className="w-4 h-4" style={{ color: '#f59e0b' }} />} />
        </div>

        {/* Table card */}
        <div className="rounded-2xl border backdrop-blur-sm overflow-hidden"
          style={{ background: 'rgba(30,41,59,0.6)', borderColor: 'rgba(71,85,105,0.4)', borderLeftWidth: 3, borderLeftStyle: 'solid', borderLeftColor: '#a855f7' }}>

          {/* Card header */}
          <div className="flex items-center gap-3 px-5 py-4 border-b" style={{ borderColor: 'rgba(71,85,105,0.3)' }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.3)' }}>
              <Users className="w-4 h-4" style={{ color: '#a855f7' }} />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-100">All Users</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Manage roles for registered accounts</p>
            </div>
          </div>

          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center px-5 py-3 border-b"
            style={{ borderColor: 'rgba(71,85,105,0.2)', background: 'rgba(15,23,42,0.2)' }}>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
              <input type="text" placeholder="Search by name or email…" value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full py-2 pl-9 pr-4 rounded-xl text-xs outline-none"
                style={{ background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(71,85,105,0.5)', color: '#f1f5f9' }} />
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
              className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-300 ml-auto transition-colors">
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
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(71,85,105,0.3)' }}>
                    {['User', 'Email', 'Role', 'Joined', 'Action'].map(h => (
                      <th key={h} className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider"
                        style={{ color: '#64748b' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayed.map((u, i) => (
                    <tr key={u.uid} className="transition-colors"
                      style={{ borderBottom: i < displayed.length - 1 ? '1px solid rgba(71,85,105,0.2)' : undefined }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(30,41,59,0.4)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                            style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)' }}>
                            <span className="text-xs font-bold text-emerald-400">
                              {(u.displayName || u.email || '?')[0].toUpperCase()}
                            </span>
                          </div>
                          <span className="text-sm font-semibold text-slate-200">{u.displayName || '—'}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4"><span className="text-sm text-slate-400">{u.email}</span></td>
                      <td className="px-5 py-4"><RoleBadge role={u.role} /></td>
                      <td className="px-5 py-4">
                        <span className="text-xs text-slate-500">
                          {u.createdAt?.seconds
                            ? new Date(u.createdAt.seconds * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                            : '—'}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <RoleSelector uid={u.uid} currentRole={u.role} onChanged={handleRoleChange} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="px-5 py-3 border-t flex justify-between text-xs"
            style={{ borderColor: 'rgba(71,85,105,0.3)', color: '#475569' }}>
            <span>Showing {displayed.length} of {users.length} users</span>
            <span>Role changes take effect immediately</span>
          </div>
        </div>

        {/* Role guide */}
        <div className="rounded-2xl border backdrop-blur-sm overflow-hidden"
          style={{ background: 'rgba(30,41,59,0.6)', borderColor: 'rgba(71,85,105,0.4)', borderLeftWidth: 3, borderLeftStyle: 'solid', borderLeftColor: '#10b981' }}>
          <div className="flex items-center gap-3 px-5 py-4 border-b" style={{ borderColor: 'rgba(71,85,105,0.3)' }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)' }}>
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-100">Role Permissions</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Access levels for each account type</p>
            </div>
          </div>
          <div className="p-5 grid sm:grid-cols-3 gap-4">
            {[
              { role: 'user'     as Role, desc: 'Default role. Can view public info only. Cannot access live sensor data or controls.' },
              { role: 'gardener' as Role, desc: 'Can view the dashboard, live sensors, AI agronomist, and irrigation scheduling.' },
              { role: 'admin'    as Role, desc: 'Full access including this admin panel. Can change roles for any other user.' },
            ].map(r => (
              <div key={r.role} className="p-4 rounded-xl"
                style={{ background: 'rgba(15,23,42,0.4)', border: '1px solid rgba(71,85,105,0.3)' }}>
                <RoleBadge role={r.role} />
                <p className="text-xs text-slate-400 leading-relaxed mt-2">{r.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between text-xs py-2 text-slate-500">
          <span>Role changes apply immediately across all sessions.</span>
          <span>SmartFarm v1.0 · Kenya</span>
        </div>

      </div>
    </div>
  );
}