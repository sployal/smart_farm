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
  BarChart3, Info, ArrowUp, ArrowDown, Minus, Menu
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
  moisture: number;
  temperature: number;
  humidity: number;
  ph: number;
  nitrogen: number;
  phosphorus: number;
  potassium: number;
};

type HealthStatus = 'thriving' | 'good' | 'stressed' | 'critical';

type AIReport = {
  overallScore: number;
  status: HealthStatus;
  headline: string;
  summary: string;
  actions: { priority: 'high' | 'medium' | 'low'; text: string }[];
  forecast: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function callGroqAI(prompt: string, system: string): Promise<string> {
  if (!AI_API_KEY) return JSON.stringify({
    overallScore: 78,
    status: 'good',
    headline: 'Plants are growing steadily',
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
    body: JSON.stringify({
      model: AI_MODEL,
      messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }],
      temperature: 0.6, max_tokens: 700
    })
  });

  if (!res.ok) throw new Error(`Groq API error ${res.status}`);
  const d = await res.json();
  return d?.choices?.[0]?.message?.content ?? '{}';
}

function computeHealth(s: SensorData): HealthStatus {
  const scores = [
    s.moisture  >= 35 && s.moisture  <= 70  ? 2 : s.moisture >= 20 ? 1 : 0,
    s.temperature >= 18 && s.temperature <= 30 ? 2 : s.temperature >= 10 ? 1 : 0,
    s.humidity  >= 45 && s.humidity   <= 80  ? 2 : s.humidity  >= 30 ? 1 : 0,
    s.ph        >= 6.0 && s.ph        <= 7.0  ? 2 : s.ph >= 5.5 ? 1 : 0,
    s.nitrogen  >= 60                         ? 2 : s.nitrogen >= 40 ? 1 : 0,
  ];
  const total = scores.reduce((a, b) => a + b, 0);
  if (total >= 9)  return 'thriving';
  if (total >= 7)  return 'good';
  if (total >= 4)  return 'stressed';
  return 'critical';
}

const healthMeta: Record<HealthStatus, { label: string; color: string; glow: string; bg: string }> = {
  thriving: { label: 'Thriving',  color: '#10b981', glow: '#10b98166', bg: 'from-emerald-950 to-slate-950' },
  good:     { label: 'Good',      color: '#06b6d4', glow: '#06b6d466', bg: 'from-cyan-950 to-slate-950'    },
  stressed: { label: 'Stressed',  color: '#f59e0b', glow: '#f59e0b66', bg: 'from-amber-950 to-slate-950'   },
  critical: { label: 'Critical',  color: '#ef4444', glow: '#ef444466', bg: 'from-red-950 to-slate-950'     },
};

function cn(...classes: (string | undefined | false | null)[]) {
  return classes.filter(Boolean).join(' ');
}

// ---------------------------------------------------------------------------
// Animated Plant SVG (sensor-driven)
// ---------------------------------------------------------------------------
function PlantAnimation({ status, moisture, health }: {
  status: HealthStatus;
  moisture: number;
  health: number;
}) {
  const color   = healthMeta[status].color;
  const glow    = healthMeta[status].glow;
  const droopy  = status === 'stressed' || status === 'critical';
  const wilted  = status === 'critical';
  const vibrant = status === 'thriving';
  const waterLevel = Math.min(100, Math.max(5, moisture));
  const droop = wilted ? 40 : droopy ? 20 : vibrant ? -10 : 0;

  return (
    <div className="relative flex items-end justify-center w-full h-full">
      <div
        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-48 h-48 rounded-full blur-3xl opacity-30 transition-all duration-1000"
        style={{ background: glow }}
      />
      <svg
        viewBox="0 0 200 280"
        className="w-full max-w-[200px] drop-shadow-2xl"
        style={{ filter: `drop-shadow(0 0 18px ${glow})` }}
      >
        <defs>
          <linearGradient id="potGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#78350f" />
            <stop offset="100%" stopColor="#451a03" />
          </linearGradient>
          <linearGradient id="soilGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#713f12" />
            <stop offset="100%" stopColor="#92400e" />
          </linearGradient>
          <linearGradient id="waterGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#0369a1" stopOpacity="0.9" />
          </linearGradient>
          <linearGradient id="stemGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#166534" />
            <stop offset="100%" stopColor="#15803d" />
          </linearGradient>
          <clipPath id="potClip">
            <path d="M 62 205 L 68 245 Q 100 252 132 245 L 138 205 Z" />
          </clipPath>
        </defs>
        <path d="M 62 205 L 68 245 Q 100 252 132 245 L 138 205 Z" fill="url(#potGrad)" />
        <rect x="55" y="198" width="90" height="12" rx="6" fill="#92400e" />
        <ellipse cx="100" cy="203" rx="41" ry="8" fill="url(#soilGrad)" />
        <rect
          x="68" y={245 - (waterLevel / 100) * 32}
          width="64" height={(waterLevel / 100) * 32}
          fill="url(#waterGrad)"
          clipPath="url(#potClip)"
          className="transition-all duration-1000"
        />
        {moisture > 50 && (
          <ellipse cx="100" cy="218" rx="20" ry="3" fill="#38bdf8" opacity="0.3">
            <animate attributeName="rx" values="20;28;20" dur="2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.3;0;0.3" dur="2s" repeatCount="indefinite" />
          </ellipse>
        )}
        <path
          d={droopy
            ? "M 100 200 C 100 180 98 160 97 140 C 96 120 98 100 97 85"
            : "M 100 200 C 100 175 101 155 100 135 C 99 115 100 95 100 78"}
          stroke="url(#stemGrad)" strokeWidth="5" fill="none" strokeLinecap="round"
          className="transition-all duration-1000"
        />
        <path
          d={droopy ? "M 99 145 C 85 138 75 128 62 118" : "M 100 148 C 86 140 76 128 65 115"}
          stroke="url(#stemGrad)" strokeWidth="3.5" fill="none" strokeLinecap="round"
        />
        <path
          d={droopy ? "M 99 130 C 113 122 123 112 136 105" : "M 100 132 C 114 124 124 112 137 98"}
          stroke="url(#stemGrad)" strokeWidth="3.5" fill="none" strokeLinecap="round"
        />
        <g transform={`translate(65, 115) rotate(${droop}, 0, 0)`}>
          <ellipse cx="-14" cy="-8" rx="22" ry="12" fill={color}
            opacity={wilted ? 0.4 : 0.9} transform="rotate(-30)" className="transition-all duration-1000" />
          <line x1="-14" y1="-8" x2="-32" y2="-16"
            stroke="#166534" strokeWidth="1" opacity={wilted ? 0.3 : 0.6} />
        </g>
        <g transform={`translate(137, 98) rotate(${-droop}, 0, 0)`}>
          <ellipse cx="14" cy="-8" rx="22" ry="12" fill={color}
            opacity={wilted ? 0.4 : 0.9} transform="rotate(30)" className="transition-all duration-1000" />
          <line x1="14" y1="-8" x2="32" y2="-16"
            stroke="#166534" strokeWidth="1" opacity={wilted ? 0.3 : 0.6} />
        </g>
        <g transform={`translate(100, 78) rotate(${droop * 0.5}, 0, 0)`}>
          <ellipse cx="0" cy="-18" rx="16" ry="22" fill={color}
            opacity={wilted ? 0.35 : 0.95} className="transition-all duration-1000" />
          <ellipse cx="-16" cy="-22" rx="12" ry="16" fill={color}
            opacity={wilted ? 0.3 : 0.85} transform="rotate(-20)" className="transition-all duration-1000" />
          <ellipse cx="16" cy="-22" rx="12" ry="16" fill={color}
            opacity={wilted ? 0.3 : 0.85} transform="rotate(20)" className="transition-all duration-1000" />
          <line x1="0" y1="-4" x2="0" y2="-36"
            stroke="#166534" strokeWidth="1.5" opacity={wilted ? 0.3 : 0.7} />
        </g>
        {vibrant && (
          <>
            {[
              { cx: 70,  cy: 70,  r: 3, delay: '0s'   },
              { cx: 135, cy: 80,  r: 2, delay: '0.4s' },
              { cx: 55,  cy: 110, r: 2, delay: '0.8s' },
              { cx: 148, cy: 100, r: 3, delay: '1.2s' },
              { cx: 100, cy: 45,  r: 2, delay: '0.6s' },
            ].map((p, i) => (
              <circle key={i} cx={p.cx} cy={p.cy} r={p.r} fill={color} opacity="0">
                <animate attributeName="opacity" values="0;1;0" dur="2s" begin={p.delay} repeatCount="indefinite" />
                <animate attributeName="r" values={`${p.r};${p.r * 2};${p.r}`} dur="2s" begin={p.delay} repeatCount="indefinite" />
              </circle>
            ))}
          </>
        )}
        {(droopy && !wilted) && (
          <>
            {[{ x: 68, delay: '0s' }, { x: 80, delay: '0.7s' }].map((d, i) => (
              <g key={i}>
                <ellipse cx={d.x} cy="170" rx="2.5" ry="3.5" fill="#38bdf8" opacity="0">
                  <animate attributeName="cy" values="170;195;195" dur="1.5s" begin={d.delay} repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0;0.8;0" dur="1.5s" begin={d.delay} repeatCount="indefinite" />
                </ellipse>
              </g>
            ))}
          </>
        )}
        {wilted && (
          <>
            <path d="M 80 210 L 85 218 L 90 210" stroke="#92400e" strokeWidth="1.5" fill="none" opacity="0.6" />
            <path d="M 105 208 L 112 216 L 118 208" stroke="#92400e" strokeWidth="1.5" fill="none" opacity="0.6" />
          </>
        )}
        {!wilted && (
          <g transform="translate(100, 78)">
            <ellipse cx="0" cy="-18" rx="16" ry="22" fill={color} opacity="0.12">
              <animate attributeName="rx" values="16;19;16" dur={vibrant ? '1.5s' : '3s'} repeatCount="indefinite" />
              <animate attributeName="ry" values="22;26;22" dur={vibrant ? '1.5s' : '3s'} repeatCount="indefinite" />
            </ellipse>
          </g>
        )}
      </svg>
      <div className="absolute top-2 right-2 text-center" style={{ color }}>
        <div className="text-3xl font-black tabular-nums leading-none">{health}</div>
        <div className="text-[10px] font-semibold uppercase tracking-widest opacity-70">score</div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Metric Pill
// ---------------------------------------------------------------------------
function MetricPill({
  icon: Icon, label, value, unit, trend, color
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  unit: string;
  trend?: 'up' | 'down' | 'stable';
  color: string;
}) {
  return (
    <div className="flex items-center justify-between border rounded-xl px-4 py-3 gap-3 hover:border-slate-600 transition-all group"
      style={{ background: 'rgba(30,41,59,0.6)', borderColor: 'rgba(71,85,105,0.3)' }}>
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: `${color}18`, border: `1px solid ${color}30` }}>
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
        <span className="text-slate-400 text-sm font-medium">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-slate-100 font-bold tabular-nums">
          {typeof value === 'number' ? value.toFixed(1) : value}
          <span className="text-slate-500 text-xs ml-1 font-normal">{unit}</span>
        </span>
        {trend && (
          <span className={cn(
            'text-xs',
            trend === 'up'   ? 'text-emerald-400' :
            trend === 'down' ? 'text-red-400'     : 'text-slate-500'
          )}>
            {trend === 'up'   ? <ArrowUp className="w-3 h-3 inline" /> :
             trend === 'down' ? <ArrowDown className="w-3 h-3 inline" /> :
             <Minus className="w-3 h-3 inline" />}
          </span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Radar data builder
// ---------------------------------------------------------------------------
function buildRadarData(s: SensorData) {
  return [
    { subject: 'Moisture',    A: Math.min(100, (s.moisture  / 70) * 100),  fullMark: 100 },
    { subject: 'Temperature', A: Math.min(100, (s.temperature / 30) * 100), fullMark: 100 },
    { subject: 'Humidity',    A: Math.min(100, (s.humidity  / 80) * 100),  fullMark: 100 },
    { subject: 'pH',          A: Math.min(100, ((s.ph - 4)  / 4) * 100),   fullMark: 100 },
    { subject: 'Nitrogen',    A: Math.min(100, (s.nitrogen  / 90) * 100),  fullMark: 100 },
    { subject: 'Potassium',   A: Math.min(100, (s.potassium / 250) * 100), fullMark: 100 },
  ];
}

function buildGrowthTimeline(s: SensorData) {
  return Array.from({ length: 14 }, (_, i) => ({
    day: `D${i + 1}`,
    height: Math.round(2 + i * 1.4 + Math.random() * 1.5),
    health: Math.round(60 + (Math.random() - 0.3) * 20 + (i / 14) * 10),
  }));
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type Plot = {
  id: string; name: string; cropType: string; variety: string;
  area: string; plantedDate: string; harvestDate: string;
};

const DEFAULT_PLOTS: Plot[] = [
  { id: 'plot-a', name: 'Plot A', cropType: 'Tomatoes', variety: 'Roma VF',    area: '0.5 ha', plantedDate: '2025-12-01', harvestDate: '2026-03-01' },
  { id: 'plot-b', name: 'Plot B', cropType: 'Maize',    variety: 'H614D',      area: '1.2 ha', plantedDate: '2025-11-15', harvestDate: '2026-02-20' },
  { id: 'plot-c', name: 'Plot C', cropType: 'Beans',    variety: 'Rose Coco',  area: '0.8 ha', plantedDate: '2025-12-20', harvestDate: '2026-02-28' },
];

// ---------------------------------------------------------------------------
// INNER component — the one that actually calls useSearchParams()
// This must be wrapped in <Suspense> to satisfy Next.js static prerendering.
// ---------------------------------------------------------------------------
function PlantPerformanceContent() {
  const router       = useRouter();
  const searchParams = useSearchParams();               // ← the problematic hook
  const plotIdParam  = searchParams?.get('plotId') || 'plot-a';

  const [plots, setPlots]           = useState<Plot[]>(DEFAULT_PLOTS);
  const activePlot                  = plots.find(p => p.id === plotIdParam) ?? plots[0];

  const [sensorData, setSensorData] = useState<SensorData>({
    moisture:    62,
    temperature: 24.5,
    humidity:    68,
    ph:          6.2,
    nitrogen:    45,
    phosphorus:  32,
    potassium:   188,
  });

  const [aiReport,    setAiReport]    = useState<AIReport | null>(null);
  const [aiLoading,   setAiLoading]   = useState(false);
  const [aiError,     setAiError]     = useState('');
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [timeline]                    = useState(() => buildGrowthTimeline(sensorData));

  const status      = computeHealth(sensorData);
  const meta        = healthMeta[status];
  const radarData   = buildRadarData(sensorData);
  const healthScore = Math.round(radarData.reduce((acc, d) => acc + d.A, 0) / radarData.length);

  const fetchAIReport = useCallback(async () => {
    setAiLoading(true);
    setAiError('');
    try {
      const systemCtx = `
You are an expert AI agronomist. Respond ONLY with valid JSON — no prose, no markdown fences.
Schema:
{
  "overallScore": <0-100 integer>,
  "status": <"thriving"|"good"|"stressed"|"critical">,
  "headline": <10 words max>,
  "summary": <2 sentences, plain text>,
  "actions": [
    { "priority": "high"|"medium"|"low", "text": <concise action, max 12 words> },
    ...up to 4 actions
  ],
  "forecast": <1 sentence harvest or yield forecast>
}`.trim();

      const prompt = `
Crop: ${activePlot.cropType} ${activePlot.variety} — ${activePlot.name}, Kenya highlands.
Sensors:
  Moisture: ${sensorData.moisture.toFixed(1)}%
  Temperature: ${sensorData.temperature.toFixed(1)}°C
  Humidity: ${sensorData.humidity.toFixed(1)}%
  pH: ${sensorData.ph.toFixed(1)}
  Nitrogen: ${sensorData.nitrogen} mg/kg
  Phosphorus: ${sensorData.phosphorus} mg/kg
  Potassium: ${sensorData.potassium} mg/kg
Produce a JSON plant-health report.`.trim();

      const raw    = await callGroqAI(prompt, systemCtx);
      const clean  = raw.replace(/```json|```/g, '').trim();
      const report: AIReport = JSON.parse(clean);
      setAiReport(report);
      setLastRefresh(new Date());
    } catch (e) {
      setAiError(`Failed to load AI report: ${(e as Error).message}`);
    } finally {
      setAiLoading(false);
    }
  }, [sensorData, activePlot]);

  useEffect(() => { fetchAIReport(); }, [fetchAIReport]);

  // Load plots from Firebase
  useEffect(() => {
    try {
      return onSnapshot(collection(db, 'plots'), snap => {
        if (!snap.empty) setPlots(snap.docs.map(d => d.data() as Plot));
      });
    } catch { /* Firebase not configured */ }
  }, []);

  // Firebase soil metrics listener
  useEffect(() => {
    try {
      return onSnapshot(doc(db, 'plots', plotIdParam, 'soil_metrics', 'current'), snap => {
        if (snap.exists()) {
          const d = snap.data();
          setSensorData(prev => ({
            ...prev,
            ph:         d.ph         ?? prev.ph,
            nitrogen:   d.nitrogen   ?? prev.nitrogen,
            phosphorus: d.phosphorus ?? prev.phosphorus,
            potassium:  d.potassium  ?? prev.potassium,
          }));
        }
      });
    } catch { /* Firebase not configured */ }
  }, [plotIdParam]);

  // Wire Firebase real-time updates if available
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    (async () => {
      try {
        const { startRealtimeUpdates, fetchSensorData } = await import('@/lib/firebase');
        const initial = await fetchSensorData();
        setSensorData(prev => ({
          ...prev,
          temperature: parseFloat(initial.temperature?.toString() || String(prev.temperature)),
          humidity:    parseFloat(initial.humidity?.toString()    || String(prev.humidity)),
          moisture:    parseFloat(initial.moisture?.toString()    || String(prev.moisture)),
        }));
        unsubscribe = startRealtimeUpdates((data: Record<string, unknown>) => {
          setSensorData(prev => ({
            ...prev,
            temperature: parseFloat(data.temperature?.toString() || String(prev.temperature)),
            humidity:    parseFloat(data.humidity?.toString()    || String(prev.humidity)),
            moisture:    parseFloat(data.moisture?.toString()    || String(prev.moisture)),
          }));
        });
      } catch { /* Firebase not configured */ }
    })();
    return () => unsubscribe?.();
  }, []);

  const priorityStyle = {
    high:   'bg-red-500/10 border border-red-500/20 text-red-300',
    medium: 'bg-amber-500/10 border border-amber-500/20 text-amber-300',
    low:    'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300',
  };

  return (
    <div className="min-h-screen text-slate-100 font-sans" style={{ background: '#1a2332' }}>
      {/* Background ambient blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div
          className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full blur-[100px] opacity-10 transition-all duration-2000"
          style={{ background: meta.color }}
        />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full blur-[120px] opacity-5 bg-emerald-500" />
      </div>

      <div className="relative z-10 p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto space-y-6">

        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => document.dispatchEvent(new CustomEvent('toggleMobileMenu'))}
              className="lg:hidden p-2 rounded-lg hover:bg-slate-800 text-slate-400 transition-colors flex-shrink-0"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
                <Sprout className="w-4 h-4" />
                <button onClick={() => router.push('/dashboard')} className="hover:text-slate-400 transition-colors">Farm Dashboard</button>
                <ChevronRight className="w-3 h-3" />
                <span style={{ color: meta.color }}>Plant Performance</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-100 tracking-tight">
                {activePlot.name} · {activePlot.cropType}
              </h1>
              <p className="text-slate-400 text-sm mt-1">
                {activePlot.variety} · {activePlot.area} · Real-time diagnostics
              </p>
            </div>
          </div>
          <button
            onClick={fetchAIReport}
            disabled={aiLoading}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all border",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
            style={{ background: 'rgba(30,41,59,0.6)', borderColor: 'rgba(71,85,105,0.4)' }}
            onMouseEnter={e => { if (!aiLoading) { e.currentTarget.style.background = 'rgba(30,41,59,0.8)'; e.currentTarget.style.borderColor = 'rgba(71,85,105,0.6)'; } }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(30,41,59,0.6)'; e.currentTarget.style.borderColor = 'rgba(71,85,105,0.4)'; }}
          >
            <RefreshCw className={cn("w-4 h-4", aiLoading && "animate-spin")} />
            {aiLoading ? 'Analyzing…' : 'Refresh AI Report'}
          </button>
        </div>

        {/* Top grid: Plant + AI Report */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Plant visual card */}
          <div className="border rounded-3xl overflow-hidden backdrop-blur-sm"
            style={{ background: 'rgba(30,41,59,0.7)', borderColor: 'rgba(71,85,105,0.4)' }}>
            <div className="p-4 border-b flex items-center justify-between"
              style={{ borderColor: 'rgba(71,85,105,0.4)' }}>
              <div className="flex items-center gap-2">
                <Leaf className="w-4 h-4" style={{ color: meta.color }} />
                <span className="font-semibold text-sm">Live Plant Monitor</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: meta.color }} />
                <span className="text-xs font-medium" style={{ color: meta.color }}>{meta.label}</span>
              </div>
            </div>
            <div className="relative h-72 flex items-end px-6 pt-4 pb-0">
              <PlantAnimation status={status} moisture={sensorData.moisture} health={healthScore} />
            </div>
            <div className="px-5 pb-5 pt-3 space-y-2">
              <div className="flex justify-between text-xs text-slate-400">
                <span>Soil Moisture</span>
                <span className="font-semibold text-slate-200">{sensorData.moisture.toFixed(1)}%</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: '#3a4556' }}>
                <div className="h-full rounded-full transition-all duration-1000"
                  style={{ width: `${sensorData.moisture}%`, background: 'linear-gradient(90deg, #0369a1, #38bdf8)' }} />
              </div>
              <div className="flex justify-between text-xs text-slate-400 mt-3">
                <span>Temperature</span>
                <span className="font-semibold text-slate-200">{sensorData.temperature.toFixed(1)}°C</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: '#3a4556' }}>
                <div className="h-full rounded-full transition-all duration-1000"
                  style={{ width: `${Math.min(100, (sensorData.temperature / 40) * 100)}%`, background: 'linear-gradient(90deg, #f59e0b, #ef4444)' }} />
              </div>
            </div>
          </div>

          {/* AI Report card */}
          <div className="lg:col-span-2 border rounded-3xl overflow-hidden backdrop-blur-sm flex flex-col"
            style={{ background: 'rgba(30,41,59,0.7)', borderColor: 'rgba(71,85,105,0.4)' }}>
            <div className="p-4 border-b flex items-center justify-between"
              style={{ borderColor: 'rgba(71,85,105,0.4)' }}>
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-violet-400" />
                <span className="font-semibold text-sm">AI Crop Diagnosis</span>
              </div>
              <span className="text-[10px] text-slate-500">Updated {lastRefresh.toLocaleTimeString()}</span>
            </div>
            <div className="flex-1 p-5">
              {aiLoading ? (
                <div className="flex flex-col items-center justify-center h-full gap-4 py-12">
                  <div className="w-12 h-12 rounded-full border-2 border-t-transparent animate-spin"
                    style={{ borderColor: `${meta.color}50`, borderTopColor: meta.color }} />
                  <p className="text-slate-400 text-sm animate-pulse">Analyzing plant health…</p>
                </div>
              ) : aiError ? (
                <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl">
                  <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
                  <p className="text-sm text-red-300">{aiError}</p>
                </div>
              ) : aiReport ? (
                <div className="space-y-5">
                  <div className="flex items-start gap-4">
                    <div className="relative flex-shrink-0">
                      <svg viewBox="0 0 80 80" className="w-20 h-20">
                        <circle cx="40" cy="40" r="34" fill="none" stroke="#1e293b" strokeWidth="7" />
                        <circle cx="40" cy="40" r="34" fill="none" stroke={meta.color} strokeWidth="7"
                          strokeLinecap="round"
                          strokeDasharray={`${(aiReport.overallScore / 100) * 213.6} 213.6`}
                          strokeDashoffset="53.4"
                          className="transition-all duration-1000"
                          style={{ filter: `drop-shadow(0 0 6px ${meta.glow})` }} />
                        <text x="40" y="44" textAnchor="middle" fontSize="18" fontWeight="800" fill="#f1f5f9">
                          {aiReport.overallScore}
                        </text>
                      </svg>
                    </div>
                    <div className="flex-1">
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold mb-2"
                        style={{ background: `${meta.color}18`, color: meta.color }}>
                        <Activity className="w-3 h-3" />
                        {aiReport.status.charAt(0).toUpperCase() + aiReport.status.slice(1)}
                      </div>
                      <h2 className="text-lg font-black text-slate-100 leading-tight mb-1">{aiReport.headline}</h2>
                      <p className="text-slate-400 text-sm leading-relaxed">{aiReport.summary}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Recommended Actions</p>
                    {aiReport.actions.map((action, i) => (
                      <div key={i} className={cn("flex items-center gap-3 px-4 py-3 rounded-xl text-sm", priorityStyle[action.priority])}>
                        <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold bg-white/10 flex-shrink-0">{i + 1}</span>
                        {action.text}
                        <span className="ml-auto text-[10px] font-bold uppercase opacity-60">{action.priority}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-start gap-3 p-4 rounded-xl border"
                    style={{ background: 'rgba(30,41,59,0.6)', borderColor: 'rgba(71,85,105,0.3)' }}>
                    <TrendingUp className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-emerald-400 mb-0.5">Yield Forecast</p>
                      <p className="text-slate-300 text-sm leading-relaxed">{aiReport.forecast}</p>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* Sensor metrics grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <MetricPill icon={Droplets}     label="Soil Moisture"  value={sensorData.moisture}     unit="%" trend="stable" color="#38bdf8" />
          <MetricPill icon={Thermometer}  label="Temperature"    value={sensorData.temperature}  unit="°C" trend="down" color="#f59e0b" />
          <MetricPill icon={Waves}        label="Humidity"        value={sensorData.humidity}     unit="%" trend="stable" color="#06b6d4" />
          <MetricPill icon={FlaskConical} label="Soil pH"         value={sensorData.ph}           unit="pH" trend="stable" color="#a78bfa" />
          <MetricPill icon={Zap}          label="Nitrogen (N)"    value={sensorData.nitrogen}     unit="mg/kg" trend="down" color="#f87171" />
          <MetricPill icon={Leaf}         label="Phosphorus (P)"  value={sensorData.phosphorus}   unit="mg/kg" trend="up" color="#34d399" />
          <MetricPill icon={Sun}          label="Potassium (K)"   value={sensorData.potassium}    unit="mg/kg" trend="up" color="#fbbf24" />
          <MetricPill icon={Wind}         label="Health Score"    value={healthScore}             unit="/100" color={meta.color} />
        </div>

        {/* Charts: Radar + Growth Timeline */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Radar */}
          <div className="border rounded-3xl p-5 backdrop-blur-sm"
            style={{ background: 'rgba(30,41,59,0.7)', borderColor: 'rgba(71,85,105,0.4)' }}>
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-4 h-4" style={{ color: meta.color }} />
              <h3 className="font-semibold text-sm">Nutrient & Condition Profile</h3>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
                  <PolarGrid stroke="#334155" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 500 }} />
                  <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar name="Current" dataKey="A" stroke={meta.color} fill={meta.color} fillOpacity={0.15} strokeWidth={2} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Growth Timeline */}
          <div className="border rounded-3xl p-5 backdrop-blur-sm"
            style={{ background: 'rgba(30,41,59,0.7)', borderColor: 'rgba(71,85,105,0.4)' }}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <h3 className="font-semibold text-sm">14-Day Growth Trend</h3>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" /> Height (cm)
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-violet-400 inline-block" /> Health
                </span>
              </div>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timeline}>
                  <defs>
                    <linearGradient id="gradH" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradHlth" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#a78bfa" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="day" stroke="#334155" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis stroke="#334155" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 10, color: '#f1f5f9', fontSize: 12 }} cursor={{ stroke: '#334155' }} />
                  <Area type="monotone" dataKey="height" name="Height (cm)" stroke="#10b981" fill="url(#gradH)" strokeWidth={2} dot={false} />
                  <Area type="monotone" dataKey="health" name="Health Score" stroke="#a78bfa" fill="url(#gradHlth)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Condition checklist */}
        <div className="border rounded-3xl p-5 backdrop-blur-sm"
          style={{ background: 'rgba(30,41,59,0.7)', borderColor: 'rgba(71,85,105,0.4)' }}>
          <div className="flex items-center gap-2 mb-5">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            <h3 className="font-semibold text-sm">Optimal Conditions Checklist</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              { label: 'Soil Moisture (35–70%)',  val: sensorData.moisture,    ok: sensorData.moisture >= 35    && sensorData.moisture <= 70    },
              { label: 'Temperature (18–30°C)',    val: sensorData.temperature, ok: sensorData.temperature >= 18 && sensorData.temperature <= 30 },
              { label: 'Humidity (45–80%)',        val: sensorData.humidity,    ok: sensorData.humidity >= 45   && sensorData.humidity <= 80    },
              { label: 'Soil pH (6.0–7.0)',       val: sensorData.ph,          ok: sensorData.ph >= 6.0        && sensorData.ph <= 7.0         },
              { label: 'Nitrogen (>60 mg/kg)',     val: sensorData.nitrogen,    ok: sensorData.nitrogen >= 60                                   },
              { label: 'Phosphorus (>25 mg/kg)',   val: sensorData.phosphorus,  ok: sensorData.phosphorus >= 25                                 },
              { label: 'Potassium (>150 mg/kg)',   val: sensorData.potassium,   ok: sensorData.potassium >= 150                                 },
            ].map((check, i) => (
              <div key={i} className={cn(
                "flex items-center justify-between px-4 py-3 rounded-xl border transition-all",
                check.ok
                  ? "bg-emerald-500/5 border-emerald-500/20 hover:border-emerald-500/40"
                  : "bg-red-500/5 border-red-500/20 hover:border-red-500/40"
              )}>
                <div className="flex items-center gap-2.5">
                  {check.ok
                    ? <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    : <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />}
                  <span className="text-sm text-slate-300">{check.label}</span>
                </div>
                <span className={cn("text-xs font-bold tabular-nums", check.ok ? "text-emerald-400" : "text-red-400")}>
                  {typeof check.val === 'number' ? check.val.toFixed(1) : check.val}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer note */}
        <div className="flex items-center gap-2 text-slate-600 text-xs pb-2">
          <Info className="w-3.5 h-3.5 flex-shrink-0" />
          <span>
            Plant animation and health indicators update in real-time from sensor data.
            AI diagnostics powered by Groq (llama-3.3-70b).
          </span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fallback shown while the client-side content is being hydrated
// ---------------------------------------------------------------------------
function PlantPerformanceFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#1a2332' }}>
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: '#10b98150', borderTopColor: '#10b981' }} />
        <p className="text-slate-400 text-sm">Loading plant data…</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DEFAULT EXPORT — wraps the inner component in Suspense.
// This is what Next.js prerenders; the Suspense boundary tells the build
// that everything inside is client-only and safe to defer.
// ---------------------------------------------------------------------------
export default function PlantPerformancePage() {
  return (
    <Suspense fallback={<PlantPerformanceFallback />}>
      <PlantPerformanceContent />
    </Suspense>
  );
}