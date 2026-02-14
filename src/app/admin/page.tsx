'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { collection, getDocs, doc, updateDoc, query, orderBy } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { db, auth } from '@/lib/firebase';
import { useRole } from '@/hooks/useRole';
import {
  Leaf, Users, ShieldCheck, Sprout, UserCircle2,
  LogOut, Loader2, RefreshCw, Search, ChevronDown,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
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
  const styles: Record<Role, string> = {
    admin:    'bg-purple-500/15 text-purple-300 border-purple-500/30',
    gardener: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    user:     'bg-slate-500/15   text-slate-400   border-slate-500/30',
  };
  const icons: Record<Role, React.ReactNode> = {
    admin:    <ShieldCheck className="w-3 h-3" />,
    gardener: <Sprout      className="w-3 h-3" />,
    user:     <UserCircle2 className="w-3 h-3" />,
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${styles[role]}`}>
      {icons[role]} {role.charAt(0).toUpperCase() + role.slice(1)}
    </span>
  );
}

// ─── Role selector dropdown ───────────────────────────────────────────────────
function RoleSelector({
  uid, currentRole, onChanged, disabled,
}: {
  uid: string; currentRole: Role; onChanged: (uid: string, role: Role) => void; disabled?: boolean;
}) {
  const [open,    setOpen]    = useState(false);
  const [saving,  setSaving]  = useState(false);

  // Admins cannot be re-assigned from this UI
  if (currentRole === 'admin') {
    return <span className="text-xs text-slate-600 italic">Protected</span>;
  }

  const options: Role[] = ['user', 'gardener'];

  const select = async (role: Role) => {
    setOpen(false);
    if (role === currentRole) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', uid), { role });
      onChanged(uid, role);
    } catch (e) {
      console.error('Failed to update role:', e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        disabled={disabled || saving}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
        style={{ background: 'rgba(30,41,59,0.8)', border: '1px solid rgba(71,85,105,0.5)', color: '#94a3b8' }}
      >
        {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
        Change Role
        <ChevronDown className="w-3 h-3" />
      </button>

      {open && (
        <div
          className="absolute right-0 mt-1 z-20 rounded-xl overflow-hidden shadow-2xl"
          style={{ background: '#0f172a', border: '1px solid rgba(71,85,105,0.5)', minWidth: 140 }}
        >
          {options.map(r => (
            <button
              key={r}
              onClick={() => select(r)}
              className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-left transition-colors hover:bg-slate-800 ${r === currentRole ? 'text-emerald-400' : 'text-slate-300'}`}
            >
              {r === 'gardener' ? <Sprout className="w-3.5 h-3.5" /> : <UserCircle2 className="w-3.5 h-3.5" />}
              {r.charAt(0).toUpperCase() + r.slice(1)}
              {r === currentRole && <span className="ml-auto text-emerald-500">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Admin Page ──────────────────────────────────────────────────────────
export default function AdminPage() {
  const router             = useRouter();
  const { role, loading: roleLoading } = useRole();

  const [users,     setUsers]     = useState<UserRecord[]>([]);
  const [fetching,  setFetching]  = useState(true);
  const [search,    setSearch]    = useState('');
  const [filter,    setFilter]    = useState<'all' | Role>('all');

  // Guard: only admins may view this page
  useEffect(() => {
    if (!roleLoading && role !== 'admin') {
      router.replace('/dashboard');
    }
  }, [role, roleLoading, router]);

  const fetchUsers = async () => {
    setFetching(true);
    try {
      const q    = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      const list: UserRecord[] = snap.docs.map(d => ({
        uid:         d.id,
        email:       d.data().email       ?? '',
        displayName: d.data().displayName ?? '',
        role:        d.data().role        ?? 'user',
        createdAt:   d.data().createdAt   ?? null,
      }));
      setUsers(list);
    } catch (e) {
      console.error('Failed to fetch users:', e);
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    if (role === 'admin') fetchUsers();
  }, [role]);

  const handleRoleChange = (uid: string, newRole: Role) => {
    setUsers(prev => prev.map(u => u.uid === uid ? { ...u, role: newRole } : u));
  };

  const handleSignOut = async () => {
    await signOut(auth);
    router.replace('/login');
  };

  // Filtered list
  const displayed = users.filter(u => {
    const matchesSearch = !search || u.email.toLowerCase().includes(search.toLowerCase()) || u.displayName.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === 'all' || u.role === filter;
    return matchesSearch && matchesFilter;
  });

  const counts = {
    total:    users.length,
    admin:    users.filter(u => u.role === 'admin').length,
    gardener: users.filter(u => u.role === 'gardener').length,
    user:     users.filter(u => u.role === 'user').length,
  };

  if (roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#060910' }}>
        <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#060910', fontFamily: "'Sora', 'DM Sans', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=DM+Sans:wght@400;500;600&display=swap');
        .card { background: rgba(15,23,42,0.8); border: 1px solid rgba(51,65,85,0.5); border-radius: 16px; }
        .stat-card { background: rgba(15,23,42,0.6); border: 1px solid rgba(51,65,85,0.4); border-radius: 12px; padding: 16px 20px; }
        .row-hover:hover { background: rgba(30,41,59,0.4); }
        .search-input { background: rgba(30,41,59,0.6); border: 1px solid rgba(71,85,105,0.5); border-radius: 10px; padding: 9px 14px 9px 38px; color: #f1f5f9; font-size: 13px; font-family: inherit; outline: none; width: 100%; transition: border-color .2s; }
        .search-input:focus { border-color: rgba(16,185,129,.5); }
        .filter-btn { padding: 7px 14px; border-radius: 8px; font-size: 12px; font-weight: 600; border: 1px solid rgba(51,65,85,0.5); cursor: pointer; transition: all .2s; font-family: inherit; }
        .filter-btn.active { background: #10b981; color: #060910; border-color: #10b981; }
        .filter-btn.inactive { background: transparent; color: #64748b; }
        .filter-btn.inactive:hover { color: #94a3b8; border-color: rgba(71,85,105,.7); }
        .grid-bg { background-image: linear-gradient(rgba(16,185,129,.025) 1px, transparent 1px), linear-gradient(90deg, rgba(16,185,129,.025) 1px, transparent 1px); background-size: 52px 52px; }
      `}</style>

      {/* ── Top nav ────────────────────────────────────────────── */}
      <nav className="border-b grid-bg" style={{ borderColor: 'rgba(51,65,85,0.4)' }}>
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
              <Leaf className="w-4 h-4 text-emerald-400" />
            </div>
            <span className="font-bold text-lg tracking-tight text-slate-100">smart<span className="text-emerald-400">farm</span></span>
            <span className="hidden sm:inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/15 text-purple-300 border border-purple-500/30 ml-1">Admin Panel</span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/dashboard')} className="text-xs text-slate-500 hover:text-slate-300 transition-colors" style={{ fontFamily: 'DM Sans, sans-serif' }}>
              ← Dashboard
            </button>
            <button onClick={handleSignOut} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-red-400 transition-colors" style={{ fontFamily: 'DM Sans, sans-serif' }}>
              <LogOut className="w-3.5 h-3.5" /> Sign out
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-10">

        {/* ── Header ─────────────────────────────────────────── */}
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold text-slate-100 mb-1" style={{ letterSpacing: '-0.02em' }}>User Management</h1>
          <p className="text-slate-500 text-sm" style={{ fontFamily: 'DM Sans, sans-serif' }}>
            Manage roles for all registered users. Promote users to <strong className="text-emerald-400">Gardener</strong> to grant farm access.
          </p>
        </div>

        {/* ── Stats strip ────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Users',  value: counts.total,    icon: <Users      className="w-4 h-4 text-slate-400"   /> },
            { label: 'Admins',       value: counts.admin,    icon: <ShieldCheck className="w-4 h-4 text-purple-400" /> },
            { label: 'Gardeners',    value: counts.gardener, icon: <Sprout     className="w-4 h-4 text-emerald-400"  /> },
            { label: 'Pending Users',value: counts.user,     icon: <UserCircle2 className="w-4 h-4 text-slate-400"  /> },
          ].map(s => (
            <div key={s.label} className="stat-card flex items-center gap-3">
              {s.icon}
              <div>
                <p className="text-xl font-extrabold text-slate-100">{s.value}</p>
                <p className="text-xs text-slate-500" style={{ fontFamily: 'DM Sans, sans-serif' }}>{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Table card ─────────────────────────────────────── */}
        <div className="card overflow-hidden">
          {/* Toolbar */}
          <div className="p-5 border-b flex flex-col sm:flex-row gap-3 items-start sm:items-center" style={{ borderColor: 'rgba(51,65,85,0.4)' }}>
            {/* Search */}
            <div className="relative flex-1 w-full sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
              <input
                type="text"
                className="search-input"
                placeholder="Search by name or email…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            {/* Filters */}
            <div className="flex gap-2 flex-wrap">
              {(['all', 'user', 'gardener', 'admin'] as const).map(f => (
                <button key={f} className={`filter-btn ${filter === f ? 'active' : 'inactive'}`} onClick={() => setFilter(f)}>
                  {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>

            {/* Refresh */}
            <button onClick={fetchUsers} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors ml-auto" style={{ fontFamily: 'DM Sans, sans-serif' }}>
              <RefreshCw className={`w-3.5 h-3.5 ${fetching ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {/* Table */}
          {fetching ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
            </div>
          ) : displayed.length === 0 ? (
            <div className="py-20 text-center text-slate-600 text-sm" style={{ fontFamily: 'DM Sans, sans-serif' }}>
              No users found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(51,65,85,0.4)' }}>
                    {['User', 'Email', 'Role', 'Joined', 'Action'].map(h => (
                      <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayed.map((u, i) => (
                    <tr key={u.uid} className="row-hover transition-colors" style={{ borderBottom: i < displayed.length - 1 ? '1px solid rgba(51,65,85,0.25)' : undefined }}>
                      {/* Name */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                            style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.2)' }}>
                            <span className="text-xs font-bold text-emerald-400">
                              {(u.displayName || u.email || '?')[0].toUpperCase()}
                            </span>
                          </div>
                          <span className="text-sm font-semibold text-slate-200">{u.displayName || '—'}</span>
                        </div>
                      </td>

                      {/* Email */}
                      <td className="px-5 py-4">
                        <span className="text-sm text-slate-400" style={{ fontFamily: 'DM Sans, sans-serif' }}>{u.email}</span>
                      </td>

                      {/* Role badge */}
                      <td className="px-5 py-4"><RoleBadge role={u.role} /></td>

                      {/* Joined */}
                      <td className="px-5 py-4">
                        <span className="text-xs text-slate-600" style={{ fontFamily: 'DM Sans, sans-serif' }}>
                          {u.createdAt?.seconds
                            ? new Date(u.createdAt.seconds * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                            : '—'}
                        </span>
                      </td>

                      {/* Action */}
                      <td className="px-5 py-4">
                        <RoleSelector uid={u.uid} currentRole={u.role} onChanged={handleRoleChange} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Footer */}
          <div className="px-5 py-3 border-t text-xs text-slate-600 flex justify-between" style={{ borderColor: 'rgba(51,65,85,0.4)', fontFamily: 'DM Sans, sans-serif' }}>
            <span>Showing {displayed.length} of {users.length} users</span>
            <span>Role changes take effect immediately</span>
          </div>
        </div>

        {/* ── Role guide ─────────────────────────────────────── */}
        <div className="mt-6 card p-5">
          <h3 className="text-sm font-bold text-slate-300 mb-3">Role Permissions</h3>
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              { role: 'user'     as Role, desc: 'Default role. Can view public info only. Cannot access live sensor data or controls.' },
              { role: 'gardener' as Role, desc: 'Can view the dashboard, live sensors, AI agronomist, and irrigation scheduling.' },
              { role: 'admin'    as Role, desc: 'Full access including this admin panel. Can change roles for any other user.' },
            ].map(r => (
              <div key={r.role} className="p-4 rounded-xl" style={{ background: 'rgba(30,41,59,0.4)', border: '1px solid rgba(51,65,85,0.4)' }}>
                <div className="mb-2"><RoleBadge role={r.role} /></div>
                <p className="text-xs text-slate-500 leading-relaxed" style={{ fontFamily: 'DM Sans, sans-serif' }}>{r.desc}</p>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}