'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, RadialBarChart, RadialBar, PolarAngleAxis
} from 'recharts';
import {
  Menu, Search, RefreshCw, Bell, AlertTriangle, X, Droplets,
  Thermometer, Waves, FlaskConical, Send,
  Download, Bot, Lightbulb, TrendingUp, CheckCircle, AlertCircle,
  Info, User, Plus, Edit3, Database, BarChart2, Wind, ArrowUpRight,
  ArrowDownRight, Check, Layers, Activity, Sprout, Sun, Cloud,
  Zap, Target, Calendar, Clock, Leaf, Eye, Shield, Globe,
  ChevronRight, Star, TrendingDown, Wifi, WifiOff, Cpu, BarChart3
} from 'lucide-react';
import clsx, { type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format } from 'date-fns';
import {
  startRealtimeUpdates, fetchSensorData, fetchHistoricalData,
  auth, type HistoricalDataPoint
} from '@/lib/firebase';
import { onAuthStateChanged, type User as AuthUser } from 'firebase/auth';
import { doc, setDoc, collection, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { WeatherForecast } from '@/components/dashboard/weather_focast';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const AI_API_KEY = process.env.NEXT_PUBLIC_GROQ_API_KEY ?? '';
const AI_MODEL = 'llama-3.3-70b-versatile';

async function callGroqAI(prompt: string, systemContext: string): Promise<string> {
  if (!AI_API_KEY) return '⚠️ NEXT_PUBLIC_GROQ_API_KEY is not set.';
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${AI_API_KEY}` },
    body: JSON.stringify({
      model: AI_MODEL,
      messages: [
        ...(systemContext ? [{ role: 'system', content: systemContext }] : []),
        { role: 'user', content: prompt }
      ],
      temperature: 0.7, max_tokens: 1024
    })
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e?.error?.message || `AI error ${res.status}`);
  }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content ?? 'No response received.';
}

type SensorData = {
  moisture: number; temperature: number; humidity: number;
  ph: number; nitrogen: number; phosphorus: number; potassium: number;
};

type Plot = {
  id: string; name: string; cropType: string; variety: string;
  area: string; plantedDate: string; harvestDate: string;
  status: 'growing' | 'dormant' | 'harvested'; emoji: string;
};

type Message = { id: string; role: 'user' | 'ai'; content: string; };

type Insight = {
  id: string; priority: 'high' | 'medium' | 'low';
  title: string; description: string; recommendation?: string; time: string;
};

type LogEntry = {
  id: string; time: string; event: string;
  sensor: string; value: string; status: 'success' | 'warning' | 'info';
};

type SoilMetrics = {
  ph: number; nitrogen: number; phosphorus: number; potassium: number;
};

type DailyBaseline = Pick<SensorData, 'temperature' | 'humidity' | 'moisture'>;

const CROPS = [
  { type: 'Tomatoes',  emoji: '🍅', varieties: ['Roma VF', 'Cherry 100', 'Beef Master', 'Big Boy'] },
  { type: 'Maize',     emoji: '🌽', varieties: ['H614D', 'DK8031', 'SC403', 'PANNAR 67'] },
  { type: 'Beans',     emoji: '🫘', varieties: ['Rose Coco', 'Canadian Wonder', 'Mwezi Moja'] },
  { type: 'Kale',      emoji: '🥬', varieties: ['Thousand Headed', 'Sukuma Wiki', 'Curly'] },
  { type: 'Spinach',   emoji: '🥗', varieties: ['Malabar', 'New Zealand', 'Baby Spinach'] },
  { type: 'Capsicum',  emoji: '🫑', varieties: ['California Wonder', 'Red Beauty', 'Bell Boy'] },
  { type: 'Avocado',   emoji: '🥑', varieties: ['Hass', 'Fuerte', 'Reed'] },
];

const SENSOR_THRESHOLDS = {
  temperature: { optimalMin: 18, optimalMax: 28, criticalMin: 10, criticalMax: 38 },
  humidity:    { optimalMin: 55, optimalMax: 80, criticalMin: 30, criticalMax: 95 },
  moisture:    { optimalMin: 40, optimalMax: 70, criticalMin: 20, criticalMax: 85 },
  ph:          { optimalMin: 6.0, optimalMax: 7.0, criticalMin: 4.5, criticalMax: 8.5 },
  nitrogen:    { optimalMin: 50, optimalMax: 150, criticalMin: 20, criticalMax: 250 },
  phosphorus:  { optimalMin: 30, optimalMax: 80, criticalMin: 10, criticalMax: 150 },
  potassium:   { optimalMin: 150, optimalMax: 300, criticalMin: 80, criticalMax: 500 },
};

type SensorStatus = 'optimal' | 'good' | 'warning';

function calcStatus(value: number, key: keyof typeof SENSOR_THRESHOLDS): SensorStatus {
  const { optimalMin, optimalMax, criticalMin, criticalMax } = SENSOR_THRESHOLDS[key];
  if (value >= optimalMin && value <= optimalMax) return 'optimal';
  if (value < criticalMin || value > criticalMax) return 'warning';
  return 'good';
}

function statusLabel(value: number, key: keyof typeof SENSOR_THRESHOLDS): string {
  const { optimalMin } = SENSOR_THRESHOLDS[key];
  const st = calcStatus(value, key);
  if (st === 'optimal') return 'Optimal';
  if (st === 'warning') return 'Critical';
  return value < optimalMin ? 'Low' : 'High';
}

function formatSignedDelta(value: number, digits: number) {
  const fixed = value.toFixed(digits);
  return value > 0 ? `+${fixed}` : fixed;
}

function processHistoricalForChart(historyData: HistoricalDataPoint[], timeRange: '24h' | '7d' | '30d') {
  if (!historyData.length) return [];
  return historyData.map(item => ({
    time: format(new Date(item.timestamp * 1000), timeRange === '24h' ? 'HH:mm' : 'MMM d'),
    moisture: +item.soilMoisture.toFixed(2),
    temperature: +item.temperature.toFixed(2),
    humidity: +item.humidity.toFixed(2),
  }));
}

function daysLeft(d: string) {
  return Math.max(0, Math.ceil((new Date(d).getTime() - Date.now()) / 86400000));
}
function growthPct(p: string, h: string) {
  const s = new Date(p).getTime(), e = new Date(h).getTime(), n = Date.now();
  return Math.min(100, Math.max(0, Math.round(((n - s) / (e - s)) * 100)));
}
function initials(u: AuthUser | null) {
  const n = u?.displayName, e = u?.email;
  if (n) { const p = n.trim().split(' '); return p.length >= 2 ? (p[0][0] + p[p.length - 1][0]).toUpperCase() : n.slice(0, 2).toUpperCase(); }
  return e?.slice(0, 2).toUpperCase() ?? 'U';
}

async function fbSavePlot(p: Plot) {
  await setDoc(doc(db, 'plots', p.id), { ...p, updatedAt: serverTimestamp() }, { merge: true });
}
async function fbSaveSoil(plotId: string, s: Partial<SensorData>) {
  await setDoc(doc(db, 'plots', plotId, 'soil_metrics', 'current'), { ...s, recordedAt: serverTimestamp() }, { merge: true });
}

// ── Mini Chart ────────────────────────────────────────────────────────────────
const MiniChart = ({ color, data }: { color: string; data: number[] }) => (
  <div className="w-full h-full min-w-0 min-h-0">
    <ResponsiveContainer width="100%" height={64}>
      <AreaChart data={data.map((val, i) => ({ val, i }))}>
        <Area type="monotone" dataKey="val" stroke={color} fill={color} fillOpacity={0.12} strokeWidth={2} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  </div>
);

// ── Radial Health Gauge ───────────────────────────────────────────────────────
const HealthGauge = ({ value, color, label }: { value: number; color: string; label: string }) => {
  const data = [{ value, fill: color }];
  return (
    <div className="flex flex-col items-center">
      <div className="relative w-20 h-20">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart cx="50%" cy="50%" innerRadius="65%" outerRadius="100%" startAngle={90} endAngle={-270} data={data}>
            <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
            <RadialBar background={{ fill: '#1e293b' }} dataKey="value" cornerRadius={8} angleAxisId={0} />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-bold text-slate-100">{value}%</span>
        </div>
      </div>
      <span className="text-xs text-slate-400 mt-1 font-medium">{label}</span>
    </div>
  );
};

// ── Plot Modal ─────────────────────────────────────────────────────────────────
function PlotModal({ initial, saving, onSave, onClose }: {
  initial: Plot | null; saving: boolean; onSave: (p: Plot) => void; onClose: () => void;
}) {
  const isNew = !initial;
  const [f, setF] = useState<Plot>(initial ?? {
    id: `plot-${Date.now()}`, name: '', cropType: 'Tomatoes', variety: 'Roma VF',
    area: '', plantedDate: '', harvestDate: '', status: 'growing', emoji: '🍅',
  });
  const crop = CROPS.find(c => c.type === f.cropType) ?? CROPS[0];

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-slate-700 flex items-center gap-3">
          <span className="text-3xl">{f.emoji}</span>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-slate-100">{isNew ? 'Add New Plot' : `Edit ${f.name}`}</h3>
            <p className="text-xs text-slate-400 mt-1">Synced to Firebase Database</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-lg text-slate-400"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">Plot Name *</label>
              <input className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-emerald-500"
                value={f.name} onChange={e => setF(x => ({ ...x, name: e.target.value }))} placeholder="e.g. Plot A" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">Area</label>
              <input className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-emerald-500"
                value={f.area} onChange={e => setF(x => ({ ...x, area: e.target.value }))} placeholder="e.g. 0.5 ha" />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">Crop Type *</label>
            <select className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-emerald-500"
              value={f.cropType}
              onChange={e => { const c = CROPS.find(x => x.type === e.target.value) ?? CROPS[0]; setF(x => ({ ...x, cropType: c.type, variety: c.varieties[0], emoji: c.emoji })); }}>
              {CROPS.map(c => <option key={c.type}>{c.type}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">Variety</label>
            <select className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-emerald-500"
              value={f.variety} onChange={e => setF(x => ({ ...x, variety: e.target.value }))}>
              {crop.varieties.map(v => <option key={v}>{v}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">Planted</label>
              <input type="date" className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-emerald-500"
                value={f.plantedDate} onChange={e => setF(x => ({ ...x, plantedDate: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">Harvest ETA</label>
              <input type="date" className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-emerald-500"
                value={f.harvestDate} onChange={e => setF(x => ({ ...x, harvestDate: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">Status</label>
            <div className="flex gap-2">
              {(['growing', 'dormant', 'harvested'] as const).map(s => (
                <button key={s} onClick={() => setF(x => ({ ...x, status: s }))}
                  className={cn("flex-1 px-3 py-2.5 rounded-xl text-xs font-semibold capitalize transition-all border-2",
                    f.status === s
                      ? s === 'growing' ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400'
                        : s === 'dormant' ? 'bg-amber-500/10 border-amber-500 text-amber-400'
                        : 'bg-slate-500/10 border-slate-500 text-slate-400'
                      : 'bg-transparent border-slate-700 text-slate-500 hover:border-slate-600')}>
                  {s === 'growing' ? '🌱' : s === 'dormant' ? '💤' : '✅'} {s}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="p-5 border-t border-slate-700 flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl font-medium text-sm bg-transparent border border-slate-700 text-slate-400 hover:bg-slate-700 transition-colors">Cancel</button>
          <button onClick={() => f.name && f.cropType && onSave(f)} disabled={saving || !f.name}
            className="flex-1 px-4 py-2.5 rounded-xl font-semibold text-sm bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2">
            {saving ? '...' : <><Database className="w-4 h-4" /> Save Plot</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Soil Metrics Modal ────────────────────────────────────────────────────────
function SoilMetricsModal({ initial, saving, onSave, onClose }: {
  initial: SoilMetrics; saving: boolean; onSave: (vals: SoilMetrics) => void; onClose: () => void;
}) {
  const [f, setF] = useState<SoilMetrics>({ ...initial });
  const fields = [
    { key: 'ph' as const, label: 'Soil pH', unit: 'pH', min: 0, max: 14, step: 0.1, ideal: '6.0 – 7.0', accent: '#7c3aed', icon: FlaskConical },
    { key: 'nitrogen' as const, label: 'Nitrogen (N)', unit: 'mg/kg', min: 0, max: 500, step: 1, ideal: '50 – 150', accent: '#16a34a', icon: Activity },
    { key: 'phosphorus' as const, label: 'Phosphorus (P)', unit: 'mg/kg', min: 0, max: 300, step: 1, ideal: '30 – 80', accent: '#d97706', icon: Layers },
    { key: 'potassium' as const, label: 'Potassium (K)', unit: 'mg/kg', min: 0, max: 800, step: 1, ideal: '150 – 300', accent: '#0891b2', icon: Wind },
  ];
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-slate-700 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <FlaskConical className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-slate-100">Edit Soil Metrics</h3>
            <p className="text-xs text-slate-400 mt-0.5">Adjust values and save to database</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-lg text-slate-400"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-6 max-h-[60vh] overflow-y-auto">
          {fields.map(field => {
            const val = f[field.key];
            const pct = field.key === 'ph' ? (val / 14) * 100 : Math.min(100, (val / field.max) * 100);
            const st = calcStatus(val, field.key as keyof typeof SENSOR_THRESHOLDS);
            return (
              <div key={field.key} className="space-y-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${field.accent}20` }}>
                      <field.icon className="w-3.5 h-3.5" style={{ color: field.accent }} />
                    </div>
                    <div className="text-sm font-semibold text-slate-200">{field.label}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold" style={{ color: field.accent }}>
                      {field.key === 'ph' ? val.toFixed(1) : val}<span className="text-xs font-normal text-slate-400 ml-1">{field.unit}</span>
                    </div>
                    <span className={cn("inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold",
                      st === 'optimal' && "bg-emerald-500/10 text-emerald-400",
                      st === 'good' && "bg-amber-500/10 text-amber-400",
                      st === 'warning' && "bg-red-500/10 text-red-400")}>
                      {statusLabel(val, field.key as keyof typeof SENSOR_THRESHOLDS)}
                    </span>
                  </div>
                </div>
                <input type="range" min={field.min} max={field.max} step={field.step} value={val}
                  onChange={e => setF(prev => ({ ...prev, [field.key]: parseFloat(e.target.value) }))}
                  className="w-full h-2 rounded-full appearance-none cursor-pointer"
                  style={{ background: `linear-gradient(to right, ${field.accent} ${pct}%, #334155 ${pct}%)` }} />
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[11px] text-slate-500">Ideal: <span className="text-slate-400 font-medium">{field.ideal} {field.unit}</span></span>
                  <input type="number" min={field.min} max={field.max} step={field.step} value={field.key === 'ph' ? val.toFixed(1) : val}
                    onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) setF(prev => ({ ...prev, [field.key]: v })); }}
                    className="w-24 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-200 text-right outline-none focus:border-emerald-500" />
                </div>
              </div>
            );
          })}
        </div>
        <div className="p-5 border-t border-slate-700 flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl font-medium text-sm bg-transparent border border-slate-700 text-slate-400 hover:bg-slate-700 transition-colors">Cancel</button>
          <button onClick={() => onSave(f)} disabled={saving}
            className="flex-1 px-4 py-2.5 rounded-xl font-semibold text-sm bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
            {saving ? <><RefreshCw className="w-4 h-4 animate-spin" /> Saving...</> : <><Database className="w-4 h-4" /> Save Metrics</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
export default function SmartFarmDashboard() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [plots, setPlots] = useState<Plot[]>([]);
  const [activePlotId, setActivePlotId] = useState<string | null>(null);
  const [sensorData, setSensorData] = useState<SensorData>({
    moisture: 62, temperature: 24.5, humidity: 71,
    ph: 6.4, nitrogen: 45, phosphorus: 32, potassium: 180
  });
  const [dailyBaseline, setDailyBaseline] = useState<DailyBaseline | null>(null);
  const [dailyDelta, setDailyDelta] = useState<DailyBaseline>({ temperature: 0, humidity: 0, moisture: 0 });
  const [isConnected, setIsConnected] = useState(false);
  const [lastSync, setLastSync] = useState('Never');
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d'>('24h');
  const [chartData, setChartData] = useState<Array<{ time: string; moisture: number; temperature: number; humidity: number }>>([]);
  const [isLoadingChart, setIsLoadingChart] = useState(true);
  const [selectedMetric, setSelectedMetric] = useState<'moisture' | 'temperature' | 'humidity'>('temperature');
  const [messages, setMessages] = useState<Message[]>([{
    id: '1', role: 'ai',
    content: "Hello! I'm your AI farming assistant. I can help you analyze crop data, predict yields, suggest irrigation schedules, and diagnose plant health issues. What would you like to know about your farm today?"
  }]);
  const [inputMessage, setInputMessage] = useState('');
  const [isAITyping, setIsAITyping] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [editPlot, setEditPlot] = useState<Plot | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [soilSaving, setSoilSaving] = useState(false);
  const [showSoilModal, setShowSoilModal] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isMounted, setIsMounted] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const miniChartData = Array.from({ length: 12 }, (_, i) => Math.floor(Math.random() * 30 + 50));

  const plot = activePlotId ? (plots.find(p => p.id === activePlotId) ?? plots[0]) : plots[0];
  const isPlotReady = Boolean(activePlotId && plot);
  const growth = plot?.plantedDate && plot?.harvestDate ? growthPct(plot.plantedDate, plot.harvestDate) : 0;
  const remaining = plot?.harvestDate ? daysLeft(plot.harvestDate) : null;
  const chartColor = { moisture: '#3b82f6', temperature: '#f97316', humidity: '#0891b2' }[selectedMetric];

  // Derived health score (0-100)
  const healthScore = Math.round(
    (calcStatus(sensorData.temperature, 'temperature') === 'optimal' ? 25 : 10) +
    (calcStatus(sensorData.humidity, 'humidity') === 'optimal' ? 25 : 10) +
    (calcStatus(sensorData.moisture, 'moisture') === 'optimal' ? 25 : 10) +
    (calcStatus(sensorData.ph, 'ph') === 'optimal' ? 25 : 10)
  );

  // ── Ticker ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    setIsMounted(true);
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => onAuthStateChanged(auth, setCurrentUser), []);

  useEffect(() => {
    return onSnapshot(collection(db, 'plots'), snap => {
      const nextPlots = snap.docs.map(d => d.data() as Plot);
      setPlots(nextPlots);
      if (nextPlots.length > 0) {
        setActivePlotId(prev => (prev && nextPlots.some(p => p.id === prev) ? prev : nextPlots[0].id));
      } else { setActivePlotId(null); }
    });
  }, []);

  useEffect(() => {
    if (!activePlotId) return;
    return onSnapshot(doc(db, 'plots', activePlotId, 'soil_metrics', 'current'), snap => {
      if (snap.exists()) {
        const d = snap.data();
        setSensorData(prev => ({ ...prev, ph: d.ph ?? prev.ph, nitrogen: d.nitrogen ?? prev.nitrogen, phosphorus: d.phosphorus ?? prev.phosphorus, potassium: d.potassium ?? prev.potassium }));
      }
    });
  }, [activePlotId]);

  useEffect(() => {
    fetchSensorData().then(data => {
      setSensorData(prev => ({
        ...prev,
        temperature: parseFloat(data.temperature?.toString() || '0') || prev.temperature,
        humidity: parseFloat(data.humidity?.toString() || '0') || prev.humidity,
        moisture: parseFloat(data.moisture?.toString() || '0') || prev.moisture,
      }));
      setIsConnected(true);
      setLastSync(format(new Date(), 'HH:mm'));
    }).catch(() => {});

    return startRealtimeUpdates(data => {
      setSensorData(prev => ({
        ...prev,
        temperature: parseFloat(data.temperature?.toString() || prev.temperature.toString()),
        humidity: parseFloat(data.humidity?.toString() || prev.humidity.toString()),
        moisture: parseFloat(data.moisture?.toString() || prev.moisture.toString()),
      }));
      setLastSync(format(new Date(), 'HH:mm'));
    });
  }, []);

  useEffect(() => {
    if (dailyBaseline) return;
    let isActive = true;
    const loadBaseline = async () => {
      const historyData = await fetchHistoricalData(24);
      if (!isActive) return;
      if (historyData.length === 0) {
        setDailyBaseline({ temperature: sensorData.temperature, humidity: sensorData.humidity, moisture: sensorData.moisture });
        return;
      }
      const oldest = historyData[0];
      setDailyBaseline({ temperature: oldest.temperature, humidity: oldest.humidity, moisture: oldest.soilMoisture });
    };
    loadBaseline();
    return () => { isActive = false; };
  }, [dailyBaseline, sensorData.temperature, sensorData.humidity, sensorData.moisture]);

  useEffect(() => {
    if (!dailyBaseline) return;
    setDailyDelta({ temperature: sensorData.temperature - dailyBaseline.temperature, humidity: sensorData.humidity - dailyBaseline.humidity, moisture: sensorData.moisture - dailyBaseline.moisture });
  }, [dailyBaseline, sensorData.temperature, sensorData.humidity, sensorData.moisture]);

  useEffect(() => {
    const loadChartData = async () => {
      setIsLoadingChart(true);
      const hoursMap: Record<'24h' | '7d' | '30d', number> = { '24h': 24, '7d': 168, '30d': 720 };
      const historyData = await fetchHistoricalData(hoursMap[timeRange]);
      if (historyData.length > 0) {
        setChartData(processHistoricalForChart(historyData, timeRange));
      } else {
        setChartData([{ time: format(new Date(), 'HH:mm'), moisture: sensorData.moisture, temperature: sensorData.temperature, humidity: sensorData.humidity }]);
      }
      setIsLoadingChart(false);
    };
    loadChartData();
  }, [timeRange]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const handleSendMessage = useCallback(async () => {
    if (!inputMessage.trim() || isAITyping) return;
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: inputMessage };
    setMessages(prev => [...prev, userMsg]);
    setInputMessage('');
    setIsAITyping(true);
    try {
      const systemContext = `You are an expert AI agronomist assistant for a smart farm in Kenya. Active plot: ${plot?.name} — ${plot?.cropType} (${plot?.variety}). Sensors: Moisture ${sensorData.moisture.toFixed(1)}%, Temp ${sensorData.temperature.toFixed(1)}°C, Humidity ${sensorData.humidity.toFixed(1)}%, pH ${sensorData.ph}, N ${sensorData.nitrogen} mg/kg, P ${sensorData.phosphorus} mg/kg, K ${sensorData.potassium} mg/kg. Give concise, actionable advice.`;
      const aiResponse = await callGroqAI(inputMessage, systemContext);
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'ai', content: aiResponse }]);
    } catch (error) {
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'ai', content: `❌ Error: ${(error as Error).message}` }]);
    } finally { setIsAITyping(false); }
  }, [inputMessage, sensorData, isAITyping, plot]);

  const savePlot = async (p: Plot) => {
    setSaving(true);
    try {
      await fbSavePlot(p);
      setPlots(prev => { const i = prev.findIndex(x => x.id === p.id); if (i >= 0) { const n = [...prev]; n[i] = p; return n; } return [...prev, p]; });
      setActivePlotId(p.id);
    } finally { setSaving(false); setShowModal(false); }
  };

  const saveSoilMetrics = async (vals: SoilMetrics) => {
    if (!activePlotId) return;
    setSoilSaving(true);
    try {
      setSensorData(prev => ({ ...prev, ...vals }));
      await fbSaveSoil(activePlotId, vals);
      setShowSoilModal(false);
    } finally { setSoilSaving(false); }
  };

  const insights: Insight[] = [
    { id: '1', priority: 'high', title: 'Nitrogen Deficiency Alert', description: `N levels at ${sensorData.nitrogen} mg/kg are below optimal for ${plot?.cropType}.`, recommendation: 'Apply NPK (20-10-10) within 48 hours.', time: '2 mins ago' },
    { id: '2', priority: 'medium', title: 'Irrigation Optimization', description: `Moisture at ${sensorData.moisture.toFixed(0)}%.`, recommendation: 'Reduce watering frequency by 10% to prevent root rot.', time: '1 hour ago' },
    { id: '3', priority: 'low', title: 'Growth Prediction', description: remaining ? `${remaining} days to estimated harvest.` : 'Harvest forecast available.', recommendation: 'Current conditions suggest harvest readiness in 18-21 days.', time: '3 hours ago' }
  ];

  const logs: LogEntry[] = [
    { id: '1', time: '10:42 AM', event: 'Data Sync', sensor: 'ESP32-Node1', value: 'Batch: 24 readings', status: 'success' },
    { id: '2', time: '10:38 AM', event: 'Threshold Alert', sensor: 'Soil Moisture', value: '23% → 19%', status: 'warning' },
    { id: '3', time: '10:35 AM', event: 'AI Analysis', sensor: 'AI System', value: '3 insights generated', status: 'success' },
    { id: '4', time: '10:30 AM', event: 'Offline Mode', sensor: 'Connectivity', value: 'WiFi disconnected', status: 'info' },
  ];

  // Tasks mock data
  const tasks = [
    { id: 1, title: 'Apply nitrogen fertilizer to Plot A', due: 'Today', priority: 'high', done: false },
    { id: 2, title: 'Inspect Plot B for pest activity', due: 'Tomorrow', priority: 'medium', done: false },
    { id: 3, title: 'Calibrate pH sensor node #3', due: 'Thu', priority: 'low', done: true },
    { id: 4, title: 'Schedule irrigation for Plot C', due: 'Wed', priority: 'medium', done: false },
  ];

  const [tasksDone, setTasksDone] = useState<number[]>([3]);

  return (
    <div className="text-slate-100 min-h-screen" style={{ background: '#0f1824', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,300&family=Space+Grotesk:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: #1e293b; }
        ::-webkit-scrollbar-thumb { background: #334155; border-radius: 2px; }
        .card { background: rgba(30,41,59,0.6); border: 1px solid rgba(71,85,105,0.35); backdrop-filter: blur(12px); }
        .card-glow-green:hover { box-shadow: 0 0 40px rgba(16,185,129,0.08); border-color: rgba(16,185,129,0.2); }
        .gradient-border { background: linear-gradient(#1e293b, #1e293b) padding-box, linear-gradient(135deg, #10b981, #06b6d4, #a78bfa) border-box; border: 1px solid transparent; }
        .pulse-dot::before { content: ''; position: absolute; inset: -3px; border-radius: 50%; border: 2px solid currentColor; opacity: 0.4; animation: ping 1.5s cubic-bezier(0,0,0.2,1) infinite; }
        @keyframes ping { 75%,100% { transform: scale(1.8); opacity: 0; } }
        .shimmer { background: linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.03) 50%, rgba(255,255,255,0) 100%); background-size: 200% 100%; animation: shimmer 2s infinite; }
        @keyframes shimmer { from { background-position: -200% 0; } to { background-position: 200% 0; } }
        .stat-number { font-family: 'Space Grotesk', monospace; }
        .section-title { font-family: 'Space Grotesk', sans-serif; }
      `}</style>

      {/* Ambient background blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full" style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.04) 0%, transparent 70%)' }} />
        <div className="absolute top-1/2 -left-40 w-[400px] h-[400px] rounded-full" style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.03) 0%, transparent 70%)' }} />
        <div className="absolute -bottom-40 right-1/3 w-[500px] h-[500px] rounded-full" style={{ background: 'radial-gradient(circle, rgba(168,85,247,0.02) 0%, transparent 70%)' }} />
      </div>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="relative z-40 sticky top-0 h-16 border-b flex items-center justify-between px-4 md:px-6 gap-4"
        style={{ background: 'rgba(15,24,36,0.85)', backdropFilter: 'blur(20px)', borderColor: 'rgba(71,85,105,0.3)' }}>
        <button onClick={() => document.dispatchEvent(new CustomEvent('toggleMobileMenu'))} className="lg:hidden p-2 rounded-lg hover:bg-slate-800 text-slate-400 transition-colors">
          <Menu className="w-5 h-5" />
        </button>

        {/* Live clock + date */}
        <div className="hidden lg:flex flex-col leading-tight" suppressHydrationWarning>
          <span className="stat-number text-emerald-400 font-bold text-sm">{isMounted ? format(currentTime, 'HH:mm:ss') : '00:00:00'}</span>
          <span className="text-slate-500 text-[11px]">{isMounted ? format(currentTime, 'EEEE, MMM d yyyy') : ''}</span>
        </div>

        <div className="flex items-center gap-3 bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2 w-full sm:w-64 md:w-72"
          style={{ borderColor: 'rgba(71,85,105,0.3)' }}>
          <Search className="w-4 h-4 text-slate-500" />
          <input type="text" placeholder="Search plots, crops..." className="bg-transparent border-none outline-none text-sm text-slate-200 w-full placeholder:text-slate-600" />
        </div>

        <div className="flex items-center gap-3 ml-auto">
          {/* Connection indicator */}
          <div className={cn("flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border",
            isConnected ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-red-500/10 border-red-500/30 text-red-400")}>
            <span className="relative flex h-2 w-2">
              <span className={cn("animate-ping absolute inline-flex h-full w-full rounded-full opacity-75", isConnected ? "bg-emerald-400" : "bg-red-400")} />
              <span className={cn("relative inline-flex rounded-full h-2 w-2", isConnected ? "bg-emerald-400" : "bg-red-400")} />
            </span>
            <span className="hidden sm:inline">{isConnected ? 'Live' : 'Offline'}</span>
          </div>

          {/* Plot chips */}
          <div className="hidden md:flex gap-1.5 overflow-x-auto">
            {plots.slice(0, 3).map(p => (
              <button key={p.id} onClick={() => setActivePlotId(p.id)}
                className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap border",
                  activePlotId === p.id ? "bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-500/20"
                    : "border-slate-700 text-slate-400 hover:border-emerald-500/50 hover:text-emerald-400")}
                style={{ background: activePlotId === p.id ? undefined : 'rgba(30,41,59,0.4)' }}>
                <span>{p.emoji}</span><span>{p.name}</span>
              </button>
            ))}
            <button onClick={() => { setEditPlot(null); setShowModal(true); }}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border border-dashed border-slate-700 text-slate-400 hover:border-emerald-500/50 hover:text-emerald-400 transition-all whitespace-nowrap">
              <Plus className="w-3 h-3" /> Add
            </button>
          </div>

          <button onClick={() => window.location.reload()} className="p-2.5 rounded-xl hover:bg-slate-800 text-slate-400 transition-all"><RefreshCw className="w-4 h-4" /></button>

          <button onClick={() => router.push('/notifications')} className="relative p-2.5 rounded-xl hover:bg-slate-800 text-slate-400 transition-all">
            <Bell className="w-4 h-4" />
            <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 text-[10px] font-bold text-white rounded-full flex items-center justify-center border-2 border-slate-900">3</span>
          </button>

          <button onClick={() => router.push('/my_account')} className="flex items-center gap-2 pl-3 border-l border-slate-800 rounded-lg hover:bg-slate-800/50 transition-colors">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-sm font-bold text-white shadow-lg shadow-emerald-500/20">
              {currentUser?.photoURL ? <img src={currentUser.photoURL} alt="" className="w-8 h-8 rounded-full object-cover" /> : initials(currentUser)}
            </div>
            <span className="text-sm font-medium hidden lg:block text-slate-200">{currentUser?.displayName || currentUser?.email || 'Account'}</span>
          </button>
        </div>
      </header>

      {/* ── Main Content ───────────────────────────────────────────────────── */}
      <div className="relative z-10 p-4 md:p-6 max-w-[1600px] mx-auto space-y-5">

        {/* ── SECTION 0: HERO BANNER ─────────────────────────────────────── */}
        <div className="relative rounded-2xl overflow-hidden gradient-border p-6 md:p-8"
          style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.08) 0%, rgba(15,24,36,0.95) 50%, rgba(6,182,212,0.05) 100%)' }}>
          <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 80% 50%, rgba(16,185,129,0.06) 0%, transparent 60%)' }} />

          <div className="relative flex flex-col md:flex-row md:items-center gap-6">
            {/* Left: plot info */}
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  LIVE MONITORING
                </span>
                <span className="text-xs text-slate-500">Last sync: {lastSync}</span>
              </div>
              <h1 className="section-title text-3xl md:text-4xl font-bold text-slate-100 mb-1">
                {plot?.emoji} {plot?.name}
                <span className="text-emerald-400"> · {plot?.cropType}</span>
              </h1>
              <p className="text-slate-400 text-sm">
                {plot?.variety} &nbsp;·&nbsp; {plot?.area} &nbsp;·&nbsp; Planted {plot?.plantedDate || 'N/A'} &nbsp;·&nbsp;
                <span className={cn("font-semibold", plot?.status === 'growing' ? 'text-emerald-400' : plot?.status === 'dormant' ? 'text-amber-400' : 'text-slate-400')}>
                  {plot?.status === 'growing' ? '🌱 Growing' : plot?.status === 'dormant' ? '💤 Dormant' : '✅ Harvested'}
                </span>
              </p>

              {/* Progress */}
              {plot?.plantedDate && plot?.harvestDate && (
                <div className="mt-4 max-w-md">
                  <div className="flex justify-between text-xs text-slate-400 mb-1.5">
                    <span>Growth Progress</span>
                    <span className="text-emerald-400 font-bold stat-number">{growth}%</span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(30,41,59,0.8)' }}>
                    <div className="h-full rounded-full transition-all duration-1000 relative overflow-hidden"
                      style={{ width: `${growth}%`, background: 'linear-gradient(90deg, #059669, #10b981, #34d399)' }}>
                      <div className="absolute inset-0 shimmer" />
                    </div>
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-500 mt-1">
                    <span>{plot.plantedDate}</span>
                    {remaining !== null && <span className="text-emerald-500 font-semibold">{remaining} days to harvest</span>}
                    <span>{plot.harvestDate}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Right: radial health gauges */}
            <div className="flex gap-4 md:gap-6 flex-wrap">
              <HealthGauge value={healthScore} color="#10b981" label="Farm Health" />
              <HealthGauge value={growth} color="#3b82f6" label="Growth" />
              <HealthGauge value={Math.round(sensorData.moisture)} color="#06b6d4" label="Moisture" />
              <HealthGauge value={Math.min(100, Math.round((sensorData.nitrogen / 150) * 100))} color="#a78bfa" label="Nutrients" />
            </div>
          </div>

          {/* Action buttons */}
          <div className="mt-5 flex gap-3 flex-wrap">
            <button onClick={() => { setEditPlot(plot ?? null); setShowModal(true); }}
              className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 font-medium text-sm hover:bg-slate-800 transition-colors flex items-center gap-2"
              style={{ background: 'rgba(30,41,59,0.6)' }}>
              <Edit3 className="w-4 h-4" /> Edit Plot
            </button>
            <button onClick={() => isPlotReady && router.push('/plant_performance?plotId=' + activePlotId)} disabled={!isPlotReady}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 text-white font-semibold text-sm hover:bg-emerald-500 disabled:opacity-50 transition-colors flex items-center gap-2 shadow-lg shadow-emerald-500/20">
              <BarChart3 className="w-4 h-4" /> View Performance
            </button>
            <button onClick={() => setShowChat(true)}
              className="px-4 py-2.5 rounded-xl font-semibold text-sm text-white flex items-center gap-2 transition-colors hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)' }}>
              <Bot className="w-4 h-4" /> Ask AI
            </button>
            <button onClick={() => setShowSoilModal(true)}
              className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 font-medium text-sm hover:bg-slate-800 transition-colors flex items-center gap-2"
              style={{ background: 'rgba(30,41,59,0.6)' }}>
              <FlaskConical className="w-4 h-4" /> Edit Soil
            </button>
          </div>
        </div>

        {/* ── SECTION 1: SENSOR CARDS ───────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="section-title text-sm font-semibold text-slate-400 uppercase tracking-widest">Live Sensors</h2>
            <span className="text-xs text-slate-500 flex items-center gap-1.5">
              <Cpu className="w-3 h-3" /> ESP32-Node1 · synced {lastSync}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { key: 'temperature' as const, label: 'Temperature', sub: 'Air temp from DHT22', icon: Thermometer, value: sensorData.temperature.toFixed(1), unit: '°C', accent: '#f97316', pale: 'rgba(249,115,22,0.08)', delta: dailyDelta.temperature, deltaDigits: 1 },
              { key: 'humidity' as const, label: 'Air Humidity', sub: 'Relative humidity', icon: Waves, value: sensorData.humidity.toFixed(1), unit: '%', accent: '#0891b2', pale: 'rgba(8,145,178,0.08)', delta: dailyDelta.humidity, deltaDigits: 0 },
              { key: 'moisture' as const, label: 'Soil Moisture', sub: 'Capacitive sensor', icon: Droplets, value: sensorData.moisture.toFixed(1), unit: '%', accent: '#2563eb', pale: 'rgba(37,99,235,0.08)', delta: dailyDelta.moisture, deltaDigits: 0 }
            ].map(s => {
              const st = calcStatus(parseFloat(s.value), s.key);
              const stLabel = statusLabel(parseFloat(s.value), s.key);
              const deltaUp = s.delta >= 0;
              return (
                <div key={s.key} onClick={() => setSelectedMetric(s.key)}
                  className="card card-glow-green rounded-2xl p-5 cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-black/40 group relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 rounded-full pointer-events-none"
                    style={{ background: `radial-gradient(circle, ${s.accent}08 0%, transparent 70%)`, transform: 'translate(30%,-30%)' }} />

                  <div className="flex justify-between items-start mb-4 relative">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ backgroundColor: s.pale, border: `1px solid ${s.accent}25` }}>
                      <s.icon className="w-5 h-5" style={{ color: s.accent }} />
                    </div>
                    <span className={cn("flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border",
                      st === 'optimal' && "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
                      st === 'good' && "bg-amber-500/10 text-amber-400 border-amber-500/20",
                      st === 'warning' && "bg-red-500/10 text-red-400 border-red-500/20")}>
                      {st === 'optimal' ? <Check className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                      {stLabel}
                    </span>
                  </div>

                  <div className="stat-number text-4xl font-bold text-slate-100 mb-0.5">
                    {s.value}<span className="text-base text-slate-400 font-normal ml-1">{s.unit}</span>
                  </div>
                  <div className="text-sm font-medium text-slate-300 mb-0.5">{s.label}</div>
                  <div className="text-xs text-slate-500 mb-3">{s.sub}</div>

                  <div className={cn("flex items-center gap-1 text-xs font-semibold mb-3", deltaUp ? "text-emerald-400" : "text-red-400")}>
                    {deltaUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    {formatSignedDelta(s.delta, s.deltaDigits)}{s.unit} from yesterday
                  </div>

                  <div className="h-16 opacity-50 group-hover:opacity-80 transition-opacity">
                    <MiniChart color={s.accent} data={miniChartData} />
                  </div>

                  {selectedMetric === s.key && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full" style={{ backgroundColor: s.accent }} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── SECTION 2: CHART + AI INSIGHTS ─────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Analytics Chart */}
          <div className="lg:col-span-2 card rounded-2xl p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
              <div>
                <h3 className="section-title font-semibold text-slate-100">Environmental Trends</h3>
                <p className="text-xs text-slate-500 mt-0.5">Historical sensor data from {plot?.name}</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {(['24h', '7d', '30d'] as const).map(range => (
                  <button key={range} onClick={() => setTimeRange(range)}
                    className={cn("px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                      timeRange === range ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/20" : "text-slate-400 hover:text-slate-200 hover:bg-slate-700")}
                    style={{ background: timeRange === range ? undefined : 'rgba(30,41,59,0.6)' }}>
                    {range.toUpperCase()}
                  </button>
                ))}
                <button className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors"
                  style={{ background: 'rgba(30,41,59,0.6)' }}>
                  <Download className="w-3.5 h-3.5" /> Export
                </button>
              </div>
            </div>

            <div className="h-[240px]">
              {isLoadingChart ? (
                <div className="w-full h-full flex items-center justify-center gap-3">
                  <RefreshCw className="w-5 h-5 animate-spin text-slate-400" />
                  <span className="text-slate-400 text-sm">Loading chart data...</span>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id={`grad${selectedMetric}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={chartColor} stopOpacity={0.25} />
                        <stop offset="95%" stopColor={chartColor} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(71,85,105,0.25)" vertical={false} />
                    <XAxis dataKey="time" stroke="#475569" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis stroke="#475569" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(71,85,105,0.5)', borderRadius: '10px', color: '#f1f5f9', fontSize: '12px' }} />
                    <Area type="monotone" dataKey={selectedMetric} name={selectedMetric.charAt(0).toUpperCase() + selectedMetric.slice(1)} stroke={chartColor} fillOpacity={1} fill={`url(#grad${selectedMetric})`} strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: chartColor }} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t" style={{ borderColor: 'rgba(71,85,105,0.25)' }}>
              {[
                { key: 'temperature' as const, label: 'Temperature', icon: Thermometer, color: '#f97316' },
                { key: 'humidity' as const, label: 'Humidity', icon: Waves, color: '#0891b2' },
                { key: 'moisture' as const, label: 'Moisture', icon: Droplets, color: '#2563eb' }
              ].map(m => (
                <button key={m.key} onClick={() => setSelectedMetric(m.key)}
                  className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border",
                    selectedMetric === m.key ? "border-transparent text-white" : "text-slate-400 hover:text-slate-200")}
                  style={{
                    backgroundColor: selectedMetric === m.key ? m.color : 'rgba(30,41,59,0.6)',
                    borderColor: selectedMetric === m.key ? 'transparent' : 'rgba(71,85,105,0.3)',
                  }}>
                  <m.icon className="w-3.5 h-3.5" />{m.label}
                </button>
              ))}
            </div>
          </div>

          {/* AI Insights */}
          <div className="card rounded-2xl flex flex-col overflow-hidden">
            <div className="p-4 flex items-center gap-3" style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(6,182,212,0.08))' }}>
              <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                <Bot className="w-5 h-5 text-emerald-400" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-slate-100 text-sm">AI Insights</h3>
                <p className="text-[11px] text-slate-400">LLaMA 3.3 70B</p>
              </div>
              <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-500/20 rounded-full text-[10px] font-bold text-emerald-400 border border-emerald-500/25">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />LIVE
              </span>
            </div>

            <div className="flex-1 p-3 space-y-2 overflow-y-auto" style={{ maxHeight: '280px' }}>
              {insights.map(insight => (
                <div key={insight.id}
                  className={cn("flex gap-2.5 p-3 rounded-xl border-l-2 cursor-pointer transition-all hover:translate-x-0.5",
                    insight.priority === 'high' && "border-red-500 hover:bg-red-500/5",
                    insight.priority === 'medium' && "border-amber-500 hover:bg-amber-500/5",
                    insight.priority === 'low' && "border-cyan-500 hover:bg-cyan-500/5")}
                  style={{ background: 'rgba(15,24,36,0.4)' }}>
                  <div className={cn("w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                    insight.priority === 'high' && "bg-red-500/10 text-red-400",
                    insight.priority === 'medium' && "bg-amber-500/10 text-amber-400",
                    insight.priority === 'low' && "bg-cyan-500/10 text-cyan-400")}>
                    {insight.priority === 'high' ? <AlertCircle className="w-4 h-4" /> : insight.priority === 'medium' ? <Lightbulb className="w-4 h-4" /> : <TrendingUp className="w-4 h-4" />}
                  </div>
                  <div>
                    <strong className="block text-xs font-semibold text-slate-200 mb-0.5">{insight.title}</strong>
                    <p className="text-[11px] text-slate-400 leading-relaxed">{insight.description} {insight.recommendation}</p>
                    <span className="text-[10px] text-slate-500 mt-1 block">{insight.time}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-3 border-t flex gap-2" style={{ borderColor: 'rgba(71,85,105,0.25)', background: 'rgba(15,24,36,0.4)' }}>
              <input type="text" placeholder="Ask AI about your crops..." className="flex-1 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50 border"
                style={{ background: 'rgba(15,24,36,0.8)', borderColor: 'rgba(71,85,105,0.3)' }}
                onClick={() => setShowChat(true)} readOnly />
              <button onClick={() => setShowChat(true)} className="w-9 h-9 rounded-xl flex items-center justify-center text-white transition-all hover:scale-105 active:scale-95"
                style={{ background: 'linear-gradient(135deg, #059669, #0891b2)' }}>
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* ── SECTION 3: SOIL METRICS + TASKS + WEATHER ─────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Soil Quality Metrics */}
          <div className="lg:col-span-2 card rounded-2xl p-5">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="section-title font-semibold text-slate-100">Soil Quality</h3>
                <p className="text-xs text-slate-500 mt-0.5">{plot?.name} · NPK + pH readings</p>
              </div>
              <button onClick={() => setShowSoilModal(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-emerald-400 transition-all border"
                style={{ background: 'rgba(15,24,36,0.6)', borderColor: 'rgba(71,85,105,0.3)' }}>
                <Edit3 className="w-3 h-3" /> Edit
              </button>
            </div>

            {[
              { key: 'ph' as const, icon: FlaskConical, label: 'Soil pH', detail: 'Acidity / alkalinity', value: sensorData.ph.toFixed(1), unit: 'pH', ideal: '6.0–7.0', pct: (sensorData.ph / 14) * 100, accent: '#7c3aed' },
              { key: 'nitrogen' as const, icon: Activity, label: 'Nitrogen (N)', detail: 'Leaf & stem growth', value: `${sensorData.nitrogen}`, unit: 'mg/kg', ideal: '50–150', pct: Math.min(100, (sensorData.nitrogen / 200) * 100), accent: '#16a34a' },
              { key: 'phosphorus' as const, icon: Layers, label: 'Phosphorus (P)', detail: 'Root development', value: `${sensorData.phosphorus}`, unit: 'mg/kg', ideal: '30–80', pct: Math.min(100, (sensorData.phosphorus / 100) * 100), accent: '#d97706' },
              { key: 'potassium' as const, icon: Wind, label: 'Potassium (K)', detail: 'Overall plant health', value: `${sensorData.potassium}`, unit: 'mg/kg', ideal: '150–300', pct: Math.min(100, (sensorData.potassium / 400) * 100), accent: '#0891b2' }
            ].map(row => {
              const st = calcStatus(parseFloat(row.value), row.key);
              const stLabel = statusLabel(parseFloat(row.value), row.key);
              return (
                <div key={row.key} className="flex items-center gap-4 py-3.5 border-b last:border-0" style={{ borderColor: 'rgba(71,85,105,0.2)' }}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${row.accent}15`, border: `1px solid ${row.accent}25` }}>
                    <row.icon className="w-4 h-4" style={{ color: row.accent }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-1.5">
                      <div>
                        <span className="text-sm font-medium text-slate-200">{row.label}</span>
                        <span className="text-xs text-slate-500 ml-2">{row.detail}</span>
                      </div>
                      <span className="stat-number text-sm font-bold text-slate-100 flex-shrink-0">
                        {row.value} <span className="text-[11px] font-normal text-slate-400">{row.unit}</span>
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(30,41,59,0.8)' }}>
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${row.pct}%`, backgroundColor: row.accent, boxShadow: `0 0 8px ${row.accent}40` }} />
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 min-w-[88px]">
                    <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold border",
                      st === 'optimal' && "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
                      st === 'good' && "bg-amber-500/10 text-amber-400 border-amber-500/20",
                      st === 'warning' && "bg-red-500/10 text-red-400 border-red-500/20")}>{stLabel}</span>
                    <span className="text-[10px] text-slate-500">Ideal: {row.ideal}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Tasks Panel */}
          <div className="card rounded-2xl p-5 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="section-title font-semibold text-slate-100">Farm Tasks</h3>
                <p className="text-xs text-slate-500 mt-0.5">{tasksDone.length}/{tasks.length} completed today</p>
              </div>
              <button className="w-8 h-8 rounded-lg flex items-center justify-center text-emerald-400 border border-emerald-500/25 hover:bg-emerald-500/10 transition-colors"
                style={{ background: 'rgba(16,185,129,0.08)' }}>
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* Progress */}
            <div className="mb-4">
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(30,41,59,0.8)' }}>
                <div className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                  style={{ width: `${(tasksDone.length / tasks.length) * 100}%` }} />
              </div>
            </div>

            <div className="space-y-2 flex-1">
              {tasks.map(task => (
                <div key={task.id} onClick={() => setTasksDone(prev => prev.includes(task.id) ? prev.filter(x => x !== task.id) : [...prev, task.id])}
                  className="flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-all hover:scale-[1.01] group"
                  style={{ background: tasksDone.includes(task.id) ? 'rgba(16,185,129,0.05)' : 'rgba(15,24,36,0.5)', border: `1px solid ${tasksDone.includes(task.id) ? 'rgba(16,185,129,0.15)' : 'rgba(71,85,105,0.2)'}` }}>
                  <div className={cn("w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5 transition-all border",
                    tasksDone.includes(task.id) ? "bg-emerald-500 border-emerald-500" : "border-slate-600 group-hover:border-emerald-500/50")}>
                    {tasksDone.includes(task.id) && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-xs font-medium leading-relaxed", tasksDone.includes(task.id) ? "text-slate-500 line-through" : "text-slate-200")}>{task.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-slate-500 flex items-center gap-1"><Clock className="w-3 h-3" />{task.due}</span>
                      <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-full",
                        task.priority === 'high' ? "bg-red-500/10 text-red-400" : task.priority === 'medium' ? "bg-amber-500/10 text-amber-400" : "bg-slate-500/10 text-slate-400")}>
                        {task.priority}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── SECTION 4: WEATHER FORECAST ────────────────────────────────── */}
        <WeatherForecast />

        {/* ── SECTION 5: ALL PLOTS ────────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="section-title font-semibold text-slate-100">All Plots</h2>
              <p className="text-xs text-slate-500 mt-0.5">{plots.length} plots registered</p>
            </div>
            <button onClick={() => { setEditPlot(null); setShowModal(true); }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white font-semibold text-sm hover:bg-emerald-500 transition-colors shadow-md shadow-emerald-500/20">
              <Plus className="w-4 h-4" /> Add Plot
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {plots.map(p => {
              const g = p.plantedDate && p.harvestDate ? growthPct(p.plantedDate, p.harvestDate) : 0;
              const dl = p.harvestDate ? daysLeft(p.harvestDate) : null;
              return (
                <div key={p.id} onClick={() => { setActivePlotId(p.id); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  className={cn("card card-glow-green rounded-2xl p-4 cursor-pointer transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-black/40",
                    activePlotId === p.id && "gradient-border")}
                  style={{ borderColor: activePlotId === p.id ? undefined : 'rgba(71,85,105,0.35)' }}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <span className="text-2xl">{p.emoji}</span>
                      <div>
                        <div className="font-semibold text-sm text-slate-100">{p.name}</div>
                        <div className="text-xs text-slate-500">{p.cropType} · {p.variety}</div>
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold capitalize",
                        p.status === 'growing' && "bg-emerald-500/10 text-emerald-400",
                        p.status === 'dormant' && "bg-amber-500/10 text-amber-400",
                        p.status === 'harvested' && "bg-slate-500/10 text-slate-400")}>
                        {p.status}
                      </span>
                      <button onClick={e => { e.stopPropagation(); setEditPlot(p); setShowModal(true); }}
                        className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-slate-200 transition-colors">
                        <Edit3 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 mb-3">
                    {[
                      { label: 'Area', value: p.area || '—' },
                      { label: 'Days left', value: dl !== null ? `${dl}d` : '—' },
                      { label: 'Planted', value: p.plantedDate || '—' },
                      { label: 'Harvest', value: p.harvestDate || '—' }
                    ].map(m => (
                      <div key={m.label} className="rounded-lg p-2" style={{ background: 'rgba(15,24,36,0.5)' }}>
                        <div className="text-[10px] text-slate-500 uppercase">{m.label}</div>
                        <div className="text-xs font-semibold text-slate-200 mt-0.5 stat-number">{m.value}</div>
                      </div>
                    ))}
                  </div>

                  {p.plantedDate && p.harvestDate && (
                    <>
                      <div className="flex justify-between text-[11px] mb-1">
                        <span className="text-slate-500">Growth</span>
                        <span className="text-emerald-400 font-bold stat-number">{g}%</span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(30,41,59,0.8)' }}>
                        <div className="h-full rounded-full transition-all" style={{ width: `${g}%`, background: 'linear-gradient(90deg, #059669, #10b981)' }} />
                      </div>
                    </>
                  )}

                  <div className="mt-3 flex items-center gap-1 text-[10px] text-slate-600">
                    <Database className="w-3 h-3" /><span>Firebase synced</span>
                  </div>
                </div>
              );
            })}

            {/* Add new plot card */}
            <div onClick={() => { setEditPlot(null); setShowModal(true); }}
              className="rounded-2xl border-2 border-dashed min-h-[180px] flex flex-col items-center justify-center gap-3 cursor-pointer transition-all hover:border-emerald-500/50 hover:bg-emerald-500/5 group"
              style={{ borderColor: 'rgba(71,85,105,0.3)' }}>
              <div className="w-10 h-10 rounded-xl border-2 border-dashed flex items-center justify-center transition-colors group-hover:border-emerald-500/50"
                style={{ borderColor: 'rgba(71,85,105,0.4)', background: 'rgba(16,185,129,0.05)' }}>
                <Plus className="w-5 h-5 text-slate-500 group-hover:text-emerald-500 transition-colors" />
              </div>
              <div className="text-center">
                <div className="text-sm font-semibold text-slate-400 group-hover:text-slate-200 transition-colors">Add New Plot</div>
                <div className="text-xs text-slate-600 mt-0.5">Track a new crop or bed</div>
              </div>
            </div>
          </div>
        </div>

        {/* ── SECTION 6: QUICK STATS ROW ─────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: Leaf, label: 'Total Plots', value: `${plots.length}`, sub: 'Active monitoring', color: '#10b981', bg: 'rgba(16,185,129,0.08)' },
            { icon: Zap, label: 'Sensor Nodes', value: '4', sub: 'ESP32 devices', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)' },
            { icon: Target, label: 'Health Score', value: `${healthScore}%`, sub: 'Overall farm health', color: '#a78bfa', bg: 'rgba(167,139,250,0.08)' },
            { icon: Calendar, label: 'Next Harvest', value: remaining !== null ? `${remaining}d` : 'N/A', sub: plot?.cropType || 'No active plot', color: '#06b6d4', bg: 'rgba(6,182,212,0.08)' },
          ].map(stat => (
            <div key={stat.label} className="card rounded-2xl p-5 flex items-center gap-4 hover:-translate-y-0.5 transition-all">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: stat.bg, border: `1px solid ${stat.color}25` }}>
                <stat.icon className="w-5 h-5" style={{ color: stat.color }} />
              </div>
              <div>
                <div className="stat-number text-xl font-bold text-slate-100">{stat.value}</div>
                <div className="text-xs font-medium text-slate-300">{stat.label}</div>
                <div className="text-[11px] text-slate-500">{stat.sub}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ── SECTION 7: SYSTEM LOGS ─────────────────────────────────────── */}
        <div className="card rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="section-title font-semibold text-slate-100">System Activity</h3>
              <p className="text-xs text-slate-500 mt-0.5">Real-time event log from all sensor nodes</p>
            </div>
            <button className="text-xs text-slate-400 hover:text-emerald-400 transition-colors flex items-center gap-1">
              View all <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-slate-500" style={{ borderColor: 'rgba(71,85,105,0.25)' }}>
                  {['Time', 'Event', 'Sensor / Node', 'Value', 'Status'].map(h => (
                    <th key={h} className="text-left py-2.5 px-3 text-[11px] font-semibold uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id} className="border-b hover:bg-slate-800/20 transition-colors" style={{ borderColor: 'rgba(71,85,105,0.15)' }}>
                    <td className="py-3 px-3 text-slate-400 stat-number text-xs">{log.time}</td>
                    <td className="py-3 px-3 text-slate-200 font-medium text-sm">{log.event}</td>
                    <td className="py-3 px-3 text-slate-400 text-xs">{log.sensor}</td>
                    <td className="py-3 px-3 text-slate-300 text-xs">{log.value}</td>
                    <td className="py-3 px-3">
                      <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold",
                        log.status === 'success' && "bg-emerald-500/10 text-emerald-400",
                        log.status === 'warning' && "bg-amber-500/10 text-amber-400",
                        log.status === 'info' && "bg-cyan-500/10 text-cyan-400")}>
                        {log.status === 'success' && <CheckCircle className="w-2.5 h-2.5" />}
                        {log.status === 'warning' && <AlertTriangle className="w-2.5 h-2.5" />}
                        {log.status === 'info' && <Info className="w-2.5 h-2.5" />}
                        <span className="capitalize hidden sm:inline">{log.status === 'info' ? 'Cached' : log.status}</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* ── MODALS ─────────────────────────────────────────────────────────── */}
      {showModal && <PlotModal initial={editPlot} saving={saving} onSave={savePlot} onClose={() => setShowModal(false)} />}

      {showSoilModal && (
        <SoilMetricsModal
          initial={{ ph: sensorData.ph, nitrogen: sensorData.nitrogen, phosphorus: sensorData.phosphorus, potassium: sensorData.potassium }}
          saving={soilSaving}
          onSave={saveSoilMetrics}
          onClose={() => setShowSoilModal(false)}
        />
      )}

      {showChat && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setShowChat(false)}>
          <div className="border rounded-2xl w-full max-w-lg max-h-[600px] flex flex-col shadow-2xl overflow-hidden"
            style={{ background: '#0f1824', borderColor: 'rgba(71,85,105,0.4)' }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'rgba(71,85,105,0.3)', background: 'rgba(30,41,59,0.6)' }}>
              <h3 className="flex items-center gap-2 font-semibold text-slate-100">
                <Bot className="w-5 h-5 text-emerald-400" /> AI Agronomist
              </h3>
              <button onClick={() => setShowChat(false)} className="p-1 hover:bg-slate-700 rounded-lg text-slate-400 transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-3 flex items-center gap-3 flex-wrap text-xs border-b" style={{ background: 'rgba(16,185,129,0.06)', borderColor: 'rgba(16,185,129,0.15)' }}>
              <span className="text-lg">{plot?.emoji}</span>
              <span className="font-semibold text-emerald-400">{plot?.name} · {plot?.cropType}</span>
              <span className="text-slate-400">🌡️ {sensorData.temperature.toFixed(1)}°C</span>
              <span className="text-slate-400">💧 {sensorData.moisture.toFixed(0)}%</span>
              <span className="text-slate-400">pH {sensorData.ph}</span>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ maxHeight: 380 }}>
              {messages.map(msg => (
                <div key={msg.id} className={cn("flex gap-3", msg.role === 'user' ? "ml-auto flex-row-reverse max-w-[80%]" : "max-w-[90%]")}>
                  <div className={cn("w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0",
                    msg.role === 'ai' ? "bg-emerald-600" : "bg-slate-700")}>
                    {msg.role === 'ai' ? <Bot className="w-4 h-4 text-white" /> : <User className="w-4 h-4 text-slate-300" />}
                  </div>
                  <div className={cn("p-3 rounded-2xl text-sm leading-relaxed",
                    msg.role === 'ai' ? "text-slate-200 rounded-tl-sm" : "text-white rounded-tr-sm")}
                    style={{ background: msg.role === 'ai' ? 'rgba(30,41,59,0.8)' : 'linear-gradient(135deg, #059669, #0891b2)' }}>
                    {msg.content}
                  </div>
                </div>
              ))}
              {isAITyping && (
                <div className="flex gap-3 max-w-[90%]">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center bg-emerald-600"><Bot className="w-4 h-4 text-white" /></div>
                  <div className="p-3 rounded-2xl rounded-tl-sm" style={{ background: 'rgba(30,41,59,0.8)' }}>
                    <div className="flex gap-1">{[0, 150, 300].map(d => <span key={d} className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />)}</div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
            <div className="p-4 border-t flex gap-2" style={{ borderColor: 'rgba(71,85,105,0.3)', background: 'rgba(30,41,59,0.4)' }}>
              <input type="text" value={inputMessage} onChange={e => setInputMessage(e.target.value)} onKeyPress={e => e.key === 'Enter' && handleSendMessage()}
                placeholder="Ask about your crops..." disabled={isAITyping}
                className="flex-1 rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none border disabled:opacity-50"
                style={{ background: 'rgba(15,24,36,0.8)', borderColor: 'rgba(71,85,105,0.3)' }} />
              <button onClick={handleSendMessage} disabled={isAITyping || !inputMessage.trim()}
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #059669, #0891b2)' }}>
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}