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
function PipelineValvePanel({ isOpen, isRunning, timer, duration }: {
  isOpen: boolean; isRunning: boolean; timer: number; duration: number;
}) {
  const progress = duration > 0 ? 1 - (timer / (duration * 60)) : 0;
  return (
    <div className="relative rounded-xl overflow-hidden p-4"
      style={{
        background: isOpen
          ? 'linear-gradient(135deg, #e0f7fa 0%, #f0fbff 50%, #e8f5eb 100%)'
          : '#f9f5ef',
        border: `1px solid ${isOpen ? 'rgba(8,145,178,0.3)' : 'rgba(160,130,90,0.18)'}`,
        transition: 'all 0.6s ease',
      }}>
      {isOpen && (
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at 50% 60%, rgba(8,145,178,0.06) 0%, transparent 70%)' }} />
      )}
      <div className="relative">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h4 style={{ fontWeight: 700, color: '#1c1a15', fontSize: 14, fontFamily: "'Space Grotesk', sans-serif" }}>Irrigation Valve</h4>
            <p style={{ fontSize: 12, marginTop: 2, color: isOpen ? '#0891b2' : '#b0a088', fontFamily: "'DM Sans', sans-serif" }}>
              {isOpen ? (timer > 0 ? `Running · ${Math.floor(timer/60).toString().padStart(2,'0')}:${(timer%60).toString().padStart(2,'0')} left` : 'Valve open') : 'Valve closed'}
            </p>
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px',
            borderRadius: 100, fontSize: 11, fontWeight: 700, fontFamily: "'DM Sans', sans-serif",
            background: isOpen ? '#cffafe' : '#f2ece0',
            border: `1px solid ${isOpen ? '#a5f3fc' : 'rgba(160,130,90,0.22)'}`,
            color: isOpen ? '#0e7490' : '#9a8870',
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: isOpen ? '#0891b2' : '#b0a088', boxShadow: isOpen ? '0 0 6px rgba(8,145,178,0.5)' : 'none', display: 'inline-block', animation: isOpen ? 'pls 1.5s infinite' : 'none' }} />
            {isOpen ? 'OPEN' : 'CLOSED'}
          </div>
        </div>

        <div className="relative flex items-center justify-center my-2">
          <svg viewBox="0 0 480 120" className="w-full" style={{ maxWidth: 480, height: 110 }}>
            <defs>
              <linearGradient id="pipeGradL" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#e2d5c3" /><stop offset="40%" stopColor="#d4c4a8" />
                <stop offset="60%" stopColor="#c8b896" /><stop offset="100%" stopColor="#b8a882" />
              </linearGradient>
              <linearGradient id="waterGradL" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.8" />
                <stop offset="50%" stopColor="#38bdf8" stopOpacity="1" />
                <stop offset="100%" stopColor="#7dd3fc" stopOpacity="0.6" />
              </linearGradient>
              <linearGradient id="valveGradL" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={isOpen ? '#0891b2' : '#c8b896'} />
                <stop offset="100%" stopColor={isOpen ? '#0e7490' : '#b8a882'} />
              </linearGradient>
              <clipPath id="leftPipeClipL"><rect x="20" y="46" width="148" height="28" rx="0" /></clipPath>
              <clipPath id="rightPipeClipL"><rect x="312" y="46" width="148" height="28" rx="0" /></clipPath>
              <clipPath id="valveBodyClipL"><rect x="196" y="36" width="88" height="48" rx="4" /></clipPath>
            </defs>
            <rect x="20" y="44" width="150" height="32" rx="6" fill="url(#pipeGradL)" />
            <rect x="20" y="48" width="150" height="24" rx="4" fill="#ede4d3" />
            {isOpen && (
              <g clipPath="url(#leftPipeClipL)">
                <rect x="20" y="49" width="148" height="22" fill="url(#waterGradL)" opacity="0.7" rx="3"><animate attributeName="opacity" values="0.6;0.85;0.6" dur="2s" repeatCount="indefinite" /></rect>
                <rect x="-100" y="49" width="60" height="22" rx="3" fill="rgba(255,255,255,0.3)"><animateTransform attributeName="transform" type="translate" from="-80 0" to="230 0" dur="1.4s" repeatCount="indefinite" /></rect>
              </g>
            )}
            <rect x="14" y="40" width="12" height="40" rx="4" fill="#d4c4a8" />
            <rect x="193" y="32" width="94" height="56" rx="8" fill={isOpen ? '#cffafe' : '#ede4d3'} stroke={isOpen ? '#0891b2' : '#c8b896'} strokeWidth="1.5" />
            <rect x="196" y="35" width="88" height="50" rx="6" fill="url(#valveGradL)" opacity="0.7" />
            <g transform={`translate(240, 60) rotate(${isOpen ? 90 : 0})`}>
              <ellipse cx="0" cy="0" rx={isOpen ? 4 : 11} ry="11" fill={isOpen ? 'rgba(8,145,178,0.2)' : '#ede4d3'} stroke={isOpen ? '#0891b2' : '#c8b896'} strokeWidth="1.5" />
              <line x1="0" y1="-11" x2="0" y2="11" stroke={isOpen ? '#0891b2' : '#b0a088'} strokeWidth="1.5" />
            </g>
            {isOpen && (
              <g clipPath="url(#valveBodyClipL)">
                <rect x="196" y="47" width="88" height="22" fill="url(#waterGradL)" opacity="0.6" rx="2"><animate attributeName="opacity" values="0.5;0.8;0.5" dur="1.5s" repeatCount="indefinite" /></rect>
              </g>
            )}
            <rect x="228" y="14" width="24" height="22" rx="4" fill={isOpen ? '#e0f7fa' : '#ede4d3'} stroke={isOpen ? '#0891b2' : '#c8b896'} strokeWidth="1" />
            <rect x="221" y="10" width="38" height="8" rx="3" fill={isOpen ? '#cffafe' : '#e2d5c3'} stroke={isOpen ? '#38bdf8' : '#c8b896'} strokeWidth="1" />
            <text x="240" y="76" textAnchor="middle" fontSize="8" fontWeight="700" fill={isOpen ? '#0891b2' : '#9a8870'} fontFamily="'Space Grotesk', monospace">{isOpen ? 'OPEN' : 'CLOSED'}</text>
            <rect x="310" y="44" width="150" height="32" rx="6" fill="url(#pipeGradL)" />
            <rect x="310" y="48" width="150" height="24" rx="4" fill="#ede4d3" />
            {isOpen && (
              <g clipPath="url(#rightPipeClipL)">
                <rect x="312" y="49" width="148" height="22" fill="url(#waterGradL)" opacity="0.7" rx="3"><animate attributeName="opacity" values="0.6;0.85;0.6" dur="2s" begin="0.2s" repeatCount="indefinite" /></rect>
                <rect x="200" y="49" width="60" height="22" rx="3" fill="rgba(255,255,255,0.3)"><animateTransform attributeName="transform" type="translate" from="110 0" to="460 0" dur="1.4s" begin="0.2s" repeatCount="indefinite" /></rect>
                {[0,1,2,3,4].map(i => (
                  <circle key={i} cx={450 + (i % 2) * 6} cy={52 + i * 4} r="2" fill="#38bdf8" opacity="0.5">
                    <animate attributeName="cy" values={`${52+i*4};${52+i*4+8}`} dur={`${0.8+i*0.15}s`} repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.7;0" dur={`${0.8+i*0.15}s`} repeatCount="indefinite" />
                  </circle>
                ))}
              </g>
            )}
            <rect x="456" y="40" width="12" height="40" rx="4" fill="#d4c4a8" />
            <text x="240" y="108" textAnchor="middle" fontSize="8" fill={isOpen ? '#0891b2' : '#c8b896'} fontFamily="'Space Grotesk', monospace" fontWeight="700">VALVE — {isOpen ? 'FLOW ACTIVE' : 'NO FLOW'}</text>
          </svg>
        </div>

        {isRunning && duration > 0 && (
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontFamily: "'DM Sans', sans-serif" }}>
              <span style={{ color: '#9a8870' }}>Cycle progress</span>
              <span style={{ color: '#0891b2', fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif" }}>{Math.round(progress * 100)}%</span>
            </div>
            <div style={{ height: 6, borderRadius: 100, overflow: 'hidden', background: '#ede4d3' }}>
              <div style={{ height: '100%', borderRadius: 100, width: `${progress * 100}%`, background: 'linear-gradient(90deg, #0284c7, #38bdf8, #7dd3fc)', transition: 'width 1s', position: 'relative', overflow: 'hidden' }}>
                <div className="shimmer-prog" style={{ position: 'absolute', inset: 0 }} />
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
function Toggle({ checked, onChange, size = 'md', color = '#2d6a4f', disabled = false, readOnly = false }: {
  checked: boolean; onChange: (v: boolean) => void;
  size?: 'sm' | 'md' | 'lg'; color?: string; disabled?: boolean; readOnly?: boolean;
}) {
  const dims = { sm: { w: 36, h: 20, thumb: 14, pad: 3 }, md: { w: 48, h: 26, thumb: 18, pad: 4 }, lg: { w: 60, h: 32, thumb: 22, pad: 5 } }[size];
  const isBlocked = disabled || readOnly;
  return (
    <button type="button" onClick={() => !isBlocked && onChange(!checked)} disabled={isBlocked}
      style={{
        position: 'relative', flexShrink: 0, borderRadius: 100, border: `1px solid ${checked && !readOnly ? color + '55' : 'rgba(160,130,90,0.22)'}`,
        width: dims.w, height: dims.h,
        background: checked ? (readOnly ? '#d4c4a8' : color) : '#ede4d3',
        boxShadow: checked && !readOnly ? `0 0 10px ${color}33` : 'none',
        opacity: readOnly ? 0.55 : disabled ? 0.4 : 1,
        transition: 'background 0.3s, box-shadow 0.3s', cursor: isBlocked ? 'not-allowed' : 'pointer',
      }}
      aria-checked={checked} role="switch">
      <span style={{
        position: 'absolute', borderRadius: '50%', background: '#fff',
        width: dims.thumb, height: dims.thumb, top: dims.pad,
        left: checked ? dims.w - dims.thumb - dims.pad : dims.pad,
        transition: 'left 0.25s cubic-bezier(.4,0,.2,1)',
        boxShadow: '0 1px 4px rgba(100,70,30,0.18)',
      }} />
    </button>
  );
}

// ---------------------------------------------------------------------------
// ── SliderRow
// ---------------------------------------------------------------------------
function SliderRow({ label, value, min, max, step = 1, unit, onChange, color = '#2d6a4f', readOnly = false }: {
  label: string; value: number; min: number; max: number; step?: number;
  unit: string; onChange: (v: number) => void; color?: string; readOnly?: boolean;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, opacity: readOnly ? 0.5 : 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
        <span style={{ color: '#5a5040', fontWeight: 500, fontFamily: "'DM Sans', sans-serif" }}>{label}</span>
        <span style={{ fontWeight: 700, padding: '2px 9px', borderRadius: 8, fontSize: 12, fontFamily: "'Space Grotesk', sans-serif", color, background: `${color}12`, border: `1px solid ${color}20` }}>
          {value}{unit}
        </span>
      </div>
      <div style={{ position: 'relative', height: 20, display: 'flex', alignItems: 'center' }}>
        <div style={{ width: '100%', height: 6, borderRadius: 100, background: '#ede4d3' }}>
          <div style={{ height: '100%', borderRadius: 100, transition: 'width 0.15s', width: `${((value - min) / (max - min)) * 100}%`, background: readOnly ? '#d4c4a8' : `linear-gradient(90deg, ${color}88, ${color})` }} />
        </div>
        <input type="range" min={min} max={max} step={step} value={value}
          onChange={e => !readOnly && onChange(Number(e.target.value))} disabled={readOnly}
          style={{ position: 'absolute', inset: 0, width: '100%', opacity: 0, cursor: readOnly ? 'not-allowed' : 'pointer', height: '100%' }} />
        <div style={{ position: 'absolute', width: 14, height: 14, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 4px rgba(100,70,30,0.2)', border: `2px solid ${readOnly ? '#d4c4a8' : color}`, pointerEvents: 'none', left: `calc(${((value - min) / (max - min)) * 100}% - 7px)` }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#b0a088', fontFamily: "'DM Sans', sans-serif" }}>
        <span>{min}{unit}</span><span>{max}{unit}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ── SettingCard — light dashboard card style
// ---------------------------------------------------------------------------
function SettingCard({ icon: Icon, title, subtitle, children, accent = '#2d6a4f', badge }: {
  icon: React.ElementType; title: string; subtitle?: string; children: React.ReactNode; accent?: string; badge?: React.ReactNode;
}) {
  return (
    <div style={{
      background: '#fff', border: '1px solid rgba(160,130,90,0.16)',
      borderRadius: 18, boxShadow: '0 2px 12px rgba(100,70,30,0.06)', overflow: 'hidden',
    }}>
      <div style={{ height: 3, width: '100%', background: `linear-gradient(90deg, ${accent}, ${accent}40, transparent)`, borderRadius: '18px 18px 0 0' }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid rgba(160,130,90,0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${accent}12`, border: `1px solid ${accent}25` }}>
            <Icon style={{ width: 16, height: 16, color: accent }} />
          </div>
          <div>
            <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 14, color: '#1c1a15' }}>{title}</h3>
            {subtitle && <p style={{ fontSize: 11, color: '#9a8870', marginTop: 2, fontFamily: "'DM Sans', sans-serif" }}>{subtitle}</p>}
          </div>
        </div>
        {badge}
      </div>
      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ── SettingRow
// ---------------------------------------------------------------------------
function SettingRow({ label, sublabel, children }: { label: string; sublabel?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '4px 0' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13.5, fontWeight: 500, color: '#1c1a15', fontFamily: "'DM Sans', sans-serif" }}>{label}</p>
        {sublabel && <p style={{ fontSize: 11.5, color: '#9a8870', marginTop: 2, fontFamily: "'DM Sans', sans-serif" }}>{sublabel}</p>}
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ── ReadOnly Banner
// ---------------------------------------------------------------------------
function ReadOnlyBanner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', borderRadius: 14, background: '#fffbeb', border: '1px solid #fde68a' }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: '#fef3c7', border: '1px solid #fde68a' }}>
        <Lock style={{ width: 16, height: 16, color: '#d97706' }} />
      </div>
      <div>
        <p style={{ fontSize: 13.5, fontWeight: 700, color: '#92400e', fontFamily: "'DM Sans', sans-serif" }}>View-only mode</p>
        <p style={{ fontSize: 12, color: '#5a5040', marginTop: 2, fontFamily: "'DM Sans', sans-serif" }}>
          You have the <span style={{ color: '#d97706', fontWeight: 600 }}>User</span> role.
          Contact an admin to be upgraded to <span style={{ color: '#2d6a4f', fontWeight: 600 }}>Gardener</span>.
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

  // AI tip styles — light palette
  const tipStyle: Record<string, React.CSSProperties> = {
    info:    { background: '#ecfeff', border: '1px solid #a5f3fc', color: '#0e7490' },
    warning: { background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e' },
    success: { background: '#f0faf2', border: '1px solid #b7e4c7', color: '#2d6a4f' },
  };
  const tipIcon = { info: Info, warning: AlertTriangle, success: CheckCircle };
  const aiSubtitle = aiTipsSource === 'cache' && aiTipsSavedAt ? `Cached · ${aiTipsSavedAt}` : aiTipsSource === 'fresh' && aiTipsSavedAt ? `Refreshed · ${aiTipsSavedAt}` : 'Personalized advice';

  // ESP32 status — light palette
  const esp32Cfg = {
    online:        { label: 'Online',        dot: '#2d6a4f', text: '#2d6a4f', badgeBg: '#d8f3dc', badgeBorder: '#b7e4c7', Icon: CheckCircle },
    offline:       { label: 'Offline',       dot: '#d97706', text: '#92400e', badgeBg: '#fef3c7', badgeBorder: '#fde68a', Icon: WifiOff    },
    no_connection: { label: 'No Connection', dot: '#dc2626', text: '#991b1b', badgeBg: '#fee2e2', badgeBorder: '#fecaca', Icon: WifiOff    },
  }[esp32Status.status];

  if (!mounted) return (
    <div style={{ minHeight: '100vh', background: '#f9f5ef' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {[...Array(4)].map((_,i) => <div key={i} style={{ height: 192, borderRadius: 18, background: '#ede4d3', animation: 'pulse 2s infinite' }} />)}
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#f9f5ef', fontFamily: "'DM Sans', 'Segoe UI', sans-serif", color: '#1c1a15' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,300&family=Space+Grotesk:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: #f2ece0; }
        ::-webkit-scrollbar-thumb { background: #d4c4a8; border-radius: 4px; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pls { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes shimmerProg { from{background-position:-200% 0} to{background-position:200% 0} }
        .shimmer-prog { background: linear-gradient(90deg,rgba(255,255,255,0) 0%,rgba(255,255,255,0.5) 50%,rgba(255,255,255,0) 100%); background-size:200% 100%; animation: shimmerProg 2s infinite; }
        input[type='range'] { -webkit-appearance: none; appearance: none; }
        input[type='range']::-webkit-slider-thumb { -webkit-appearance: none; width: 14px; height: 14px; border-radius: 50%; cursor: pointer; }
      `}</style>

      {/* ── HEADER — light, matches dashboard ── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 50, height: 60,
        background: 'rgba(249,245,239,0.92)', backdropFilter: 'blur(14px)',
        borderBottom: '1px solid rgba(160,130,90,0.14)',
        display: 'flex', alignItems: 'center', padding: '0 24px', gap: 14,
      }}>
        <button type="button" onClick={() => document.dispatchEvent(new CustomEvent('toggleMobileMenu'))}
          style={{ display: 'none', padding: 8, borderRadius: 8, background: 'transparent', border: 'none', cursor: 'pointer', color: '#9a8870' }}
          className="lg:hidden">
          <Menu style={{ width: 20, height: 20 }} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#9a8870', fontFamily: "'DM Sans', sans-serif" }}>
          <Leaf style={{ width: 14, height: 14, color: '#2d6a4f' }} />
          <span>Dashboard</span>
          <ChevronRight style={{ width: 12, height: 12 }} />
          <span style={{ color: '#2d6a4f', fontWeight: 600, fontFamily: "'Space Grotesk', sans-serif" }}>Settings</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto', flexWrap: 'wrap' }}>
          {isAdmin && (
            <button onClick={() => router.push('/admin')}
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px', borderRadius: 100, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", background: '#f5f3ff', border: '1px solid rgba(124,58,237,0.22)', color: '#7c3aed', transition: 'all .15s' }}>
              <ShieldCheck style={{ width: 15, height: 15 }} />
              <span>Manage Users</span>
            </button>
          )}
          <button onClick={handleReset} disabled={isReadOnly}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px', borderRadius: 100, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", background: '#fff', border: '1px solid rgba(160,130,90,0.22)', color: '#5a5040', opacity: isReadOnly ? 0.4 : 1, transition: 'all .15s' }}>
            <RotateCcw style={{ width: 14, height: 14 }} />
            <span>Reset</span>
          </button>
        </div>
      </header>

      {/* ── MAIN CONTENT ── */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 24px 60px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Page heading */}
        <div style={{ paddingBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 11px', borderRadius: 100, fontSize: 11, fontWeight: 700, background: '#d8f3dc', color: '#2d6a4f', border: '1px solid #b7e4c7', fontFamily: "'DM Sans', sans-serif" }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#40916c', display: 'inline-block' }} className="pls" />
              FARM CONFIGURATION
            </span>
            <button onClick={handleSave} disabled={isReadOnly}
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 20px', borderRadius: 100, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", background: saved ? '#2d6a4f' : 'linear-gradient(135deg, #2d6a4f, #40916c)', color: '#fff', border: 'none', opacity: isReadOnly ? 0.4 : 1, boxShadow: saved || isReadOnly ? 'none' : '0 4px 16px rgba(45,106,79,0.25)', transition: 'all .2s' }}>
              {saved ? <><CheckCircle style={{ width: 15, height: 15 }} /> Saved!</> : <><Save style={{ width: 15, height: 15 }} /> Save Changes</>}
            </button>
          </div>
          <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 32, fontWeight: 700, color: '#1c1a15', letterSpacing: '-0.02em', marginBottom: 6 }}>Farm Settings</h1>
          <p style={{ fontSize: 13.5, color: '#9a8870', fontFamily: "'DM Sans', sans-serif" }}>Configure irrigation, alerts, and system preferences</p>
        </div>

        {isReadOnly && <ReadOnlyBanner />}

        {/* ── MAIN GRID ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 20 }}>

          {/* LEFT (2-col) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* ── IRRIGATION CONTROL */}
            <SettingCard icon={Droplets} title="Irrigation Control"
              subtitle="Valve override, automation modes & timing" accent="#0891b2"
              badge={
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {valveConfirmed !== null && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 100, fontSize: 11, fontWeight: 700, fontFamily: "'DM Sans', sans-serif", background: valveConfirmed ? '#cffafe' : '#f2ece0', border: `1px solid ${valveConfirmed ? '#a5f3fc' : 'rgba(160,130,90,0.22)'}`, color: valveConfirmed ? '#0e7490' : '#9a8870' }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: valveConfirmed ? '#0891b2' : '#b0a088', boxShadow: valveConfirmed ? '0 0 6px rgba(8,145,178,0.5)' : 'none', display: 'inline-block' }} />
                      {valveConfirmed ? 'OPEN' : 'CLOSED'}
                    </span>
                  )}
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 100, fontSize: 11, fontWeight: 700, fontFamily: "'DM Sans', sans-serif", background: wateringOn ? '#cffafe' : settings.irrigationActive ? '#d8f3dc' : '#f2ece0', border: `1px solid ${wateringOn ? '#a5f3fc' : settings.irrigationActive ? '#b7e4c7' : 'rgba(160,130,90,0.22)'}`, color: wateringOn ? '#0e7490' : settings.irrigationActive ? '#2d6a4f' : '#9a8870' }}>
                    {wateringOn ? '💧 Running' : settings.irrigationActive ? '✅ Armed' : '⏸ Idle'}
                  </span>
                </div>
              }>

              <PipelineValvePanel isOpen={wateringOn} isRunning={wateringOn} timer={waterTimer} duration={settings.wateringDuration} />

              {/* Mode selector */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#9a8870', textTransform: 'uppercase', letterSpacing: '0.07em', fontFamily: "'DM Sans', sans-serif" }}>Irrigation Mode</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  {(['manual', 'auto', 'scheduled'] as IrrigationMode[]).map(mode => (
                    <button key={mode} onClick={() => !isReadOnly && set('irrigationMode', mode)} disabled={isReadOnly}
                      style={{ padding: '10px 12px', borderRadius: 12, fontSize: 12, fontWeight: 700, cursor: isReadOnly ? 'not-allowed' : 'pointer', fontFamily: "'DM Sans', sans-serif", textTransform: 'capitalize', background: settings.irrigationMode === mode ? '#e0f7fa' : '#f9f5ef', border: `1px solid ${settings.irrigationMode === mode ? '#0891b2' : 'rgba(160,130,90,0.22)'}`, color: settings.irrigationMode === mode ? '#0e7490' : '#9a8870', opacity: isReadOnly ? 0.5 : 1, transition: 'all .15s' }}>
                      {mode === 'manual' ? '🖐 Manual' : mode === 'auto' ? '⚡ Auto' : '🕐 Scheduled'}
                    </button>
                  ))}
                </div>
              </div>

              {settings.irrigationMode === 'manual' && (
                <SettingRow label="Open Valve — Start Irrigation" sublabel={wateringOn ? 'Valve is open · water flowing' : 'Valve is closed · no flow'}>
                  <Toggle checked={wateringOn} onChange={v => !isReadOnly && setWateringOn(v)} color="#0891b2" readOnly={isReadOnly} />
                </SettingRow>
              )}

              {settings.irrigationMode === 'auto' && (
                <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(8,145,178,0.2)', background: '#f0fbff' }}>
                  <div style={{ padding: '12px 16px 8px' }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: '#0891b2', textTransform: 'uppercase', letterSpacing: '0.07em', fontFamily: "'DM Sans', sans-serif", marginBottom: 10 }}>Auto Mode — select one</p>

                    <button onClick={() => !isReadOnly && set('autoSubMode', 'moisture')} disabled={isReadOnly}
                      style={{ width: '100%', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderRadius: 11, textAlign: 'left', cursor: isReadOnly ? 'not-allowed' : 'pointer', background: settings.autoSubMode === 'moisture' ? '#cffafe' : '#fff', border: `1px solid ${settings.autoSubMode === 'moisture' ? '#0891b2' : 'rgba(160,130,90,0.2)'}`, opacity: isReadOnly ? 0.5 : 1, transition: 'all .15s' }}>
                      <div style={{ width: 32, height: 32, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: settings.autoSubMode === 'moisture' ? '#e0f7fa' : '#f2ece0', border: `1px solid ${settings.autoSubMode === 'moisture' ? '#a5f3fc' : 'rgba(160,130,90,0.2)'}` }}>
                        <Droplets style={{ width: 14, height: 14, color: settings.autoSubMode === 'moisture' ? '#0891b2' : '#b0a088' }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: settings.autoSubMode === 'moisture' ? '#1c1a15' : '#9a8870', fontFamily: "'DM Sans', sans-serif" }}>Auto-Irrigation System</p>
                        <p style={{ fontSize: 11.5, marginTop: 2, color: settings.autoSubMode === 'moisture' ? '#0891b2' : '#b0a088', fontFamily: "'DM Sans', sans-serif" }}>Opens valve automatically when live soil moisture is very low</p>
                      </div>
                      <div style={{ width: 16, height: 16, borderRadius: '50%', border: `2px solid ${settings.autoSubMode === 'moisture' ? '#0891b2' : '#d4c4a8'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {settings.autoSubMode === 'moisture' && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#0891b2' }} />}
                      </div>
                    </button>

                    <button onClick={() => !isReadOnly && set('autoSubMode', 'cycle')} disabled={isReadOnly}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderRadius: 11, textAlign: 'left', cursor: isReadOnly ? 'not-allowed' : 'pointer', background: settings.autoSubMode === 'cycle' ? '#cffafe' : '#fff', border: `1px solid ${settings.autoSubMode === 'cycle' ? '#0891b2' : 'rgba(160,130,90,0.2)'}`, opacity: isReadOnly ? 0.5 : 1, transition: 'all .15s' }}>
                      <div style={{ width: 32, height: 32, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: settings.autoSubMode === 'cycle' ? '#e0f7fa' : '#f2ece0', border: `1px solid ${settings.autoSubMode === 'cycle' ? '#a5f3fc' : 'rgba(160,130,90,0.2)'}` }}>
                        <RefreshCw style={{ width: 14, height: 14, color: settings.autoSubMode === 'cycle' ? '#0891b2' : '#b0a088' }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: settings.autoSubMode === 'cycle' ? '#1c1a15' : '#9a8870', fontFamily: "'DM Sans', sans-serif" }}>Auto-cycle Frequency</p>
                        <p style={{ fontSize: 11.5, marginTop: 2, color: settings.autoSubMode === 'cycle' ? '#0891b2' : '#b0a088', fontFamily: "'DM Sans', sans-serif" }}>Waters on a fixed time interval regardless of soil moisture</p>
                      </div>
                      <div style={{ width: 16, height: 16, borderRadius: '50%', border: `2px solid ${settings.autoSubMode === 'cycle' ? '#0891b2' : '#d4c4a8'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {settings.autoSubMode === 'cycle' && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#0891b2' }} />}
                      </div>
                    </button>
                  </div>

                  {settings.autoSubMode === 'cycle' && (
                    <div style={{ padding: '4px 16px 16px' }}>
                      <SliderRow label="Auto-cycle Frequency" value={settings.wateringFrequency} min={2} max={48} step={2} unit=" hrs" onChange={v => set('wateringFrequency', v)} color="#0891b2" readOnly={isReadOnly} />
                    </div>
                  )}
                  {settings.autoSubMode === 'moisture' && (
                    <div style={{ padding: '4px 16px 14px' }}>
                      <p style={{ fontSize: 12, color: '#9a8870', display: 'flex', alignItems: 'center', gap: 6, fontFamily: "'DM Sans', sans-serif" }}>
                        <Info style={{ width: 12, height: 12, flexShrink: 0 }} />
                        Valve opens when live soil moisture drops below the <span style={{ color: '#0891b2', fontWeight: 600 }}>Min Moisture</span> threshold set below.
                      </p>
                    </div>
                  )}
                </div>
              )}

              <SliderRow label="Watering Duration" value={settings.wateringDuration} min={5} max={60} step={5} unit=" min" onChange={v => set('wateringDuration', v)} color="#0891b2" readOnly={isReadOnly} />

              {settings.irrigationMode === 'scheduled' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: '#9a8870', textTransform: 'uppercase', letterSpacing: '0.07em', fontFamily: "'DM Sans', sans-serif" }}>Scheduled Time</p>
                  <input type="time" value={settings.scheduledTime}
                    onChange={e => !isReadOnly && set('scheduledTime', e.target.value)} disabled={isReadOnly}
                    style={{ padding: '10px 14px', borderRadius: 11, fontSize: 13, outline: 'none', background: '#f9f5ef', border: '1px solid rgba(160,130,90,0.22)', color: '#1c1a15', fontFamily: "'Space Grotesk', monospace", opacity: isReadOnly ? 0.4 : 1, colorScheme: 'light' }} />
                  {aiOptTime && (
                    <p style={{ fontSize: 12, color: '#2d6a4f', display: 'flex', alignItems: 'center', gap: 5, fontFamily: "'DM Sans', sans-serif" }}>
                      <Brain style={{ width: 12, height: 12 }} /> AI recommends: <strong style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{aiOptTime}</strong>
                    </p>
                  )}
                </div>
              )}
            </SettingCard>

            {/* ── SENSOR THRESHOLDS */}
            <SettingCard icon={Sliders} title="Sensor Thresholds" subtitle="Alert and automation trigger boundaries" accent="#7c3aed">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px 24px' }}>
                <SliderRow label="Min Moisture" value={settings.moistureMin} min={10} max={50} unit="%" onChange={v => set('moistureMin', v)} color="#7c3aed" readOnly={isReadOnly} />
                <SliderRow label="Max Moisture" value={settings.moistureMax} min={50} max={95} unit="%" onChange={v => set('moistureMax', v)} color="#7c3aed" readOnly={isReadOnly} />
                <SliderRow label="Min Temperature" value={settings.tempMin} min={5} max={20} unit="°C" onChange={v => set('tempMin', v)} color="#f97316" readOnly={isReadOnly} />
                <SliderRow label="Max Temperature" value={settings.tempMax} min={25} max={45} unit="°C" onChange={v => set('tempMax', v)} color="#f97316" readOnly={isReadOnly} />
                <SliderRow label="Min pH" value={settings.phMin} min={4} max={7} step={0.1} unit="" onChange={v => set('phMin', v)} color="#2d6a4f" readOnly={isReadOnly} />
                <SliderRow label="Max pH" value={settings.phMax} min={7} max={9} step={0.1} unit="" onChange={v => set('phMax', v)} color="#2d6a4f" readOnly={isReadOnly} />
              </div>
            </SettingCard>

            {/* ── NOTIFICATIONS */}
            <SettingCard icon={Bell} title="Alerts & Notifications" subtitle="Control how and when you receive farm alerts" accent="#d97706">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#9a8870', textTransform: 'uppercase', letterSpacing: '0.07em', fontFamily: "'DM Sans', sans-serif" }}>Alert Level</p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {(['all', 'critical', 'none'] as AlertLevel[]).map(level => (
                    <button key={level} onClick={() => setSettings(s => ({ ...s, alertLevel: level }))}
                      style={{ padding: '8px 16px', borderRadius: 100, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", background: settings.alertLevel === level ? '#fef3c7' : '#f9f5ef', border: `1px solid ${settings.alertLevel === level ? '#f59e0b' : 'rgba(160,130,90,0.22)'}`, color: settings.alertLevel === level ? '#92400e' : '#9a8870', transition: 'all .15s' }}>
                      {level === 'all' ? '🔔 All' : level === 'critical' ? '🚨 Critical' : '🔇 Muted'}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <SettingRow label="Push Notifications" sublabel="Browser & mobile push">
                  <Toggle checked={settings.pushEnabled} onChange={v => setSettings(s => ({ ...s, pushEnabled: v }))} color="#d97706" />
                </SettingRow>
                <SettingRow label="SMS Alerts" sublabel="Sent to registered phone (+254…)">
                  <Toggle checked={settings.smsEnabled} onChange={v => setSettings(s => ({ ...s, smsEnabled: v }))} color="#d97706" />
                </SettingRow>
                <SettingRow label="Sound Alerts" sublabel="In-app audio notifications">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {settings.soundEnabled ? <Volume2 style={{ width: 16, height: 16, color: '#d97706' }} /> : <VolumeX style={{ width: 16, height: 16, color: '#b0a088' }} />}
                    <Toggle checked={settings.soundEnabled} onChange={v => setSettings(s => ({ ...s, soundEnabled: v }))} color="#d97706" />
                  </div>
                </SettingRow>
              </div>
            </SettingCard>

            {/* ── SYSTEM */}
            <SettingCard icon={Database} title="System & Connectivity" subtitle="Sync intervals, storage and data retention" accent="#2d6a4f"
              badge={
                !isAdmin && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 12px', borderRadius: 100, fontSize: 11, fontWeight: 700, fontFamily: "'DM Sans', sans-serif", background: '#f5f3ff', border: '1px solid rgba(124,58,237,0.22)', color: '#7c3aed' }}>
                    <Shield style={{ width: 12, height: 12 }} /> Admin
                  </span>
                )
              }>
              <SliderRow label="Data Sync Interval" value={settings.syncInterval} min={10} max={300} step={10} unit="s" onChange={v => set('syncInterval', v)} color="#2d6a4f" readOnly={!isAdmin} />
              <SliderRow label="Data Retention" value={settings.dataRetention} min={7} max={365} step={7} unit=" days" onChange={v => set('dataRetention', v)} color="#2d6a4f" readOnly={!isAdmin} />
            </SettingCard>
          </div>

          {/* ── RIGHT COLUMN ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* ── FIELD IRRIGATION VIEW */}
            <div style={{
              background: '#fff', border: `1px solid ${wateringOn ? 'rgba(8,145,178,0.28)' : 'rgba(160,130,90,0.16)'}`,
              borderRadius: 18, boxShadow: '0 2px 12px rgba(100,70,30,0.06)', overflow: 'hidden', transition: 'all 0.8s ease',
            }}>
              <div style={{ height: 3, width: '100%', background: wateringOn ? 'linear-gradient(90deg, #0891b2, #0891b230, transparent)' : 'linear-gradient(90deg, rgba(160,130,90,0.3), transparent)', borderRadius: '18px 18px 0 0' }} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: `1px solid ${wateringOn ? 'rgba(8,145,178,0.14)' : 'rgba(160,130,90,0.1)'}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', background: wateringOn ? '#cffafe' : '#f2ece0', border: `1px solid ${wateringOn ? '#a5f3fc' : 'rgba(160,130,90,0.22)'}` }}>
                    <Droplets style={{ width: 15, height: 15, color: wateringOn ? '#0891b2' : '#b0a088' }} />
                  </div>
                  <div>
                    <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 14, color: '#1c1a15' }}>Field Irrigation View</h3>
                    <p style={{ fontSize: 11.5, marginTop: 2, color: wateringOn ? '#0891b2' : '#b0a088', fontFamily: "'DM Sans', sans-serif" }}>
                      {wateringOn ? 'Sprinklers active · water flowing' : 'System idle · valve closed'}
                    </p>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 11px', borderRadius: 100, fontSize: 11, fontWeight: 700, fontFamily: "'DM Sans', sans-serif", background: wateringOn ? '#cffafe' : '#f2ece0', border: `1px solid ${wateringOn ? '#a5f3fc' : 'rgba(160,130,90,0.22)'}`, color: wateringOn ? '#0e7490' : '#9a8870' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: wateringOn ? '#0891b2' : '#b0a088', boxShadow: wateringOn ? '0 0 6px rgba(8,145,178,0.5)' : 'none', display: 'inline-block', animation: wateringOn ? 'pls 1.5s infinite' : 'none' }} />
                  {wateringOn ? 'LIVE' : 'IDLE'}
                </div>
              </div>

              <div style={{ padding: '16px 16px 20px' }}>
                <svg viewBox="0 0 300 220" className="w-full" style={{ height: 210, width: '100%' }}>
                  <defs>
                    <linearGradient id="skyGradL" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={wateringOn ? '#e0f7fa' : '#f0fbff'} />
                      <stop offset="100%" stopColor={wateringOn ? '#e8f5eb' : '#f9f5ef'} />
                    </linearGradient>
                    <linearGradient id="groundGradL" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={wateringOn ? '#4ade80' : '#86efac'} />
                      <stop offset="100%" stopColor={wateringOn ? '#16a34a' : '#4ade80'} />
                    </linearGradient>
                    <linearGradient id="dropGradL" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.8" /><stop offset="100%" stopColor="#0891b2" stopOpacity="0.5" />
                    </linearGradient>
                    <linearGradient id="leafGradA" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#4ade80" /><stop offset="100%" stopColor="#16a34a" />
                    </linearGradient>
                    <linearGradient id="leafGradB" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#86efac" /><stop offset="100%" stopColor="#15803d" />
                    </linearGradient>
                  </defs>
                  <rect width="300" height="220" fill="url(#skyGradL)" />
                  <rect x="0" y="165" width="300" height="55" fill="url(#groundGradL)" />
                  <rect x="0" y="165" width="300" height="3" fill={wateringOn ? '#22c55e' : '#86efac'} opacity="0.7" />
                  {[52, 105, 200, 258].map((x, pi) => (
                    <g key={pi}>
                      <line x1={x} y1="167" x2={x} y2={x === 105 ? 115 : x === 200 ? 125 : x === 258 ? 140 : 130}
                        stroke={wateringOn ? '#16a34a' : '#4ade80'} strokeWidth="3" strokeLinecap="round" />
                      <ellipse cx={x} cy={x === 105 ? 122 : x === 200 ? 130 : x === 258 ? 144 : 138}
                        rx={x === 200 ? 20 : 18} ry={x === 200 ? 11 : 10}
                        fill="url(#leafGradA)" opacity={wateringOn ? 1 : 0.7} />
                      <ellipse cx={x} cy={x === 105 ? 122 : x === 200 ? 130 : x === 258 ? 144 : 138}
                        rx={x === 200 ? 16 : 14} ry={x === 200 ? 9 : 8}
                        fill="url(#leafGradB)" transform={`rotate(-15 ${x} ${x === 200 ? 130 : 138})`} opacity={wateringOn ? 0.9 : 0.6} />
                    </g>
                  ))}
                  <rect x="147" y="148" width="6" height="20" rx="2" fill={wateringOn ? '#0891b2' : '#d4c4a8'} />
                  <rect x="140" y="165" width="20" height="5" rx="2" fill={wateringOn ? '#38bdf8' : '#c8b896'} />
                  <rect x="144" y="138" width="12" height="12" rx="3" fill={wateringOn ? '#0ea5e9' : '#d4c4a8'}
                    style={{ filter: wateringOn ? 'drop-shadow(0 0 5px rgba(8,145,178,0.4))' : 'none' }} />
                  <circle cx="150" cy="135" r="2.5" fill={wateringOn ? '#38bdf8' : '#c8b896'}
                    style={{ animation: wateringOn ? 'pulse 1s infinite' : 'none' }} />
                  {wateringOn && <>
                    <path d="M 150 135 Q 100 80 55 155" fill="none" stroke="#0891b2" strokeWidth="1.5" strokeDasharray="4,3" opacity="0.4">
                      <animate attributeName="stroke-dashoffset" from="0" to="-56" dur="1.2s" repeatCount="indefinite" />
                    </path>
                    <path d="M 150 135 Q 205 80 252 155" fill="none" stroke="#0891b2" strokeWidth="1.5" strokeDasharray="4,3" opacity="0.4">
                      <animate attributeName="stroke-dashoffset" from="0" to="-56" dur="1.2s" begin="0.1s" repeatCount="indefinite" />
                    </path>
                    {[
                      { cx: 75, startY: 110, endY: 167, dur: '1.1s', begin: '0s' },
                      { cx: 58, startY: 130, endY: 167, dur: '0.9s', begin: '0.3s' },
                      { cx: 228, startY: 110, endY: 167, dur: '1.1s', begin: '0.1s' },
                      { cx: 245, startY: 130, endY: 167, dur: '0.9s', begin: '0.4s' },
                    ].map((d, i) => (
                      <ellipse key={i} cx={d.cx} cy={d.startY} rx="1.5" ry="3" fill="url(#dropGradL)">
                        <animate attributeName="cy" values={`${d.startY};${d.endY}`} dur={d.dur} begin={d.begin} repeatCount="indefinite" />
                        <animate attributeName="opacity" values="0.8;0.2" dur={d.dur} begin={d.begin} repeatCount="indefinite" />
                      </ellipse>
                    ))}
                  </>}
                  {[30,70,120,170,220,270].map((x,i) => (
                    <line key={i} x1={x} y1="165" x2={x} y2={wateringOn ? 153 : 157} stroke={wateringOn ? '#22c55e' : '#4ade80'} strokeWidth="2" strokeLinecap="round" />
                  ))}
                  <text x="150" y="210" textAnchor="middle" fontSize="8.5" fontFamily="'Space Grotesk', monospace"
                    fill={wateringOn ? '#0891b2' : '#b0a088'} fontWeight="700" letterSpacing="0.5">
                    {wateringOn ? '— SPRINKLER ACTIVE —' : '— SYSTEM IDLE —'}
                  </text>
                </svg>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, padding: '0 4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: wateringOn ? '#0891b2' : '#b0a088', fontFamily: "'DM Sans', sans-serif" }}>
                    <Droplets style={{ width: 14, height: 14 }} />
                    <span>{wateringOn ? 'Water flowing to all plots' : 'No water flow detected'}</span>
                  </div>
                  {wateringOn && waterTimer > 0 && (
                    <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 11px', borderRadius: 9, background: '#cffafe', color: '#0e7490', border: '1px solid #a5f3fc', fontFamily: "'Space Grotesk', sans-serif" }}>
                      {Math.floor(waterTimer/60).toString().padStart(2,'0')}:{(waterTimer%60).toString().padStart(2,'0')}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* ── DISPLAY & THEME */}
            <SettingCard icon={Sun} title="Display & Theme" subtitle="Visual appearance" accent="#d97706">
              <div style={{ borderRadius: 12, overflow: 'hidden', padding: 16, transition: 'all 0.5s', background: isDark ? 'linear-gradient(135deg, #1e293b, #334155)' : 'linear-gradient(135deg, #fef9c3, #e0f2fe)', border: `1px solid ${isDark ? 'rgba(71,85,105,0.35)' : 'rgba(251,191,36,0.3)'}` }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: isDark ? 'rgba(30,41,59,0.8)' : '#fef3c7', border: `1px solid ${isDark ? 'rgba(71,85,105,0.35)' : 'rgba(251,191,36,0.3)'}` }}>
                      {isDark ? <Moon style={{ width: 15, height: 15, color: '#93c5fd' }} /> : <Sun style={{ width: 15, height: 15, color: '#d97706' }} />}
                    </div>
                    <div>
                      <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 13.5, color: isDark ? '#e2e8f0' : '#1e293b' }}>{isDark ? 'Dark Mode' : 'Light Mode'}</p>
                      <p style={{ fontSize: 11.5, marginTop: 2, color: isDark ? '#64748b' : '#9a8870', fontFamily: "'DM Sans', sans-serif" }}>System-wide</p>
                    </div>
                  </div>
                  <Toggle checked={!isDark} onChange={v => setTheme(v ? 'light' : 'dark')} size="lg" color={isDark ? '#3b82f6' : '#d97706'} />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#9a8870', textTransform: 'uppercase', letterSpacing: '0.07em', fontFamily: "'DM Sans', sans-serif" }}>Presets</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {[
                    { label: 'Forest', from: '#052e16', to: '#166534', accent: '#10b981' },
                    { label: 'Ocean',  from: '#0c1a2e', to: '#0c4a6e', accent: '#38bdf8' },
                    { label: 'Desert', from: '#2d1b00', to: '#92400e', accent: '#f59e0b' },
                    { label: 'Slate',  from: '#0f1824', to: '#1e293b', accent: '#94a3b8' },
                  ].map(preset => (
                    <button key={preset.label}
                      style={{ position: 'relative', overflow: 'hidden', borderRadius: 12, height: 48, cursor: 'pointer', border: '1px solid rgba(160,130,90,0.18)', background: `linear-gradient(135deg, ${preset.from}, ${preset.to})`, transition: 'all .15s' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.transform = 'scale(1.03)'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.transform = ''}>
                      <span style={{ position: 'absolute', bottom: 6, left: 10, fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.6)', fontFamily: "'DM Sans', sans-serif" }}>{preset.label}</span>
                      <div style={{ position: 'absolute', top: 6, right: 6, width: 10, height: 10, borderRadius: '50%', background: preset.accent }} />
                    </button>
                  ))}
                </div>
              </div>
            </SettingCard>

            {/* ── AI IRRIGATION TIPS */}
            <SettingCard icon={Brain} title="AI Irrigation Tips" subtitle={aiSubtitle} accent="#7c3aed"
              badge={
                <button onClick={fetchAITips} disabled={aiLoading} title="Refresh tips"
                  style={{ padding: 8, borderRadius: 10, background: 'transparent', border: 'none', cursor: aiLoading ? 'not-allowed' : 'pointer', color: '#9a8870', opacity: aiLoading ? 0.4 : 1, transition: 'all .15s' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#f2ece0'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                  <RefreshCw style={{ width: 15, height: 15, animation: aiLoading ? 'spin 1s linear infinite' : 'none' }} />
                </button>
              }>
              {aiLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 0', gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid rgba(124,58,237,0.2)', borderTopColor: '#7c3aed', animation: 'spin 1s linear infinite' }} />
                  <p style={{ fontSize: 12, color: '#9a8870', fontFamily: "'DM Sans', sans-serif" }}>Analysing irrigation data…</p>
                </div>
              ) : aiError ? (
                <div style={{ padding: 12, borderRadius: 11, fontSize: 12, color: '#991b1b', background: '#fee2e2', border: '1px solid #fecaca', fontFamily: "'DM Sans', sans-serif" }}>
                  ⚠️ {aiError}
                </div>
              ) : aiTips.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {aiTips.map((tip, i) => {
                    const TipIcon = tipIcon[tip.type as keyof typeof tipIcon] ?? Info;
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 13px', borderRadius: 11, fontSize: 12.5, lineHeight: 1.5, fontFamily: "'DM Sans', sans-serif", ...tipStyle[tip.type] ?? { background: '#f9f5ef', border: '1px solid rgba(160,130,90,0.2)', color: '#5a5040' } }}>
                        <TipIcon style={{ width: 13, height: 13, flexShrink: 0, marginTop: 2 }} />
                        {tip.text}
                      </div>
                    );
                  })}
                  {aiWeeklyEst > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 13px', borderRadius: 11, background: '#ecfeff', border: '1px solid #a5f3fc' }}>
                      <Gauge style={{ width: 15, height: 15, color: '#0891b2', flexShrink: 0 }} />
                      <p style={{ fontSize: 12, color: '#5a5040', fontFamily: "'DM Sans', sans-serif" }}>Weekly estimate: <strong style={{ color: '#0891b2', fontFamily: "'Space Grotesk', sans-serif" }}>{aiWeeklyEst} L</strong></p>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 0', gap: 8, textAlign: 'center' }}>
                  <Brain style={{ width: 30, height: 30, color: '#d4c4a8' }} />
                  <p style={{ fontSize: 12, color: '#9a8870', fontFamily: "'DM Sans', sans-serif" }}>Click refresh to generate tips</p>
                </div>
              )}
            </SettingCard>

            {/* ── DEVICE INFO */}
            <SettingCard icon={Radio} title="Device Info" subtitle="ESP32 sensor node" accent="#2d6a4f"
              badge={
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 100, fontSize: 11, fontWeight: 700, fontFamily: "'DM Sans', sans-serif", background: esp32Cfg.badgeBg, border: `1px solid ${esp32Cfg.badgeBorder}`, color: esp32Cfg.text }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: esp32Cfg.dot, boxShadow: esp32Status.status === 'online' ? `0 0 6px ${esp32Cfg.dot}` : 'none', display: 'inline-block', animation: esp32Status.status === 'online' ? 'pls 2s infinite' : 'none' }} />
                  {esp32Cfg.label}
                </div>
              }>
              <div>
                {[
                  { label: 'Device ID', value: 'ESP32-NODE-01', Icon: Smartphone },
                  { label: 'Firmware',  value: 'v2.4.1',        Icon: BatteryCharging },
                  { label: 'Location',  value: 'Plot A',         Icon: MapPin },
                  { label: 'Signal',    value: '-67 dBm',        Icon: Activity },
                  { label: 'Status',    value: esp32Cfg.label,   Icon: esp32Cfg.Icon },
                  { label: 'Last Seen', value: esp32Status.lastSync, Icon: CheckCircle },
                ].map((row, idx, arr) => (
                  <div key={row.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: idx < arr.length - 1 ? '1px solid rgba(160,130,90,0.1)' : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: '#9a8870', fontFamily: "'DM Sans', sans-serif" }}>
                      <row.Icon style={{ width: 13, height: 13 }} />{row.label}
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 600, fontFamily: "'Space Grotesk', sans-serif", color: row.label === 'Status' ? esp32Cfg.text : row.label === 'Last Seen' ? '#9a8870' : '#1c1a15' }}>
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>
            </SettingCard>
          </div>
        </div>

        {/* ── FOOTER ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, padding: '16px 0', borderTop: '1px solid rgba(160,130,90,0.14)', fontFamily: "'DM Sans', sans-serif" }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#b0a088' }}>
            <Info style={{ width: 13, height: 13, flexShrink: 0 }} />
            {isReadOnly ? 'View-only — contact admin for Gardener access.' : 'Changes apply immediately. AI tips cached locally, refreshed on demand.'}
          </div>
          <span style={{ color: '#d4c4a8', fontFamily: "'Space Grotesk', sans-serif" }}>SmartFarm v1.0 · Kenya</span>
        </div>
      </div>
    </div>
  );
}