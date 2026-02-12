'use client';

import React, { useState, useMemo } from 'react';
import {
  Bell,
  BellOff,
  CheckCheck,
  Trash2,
  Filter,
  AlertTriangle,
  Droplets,
  Thermometer,
  Waves,
  Bot,
  Wifi,
  WifiOff,
  FlaskConical,
  Sprout,
  Settings,
  ChevronDown,
  X,
  Circle,
  Check,
  Info,
  Zap,
  Clock,
  CalendarDays,
} from 'lucide-react';
import clsx, { type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatDistanceToNow, subMinutes, subHours, subDays } from 'date-fns';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ─── Types ───────────────────────────────────────────────
type NotifCategory = 'all' | 'alerts' | 'ai' | 'sensors' | 'system';
type NotifPriority = 'critical' | 'high' | 'medium' | 'low' | 'info';

interface Notification {
  id: string;
  title: string;
  description: string;
  category: Exclude<NotifCategory, 'all'>;
  priority: NotifPriority;
  timestamp: Date;
  read: boolean;
  icon: React.ElementType;
  iconKey: string;
  actionLabel?: string;
  meta?: string;
}

// ─── Data ────────────────────────────────────────────────
const now = new Date();

const INITIAL_NOTIFICATIONS: Notification[] = [
  // Today
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

  // Yesterday
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
    description: 'Potassium (K) levels have reached the optimal range of 180–220 mg/kg following last week\'s fertiliser application.',
    timestamp: subDays(now, 1), read: true, icon: Check, iconKey: 'Check', meta: 'Plot A · Soil Sensor',
  },
  {
    id: '12', title: 'Weekly AI Farm Report Ready', category: 'ai', priority: 'low',
    description: 'Your weekly AI-generated farm performance report is ready. Summary: crop health improved by 12%, water usage reduced by 8%.',
    timestamp: subDays(now, 1), read: true, icon: Bot, iconKey: 'Bot', actionLabel: 'Read Report', meta: 'AI Engine · Weekly Digest',
  },

  // Earlier
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

// ─── Category Config ──────────────────────────────────────
const CATEGORIES: { id: NotifCategory; label: string; icon: React.ElementType }[] = [
  { id: 'all', label: 'All', icon: Bell },
  { id: 'alerts', label: 'Alerts', icon: AlertTriangle },
  { id: 'ai', label: 'AI Insights', icon: Bot },
  { id: 'sensors', label: 'Sensors', icon: Droplets },
  { id: 'system', label: 'System', icon: Settings },
];

// ─── Priority Config ──────────────────────────────────────
const PRIORITY_CONFIG: Record<NotifPriority, { label: string; dot: string; badge: string; border: string }> = {
  critical: { label: 'Critical', dot: 'bg-red-500', badge: 'bg-red-500/10 text-red-400 border-red-500/20', border: 'border-l-red-500' },
  high:     { label: 'High',     dot: 'bg-orange-400', badge: 'bg-orange-500/10 text-orange-400 border-orange-500/20', border: 'border-l-orange-400' },
  medium:   { label: 'Medium',   dot: 'bg-amber-400', badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20', border: 'border-l-amber-400' },
  low:      { label: 'Low',      dot: 'bg-cyan-400', badge: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20', border: 'border-l-cyan-400' },
  info:     { label: 'Info',     dot: 'bg-slate-400', badge: 'bg-slate-500/10 text-slate-400 border-slate-500/20', border: 'border-l-slate-600' },
};

const ICON_COLORS: Record<string, string> = {
  Droplets: 'text-blue-400 bg-blue-500/10',
  Thermometer: 'text-amber-400 bg-amber-500/10',
  Waves: 'text-cyan-400 bg-cyan-500/10',
  Bot: 'text-emerald-400 bg-emerald-500/10',
  Wifi: 'text-green-400 bg-green-500/10',
  WifiOff: 'text-red-400 bg-red-500/10',
  FlaskConical: 'text-violet-400 bg-violet-500/10',
  Sprout: 'text-emerald-400 bg-emerald-500/10',
  Settings: 'text-slate-400 bg-slate-500/10',
  Check: 'text-emerald-400 bg-emerald-500/10',
  Zap: 'text-yellow-400 bg-yellow-500/10',
};

// ─── Date Grouping Helper ─────────────────────────────────
function getGroup(date: Date): string {
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 1) return 'Today';
  if (diffDays < 2) return 'Yesterday';
  if (diffDays < 7) return 'This Week';
  return 'Earlier';
}

const GROUP_ORDER = ['Today', 'Yesterday', 'This Week', 'Earlier'];

// ─── Notification Card ────────────────────────────────────
function NotifCard({
  notif, onRead, onDelete,
}: {
  notif: Notification;
  onRead: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const pCfg = PRIORITY_CONFIG[notif.priority];
  const iconColor = ICON_COLORS[notif.iconKey] ?? 'text-slate-400 bg-slate-700';
  const Icon = notif.icon;

  return (
    <div
      className={cn(
        'group relative flex gap-4 p-4 sm:p-5 rounded-2xl border border-l-4 transition-all duration-200 hover:shadow-lg hover:shadow-black/20',
        pCfg.border,
        notif.read
          ? 'bg-slate-800/50 border-slate-700/60 hover:bg-slate-800'
          : 'bg-slate-800 border-slate-700 hover:bg-slate-750',
      )}
    >
      {/* Unread dot */}
      {!notif.read && (
        <span className={cn('absolute top-4 right-4 w-2 h-2 rounded-full flex-shrink-0', pCfg.dot)} />
      )}

      {/* Icon */}
      <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5', iconColor)}>
        <Icon className="w-5 h-5" />
      </div>

      {/* Body */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-1.5">
          <span className={cn(
            'text-sm font-semibold leading-tight',
            notif.read ? 'text-slate-300' : 'text-slate-100',
          )}>
            {notif.title}
          </span>
          <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border', pCfg.badge)}>
            {pCfg.label}
          </span>
        </div>

        <p className={cn('text-sm leading-relaxed mb-3', notif.read ? 'text-slate-500' : 'text-slate-400')}>
          {notif.description}
        </p>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="flex items-center gap-1.5 text-xs text-slate-500">
              <Clock className="w-3 h-3" />
              {formatDistanceToNow(notif.timestamp, { addSuffix: true })}
            </span>
            {notif.meta && (
              <span className="text-xs text-slate-600 bg-slate-700/60 px-2 py-0.5 rounded-md">
                {notif.meta}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {notif.actionLabel && (
              <button className="text-xs font-medium text-emerald-400 hover:text-emerald-300 transition-colors px-2.5 py-1 rounded-lg hover:bg-emerald-500/10">
                {notif.actionLabel} →
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Hover actions */}
      <div className="absolute top-3 right-3 hidden group-hover:flex items-center gap-1 bg-slate-900 rounded-xl p-1 border border-slate-700 shadow-xl">
        {!notif.read && (
          <button
            onClick={() => onRead(notif.id)}
            title="Mark as read"
            className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-emerald-400 transition-colors"
          >
            <Check className="w-3.5 h-3.5" />
          </button>
        )}
        <button
          onClick={() => onDelete(notif.id)}
          title="Dismiss"
          className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-red-400 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────
export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>(INITIAL_NOTIFICATIONS);
  const [activeCategory, setActiveCategory] = useState<NotifCategory>('all');
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedPriorities, setSelectedPriorities] = useState<Set<NotifPriority>>(new Set());

  // Derived counts
  const unreadCount = notifications.filter((n) => !n.read).length;
  const categoryCounts = useMemo(() => {
    const counts: Record<NotifCategory, number> = { all: 0, alerts: 0, ai: 0, sensors: 0, system: 0 };
    notifications.forEach((n) => {
      counts.all++;
      counts[n.category]++;
    });
    return counts;
  }, [notifications]);

  // Filtered + grouped list
  const grouped = useMemo(() => {
    let filtered = notifications.filter((n) => {
      if (activeCategory !== 'all' && n.category !== activeCategory) return false;
      if (showUnreadOnly && n.read) return false;
      if (selectedPriorities.size > 0 && !selectedPriorities.has(n.priority)) return false;
      return true;
    });

    const groups: Record<string, Notification[]> = {};
    filtered.forEach((n) => {
      const g = getGroup(n.timestamp);
      if (!groups[g]) groups[g] = [];
      groups[g].push(n);
    });
    return groups;
  }, [notifications, activeCategory, showUnreadOnly, selectedPriorities]);

  const totalFiltered = Object.values(grouped).flat().length;

  // Actions
  const markAllRead = () => setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  const markRead = (id: string) => setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
  const deleteNotif = (id: string) => setNotifications((prev) => prev.filter((n) => n.id !== id));
  const clearAll = () => {
    const keep = notifications.filter((n) => {
      if (activeCategory !== 'all' && n.category !== activeCategory) return true;
      return false;
    });
    setNotifications(keep);
  };

  const togglePriority = (p: NotifPriority) => {
    setSelectedPriorities((prev) => {
      const next = new Set(prev);
      next.has(p) ? next.delete(p) : next.add(p);
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">

      {/* ── Page Header ── */}
      <div className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 bg-slate-800 border border-slate-700 rounded-xl flex items-center justify-center">
                  <Bell className="w-5 h-5 text-emerald-400" />
                </div>
                {unreadCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-[10px] font-bold text-white rounded-full flex items-center justify-center border-2 border-slate-950">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-100 leading-tight">Notifications</h1>
                <p className="text-xs text-slate-500">
                  {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'} · {notifications.length} total
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-all"
                >
                  <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
                  Mark all read
                </button>
              )}
              <button
                onClick={clearAll}
                className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-red-400 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear
              </button>
            </div>
          </div>

          {/* ── Category Tabs ── */}
          <div className="flex items-center gap-1 mt-4 overflow-x-auto pb-1 scrollbar-hide">
            {CATEGORIES.map(({ id, label, icon: Icon }) => {
              const count = categoryCounts[id];
              const unread = id === 'all'
                ? unreadCount
                : notifications.filter((n) => n.category === id && !n.read).length;
              return (
                <button
                  key={id}
                  onClick={() => setActiveCategory(id)}
                  className={cn(
                    'flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-200 flex-shrink-0',
                    activeCategory === id
                      ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800',
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                  {count > 0 && (
                    <span className={cn(
                      'px-1.5 py-0.5 rounded-md text-[10px] font-bold',
                      activeCategory === id ? 'bg-white/20 text-white' : 'bg-slate-700 text-slate-400',
                    )}>
                      {count}
                    </span>
                  )}
                  {unread > 0 && activeCategory !== id && (
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* ── Filter Bar ── */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Unread toggle */}
            <button
              onClick={() => setShowUnreadOnly((v) => !v)}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium border transition-all',
                showUnreadOnly
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200',
              )}
            >
              <Circle className="w-3 h-3 fill-current" />
              Unread only
            </button>

            {/* Priority filter */}
            <div className="relative">
              <button
                onClick={() => setFilterOpen((v) => !v)}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium border transition-all',
                  selectedPriorities.size > 0
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200',
                )}
              >
                <Filter className="w-3 h-3" />
                Priority
                {selectedPriorities.size > 0 && (
                  <span className="w-4 h-4 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center">
                    {selectedPriorities.size}
                  </span>
                )}
                <ChevronDown className={cn('w-3 h-3 transition-transform', filterOpen && 'rotate-180')} />
              </button>

              {filterOpen && (
                <div className="absolute top-full left-0 mt-2 z-20 bg-slate-800 border border-slate-700 rounded-2xl p-3 shadow-2xl min-w-[180px]">
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold mb-2 px-1">Filter by priority</p>
                  {(Object.keys(PRIORITY_CONFIG) as NotifPriority[]).map((p) => {
                    const cfg = PRIORITY_CONFIG[p];
                    const active = selectedPriorities.has(p);
                    return (
                      <button
                        key={p}
                        onClick={() => togglePriority(p)}
                        className={cn(
                          'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-sm font-medium transition-all',
                          active ? 'bg-slate-700 text-slate-100' : 'text-slate-400 hover:bg-slate-700/60 hover:text-slate-200',
                        )}
                      >
                        <span className={cn('w-2 h-2 rounded-full flex-shrink-0', cfg.dot)} />
                        {cfg.label}
                        {active && <Check className="w-3.5 h-3.5 text-emerald-400 ml-auto" />}
                      </button>
                    );
                  })}
                  {selectedPriorities.size > 0 && (
                    <button onClick={() => setSelectedPriorities(new Set())}
                      className="w-full mt-2 pt-2 border-t border-slate-700 text-xs text-slate-500 hover:text-red-400 transition-colors flex items-center justify-center gap-1.5">
                      <X className="w-3 h-3" /> Clear filters
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Active filter chips */}
            {selectedPriorities.size > 0 && Array.from(selectedPriorities).map((p) => (
              <span key={p} className={cn('flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium border', PRIORITY_CONFIG[p].badge)}>
                {PRIORITY_CONFIG[p].label}
                <button onClick={() => togglePriority(p)} className="hover:opacity-70 ml-0.5">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>

          {/* Result count */}
          <span className="text-xs text-slate-500 flex-shrink-0">
            {totalFiltered} notification{totalFiltered !== 1 ? 's' : ''}
          </span>
        </div>

        {/* ── Notification Groups ── */}
        {totalFiltered === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center mb-4">
              <BellOff className="w-8 h-8 text-slate-600" />
            </div>
            <h3 className="text-lg font-semibold text-slate-400 mb-1">No notifications</h3>
            <p className="text-sm text-slate-600 max-w-xs">
              {showUnreadOnly
                ? 'All notifications have been read. Toggle off the unread filter to see all.'
                : 'You\'re all caught up! New alerts and insights will appear here.'}
            </p>
            {(showUnreadOnly || selectedPriorities.size > 0) && (
              <button
                onClick={() => { setShowUnreadOnly(false); setSelectedPriorities(new Set()); }}
                className="mt-4 px-4 py-2 rounded-xl text-sm font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          GROUP_ORDER.filter((g) => grouped[g]?.length > 0).map((group) => (
            <section key={group} className="space-y-3">
              {/* Group header */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <CalendarDays className="w-3.5 h-3.5 text-slate-600" />
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">{group}</span>
                </div>
                <div className="flex-1 h-px bg-slate-800" />
                <span className="text-[10px] text-slate-600 font-medium">{grouped[group].length}</span>
              </div>

              {/* Cards */}
              <div className="space-y-2.5">
                {grouped[group].map((notif) => (
                  <NotifCard
                    key={notif.id}
                    notif={notif}
                    onRead={markRead}
                    onDelete={deleteNotif}
                  />
                ))}
              </div>
            </section>
          ))
        )}

        {/* ── Load More ── */}
        {totalFiltered > 0 && (
          <div className="flex justify-center pt-2 pb-8">
            <button className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-slate-400 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-all hover:text-slate-200">
              <Info className="w-4 h-4" />
              Showing {totalFiltered} of {notifications.length} · Load more
            </button>
          </div>
        )}
      </div>

      {/* ── Mobile bottom actions ── */}
      {unreadCount > 0 && (
        <div className="sm:hidden fixed bottom-0 left-0 right-0 p-4 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 flex gap-3">
          <button
            onClick={markAllRead}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 transition-all active:scale-95"
          >
            <CheckCheck className="w-4 h-4" />
            Mark all read ({unreadCount})
          </button>
          <button
            onClick={clearAll}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold text-slate-400 bg-slate-800 border border-slate-700 transition-all active:scale-95 hover:text-red-400"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}