'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import {
  Droplets, Sun, Moon, Bell, Database, ChevronRight,
  Brain, AlertTriangle, CheckCircle, RefreshCw, Waves,
  Leaf, Volume2, VolumeX,
  Save, RotateCcw,
  Radio, MapPin, Activity,
  Gauge, Info, Sliders,
  Lock, ShieldCheck, WifiOff, Menu,
  BatteryCharging, Smartphone,
  Settings, Shield,
} from 'lucide-react';
import { useRole } from '@/hooks/useRole';
import { subscribeToESP32Status, type ESP32StatusResult } from '@/lib/firebase';
import { getDatabase, ref, set as dbSet, onValue } from 'firebase/database';

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
// Sub-mode used only when irrigationMode === 'auto'
type AutoSubMode    = 'moisture' | 'cycle';

interface FarmSettings {
  irrigationActive:   boolean;
  irrigationMode:     IrrigationMode;
  autoSubMode:        AutoSubMode;
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
  dataRetention:      number;
}

type AITip = { type: 'info' | 'warning' | 'success'; text: string };
type AITipsCache = { tips: AITip[]; optimalTime: string; weeklyEstimate: number; savedAt: string };

// ---------------------------------------------------------------------------
// localStorage helpers
// ---------------------------------------------------------------------------
const AI_TIPS_CACHE_KEY = 'farm_ai_irrigation_tips';
function loadCachedTips(): AITipsCache | null {
  if (typeof window === 'undefined') return null;
  try { const raw = localStorage.getItem(AI_TIPS_CACHE_KEY); return raw ? JSON.parse(raw) as AITipsCache : null; }
  catch { return null; }
}
function saveCachedTips(cache: AITipsCache): void {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(AI_TIPS_CACHE_KEY, JSON.stringify(cache)); } catch {}
}

// ---------------------------------------------------------------------------
// Groq helper
// ---------------------------------------------------------------------------
async function callGroq(prompt: string, system: string): Promise<string> {
  if (!AI_API_KEY) return JSON.stringify({
    tips: [
      { type: 'info',    text: 'Add NEXT_PUBLIC_GROQ_API_KEY to .env.local for live AI tips.' },
      { type: 'warning', text: 'Nitrogen at 45 mg/kg is below optimum — consider NPK top-dress.' },
      { type: 'success', text: 'Soil moisture 62% is ideal. Reduce watering by 15% to conserve.' },
    ],
    optimalWateringTime: '06:30',
    weeklyWaterEstimate: 48,
  });
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${AI_API_KEY}` },
    body: JSON.stringify({ model: AI_MODEL, messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }], temperature: 0.5, max_tokens: 500 }),
  });
  if (!res.ok) throw new Error(`Groq ${res.status}`);
  const d = await res.json();
  return d?.choices?.[0]?.message?.content ?? '{}';
}

function cn(...c: (string | false | null | undefined)[]): string {
  return c.filter(Boolean).join(' ');
}

// ---------------------------------------------------------------------------
// ── PIPELINE VALVE ANIMATION
// ---------------------------------------------------------------------------
// NOTE: Button removed from this component — it now only shows the animation + progress.
// The toggle button is rendered separately below the panel only in manual mode.
function PipelineValvePanel({ isOpen, isRunning, timer, duration }: {
  isOpen: boolean; isRunning: boolean; timer: number; duration: number;
}) {
  const progress = duration > 0 ? 1 - (timer / (duration * 60)) : 0;
  return (
    <div className="relative rounded-xl overflow-hidden p-4"
      style={{
        background: isOpen
          ? 'linear-gradient(135deg, rgba(8,47,73,0.75) 0%, rgba(12,74,110,0.55) 50%, rgba(8,47,73,0.75) 100%)'
          : 'rgba(15,24,36,0.7)',
        border: `1px solid ${isOpen ? 'rgba(56,189,248,0.3)' : 'rgba(71,85,105,0.35)'}`,
        transition: 'all 0.6s ease',
      }}>
      {isOpen && (
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at 50% 60%, rgba(56,189,248,0.05) 0%, transparent 70%)' }} />
      )}
      <div className="relative">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h4 className="font-bold text-slate-100 text-sm">Irrigation Valve</h4>
            <p className="text-xs mt-0.5" style={{ color: isOpen ? '#7dd3fc' : '#64748b' }}>
              {isOpen ? (timer > 0 ? `Running · ${Math.floor(timer/60).toString().padStart(2,'0')}:${(timer%60).toString().padStart(2,'0')} left` : 'Valve open') : 'Valve closed'}
            </p>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border"
            style={{
              background: isOpen ? 'rgba(56,189,248,0.12)' : 'rgba(30,41,59,0.6)',
              borderColor: isOpen ? 'rgba(56,189,248,0.35)' : 'rgba(71,85,105,0.35)',
              color: isOpen ? '#7dd3fc' : '#64748b',
            }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: isOpen ? '#38bdf8' : '#475569', boxShadow: isOpen ? '0 0 6px #38bdf8' : 'none', animation: isOpen ? 'pulse 1.5s infinite' : 'none' }} />
            {isOpen ? 'OPEN' : 'CLOSED'}
          </div>
        </div>

        <div className="relative flex items-center justify-center my-2">
          <svg viewBox="0 0 480 120" className="w-full" style={{ maxWidth: 480, height: 110 }}>
            <defs>
              <linearGradient id="pipeGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1e2d3f" /><stop offset="40%" stopColor="#263548" />
                <stop offset="60%" stopColor="#1e2d3f" /><stop offset="100%" stopColor="#131e2c" />
              </linearGradient>
              <linearGradient id="waterGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.9" />
                <stop offset="50%" stopColor="#38bdf8" stopOpacity="1" />
                <stop offset="100%" stopColor="#7dd3fc" stopOpacity="0.7" />
              </linearGradient>
              <linearGradient id="valveGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={isOpen ? '#0284c7' : '#1e2d3f'} />
                <stop offset="100%" stopColor={isOpen ? '#0369a1' : '#131e2c'} />
              </linearGradient>
              <clipPath id="leftPipeClip"><rect x="20" y="46" width="148" height="28" rx="0" /></clipPath>
              <clipPath id="rightPipeClip"><rect x="312" y="46" width="148" height="28" rx="0" /></clipPath>
              <clipPath id="valveBodyClip"><rect x="196" y="36" width="88" height="48" rx="4" /></clipPath>
            </defs>
            <rect x="20" y="44" width="150" height="32" rx="6" fill="url(#pipeGrad)" />
            <rect x="20" y="48" width="150" height="24" rx="4" fill="#0f1824" />
            {isOpen && (
              <g clipPath="url(#leftPipeClip)">
                <rect x="20" y="49" width="148" height="22" fill="url(#waterGrad)" opacity="0.85" rx="3"><animate attributeName="opacity" values="0.7;0.95;0.7" dur="2s" repeatCount="indefinite" /></rect>
                <rect x="-100" y="49" width="60" height="22" rx="3" fill="rgba(255,255,255,0.12)"><animateTransform attributeName="transform" type="translate" from="-80 0" to="230 0" dur="1.4s" repeatCount="indefinite" /></rect>
              </g>
            )}
            <rect x="14" y="40" width="12" height="40" rx="4" fill="#263548" />
            <rect x="193" y="32" width="94" height="56" rx="8" fill={isOpen ? '#0c4a6e' : '#131e2c'} stroke={isOpen ? '#0ea5e9' : '#263548'} strokeWidth="1.5" />
            <rect x="196" y="35" width="88" height="50" rx="6" fill="url(#valveGrad)" opacity="0.8" />
            <g transform={`translate(240, 60) rotate(${isOpen ? 90 : 0})`}>
              <ellipse cx="0" cy="0" rx={isOpen ? 4 : 11} ry="11" fill={isOpen ? 'rgba(56,189,248,0.3)' : '#1e2d3f'} stroke={isOpen ? '#38bdf8' : '#334155'} strokeWidth="1.5" />
              <line x1="0" y1="-11" x2="0" y2="11" stroke={isOpen ? '#7dd3fc' : '#475569'} strokeWidth="1.5" />
            </g>
            {isOpen && (
              <g clipPath="url(#valveBodyClip)">
                <rect x="196" y="47" width="88" height="22" fill="url(#waterGrad)" opacity="0.7" rx="2"><animate attributeName="opacity" values="0.6;0.9;0.6" dur="1.5s" repeatCount="indefinite" /></rect>
              </g>
            )}
            <rect x="228" y="14" width="24" height="22" rx="4" fill={isOpen ? '#0369a1' : '#131e2c'} stroke={isOpen ? '#0ea5e9' : '#263548'} strokeWidth="1" />
            <rect x="221" y="10" width="38" height="8" rx="3" fill={isOpen ? '#0284c7' : '#1e2d3f'} stroke={isOpen ? '#38bdf8' : '#334155'} strokeWidth="1" />
            <text x="240" y="76" textAnchor="middle" fontSize="8" fontWeight="700" fill={isOpen ? '#7dd3fc' : '#475569'} fontFamily="monospace">{isOpen ? 'OPEN' : 'CLOSED'}</text>
            <rect x="310" y="44" width="150" height="32" rx="6" fill="url(#pipeGrad)" />
            <rect x="310" y="48" width="150" height="24" rx="4" fill="#0f1824" />
            {isOpen && (
              <g clipPath="url(#rightPipeClip)">
                <rect x="312" y="49" width="148" height="22" fill="url(#waterGrad)" opacity="0.85" rx="3"><animate attributeName="opacity" values="0.7;0.95;0.7" dur="2s" begin="0.2s" repeatCount="indefinite" /></rect>
                <rect x="200" y="49" width="60" height="22" rx="3" fill="rgba(255,255,255,0.12)"><animateTransform attributeName="transform" type="translate" from="110 0" to="460 0" dur="1.4s" begin="0.2s" repeatCount="indefinite" /></rect>
                {[0,1,2,3,4].map(i => (
                  <circle key={i} cx={450 + (i % 2) * 6} cy={52 + i * 4} r="2" fill="#38bdf8" opacity="0.6">
                    <animate attributeName="cy" values={`${52+i*4};${52+i*4+8}`} dur={`${0.8+i*0.15}s`} repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.8;0" dur={`${0.8+i*0.15}s`} repeatCount="indefinite" />
                  </circle>
                ))}
              </g>
            )}
            <rect x="456" y="40" width="12" height="40" rx="4" fill="#263548" />
            <text x="240" y="108" textAnchor="middle" fontSize="8" fill={isOpen ? '#38bdf8' : '#1e2d3f'} fontFamily="monospace" fontWeight="700">VALVE — {isOpen ? 'FLOW ACTIVE' : 'NO FLOW'}</text>
          </svg>
        </div>

        {isRunning && duration > 0 && (
          <div className="mt-3 space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Cycle progress</span>
              <span className="text-sky-400 font-bold stat-number">{Math.round(progress * 100)}%</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(30,41,59,0.8)' }}>
              <div className="h-full rounded-full transition-all duration-1000 relative overflow-hidden"
                style={{ width: `${progress * 100}%`, background: 'linear-gradient(90deg, #0284c7, #38bdf8, #7dd3fc)' }}>
                <div className="absolute inset-0 shimmer" />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ── Toggle
// ---------------------------------------------------------------------------
function Toggle({ checked, onChange, size = 'md', color = '#10b981', disabled = false, readOnly = false }: {
  checked: boolean; onChange: (v: boolean) => void;
  size?: 'sm' | 'md' | 'lg'; color?: string; disabled?: boolean; readOnly?: boolean;
}) {
  const dims = { sm: { w: 36, h: 20, thumb: 14, pad: 3 }, md: { w: 48, h: 26, thumb: 18, pad: 4 }, lg: { w: 60, h: 32, thumb: 22, pad: 5 } }[size];
  const isBlocked = disabled || readOnly;
  return (
    <button type="button" onClick={() => !isBlocked && onChange(!checked)} disabled={isBlocked}
      className="relative flex-shrink-0 rounded-full focus:outline-none disabled:cursor-not-allowed"
      style={{ width: dims.w, height: dims.h, background: checked ? (readOnly ? '#334155' : color) : 'rgba(30,41,59,0.8)', boxShadow: checked && !readOnly ? `0 0 12px ${color}44` : 'none', opacity: readOnly ? 0.55 : disabled ? 0.4 : 1, border: '1px solid rgba(71,85,105,0.3)', transition: 'background 0.3s, box-shadow 0.3s' }}
      aria-checked={checked} role="switch">
      <span className="absolute rounded-full bg-white shadow-md"
        style={{ width: dims.thumb, height: dims.thumb, top: dims.pad, left: checked ? dims.w - dims.thumb - dims.pad : dims.pad, transition: 'left 0.25s cubic-bezier(.4,0,.2,1)' }} />
    </button>
  );
}

// ---------------------------------------------------------------------------
// ── SliderRow
// ---------------------------------------------------------------------------
function SliderRow({ label, value, min, max, step = 1, unit, onChange, color = '#10b981', readOnly = false }: {
  label: string; value: number; min: number; max: number; step?: number;
  unit: string; onChange: (v: number) => void; color?: string; readOnly?: boolean;
}) {
  return (
    <div className="space-y-2" style={{ opacity: readOnly ? 0.5 : 1 }}>
      <div className="flex justify-between text-xs">
        <span className="text-slate-400 font-medium">{label}</span>
        <span className="font-bold tabular-nums px-2 py-0.5 rounded-md text-xs stat-number"
          style={{ color, background: `${color}12`, border: `1px solid ${color}20` }}>
          {value}{unit}
        </span>
      </div>
      <div className="relative h-5 flex items-center">
        <div className="w-full h-1.5 rounded-full" style={{ background: 'rgba(30,41,59,0.8)' }}>
          <div className="h-full rounded-full transition-all duration-150"
            style={{ width: `${((value - min) / (max - min)) * 100}%`, background: readOnly ? '#334155' : `linear-gradient(90deg, ${color}88, ${color})` }} />
        </div>
        <input type="range" min={min} max={max} step={step} value={value}
          onChange={e => !readOnly && onChange(Number(e.target.value))} disabled={readOnly}
          className="absolute inset-0 w-full opacity-0 cursor-pointer disabled:cursor-not-allowed h-full" />
        <div className="absolute w-3.5 h-3.5 rounded-full bg-white shadow-lg border-2 pointer-events-none"
          style={{ left: `calc(${((value - min) / (max - min)) * 100}% - 7px)`, borderColor: readOnly ? '#334155' : color }} />
      </div>
      <div className="flex justify-between text-[10px] text-slate-600">
        <span>{min}{unit}</span><span>{max}{unit}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ── SettingCard — dashboard card style
// ---------------------------------------------------------------------------
function SettingCard({ icon: Icon, title, subtitle, children, accent = '#10b981', badge }: {
  icon: React.ElementType; title: string; subtitle?: string; children: React.ReactNode; accent?: string; badge?: React.ReactNode;
}) {
  return (
    <div className="card rounded-2xl overflow-hidden">
      {/* Colored accent line matching dashboard */}
      <div className="h-0.5 w-full" style={{ background: `linear-gradient(90deg, ${accent}, ${accent}30, transparent)` }} />
      <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'rgba(71,85,105,0.25)' }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: `${accent}12`, border: `1px solid ${accent}25` }}>
            <Icon className="w-4 h-4" style={{ color: accent }} />
          </div>
          <div>
            <h3 className="section-title font-semibold text-sm text-slate-200">{title}</h3>
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
// ── SettingRow
// ---------------------------------------------------------------------------
function SettingRow({ label, sublabel, children }: { label: string; sublabel?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-300 truncate">{label}</p>
        {sublabel && <p className="text-xs text-slate-500 mt-0.5">{sublabel}</p>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ── ReadOnly Banner
// ---------------------------------------------------------------------------
function ReadOnlyBanner() {
  return (
    <div className="flex items-center gap-3 px-5 py-4 rounded-xl"
      style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)' }}>
      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}>
        <Lock className="w-4 h-4 text-amber-400" />
      </div>
      <div>
        <p className="text-sm font-bold text-amber-300">View-only mode</p>
        <p className="text-xs text-slate-400 mt-0.5">
          You have the <span className="text-amber-400 font-semibold">User</span> role.
          Contact an admin to be upgraded to <span className="text-emerald-400 font-semibold">Gardener</span>.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ── Firebase valve helper
// ---------------------------------------------------------------------------
function setValve(open: boolean) {
  const db = getDatabase();
  dbSet(ref(db, 'controls/irrigationValve'), open);
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export default function SettingsPage() {
  const router = useRouter();
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const isDark = mounted ? resolvedTheme !== 'light' : true;

  const { role, loading: roleLoading } = useRole();
  const isReadOnly = !roleLoading && role === 'user';
  const isAdmin    = !roleLoading && role === 'admin';

  const [esp32Status, setEsp32Status] = useState<ESP32StatusResult>({ status: 'no_connection', lastSync: 'Connecting...' });
  useEffect(() => { const u = subscribeToESP32Status(setEsp32Status); return () => u(); }, []);

  const [settings, setSettings] = useState<FarmSettings>({
    irrigationActive:  false, irrigationMode:    'auto',
    autoSubMode:       'moisture',
    wateringDuration:  20,    wateringFrequency: 12,
    scheduledTime:     '06:30',
    moistureMin: 35, moistureMax: 70,
    tempMin: 15, tempMax: 32,
    phMin: 5.8, phMax: 7.2,
    alertLevel: 'all', pushEnabled: true, smsEnabled: false, soundEnabled: true,
    syncInterval: 30, dataRetention: 90,
  });

  const [aiTips,        setAiTips]        = useState<AITip[]>([]);
  const [aiOptTime,     setAiOptTime]     = useState('');
  const [aiWeeklyEst,   setAiWeeklyEst]   = useState(0);
  const [aiLoading,     setAiLoading]     = useState(false);
  const [aiError,       setAiError]       = useState('');
  const [aiTipsSource,  setAiTipsSource]  = useState<'cache' | 'fresh' | null>(null);
  const [aiTipsSavedAt, setAiTipsSavedAt] = useState<string | null>(null);

  const [wateringOn,     setWateringOn]     = useState(false);
  const [waterTimer,     setWaterTimer]     = useState(0);
  const [valveConfirmed, setValveConfirmed] = useState<boolean | null>(null);
  const [saved,          setSaved]          = useState(false);

  useEffect(() => {
    const cached = loadCachedTips();
    if (cached) {
      setAiTips(cached.tips); setAiOptTime(cached.optimalTime); setAiWeeklyEst(cached.weeklyEstimate);
      setAiTipsSource('cache');
      try { setAiTipsSavedAt(new Date(cached.savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })); } catch {}
    } else { fetchAITips(); }
  }, []); // eslint-disable-line

  useEffect(() => {
    const db = getDatabase();
    onValue(ref(db, 'controls/irrigationConfig'), snap => {
      if (!snap.exists()) return;
      const c = snap.val();
      setSettings(s => ({ ...s, irrigationMode: c.mode ?? s.irrigationMode, irrigationActive: c.active ?? s.irrigationActive, wateringDuration: c.wateringDuration ?? s.wateringDuration, wateringFrequency: c.wateringFrequency ?? s.wateringFrequency, scheduledTime: c.scheduledTime ?? s.scheduledTime, autoSubMode: c.autoSubMode ?? s.autoSubMode }));
    }, { onlyOnce: true });
  }, []);

  useEffect(() => {
    const db = getDatabase();
    const u = onValue(ref(db, 'controls/valveConfirmed'), snap => { if (snap.exists()) setValveConfirmed(snap.val() as boolean); });
    return () => u();
  }, []);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (wateringOn) {
      setValve(true); setWaterTimer(settings.wateringDuration * 60);
      timerRef.current = setInterval(() => {
        setWaterTimer(t => { if (t <= 1) { setWateringOn(false); clearInterval(timerRef.current!); return 0; } return t - 1; });
      }, 1000);
    } else { setValve(false); clearInterval(timerRef.current!); setWaterTimer(0); }
    return () => clearInterval(timerRef.current!);
  }, [wateringOn]);

  const scheduledRunning = useRef(false);
  useEffect(() => {
    if (settings.irrigationMode !== 'scheduled' || !settings.irrigationActive || isReadOnly) return;
    const check = () => {
      if (scheduledRunning.current) return;
      const now = new Date();
      const hhmm = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`;
      if (hhmm === settings.scheduledTime) { scheduledRunning.current = true; setValve(true); setTimeout(() => { setValve(false); scheduledRunning.current = false; }, settings.wateringDuration * 60 * 1000); }
    };
    check(); const interval = setInterval(check, 60000); return () => clearInterval(interval);
  }, [settings.irrigationMode, settings.irrigationActive, settings.scheduledTime, settings.wateringDuration, isReadOnly]);

  const autoRunning = useRef(false);
  const runAutoCheck = useCallback(() => {
    // Only run cycle sub-mode via the timed check; moisture sub-mode is triggered by live sensor data elsewhere
    if (settings.irrigationMode !== 'auto' || settings.autoSubMode !== 'cycle' || !settings.irrigationActive || isReadOnly) return;
    if (autoRunning.current) return;
    const db = getDatabase();
    onValue(ref(db, 'controls/lastAutoWater'), snap => {
      const lastWatered = snap.exists() ? snap.val() as number : 0;
      if (Date.now() - lastWatered >= settings.wateringFrequency * 3600000) {
        autoRunning.current = true; setValve(true); dbSet(ref(db, 'controls/lastAutoWater'), Date.now());
        setTimeout(() => { setValve(false); autoRunning.current = false; }, settings.wateringDuration * 60 * 1000);
      }
    }, { onlyOnce: true });
  }, [settings.irrigationMode, settings.autoSubMode, settings.irrigationActive, settings.wateringFrequency, settings.wateringDuration, isReadOnly]);

  useEffect(() => {
    runAutoCheck(); const interval = setInterval(runAutoCheck, 60000); return () => clearInterval(interval);
  }, [runAutoCheck]);

  const fetchAITips = useCallback(async () => {
    setAiLoading(true); setAiError('');
    try {
      const sys = `You are an expert agronomist AI. Reply ONLY with valid JSON, no prose, no markdown.
Schema: { "tips": [{ "type": "info"|"warning"|"success", "text": "<max 20 words>" }], "optimalWateringTime": "<HH:MM>", "weeklyWaterEstimate": <integer> }`;
      const prompt = `Farm: Roma VF Tomatoes, Kenya highlands. Mode=${settings.irrigationMode}, duration=${settings.wateringDuration}min, every ${settings.wateringFrequency}h. Moisture: ${settings.moistureMin}–${settings.moistureMax}%. Give up to 4 irrigation tips.`;
      const raw = await callGroq(prompt, sys);
      const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
      const tips = parsed.tips ?? []; const optimalTime = parsed.optimalWateringTime ?? ''; const weeklyEstimate = parsed.weeklyWaterEstimate ?? 0;
      const cache: AITipsCache = { tips, optimalTime, weeklyEstimate, savedAt: new Date().toISOString() };
      saveCachedTips(cache); setAiTips(tips); setAiOptTime(optimalTime); setAiWeeklyEst(weeklyEstimate);
      setAiTipsSource('fresh'); setAiTipsSavedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    } catch (e) { setAiError((e as Error).message); } finally { setAiLoading(false); }
  }, [settings]);

  const syncIrrigationConfig = (updated: FarmSettings) => {
    const db = getDatabase();
    dbSet(ref(db, 'controls/irrigationConfig'), { mode: updated.irrigationMode, active: updated.irrigationActive, wateringDuration: updated.wateringDuration, wateringFrequency: updated.wateringFrequency, scheduledTime: updated.scheduledTime, autoSubMode: updated.autoSubMode, updatedAt: Date.now() });
  };

  const irrigationKeys: (keyof FarmSettings)[] = ['irrigationMode','irrigationActive','wateringDuration','wateringFrequency','scheduledTime','autoSubMode'];
  const set = <K extends keyof FarmSettings>(key: K, val: FarmSettings[K]) => {
    if (isReadOnly) return;
    setSettings(s => { const updated = { ...s, [key]: val }; if (irrigationKeys.includes(key)) syncIrrigationConfig(updated); return updated; });
  };

  const handleSave = () => {
    if (isReadOnly) return;
    setSaved(true); setTimeout(() => setSaved(false), 2500);
    if (typeof window !== 'undefined') localStorage.setItem('farmSettings', JSON.stringify(settings));
  };
  const handleReset = () => {
    if (isReadOnly) return;
    if (confirm('Reset all settings to factory defaults?')) { localStorage.removeItem('farmSettings'); localStorage.removeItem(AI_TIPS_CACHE_KEY); window.location.reload(); }
  };

  const tipStyle: Record<string, string> = {
    info:    'bg-sky-500/10 border-sky-500/20 text-sky-300',
    warning: 'bg-amber-500/10 border-amber-500/20 text-amber-300',
    success: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300',
  };
  const tipIcon = { info: Info, warning: AlertTriangle, success: CheckCircle };
  const aiSubtitle = aiTipsSource === 'cache' && aiTipsSavedAt ? `Cached · ${aiTipsSavedAt}` : aiTipsSource === 'fresh' && aiTipsSavedAt ? `Refreshed · ${aiTipsSavedAt}` : 'Personalized advice';

  const esp32Cfg = {
    online:        { label: 'Online',        dot: '#10b981', text: '#6ee7b7', Icon: CheckCircle },
    offline:       { label: 'Offline',       dot: '#f59e0b', text: '#fcd34d', Icon: WifiOff    },
    no_connection: { label: 'No Connection', dot: '#ef4444', text: '#fca5a5', Icon: WifiOff    },
  }[esp32Status.status];

  if (!mounted) return (
    <div className="min-h-screen" style={{ background: '#0f1824' }}>
      <div className="max-w-[1200px] mx-auto px-6 py-8 space-y-4">
        {[...Array(4)].map((_,i) => <div key={i} className="h-48 rounded-2xl animate-pulse" style={{ background: 'rgba(30,41,59,0.4)' }} />)}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen text-slate-100" style={{ background: '#0f1824', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,300&family=Space+Grotesk:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: #0f1824; }
        ::-webkit-scrollbar-thumb { background: #334155; border-radius: 4px; }
        .card { background: rgba(30,41,59,0.6); border: 1px solid rgba(71,85,105,0.35); backdrop-filter: blur(12px); }
        .card-glow:hover { box-shadow: 0 0 40px rgba(16,185,129,0.06); border-color: rgba(16,185,129,0.18); }
        .shimmer { background: linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.03) 50%, rgba(255,255,255,0) 100%); background-size: 200% 100%; animation: shimmerAnim 2s infinite; }
        @keyframes shimmerAnim { from { background-position: -200% 0; } to { background-position: 200% 0; } }
        @keyframes shimmerSlide { 0% { transform: translateX(-100%); } 100% { transform: translateX(400%); } }
        input[type='range'] { -webkit-appearance: none; appearance: none; }
        input[type='range']::-webkit-slider-thumb { -webkit-appearance: none; width: 14px; height: 14px; border-radius: 50%; cursor: pointer; }
        .section-title { font-family: 'Space Grotesk', sans-serif; }
        .stat-number { font-family: 'Space Grotesk', monospace; }
      `}</style>

      {/* Ambient blobs — identical to dashboard */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.04) 0%, transparent 70%)' }} />
        <div className="absolute top-1/2 -left-40 w-[400px] h-[400px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.03) 0%, transparent 70%)' }} />
        <div className="absolute -bottom-40 right-1/3 w-[500px] h-[500px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(168,85,247,0.02) 0%, transparent 70%)' }} />
      </div>

      {/* ── HEADER — matches dashboard ── */}
      <header className="relative z-40 sticky top-0 h-16 border-b flex items-center justify-between px-4 md:px-6 gap-4"
        style={{ background: 'rgba(15,24,36,0.85)', backdropFilter: 'blur(20px)', borderColor: 'rgba(71,85,105,0.3)' }}>

        <button type="button" onClick={() => document.dispatchEvent(new CustomEvent('toggleMobileMenu'))}
          className="lg:hidden p-2 rounded-lg hover:bg-slate-800 text-slate-400 transition-colors flex-shrink-0">
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Leaf className="w-3.5 h-3.5 text-emerald-500" />
          <span>Dashboard</span>
          <ChevronRight className="w-3 h-3" />
          <span className="text-emerald-400 font-semibold section-title">Settings</span>
        </div>

        <div className="flex items-center gap-2 ml-auto flex-wrap">
          {isAdmin && (
            <button onClick={() => router.push('/admin')}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:brightness-110 border"
              style={{ background: 'rgba(168,85,247,0.08)', borderColor: 'rgba(168,85,247,0.25)', color: '#d8b4fe' }}>
              <ShieldCheck className="w-4 h-4" />
              <span className="hidden sm:inline">Manage Users</span>
            </button>
          )}
          <button onClick={handleReset} disabled={isReadOnly}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-40 hover:bg-slate-800 border"
            style={{ background: 'rgba(30,41,59,0.6)', borderColor: 'rgba(71,85,105,0.35)', color: '#94a3b8' }}>
            <RotateCcw className="w-4 h-4" />
            <span className="hidden sm:inline">Reset</span>
          </button>
          <button onClick={handleSave} disabled={isReadOnly}
            className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-40 hover:brightness-110"
            style={{
              background: saved ? 'linear-gradient(135deg, #059669, #047857)' : 'linear-gradient(135deg, #10b981, #059669)',
              boxShadow: saved || isReadOnly ? 'none' : '0 4px 16px rgba(16,185,129,0.2)',
            }}>
            {saved ? <><CheckCircle className="w-4 h-4" /> Saved!</> : <><Save className="w-4 h-4" /> Save Changes</>}
          </button>
        </div>
      </header>

      {/* ── MAIN CONTENT ── */}
      <div className="relative z-10 max-w-[1200px] mx-auto px-4 md:px-6 space-y-5 pb-12">

        {/* Page heading */}
        <div className="pt-6 pb-2">
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              FARM CONFIGURATION
            </span>
          </div>
          <h1 className="section-title text-3xl md:text-4xl font-bold text-slate-100 mb-1">Farm Settings</h1>
          <p className="text-slate-400 text-sm">Configure irrigation, alerts, and system preferences</p>
        </div>

        {isReadOnly && <ReadOnlyBanner />}

        {/* ── MAIN GRID ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* LEFT (2-col) */}
          <div className="lg:col-span-2 space-y-5">

            {/* ── IRRIGATION CONTROL */}
            <SettingCard icon={Droplets} title="Irrigation Control"
              subtitle="Valve override, automation modes & timing" accent="#38bdf8"
              badge={
                <div className="flex items-center gap-2">
                  {valveConfirmed !== null && (
                    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold stat-number border"
                      style={{ background: valveConfirmed ? 'rgba(56,189,248,0.1)' : 'rgba(30,41,59,0.6)', borderColor: valveConfirmed ? 'rgba(56,189,248,0.25)' : 'rgba(71,85,105,0.35)', color: valveConfirmed ? '#7dd3fc' : '#64748b' }}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: valveConfirmed ? '#38bdf8' : '#475569', boxShadow: valveConfirmed ? '0 0 6px #38bdf8' : 'none' }} />
                      {valveConfirmed ? 'OPEN' : 'CLOSED'}
                    </span>
                  )}
                  <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border"
                    style={{ background: wateringOn ? 'rgba(56,189,248,0.1)' : settings.irrigationActive ? 'rgba(16,185,129,0.1)' : 'rgba(30,41,59,0.6)', borderColor: wateringOn ? 'rgba(56,189,248,0.25)' : settings.irrigationActive ? 'rgba(16,185,129,0.25)' : 'rgba(71,85,105,0.35)', color: wateringOn ? '#7dd3fc' : settings.irrigationActive ? '#6ee7b7' : '#64748b' }}>
                    {wateringOn ? '💧 Running' : settings.irrigationActive ? '✅ Armed' : '⏸ Idle'}
                  </span>
                </div>
              }>

              {/* ── Valve animation: shown for ALL modes ── */}
              <PipelineValvePanel
                isOpen={wateringOn}
                isRunning={wateringOn}
                timer={waterTimer}
                duration={settings.wateringDuration}
              />

              {/* ── Mode selector ── */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Irrigation Mode</p>
                <div className="grid grid-cols-3 gap-2">
                  {(['manual', 'auto', 'scheduled'] as IrrigationMode[]).map(mode => (
                    <button key={mode} onClick={() => !isReadOnly && set('irrigationMode', mode)} disabled={isReadOnly}
                      className="py-2.5 px-3 rounded-xl text-xs font-bold capitalize transition-all disabled:cursor-not-allowed"
                      style={{
                        background: settings.irrigationMode === mode ? 'rgba(2,132,199,0.15)' : 'rgba(15,24,36,0.6)',
                        border: `1px solid ${settings.irrigationMode === mode ? '#0ea5e9' : 'rgba(71,85,105,0.35)'}`,
                        color: settings.irrigationMode === mode ? '#7dd3fc' : '#64748b',
                        opacity: isReadOnly ? 0.5 : 1,
                      }}>
                      {mode === 'manual' ? '🖐 Manual' : mode === 'auto' ? '⚡ Auto' : '🕐 Scheduled'}
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Open/Close toggle: only shown in manual mode, after mode selector ── */}
              {settings.irrigationMode === 'manual' && (
                <SettingRow label="Open Valve — Start Irrigation" sublabel={wateringOn ? 'Valve is open · water flowing' : 'Valve is closed · no flow'}>
                  <Toggle checked={wateringOn} onChange={v => !isReadOnly && setWateringOn(v)} color="#38bdf8" readOnly={isReadOnly} />
                </SettingRow>
              )}

              {/* ── AUTO sub-options ── */}
              {settings.irrigationMode === 'auto' && (
                <div className="rounded-xl overflow-hidden"
                  style={{ border: '1px solid rgba(56,189,248,0.15)', background: 'rgba(8,47,73,0.25)' }}>
                  <div className="px-4 pt-3 pb-2">
                    <p className="text-xs font-semibold text-sky-400 uppercase tracking-widest mb-3">Auto Mode — select one</p>

                    {/* Option 1: Moisture-triggered */}
                    <button
                      onClick={() => !isReadOnly && set('autoSubMode', 'moisture')}
                      disabled={isReadOnly}
                      className="w-full mb-2 flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all disabled:cursor-not-allowed"
                      style={{
                        background: settings.autoSubMode === 'moisture' ? 'rgba(56,189,248,0.1)' : 'rgba(15,24,36,0.5)',
                        border: `1px solid ${settings.autoSubMode === 'moisture' ? 'rgba(56,189,248,0.35)' : 'rgba(71,85,105,0.25)'}`,
                        opacity: isReadOnly ? 0.5 : 1,
                      }}>
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: settings.autoSubMode === 'moisture' ? 'rgba(56,189,248,0.15)' : 'rgba(30,41,59,0.6)', border: `1px solid ${settings.autoSubMode === 'moisture' ? 'rgba(56,189,248,0.3)' : 'rgba(71,85,105,0.3)'}` }}>
                        <Droplets className="w-4 h-4" style={{ color: settings.autoSubMode === 'moisture' ? '#38bdf8' : '#475569' }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold" style={{ color: settings.autoSubMode === 'moisture' ? '#e2e8f0' : '#64748b' }}>
                          Auto-Irrigation System
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: settings.autoSubMode === 'moisture' ? '#7dd3fc' : '#475569' }}>
                          Opens valve automatically when live soil moisture is very low
                        </p>
                      </div>
                      <div className="w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center"
                        style={{ borderColor: settings.autoSubMode === 'moisture' ? '#38bdf8' : '#334155' }}>
                        {settings.autoSubMode === 'moisture' && (
                          <div className="w-2 h-2 rounded-full" style={{ background: '#38bdf8' }} />
                        )}
                      </div>
                    </button>

                    {/* Option 2: Cycle-based */}
                    <button
                      onClick={() => !isReadOnly && set('autoSubMode', 'cycle')}
                      disabled={isReadOnly}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all disabled:cursor-not-allowed"
                      style={{
                        background: settings.autoSubMode === 'cycle' ? 'rgba(56,189,248,0.1)' : 'rgba(15,24,36,0.5)',
                        border: `1px solid ${settings.autoSubMode === 'cycle' ? 'rgba(56,189,248,0.35)' : 'rgba(71,85,105,0.25)'}`,
                        opacity: isReadOnly ? 0.5 : 1,
                      }}>
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: settings.autoSubMode === 'cycle' ? 'rgba(56,189,248,0.15)' : 'rgba(30,41,59,0.6)', border: `1px solid ${settings.autoSubMode === 'cycle' ? 'rgba(56,189,248,0.3)' : 'rgba(71,85,105,0.3)'}` }}>
                        <RefreshCw className="w-4 h-4" style={{ color: settings.autoSubMode === 'cycle' ? '#38bdf8' : '#475569' }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold" style={{ color: settings.autoSubMode === 'cycle' ? '#e2e8f0' : '#64748b' }}>
                          Auto-cycle Frequency
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: settings.autoSubMode === 'cycle' ? '#7dd3fc' : '#475569' }}>
                          Waters on a fixed time interval regardless of soil moisture
                        </p>
                      </div>
                      <div className="w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center"
                        style={{ borderColor: settings.autoSubMode === 'cycle' ? '#38bdf8' : '#334155' }}>
                        {settings.autoSubMode === 'cycle' && (
                          <div className="w-2 h-2 rounded-full" style={{ background: '#38bdf8' }} />
                        )}
                      </div>
                    </button>
                  </div>

                  {/* Sub-mode specific controls */}
                  {settings.autoSubMode === 'cycle' && (
                    <div className="px-4 pb-4 pt-1">
                      <SliderRow label="Auto-cycle Frequency" value={settings.wateringFrequency} min={2} max={48} step={2} unit=" hrs" onChange={v => set('wateringFrequency', v)} color="#38bdf8" readOnly={isReadOnly} />
                    </div>
                  )}

                  {settings.autoSubMode === 'moisture' && (
                    <div className="px-4 pb-4 pt-1">
                      <p className="text-xs text-slate-500 flex items-center gap-1.5">
                        <Info className="w-3 h-3 flex-shrink-0" />
                        Valve opens when live soil moisture drops below the <span className="text-sky-400 font-semibold">Min Moisture</span> threshold set below.
                      </p>
                    </div>
                  )}
                </div>
              )}

              <SliderRow label="Watering Duration" value={settings.wateringDuration} min={5} max={60} step={5} unit=" min" onChange={v => set('wateringDuration', v)} color="#38bdf8" readOnly={isReadOnly} />

              {settings.irrigationMode === 'scheduled' && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Scheduled Time</p>
                  <input type="time" value={settings.scheduledTime}
                    onChange={e => !isReadOnly && set('scheduledTime', e.target.value)} disabled={isReadOnly}
                    className="stat-number px-4 py-2.5 rounded-xl text-sm outline-none disabled:opacity-40"
                    style={{ background: 'rgba(15,24,36,0.8)', border: '1px solid rgba(71,85,105,0.35)', color: '#e2e8f0' }} />
                  {aiOptTime && (
                    <p className="text-xs text-emerald-400 flex items-center gap-1.5">
                      <Brain className="w-3 h-3" /> AI recommends: <strong className="stat-number">{aiOptTime}</strong>
                    </p>
                  )}
                </div>
              )}
            </SettingCard>

            {/* ── SENSOR THRESHOLDS */}
            <SettingCard icon={Sliders} title="Sensor Thresholds" subtitle="Alert and automation trigger boundaries" accent="#a78bfa">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
                <SliderRow label="Min Moisture" value={settings.moistureMin} min={10} max={50} unit="%" onChange={v => set('moistureMin', v)} color="#a78bfa" readOnly={isReadOnly} />
                <SliderRow label="Max Moisture" value={settings.moistureMax} min={50} max={95} unit="%" onChange={v => set('moistureMax', v)} color="#a78bfa" readOnly={isReadOnly} />
                <SliderRow label="Min Temperature" value={settings.tempMin} min={5} max={20} unit="°C" onChange={v => set('tempMin', v)} color="#f59e0b" readOnly={isReadOnly} />
                <SliderRow label="Max Temperature" value={settings.tempMax} min={25} max={45} unit="°C" onChange={v => set('tempMax', v)} color="#f59e0b" readOnly={isReadOnly} />
                <SliderRow label="Min pH" value={settings.phMin} min={4} max={7} step={0.1} unit="" onChange={v => set('phMin', v)} color="#34d399" readOnly={isReadOnly} />
                <SliderRow label="Max pH" value={settings.phMax} min={7} max={9} step={0.1} unit="" onChange={v => set('phMax', v)} color="#34d399" readOnly={isReadOnly} />
              </div>
            </SettingCard>

            {/* ── NOTIFICATIONS */}
            <SettingCard icon={Bell} title="Alerts & Notifications" subtitle="Control how and when you receive farm alerts" accent="#f59e0b">
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Alert Level</p>
                <div className="flex gap-2 flex-wrap">
                  {(['all', 'critical', 'none'] as AlertLevel[]).map(level => (
                    <button key={level} onClick={() => setSettings(s => ({ ...s, alertLevel: level }))}
                      className="px-4 py-2 rounded-xl text-xs font-bold transition-all border"
                      style={{
                        background: settings.alertLevel === level ? 'rgba(217,119,6,0.12)' : 'rgba(15,24,36,0.6)',
                        borderColor: settings.alertLevel === level ? '#f59e0b' : 'rgba(71,85,105,0.35)',
                        color: settings.alertLevel === level ? '#fbbf24' : '#64748b',
                      }}>
                      {level === 'all' ? '🔔 All' : level === 'critical' ? '🚨 Critical' : '🔇 Muted'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-3 pt-1">
                <SettingRow label="Push Notifications" sublabel="Browser & mobile push">
                  <Toggle checked={settings.pushEnabled} onChange={v => setSettings(s => ({ ...s, pushEnabled: v }))} color="#f59e0b" />
                </SettingRow>
                <SettingRow label="SMS Alerts" sublabel="Sent to registered phone (+254…)">
                  <Toggle checked={settings.smsEnabled} onChange={v => setSettings(s => ({ ...s, smsEnabled: v }))} color="#f59e0b" />
                </SettingRow>
                <SettingRow label="Sound Alerts" sublabel="In-app audio notifications">
                  <div className="flex items-center gap-2">
                    {settings.soundEnabled ? <Volume2 className="w-4 h-4 text-amber-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
                    <Toggle checked={settings.soundEnabled} onChange={v => setSettings(s => ({ ...s, soundEnabled: v }))} color="#f59e0b" />
                  </div>
                </SettingRow>
              </div>
            </SettingCard>

            {/* ── SYSTEM */}
            <SettingCard icon={Database} title="System & Connectivity" subtitle="Sync intervals, storage and data retention" accent="#10b981"
              badge={
                !isAdmin && (
                  <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border"
                    style={{ background: 'rgba(168,85,247,0.08)', borderColor: 'rgba(168,85,247,0.2)', color: '#d8b4fe' }}>
                    <Shield className="w-3 h-3" /> Admin
                  </span>
                )
              }>
              <SliderRow label="Data Sync Interval" value={settings.syncInterval} min={10} max={300} step={10} unit="s" onChange={v => set('syncInterval', v)} color="#10b981" readOnly={!isAdmin} />
              <SliderRow label="Data Retention" value={settings.dataRetention} min={7} max={365} step={7} unit=" days" onChange={v => set('dataRetention', v)} color="#10b981" readOnly={!isAdmin} />
            </SettingCard>
          </div>

          {/* ── RIGHT COLUMN ── */}
          <div className="space-y-5">

            {/* ── FIELD IRRIGATION VIEW */}
            <div className="card card-glow rounded-2xl overflow-hidden transition-all duration-800"
              style={{
                borderColor: wateringOn ? 'rgba(56,189,248,0.28)' : 'rgba(71,85,105,0.35)',
                transition: 'all 0.8s ease',
              }}>
              <div className="h-0.5 w-full" style={{ background: wateringOn ? 'linear-gradient(90deg, #38bdf8, #38bdf830, transparent)' : 'linear-gradient(90deg, rgba(71,85,105,0.5), transparent)' }} />
              <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: wateringOn ? 'rgba(56,189,248,0.15)' : 'rgba(71,85,105,0.25)' }}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: wateringOn ? 'rgba(56,189,248,0.12)' : 'rgba(30,41,59,0.6)', border: `1px solid ${wateringOn ? 'rgba(56,189,248,0.25)' : 'rgba(71,85,105,0.35)'}` }}>
                    <Droplets className="w-4 h-4" style={{ color: wateringOn ? '#38bdf8' : '#475569' }} />
                  </div>
                  <div>
                    <h3 className="section-title font-semibold text-sm text-slate-200">Field Irrigation View</h3>
                    <p className="text-[11px] mt-0.5" style={{ color: wateringOn ? '#7dd3fc' : '#475569' }}>
                      {wateringOn ? 'Sprinklers active · water flowing' : 'System idle · valve closed'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold stat-number border"
                  style={{ background: wateringOn ? 'rgba(56,189,248,0.1)' : 'rgba(30,41,59,0.6)', borderColor: wateringOn ? 'rgba(56,189,248,0.25)' : 'rgba(71,85,105,0.35)', color: wateringOn ? '#7dd3fc' : '#475569' }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: wateringOn ? '#38bdf8' : '#475569', boxShadow: wateringOn ? '0 0 6px #38bdf8' : 'none', animation: wateringOn ? 'pulse 1.5s infinite' : 'none' }} />
                  {wateringOn ? 'LIVE' : 'IDLE'}
                </div>
              </div>

              <div className="px-4 pt-4 pb-5">
                <svg viewBox="0 0 300 220" className="w-full" style={{ height: 210 }}>
                  <defs>
                    <linearGradient id="skyGrad2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={wateringOn ? '#0c2d4a' : '#0f1824'} />
                      <stop offset="100%" stopColor={wateringOn ? '#0a3d2e' : '#131e2c'} />
                    </linearGradient>
                    <linearGradient id="groundGrad2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={wateringOn ? '#14532d' : '#1c3a28'} />
                      <stop offset="100%" stopColor={wateringOn ? '#166534' : '#14532d'} />
                    </linearGradient>
                    <linearGradient id="dropGrad2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#7dd3fc" stopOpacity="0.9" /><stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.6" />
                    </linearGradient>
                    <linearGradient id="leafGrad3" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#22c55e" /><stop offset="100%" stopColor="#16a34a" />
                    </linearGradient>
                    <linearGradient id="leafGrad4" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#4ade80" /><stop offset="100%" stopColor="#15803d" />
                    </linearGradient>
                  </defs>
                  <rect width="300" height="220" fill="url(#skyGrad2)" />
                  <rect x="0" y="165" width="300" height="55" fill="url(#groundGrad2)" />
                  <rect x="0" y="165" width="300" height="3" fill={wateringOn ? '#4ade80' : '#1e4d35'} opacity="0.6" />
                  {[52, 105, 200, 258].map((x, pi) => (
                    <g key={pi}>
                      <line x1={x} y1="167" x2={x} y2={x === 105 ? 115 : x === 200 ? 125 : x === 258 ? 140 : 130}
                        stroke={wateringOn ? '#16a34a' : '#14532d'} strokeWidth="3" strokeLinecap="round" />
                      <ellipse cx={x} cy={x === 105 ? 122 : x === 200 ? 130 : x === 258 ? 144 : 138}
                        rx={x === 200 ? 20 : 18} ry={x === 200 ? 11 : 10}
                        fill="url(#leafGrad3)" opacity={wateringOn ? 1 : 0.5} />
                      <ellipse cx={x} cy={x === 105 ? 122 : x === 200 ? 130 : x === 258 ? 144 : 138}
                        rx={x === 200 ? 16 : 14} ry={x === 200 ? 9 : 8}
                        fill="url(#leafGrad4)" transform={`rotate(-15 ${x} ${x === 200 ? 130 : 138})`} opacity={wateringOn ? 0.9 : 0.4} />
                    </g>
                  ))}
                  <rect x="147" y="148" width="6" height="20" rx="2" fill={wateringOn ? '#0369a1' : '#1e293b'} />
                  <rect x="140" y="165" width="20" height="5" rx="2" fill={wateringOn ? '#0284c7' : '#263548'} />
                  <rect x="144" y="138" width="12" height="12" rx="3" fill={wateringOn ? '#0ea5e9' : '#1e293b'}
                    style={{ filter: wateringOn ? 'drop-shadow(0 0 5px rgba(56,189,248,0.5))' : 'none' }} />
                  <circle cx="150" cy="135" r="2.5" fill={wateringOn ? '#7dd3fc' : '#334155'}
                    style={{ animation: wateringOn ? 'pulse 1s infinite' : 'none' }} />
                  {wateringOn && <>
                    <path d="M 150 135 Q 100 80 55 155" fill="none" stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="4,3" opacity="0.45">
                      <animate attributeName="stroke-dashoffset" from="0" to="-56" dur="1.2s" repeatCount="indefinite" />
                    </path>
                    <path d="M 150 135 Q 205 80 252 155" fill="none" stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="4,3" opacity="0.45">
                      <animate attributeName="stroke-dashoffset" from="0" to="-56" dur="1.2s" begin="0.1s" repeatCount="indefinite" />
                    </path>
                    {[
                      { cx: 75, startY: 110, endY: 167, dur: '1.1s', begin: '0s' },
                      { cx: 58, startY: 130, endY: 167, dur: '0.9s', begin: '0.3s' },
                      { cx: 228, startY: 110, endY: 167, dur: '1.1s', begin: '0.1s' },
                      { cx: 245, startY: 130, endY: 167, dur: '0.9s', begin: '0.4s' },
                    ].map((d, i) => (
                      <ellipse key={i} cx={d.cx} cy={d.startY} rx="1.5" ry="3" fill="url(#dropGrad2)">
                        <animate attributeName="cy" values={`${d.startY};${d.endY}`} dur={d.dur} begin={d.begin} repeatCount="indefinite" />
                        <animate attributeName="opacity" values="0.9;0.2" dur={d.dur} begin={d.begin} repeatCount="indefinite" />
                      </ellipse>
                    ))}
                  </>}
                  {[30,70,120,170,220,270].map((x,i) => (
                    <line key={i} x1={x} y1="165" x2={x} y2={wateringOn ? 153 : 157} stroke={wateringOn ? '#22c55e' : '#166534'} strokeWidth="2" strokeLinecap="round" />
                  ))}
                  <text x="150" y="210" textAnchor="middle" fontSize="8.5" fontFamily="'Space Grotesk', monospace"
                    fill={wateringOn ? '#38bdf8' : '#1e293b'} fontWeight="700" letterSpacing="0.5">
                    {wateringOn ? '— SPRINKLER ACTIVE —' : '— SYSTEM IDLE —'}
                  </text>
                </svg>

                <div className="flex items-center justify-between mt-1 px-1">
                  <div className="flex items-center gap-1.5 text-xs" style={{ color: wateringOn ? '#7dd3fc' : '#475569' }}>
                    <Droplets className="w-3.5 h-3.5" />
                    <span>{wateringOn ? 'Water flowing to all plots' : 'No water flow detected'}</span>
                  </div>
                  {wateringOn && waterTimer > 0 && (
                    <span className="stat-number text-xs font-bold px-2.5 py-1 rounded-lg border"
                      style={{ background: 'rgba(56,189,248,0.1)', color: '#38bdf8', borderColor: 'rgba(56,189,248,0.2)' }}>
                      {Math.floor(waterTimer/60).toString().padStart(2,'0')}:{(waterTimer%60).toString().padStart(2,'0')}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* ── DISPLAY & THEME */}
            <SettingCard icon={Sun} title="Display & Theme" subtitle="Visual appearance" accent="#fbbf24">
              <div className="relative rounded-xl overflow-hidden p-4 transition-all duration-500"
                style={{
                  background: isDark ? 'linear-gradient(135deg, rgba(15,24,36,0.8), rgba(30,41,59,0.6))' : 'linear-gradient(135deg, #fef9c3, #e0f2fe)',
                  border: `1px solid ${isDark ? 'rgba(71,85,105,0.35)' : 'rgba(251,191,36,0.4)'}`,
                }}>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                      style={{ background: isDark ? 'rgba(30,41,59,0.8)' : '#fef3c7', border: `1px solid ${isDark ? 'rgba(71,85,105,0.35)' : 'rgba(251,191,36,0.3)'}` }}>
                      {isDark ? <Moon className="w-4 h-4 text-blue-300" /> : <Sun className="w-4 h-4 text-amber-500" />}
                    </div>
                    <div>
                      <p className="section-title font-bold text-sm" style={{ color: isDark ? '#e2e8f0' : '#1e293b' }}>{isDark ? 'Dark Mode' : 'Light Mode'}</p>
                      <p className="text-xs mt-0.5" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>System-wide</p>
                    </div>
                  </div>
                  <Toggle checked={!isDark} onChange={v => setTheme(v ? 'light' : 'dark')} size="lg" color={isDark ? '#60a5fa' : '#f59e0b'} />
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Presets</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Forest', from: '#052e16', to: '#166534', accent: '#10b981' },
                    { label: 'Ocean',  from: '#0c1a2e', to: '#0c4a6e', accent: '#38bdf8' },
                    { label: 'Desert', from: '#2d1b00', to: '#92400e', accent: '#f59e0b' },
                    { label: 'Slate',  from: '#0f1824', to: '#1e293b', accent: '#94a3b8' },
                  ].map(preset => (
                    <button key={preset.label}
                      className="relative overflow-hidden rounded-xl h-12 transition-all hover:scale-[1.03] active:scale-95 border border-transparent hover:border-white/10"
                      style={{ background: `linear-gradient(135deg, ${preset.from}, ${preset.to})` }}>
                      <span className="absolute bottom-1.5 left-2.5 text-[11px] font-bold text-white/60">{preset.label}</span>
                      <div className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full" style={{ background: preset.accent }} />
                    </button>
                  ))}
                </div>
              </div>
            </SettingCard>

            {/* ── AI IRRIGATION TIPS */}
            <SettingCard icon={Brain} title="AI Irrigation Tips" subtitle={aiSubtitle} accent="#a78bfa"
              badge={
                <button onClick={fetchAITips} disabled={aiLoading} title="Refresh tips"
                  className="p-2 rounded-xl text-slate-500 hover:bg-slate-700/40 hover:text-slate-200 transition-all disabled:opacity-40">
                  <RefreshCw className={cn('w-4 h-4', aiLoading && 'animate-spin')} />
                </button>
              }>
              {aiLoading ? (
                <div className="flex flex-col items-center justify-center py-8 gap-3">
                  <div className="w-8 h-8 border-2 border-violet-500/50 border-t-violet-400 rounded-full animate-spin" />
                  <p className="text-xs text-slate-400">Analysing irrigation data…</p>
                </div>
              ) : aiError ? (
                <div className="p-3 rounded-xl text-xs text-red-300 border"
                  style={{ background: 'rgba(239,68,68,0.07)', borderColor: 'rgba(239,68,68,0.2)' }}>
                  ⚠️ {aiError}
                </div>
              ) : aiTips.length > 0 ? (
                <div className="space-y-2">
                  {aiTips.map((tip, i) => {
                    const TipIcon = tipIcon[tip.type as keyof typeof tipIcon] ?? Info;
                    return (
                      <div key={i} className={cn('flex items-start gap-2.5 p-3 rounded-xl border text-xs leading-relaxed', tipStyle[tip.type] ?? 'bg-slate-700/30 border-slate-700 text-slate-300')}>
                        <TipIcon className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                        {tip.text}
                      </div>
                    );
                  })}
                  {aiWeeklyEst > 0 && (
                    <div className="flex items-center gap-2 p-3 rounded-xl border"
                      style={{ background: 'rgba(56,189,248,0.06)', borderColor: 'rgba(56,189,248,0.15)' }}>
                      <Gauge className="w-4 h-4 text-sky-400 flex-shrink-0" />
                      <p className="text-xs text-slate-400">Weekly estimate: <strong className="text-sky-300 stat-number">{aiWeeklyEst} L</strong></p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 gap-2 text-center">
                  <Brain className="w-8 h-8 text-slate-600" />
                  <p className="text-xs text-slate-500">Click <RefreshCw className="w-3 h-3 inline mx-0.5" /> to generate tips</p>
                </div>
              )}
            </SettingCard>

            {/* ── DEVICE INFO */}
            <SettingCard icon={Radio} title="Device Info" subtitle="ESP32 sensor node" accent="#34d399"
              badge={
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold stat-number border"
                  style={{ background: `${esp32Cfg.dot}12`, borderColor: `${esp32Cfg.dot}25`, color: esp32Cfg.text }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: esp32Cfg.dot, boxShadow: esp32Status.status === 'online' ? `0 0 6px ${esp32Cfg.dot}` : 'none', animation: esp32Status.status === 'online' ? 'pulse 2s infinite' : 'none' }} />
                  {esp32Cfg.label}
                </div>
              }>
              <div className="space-y-0">
                {[
                  { label: 'Device ID', value: 'ESP32-NODE-01', Icon: Smartphone },
                  { label: 'Firmware',  value: 'v2.4.1',        Icon: BatteryCharging },
                  { label: 'Location',  value: 'Plot A',         Icon: MapPin },
                  { label: 'Signal',    value: '-67 dBm',        Icon: Activity },
                  { label: 'Status',    value: esp32Cfg.label,   Icon: esp32Cfg.Icon },
                  { label: 'Last Seen', value: esp32Status.lastSync, Icon: CheckCircle },
                ].map((row, idx, arr) => (
                  <div key={row.label} className="flex items-center justify-between py-2.5"
                    style={{ borderBottom: idx < arr.length - 1 ? '1px solid rgba(71,85,105,0.15)' : 'none' }}>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <row.Icon className="w-3.5 h-3.5" />{row.label}
                    </div>
                    <span className="text-xs font-semibold stat-number"
                      style={{ color: row.label === 'Status' ? esp32Cfg.text : row.label === 'Last Seen' ? '#64748b' : '#e2e8f0' }}>
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>
            </SettingCard>
          </div>
        </div>

        {/* ── FOOTER ── */}
        <div className="flex items-center justify-between text-xs py-4 border-t" style={{ borderColor: 'rgba(71,85,105,0.2)' }}>
          <div className="flex items-center gap-1.5 text-slate-600">
            <Info className="w-3.5 h-3.5 flex-shrink-0" />
            {isReadOnly ? 'View-only — contact admin for Gardener access.' : 'Changes apply immediately. AI tips cached locally, refreshed on demand.'}
          </div>
          <span className="text-slate-700 stat-number">SmartFarm v1.0 · Kenya</span>
        </div>
      </div>
    </div>
  );
}