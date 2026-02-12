'use client';

import React, { useState } from 'react';
import {
  Bell, BellOff, CheckCheck, Trash2, Filter,
  AlertTriangle, Zap, Info, TrendingUp, Droplets,
  Thermometer, Waves, FlaskConical, Bot, Wifi,
  WifiOff, RefreshCw, CheckCircle, X, Circle,
  ChevronDown, SlidersHorizontal, Archive,
  Sprout, ShieldAlert, Clock, MoreHorizontal
} from 'lucide-react';
import { format, subMinutes, subHours, subDays } from 'date-fns';
import clsx, { type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Priority = 'critical' | 'warning' | 'info' | 'success';
type Category = 'sensor' | 'ai' | 'system' | 'crop';
type FilterTab = 'all' | 'unread' | Category;

type Notification = {
  id: string;
  title: string;
  message: string;
  priority: Priority;
  category: Category;
  read: boolean;
  archived: boolean;
  timestamp: Date;
  sensor?: string;
  value?: string;
  action?: string;
};

// ─── Mock Notifications ───────────────────────────────────────────────────────

const INITIAL_NOTIFICATIONS: Notification[] = [
  {
    id: '1',
    title: 'Critical: Soil Moisture Below Wilting Point',
    message: 'Plot A soil moisture has dropped to 19% — below the critical threshold of 20%. Plants are approaching wilting point. Immediate irrigation required.',
    priority: 'critical',
    category: 'sensor',
    read: false,
    archived: false,
    timestamp: subMinutes(new Date(), 4),
    sensor: 'Soil Moisture',
    value: '19%',
    action: 'Start Irrigation',
  },
  {
    id: '2',
    title: 'Nitrogen Deficiency Detected',
    message: 'AI analysis flagged nitrogen levels at 45 mg/kg, below the optimal 60–80 mg/kg for tomato growth. Yellowing leaves may appear within 3–5 days.',
    priority: 'critical',
    category: 'ai',
    read: false,
    archived: false,
    timestamp: subMinutes(new Date(), 11),
    sensor: 'Soil NPK',
    value: '45 mg/kg',
    action: 'View Recommendation',
  },
  {
    id: '3',
    title: 'Temperature Rising — Monitor Required',
    message: 'Ambient temperature reached 29.4°C, approaching the 30°C stress threshold for tomatoes. Consider activating shade netting if trend continues.',
    priority: 'warning',
    category: 'sensor',
    read: false,
    archived: false,
    timestamp: subMinutes(new Date(), 28),
    sensor: 'Temperature',
    value: '29.4°C',
    action: 'View Chart',
  },
  {
    id: '4',
    title: 'Gemini AI Generated 3 New Insights',
    message: 'Based on 24-hour sensor data trends, Gemini AI has generated updated recommendations for irrigation scheduling, fertilizer application, and pest risk assessment.',
    priority: 'info',
    category: 'ai',
    read: false,
    archived: false,
    timestamp: subMinutes(new Date(), 35),
    action: 'View Insights',
  },
  {
    id: '5',
    title: 'Humidity Optimal — Good Conditions',
    message: 'Relative humidity is holding at 67%, within the optimal 55–80% range. Transpiration rates are normal. No intervention needed.',
    priority: 'success',
    category: 'sensor',
    read: true,
    archived: false,
    timestamp: subHours(new Date(), 1),
    sensor: 'Humidity',
    value: '67%',
  },
  {
    id: '6',
    title: 'ESP32 Node 1 Reconnected',
    message: 'Sensor node ESP32-Node1 came back online after a 14-minute disconnection. All readings have resumed. 14 data points were stored locally and synced.',
    priority: 'info',
    category: 'system',
    read: true,
    archived: false,
    timestamp: subHours(new Date(), 1.5),
    sensor: 'ESP32-Node1',
  },
  {
    id: '7',
    title: 'Harvest Window Predicted: 18–21 Days',
    message: 'Based on current growth rate, soil conditions, and temperature averages, Roma VF Tomato in Plot A is projected to reach harvest readiness 3 days ahead of schedule.',
    priority: 'success',
    category: 'crop',
    read: true,
    archived: false,
    timestamp: subHours(new Date(), 3),
    action: 'View Crop Report',
  },
  {
    id: '8',
    title: 'pH Drift Detected — Slight Acidity',
    message: 'Soil pH in Plot A has drifted to 5.9, just below the optimal 6.0 minimum. While not critical yet, continued acidification may reduce phosphorus availability.',
    priority: 'warning',
    category: 'sensor',
    read: true,
    archived: false,
    timestamp: subHours(new Date(), 5),
    sensor: 'Soil pH',
    value: '5.9 pH',
    action: 'Apply Lime',
  },
  {
    id: '9',
    title: 'Firebase Data Sync Completed',
    message: 'Batch sync of 24 sensor readings completed successfully. All data has been written to Firestore. Next scheduled sync in 30 minutes.',
    priority: 'info',
    category: 'system',
    read: true,
    archived: false,
    timestamp: subHours(new Date(), 6),
  },
  {
    id: '10',
    title: 'Irrigation Cycle Completed — Plot A',
    message: 'Scheduled 20-minute drip irrigation cycle for Plot A completed. Soil moisture increased from 38% to 62%. Next scheduled run in 18 hours.',
    priority: 'success',
    category: 'crop',
    read: true,
    archived: false,
    timestamp: subHours(new Date(), 8),
    value: '38% → 62%',
  },
  {
    id: '11',
    title: 'High Humidity Alert — Fungal Risk',
    message: 'Humidity peaked at 88% for 2 consecutive hours between 03:00–05:00. Fungal disease conditions were present. Preventative fungicide application recommended.',
    priority: 'warning',
    category: 'sensor',
    read: true,
    archived: false,
    timestamp: subHours(new Date(), 14),
    sensor: 'Humidity',
    value: '88%',
    action: 'Log Treatment',
  },
  {
    id: '12',
    title: 'Weekly AI Crop Health Report Ready',
    message: 'Your weekly Gemini AI crop health analysis for Plot A, B, and C is ready. Overall farm health score: 82/100. Key areas for improvement identified.',
    priority: 'info',
    category: 'ai',
    read: true,
    archived: false,
    timestamp: subDays(new Date(), 1),
    action: 'Read Report',
  },
  {
    id: '13',
    title: 'Potassium Levels Optimal',
    message: 'Soil potassium measured at 180 mg/kg, within the high-performance range for tomato fruiting. No supplementation required at this stage.',
    priority: 'success',
    category: 'sensor',
    read: true,
    archived: false,
    timestamp: subDays(new Date(), 1),
    sensor: 'Soil NPK',
    value: '180 mg/kg',
  },
  {
    id: '14',
    title: 'ESP32 Node 1 Offline',
    message: 'Connection to ESP32-Node1 lost. Last reading was at 09:16 AM. Offline mode active — data is being stored locally on the device.',
    priority: 'critical',
    category: 'system',
    read: true,
    archived: false,
    timestamp: subDays(new Date(), 2),
    sensor: 'ESP32-Node1',
    action: 'Diagnose',
  },
  {
    id: '15',
    title: 'Plot B Maize — Growth Milestone',
    message: 'H614D Maize in Plot B has reached the V6 vegetative stage. 34 days after planting, growth is on schedule. Side-dress nitrogen application recommended within 7 days.',
    priority: 'info',
    category: 'crop',
    read: true,
    archived: true,
    timestamp: subDays(new Date(), 3),
    action: 'View Plot B',
  },
];

// ─── Priority config ──────────────────────────────────────────────────────────

const PRIORITY_CONFIG = {
  critical: {
    color: '#ef4444',
    bgClass: 'bg-red-500/8',
    borderClass: 'border-l-red-500',
    badgeCls: 'bg-red-500/10 text-red-400 border border-red-500/20',
    icon: <ShieldAlert className="w-4 h-4" />,
    label: 'Critical',
    dotCls: 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.7)]',
  },
  warning: {
    color: '#f59e0b',
    bgClass: 'bg-amber-500/8',
    borderClass: 'border-l-amber-500',
    badgeCls: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
    icon: <AlertTriangle className="w-4 h-4" />,
    label: 'Warning',
    dotCls: 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.7)]',
  },
  info: {
    color: '#3b82f6',
    bgClass: 'bg-blue-500/8',
    borderClass: 'border-l-blue-500',
    badgeCls: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
    icon: <Info className="w-4 h-4" />,
    label: 'Info',
    dotCls: 'bg-blue-500',
  },
  success: {
    color: '#10b981',
    bgClass: 'bg-emerald-500/8',
    borderClass: 'border-l-emerald-500',
    badgeCls: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
    icon: <CheckCircle className="w-4 h-4" />,
    label: 'Good',
    dotCls: 'bg-emerald-500',
  },
};

// ─── Category config ──────────────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  sensor: { icon: <Thermometer className="w-3.5 h-3.5" />, label: 'Sensor', color: '#06b6d4' },
  ai:     { icon: <Bot className="w-3.5 h-3.5" />,         label: 'AI',     color: '#a855f7' },
  system: { icon: <Wifi className="w-3.5 h-3.5" />,        label: 'System', color: '#64748b' },
  crop:   { icon: <Sprout className="w-3.5 h-3.5" />,      label: 'Crop',   color: '#10b981' },
};

// ─── Relative time ────────────────────────────────────────────────────────────

function relativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);
  if (mins < 1)   return 'Just now';
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return 'Yesterday';
  return format(date, 'MMM d');
}

// ─── Notification Card ────────────────────────────────────────────────────────

function NotifCard({
  notif,
  onRead,
  onDelete,
  onArchive,
}: {
  notif: Notification;
  onRead: (id: string) => void;
  onDelete: (id: string) => void;
  onArchive: (id: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const p = PRIORITY_CONFIG[notif.priority];
  const cat = CATEGORY_CONFIG[notif.category];

  return (
    <div
      className={cn(
        'group relative flex gap-4 px-5 py-4 border-l-4 transition-all duration-200',
        'hover:bg-slate-800/60',
        p.borderClass,
        !notif.read ? p.bgClass : 'bg-transparent',
        notif.read ? 'opacity-75 hover:opacity-100' : ''
      )}
      onClick={() => !notif.read && onRead(notif.id)}
    >
      {/* Unread dot */}
      <div className="flex-shrink-0 pt-1">
        {!notif.read
          ? <span className={cn('block w-2 h-2 rounded-full mt-1', p.dotCls)} />
          : <span className="block w-2 h-2 rounded-full mt-1 bg-transparent" />}
      </div>

      {/* Icon */}
      <div
        className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center mt-0.5"
        style={{ backgroundColor: `${p.color}15`, color: p.color }}
      >
        {p.icon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-2 mb-1">
          <h3 className={cn(
            'text-sm font-semibold leading-snug pr-2',
            notif.read ? 'text-slate-300' : 'text-slate-100'
          )}>
            {notif.title}
          </h3>
          <span className="text-[11px] text-slate-600 font-mono flex-shrink-0 pt-0.5">
            {relativeTime(notif.timestamp)}
          </span>
        </div>

        <p className="text-xs text-slate-500 leading-relaxed mb-3 line-clamp-2">
          {notif.message}
        </p>

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Priority badge */}
          <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold', p.badgeCls)}>
            {p.label}
          </span>

          {/* Category badge */}
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border"
            style={{ color: cat.color, backgroundColor: `${cat.color}12`, borderColor: `${cat.color}25` }}
          >
            {cat.icon}
            {cat.label}
          </span>

          {/* Sensor / value tag */}
          {notif.sensor && (
            <span className="text-[10px] text-slate-600 font-mono bg-slate-800 px-2 py-0.5 rounded-full border border-slate-700">
              {notif.sensor}{notif.value ? ` · ${notif.value}` : ''}
            </span>
          )}
          {!notif.sensor && notif.value && (
            <span className="text-[10px] text-slate-600 font-mono bg-slate-800 px-2 py-0.5 rounded-full border border-slate-700">
              {notif.value}
            </span>
          )}

          {/* Action button */}
          {notif.action && (
            <button
              className="ml-auto text-[11px] font-bold px-3 py-1 rounded-lg transition-all active:scale-95"
              style={{ color: p.color, backgroundColor: `${p.color}15` }}
              onClick={e => e.stopPropagation()}
            >
              {notif.action} →
            </button>
          )}
        </div>
      </div>

      {/* Actions — appear on hover */}
      <div className="flex-shrink-0 flex items-start gap-1 opacity-0 group-hover:opacity-100 transition-opacity pt-0.5">
        {!notif.read && (
          <button
            title="Mark as read"
            onClick={e => { e.stopPropagation(); onRead(notif.id); }}
            className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-500 hover:text-emerald-400 transition-colors"
          >
            <CheckCheck className="w-3.5 h-3.5" />
          </button>
        )}
        <button
          title="Archive"
          onClick={e => { e.stopPropagation(); onArchive(notif.id); }}
          className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-500 hover:text-slate-300 transition-colors"
        >
          <Archive className="w-3.5 h-3.5" />
        </button>
        <button
          title="Delete"
          onClick={e => { e.stopPropagation(); onDelete(notif.id); }}
          className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-500 hover:text-red-400 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ filter }: { filter: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-16 h-16 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center mb-5">
        <BellOff className="w-7 h-7 text-slate-600" />
      </div>
      <h3 className="text-base font-semibold text-slate-400 mb-2">
        {filter === 'unread' ? 'All caught up!' : 'No notifications'}
      </h3>
      <p className="text-sm text-slate-600 max-w-xs leading-relaxed">
        {filter === 'unread'
          ? 'You have no unread notifications. All alerts and updates have been reviewed.'
          : `No ${filter === 'all' ? '' : filter + ' '}notifications to display right now.`}
      </p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>(INITIAL_NOTIFICATIONS);
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [priorityFilter, setPriorityFilter] = useState<Priority | 'all'>('all');
  const [showArchived, setShowArchived] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);

  // ── Derived counts ──
  const unreadCount = notifications.filter(n => !n.read && !n.archived).length;
  const criticalCount = notifications.filter(n => n.priority === 'critical' && !n.read && !n.archived).length;

  // ── Filtered list ──
  const visible = notifications.filter(n => {
    if (!showArchived && n.archived) return false;
    if (showArchived && !n.archived) return false;
    if (activeFilter === 'unread' && n.read) return false;
    if (activeFilter !== 'all' && activeFilter !== 'unread' && n.category !== activeFilter) return false;
    if (priorityFilter !== 'all' && n.priority !== priorityFilter) return false;
    return true;
  });

  // ── Group by date ──
  const grouped: Record<string, Notification[]> = {};
  visible.forEach(n => {
    const key = format(n.timestamp, 'yyyy-MM-dd');
    const label =
      key === format(new Date(), 'yyyy-MM-dd') ? 'Today' :
      key === format(subDays(new Date(), 1), 'yyyy-MM-dd') ? 'Yesterday' :
      format(n.timestamp, 'MMMM d, yyyy');
    if (!grouped[label]) grouped[label] = [];
    grouped[label].push(n);
  });

  // ── Actions ──
  const markRead = (id: string) =>
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));

  const markAllRead = () =>
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));

  const deleteNotif = (id: string) =>
    setNotifications(prev => prev.filter(n => n.id !== id));

  const archiveNotif = (id: string) =>
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, archived: true, read: true } : n));

  const clearAll = () =>
    setNotifications(prev => prev.map(n => ({ ...n, archived: true })));

  // ── Filter tabs ──
  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'all',    label: 'All' },
    { key: 'unread', label: 'Unread' },
    { key: 'sensor', label: 'Sensor' },
    { key: 'ai',     label: 'AI' },
    { key: 'crop',   label: 'Crop' },
    { key: 'system', label: 'System' },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">

      {/* ── Header ── */}
      <div className="sticky top-0 z-30 bg-slate-900/80 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-[860px] mx-auto px-6 md:px-10">

          {/* Top row */}
          <div className="h-14 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Bell className="w-5 h-5 text-slate-300" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 bg-red-500 text-[9px] font-bold text-white rounded-full flex items-center justify-center px-0.5 border-2 border-slate-900">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </div>
              <span className="text-sm font-semibold text-slate-300">Notifications</span>
              {criticalCount > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/20 animate-pulse">
                  <ShieldAlert className="w-3 h-3" />
                  {criticalCount} critical
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-emerald-400 hover:bg-slate-800 transition-all"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Mark all read</span>
                </button>
              )}
              <button
                onClick={() => setShowArchived(v => !v)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                  showArchived
                    ? 'bg-slate-700 text-slate-200'
                    : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
                )}
              >
                <Archive className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Archive</span>
              </button>
              {!showArchived && visible.length > 0 && (
                <button
                  onClick={clearAll}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:text-red-400 hover:bg-slate-800 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Clear all</span>
                </button>
              )}
            </div>
          </div>

          {/* Filter tabs */}
          <div className="flex items-center gap-1 pb-3 overflow-x-auto scrollbar-none">
            {tabs.map(tab => {
              const count = tab.key === 'unread'
                ? unreadCount
                : tab.key === 'all'
                ? notifications.filter(n => !n.archived).length
                : notifications.filter(n => n.category === tab.key && !n.archived).length;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveFilter(tab.key)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all duration-150 flex-shrink-0',
                    activeFilter === tab.key
                      ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                      : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
                  )}
                >
                  {tab.label}
                  {count > 0 && (
                    <span className={cn(
                      'px-1.5 py-0.5 rounded-full text-[10px] font-bold tabular-nums min-w-[18px] text-center',
                      activeFilter === tab.key ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-500'
                    )}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}

            {/* Priority filter dropdown */}
            <div className="relative ml-auto flex-shrink-0">
              <button
                onClick={() => setFilterOpen(v => !v)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
                  priorityFilter !== 'all'
                    ? 'bg-slate-700 text-slate-200 border border-slate-600'
                    : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
                )}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                {priorityFilter !== 'all' ? PRIORITY_CONFIG[priorityFilter].label : 'Filter'}
                <ChevronDown className={cn('w-3 h-3 transition-transform', filterOpen && 'rotate-180')} />
              </button>

              {filterOpen && (
                <div className="absolute right-0 top-full mt-1 w-40 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden z-50">
                  {(['all', 'critical', 'warning', 'info', 'success'] as const).map(p => (
                    <button
                      key={p}
                      onClick={() => { setPriorityFilter(p); setFilterOpen(false); }}
                      className={cn(
                        'w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-medium transition-colors text-left',
                        priorityFilter === p ? 'bg-slate-800 text-slate-200' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                      )}
                    >
                      {p !== 'all' && (
                        <span className={cn('w-1.5 h-1.5 rounded-full', PRIORITY_CONFIG[p].dotCls)} />
                      )}
                      {p === 'all' ? 'All priorities' : PRIORITY_CONFIG[p].label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="max-w-[860px] mx-auto px-0 md:px-4 pb-20">

        {/* Summary stats — inline strip */}
        {!showArchived && (
          <div className="flex flex-wrap gap-x-8 gap-y-2 px-6 md:px-6 py-5 border-b border-slate-800/60">
            {[
              { label: 'Total',    value: notifications.filter(n => !n.archived).length,                               color: '#64748b' },
              { label: 'Unread',  value: unreadCount,                                                                   color: '#3b82f6' },
              { label: 'Critical',value: notifications.filter(n => n.priority === 'critical' && !n.archived).length,   color: '#ef4444' },
              { label: 'Warnings',value: notifications.filter(n => n.priority === 'warning' && !n.archived).length,    color: '#f59e0b' },
            ].map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-sm font-black tabular-nums" style={{ color: s.color }}>{s.value}</span>
                <span className="text-xs text-slate-600">{s.label}</span>
              </div>
            ))}
          </div>
        )}

        {/* Notification groups */}
        {Object.keys(grouped).length === 0
          ? <EmptyState filter={activeFilter} />
          : Object.entries(grouped).map(([dateLabel, items]) => (
            <div key={dateLabel}>
              {/* Date label */}
              <div className="flex items-center gap-3 px-5 py-3 mt-2">
                <span className="text-[11px] font-bold text-slate-600 uppercase tracking-widest">{dateLabel}</span>
                <div className="flex-1 h-px bg-slate-800" />
                <span className="text-[11px] text-slate-700">{items.length}</span>
              </div>

              {/* Cards */}
              <div className="divide-y divide-slate-800/50">
                {items.map(n => (
                  <NotifCard
                    key={n.id}
                    notif={n}
                    onRead={markRead}
                    onDelete={deleteNotif}
                    onArchive={archiveNotif}
                  />
                ))}
              </div>
            </div>
          ))
        }

        {/* Load more placeholder */}
        {visible.length >= 5 && (
          <div className="flex justify-center pt-8 pb-4">
            <button className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:text-slate-400 hover:bg-slate-800 transition-all border border-slate-800">
              <Clock className="w-3.5 h-3.5" />
              Load older notifications
            </button>
          </div>
        )}
      </div>

      {/* Close filter dropdown on outside click */}
      {filterOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setFilterOpen(false)} />
      )}
    </div>
  );
}