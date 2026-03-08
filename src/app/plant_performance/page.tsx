'use client';

import React, { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { collection, onSnapshot, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid
} from 'recharts';
import {
  Leaf, Droplets, Thermometer, Waves, FlaskConical,
  Sprout, Brain, TrendingUp, AlertTriangle, CheckCircle,
  Zap, Sun, Wind, RefreshCw, ChevronRight, Activity,
  BarChart3, Info, ArrowUp, ArrowDown, Minus, Menu, Cpu
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const AI_API_KEY = process.env.NEXT_PUBLIC_GROQ_API_KEY ?? '';
const AI_MODEL   = 'llama-3.3-70b-versatile';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type SensorData = {
  moisture: number; temperature: number; humidity: number;
  ph: number; nitrogen: number; phosphorus: number; potassium: number;
};
type HealthStatus = 'thriving' | 'good' | 'stressed' | 'critical';
type AIReport = {
  overallScore: number; status: HealthStatus; headline: string; summary: string;
  actions: { priority: 'high' | 'medium' | 'low'; text: string }[]; forecast: string;
};
type Plot = {
  id: string; name: string; cropType: string; variety: string;
  area: string; plantedDate: string; harvestDate: string;
};

// ---------------------------------------------------------------------------
// localStorage helpers
// ---------------------------------------------------------------------------
const CACHE_PREFIX = 'plant_ai_report_';
function loadCachedReport(plotId: string): AIReport | null {
  if (typeof window === 'undefined') return null;
  try { const raw = localStorage.getItem(`${CACHE_PREFIX}${plotId}`); return raw ? JSON.parse(raw) : null; }
  catch { return null; }
}
function saveCachedReport(plotId: string, report: AIReport): void {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(`${CACHE_PREFIX}${plotId}`, JSON.stringify(report)); } catch {}
}

// ---------------------------------------------------------------------------
// AI call
// ---------------------------------------------------------------------------
async function callGroqAI(prompt: string, system: string): Promise<string> {
  if (!AI_API_KEY) return JSON.stringify({
    overallScore: 78, status: 'good', headline: 'Plants are growing steadily',
    summary: 'Add NEXT_PUBLIC_GROQ_API_KEY to .env.local for live AI diagnostics.',
    actions: [
      { priority: 'high',   text: 'Set NEXT_PUBLIC_GROQ_API_KEY in your .env.local' },
      { priority: 'medium', text: 'Monitor nitrogen levels daily' },
      { priority: 'low',    text: 'Check soil pH weekly' }
    ],
    forecast: 'Harvest expected in 18–21 days under current conditions.'
  });
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${AI_API_KEY}` },
    body: JSON.stringify({ model: AI_MODEL, messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }], temperature: 0.6, max_tokens: 700 })
  });
  if (!res.ok) throw new Error(`Groq API error ${res.status}`);
  const d = await res.json();
  return d?.choices?.[0]?.message?.content ?? '{}';
}

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------
function computeHealth(s: SensorData): HealthStatus {
  const scores = [
    s.moisture >= 35 && s.moisture <= 70 ? 2 : s.moisture >= 20 ? 1 : 0,
    s.temperature >= 18 && s.temperature <= 30 ? 2 : s.temperature >= 10 ? 1 : 0,
    s.humidity >= 45 && s.humidity <= 80 ? 2 : s.humidity >= 30 ? 1 : 0,
    s.ph >= 6.0 && s.ph <= 7.0 ? 2 : s.ph >= 5.5 ? 1 : 0,
    s.nitrogen >= 60 ? 2 : s.nitrogen >= 40 ? 1 : 0,
  ];
  const t = scores.reduce((a, b) => a + b, 0);
  if (t >= 9) return 'thriving';
  if (t >= 7) return 'good';
  if (t >= 4) return 'stressed';
  return 'critical';
}

// ── Light-palette health meta ──────────────────────────────────────────────
const healthMeta: Record<HealthStatus, {
  label: string; color: string; pale: string; border: string;
  badgeBg: string; badgeText: string; badgeBorder: string;
  headerBg: string;
}> = {
  thriving: {
    label: 'Thriving',   color: '#2d6a4f',
    pale: '#f0faf2',     border: 'rgba(45,106,79,0.22)',
    badgeBg: '#d8f3dc',  badgeText: '#2d6a4f', badgeBorder: '#b7e4c7',
    headerBg: 'linear-gradient(135deg, #e8f5eb 0%, #f3fbf4 100%)',
  },
  good: {
    label: 'Good',       color: '#0891b2',
    pale: '#ecfeff',     border: 'rgba(8,145,178,0.22)',
    badgeBg: '#cffafe',  badgeText: '#0e7490', badgeBorder: '#a5f3fc',
    headerBg: 'linear-gradient(135deg, #e0f7fa 0%, #f0fbff 100%)',
  },
  stressed: {
    label: 'Stressed',   color: '#d97706',
    pale: '#fffbeb',     border: 'rgba(217,119,6,0.22)',
    badgeBg: '#fef3c7',  badgeText: '#92400e', badgeBorder: '#fde68a',
    headerBg: 'linear-gradient(135deg, #fef9e7 0%, #fffdf0 100%)',
  },
  critical: {
    label: 'Critical',   color: '#dc2626',
    pale: '#fff1f2',     border: 'rgba(220,38,38,0.22)',
    badgeBg: '#fee2e2',  badgeText: '#991b1b', badgeBorder: '#fecaca',
    headerBg: 'linear-gradient(135deg, #fef2f2 0%, #fff5f5 100%)',
  },
};

function cn(...c: (string | undefined | false | null)[]) { return c.filter(Boolean).join(' '); }

function buildRadarData(s: SensorData) {
  return [
    { subject: 'Moisture',    A: Math.min(100, (s.moisture / 70) * 100),    fullMark: 100 },
    { subject: 'Temperature', A: Math.min(100, (s.temperature / 30) * 100), fullMark: 100 },
    { subject: 'Humidity',    A: Math.min(100, (s.humidity / 80) * 100),    fullMark: 100 },
    { subject: 'pH',          A: Math.min(100, ((s.ph - 4) / 4) * 100),     fullMark: 100 },
    { subject: 'Nitrogen',    A: Math.min(100, (s.nitrogen / 90) * 100),    fullMark: 100 },
    { subject: 'Potassium',   A: Math.min(100, (s.potassium / 250) * 100),  fullMark: 100 },
  ];
}
function buildTimeline() {
  return Array.from({ length: 14 }, (_, i) => ({
    day: `D${i + 1}`,
    height: Math.round(2 + i * 1.4 + Math.random() * 1.5),
    health: Math.round(60 + (Math.random() - 0.3) * 20 + (i / 14) * 10),
  }));
}

// ---------------------------------------------------------------------------
// Plant SVG — same structure, adapted for light background
// ---------------------------------------------------------------------------
function PlantAnimation({ status, moisture, health }: { status: HealthStatus; moisture: number; health: number }) {
  const meta   = healthMeta[status];
  const color  = meta.color;
  const droopy = status === 'stressed' || status === 'critical';
  const wilted = status === 'critical';
  const vibrant= status === 'thriving';
  const waterLevel = Math.min(100, Math.max(5, moisture));
  const droop = wilted ? 40 : droopy ? 20 : vibrant ? -10 : 0;

  return (
    <div className="relative flex items-end justify-center w-full h-full">
      {/* Soft glow — lighter for light bg */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-48 h-48 rounded-full blur-3xl opacity-20 transition-all duration-1000"
        style={{ background: `radial-gradient(circle, ${color} 0%, transparent 70%)` }} />
      <svg viewBox="0 0 200 280" className="w-full max-w-[200px] drop-shadow-lg"
        style={{ filter: `drop-shadow(0 4px 16px ${color}30)` }}>
        <defs>
          <linearGradient id="potGradL" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#a07040" /><stop offset="100%" stopColor="#7a4e28" />
          </linearGradient>
          <linearGradient id="soilGradL" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#92651a" /><stop offset="100%" stopColor="#7a4e20" />
          </linearGradient>
          <linearGradient id="waterGradL" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.5" /><stop offset="100%" stopColor="#0369a1" stopOpacity="0.8" />
          </linearGradient>
          <linearGradient id="stemGradL" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#1a6e38" /><stop offset="100%" stopColor="#2d9a55" />
          </linearGradient>
          <clipPath id="potClipL"><path d="M 62 205 L 68 245 Q 100 252 132 245 L 138 205 Z" /></clipPath>
        </defs>
        <path d="M 62 205 L 68 245 Q 100 252 132 245 L 138 205 Z" fill="url(#potGradL)" />
        <rect x="55" y="198" width="90" height="12" rx="6" fill="#b07c3a" />
        <ellipse cx="100" cy="203" rx="41" ry="8" fill="url(#soilGradL)" />
        <rect x="68" y={245 - (waterLevel / 100) * 32} width="64" height={(waterLevel / 100) * 32}
          fill="url(#waterGradL)" clipPath="url(#potClipL)" className="transition-all duration-1000" />
        {moisture > 50 && (
          <ellipse cx="100" cy="218" rx="20" ry="3" fill="#38bdf8" opacity="0.25">
            <animate attributeName="rx" values="20;28;20" dur="2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.25;0;0.25" dur="2s" repeatCount="indefinite" />
          </ellipse>
        )}
        <path d={droopy ? "M 100 200 C 100 180 98 160 97 140 C 96 120 98 100 97 85" : "M 100 200 C 100 175 101 155 100 135 C 99 115 100 95 100 78"}
          stroke="url(#stemGradL)" strokeWidth="5" fill="none" strokeLinecap="round" className="transition-all duration-1000" />
        <path d={droopy ? "M 99 145 C 85 138 75 128 62 118" : "M 100 148 C 86 140 76 128 65 115"}
          stroke="url(#stemGradL)" strokeWidth="3.5" fill="none" strokeLinecap="round" />
        <path d={droopy ? "M 99 130 C 113 122 123 112 136 105" : "M 100 132 C 114 124 124 112 137 98"}
          stroke="url(#stemGradL)" strokeWidth="3.5" fill="none" strokeLinecap="round" />
        <g transform={`translate(65, 115) rotate(${droop}, 0, 0)`}>
          <ellipse cx="-14" cy="-8" rx="22" ry="12" fill={color} opacity={wilted ? 0.35 : 0.85} transform="rotate(-30)" className="transition-all duration-1000" />
          <line x1="-14" y1="-8" x2="-32" y2="-16" stroke="#1a6e38" strokeWidth="1" opacity={wilted ? 0.3 : 0.5} />
        </g>
        <g transform={`translate(137, 98) rotate(${-droop}, 0, 0)`}>
          <ellipse cx="14" cy="-8" rx="22" ry="12" fill={color} opacity={wilted ? 0.35 : 0.85} transform="rotate(30)" className="transition-all duration-1000" />
          <line x1="14" y1="-8" x2="32" y2="-16" stroke="#1a6e38" strokeWidth="1" opacity={wilted ? 0.3 : 0.5} />
        </g>
        <g transform={`translate(100, 78) rotate(${droop * 0.5}, 0, 0)`}>
          <ellipse cx="0" cy="-18" rx="16" ry="22" fill={color} opacity={wilted ? 0.3 : 0.92} className="transition-all duration-1000" />
          <ellipse cx="-16" cy="-22" rx="12" ry="16" fill={color} opacity={wilted ? 0.25 : 0.82} transform="rotate(-20)" className="transition-all duration-1000" />
          <ellipse cx="16" cy="-22" rx="12" ry="16" fill={color} opacity={wilted ? 0.25 : 0.82} transform="rotate(20)" className="transition-all duration-1000" />
          <line x1="0" y1="-4" x2="0" y2="-36" stroke="#1a6e38" strokeWidth="1.5" opacity={wilted ? 0.3 : 0.65} />
        </g>
        {vibrant && [
          { cx: 70, cy: 70, r: 3, delay: '0s' }, { cx: 135, cy: 80, r: 2, delay: '0.4s' },
          { cx: 55, cy: 110, r: 2, delay: '0.8s' }, { cx: 148, cy: 100, r: 3, delay: '1.2s' },
          { cx: 100, cy: 45, r: 2, delay: '0.6s' },
        ].map((p, i) => (
          <circle key={i} cx={p.cx} cy={p.cy} r={p.r} fill={color} opacity="0">
            <animate attributeName="opacity" values="0;0.7;0" dur="2s" begin={p.delay} repeatCount="indefinite" />
            <animate attributeName="r" values={`${p.r};${p.r * 2};${p.r}`} dur="2s" begin={p.delay} repeatCount="indefinite" />
          </circle>
        ))}
        {droopy && !wilted && [{ x: 68, delay: '0s' }, { x: 80, delay: '0.7s' }].map((d, i) => (
          <g key={i}>
            <ellipse cx={d.x} cy="170" rx="2.5" ry="3.5" fill="#38bdf8" opacity="0">
              <animate attributeName="cy" values="170;195;195" dur="1.5s" begin={d.delay} repeatCount="indefinite" />
              <animate attributeName="opacity" values="0;0.7;0" dur="1.5s" begin={d.delay} repeatCount="indefinite" />
            </ellipse>
          </g>
        ))}
        {wilted && (
          <>
            <path d="M 80 210 L 85 218 L 90 210" stroke="#92400e" strokeWidth="1.5" fill="none" opacity="0.5" />
            <path d="M 105 208 L 112 216 L 118 208" stroke="#92400e" strokeWidth="1.5" fill="none" opacity="0.5" />
          </>
        )}
        {!wilted && (
          <g transform="translate(100, 78)">
            <ellipse cx="0" cy="-18" rx="16" ry="22" fill={color} opacity="0.1">
              <animate attributeName="rx" values="16;19;16" dur={vibrant ? '1.5s' : '3s'} repeatCount="indefinite" />
              <animate attributeName="ry" values="22;26;22" dur={vibrant ? '1.5s' : '3s'} repeatCount="indefinite" />
            </ellipse>
          </g>
        )}
      </svg>
      {/* Score badge — dark text on light bg */}
      <div className="absolute top-2 right-2 text-center" style={{ color }}>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 32, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1 }}>{health}</div>
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.6, fontFamily: "'DM Sans', sans-serif" }}>score</div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Metric Pill — light card style matching dashboard
// ---------------------------------------------------------------------------
function MetricPill({ icon: Icon, label, value, unit, trend, color, pale }: {
  icon: React.ElementType; label: string; value: number | string;
  unit: string; trend?: 'up' | 'down' | 'stable'; color: string; pale: string;
}) {
  return (
    <div style={{
      background: '#fff',
      border: `1px solid rgba(160,130,90,0.16)`,
      borderRadius: 14,
      padding: '12px 16px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      boxShadow: '0 2px 8px rgba(100,70,30,0.05)',
      transition: 'all 0.2s',
      cursor: 'default',
    }}
    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 24px rgba(100,70,30,0.10)'; (e.currentTarget as HTMLElement).style.borderColor = color + '44'; }}
    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = ''; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(160,130,90,0.16)'; }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: pale, border: `1px solid ${color}25` }}>
          <Icon style={{ width: 16, height: 16, color }} />
        </div>
        <span style={{ color: '#5a5040', fontSize: 13, fontWeight: 500, fontFamily: "'DM Sans', sans-serif" }}>{label}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ color: '#1c1a15', fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif", fontSize: 15 }}>
          {typeof value === 'number' ? value.toFixed(1) : value}
          <span style={{ color: '#9a8870', fontSize: 11, marginLeft: 3, fontWeight: 400, fontFamily: "'DM Sans', sans-serif" }}>{unit}</span>
        </span>
        {trend && (
          <span style={{ fontSize: 12, color: trend === 'up' ? '#2d6a4f' : trend === 'down' ? '#dc2626' : '#b0a088' }}>
            {trend === 'up' ? <ArrowUp style={{ width: 12, height: 12, display: 'inline' }} /> :
             trend === 'down' ? <ArrowDown style={{ width: 12, height: 12, display: 'inline' }} /> :
             <Minus style={{ width: 12, height: 12, display: 'inline' }} />}
          </span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------------------
function PlantPerformanceContent() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const plotIdParam  = searchParams?.get('plotId') || 'plot-a';

  const [plots, setPlots]           = useState<Plot[]>([]);
  const [plotsReady, setPlotsReady] = useState(false);
  const activePlot = plots.find(p => p.id === plotIdParam) ?? plots[0];

  const [sensorData, setSensorData] = useState<SensorData>({
    moisture: 62, temperature: 24.5, humidity: 68,
    ph: 6.2, nitrogen: 45, phosphorus: 32, potassium: 188,
  });

  const [aiReport,    setAiReport]    = useState<AIReport | null>(null);
  const [aiLoading,   setAiLoading]   = useState(false);
  const [aiError,     setAiError]     = useState('');
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [timeline]                    = useState(() => buildTimeline());

  const sensorDataRef = useRef(sensorData);
  useEffect(() => { sensorDataRef.current = sensorData; }, [sensorData]);

  const fetchAIReport = useCallback(async (plot: Plot, force = false) => {
    if (!force) {
      const cached = loadCachedReport(plot.id);
      if (cached) { setAiReport(cached); setAiLoading(false); setAiError(''); return; }
    }
    const s = sensorDataRef.current;
    setAiLoading(true); setAiError('');
    try {
      const systemCtx = `You are an expert AI agronomist. Respond ONLY with valid JSON — no prose, no markdown fences.
Schema: {"overallScore":<0-100>,"status":<"thriving"|"good"|"stressed"|"critical">,"headline":<10 words max>,"summary":<2 sentences>,"actions":[{"priority":"high"|"medium"|"low","text":<12 words max>}],"forecast":<1 sentence>}`;
      const prompt = `Crop: ${plot.cropType} ${plot.variety} — ${plot.name}
Sensors: Moisture:${s.moisture.toFixed(1)}% Temp:${s.temperature.toFixed(1)}°C Humidity:${s.humidity.toFixed(1)}% pH:${s.ph.toFixed(1)} N:${s.nitrogen} P:${s.phosphorus} K:${s.potassium} mg/kg. JSON report.`;
      const raw    = await callGroqAI(prompt, systemCtx);
      const report: AIReport = JSON.parse(raw.replace(/```json|```/g, '').trim());
      saveCachedReport(plot.id, report);
      setAiReport(report); setLastRefresh(new Date());
    } catch (e) { setAiError(`Failed to load AI report: ${(e as Error).message}`); }
    finally { setAiLoading(false); }
  }, []);

  const hasFetchedForPlot = useRef<string | null>(null);
  useEffect(() => {
    if (!plotsReady || !activePlot || hasFetchedForPlot.current === activePlot.id) return;
    hasFetchedForPlot.current = activePlot.id;
    fetchAIReport(activePlot, false);
  }, [plotsReady, activePlot?.id]);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    try { unsub = onSnapshot(collection(db, 'plots'), snap => { if (!snap.empty) { setPlots(snap.docs.map(d => d.data() as Plot)); setPlotsReady(true); } }); } catch {}
    return () => unsub?.();
  }, []);

  useEffect(() => {
    try {
      return onSnapshot(doc(db, 'plots', plotIdParam, 'soil_metrics', 'current'), snap => {
        if (snap.exists()) { const d = snap.data(); setSensorData(prev => ({ ...prev, ph: d.ph ?? prev.ph, nitrogen: d.nitrogen ?? prev.nitrogen, phosphorus: d.phosphorus ?? prev.phosphorus, potassium: d.potassium ?? prev.potassium })); }
      });
    } catch {}
  }, [plotIdParam]);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    (async () => {
      try {
        const { startRealtimeUpdates, fetchSensorData } = await import('@/lib/firebase');
        const init = await fetchSensorData();
        setSensorData(prev => ({ ...prev, temperature: parseFloat(init.temperature?.toString() || String(prev.temperature)), humidity: parseFloat(init.humidity?.toString() || String(prev.humidity)), moisture: parseFloat(init.moisture?.toString() || String(prev.moisture)) }));
        unsub = startRealtimeUpdates((data: Record<string, unknown>) => {
          setSensorData(prev => ({ ...prev, temperature: parseFloat(data.temperature?.toString() || String(prev.temperature)), humidity: parseFloat(data.humidity?.toString() || String(prev.humidity)), moisture: parseFloat(data.moisture?.toString() || String(prev.moisture)) }));
        });
      } catch {}
    })();
    return () => unsub?.();
  }, []);

  const status      = computeHealth(sensorData);
  const meta        = healthMeta[status];
  const radarData   = buildRadarData(sensorData);
  const healthScore = Math.round(radarData.reduce((acc, d) => acc + d.A, 0) / radarData.length);

  // Priority badge styles — light versions
  const priorityStyle: Record<string, React.CSSProperties> = {
    high:   { background: '#fee2e2', border: '1px solid #fecaca', color: '#991b1b' },
    medium: { background: '#fef3c7', border: '1px solid #fde68a', color: '#92400e' },
    low:    { background: '#d8f3dc', border: '1px solid #b7e4c7', color: '#2d6a4f' },
  };

  const timestampLabel = lastRefresh ? `Refreshed ${lastRefresh.toLocaleTimeString()}` : aiReport ? 'Loaded from cache' : '';

  // Card base style matching dashboard
  const cardBase: React.CSSProperties = {
    border: '1px solid rgba(160,130,90,0.16)',
    borderRadius: 18,
    boxShadow: '0 2px 12px rgba(100,70,30,0.06)',
    background: '#fff',
  };

  // Tinted card variants
  const cardPlant: React.CSSProperties  = { ...cardBase, background: meta.headerBg, borderColor: meta.border };
  const cardAI: React.CSSProperties     = { ...cardBase, background: 'linear-gradient(160deg, #f5f7ff 0%, #f8f5ff 100%)', borderColor: 'rgba(124,58,237,0.14)' };
  const cardRadar: React.CSSProperties  = { ...cardBase, background: 'linear-gradient(155deg, #fdf8f2 0%, #faf5ec 100%)', borderColor: 'rgba(160,100,40,0.2)' };
  const cardChart: React.CSSProperties  = { ...cardBase, background: 'linear-gradient(160deg, #f6fbf7 0%, #faf9f5 100%)', borderColor: 'rgba(45,106,79,0.14)' };
  const cardCheck: React.CSSProperties  = { ...cardBase, background: 'linear-gradient(155deg, #f3fbf5 0%, #eef8f0 100%)', borderColor: 'rgba(45,106,79,0.16)' };

  return (
    <div style={{ minHeight: '100vh', background: '#f9f5ef', fontFamily: "'DM Sans', 'Segoe UI', sans-serif", color: '#1c1a15' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,300&family=Space+Grotesk:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: #f2ece0; }
        ::-webkit-scrollbar-thumb { background: #d4c4a8; border-radius: 2px; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }
        @keyframes shimmer { from{background-position:-200% 0} to{background-position:200% 0} }
        @keyframes pls { 0%,100%{opacity:1} 50%{opacity:0.4} }
        .pls { animation: pls 2s infinite; }
        .float { animation: float 4s ease-in-out infinite; }
        .shimmer-bar {
          background: linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.55) 50%, rgba(255,255,255,0) 100%);
          background-size: 200% 100%;
          animation: shimmer 2s infinite;
        }
        .ptrack { width:100%; height:6px; background:#ede4d3; border-radius:100px; overflow:hidden; }
        .pfill  { height:100%; border-radius:100px; transition: width 1.2s cubic-bezier(.34,1.56,.64,1); }
      `}</style>

      {/* ── Header — light, matching dashboard ─────────────────────────────── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 50, height: 60,
        background: 'rgba(249,245,239,0.92)', backdropFilter: 'blur(14px)',
        borderBottom: '1px solid rgba(160,130,90,0.14)',
        display: 'flex', alignItems: 'center', padding: '0 24px', gap: 14,
      }}>
        <button type="button"
          style={{ display: 'none', padding: 8, borderRadius: 8, background: 'transparent', border: 'none', cursor: 'pointer', color: '#9a8870' }}
          className="lg:hidden">
          <Menu style={{ width: 20, height: 20 }} />
        </button>

        {/* Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#9a8870', fontFamily: "'DM Sans', sans-serif" }}>
          <Sprout style={{ width: 15, height: 15 }} />
          <button onClick={() => router.push('/dashboard')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9a8870', fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 500 }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#1c1a15'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#9a8870'}>
            Farm Dashboard
          </button>
          <ChevronRight style={{ width: 13, height: 13 }} />
          <span style={{ color: meta.color, fontWeight: 600, fontFamily: "'DM Sans', sans-serif" }}>Plant Performance</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto' }}>
          {/* Status badge */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '5px 13px',
            borderRadius: 100, fontSize: 12, fontWeight: 700, fontFamily: "'DM Sans', sans-serif",
            background: meta.badgeBg, color: meta.badgeText, border: `1px solid ${meta.badgeBorder}`,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: meta.color, display: 'inline-block' }} className="pls" />
            {meta.label}
          </div>

          {/* Refresh button */}
          <button onClick={() => activePlot && fetchAIReport(activePlot, true)} disabled={aiLoading || !activePlot}
            style={{
              display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px',
              borderRadius: 100, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              fontFamily: "'DM Sans', sans-serif",
              background: '#fff', border: '1px solid rgba(160,130,90,0.22)', color: '#5a5040',
              transition: 'all .15s', opacity: (aiLoading || !activePlot) ? 0.5 : 1,
            }}
            onMouseEnter={e => { if (!aiLoading) (e.currentTarget as HTMLElement).style.background = '#f2ece0'; }}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#fff'}>
            <RefreshCw style={{ width: 14, height: 14, color: meta.color, animation: aiLoading ? 'spin 1s linear infinite' : 'none' }} />
            <span>{aiLoading ? 'Analyzing…' : 'Refresh AI'}</span>
          </button>
        </div>
      </header>

      {/* ── Main Content ────────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '28px 24px 60px' }}>

        {/* ── Page heading ── */}
        <div style={{ marginBottom: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 11px',
              borderRadius: 100, fontSize: 11, fontWeight: 700,
              background: meta.badgeBg, color: meta.badgeText, border: `1px solid ${meta.badgeBorder}`,
              fontFamily: "'DM Sans', sans-serif",
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: meta.color, display: 'inline-block' }} className="pls" />
              REAL-TIME DIAGNOSTICS
            </span>
            <span style={{ fontSize: 11.5, color: '#9a8870', fontFamily: "'DM Sans', sans-serif" }}>LLaMA 3.3 70B</span>
          </div>
          <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 32, fontWeight: 700, color: '#1c1a15', letterSpacing: '-0.02em', lineHeight: 1.1, marginBottom: 6 }}>
            {activePlot?.name} · <span style={{ color: meta.color }}>{activePlot?.cropType}</span>
          </h1>
          <p style={{ fontSize: 13.5, color: '#9a8870', fontFamily: "'DM Sans', sans-serif" }}>
            {activePlot?.variety} · {activePlot?.area} · AI-powered plant health analysis
          </p>
        </div>

        {/* ── Plant + AI Report ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16, marginBottom: 22 }}>

          {/* Plant card */}
          <div style={{ ...cardPlant, overflow: 'hidden', transition: 'all 0.2s' }}>
            {/* Accent line */}
            <div style={{ height: 3, width: '100%', background: `linear-gradient(90deg, ${meta.color}, ${meta.color}40, transparent)`, borderRadius: '18px 18px 0 0' }} />

            <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(160,130,90,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Leaf style={{ width: 15, height: 15, color: meta.color }} />
                <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 14, color: '#1c1a15' }}>Live Plant Monitor</span>
              </div>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '3px 11px', borderRadius: 100,
                fontSize: 11, fontWeight: 700, fontFamily: "'DM Sans', sans-serif",
                background: meta.badgeBg, color: meta.badgeText, border: `1px solid ${meta.badgeBorder}`,
              }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: meta.color, display: 'inline-block' }} className="pls" />
                {meta.label}
              </div>
            </div>

            <div style={{ height: 288, display: 'flex', alignItems: 'flex-end', padding: '16px 24px 0' }}
              className="float">
              <PlantAnimation status={status} moisture={sensorData.moisture} health={healthScore} />
            </div>

            <div style={{ padding: '14px 20px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { label: 'Soil Moisture', value: sensorData.moisture, max: 100, unit: '%', color: '#2563eb' },
                { label: 'Temperature',   value: sensorData.temperature, max: 40, unit: '°C', color: '#f97316' },
              ].map(m => (
                <div key={m.label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
                    <span style={{ color: '#9a8870', fontFamily: "'DM Sans', sans-serif" }}>{m.label}</span>
                    <span style={{ fontWeight: 700, color: '#1c1a15', fontFamily: "'Space Grotesk', sans-serif" }}>{m.value.toFixed(1)}{m.unit}</span>
                  </div>
                  <div className="ptrack">
                    <div className="pfill shimmer-bar" style={{ width: `${(m.value / m.max) * 100}%`, background: m.color, position: 'relative', overflow: 'hidden' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* AI Report card */}
          <div style={{ ...cardAI, display: 'flex', flexDirection: 'column', overflow: 'hidden', transition: 'all 0.2s' }}>
            <div style={{ height: 3, width: '100%', background: 'linear-gradient(90deg, #7c3aed, #7c3aed40, transparent)', borderRadius: '18px 18px 0 0' }} />

            <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(124,58,237,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Brain style={{ width: 15, height: 15, color: '#7c3aed' }} />
                <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 14, color: '#1c1a15' }}>AI Crop Diagnosis</span>
              </div>
              {timestampLabel && <span style={{ fontSize: 11, color: '#b0a088', fontFamily: "'DM Sans', sans-serif" }}>{timestampLabel}</span>}
            </div>

            <div style={{ flex: 1, padding: 20 }}>
              {aiLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 14, padding: '48px 0' }}>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', border: `2px solid ${meta.border}`, borderTopColor: meta.color, animation: 'spin 1s linear infinite' }} />
                  <p style={{ color: '#9a8870', fontSize: 13, fontFamily: "'DM Sans', sans-serif" }}>Analyzing plant health…</p>
                </div>
              ) : aiError ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 14, background: '#fee2e2', border: '1px solid #fecaca', borderRadius: 12 }}>
                  <AlertTriangle style={{ width: 18, height: 18, color: '#dc2626', flexShrink: 0 }} />
                  <p style={{ fontSize: 13, color: '#991b1b', fontFamily: "'DM Sans', sans-serif" }}>{aiError}</p>
                </div>
              ) : aiReport ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                  {/* Score + headline */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 18 }}>
                    <div style={{ flexShrink: 0 }}>
                      <svg viewBox="0 0 80 80" style={{ width: 80, height: 80 }}>
                        <circle cx="40" cy="40" r="34" fill="none" stroke="#ede4d3" strokeWidth="7" />
                        <circle cx="40" cy="40" r="34" fill="none" stroke={meta.color} strokeWidth="7"
                          strokeLinecap="round"
                          strokeDasharray={`${(aiReport.overallScore / 100) * 213.6} 213.6`}
                          strokeDashoffset="53.4"
                          style={{ transition: 'all 1s', filter: `drop-shadow(0 0 4px ${meta.color}50)` }} />
                        <text x="40" y="44" textAnchor="middle" fontSize="18" fontWeight="800" fill="#1c1a15"
                          fontFamily="'Space Grotesk',monospace">{aiReport.overallScore}</text>
                      </svg>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 100,
                        fontSize: 11, fontWeight: 700, marginBottom: 8, fontFamily: "'DM Sans', sans-serif",
                        background: meta.badgeBg, color: meta.badgeText, border: `1px solid ${meta.badgeBorder}`,
                      }}>
                        <Activity style={{ width: 11, height: 11 }} />
                        {aiReport.status.charAt(0).toUpperCase() + aiReport.status.slice(1)}
                      </div>
                      <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 700, color: '#1c1a15', lineHeight: 1.2, marginBottom: 6 }}>{aiReport.headline}</h2>
                      <p style={{ fontSize: 13, color: '#5a5040', lineHeight: 1.6, fontFamily: "'DM Sans', sans-serif" }}>{aiReport.summary}</p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: '#9a8870', textTransform: 'uppercase', letterSpacing: '0.07em', fontFamily: "'DM Sans', sans-serif", marginBottom: 2 }}>Recommended Actions</p>
                    {aiReport.actions.map((action, i) => (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                        borderRadius: 11, fontSize: 13, fontFamily: "'DM Sans', sans-serif",
                        ...priorityStyle[action.priority],
                      }}>
                        <span style={{ width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, background: 'rgba(255,255,255,0.5)', flexShrink: 0, fontFamily: "'Space Grotesk', sans-serif" }}>{i + 1}</span>
                        {action.text}
                        <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', opacity: 0.65, fontFamily: "'DM Sans', sans-serif" }}>{action.priority}</span>
                      </div>
                    ))}
                  </div>

                  {/* Forecast */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: 14, borderRadius: 12, background: '#f0faf2', border: '1px solid #b7e4c7' }}>
                    <TrendingUp style={{ width: 18, height: 18, color: '#2d6a4f', flexShrink: 0, marginTop: 2 }} />
                    <div>
                      <p style={{ fontSize: 11, fontWeight: 700, color: '#2d6a4f', marginBottom: 3, fontFamily: "'DM Sans', sans-serif" }}>Yield Forecast</p>
                      <p style={{ fontSize: 13, color: '#1c1a15', lineHeight: 1.5, fontFamily: "'DM Sans', sans-serif" }}>{aiReport.forecast}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 14, padding: '48px 0' }}>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', border: `2px solid ${meta.border}`, borderTopColor: meta.color, animation: 'spin 1s linear infinite' }} />
                  <p style={{ color: '#9a8870', fontSize: 13, fontFamily: "'DM Sans', sans-serif" }}>Loading plot data…</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Sensor metric pills ── */}
        <div style={{ marginBottom: 22 }}>
          <h2 style={{ fontSize: 11.5, fontWeight: 700, color: '#9a8870', textTransform: 'uppercase', letterSpacing: '0.07em', fontFamily: "'DM Sans', sans-serif", marginBottom: 12 }}>Live Sensor Readings</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            <MetricPill icon={Droplets}    label="Soil Moisture"  value={sensorData.moisture}    unit="%" trend="stable" color="#2563eb" pale="#eff6ff" />
            <MetricPill icon={Thermometer} label="Temperature"    value={sensorData.temperature} unit="°C" trend="down"  color="#f97316" pale="#fff7ed" />
            <MetricPill icon={Waves}       label="Humidity"       value={sensorData.humidity}    unit="%" trend="stable" color="#0891b2" pale="#ecfeff" />
            <MetricPill icon={FlaskConical}label="Soil pH"        value={sensorData.ph}          unit="pH" trend="stable" color="#7c3aed" pale="#f5f3ff" />
            <MetricPill icon={Zap}         label="Nitrogen (N)"   value={sensorData.nitrogen}    unit="mg/kg" trend="down" color="#dc2626" pale="#fff1f2" />
            <MetricPill icon={Leaf}        label="Phosphorus (P)" value={sensorData.phosphorus}  unit="mg/kg" trend="up"   color="#16a34a" pale="#f0fdf4" />
            <MetricPill icon={Sun}         label="Potassium (K)"  value={sensorData.potassium}   unit="mg/kg" trend="up"   color="#d97706" pale="#fffbeb" />
            <MetricPill icon={Wind}        label="Health Score"   value={healthScore}            unit="/100" color={meta.color} pale={meta.pale} />
          </div>
        </div>

        {/* ── Charts row ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 22 }}>

          {/* Radar — earthy terracotta-cream */}
          <div style={{ ...cardRadar, padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
              <BarChart3 style={{ width: 15, height: 15, color: meta.color }} />
              <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 15, color: '#1c1a15' }}>Nutrient & Condition Profile</h3>
            </div>
            <div style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
                  <PolarGrid stroke="rgba(160,130,90,0.2)" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: '#9a8870', fontSize: 12, fontWeight: 500, fontFamily: "'DM Sans', sans-serif" }} />
                  <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar name="Current" dataKey="A" stroke={meta.color} fill={meta.color} fillOpacity={0.12} strokeWidth={2.5} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Area chart — sage green */}
          <div style={{ ...cardChart, padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <TrendingUp style={{ width: 15, height: 15, color: '#2d6a4f' }} />
                <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 15, color: '#1c1a15' }}>14-Day Growth Trend</h3>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12, color: '#9a8870', fontFamily: "'DM Sans', sans-serif" }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#40916c', display: 'inline-block' }} /> Height
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#7c3aed', display: 'inline-block' }} /> Health
                </span>
              </div>
            </div>
            <div style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timeline}>
                  <defs>
                    <linearGradient id="gradHLight" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#40916c" stopOpacity={0.18} /><stop offset="95%" stopColor="#40916c" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradHlthLight" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.15} /><stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(160,130,90,0.12)" vertical={false} />
                  <XAxis dataKey="day" stroke="#d4c4a8" tick={{ fill: '#b0a088', fontSize: 11, fontFamily: "'DM Sans', sans-serif" }} tickLine={false} axisLine={{ stroke: 'rgba(160,130,90,0.2)' }} />
                  <YAxis stroke="#d4c4a8" tick={{ fill: '#b0a088', fontSize: 11, fontFamily: "'DM Sans', sans-serif" }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ background: '#fff', border: '1px solid rgba(160,130,90,0.2)', borderRadius: 12, fontFamily: "'DM Sans', sans-serif", fontSize: 12, boxShadow: '0 8px 24px rgba(100,70,30,0.12)', color: '#1c1a15' }} />
                  <Area type="monotone" dataKey="height" name="Height (cm)" stroke="#40916c" fill="url(#gradHLight)" strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: '#40916c', strokeWidth: 0 }} />
                  <Area type="monotone" dataKey="health" name="Health Score" stroke="#7c3aed" fill="url(#gradHlthLight)" strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: '#7c3aed', strokeWidth: 0 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* ── Optimal Conditions Checklist ── */}
        <div style={{ ...cardCheck, padding: 24, marginBottom: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
            <CheckCircle style={{ width: 15, height: 15, color: '#2d6a4f' }} />
            <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 15, color: '#1c1a15' }}>Optimal Conditions Checklist</h3>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            {[
              { label: 'Soil Moisture (35–70%)',  val: sensorData.moisture,    ok: sensorData.moisture >= 35    && sensorData.moisture <= 70    },
              { label: 'Temperature (18–30°C)',    val: sensorData.temperature, ok: sensorData.temperature >= 18 && sensorData.temperature <= 30 },
              { label: 'Humidity (45–80%)',        val: sensorData.humidity,    ok: sensorData.humidity >= 45   && sensorData.humidity <= 80    },
              { label: 'Soil pH (6.0–7.0)',        val: sensorData.ph,          ok: sensorData.ph >= 6.0        && sensorData.ph <= 7.0         },
              { label: 'Nitrogen (>60 mg/kg)',     val: sensorData.nitrogen,    ok: sensorData.nitrogen >= 60                                   },
              { label: 'Phosphorus (>25 mg/kg)',   val: sensorData.phosphorus,  ok: sensorData.phosphorus >= 25                                 },
              { label: 'Potassium (>150 mg/kg)',   val: sensorData.potassium,   ok: sensorData.potassium >= 150                                 },
            ].map((check, i) => (
              <div key={i}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '11px 14px', borderRadius: 12, transition: 'all .15s',
                  background: check.ok ? '#f0faf2' : '#fff1f2',
                  border: `1px solid ${check.ok ? '#b7e4c7' : '#fecaca'}`,
                }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 12px rgba(100,70,30,0.08)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.boxShadow = ''}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {check.ok
                    ? <CheckCircle style={{ width: 14, height: 14, color: '#2d6a4f', flexShrink: 0 }} />
                    : <AlertTriangle style={{ width: 14, height: 14, color: '#dc2626', flexShrink: 0 }} />}
                  <span style={{ fontSize: 12.5, color: '#1c1a15', fontFamily: "'DM Sans', sans-serif" }}>{check.label}</span>
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif", color: check.ok ? '#2d6a4f' : '#dc2626' }}>
                  {typeof check.val === 'number' ? check.val.toFixed(1) : check.val}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Footer note ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#b0a088', fontSize: 12, paddingBottom: 8, fontFamily: "'DM Sans', sans-serif" }}>
          <Info style={{ width: 13, height: 13, flexShrink: 0 }} />
          <span>Plant animation and health indicators update in real-time from sensor data. AI diagnostics powered by Groq (llama-3.3-70b). Reports are cached locally and only refreshed on demand.</span>
        </div>
      </div>
    </div>
  );
}

function PlantPerformanceFallback() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9f5ef' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 44, height: 44, borderRadius: '50%', border: '2px solid rgba(45,106,79,0.2)', borderTopColor: '#2d6a4f', animation: 'spin 1s linear infinite' }} />
        <p style={{ color: '#9a8870', fontSize: 13, fontFamily: "'DM Sans', sans-serif" }}>Loading plant data…</p>
      </div>
    </div>
  );
}

export default function PlantPerformancePage() {
  return (
    <Suspense fallback={<PlantPerformanceFallback />}>
      <PlantPerformanceContent />
    </Suspense>
  );
}