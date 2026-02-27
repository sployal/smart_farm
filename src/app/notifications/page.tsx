'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bell, BellOff, CheckCheck, Trash2, Filter, AlertTriangle,
  Droplets, Thermometer, Waves, Bot, Wifi, WifiOff, FlaskConical,
  Sprout, Settings, ChevronDown, X, Circle, Check, Info, Zap,
  Clock, CalendarDays, ArrowLeft, ChevronRight, Leaf, Menu,
} from 'lucide-react';
import clsx, { type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatDistanceToNow, subMinutes, subHours, subDays } from 'date-fns';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ─── Types ────────────────────────────────────────────────────────────────────
type NotifCategory = 'all' | 'alerts' | 'ai' | 'sensors' | 'system';
type NotifPriority = 'critical' | 'high' | 'medium' | 'low' | 'info';

interface Notification {
  id: string; title: string; description: string;
  category: Exclude<NotifCategory, 'all'>; priority: NotifPriority;
  timestamp: Date; read: boolean; icon: React.ElementType;
  iconKey: string; actionLabel?: string; meta?: string;
}

// ─── Data ─────────────────────────────────────────────────────────────────────
const now = new Date();

const INITIAL_NOTIFICATIONS: Notification[] = [
  {
    id: '1', title: 'Critical: Soil Moisture Critically Low', category: 'alerts', priority: 'critical',
    description: 'Plot A soil moisture has dropped to 14% — below the critical threshold of 20%. Immediate irrigation required to prevent crop stress.',
    timestamp: subMinutes(now, 4), read: false, icon: Droplets, iconKey: 'Droplets', actionLabel: 'Trigger Irrigation', meta: 'Plot A · Node-01',
  },
  {
    id: '2', title: 'Nitrogen Deficiency Detected', category: 'alerts', priority: 'high',
    description: 'Nitrogen levels at 45 mg/kg are below the optimal range (80–120 mg/kg) for tomato growth. Apply NPK fertilizer within 48 hours.',
    timestamp: subMinutes(now, 18), read: false, icon: FlaskConical, iconKey: 'FlaskConical', actionLabel: 'View Recommendations', meta: 'Plot A · Soil Sensor',
  },
  {
    id: '3', title: 'Gemini AI Generated 5 New Insights', category: 'ai', priority: 'medium',
    description: 'Based on the last 72 hours of sensor data, Gemini has produced 5 actionable insights including yield forecasts and irrigation optimizations.',
    timestamp: subMinutes(now, 35), read: false, icon: Bot, iconKey: 'Bot', actionLabel: 'View Insights', meta: 'AI Engine · Gemini 2.0',
  },
  {
    id: '4', title: 'Temperature Spike Detected', category: 'sensors', priority: 'high',
    description: 'Temperature sensor recorded 34.2°C — 6.2°C above the daily average. This may accelerate evaporation and stress heat-sensitive crops.',
    timestamp: subHours(now, 1), read: false, icon: Thermometer, iconKey: 'Thermometer', meta: 'Plot B · Node-03',
  },
  {
    id: '5', title: 'Humidity Returned to Normal Range', category: 'sensors', priority: 'low',
    description: 'Relative humidity has stabilised at 68% following the morning fog event. Conditions are now optimal for Roma VF Tomato.',
    timestamp: subHours(now, 2), read: true, icon: Waves, iconKey: 'Waves', meta: 'Plot A · Node-01',
  },
  {
    id: '6', title: 'ESP32 Node-02 Reconnected', category: 'system', priority: 'info',
    description: 'Sensor node ESP32-Node-02 came back online after a 23-minute connectivity gap. All buffered readings have been synced successfully.',
    timestamp: subHours(now, 3), read: true, icon: Wifi, iconKey: 'Wifi', meta: 'System · Connectivity',
  },
  {
    id: '7', title: 'Harvest Window Opening in 3 Days', category: 'ai', priority: 'medium',
    description: 'Predictive model indicates Roma VF Tomato in Plot A will reach harvest readiness in 3 days — 2 days ahead of the original schedule.',
    timestamp: subHours(now, 5), read: true, icon: Sprout, iconKey: 'Sprout', actionLabel: 'Plan Harvest', meta: 'AI Engine · Crop Model',
  },
  {
    id: '8', title: 'pH Levels Slightly Acidic', category: 'sensors', priority: 'medium',
    description: 'Soil pH is reading 5.9, slightly below the ideal range of 6.0–7.0 for tomatoes. Consider applying agricultural lime to raise pH.',
    timestamp: subHours(now, 7), read: true, icon: FlaskConical, iconKey: 'FlaskConical', meta: 'Plot C · Soil Sensor',
  },
  {
    id: '9', title: 'Scheduled Irrigation Completed', category: 'system', priority: 'info',
    description: 'Automated irrigation cycle for Plot A and Plot B completed successfully. Total water dispensed: 840 litres over 45 minutes.',
    timestamp: subDays(now, 1), read: true, icon: Droplets, iconKey: 'Droplets', meta: 'System · Irrigation',
  },
  {
    id: '10', title: 'ESP32 Node-02 Disconnected', category: 'system', priority: 'high',
    description: 'Sensor node ESP32-Node-02 lost connectivity. Data is being cached locally. Automatic reconnection attempts are in progress.',
    timestamp: subDays(now, 1), read: true, icon: WifiOff, iconKey: 'WifiOff', meta: 'System · Connectivity',
  },
  {
    id: '11', title: 'Potassium Levels Optimal', category: 'sensors', priority: 'info',
    description: "Potassium (K) levels have reached the optimal range of 180–220 mg/kg following last week's fertiliser application.",
    timestamp: subDays(now, 1), read: true, icon: Check, iconKey: 'Check', meta: 'Plot A · Soil Sensor',
  },
  {
    id: '12', title: 'Weekly AI Farm Report Ready', category: 'ai', priority: 'low',
    description: 'Your weekly AI-generated farm performance report is ready. Summary: crop health improved by 12%, water usage reduced by 8%.',
    timestamp: subDays(now, 1), read: true, icon: Bot, iconKey: 'Bot', actionLabel: 'Read Report', meta: 'AI Engine · Weekly Digest',
  },
  {
    id: '13', title: 'New Firmware Available for ESP32', category: 'system', priority: 'low',
    description: 'Firmware v2.4.1 is available for your ESP32 sensor nodes. This update includes improved power management and bug fixes.',
    timestamp: subDays(now, 3), read: true, icon: Settings, iconKey: 'Settings', actionLabel: 'Update Now', meta: 'System · Firmware',
  },
  {
    id: '14', title: 'Frost Warning — Temperature Dropping', category: 'alerts', priority: 'critical',
    description: 'Weather forecast indicates temperatures may drop to 2°C overnight. Frost protection measures are recommended for Plot C beans.',
    timestamp: subDays(now, 3), read: true, icon: Thermometer, iconKey: 'Thermometer', actionLabel: 'View Weather', meta: 'Weather · Forecast',
  },
  {
    id: '15', title: 'Plot B Crop Health Score Improved', category: 'ai', priority: 'info',
    description: 'Gemini AI has upgraded Plot B H614D Maize health score from B to B+ based on improved nitrogen and moisture readings.',
    timestamp: subDays(now, 5), read: true, icon: Zap, iconKey: 'Zap', meta: 'AI Engine · Health Monitor',
  },
];

// ─── Category Config ──────────────────────────────────────────────────────────
const CATEGORIES: { id: NotifCategory; label: string; icon: React.ElementType }[] = [
  { id: 'all',     label: 'All',         icon: Bell          },
  { id: 'alerts',  label: 'Alerts',      icon: AlertTriangle },
  { id: 'ai',      label: 'AI Insights', icon: Bot           },
  { id: 'sensors', label: 'Sensors',     icon: Droplets      },
  { id: 'system',  label: 'System',      icon: Settings      },
];

// ─── Priority Config ──────────────────────────────────────────────────────────
const PRIORITY_CONFIG: Record<NotifPriority, {
  label: string; dot: string; badge: string; accentColor: string;
}> = {
  critical: { label: 'Critical', dot: '#ef4444', badge: 'rgba(239,68,68,0.08)',   accentColor: '#ef4444' },
  high:     { label: 'High',     dot: '#f97316', badge: 'rgba(249,115,22,0.08)',  accentColor: '#f97316' },
  medium:   { label: 'Medium',   dot: '#f59e0b', badge: 'rgba(245,158,11,0.08)', accentColor: '#f59e0b' },
  low:      { label: 'Low',      dot: '#22d3ee', badge: 'rgba(34,211,238,0.08)', accentColor: '#22d3ee' },
  info:     { label: 'Info',     dot: '#64748b', badge: 'rgba(100,116,139,0.08)',accentColor: '#64748b' },
};

const PRIORITY_TEXT: Record<NotifPriority, string> = {
  critical: '#fca5a5', high: '#fdba74', medium: '#fcd34d', low: '#67e8f9', info: '#94a3b8',
};

const ICON_COLORS: Record<string, { color: string; bg: string }> = {
  Droplets:     { color: '#60a5fa', bg: 'rgba(96,165,250,0.1)'   },
  Thermometer:  { color: '#fbbf24', bg: 'rgba(251,191,36,0.1)'   },
  Waves:        { color: '#22d3ee', bg: 'rgba(34,211,238,0.1)'   },
  Bot:          { color: '#34d399', bg: 'rgba(52,211,153,0.1)'   },
  Wifi:         { color: '#4ade80', bg: 'rgba(74,222,128,0.1)'   },
  WifiOff:      { color: '#f87171', bg: 'rgba(248,113,113,0.1)'  },
  FlaskConical: { color: '#a78bfa', bg: 'rgba(167,139,250,0.1)'  },
  Sprout:       { color: '#34d399', bg: 'rgba(52,211,153,0.1)'   },
  Settings:     { color: '#94a3b8', bg: 'rgba(148,163,184,0.1)'  },
  Check:        { color: '#34d399', bg: 'rgba(52,211,153,0.1)'   },
  Zap:          { color: '#facc15', bg: 'rgba(250,204,21,0.1)'   },
};

// ─── Date Grouping ────────────────────────────────────────────────────────────
function getGroup(date: Date): string {
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 1) return 'Today';
  if (diffDays < 2) return 'Yesterday';
  if (diffDays < 7) return 'This Week';
  return 'Earlier';
}
const GROUP_ORDER = ['Today', 'Yesterday', 'This Week', 'Earlier'];

// ─── Notification Card ────────────────────────────────────────────────────────
function NotifCard({ notif, onRead, onDelete }: {
  notif: Notification; onRead: (id: string) => void; onDelete: (id: string) => void;
}) {
  const pCfg    = PRIORITY_CONFIG[notif.priority];
  const iconCfg = ICON_COLORS[notif.iconKey] ?? { color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' };
  const Icon    = notif.icon;

  return (
    <div
      className="group relative flex gap-4 p-4 sm:p-5 rounded-2xl transition-all duration-200 cursor-default"
      style={{
        background: notif.read ? 'rgba(30,41,59,0.5)' : 'rgba(30,41,59,0.7)',
        border: `1px solid ${notif.read ? 'rgba(71,85,105,0.3)' : 'rgba(71,85,105,0.5)'}`,
        borderLeft: `3px solid ${pCfg.accentColor}`,
        backdropFilter: 'blur(12px)',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.background = 'rgba(30,41,59,0.85)';
        (e.currentTarget as HTMLDivElement).style.boxShadow = `0 8px 32px rgba(0,0,0,0.3), 0 0 0 1px ${pCfg.accentColor}18`;
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.background = notif.read ? 'rgba(30,41,59,0.5)' : 'rgba(30,41,59,0.7)';
        (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
      }}
    >
      {/* Unread pulse dot */}
      {!notif.read && (
        <span className="absolute top-4 right-4 w-2 h-2 rounded-full flex-shrink-0"
          style={{ background: pCfg.dot, boxShadow: `0 0 8px ${pCfg.dot}` }} />
      )}

      {/* Icon */}
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ background: iconCfg.bg, border: `1px solid ${iconCfg.color}25` }}>
        <Icon className="w-5 h-5" style={{ color: iconCfg.color }} />
      </div>

      {/* Body */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-1.5">
          <span className="text-sm font-semibold leading-tight section-title"
            style={{ color: notif.read ? '#94a3b8' : '#f1f5f9' }}>
            {notif.title}
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border"
            style={{ background: pCfg.badge, color: PRIORITY_TEXT[notif.priority], borderColor: `${pCfg.accentColor}25` }}>
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: pCfg.dot }} />
            {pCfg.label}
          </span>
        </div>

        <p className="text-sm leading-relaxed mb-3"
          style={{ color: notif.read ? '#64748b' : '#94a3b8' }}>
          {notif.description}
        </p>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="flex items-center gap-1.5 text-xs" style={{ color: '#475569' }}>
              <Clock className="w-3 h-3" />
              {formatDistanceToNow(notif.timestamp, { addSuffix: true })}
            </span>
            {notif.meta && (
              <span className="text-xs px-2 py-0.5 rounded-lg stat-number"
                style={{ color: '#64748b', background: 'rgba(15,24,36,0.6)', border: '1px solid rgba(71,85,105,0.25)' }}>
                {notif.meta}
              </span>
            )}
          </div>
          {notif.actionLabel && (
            <button className="text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors section-title"
              style={{ color: '#10b981' }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.background = 'rgba(16,185,129,0.08)';
                (e.currentTarget as HTMLButtonElement).style.color = '#6ee7b7';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                (e.currentTarget as HTMLButtonElement).style.color = '#10b981';
              }}>
              {notif.actionLabel} →
            </button>
          )}
        </div>
      </div>

      {/* Hover actions */}
      <div className="absolute top-3 right-3 hidden group-hover:flex items-center gap-1 rounded-xl p-1 shadow-xl"
        style={{ background: 'rgba(15,24,36,0.95)', border: '1px solid rgba(71,85,105,0.4)', backdropFilter: 'blur(12px)' }}>
        {!notif.read && (
          <button onClick={() => onRead(notif.id)} title="Mark as read"
            className="p-1.5 rounded-lg transition-colors" style={{ color: '#64748b' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#10b981')}
            onMouseLeave={e => (e.currentTarget.style.color = '#64748b')}>
            <Check className="w-3.5 h-3.5" />
          </button>
        )}
        <button onClick={() => onDelete(notif.id)} title="Dismiss"
          className="p-1.5 rounded-lg transition-colors" style={{ color: '#64748b' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#f87171')}
          onMouseLeave={e => (e.currentTarget.style.color = '#64748b')}>
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function NotificationsPage() {
  const router = useRouter();
  const [notifications,      setNotifications]      = useState<Notification[]>(INITIAL_NOTIFICATIONS);
  const [activeCategory,     setActiveCategory]     = useState<NotifCategory>('all');
  const [showUnreadOnly,     setShowUnreadOnly]     = useState(false);
  const [filterOpen,         setFilterOpen]         = useState(false);
  const [selectedPriorities, setSelectedPriorities] = useState<Set<NotifPriority>>(new Set());

  const unreadCount = notifications.filter(n => !n.read).length;

  const categoryCounts = useMemo(() => {
    const counts: Record<NotifCategory, number> = { all: 0, alerts: 0, ai: 0, sensors: 0, system: 0 };
    notifications.forEach(n => { counts.all++; counts[n.category]++; });
    return counts;
  }, [notifications]);

  const grouped = useMemo(() => {
    const filtered = notifications.filter(n => {
      if (activeCategory !== 'all' && n.category !== activeCategory) return false;
      if (showUnreadOnly && n.read) return false;
      if (selectedPriorities.size > 0 && !selectedPriorities.has(n.priority)) return false;
      return true;
    });
    const groups: Record<string, Notification[]> = {};
    filtered.forEach(n => {
      const g = getGroup(n.timestamp);
      if (!groups[g]) groups[g] = [];
      groups[g].push(n);
    });
    return groups;
  }, [notifications, activeCategory, showUnreadOnly, selectedPriorities]);

  const totalFiltered = Object.values(grouped).flat().length;

  const markAllRead  = () => setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  const markRead     = (id: string) => setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  const deleteNotif  = (id: string) => setNotifications(prev => prev.filter(n => n.id !== id));
  const clearAll     = () => setNotifications(prev =>
    prev.filter(n => activeCategory !== 'all' && n.category !== activeCategory)
  );
  const togglePriority = (p: NotifPriority) => setSelectedPriorities(prev => {
    const next = new Set(prev);
    next.has(p) ? next.delete(p) : next.add(p);
    return next;
  });

  return (
    <div className="min-h-screen text-slate-100"
      style={{ background: '#0f1824', fontFamily: "'DM Sans', system-ui, sans-serif" }}>

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
          style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.04) 0%, transparent 70%)' }} />
        <div className="absolute top-1/2 -left-40 w-[400px] h-[400px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.03) 0%, transparent 70%)' }} />
        <div className="absolute -bottom-40 right-1/3 w-[500px] h-[500px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(168,85,247,0.02) 0%, transparent 70%)' }} />
      </div>

      {/* ── Sticky Header ── */}
      <header className="sticky top-0 z-40 border-b"
        style={{ background: 'rgba(15,24,36,0.85)', backdropFilter: 'blur(20px)', borderColor: 'rgba(71,85,105,0.3)' }}>

        {/* Top row */}
        <div className="flex items-center justify-between gap-4 px-4 md:px-6 h-16">
          <div className="flex items-center gap-3 min-w-0">
            <button type="button" onClick={() => document.dispatchEvent(new CustomEvent('toggleMobileMenu'))}
              className="lg:hidden p-2 rounded-lg hover:bg-slate-800 text-slate-400 transition-colors flex-shrink-0">
              <Menu className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              {/* Icon */}
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #059669, #0891b2)', boxShadow: '0 4px 12px rgba(5,150,105,0.25)' }}>
                <Bell className="w-5 h-5 text-white" />
              </div>
              <div>
                {/* Breadcrumb */}
                <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mb-0.5">
                  <Leaf className="w-3 h-3 text-emerald-500" />
                  <span>Dashboard</span>
                  <ChevronRight className="w-3 h-3" />
                  <span className="text-emerald-400 font-semibold">Notifications</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <h1 className="section-title text-base font-bold text-slate-100 leading-none">Notifications</h1>
                  {unreadCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border stat-number"
                      style={{ background: 'rgba(239,68,68,0.1)', color: '#fca5a5', borderColor: 'rgba(239,68,68,0.25)' }}>
                      {unreadCount} unread
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Header actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {unreadCount > 0 && (
              <button onClick={markAllRead}
                className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all section-title"
                style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', color: '#10b981' }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(16,185,129,0.18)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(16,185,129,0.1)'; }}>
                <CheckCheck className="w-3.5 h-3.5" /> Mark all read
              </button>
            )}
            <button onClick={clearAll}
              className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all section-title card"
              style={{ color: '#64748b' }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#fca5a5'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(239,68,68,0.3)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#64748b'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(71,85,105,0.35)'; }}>
              <Trash2 className="w-3.5 h-3.5" /> Clear
            </button>
          </div>
        </div>

        {/* Category tabs */}
        <div className="px-4 md:px-6 pb-3">
          <div className="flex items-center gap-1 p-1 rounded-xl w-fit"
            style={{ background: 'rgba(15,24,36,0.6)', border: '1px solid rgba(71,85,105,0.3)' }}>
            {CATEGORIES.map(({ id, label, icon: Icon }) => {
              const count  = categoryCounts[id];
              const unread = id === 'all'
                ? unreadCount
                : notifications.filter(n => n.category === id && !n.read).length;
              const isActive = activeCategory === id;
              return (
                <button key={id} onClick={() => setActiveCategory(id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex-shrink-0 section-title"
                  style={isActive
                    ? { background: 'rgba(30,41,59,0.9)', color: '#f1f5f9', boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }
                    : { color: '#64748b' }}>
                  <Icon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{label}</span>
                  {count > 0 && (
                    <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold stat-number"
                      style={{
                        background: isActive ? 'rgba(16,185,129,0.15)' : 'rgba(15,24,36,0.6)',
                        color: isActive ? '#10b981' : '#475569',
                        border: `1px solid ${isActive ? 'rgba(16,185,129,0.2)' : 'rgba(71,85,105,0.3)'}`,
                      }}>
                      {count}
                    </span>
                  )}
                  {unread > 0 && !isActive && (
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 animate-pulse"
                      style={{ background: '#ef4444' }} />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* ── Main Content ── */}
      <div className="relative z-10 max-w-4xl mx-auto p-4 md:p-6 space-y-5">

        {/* Summary stat strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total',    value: notifications.length,            color: '#94a3b8', bg: 'rgba(148,163,184,0.06)', border: 'rgba(148,163,184,0.15)' },
            { label: 'Unread',   value: unreadCount,                     color: '#ef4444', bg: 'rgba(239,68,68,0.06)',   border: 'rgba(239,68,68,0.2)'    },
            { label: 'Critical', value: notifications.filter(n => n.priority === 'critical').length, color: '#f97316', bg: 'rgba(249,115,22,0.06)', border: 'rgba(249,115,22,0.2)' },
            { label: 'Today',    value: notifications.filter(n => getGroup(n.timestamp) === 'Today').length, color: '#10b981', bg: 'rgba(16,185,129,0.06)', border: 'rgba(16,185,129,0.2)' },
          ].map(s => (
            <div key={s.label} className="rounded-2xl p-4 flex items-center gap-3 transition-all hover:-translate-y-0.5"
              style={{ background: s.bg, border: `1px solid ${s.border}`, backdropFilter: 'blur(12px)' }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: `${s.color}12`, border: `1px solid ${s.color}25` }}>
                <span className="stat-number text-lg font-black" style={{ color: s.color }}>{s.value}</span>
              </div>
              <p className="text-xs font-semibold uppercase tracking-wider section-title" style={{ color: s.color }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Filter bar */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">

            {/* Unread toggle */}
            <button onClick={() => setShowUnreadOnly(v => !v)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all section-title"
              style={{
                background: showUnreadOnly ? 'rgba(16,185,129,0.1)' : 'rgba(30,41,59,0.6)',
                border: `1px solid ${showUnreadOnly ? 'rgba(16,185,129,0.3)' : 'rgba(71,85,105,0.35)'}`,
                color: showUnreadOnly ? '#10b981' : '#64748b',
                backdropFilter: 'blur(12px)',
              }}>
              <Circle className="w-3 h-3 fill-current" /> Unread only
            </button>

            {/* Priority filter */}
            <div className="relative">
              <button onClick={() => setFilterOpen(v => !v)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all section-title"
                style={{
                  background: selectedPriorities.size > 0 ? 'rgba(245,158,11,0.08)' : 'rgba(30,41,59,0.6)',
                  border: `1px solid ${selectedPriorities.size > 0 ? 'rgba(245,158,11,0.3)' : 'rgba(71,85,105,0.35)'}`,
                  color: selectedPriorities.size > 0 ? '#fcd34d' : '#64748b',
                  backdropFilter: 'blur(12px)',
                }}>
                <Filter className="w-3 h-3" />
                Priority
                {selectedPriorities.size > 0 && (
                  <span className="w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center stat-number"
                    style={{ background: '#f59e0b', color: '#0f1824' }}>
                    {selectedPriorities.size}
                  </span>
                )}
                <ChevronDown className={cn('w-3 h-3 transition-transform', filterOpen && 'rotate-180')} />
              </button>

              {filterOpen && (
                <div className="absolute top-full left-0 mt-2 z-30 rounded-2xl p-3 shadow-2xl"
                  style={{ background: 'rgba(15,24,36,0.97)', border: '1px solid rgba(71,85,105,0.4)', backdropFilter: 'blur(20px)', minWidth: 190 }}>
                  <p className="text-[10px] uppercase tracking-widest font-semibold mb-2 px-1 section-title" style={{ color: '#475569' }}>
                    Filter by priority
                  </p>
                  {(Object.keys(PRIORITY_CONFIG) as NotifPriority[]).map(p => {
                    const cfg    = PRIORITY_CONFIG[p];
                    const active = selectedPriorities.has(p);
                    return (
                      <button key={p} onClick={() => togglePriority(p)}
                        className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-sm font-medium transition-all section-title"
                        style={{ background: active ? 'rgba(30,41,59,0.8)' : 'transparent', color: active ? '#e2e8f0' : '#64748b' }}
                        onMouseEnter={e => !active && ((e.currentTarget as HTMLButtonElement).style.background = 'rgba(30,41,59,0.5)')}
                        onMouseLeave={e => !active && ((e.currentTarget as HTMLButtonElement).style.background = 'transparent')}>
                        <span className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ background: cfg.dot, boxShadow: `0 0 4px ${cfg.dot}` }} />
                        {cfg.label}
                        {active && <Check className="w-3.5 h-3.5 ml-auto" style={{ color: '#10b981' }} />}
                      </button>
                    );
                  })}
                  {selectedPriorities.size > 0 && (
                    <button onClick={() => setSelectedPriorities(new Set())}
                      className="w-full mt-2 pt-2 border-t text-xs flex items-center justify-center gap-1.5 transition-colors section-title"
                      style={{ borderColor: 'rgba(71,85,105,0.3)', color: '#475569' }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#f87171')}
                      onMouseLeave={e => (e.currentTarget.style.color = '#475569')}>
                      <X className="w-3 h-3" /> Clear filters
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Active priority chips */}
            {Array.from(selectedPriorities).map(p => (
              <span key={p} className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium border section-title"
                style={{ background: PRIORITY_CONFIG[p].badge, color: PRIORITY_TEXT[p], borderColor: `${PRIORITY_CONFIG[p].accentColor}25` }}>
                {PRIORITY_CONFIG[p].label}
                <button onClick={() => togglePriority(p)} className="hover:opacity-70 ml-0.5">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>

          <span className="text-xs flex-shrink-0 stat-number" style={{ color: '#475569' }}>
            {totalFiltered} notification{totalFiltered !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Notification groups */}
        {totalFiltered === 0 ? (
          <div className="card rounded-2xl flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: 'rgba(15,24,36,0.6)', border: '1px solid rgba(71,85,105,0.25)' }}>
              <BellOff className="w-7 h-7" style={{ color: '#334155' }} />
            </div>
            <h3 className="text-base font-semibold mb-1 section-title" style={{ color: '#64748b' }}>No notifications</h3>
            <p className="text-sm max-w-xs" style={{ color: '#475569' }}>
              {showUnreadOnly
                ? 'All notifications have been read. Toggle off the unread filter to see all.'
                : "You're all caught up! New alerts and insights will appear here."}
            </p>
            {(showUnreadOnly || selectedPriorities.size > 0) && (
              <button onClick={() => { setShowUnreadOnly(false); setSelectedPriorities(new Set()); }}
                className="mt-4 px-4 py-2 rounded-xl text-sm font-medium transition-all card section-title"
                style={{ color: '#94a3b8' }}>
                Clear filters
              </button>
            )}
          </div>
        ) : (
          GROUP_ORDER.filter(g => grouped[g]?.length > 0).map(group => (
            <section key={group} className="space-y-2.5">
              {/* Group header */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <CalendarDays className="w-3.5 h-3.5" style={{ color: '#334155' }} />
                  <span className="text-[10px] font-bold uppercase tracking-widest section-title" style={{ color: '#334155' }}>
                    {group}
                  </span>
                </div>
                <div className="flex-1 h-px" style={{ background: 'rgba(71,85,105,0.2)' }} />
                <span className="text-[10px] font-semibold stat-number" style={{ color: '#334155' }}>
                  {grouped[group].length}
                </span>
              </div>

              <div className="space-y-2">
                {grouped[group].map(notif => (
                  <NotifCard key={notif.id} notif={notif} onRead={markRead} onDelete={deleteNotif} />
                ))}
              </div>
            </section>
          ))
        )}

        {/* Load more */}
        {totalFiltered > 0 && (
          <div className="flex justify-center pt-2 pb-8">
            <button className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all card section-title"
              style={{ color: '#64748b' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#94a3b8')}
              onMouseLeave={e => (e.currentTarget.style.color = '#64748b')}>
              <Info className="w-4 h-4" />
              Showing {totalFiltered} of {notifications.length} · Load more
            </button>
          </div>
        )}
      </div>

      {/* Mobile bottom bar */}
      {unreadCount > 0 && (
        <div className="sm:hidden fixed bottom-0 left-0 right-0 p-4 flex gap-3"
          style={{ background: 'rgba(15,24,36,0.97)', backdropFilter: 'blur(20px)', borderTop: '1px solid rgba(71,85,105,0.3)' }}>
          <button onClick={markAllRead}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white transition-all active:scale-95 section-title"
            style={{ background: 'linear-gradient(135deg, #059669, #0891b2)', boxShadow: '0 4px 14px rgba(5,150,105,0.3)' }}>
            <CheckCheck className="w-4 h-4" />
            Mark all read ({unreadCount})
          </button>
          <button onClick={clearAll}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all active:scale-95 card"
            style={{ color: '#94a3b8' }}>
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}