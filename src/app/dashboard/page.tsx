'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, BarChart, Bar
} from 'recharts';
import {
  Menu, Search, RefreshCw, Bell, AlertTriangle, X, Droplets,
  Thermometer, Waves, FlaskConical, ArrowUp, ArrowDown, Send,
  Download, Bot, Lightbulb, TrendingUp, CheckCircle, AlertCircle,
  Info, User, Plus, Edit3, Database, BarChart2, Wind, ArrowUpRight,
  ArrowDownRight, Check, MessageCircle, Layers, Activity, Sprout
} from 'lucide-react';
import clsx, { type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, subHours } from 'date-fns';
import {
  startRealtimeUpdates, fetchSensorData, fetchHistoricalData,
  auth, type HistoricalDataPoint
} from '@/lib/firebase';
import { onAuthStateChanged, type User as AuthUser } from 'firebase/auth';
import { doc, setDoc, collection, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// ── Utilities ─────────────────────────────────────────────────────────────────
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ── Groq AI ───────────────────────────────────────────────────────────────────
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
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.error?.message || `AI error ${res.status}`); }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content ?? 'No response received.';
}

// ── Types ─────────────────────────────────────────────────────────────────────
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

// ── Constants ─────────────────────────────────────────────────────────────────
const CROPS = [
  { type: 'Tomatoes',  emoji: '🍅', varieties: ['Roma VF', 'Cherry 100', 'Beef Master', 'Big Boy'] },
  { type: 'Maize',     emoji: '🌽', varieties: ['H614D', 'DK8031', 'SC403', 'PANNAR 67'] },
  { type: 'Beans',     emoji: '🫘', varieties: ['Rose Coco', 'Canadian Wonder', 'Mwezi Moja'] },
  { type: 'Kale',      emoji: '🥬', varieties: ['Thousand Headed', 'Sukuma Wiki', 'Curly'] },
  { type: 'Spinach',   emoji: '🥗', varieties: ['Malabar', 'New Zealand', 'Baby Spinach'] },
  { type: 'Capsicum',  emoji: '🫑', varieties: ['California Wonder', 'Red Beauty', 'Bell Boy'] },
  { type: 'Avocado',   emoji: '🥑', varieties: ['Hass', 'Fuerte', 'Reed'] },
];

const DEFAULT_PLOTS: Plot[] = [
  { id: 'plot-a', name: 'Plot A', cropType: 'Tomatoes', variety: 'Roma VF', area: '0.5 ha', plantedDate: '2025-12-01', harvestDate: '2026-03-01', status: 'growing', emoji: '🍅' },
  { id: 'plot-b', name: 'Plot B', cropType: 'Maize', variety: 'H614D', area: '1.2 ha', plantedDate: '2025-11-15', harvestDate: '2026-02-20', status: 'growing', emoji: '🌽' },
  { id: 'plot-c', name: 'Plot C', cropType: 'Beans', variety: 'Rose Coco', area: '0.8 ha', plantedDate: '2025-12-20', harvestDate: '2026-02-28', status: 'dormant', emoji: '🫘' },
];

// ── Sensor thresholds (from file 1) ──────────────────────────────────────────
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
  const { optimalMin, optimalMax } = SENSOR_THRESHOLDS[key];
  const st = calcStatus(value, key);
  if (st === 'optimal') return 'Optimal';
  if (st === 'warning') return 'Critical';
  return value < optimalMin ? 'Below Optimal' : 'Above Optimal';
}

// ── Chart processing (from file 1) ───────────────────────────────────────────
function processHistoricalForChart(
  historyData: HistoricalDataPoint[],
  timeRange: '24h' | '7d' | '30d'
) {
  if (!historyData.length) return [];
  return historyData.map(item => ({
    time: format(new Date(item.timestamp * 1000), timeRange === '24h' ? 'HH:mm' : 'MMM d'),
    moisture: +item.soilMoisture.toFixed(2),
    temperature: +item.temperature.toFixed(2),
    humidity: +item.humidity.toFixed(2),
  }));
}

// ── Helpers ───────────────────────────────────────────────────────────────────
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

// ── Firebase helpers ──────────────────────────────────────────────────────────
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
        <Area type="monotone" dataKey="val" stroke={color} fill={color} fillOpacity={0.1} strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  </div>
);

// ── Plot Modal ────────────────────────────────────────────────────────────────
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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-slate-700 flex items-center gap-3">
          <span className="text-3xl">{f.emoji}</span>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-slate-100">{isNew ? 'Add New Plot' : `Edit ${f.name}`}</h3>
            <p className="text-xs text-slate-400 mt-1">Saved to Database</p>
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

// ══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
export default function SmartFarmDashboard() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [plots, setPlots] = useState<Plot[]>(DEFAULT_PLOTS);
  const [activePlotId, setActivePlotId] = useState('plot-a');
  const [sensorData, setSensorData] = useState<SensorData>({
    moisture: 62, temperature: 24.5, humidity: 71,
    ph: 6.4, nitrogen: 45, phosphorus: 32, potassium: 180
  });
  const [isConnected, setIsConnected] = useState(false);
  const [lastSync, setLastSync] = useState('Never');
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d'>('24h');
  // Chart data from real Firebase historical data (file 1 approach)
  const [chartData, setChartData] = useState<Array<{ time: string; moisture: number; temperature: number; humidity: number }>>([]);
  const [isLoadingChart, setIsLoadingChart] = useState(true);
  const [selectedMetric, setSelectedMetric] = useState<'moisture' | 'temperature' | 'humidity'>('temperature');
  const [messages, setMessages] = useState<Message[]>([{
    id: '1', role: 'ai',
    content: "Hello! I'm your AI farming assistant powered by LLaMA 3. I can help you analyze crop data, predict yields, suggest irrigation schedules, and diagnose plant health issues. What would you like to know about your farm today?"
  }]);
  const [inputMessage, setInputMessage] = useState('');
  const [isAITyping, setIsAITyping] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [editPlot, setEditPlot] = useState<Plot | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [soilSaving, setSoilSaving] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Random mini-chart data (decorative sparklines)
  const miniChartData = Array.from({ length: 10 }, () => Math.floor(Math.random() * 40 + 40));

  const plot = plots.find(p => p.id === activePlotId) ?? plots[0];
  const growth = plot?.plantedDate && plot?.harvestDate ? growthPct(plot.plantedDate, plot.harvestDate) : 0;
  const remaining = plot?.harvestDate ? daysLeft(plot.harvestDate) : null;
  const chartColor = { moisture: '#3b82f6', temperature: '#f97316', humidity: '#0891b2' }[selectedMetric];

  // ── Auth ────────────────────────────────────────────────────────────────────
  useEffect(() => onAuthStateChanged(auth, setCurrentUser), []);

  // ── Firebase plots listener ─────────────────────────────────────────────────
  useEffect(() => {
    return onSnapshot(collection(db, 'plots'), snap => {
      if (!snap.empty) setPlots(snap.docs.map(d => d.data() as Plot));
    });
  }, []);

  // ── Firebase soil metrics listener ─────────────────────────────────────────
  useEffect(() => {
    return onSnapshot(doc(db, 'plots', activePlotId, 'soil_metrics', 'current'), snap => {
      if (snap.exists()) {
        const d = snap.data();
        setSensorData(prev => ({
          ...prev,
          ph: d.ph ?? prev.ph,
          nitrogen: d.nitrogen ?? prev.nitrogen,
          phosphorus: d.phosphorus ?? prev.phosphorus,
          potassium: d.potassium ?? prev.potassium,
        }));
      }
    });
  }, [activePlotId]);

  // ── Real-time sensor data (file 1 approach) ─────────────────────────────────
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

  // ── Historical chart data from Firebase (file 1 approach) ──────────────────
  useEffect(() => {
    const loadChartData = async () => {
      setIsLoadingChart(true);
      const hoursMap: Record<'24h' | '7d' | '30d', number> = { '24h': 24, '7d': 168, '30d': 720 };
      const historyData = await fetchHistoricalData(hoursMap[timeRange]);

      if (historyData.length > 0) {
        setChartData(processHistoricalForChart(historyData, timeRange));
      } else {
        setChartData([{
          time: format(new Date(), 'HH:mm'),
          moisture: sensorData.moisture,
          temperature: sensorData.temperature,
          humidity: sensorData.humidity,
        }]);
      }
      setIsLoadingChart(false);
    };
    loadChartData();
  }, [timeRange]); // Only on time range change, same as file 1

  // ── Chat scroll ─────────────────────────────────────────────────────────────
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // ── AI Chat ─────────────────────────────────────────────────────────────────
  const handleSendMessage = useCallback(async () => {
    if (!inputMessage.trim() || isAITyping) return;
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: inputMessage };
    setMessages(prev => [...prev, userMsg]);
    setInputMessage('');
    setIsAITyping(true);
    try {
      const systemContext = `You are an expert AI agronomist assistant for a smart farm in Kenya.
Active plot: ${plot?.name} — ${plot?.cropType} (${plot?.variety}).
Current sensor readings:
- Soil Moisture: ${sensorData.moisture.toFixed(1)}%
- Temperature: ${sensorData.temperature.toFixed(1)}°C
- Humidity: ${sensorData.humidity.toFixed(1)}%
- Soil pH: ${sensorData.ph}
- Nitrogen (N): ${sensorData.nitrogen} mg/kg
- Phosphorus (P): ${sensorData.phosphorus} mg/kg
- Potassium (K): ${sensorData.potassium} mg/kg
Give concise, actionable advice. Be friendly and professional.`.trim();
      const aiResponse = await callGroqAI(inputMessage, systemContext);
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'ai', content: aiResponse }]);
    } catch (error) {
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'ai', content: `❌ Error: ${(error as Error).message}` }]);
    } finally {
      setIsAITyping(false);
    }
  }, [inputMessage, sensorData, isAITyping, plot]);

  // ── Save plot ───────────────────────────────────────────────────────────────
  const savePlot = async (p: Plot) => {
    setSaving(true);
    try {
      await fbSavePlot(p);
      setPlots(prev => {
        const i = prev.findIndex(x => x.id === p.id);
        if (i >= 0) { const n = [...prev]; n[i] = p; return n; }
        return [...prev, p];
      });
      setActivePlotId(p.id);
    } finally { setSaving(false); setShowModal(false); }
  };

  // ── Insights (dynamic values from sensor data) ──────────────────────────────
  const insights: Insight[] = [
    {
      id: '1', priority: 'high', title: 'Nitrogen Deficiency Alert',
      description: `N levels at ${sensorData.nitrogen} mg/kg are below optimal for ${plot?.cropType}.`,
      recommendation: 'Recommend applying NPK fertilizer (20-10-10) within 48 hours.', time: '2 mins ago'
    },
    {
      id: '2', priority: 'medium', title: 'Irrigation Optimization',
      description: `Moisture trending at ${sensorData.moisture.toFixed(0)}%.`,
      recommendation: 'Reduce watering frequency by 10% to prevent root rot.', time: '1 hour ago'
    },
    {
      id: '3', priority: 'low', title: 'Growth Prediction',
      description: remaining ? `${remaining} days to estimated harvest.` : 'Harvest forecast available.',
      recommendation: 'Current conditions suggest harvest readiness in 18-21 days.', time: '3 hours ago'
    }
  ];

  const logs = [
    { id: '1', time: '10:42 AM', event: 'Data Sync', sensor: 'ESP32-Node1', value: 'Batch: 24 readings', status: 'success' as const },
    { id: '2', time: '10:38 AM', event: 'Threshold Alert', sensor: 'Soil Moisture', value: '23% → 19%', status: 'warning' as const },
    { id: '3', time: '10:35 AM', event: 'AI Analysis', sensor: 'AI System', value: '3 insights generated', status: 'success' as const },
    { id: '4', time: '10:30 AM', event: 'Offline Mode', sensor: 'Connectivity', value: 'WiFi disconnected', status: 'info' as const },
  ];

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="text-slate-100 font-sans min-h-screen" style={{ background: '#1a2332' }}>
      {/* Subtle ambient blobs - much more subdued */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-0 right-0 w-96 h-96 rounded-full blur-3xl"
          style={{ background: 'rgba(16,185,129,0.02)' }} />
        <div className="absolute bottom-0 left-0 w-80 h-80 rounded-full blur-3xl"
          style={{ background: 'rgba(59,130,246,0.015)' }} />
      </div>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="relative z-40 sticky top-0 h-16 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 flex items-center justify-between px-4 md:px-6 lg:px-8 gap-4">
        <button onClick={() => document.dispatchEvent(new CustomEvent('toggleMobileMenu'))}
          className="lg:hidden p-2 rounded-lg hover:bg-slate-800 text-slate-400 transition-colors">
          <Menu className="w-5 h-5" />
        </button>

        <div className="hidden sm:flex items-center gap-3 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 w-full sm:w-64 md:w-80 lg:w-96">
          <Search className="w-4 h-4 text-slate-500" />
          <input type="text" placeholder="Search plots, crops..."
            className="bg-transparent border-none outline-none text-sm text-slate-200 w-full placeholder:text-slate-600" />
        </div>

        <div className="flex items-center gap-3 ml-auto">
          {/* Plot chips */}
          <div className="hidden md:flex gap-2 overflow-x-auto">
            {plots.slice(0, 3).map(p => (
              <button key={p.id} onClick={() => setActivePlotId(p.id)}
                className={cn("flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap border",
                  activePlotId === p.id
                    ? "bg-emerald-500 border-emerald-500 text-white"
                    : "bg-slate-800 border-slate-700 text-slate-400 hover:border-emerald-500")}>
                <span>{p.emoji}</span><span>{p.name}</span>
              </button>
            ))}
            <button onClick={() => { setEditPlot(null); setShowModal(true); }}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium bg-slate-800 border border-dashed border-slate-700 text-slate-400 hover:border-emerald-500 whitespace-nowrap">
              <Plus className="w-3 h-3" /> Add
            </button>
          </div>

          <button onClick={() => window.location.reload()} className="p-2.5 rounded-xl hover:bg-slate-800 text-slate-400 transition-all">
            <RefreshCw className="w-5 h-5" />
          </button>

          <button onClick={() => router.push('/notifications')} className="relative p-2.5 rounded-xl hover:bg-slate-800 text-slate-400 transition-all">
            <Bell className="w-5 h-5" />
            <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 text-[10px] font-bold text-white rounded-full flex items-center justify-center border-2 border-slate-900">3</span>
          </button>

          <button onClick={() => router.push('/my_account')}
            className="flex items-center gap-2 pl-3 border-l border-slate-800 rounded-lg hover:bg-slate-800/50 transition-colors">
            <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-sm font-bold text-white">
              {currentUser?.photoURL
                ? <img src={currentUser.photoURL} alt="" className="w-8 h-8 rounded-full object-cover" />
                : initials(currentUser)}
            </div>
            <span className="text-sm font-medium hidden lg:block text-slate-200">
              {currentUser?.displayName || currentUser?.email || 'Account'}
            </span>
          </button>
        </div>
      </header>

      {/* ── Main Content ───────────────────────────────────────────────────── */}
      <div className="relative z-10 p-4 md:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6">

        {/* SECTION 1: PLOT OVERVIEW */}
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
                <span className="text-3xl">{plot?.emoji}</span>
                {plot?.name} — {plot?.cropType}
              </h1>
              <p className="text-sm text-slate-400 mt-1">
                {plot?.variety} · {plot?.area} · Planted {plot?.plantedDate || 'N/A'}
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setEditPlot(plot ?? null); setShowModal(true); }}
                className="px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 font-medium text-sm hover:bg-slate-700 transition-colors flex items-center gap-2">
                <Edit3 className="w-4 h-4" /> Edit Plot
              </button>
              <button onClick={() => setShowChat(true)}
                className="px-4 py-2.5 rounded-xl bg-emerald-600 text-white font-semibold text-sm hover:bg-emerald-500 transition-colors flex items-center gap-2">
                <Bot className="w-4 h-4" /> Ask AI
              </button>
            </div>
          </div>

          {/* Growth Progress Bar */}
          {plot?.plantedDate && plot?.harvestDate && (
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 flex items-center gap-6 flex-wrap">
              <div className="flex items-center gap-2">
                <Sprout className="w-5 h-5 text-emerald-500" />
                <span className="font-bold text-sm text-slate-100">Growth Progress</span>
              </div>
              <div className="flex-1 min-w-[200px]">
                <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full transition-all duration-1000"
                    style={{ width: `${growth}%` }} />
                </div>
                <div className="flex justify-between text-xs text-slate-400 mt-2">
                  <span>{plot.plantedDate}</span>
                  <span className="font-bold text-emerald-400">{growth}% grown</span>
                  <span>{plot.harvestDate}</span>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                {remaining !== null && (
                  <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full text-xs font-semibold">
                    🗓 {remaining} days left
                  </span>
                )}
                <span className={cn("px-3 py-1 rounded-full text-xs font-semibold border capitalize",
                  plot.status === 'growing' && "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
                  plot.status === 'dormant' && "bg-amber-500/10 text-amber-400 border-amber-500/20",
                  plot.status === 'harvested' && "bg-slate-500/10 text-slate-400 border-slate-500/20")}>
                  {plot.status === 'growing' ? '🌱' : plot.status === 'dormant' ? '💤' : '✅'} {plot.status}
                </span>
                <span className="px-3 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full text-xs font-semibold flex items-center gap-1">
                  <Database className="w-3 h-3" /> Synced · {lastSync}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* SECTION 2: SENSOR CARDS — UI from file 2, status from file 1 thresholds */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            {
              key: 'temperature' as const, label: 'Temperature', icon: Thermometer,
              value: sensorData.temperature.toFixed(1), unit: '°C',
              accent: '#f97316', pale: '#7c2d12', delta: '-1.2°C', up: false
            },
            {
              key: 'humidity' as const, label: 'Humidity', icon: Waves,
              value: sensorData.humidity.toFixed(1), unit: '%',
              accent: '#0891b2', pale: '#164e63', delta: '+3%', up: true
            },
            {
              key: 'moisture' as const, label: 'Soil Moisture', icon: Droplets,
              value: sensorData.moisture.toFixed(1), unit: '%',
              accent: '#2563eb', pale: '#1e3a8a', delta: '+5%', up: true
            }
          ].map(s => {
            const st = calcStatus(parseFloat(s.value), s.key);
            const stLabel = statusLabel(parseFloat(s.value), s.key);
            return (
              <div key={s.key}
                className="bg-slate-800 border border-slate-700 rounded-2xl p-5 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/40 transition-all duration-300 cursor-pointer group"
                onClick={() => setSelectedMetric(s.key)}>
                <div className="flex justify-between items-start mb-4">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: s.pale }}>
                    <s.icon className="w-6 h-6" style={{ color: s.accent }} />
                  </div>
                  <span className={cn("flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border",
                    st === 'optimal' && "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
                    st === 'good' && "bg-amber-500/10 text-amber-400 border-amber-500/20",
                    st === 'warning' && "bg-red-500/10 text-red-400 border-red-500/20")}>
                    {st === 'optimal' ? <Check className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                    {stLabel}
                  </span>
                </div>
                <div className="text-4xl font-bold text-slate-100 mb-1">
                  {s.value}<span className="text-lg text-slate-400 ml-1">{s.unit}</span>
                </div>
                <div className="text-sm text-slate-400 mb-3">{s.label}</div>
                <div className={cn("flex items-center gap-1 text-xs font-medium", s.up ? "text-emerald-400" : "text-red-400")}>
                  {s.up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                  {s.delta} from yesterday
                </div>
                <div className="mt-4 h-16 opacity-60 group-hover:opacity-100 transition-opacity">
                  <MiniChart color={s.accent} data={miniChartData} />
                </div>
              </div>
            );
          })}
        </div>

        {/* SECTION 3: SOIL METRICS + AI INSIGHTS */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Soil Quality Metrics (file 2 UI + file 1 threshold status) */}
          <div className="lg:col-span-2 bg-slate-800 border border-slate-700 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold text-slate-100">Soil Quality Metrics</h3>
                <p className="text-xs text-slate-400 mt-1">{plot?.name} · Sync: {lastSync || '—'}</p>
              </div>
              <button
                onClick={async () => {
                  setSoilSaving(true);
                  await fbSaveSoil(activePlotId, {
                    ph: sensorData.ph, nitrogen: sensorData.nitrogen,
                    phosphorus: sensorData.phosphorus, potassium: sensorData.potassium
                  });
                  setSoilSaving(false);
                }}
                disabled={soilSaving}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 font-medium text-xs hover:bg-slate-700 transition-colors disabled:opacity-50">
                {soilSaving ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Database className="w-3 h-3" />}
                Save Metrics
              </button>
            </div>

            {[
              {
                key: 'ph' as const, icon: FlaskConical, label: 'Soil pH',
                value: sensorData.ph.toFixed(1), unit: 'pH', ideal: '6.0–7.0',
                pct: (sensorData.ph / 14) * 100, accent: '#7c3aed'
              },
              {
                key: 'nitrogen' as const, icon: Activity, label: 'Nitrogen (N)',
                value: `${sensorData.nitrogen}`, unit: 'mg/kg', ideal: '50–150',
                pct: Math.min(100, (sensorData.nitrogen / 200) * 100), accent: '#16a34a'
              },
              {
                key: 'phosphorus' as const, icon: Layers, label: 'Phosphorus (P)',
                value: `${sensorData.phosphorus}`, unit: 'mg/kg', ideal: '30–80',
                pct: Math.min(100, (sensorData.phosphorus / 100) * 100), accent: '#d97706'
              },
              {
                key: 'potassium' as const, icon: Wind, label: 'Potassium (K)',
                value: `${sensorData.potassium}`, unit: 'mg/kg', ideal: '150–300',
                pct: Math.min(100, (sensorData.potassium / 400) * 100), accent: '#0891b2'
              }
            ].map(row => {
              const st = calcStatus(parseFloat(row.value), row.key);
              const stLabel = statusLabel(parseFloat(row.value), row.key);
              return (
                <div key={row.key} className="flex items-center gap-4 py-3 border-b border-slate-700/50 last:border-0">
                  <div className="w-10 h-10 rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-center flex-shrink-0">
                    <row.icon className="w-4 h-4" style={{ color: row.accent }} />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-slate-200">{row.label}</span>
                      <span className="text-sm font-bold text-slate-100">
                        {row.value} <span className="text-xs font-normal text-slate-400">{row.unit}</span>
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${row.pct}%`, backgroundColor: row.accent, opacity: 0.7 }} />
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 min-w-[90px]">
                    <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold border",
                      st === 'optimal' && "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
                      st === 'good' && "bg-amber-500/10 text-amber-400 border-amber-500/20",
                      st === 'warning' && "bg-red-500/10 text-red-400 border-red-500/20")}>
                      {stLabel}
                    </span>
                    <span className="text-[10px] text-slate-500">Ideal: {row.ideal}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* AI Insights */}
          <div className="bg-slate-800 border border-slate-700 rounded-2xl flex flex-col overflow-hidden">
            <div className="p-4 bg-gradient-to-r from-emerald-600 to-emerald-700 flex items-center gap-3">
              <Bot className="w-6 h-6 text-white" />
              <h3 className="text-lg font-semibold text-white flex-1">AI Insights</h3>
              <span className="px-2 py-0.5 bg-white/20 rounded-full text-xs font-semibold text-white animate-pulse">Live</span>
            </div>

            <div className="flex-1 p-4 space-y-3 overflow-y-auto max-h-[320px]">
              {insights.map(insight => (
                <div key={insight.id}
                  className={cn("flex gap-3 p-3 rounded-xl border-l-4 transition-all hover:translate-x-1 cursor-pointer",
                    insight.priority === 'high' && "bg-red-500/5 border-red-500",
                    insight.priority === 'medium' && "bg-amber-500/5 border-amber-500",
                    insight.priority === 'low' && "bg-cyan-500/5 border-cyan-500")}>
                  <div className={cn("w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0",
                    insight.priority === 'high' && "bg-red-500/10 text-red-400",
                    insight.priority === 'medium' && "bg-amber-500/10 text-amber-400",
                    insight.priority === 'low' && "bg-cyan-500/10 text-cyan-400")}>
                    {insight.priority === 'high' ? <AlertCircle className="w-5 h-5" /> :
                      insight.priority === 'medium' ? <Lightbulb className="w-5 h-5" /> :
                        <TrendingUp className="w-5 h-5" />}
                  </div>
                  <div>
                    <strong className="block text-sm font-semibold text-slate-200 mb-1">{insight.title}</strong>
                    <p className="text-xs text-slate-400 leading-relaxed mb-1">{insight.description} {insight.recommendation}</p>
                    <span className="text-[10px] text-slate-500">{insight.time}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-slate-700 bg-slate-900/50 flex gap-2">
              <input type="text" placeholder="Ask AI about your crops..."
                className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50"
                onClick={() => setShowChat(true)} readOnly />
              <button onClick={() => setShowChat(true)}
                className="w-10 h-10 bg-emerald-600 hover:bg-emerald-500 rounded-xl flex items-center justify-center text-white transition-all hover:scale-105 active:scale-95">
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* SECTION 4: ANALYTICS CHART — Real Firebase historical data (file 1) */}
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <h3 className="text-lg font-semibold text-slate-100">Environmental Trends</h3>
            <div className="flex items-center gap-2 flex-wrap">
              {(['24h', '7d', '30d'] as const).map(range => (
                <button key={range} onClick={() => setTimeRange(range)}
                  className={cn("px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
                    timeRange === range ? "bg-emerald-500 text-white" : "bg-slate-700 text-slate-400 hover:bg-slate-600")}>
                  {range.toUpperCase()}
                </button>
              ))}
              <button className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 text-sm font-medium transition-colors">
                <Download className="w-4 h-4" /><span className="hidden md:inline">Export</span>
              </button>
            </div>
          </div>

          <div className="h-[300px] w-full">
            {isLoadingChart ? (
              <div className="w-full h-full flex items-center justify-center gap-3">
                <RefreshCw className="w-6 h-6 animate-spin text-slate-400" />
                <span className="text-slate-400 text-sm">Loading chart data...</span>
              </div>
            ) : chartData.length === 0 ? (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-slate-400">No historical data available</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id={`color${selectedMetric}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={chartColor} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={chartColor} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                  <XAxis dataKey="time" stroke="#64748b" tick={{ fill: '#64748b', fontSize: 12 }} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748b" tick={{ fill: '#64748b', fontSize: 12 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#f1f5f9' }} />
                  {/* Render the selected metric from real Firebase data */}
                  <Area type="monotone" dataKey={selectedMetric}
                    name={selectedMetric.charAt(0).toUpperCase() + selectedMetric.slice(1)}
                    stroke={chartColor} fillOpacity={1} fill={`url(#color${selectedMetric})`} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Metric Selector */}
          <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-slate-700">
            <span className="text-sm font-medium text-slate-400">View:</span>
            {[
              { key: 'temperature' as const, label: 'Temperature', icon: Thermometer, color: '#f97316' },
              { key: 'humidity' as const, label: 'Humidity', icon: Waves, color: '#0891b2' },
              { key: 'moisture' as const, label: 'Moisture', icon: Droplets, color: '#2563eb' }
            ].map(m => (
              <button key={m.key} onClick={() => setSelectedMetric(m.key)}
                className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all border",
                  selectedMetric === m.key ? "border-transparent text-white" : "bg-slate-700 border-slate-700 text-slate-400 hover:bg-slate-600")}
                style={selectedMetric === m.key ? { backgroundColor: m.color } : {}}>
                <m.icon className="w-4 h-4" /><span>{m.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* SECTION 5: ALL PLOTS */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-100">All Plots</h3>
            <button onClick={() => { setEditPlot(null); setShowModal(true); }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white font-semibold text-sm hover:bg-emerald-500 transition-colors">
              <Plus className="w-4 h-4" /> Add New Plot
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {plots.map(p => {
              const g = p.plantedDate && p.harvestDate ? growthPct(p.plantedDate, p.harvestDate) : 0;
              const dl = p.harvestDate ? daysLeft(p.harvestDate) : null;
              return (
                <div key={p.id}
                  onClick={() => { setActivePlotId(p.id); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  className={cn("bg-slate-800 border rounded-2xl p-5 cursor-pointer transition-all hover:-translate-y-1 hover:shadow-xl",
                    activePlotId === p.id ? "border-emerald-500 border-2" : "border-slate-700")}>
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{p.emoji}</span>
                      <div>
                        <div className="font-bold text-slate-100">{p.name}</div>
                        <div className="text-sm text-slate-400">{p.cropType} · {p.variety}</div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold capitalize",
                        p.status === 'growing' && "bg-emerald-500/10 text-emerald-400",
                        p.status === 'dormant' && "bg-amber-500/10 text-amber-400",
                        p.status === 'harvested' && "bg-slate-500/10 text-slate-400")}>
                        {p.status}
                      </span>
                      <button onClick={e => { e.stopPropagation(); setEditPlot(p); setShowModal(true); }}
                        className="p-1 hover:bg-slate-700 rounded text-slate-400">
                        <Edit3 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mb-4">
                    {[
                      { label: 'Area', value: p.area || '—' },
                      { label: 'Days left', value: dl !== null ? `${dl}d` : '—' },
                      { label: 'Planted', value: p.plantedDate || '—' },
                      { label: 'Harvest', value: p.harvestDate || '—' }
                    ].map(m => (
                      <div key={m.label} className="bg-slate-900 rounded-lg p-2">
                        <div className="text-[10px] text-slate-500 uppercase">{m.label}</div>
                        <div className="text-xs font-semibold text-slate-200 mt-1">{m.value}</div>
                      </div>
                    ))}
                  </div>

                  {p.plantedDate && p.harvestDate && (
                    <>
                      <div className="flex justify-between text-xs text-slate-400 mb-2">
                        <span>Growth</span>
                        <span className="text-emerald-400 font-bold">{g}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full transition-all"
                          style={{ width: `${g}%` }} />
                      </div>
                    </>
                  )}

                  <div className="mt-3 flex items-center gap-1 text-xs text-amber-600">
                    <Database className="w-3 h-3" /><span>Data Synced</span>
                  </div>
                </div>
              );
            })}

            {/* Add new plot card */}
            <div onClick={() => { setEditPlot(null); setShowModal(true); }}
              className="bg-transparent border-2 border-dashed border-slate-700 rounded-2xl p-5 flex flex-col items-center justify-center gap-3 min-h-[200px] cursor-pointer hover:border-emerald-500 hover:bg-emerald-500/5 transition-all">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border-2 border-dashed border-emerald-500/30 flex items-center justify-center">
                <Plus className="w-6 h-6 text-emerald-500" />
              </div>
              <div className="font-semibold text-sm text-slate-300">Add New Plot</div>
              <div className="text-xs text-slate-500 text-center">Track a new crop or garden bed</div>
            </div>
          </div>
        </div>

        {/* SECTION 6: SYSTEM LOGS */}
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-slate-100 mb-4">System Activity</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-slate-400">
                  {['Time', 'Event', 'Sensor', 'Value', 'Status'].map(h => (
                    <th key={h} className="text-left py-3 px-4 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {logs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-700/30 transition-colors">
                    <td className="py-3 px-4 text-slate-300">{log.time}</td>
                    <td className="py-3 px-4 text-slate-200 font-medium">{log.event}</td>
                    <td className="py-3 px-4 text-slate-400">{log.sensor}</td>
                    <td className="py-3 px-4 text-slate-300">{log.value}</td>
                    <td className="py-3 px-4">
                      <span className={cn("inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium",
                        log.status === 'success' && "bg-emerald-500/10 text-emerald-400",
                        log.status === 'warning' && "bg-amber-500/10 text-amber-400",
                        log.status === 'info' && "bg-cyan-500/10 text-cyan-400")}>
                        {log.status === 'success' && <CheckCircle className="w-3 h-3" />}
                        {log.status === 'warning' && <AlertTriangle className="w-3 h-3" />}
                        {log.status === 'info' && <Info className="w-3 h-3" />}
                        <span className="hidden sm:inline capitalize">{log.status === 'info' ? 'Stored Local' : log.status}</span>
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
      {showModal && (
        <PlotModal initial={editPlot} saving={saving} onSave={savePlot} onClose={() => setShowModal(false)} />
      )}

      {/* AI Chat Modal */}
      {showChat && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={() => setShowChat(false)}>
          <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-lg max-h-[600px] flex flex-col shadow-2xl"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-slate-700">
              <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-100">
                <Bot className="w-5 h-5 text-emerald-500" /> AI Assistant
              </h3>
              <button onClick={() => setShowChat(false)} className="p-1 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-slate-200 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Context Banner */}
            <div className="p-3 bg-emerald-500/10 border-b border-emerald-500/20 flex items-center gap-3 flex-wrap text-xs text-emerald-400">
              <span className="text-lg">{plot?.emoji}</span>
              <span className="font-semibold">{plot?.name} · {plot?.cropType} ({plot?.variety})</span>
              <span>🌡️ {sensorData.temperature.toFixed(1)}°C</span>
              <span>💧 {sensorData.moisture.toFixed(0)}%</span>
              <span>💨 {sensorData.humidity.toFixed(0)}%</span>
              <span>🧪 pH {sensorData.ph}</span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[400px]">
              {messages.map(msg => (
                <div key={msg.id}
                  className={cn("flex gap-3 max-w-[85%]", msg.role === 'user' ? "ml-auto flex-row-reverse" : "")}>
                  <div className={cn("w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
                    msg.role === 'ai' ? "bg-emerald-600 text-white" : "bg-slate-700 text-slate-300")}>
                    {msg.role === 'ai' ? <Bot className="w-5 h-5" /> : <User className="w-5 h-5" />}
                  </div>
                  <div className={cn("p-3 rounded-2xl text-sm leading-relaxed",
                    msg.role === 'ai' ? "bg-slate-700 text-slate-200 rounded-tl-sm" : "bg-emerald-600 text-white rounded-tr-sm")}>
                    {msg.content}
                  </div>
                </div>
              ))}

              {isAITyping && (
                <div className="flex gap-3 max-w-[85%]">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-emerald-600 text-white">
                    <Bot className="w-5 h-5" />
                  </div>
                  <div className="p-3 rounded-2xl bg-slate-700 text-slate-200 rounded-tl-sm">
                    <div className="flex gap-1">
                      {[0, 150, 300].map(delay => (
                        <span key={delay} className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"
                          style={{ animationDelay: `${delay}ms` }} />
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <div className="p-4 border-t border-slate-700 bg-slate-900/50">
              <div className="flex gap-2">
                <input type="text" value={inputMessage} onChange={e => setInputMessage(e.target.value)}
                  onKeyPress={e => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Type your question..." disabled={isAITyping}
                  className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50 disabled:opacity-50" />
                <button onClick={handleSendMessage} disabled={isAITyping || !inputMessage.trim()}
                  className="w-11 h-11 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl flex items-center justify-center text-white transition-all hover:scale-105 active:scale-95">
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}