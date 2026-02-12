'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTheme } from 'next-themes';
import {
  Droplets, Sun, Moon, Bell, Database, ChevronRight,
  Brain, AlertTriangle, CheckCircle, RefreshCw, Waves,
  Leaf, Volume2, VolumeX, Smartphone,
  Eye, EyeOff, Save, RotateCcw,
  BatteryCharging, Radio, MapPin, Activity,
  Gauge, Info, Sliders
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const AI_API_KEY = process.env.NEXT_PUBLIC_GROQ_API_KEY ?? '';
const AI_MODEL   = 'llama-3.3-70b-versatile';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type IrrigationMode = 'manual' | 'auto' | 'scheduled';
type AlertLevel     = 'all' | 'critical' | 'none';

interface FarmSettings {
  irrigationActive:   boolean;
  irrigationMode:     IrrigationMode;
  wateringDuration:   number;
  wateringFrequency:  number;
  scheduledTime:      string;
  moistureMin:        number;
  moistureMax:        number;
  tempMin:            number;
  tempMax:            number;
  phMin:              number;
  phMax:              number;
  alertLevel:         AlertLevel;
  pushEnabled:        boolean;
  smsEnabled:         boolean;
  soundEnabled:       boolean;
  syncInterval:       number;
  offlineMode:        boolean;
  dataRetention:      number;
  tankCapacity:       number;
  tankCurrent:        number;
  lowWaterThreshold:  number;
}

type AITip = { type: 'info' | 'warning' | 'success'; text: string };

// ---------------------------------------------------------------------------
// Groq helper
// ---------------------------------------------------------------------------
async function callGroq(prompt: string, system: string): Promise<string> {
  if (!AI_API_KEY) return JSON.stringify({
    tips: [
      { type: 'info',    text: 'Add NEXT_PUBLIC_GROQ_API_KEY to .env.local to get live AI irrigation tips.' },
      { type: 'warning', text: 'Nitrogen at 45 mg/kg is below optimum — consider NPK top-dress before next irrigation.' },
      { type: 'success', text: 'Current soil moisture of 62% is ideal. Reduce watering frequency by 15% to conserve water.' },
    ],
    optimalWateringTime: '06:30',
    weeklyWaterEstimate: 48,
  });
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${AI_API_KEY}` },
    body: JSON.stringify({
      model: AI_MODEL,
      messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }],
      temperature: 0.5,
      max_tokens: 500,
    }),
  });
  if (!res.ok) throw new Error(`Groq ${res.status}`);
  const d = await res.json();
  return d?.choices?.[0]?.message?.content ?? '{}';
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------
function cn(...c: (string | false | null | undefined)[]): string {
  return c.filter(Boolean).join(' ');
}

// ---------------------------------------------------------------------------
// WaterTank – pure SVG, no theme dependency, no styled-jsx
// ---------------------------------------------------------------------------
function WaterTank({ current, capacity, low }: { current: number; capacity: number; low: number }) {
  const pct   = Math.min(100, Math.max(0, (current / capacity) * 100));
  const isLow = pct <= low;
  const color = isLow ? '#ef4444' : pct < 40 ? '#f59e0b' : '#38bdf8';

  return (
    <div className="relative flex flex-col items-center gap-2">
      <div className="relative w-28 h-44">
        <svg viewBox="0 0 112 176" className="w-full h-full">
          <defs>
            <clipPath id="tankClip">
              <rect x="8" y="8" width="96" height="152" rx="12" />
            </clipPath>
            <linearGradient id="waterFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.9" />
              <stop offset="100%" stopColor={color} stopOpacity="0.5" />
            </linearGradient>
            <linearGradient id="tankBody" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#1e293b" />
              <stop offset="100%" stopColor="#0f172a" />
            </linearGradient>
          </defs>
          <rect x="8" y="8" width="96" height="152" rx="12"
            fill="url(#tankBody)" stroke="#334155" strokeWidth="2" />
          <g clipPath="url(#tankClip)">
            <rect
              x="8"
              y={8 + 152 * (1 - pct / 100)}
              width="96"
              height={152 * (pct / 100)}
              fill="url(#waterFill)"
            />
            {pct > 2 && (
              <path
                d={`M 8 ${8 + 152 * (1 - pct / 100)}
                    Q 36 ${8 + 152 * (1 - pct / 100) - 6} 56 ${8 + 152 * (1 - pct / 100)}
                    Q 76 ${8 + 152 * (1 - pct / 100) + 6} 104 ${8 + 152 * (1 - pct / 100)}
                    V 160 H 8 Z`}
                fill={color}
                opacity="0.25"
              >
                <animateTransform
                  attributeName="transform"
                  type="translate"
                  values="-48 0;48 0;-48 0"
                  dur="3s"
                  repeatCount="indefinite"
                />
              </path>
            )}
          </g>
          {[25, 50, 75].map(t => (
            <g key={t}>
              <line x1="100" y1={8 + 152 * (1 - t / 100)} x2="108" y2={8 + 152 * (1 - t / 100)}
                stroke="#475569" strokeWidth="1.5" />
              <text x="80" y={8 + 152 * (1 - t / 100) + 4} fontSize="8" fill="#475569" textAnchor="end">{t}%</text>
            </g>
          ))}
          <rect x="44" y="0" width="24" height="12" rx="4" fill="#334155" stroke="#475569" strokeWidth="1" />
          {isLow && (
            <rect x="8" y={8 + 152 * (1 - low / 100)} width="96" height="2" fill="#ef4444" opacity="0.5">
              <animate attributeName="opacity" values="0.5;1;0.5" dur="1.5s" repeatCount="indefinite" />
            </rect>
          )}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-2xl font-black tabular-nums drop-shadow-lg"
            style={{ color: pct > 40 ? '#f1f5f9' : color }}>
            {Math.round(pct)}%
          </span>
        </div>
      </div>
      <div className="text-center">
        <p className="text-xs text-slate-500">Available</p>
        <p className="font-bold text-slate-200 tabular-nums">
          {current.toFixed(0)}<span className="text-slate-500 font-normal text-xs"> / {capacity} L</span>
        </p>
      </div>
      {isLow && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 border border-red-500/30 rounded-full">
          <AlertTriangle className="w-3 h-3 text-red-400" />
          <span className="text-xs text-red-300 font-medium">Low water</span>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Toggle
// ---------------------------------------------------------------------------
function Toggle({
  checked, onChange, size = 'md', color = '#10b981', disabled = false,
}: {
  checked: boolean; onChange: (v: boolean) => void;
  size?: 'sm' | 'md' | 'lg'; color?: string; disabled?: boolean;
}) {
  const dims = {
    sm: { w: 36, h: 20, thumb: 14, pad: 3 },
    md: { w: 48, h: 26, thumb: 18, pad: 4 },
    lg: { w: 60, h: 32, thumb: 22, pad: 5 },
  }[size];
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className="relative flex-shrink-0 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed"
      style={{
        width: dims.w, height: dims.h,
        background: checked ? color : '#334155',
        boxShadow: checked ? `0 0 12px ${color}55` : 'none',
        transition: 'background 0.3s, box-shadow 0.3s',
      }}
      aria-checked={checked}
      role="switch"
    >
      <span
        className="absolute rounded-full bg-white shadow-md"
        style={{
          width: dims.thumb, height: dims.thumb, top: dims.pad,
          left: checked ? dims.w - dims.thumb - dims.pad : dims.pad,
          transition: 'left 0.3s cubic-bezier(.4,0,.2,1)',
        }}
      />
    </button>
  );
}

// ---------------------------------------------------------------------------
// SliderRow
// ---------------------------------------------------------------------------
function SliderRow({
  label, value, min, max, step = 1, unit, onChange, color = '#10b981',
}: {
  label: string; value: number; min: number; max: number;
  step?: number; unit: string; onChange: (v: number) => void; color?: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs">
        <span className="text-slate-400 font-medium">{label}</span>
        <span className="font-bold tabular-nums" style={{ color }}>{value}{unit}</span>
      </div>
      <div className="relative h-6 flex items-center">
        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-150"
            style={{ width: `${((value - min) / (max - min)) * 100}%`, background: color }} />
        </div>
        <input type="range" min={min} max={max} step={step} value={value}
          onChange={e => onChange(Number(e.target.value))}
          className="absolute inset-0 w-full opacity-0 cursor-pointer" />
        <div className="absolute w-4 h-4 rounded-full bg-white shadow-lg border-2 pointer-events-none transition-all duration-150"
          style={{ left: `calc(${((value - min) / (max - min)) * 100}% - 8px)`, borderColor: color }} />
      </div>
      <div className="flex justify-between text-[10px] text-slate-600">
        <span>{min}{unit}</span><span>{max}{unit}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SettingCard – no isDark inside; callers pass inline styles if needed
// ---------------------------------------------------------------------------
function SettingCard({
  icon: Icon, title, subtitle, children, accent = '#10b981', badge,
}: {
  icon: React.ElementType; title: string; subtitle?: string;
  children: React.ReactNode; accent?: string; badge?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-700/60 bg-slate-900/80 backdrop-blur-sm overflow-hidden">
      <div
        className="flex items-center justify-between px-5 py-4 border-b border-slate-700/50"
        style={{ borderLeftWidth: 3, borderLeftStyle: 'solid', borderLeftColor: accent }}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: `${accent}18`, border: `1px solid ${accent}30` }}>
            <Icon className="w-4 h-4" style={{ color: accent }} />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-100">{title}</h3>
            {subtitle && <p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
        </div>
        {badge}
      </div>
      <div className="p-5 space-y-4">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SettingRow
// ---------------------------------------------------------------------------
function SettingRow({ label, sublabel, children }: {
  label: string; sublabel?: string; children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-200 truncate">{label}</p>
        {sublabel && <p className="text-xs text-slate-500 mt-0.5">{sublabel}</p>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
export default function SettingsPage() {
  // ─── HYDRATION FIX ───────────────────────────────────────────────────────
  // Never read resolvedTheme on the server. Gate ALL theme-dependent rendering
  // behind `mounted === true`. The skeleton below is rendered on both server
  // and client identically, eliminating every class-hash mismatch.
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const isDark = mounted ? resolvedTheme !== 'light' : true;
  // ─────────────────────────────────────────────────────────────────────────

  const [settings, setSettings] = useState<FarmSettings>({
    irrigationActive:   false,
    irrigationMode:     'auto',
    wateringDuration:   20,
    wateringFrequency:  12,
    scheduledTime:      '06:30',
    moistureMin:        35,
    moistureMax:        70,
    tempMin:            15,
    tempMax:            32,
    phMin:              5.8,
    phMax:              7.2,
    alertLevel:         'all',
    pushEnabled:        true,
    smsEnabled:         false,
    soundEnabled:       true,
    syncInterval:       30,
    offlineMode:        false,
    dataRetention:      90,
    tankCapacity:       500,
    tankCurrent:        213,
    lowWaterThreshold:  20,
  });

  const [aiTips,      setAiTips]      = useState<AITip[]>([]);
  const [aiOptTime,   setAiOptTime]   = useState('');
  const [aiWeeklyEst, setAiWeeklyEst] = useState(0);
  const [aiLoading,   setAiLoading]   = useState(false);
  const [aiError,     setAiError]     = useState('');
  const [wateringOn,  setWateringOn]  = useState(false);
  const [waterTimer,  setWaterTimer]  = useState(0);
  const [saved,       setSaved]       = useState(false);
  const [showKey,     setShowKey]     = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (wateringOn) {
      setWaterTimer(settings.wateringDuration * 60);
      timerRef.current = setInterval(() => {
        setWaterTimer(t => {
          if (t <= 1) { setWateringOn(false); clearInterval(timerRef.current!); return 0; }
          setSettings(s => ({
            ...s,
            tankCurrent: Math.max(0, s.tankCurrent - s.tankCapacity / (s.wateringDuration * 60)),
          }));
          return t - 1;
        });
      }, 1000);
    } else {
      clearInterval(timerRef.current!);
      setWaterTimer(0);
    }
    return () => clearInterval(timerRef.current!);
  }, [wateringOn]);

  const fetchAITips = useCallback(async () => {
    setAiLoading(true);
    setAiError('');
    try {
      const sys = `You are an expert agronomist AI. Reply ONLY with valid JSON, no prose, no markdown.
Schema: { "tips": [{ "type": "info"|"warning"|"success", "text": "<max 20 words>" }], "optimalWateringTime": "<HH:MM>", "weeklyWaterEstimate": <integer> }`;
      const prompt = `Farm: Roma VF Tomatoes, Kenya highlands.
Settings: mode=${settings.irrigationMode}, duration=${settings.wateringDuration}min, every ${settings.wateringFrequency}h.
Tank: ${settings.tankCurrent}L / ${settings.tankCapacity}L. Moisture thresholds: ${settings.moistureMin}–${settings.moistureMax}%.
Give up to 4 tailored irrigation tips plus optimal watering time.`;
      const raw    = await callGroq(prompt, sys);
      const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
      setAiTips(parsed.tips ?? []);
      setAiOptTime(parsed.optimalWateringTime ?? '');
      setAiWeeklyEst(parsed.weeklyWaterEstimate ?? 0);
    } catch (e) {
      setAiError((e as Error).message);
    } finally {
      setAiLoading(false);
    }
  }, [settings]);

  useEffect(() => { fetchAITips(); }, []);

  const set = <K extends keyof FarmSettings>(key: K, val: FarmSettings[K]) =>
    setSettings(s => ({ ...s, [key]: val }));

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
    if (typeof window !== 'undefined') localStorage.setItem('farmSettings', JSON.stringify(settings));
  };

  const handleReset = () => {
    if (confirm('Reset all settings to factory defaults?')) {
      localStorage.removeItem('farmSettings');
      window.location.reload();
    }
  };

  const fmt = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  const tipStyle: Record<string, string> = {
    info:    'bg-cyan-500/10 border-cyan-500/20 text-cyan-300',
    warning: 'bg-amber-500/10 border-amber-500/20 text-amber-300',
    success: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300',
  };
  const tipIcon = { info: Info, warning: AlertTriangle, success: CheckCircle };

  // ── Static skeleton — identical on SSR and first client paint ──
  if (!mounted) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-4">
          <div className="h-10 w-52 bg-slate-800 rounded-xl animate-pulse" />
          <div className="h-4 w-80 bg-slate-800 rounded-lg animate-pulse" />
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-5">
            {[...Array(4)].map((_, i) => (
              <div key={i}
                className={cn('rounded-2xl bg-slate-900 border border-slate-800 h-56 animate-pulse',
                  i < 2 ? 'lg:col-span-2' : '')}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Full UI — only rendered after client hydration ──
  return (
    <div
      className="min-h-screen font-sans"
      style={{
        background: isDark
          ? 'linear-gradient(135deg,#020617 0%,#0f172a 50%,#020617 100%)'
          : 'linear-gradient(135deg,#f1f5f9 0%,#ffffff 50%,#ecfdf5 100%)',
        color: isDark ? '#f1f5f9' : '#0f172a',
      }}
    >
      {/* Ambient blobs — no Tailwind class branching, only inline styles */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-0 right-0 w-96 h-96 rounded-full blur-3xl"
          style={{ background: 'rgba(16,185,129,0.06)' }} />
        <div className="absolute bottom-0 left-0 w-80 h-80 rounded-full blur-3xl"
          style={{ background: 'rgba(59,130,246,0.05)' }} />
      </div>

      <div className="relative z-10 max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm mb-1"
              style={{ color: isDark ? '#64748b' : '#94a3b8' }}>
              <Leaf className="w-4 h-4 text-emerald-500" />
              <span>Farm Dashboard</span>
              <ChevronRight className="w-3 h-3" />
              <span className="text-emerald-500">Settings</span>
            </div>
            <h1 className="text-3xl font-black tracking-tight">Farm Settings</h1>
            <p className="text-sm mt-1" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>
              Control irrigation, alerts, system preferences and display
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleReset}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={{
                background: isDark ? '#1e293b' : '#ffffff',
                border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                color: isDark ? '#cbd5e1' : '#475569',
              }}>
              <RotateCcw className="w-4 h-4" />Reset
            </button>
            <button onClick={handleSave}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all"
              style={{
                background: saved ? '#059669' : '#10b981',
                boxShadow: saved ? 'none' : '0 4px 14px rgba(16,185,129,0.3)',
                transform: saved ? 'scale(0.96)' : 'scale(1)',
              }}>
              {saved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
              {saved ? 'Saved!' : 'Save Changes'}
            </button>
          </div>
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* LEFT COLUMN */}
          <div className="lg:col-span-2 space-y-5">

            {/* Irrigation */}
            <SettingCard icon={Droplets} title="Irrigation Control"
              subtitle="Manual override and automation settings" accent="#38bdf8"
              badge={
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold"
                  style={{
                    background: wateringOn ? 'rgba(56,189,248,0.15)' : settings.irrigationActive ? 'rgba(16,185,129,0.15)' : 'rgba(51,65,85,0.6)',
                    color: wateringOn ? '#7dd3fc' : settings.irrigationActive ? '#6ee7b7' : '#94a3b8',
                  }}>
                  <Droplets className="w-3 h-3" />
                  {wateringOn ? `Running ${fmt(waterTimer)}` : settings.irrigationActive ? 'Armed' : 'Off'}
                </div>
              }
            >
              {/* Big water switch */}
              <div className="relative overflow-hidden rounded-2xl p-5 transition-all duration-500"
                style={{
                  background: wateringOn
                    ? 'linear-gradient(135deg,rgba(12,74,110,0.6),rgba(15,23,42,0.9))'
                    : isDark ? 'rgba(30,41,59,0.6)' : 'rgba(241,245,249,0.8)',
                  border: `1px solid ${wateringOn ? 'rgba(56,189,248,0.4)' : isDark ? 'rgba(51,65,85,0.5)' : '#e2e8f0'}`,
                }}>
                {wateringOn && (
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    {[0, 1, 2].map(i => (
                      <div key={i} className="absolute rounded-full border border-sky-400/20"
                        style={{ width: '55%', height: '55%', animation: `sfPing 2s ease-out ${i * 0.66}s infinite` }} />
                    ))}
                  </div>
                )}
                <div className="relative flex items-center justify-between gap-4">
                  <div>
                    <p className="text-base font-black text-slate-100">Water Plants Now</p>
                    <p className="text-xs mt-0.5" style={{ color: wateringOn ? '#7dd3fc' : '#64748b' }}>
                      {wateringOn ? `Irrigating · ${fmt(waterTimer)} remaining` : `Manual trigger · ${settings.wateringDuration} min cycle`}
                    </p>
                    {wateringOn && (
                      <div className="mt-2 h-1.5 w-48 bg-slate-700 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-sky-400 transition-all duration-1000"
                          style={{ width: `${100 - (waterTimer / (settings.wateringDuration * 60)) * 100}%` }} />
                      </div>
                    )}
                  </div>
                  <Toggle checked={wateringOn} onChange={setWateringOn}
                    size="lg" color="#38bdf8" disabled={settings.tankCurrent < 5} />
                </div>
              </div>

              <SettingRow label="Auto-Irrigation System" sublabel="Enable automatic soil moisture control">
                <Toggle checked={settings.irrigationActive} onChange={v => set('irrigationActive', v)} color="#38bdf8" />
              </SettingRow>

              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-200">Irrigation Mode</p>
                <div className="grid grid-cols-3 gap-2">
                  {(['manual', 'auto', 'scheduled'] as IrrigationMode[]).map(mode => (
                    <button key={mode} onClick={() => set('irrigationMode', mode)}
                      className="py-2.5 px-3 rounded-xl text-sm font-semibold capitalize transition-all"
                      style={{
                        background: settings.irrigationMode === mode ? '#0284c7' : isDark ? '#1e293b' : '#f8fafc',
                        border: `1px solid ${settings.irrigationMode === mode ? '#0ea5e9' : isDark ? '#334155' : '#e2e8f0'}`,
                        color: settings.irrigationMode === mode ? '#ffffff' : isDark ? '#94a3b8' : '#64748b',
                        boxShadow: settings.irrigationMode === mode ? '0 4px 12px rgba(14,165,233,0.25)' : 'none',
                      }}>
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              <SliderRow label="Watering Duration" value={settings.wateringDuration}
                min={5} max={60} step={5} unit=" min" onChange={v => set('wateringDuration', v)} color="#38bdf8" />
              {settings.irrigationMode === 'auto' && (
                <SliderRow label="Auto-cycle Frequency" value={settings.wateringFrequency}
                  min={2} max={48} step={2} unit=" hrs" onChange={v => set('wateringFrequency', v)} color="#38bdf8" />
              )}
              {settings.irrigationMode === 'scheduled' && (
                <div className="space-y-2">
                  <p className="text-xs text-slate-400 font-medium">Scheduled Time</p>
                  <input type="time" value={settings.scheduledTime}
                    onChange={e => set('scheduledTime', e.target.value)}
                    className="px-4 py-2.5 rounded-xl text-sm font-mono outline-none transition-all"
                    style={{
                      background: isDark ? '#1e293b' : '#ffffff',
                      border: `1px solid ${isDark ? '#334155' : '#cbd5e1'}`,
                      color: isDark ? '#e2e8f0' : '#1e293b',
                    }} />
                  {aiOptTime && (
                    <p className="text-xs text-emerald-400 flex items-center gap-1.5">
                      <Brain className="w-3 h-3" />
                      AI recommends: <strong>{aiOptTime}</strong>
                    </p>
                  )}
                </div>
              )}
            </SettingCard>

            {/* Thresholds */}
            <SettingCard icon={Sliders} title="Sensor Thresholds"
              subtitle="Alert and automation trigger boundaries" accent="#a78bfa">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-4">
                  <SliderRow label="Min Moisture" value={settings.moistureMin} min={10} max={50} unit="%" onChange={v => set('moistureMin', v)} color="#a78bfa" />
                  <SliderRow label="Max Moisture" value={settings.moistureMax} min={50} max={95} unit="%" onChange={v => set('moistureMax', v)} color="#a78bfa" />
                </div>
                <div className="space-y-4">
                  <SliderRow label="Min Temperature" value={settings.tempMin} min={5} max={20} unit="°C" onChange={v => set('tempMin', v)} color="#f59e0b" />
                  <SliderRow label="Max Temperature" value={settings.tempMax} min={25} max={45} unit="°C" onChange={v => set('tempMax', v)} color="#f59e0b" />
                </div>
                <div className="space-y-4">
                  <SliderRow label="Min pH" value={settings.phMin} min={4} max={7} step={0.1} unit="" onChange={v => set('phMin', v)} color="#34d399" />
                  <SliderRow label="Max pH"  value={settings.phMax} min={7} max={9} step={0.1} unit="" onChange={v => set('phMax', v)} color="#34d399" />
                </div>
              </div>
            </SettingCard>

            {/* Notifications */}
            <SettingCard icon={Bell} title="Alerts & Notifications"
              subtitle="Control how and when you receive farm alerts" accent="#f59e0b">
              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-200">Alert Level</p>
                <div className="flex gap-2 flex-wrap">
                  {(['all', 'critical', 'none'] as AlertLevel[]).map(level => (
                    <button key={level} onClick={() => set('alertLevel', level)}
                      className="px-4 py-2 rounded-xl text-sm font-semibold capitalize transition-all"
                      style={{
                        background: settings.alertLevel === level ? '#d97706' : isDark ? '#1e293b' : '#f8fafc',
                        border: `1px solid ${settings.alertLevel === level ? '#f59e0b' : isDark ? '#334155' : '#e2e8f0'}`,
                        color: settings.alertLevel === level ? '#fff' : isDark ? '#94a3b8' : '#64748b',
                      }}>
                      {level === 'all' ? 'All Alerts' : level === 'critical' ? 'Critical Only' : 'Muted'}
                    </button>
                  ))}
                </div>
              </div>
              <SettingRow label="Push Notifications" sublabel="Browser / mobile push">
                <Toggle checked={settings.pushEnabled} onChange={v => set('pushEnabled', v)} color="#f59e0b" />
              </SettingRow>
              <SettingRow label="SMS Alerts" sublabel="Sent to registered phone (+254…)">
                <Toggle checked={settings.smsEnabled} onChange={v => set('smsEnabled', v)} color="#f59e0b" />
              </SettingRow>
              <SettingRow label="Sound Alerts" sublabel="In-app audio notifications">
                <div className="flex items-center gap-2">
                  {settings.soundEnabled ? <Volume2 className="w-4 h-4 text-amber-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
                  <Toggle checked={settings.soundEnabled} onChange={v => set('soundEnabled', v)} color="#f59e0b" />
                </div>
              </SettingRow>
            </SettingCard>

            {/* System */}
            <SettingCard icon={Database} title="System & Connectivity"
              subtitle="Sync, storage and offline behaviour" accent="#10b981">
              <SliderRow label="Data Sync Interval" value={settings.syncInterval}
                min={10} max={300} step={10} unit="s" onChange={v => set('syncInterval', v)} color="#10b981" />
              <SliderRow label="Data Retention Period" value={settings.dataRetention}
                min={7} max={365} step={7} unit=" days" onChange={v => set('dataRetention', v)} color="#10b981" />
              <SettingRow label="Offline Mode" sublabel="Store readings locally when disconnected">
                <Toggle checked={settings.offlineMode} onChange={v => set('offlineMode', v)} color="#10b981" />
              </SettingRow>
              {/* Groq API Key section removed */}
            </SettingCard>
          </div>

          {/* RIGHT COLUMN */}
          <div className="space-y-5">

            {/* Water Tank */}
            <SettingCard icon={Waves} title="Water Tank" subtitle="Stored water & capacity" accent="#38bdf8">
              <div className="flex justify-center py-2">
                <WaterTank current={settings.tankCurrent} capacity={settings.tankCapacity} low={settings.lowWaterThreshold} />
              </div>
              <div className="grid grid-cols-3 gap-2 mt-2">
                {[25, 50, 100].map(pct => (
                  <button key={pct}
                    onClick={() => set('tankCurrent', Math.min(settings.tankCapacity, settings.tankCurrent + settings.tankCapacity * (pct / 100)))}
                    className="py-2 rounded-xl text-xs font-bold transition-all hover:scale-[1.03] active:scale-95"
                    style={{
                      background: isDark ? '#1e293b' : '#f8fafc',
                      border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                      color: isDark ? '#cbd5e1' : '#475569',
                    }}>
                    +{pct}%
                  </button>
                ))}
              </div>
              <SliderRow label="Tank Capacity" value={settings.tankCapacity}
                min={100} max={2000} step={50} unit=" L" onChange={v => set('tankCapacity', v)} color="#38bdf8" />
              <SliderRow label="Low-Water Alert" value={settings.lowWaterThreshold}
                min={5} max={40} step={5} unit="%" onChange={v => set('lowWaterThreshold', v)} color="#f87171" />
              {aiWeeklyEst > 0 && (
                <div className="flex items-start gap-2 p-3 rounded-xl text-xs"
                  style={{ background: 'rgba(56,189,248,0.05)', border: '1px solid rgba(56,189,248,0.2)' }}>
                  <Gauge className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-blue-300 font-semibold mb-0.5">Weekly Estimate</p>
                    <p className="text-slate-400">
                      AI predicts ~<strong className="text-blue-300">{aiWeeklyEst} L</strong> usage this week
                    </p>
                  </div>
                </div>
              )}
            </SettingCard>

            {/* Display & Theme */}
            <SettingCard icon={Sun} title="Display & Theme"
              subtitle="Visual appearance for all pages" accent="#fbbf24">
              {/* Theme toggle */}
              <div className="relative rounded-2xl overflow-hidden p-4 transition-all duration-500"
                style={{
                  background: isDark ? 'linear-gradient(135deg,#1e293b,#0f172a)' : 'linear-gradient(135deg,#fef3c7,#e0f2fe)',
                  border: `1px solid ${isDark ? '#334155' : '#fde68a'}`,
                }}>
                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                  {isDark ? (
                    [[12,8],[24,20],[36,12],[56,24],[68,10],[80,18]].map(([x,y], i) => (
                      <div key={i} className="absolute w-1 h-1 bg-white rounded-full opacity-40"
                        style={{ left: `${x}%`, top: `${y}%` }} />
                    ))
                  ) : (
                    <div className="absolute top-1 right-4 w-16 h-8 bg-white/60 rounded-full blur-sm opacity-80" />
                  )}
                </div>
                <div className="relative flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-500"
                      style={{ background: isDark ? '#334155' : '#fef9c3' }}>
                      {isDark ? <Moon className="w-5 h-5 text-blue-300" /> : <Sun className="w-5 h-5 text-amber-500" />}
                    </div>
                    <div>
                      <p className="font-bold text-sm">{isDark ? 'Dark Mode' : 'Light Mode'}</p>
                      <p className="text-xs mt-0.5" style={{ color: isDark ? '#64748b' : '#92400e' }}>
                        Applies to all pages
                      </p>
                    </div>
                  </div>
                  <Toggle checked={!isDark} onChange={v => setTheme(v ? 'light' : 'dark')}
                    size="lg" color={isDark ? '#60a5fa' : '#f59e0b'} />
                </div>
              </div>

              {/* Theme presets */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Theme Preset</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Forest',  from: '#052e16', to: '#14532d', accent: '#10b981' },
                    { label: 'Ocean',   from: '#0c1a2e', to: '#0f3460', accent: '#38bdf8' },
                    { label: 'Desert',  from: '#2d1b00', to: '#78350f', accent: '#f59e0b' },
                    { label: 'Minimal', from: '#f8fafc', to: '#e2e8f0', accent: '#64748b' },
                  ].map(preset => (
                    <button key={preset.label}
                      className="relative overflow-hidden rounded-xl h-12 transition-all hover:scale-[1.02] active:scale-95 border border-transparent hover:border-white/20"
                      style={{ background: `linear-gradient(135deg,${preset.from},${preset.to})` }}>
                      <span className="absolute bottom-1.5 left-2.5 text-xs font-bold text-white/80">{preset.label}</span>
                      <div className="absolute top-1.5 right-1.5 w-3 h-3 rounded-full"
                        style={{ background: preset.accent }} />
                    </button>
                  ))}
                </div>
              </div>
            </SettingCard>

            {/* AI Tips */}
            <SettingCard icon={Brain} title="AI Irrigation Tips"
              subtitle="Personalized advice from Groq AI" accent="#a78bfa"
              badge={
                <button onClick={fetchAITips} disabled={aiLoading}
                  className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-700 hover:text-slate-200 transition-colors disabled:opacity-40">
                  <RefreshCw className={cn('w-4 h-4', aiLoading ? 'animate-spin' : '')} />
                </button>
              }>
              {aiLoading ? (
                <div className="flex items-center justify-center py-6 gap-3 text-slate-400 text-sm">
                  <div className="w-5 h-5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                  Analyzing irrigation data…
                </div>
              ) : aiError ? (
                <div className="p-3 rounded-xl text-xs text-red-300"
                  style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                  {aiError}
                </div>
              ) : (
                <div className="space-y-2.5">
                  {aiTips.map((tip, i) => {
                    const TipIcon = tipIcon[tip.type as keyof typeof tipIcon] ?? Info;
                    return (
                      <div key={i}
                        className={cn('flex items-start gap-2.5 p-3 rounded-xl border text-xs leading-relaxed', tipStyle[tip.type])}>
                        <TipIcon className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                        {tip.text}
                      </div>
                    );
                  })}
                </div>
              )}
            </SettingCard>

            {/* Device Info */}
            <SettingCard icon={Radio} title="Device Info" subtitle="ESP32 sensor node status" accent="#34d399">
              {[
                { label: 'Device ID', value: 'ESP32-NODE-01', Icon: Smartphone   },
                { label: 'Firmware',  value: 'v2.4.1',        Icon: BatteryCharging },
                { label: 'Location',  value: 'Plot A',        Icon: MapPin       },
                { label: 'Signal',    value: '-67 dBm',       Icon: Activity     },
                { label: 'Last Seen', value: 'Just now',      Icon: CheckCircle  },
              ].map((row, idx, arr) => (
                <div key={row.label}
                  className="flex items-center justify-between py-2"
                  style={{ borderBottom: idx < arr.length - 1 ? `1px solid ${isDark ? '#1e293b' : '#f1f5f9'}` : 'none' }}>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <row.Icon className="w-3.5 h-3.5" />{row.label}
                  </div>
                  <span className="text-xs font-semibold text-slate-200">{row.value}</span>
                </div>
              ))}
            </SettingCard>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between text-xs py-2"
          style={{ color: isDark ? '#334155' : '#94a3b8' }}>
          <div className="flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 flex-shrink-0" />
            Changes apply immediately. Theme switch propagates site-wide via next-themes.
          </div>
          <span>SmartFarm v1.0 · Kenya</span>
        </div>
      </div>

      {/*
        Plain <style> tag (NOT styled-jsx).
        styled-jsx generates different hash IDs server vs client, which was the
        root cause of every jsx-XXXXXXXX mismatch in the error log.
      */}
      <style>{`
        @keyframes sfPing {
          0%   { transform: scale(0.5); opacity: 0.6; }
          100% { transform: scale(2.2); opacity: 0; }
        }
      `}</style>
    </div>
  );
}