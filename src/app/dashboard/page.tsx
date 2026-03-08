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
        <Area type="monotone" dataKey="val" stroke={color} fill={color} fillOpacity={0.1} strokeWidth={2} dot={false} />
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
            <RadialBar background={{ fill: '#ede4d3' }} dataKey="value" cornerRadius={8} angleAxisId={0} />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-bold" style={{ color: '#1c1a15', fontFamily: "'Space Grotesk', sans-serif" }}>{value}%</span>
        </div>
      </div>
      <span className="text-xs mt-1 font-medium" style={{ color: '#9a8870', fontFamily: "'DM Sans', sans-serif" }}>{label}</span>
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
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(28,26,21,0.55)', backdropFilter: 'blur(8px)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={onClose}>
      <div style={{ background: '#fff', border: '1px solid rgba(160,130,90,0.18)', borderRadius: 20, width: '100%', maxWidth: 480, boxShadow: '0 24px 60px rgba(100,70,30,0.18)', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(160,130,90,0.12)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 28 }}>{f.emoji}</span>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 20, fontWeight: 600, color: '#1c1a15' }}>{isNew ? 'Add New Plot' : `Edit ${f.name}`}</h3>
            <p style={{ fontSize: 12, color: '#9a8870', marginTop: 2, fontFamily: "'DM Sans', sans-serif" }}>Synced to Firebase Database</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9a8870', padding: 6, borderRadius: 8 }}><X size={16} /></button>
        </div>
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '60vh', overflowY: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 11.5, fontWeight: 700, color: '#5a5040', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: "'DM Sans', sans-serif" }}>Plot Name *</label>
              <input style={{ width: '100%', background: '#f9f5ef', border: '1px solid rgba(160,130,90,0.22)', borderRadius: 10, padding: '10px 13px', fontFamily: "'DM Sans', sans-serif", fontSize: 13.5, color: '#1c1a15', outline: 'none' }}
                value={f.name} onChange={e => setF(x => ({ ...x, name: e.target.value }))} placeholder="e.g. Plot A" />
            </div>
            <div>
              <label style={{ fontSize: 11.5, fontWeight: 700, color: '#5a5040', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: "'DM Sans', sans-serif" }}>Area</label>
              <input style={{ width: '100%', background: '#f9f5ef', border: '1px solid rgba(160,130,90,0.22)', borderRadius: 10, padding: '10px 13px', fontFamily: "'DM Sans', sans-serif", fontSize: 13.5, color: '#1c1a15', outline: 'none' }}
                value={f.area} onChange={e => setF(x => ({ ...x, area: e.target.value }))} placeholder="e.g. 0.5 ha" />
            </div>
          </div>
          <div>
            <label style={{ fontSize: 11.5, fontWeight: 700, color: '#5a5040', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: "'DM Sans', sans-serif" }}>Crop Type *</label>
            <select style={{ width: '100%', background: '#f9f5ef', border: '1px solid rgba(160,130,90,0.22)', borderRadius: 10, padding: '10px 13px', fontFamily: "'DM Sans', sans-serif", fontSize: 13.5, color: '#1c1a15', outline: 'none', appearance: 'none', cursor: 'pointer' }}
              value={f.cropType} onChange={e => { const c = CROPS.find(x => x.type === e.target.value) ?? CROPS[0]; setF(x => ({ ...x, cropType: c.type, variety: c.varieties[0], emoji: c.emoji })); }}>
              {CROPS.map(c => <option key={c.type}>{c.type}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11.5, fontWeight: 700, color: '#5a5040', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: "'DM Sans', sans-serif" }}>Variety</label>
            <select style={{ width: '100%', background: '#f9f5ef', border: '1px solid rgba(160,130,90,0.22)', borderRadius: 10, padding: '10px 13px', fontFamily: "'DM Sans', sans-serif", fontSize: 13.5, color: '#1c1a15', outline: 'none', appearance: 'none', cursor: 'pointer' }}
              value={f.variety} onChange={e => setF(x => ({ ...x, variety: e.target.value }))}>
              {crop.varieties.map(v => <option key={v}>{v}</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 11.5, fontWeight: 700, color: '#5a5040', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: "'DM Sans', sans-serif" }}>Planted</label>
              <input type="date" style={{ width: '100%', background: '#f9f5ef', border: '1px solid rgba(160,130,90,0.22)', borderRadius: 10, padding: '10px 13px', fontFamily: "'DM Sans', sans-serif", fontSize: 13.5, color: '#1c1a15', outline: 'none', colorScheme: 'light' }}
                value={f.plantedDate} onChange={e => setF(x => ({ ...x, plantedDate: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: 11.5, fontWeight: 700, color: '#5a5040', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: "'DM Sans', sans-serif" }}>Harvest ETA</label>
              <input type="date" style={{ width: '100%', background: '#f9f5ef', border: '1px solid rgba(160,130,90,0.22)', borderRadius: 10, padding: '10px 13px', fontFamily: "'DM Sans', sans-serif", fontSize: 13.5, color: '#1c1a15', outline: 'none', colorScheme: 'light' }}
                value={f.harvestDate} onChange={e => setF(x => ({ ...x, harvestDate: e.target.value }))} />
            </div>
          </div>
          <div>
            <label style={{ fontSize: 11.5, fontWeight: 700, color: '#5a5040', display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: "'DM Sans', sans-serif" }}>Status</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['growing', 'dormant', 'harvested'] as const).map(s => (
                <button key={s} onClick={() => setF(x => ({ ...x, status: s }))}
                  style={{ flex: 1, padding: '9px 6px', borderRadius: 10, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", textTransform: 'capitalize', transition: 'all 0.15s', border: `1.5px solid ${f.status === s ? (s === 'growing' ? '#40916c' : s === 'dormant' ? '#d97706' : '#9a8870') : 'rgba(160,130,90,0.18)'}`, background: f.status === s ? (s === 'growing' ? '#f0faf2' : s === 'dormant' ? '#fffbeb' : '#f9f5ef') : 'transparent', color: f.status === s ? (s === 'growing' ? '#2d6a4f' : s === 'dormant' ? '#92400e' : '#5a5040') : '#9a8870' }}>
                  {s === 'growing' ? '🌱' : s === 'dormant' ? '💤' : '✅'} {s}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div style={{ padding: '16px 24px', borderTop: '1px solid rgba(160,130,90,0.12)', display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 11, borderRadius: 100, fontFamily: "'DM Sans', sans-serif", fontSize: 13.5, fontWeight: 500, cursor: 'pointer', background: 'transparent', border: '1px solid rgba(160,130,90,0.22)', color: '#5a5040' }}>Cancel</button>
          <button onClick={() => f.name && f.cropType && onSave(f)} disabled={saving || !f.name}
            style={{ flex: 1, padding: 11, borderRadius: 100, fontFamily: "'DM Sans', sans-serif", fontSize: 13.5, fontWeight: 600, cursor: 'pointer', background: '#2d6a4f', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, opacity: saving || !f.name ? 0.55 : 1 }}>
            {saving ? '...' : <><Database size={13} /> Save Plot</>}
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
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(28,26,21,0.55)', backdropFilter: 'blur(8px)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={onClose}>
      <div style={{ background: '#fff', border: '1px solid rgba(160,130,90,0.18)', borderRadius: 20, width: '100%', maxWidth: 440, boxShadow: '0 24px 60px rgba(100,70,30,0.18)', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(160,130,90,0.12)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: '#f0faf2', border: '1px solid rgba(45,106,79,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FlaskConical size={18} color="#2d6a4f" />
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 20, fontWeight: 600, color: '#1c1a15' }}>Edit Soil Metrics</h3>
            <p style={{ fontSize: 12, color: '#9a8870', marginTop: 2, fontFamily: "'DM Sans', sans-serif" }}>Adjust values and save to database</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9a8870', padding: 6, borderRadius: 8 }}><X size={16} /></button>
        </div>
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 22, maxHeight: '60vh', overflowY: 'auto' }}>
          {fields.map(field => {
            const val = f[field.key];
            const pct = field.key === 'ph' ? (val / 14) * 100 : Math.min(100, (val / field.max) * 100);
            const st = calcStatus(val, field.key as keyof typeof SENSOR_THRESHOLDS);
            return (
              <div key={field.key}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 30, height: 30, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${field.accent}15`, border: `1px solid ${field.accent}25` }}>
                      <field.icon size={14} color={field.accent} />
                    </div>
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: '#1c1a15', fontFamily: "'DM Sans', sans-serif" }}>{field.label}</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 17, fontWeight: 700, color: field.accent, fontFamily: "'Space Grotesk', sans-serif" }}>
                      {field.key === 'ph' ? val.toFixed(1) : val}<span style={{ fontSize: 11, fontWeight: 400, color: '#9a8870', marginLeft: 3, fontFamily: "'DM Sans', sans-serif" }}>{field.unit}</span>
                    </div>
                    <span style={{ display: 'inline-block', marginTop: 3, padding: '2px 8px', borderRadius: 100, fontSize: 10, fontWeight: 700, background: st === 'optimal' ? '#d8f3dc' : st === 'good' ? '#fef3c7' : '#fee2e2', color: st === 'optimal' ? '#2d6a4f' : st === 'good' ? '#92400e' : '#991b1b', border: `1px solid ${st === 'optimal' ? '#b7e4c7' : st === 'good' ? '#fde68a' : '#fecaca'}`, fontFamily: "'DM Sans', sans-serif" }}>
                      {statusLabel(val, field.key as keyof typeof SENSOR_THRESHOLDS)}
                    </span>
                  </div>
                </div>
                <input type="range" min={field.min} max={field.max} step={field.step} value={val}
                  onChange={e => setF(prev => ({ ...prev, [field.key]: parseFloat(e.target.value) }))}
                  style={{ width: '100%', height: 6, borderRadius: 100, appearance: 'none', cursor: 'pointer', background: `linear-gradient(to right, ${field.accent} ${pct}%, #ede4d3 ${pct}%)`, outline: 'none', border: 'none' }} />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 8 }}>
                  <span style={{ fontSize: 11, color: '#b0a088', fontFamily: "'DM Sans', sans-serif" }}>Ideal: <span style={{ color: '#5a5040', fontWeight: 600 }}>{field.ideal} {field.unit}</span></span>
                  <input type="number" min={field.min} max={field.max} step={field.step} value={field.key === 'ph' ? val.toFixed(1) : val}
                    onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) setF(prev => ({ ...prev, [field.key]: v })); }}
                    style={{ width: 90, background: '#f9f5ef', border: '1px solid rgba(160,130,90,0.22)', borderRadius: 8, padding: '6px 10px', fontSize: 12, color: '#1c1a15', textAlign: 'right', outline: 'none', fontFamily: "'DM Sans', sans-serif" }} />
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ padding: '16px 24px', borderTop: '1px solid rgba(160,130,90,0.12)', display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 11, borderRadius: 100, fontFamily: "'DM Sans', sans-serif", fontSize: 13.5, fontWeight: 500, cursor: 'pointer', background: 'transparent', border: '1px solid rgba(160,130,90,0.22)', color: '#5a5040' }}>Cancel</button>
          <button onClick={() => onSave(f)} disabled={saving}
            style={{ flex: 1, padding: 11, borderRadius: 100, fontFamily: "'DM Sans', sans-serif", fontSize: 13.5, fontWeight: 600, cursor: 'pointer', background: '#2d6a4f', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, opacity: saving ? 0.55 : 1 }}>
            {saving ? <><RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> Saving...</> : <><Database size={13} /> Save Metrics</>}
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

  const miniChartData = Array.from({ length: 12 }, () => Math.floor(Math.random() * 30 + 50));

  const plot = activePlotId ? (plots.find(p => p.id === activePlotId) ?? plots[0]) : plots[0];
  const isPlotReady = Boolean(activePlotId && plot);
  const growth = plot?.plantedDate && plot?.harvestDate ? growthPct(plot.plantedDate, plot.harvestDate) : 0;
  const remaining = plot?.harvestDate ? daysLeft(plot.harvestDate) : null;
  const chartColor = { moisture: '#2563eb', temperature: '#f97316', humidity: '#0891b2' }[selectedMetric];

  const healthScore = Math.round(
    (calcStatus(sensorData.temperature, 'temperature') === 'optimal' ? 25 : 10) +
    (calcStatus(sensorData.humidity, 'humidity') === 'optimal' ? 25 : 10) +
    (calcStatus(sensorData.moisture, 'moisture') === 'optimal' ? 25 : 10) +
    (calcStatus(sensorData.ph, 'ph') === 'optimal' ? 25 : 10)
  );

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

  const tasks = [
    { id: 1, title: 'Apply nitrogen fertilizer to Plot A', due: 'Today', priority: 'high', done: false },
    { id: 2, title: 'Inspect Plot B for pest activity', due: 'Tomorrow', priority: 'medium', done: false },
    { id: 3, title: 'Calibrate pH sensor node #3', due: 'Thu', priority: 'low', done: true },
    { id: 4, title: 'Schedule irrigation for Plot C', due: 'Wed', priority: 'medium', done: false },
  ];

  const [tasksDone, setTasksDone] = useState<number[]>([3]);

  // ── ELEGANT COLOR PALETTE ──────────────────────────────────────────────────
  // Subtle tinted card backgrounds — warm, cool, sage, amber
  // All very light so text stays readable; darker borders for definition

  const statusBg   = (s: SensorStatus) => ({ optimal: '#f0faf2', good: '#fffbeb', warning: '#fff1f2' }[s]);
  const statusClr  = (s: SensorStatus) => ({ optimal: '#2d6a4f', good: '#92400e', warning: '#991b1b' }[s]);
  const statusBdr  = (s: SensorStatus) => ({ optimal: '#bbf7d0', good: '#fde68a', warning: '#fecaca' }[s]);

  // Card tints for each section — matches the accent colour of its content
  const cardBase: React.CSSProperties = {
    border: '1px solid rgba(160,130,90,0.16)',
    borderRadius: 18,
    boxShadow: '0 2px 12px rgba(100,70,30,0.06)',
  };

  // Temperature → warm amber-cream tint
  const cardTemperature: React.CSSProperties = {
    ...cardBase,
    background: 'linear-gradient(145deg, #fffaf3 0%, #fff8ed 100%)',
    borderColor: 'rgba(249,115,22,0.18)',
  };
  // Humidity → cool aqua tint
  const cardHumidity: React.CSSProperties = {
    ...cardBase,
    background: 'linear-gradient(145deg, #f0fbff 0%, #e8f8fc 100%)',
    borderColor: 'rgba(8,145,178,0.18)',
  };
  // Moisture → soft blue tint
  const cardMoisture: React.CSSProperties = {
    ...cardBase,
    background: 'linear-gradient(145deg, #f0f6ff 0%, #eaf1ff 100%)',
    borderColor: 'rgba(37,99,235,0.18)',
  };
  // Chart card → neutral warm white with a gentle sage wash
  const cardChart: React.CSSProperties = {
    ...cardBase,
    background: 'linear-gradient(160deg, #f6fbf7 0%, #faf9f5 100%)',
    borderColor: 'rgba(45,106,79,0.14)',
  };
  // AI insights → soft lavender-sage
  const cardAI: React.CSSProperties = {
    ...cardBase,
    background: 'linear-gradient(160deg, #f5f7ff 0%, #f8f5ff 100%)',
    borderColor: 'rgba(124,58,237,0.14)',
  };
  // Soil card → earthy terracotta-cream
  const cardSoil: React.CSSProperties = {
    ...cardBase,
    background: 'linear-gradient(155deg, #fdf8f2 0%, #faf5ec 100%)',
    borderColor: 'rgba(160,100,40,0.2)',
  };
  // Tasks card → light sage green
  const cardTasks: React.CSSProperties = {
    ...cardBase,
    background: 'linear-gradient(155deg, #f3fbf5 0%, #eef8f0 100%)',
    borderColor: 'rgba(45,106,79,0.16)',
  };
  // System logs → very light slate-blue
  const cardLogs: React.CSSProperties = {
    ...cardBase,
    background: 'linear-gradient(155deg, #f6f8ff 0%, #f2f5fe 100%)',
    borderColor: 'rgba(59,130,246,0.14)',
  };
  // Stats cards — cycle through 4 tints
  const statsCards: React.CSSProperties[] = [
    { ...cardBase, background: 'linear-gradient(145deg, #f3fbf5 0%, #edf7ef 100%)', borderColor: 'rgba(45,106,79,0.18)' },   // sage
    { ...cardBase, background: 'linear-gradient(145deg, #fffaf0 0%, #fff6e3 100%)', borderColor: 'rgba(217,119,6,0.18)' },    // amber
    { ...cardBase, background: 'linear-gradient(145deg, #f8f5ff 0%, #f3eeff 100%)', borderColor: 'rgba(124,58,237,0.18)' },   // lavender
    { ...cardBase, background: 'linear-gradient(145deg, #f0fbff 0%, #e6f7fc 100%)', borderColor: 'rgba(8,145,178,0.18)' },    // teal
  ];
  // Plot cards — alternating warm tints
  const plotCardBg = (idx: number) => {
    const tints = [
      'linear-gradient(145deg, #f6fbf7 0%, #f0f8f1 100%)',
      'linear-gradient(145deg, #fdf8f2 0%, #faf3ea 100%)',
      'linear-gradient(145deg, #f5f7ff 0%, #eef1ff 100%)',
      'linear-gradient(145deg, #f0fbff 0%, #e8f7fc 100%)',
    ];
    return tints[idx % tints.length];
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f9f5ef', fontFamily: "'DM Sans', 'Segoe UI', sans-serif", color: '#1c1a15' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,300&family=Space+Grotesk:wght@400;500;600;700&display=swap');
        *{box-sizing:border-box;}
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-track{background:#f2ece0}
        ::-webkit-scrollbar-thumb{background:#d4c4a8;border-radius:2px}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes ping{75%,100%{transform:scale(1.8);opacity:0}}
        @keyframes shimmer{from{background-position:-200% 0}to{background-position:200% 0}}
        @keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
        @keyframes pls{0%,100%{opacity:1}50%{opacity:0.4}}
        .pls{animation:pls 2s infinite}
        .shimmer{background:linear-gradient(90deg,rgba(255,255,255,0) 0%,rgba(255,255,255,0.6) 50%,rgba(255,255,255,0) 100%);background-size:200% 100%;animation:shimmer 2s infinite}
        .btn-p{background:#2d6a4f;color:#fff;border:none;border-radius:100px;padding:10px 20px;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:7px;transition:all .2s;box-shadow:0 2px 10px rgba(45,106,79,0.28)}
        .btn-p:hover{background:#40916c;transform:translateY(-1px)}
        .btn-p:disabled{opacity:.5;cursor:not-allowed;transform:none}
        .btn-g{background:transparent;border:1px solid rgba(160,130,90,0.22);color:#5a5040;border-radius:100px;padding:9px 18px;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:500;cursor:pointer;display:inline-flex;align-items:center;gap:7px;transition:all .15s}
        .btn-g:hover{background:#f2ece0;border-color:rgba(160,130,90,0.4);color:#1c1a15}
        .plot-chip{display:flex;align-items:center;gap:8px;padding:7px 15px 7px 10px;border-radius:100px;font-size:13px;font-weight:500;cursor:pointer;transition:all .15s;border:1.5px solid rgba(160,130,90,0.22);background:#fff;color:#5a5040;white-space:nowrap;font-family:'DM Sans',sans-serif}
        .plot-chip.act{background:#2d6a4f;border-color:#2d6a4f;color:#fff}
        .plot-chip:not(.act):hover{border-color:#40916c;color:#2d6a4f}
        .ptrack{width:100%;height:6px;background:#ede4d3;border-radius:100px;overflow:hidden}
        .pfill{height:100%;border-radius:100px;transition:width 1.2s cubic-bezier(.34,1.56,.64,1)}
        input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:14px;height:14px;border-radius:50%;background:#2d6a4f;cursor:pointer;border:2px solid #fff;box-shadow:0 1px 4px rgba(45,106,79,0.3)}
      `}</style>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header style={{ position: 'sticky', top: 0, zIndex: 50, height: 60, background: 'rgba(249,245,239,0.9)', backdropFilter: 'blur(14px)', borderBottom: '1px solid rgba(160,130,90,0.14)', display: 'flex', alignItems: 'center', padding: '0 24px', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: '#2d6a4f', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Leaf size={16} color="#fff" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }} suppressHydrationWarning>
            <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 16, fontWeight: 600, color: '#1c1a15', letterSpacing: '-0.01em' }}>smartfarm</span>
            <span style={{ fontSize: 10.5, color: '#9a8870', fontFamily: "'DM Sans', sans-serif" }}>{isMounted ? format(currentTime, 'EEE, MMM d · HH:mm:ss') : ''}</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid rgba(160,130,90,0.2)', borderRadius: 12, padding: '8px 14px', width: 260, marginLeft: 8 }}>
          <Search size={14} color="#b0a088" />
          <input type="text" placeholder="Search plots, crops..." style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: 13, fontFamily: "'DM Sans', sans-serif", color: '#1c1a15', width: '100%' }} />
        </div>

        <div style={{ display: 'flex', gap: 8, flex: 1, overflowX: 'auto', scrollbarWidth: 'none', paddingLeft: 8 }}>
          {plots.slice(0, 3).map(p => (
            <div key={p.id} onClick={() => setActivePlotId(p.id)} className={`plot-chip${activePlotId === p.id ? ' act' : ''}`}>
              <span style={{ fontSize: 15 }}>{p.emoji}</span>{p.name}
            </div>
          ))}
          <div onClick={() => { setEditPlot(null); setShowModal(true); }}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 100, fontSize: 13, fontWeight: 500, cursor: 'pointer', border: '1.5px dashed rgba(160,130,90,0.3)', color: '#9a8870', whiteSpace: 'nowrap', flexShrink: 0, fontFamily: "'DM Sans', sans-serif" }}>
            <Plus size={13} /> Add
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 13px', borderRadius: 100, background: '#fff', border: `1px solid ${isConnected ? 'rgba(45,106,79,0.25)' : 'rgba(160,130,90,0.2)'}`, fontSize: 12, color: isConnected ? '#2d6a4f' : '#9a8870', fontWeight: 600, fontFamily: "'DM Sans', sans-serif" }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: isConnected ? '#40916c' : '#b0a088', display: 'inline-block' }} className={isConnected ? 'pls' : ''} />
            {isConnected ? `Live · ${lastSync}` : 'Offline'}
          </div>
          <button onClick={() => window.location.reload()} style={{ background: '#fff', border: '1px solid rgba(160,130,90,0.2)', borderRadius: 10, width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#9a8870' }}>
            <RefreshCw size={14} />
          </button>
          <button onClick={() => router.push('/notifications')} style={{ position: 'relative', background: '#fff', border: '1px solid rgba(160,130,90,0.2)', borderRadius: 10, width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#9a8870' }}>
            <Bell size={14} />
            <span style={{ position: 'absolute', top: 6, right: 6, width: 8, height: 8, borderRadius: '50%', background: '#ef4444', border: '2px solid #f9f5ef' }} />
          </button>
          <button onClick={() => router.push('/my_account')} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 4px 4px 10px', borderLeft: '1px solid rgba(160,130,90,0.14)', background: 'transparent', border: 'none', cursor: 'pointer', marginLeft: 4 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#2d6a4f', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', overflow: 'hidden', flexShrink: 0, fontFamily: "'Space Grotesk', sans-serif" }}>
              {currentUser?.photoURL ? <img src={currentUser.photoURL} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials(currentUser)}
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#1c1a15', whiteSpace: 'nowrap', fontFamily: "'DM Sans', sans-serif" }}>{currentUser?.displayName?.split(' ')[0] ?? currentUser?.email ?? 'Account'}</span>
          </button>
        </div>
      </header>

      {/* ── Main Content ───────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 1520, margin: '0 auto', padding: '28px 24px 60px' }}>

        {/* ── SECTION 0: HERO BANNER ─────────────────────────────────────── */}
        <div style={{ background: 'linear-gradient(135deg, #e8f5eb 0%, #f3fbf4 40%, #eef4ff 100%)', border: '1px solid rgba(45,106,79,0.18)', borderRadius: 18, boxShadow: '0 2px 16px rgba(45,106,79,0.08)', padding: '28px 32px', marginBottom: 22 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
              <div style={{ flex: 1, minWidth: 260 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 11px', borderRadius: 100, fontSize: 11, fontWeight: 700, background: '#d8f3dc', color: '#2d6a4f', border: '1px solid #b7e4c7', fontFamily: "'DM Sans', sans-serif" }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#40916c', display: 'inline-block' }} className="pls" />
                    LIVE MONITORING
                  </span>
                  <span style={{ fontSize: 11.5, color: '#9a8870', fontFamily: "'DM Sans', sans-serif" }}>Last sync: {lastSync}</span>
                </div>
                <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 34, fontWeight: 700, color: '#1c1a15', letterSpacing: '-0.02em', lineHeight: 1.1, marginBottom: 6 }}>
                  {plot?.emoji} {plot?.name}
                  <span style={{ color: '#2d6a4f' }}> · {plot?.cropType}</span>
                </h1>
                <p style={{ fontSize: 14, color: '#9a8870', fontFamily: "'DM Sans', sans-serif" }}>
                  {plot?.variety} &nbsp;·&nbsp; {plot?.area} &nbsp;·&nbsp; Planted {plot?.plantedDate || 'N/A'} &nbsp;·&nbsp;
                  <span style={{ fontWeight: 600, color: plot?.status === 'growing' ? '#2d6a4f' : plot?.status === 'dormant' ? '#92400e' : '#9a8870' }}>
                    {plot?.status === 'growing' ? '🌱 Growing' : plot?.status === 'dormant' ? '💤 Dormant' : '✅ Harvested'}
                  </span>
                </p>
                {plot?.plantedDate && plot?.harvestDate && (
                  <div style={{ marginTop: 16, maxWidth: 440 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#9a8870', marginBottom: 6, fontFamily: "'DM Sans', sans-serif" }}>
                      <span>Growth Progress</span>
                      <span style={{ color: '#2d6a4f', fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif" }}>{growth}%</span>
                    </div>
                    <div className="ptrack">
                      <div className="pfill shimmer" style={{ width: `${growth}%`, background: 'linear-gradient(90deg, #2d6a4f, #52b788)' }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#b0a088', marginTop: 5, fontFamily: "'DM Sans', sans-serif" }}>
                      <span>{plot.plantedDate}</span>
                      {remaining !== null && <span style={{ color: '#2d6a4f', fontWeight: 600 }}>{remaining} days to harvest</span>}
                      <span>{plot.harvestDate}</span>
                    </div>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center' }}>
                <HealthGauge value={healthScore} color="#40916c" label="Farm Health" />
                <HealthGauge value={growth} color="#3b82f6" label="Growth" />
                <HealthGauge value={Math.round(sensorData.moisture)} color="#0891b2" label="Moisture" />
                <HealthGauge value={Math.min(100, Math.round((sensorData.nitrogen / 150) * 100))} color="#7c3aed" label="Nutrients" />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button onClick={() => { setEditPlot(plot ?? null); setShowModal(true); }} className="btn-g">
                <Edit3 size={13} /> Edit Plot
              </button>
              <button onClick={() => isPlotReady && router.push('/plant_performance?plotId=' + activePlotId)} disabled={!isPlotReady} className="btn-p">
                <BarChart3 size={14} /> View Performance
              </button>
              <button onClick={() => setShowChat(true)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 20px', borderRadius: 100, fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, cursor: 'pointer', background: '#5b21b6', color: '#fff', border: 'none', transition: 'all .2s', boxShadow: '0 2px 10px rgba(91,33,182,0.22)' }}>
                <Bot size={14} /> Ask AI
              </button>
              <button onClick={() => setShowSoilModal(true)} className="btn-g">
                <FlaskConical size={13} /> Edit Soil
              </button>
            </div>
          </div>
        </div>

        {/* ── SECTION 1: SENSOR CARDS ───────────────────────────────────── */}
        <div style={{ marginBottom: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h2 style={{ fontSize: 11.5, fontWeight: 700, color: '#9a8870', textTransform: 'uppercase', letterSpacing: '0.07em', fontFamily: "'DM Sans', sans-serif" }}>Live Sensors</h2>
            <span style={{ fontSize: 11.5, color: '#b0a088', display: 'flex', alignItems: 'center', gap: 5, fontFamily: "'DM Sans', sans-serif" }}>
              <Cpu size={12} /> ESP32-Node1 · synced {lastSync}
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
            {[
              { key: 'temperature' as const, cardStyle: cardTemperature, label: 'Temperature', sub: 'Air temp from DHT22', icon: Thermometer, value: sensorData.temperature.toFixed(1), unit: '°C', accent: '#f97316', pale: '#fff7ed', delta: dailyDelta.temperature, deltaDigits: 1 },
              { key: 'humidity'    as const, cardStyle: cardHumidity,    label: 'Air Humidity', sub: 'Relative humidity', icon: Waves, value: sensorData.humidity.toFixed(1), unit: '%', accent: '#0891b2', pale: '#ecfeff', delta: dailyDelta.humidity, deltaDigits: 0 },
              { key: 'moisture'   as const, cardStyle: cardMoisture,    label: 'Soil Moisture', sub: 'Capacitive sensor', icon: Droplets, value: sensorData.moisture.toFixed(1), unit: '%', accent: '#2563eb', pale: '#eff6ff', delta: dailyDelta.moisture, deltaDigits: 0 },
            ].map(s => {
              const st = calcStatus(parseFloat(s.value), s.key);
              const stLabel = statusLabel(parseFloat(s.value), s.key);
              const deltaUp = s.delta >= 0;
              return (
                <div key={s.key} onClick={() => setSelectedMetric(s.key)}
                  style={{ ...s.cardStyle, padding: 22, cursor: 'pointer', transition: 'all 0.2s', borderColor: selectedMetric === s.key ? s.accent : (s.cardStyle.borderColor as string), borderWidth: selectedMetric === s.key ? 2 : 1, position: 'relative', overflow: 'hidden' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 10px 32px rgba(100,70,30,0.12)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = ''; }}>
                  <div style={{ position: 'absolute', top: 0, right: 0, width: 120, height: 120, borderRadius: '50%', background: `radial-gradient(circle, ${s.accent}12 0%, transparent 70%)`, transform: 'translate(30%,-30%)', pointerEvents: 'none' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                    <div style={{ width: 42, height: 42, borderRadius: 12, background: s.pale, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${s.accent}22` }}>
                      <s.icon size={19} color={s.accent} />
                    </div>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 100, fontSize: 11.5, fontWeight: 600, background: statusBg(st), color: statusClr(st), border: `1px solid ${statusBdr(st)}`, fontFamily: "'DM Sans', sans-serif" }}>
                      {st === 'optimal' ? <Check size={10} /> : <AlertTriangle size={10} />} {stLabel}
                    </span>
                  </div>
                  <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 42, letterSpacing: '-0.02em', color: '#1c1a15', lineHeight: 1, marginBottom: 2 }}>
                    {s.value}<span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, color: '#9a8870', marginLeft: 3, fontWeight: 400 }}>{s.unit}</span>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#5a5040', marginBottom: 2, fontFamily: "'DM Sans', sans-serif" }}>{s.label}</div>
                  <div style={{ fontSize: 12, color: '#b0a088', marginBottom: 10, fontFamily: "'DM Sans', sans-serif" }}>{s.sub}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: deltaUp ? '#2d6a4f' : '#dc2626', marginBottom: 10, fontFamily: "'DM Sans', sans-serif" }}>
                    {deltaUp ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                    {formatSignedDelta(s.delta, s.deltaDigits)}{s.unit} from yesterday
                  </div>
                  <div style={{ opacity: 0.4 }}>
                    <MiniChart color={s.accent} data={miniChartData} />
                  </div>
                  {selectedMetric === s.key && <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: s.accent, borderRadius: '0 0 18px 18px' }} />}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── SECTION 2: CHART + AI INSIGHTS ─────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 16, marginBottom: 22 }}>
          {/* Analytics Chart */}
          <div style={{ ...cardChart, padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
              <div>
                <h3 style={{ fontWeight: 700, fontSize: 15, color: '#1c1a15', fontFamily: "'Space Grotesk', sans-serif" }}>Environmental Trends</h3>
                <p style={{ fontSize: 12, color: '#9a8870', marginTop: 2, fontFamily: "'DM Sans', sans-serif" }}>Historical sensor data from {plot?.name}</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                {(['24h', '7d', '30d'] as const).map(range => (
                  <button key={range} onClick={() => setTimeRange(range)}
                    style={{ padding: '6px 14px', borderRadius: 100, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", border: `1.5px solid ${timeRange === range ? '#40916c' : 'rgba(160,130,90,0.22)'}`, background: timeRange === range ? '#f0faf2' : 'transparent', color: timeRange === range ? '#2d6a4f' : '#5a5040', transition: 'all .15s' }}>
                    {range.toUpperCase()}
                  </button>
                ))}
                <button style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 13px', borderRadius: 100, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", border: '1px solid rgba(160,130,90,0.22)', background: 'transparent', color: '#9a8870' }}>
                  <Download size={12} /> Export
                </button>
              </div>
            </div>
            <div style={{ height: 240 }}>
              {isLoadingChart ? (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                  <RefreshCw size={16} color="#9a8870" style={{ animation: 'spin 1s linear infinite' }} />
                  <span style={{ fontSize: 13, color: '#9a8870', fontFamily: "'DM Sans', sans-serif" }}>Loading chart data...</span>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id={`grad${selectedMetric}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={chartColor} stopOpacity={0.2} />
                        <stop offset="95%" stopColor={chartColor} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(160,130,90,0.12)" vertical={false} />
                    <XAxis dataKey="time" tick={{ fill: '#b0a088', fontSize: 11, fontFamily: "'DM Sans', sans-serif" }} tickLine={false} axisLine={{ stroke: 'rgba(160,130,90,0.2)' }} />
                    <YAxis tick={{ fill: '#b0a088', fontSize: 11, fontFamily: "'DM Sans', sans-serif" }} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ background: '#fff', border: '1px solid rgba(160,130,90,0.2)', borderRadius: 12, fontFamily: "'DM Sans', sans-serif", fontSize: 12, boxShadow: '0 8px 24px rgba(100,70,30,0.12)', color: '#1c1a15' }} />
                    <Area type="monotone" dataKey={selectedMetric} name={selectedMetric.charAt(0).toUpperCase() + selectedMetric.slice(1)} stroke={chartColor} fillOpacity={1} fill={`url(#grad${selectedMetric})`} strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: chartColor, strokeWidth: 0 }} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(160,130,90,0.1)' }}>
              {[
                { key: 'temperature' as const, label: 'Temperature', icon: Thermometer, color: '#f97316' },
                { key: 'humidity' as const, label: 'Humidity', icon: Waves, color: '#0891b2' },
                { key: 'moisture' as const, label: 'Moisture', icon: Droplets, color: '#2563eb' }
              ].map(m => (
                <button key={m.key} onClick={() => setSelectedMetric(m.key)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: 100, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", border: `1.5px solid ${selectedMetric === m.key ? m.color : 'rgba(160,130,90,0.22)'}`, background: selectedMetric === m.key ? `${m.color}14` : 'transparent', color: selectedMetric === m.key ? m.color : '#5a5040', transition: 'all .15s' }}>
                  <m.icon size={13} /> {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* AI Insights — soft lavender tint */}
          <div style={{ ...cardAI, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '16px 18px', background: 'linear-gradient(135deg, #eef1ff, #f8f5ff)', borderBottom: '1px solid rgba(124,58,237,0.1)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 11, background: '#5b21b6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Bot size={16} color="#fff" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#1c1a15', fontFamily: "'Space Grotesk', sans-serif" }}>AI Insights</div>
                <div style={{ fontSize: 11, color: '#9a8870', fontFamily: "'DM Sans', sans-serif" }}>LLaMA 3.3 70B</div>
              </div>
              <span style={{ fontSize: 10.5, padding: '3px 9px', borderRadius: 100, background: '#d8f3dc', color: '#2d6a4f', fontWeight: 700, border: '1px solid #b7e4c7', fontFamily: "'DM Sans', sans-serif" }} className="pls">● LIVE</span>
            </div>
            <div style={{ flex: 1, padding: 14, display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', maxHeight: 260 }}>
              {insights.map(insight => (
                <div key={insight.id}
                  style={{ padding: '12px 14px', borderRadius: 12, borderLeft: `3px solid ${insight.priority === 'high' ? '#ef4444' : insight.priority === 'medium' ? '#f59e0b' : '#0891b2'}`, background: insight.priority === 'high' ? '#fff1f2' : insight.priority === 'medium' ? '#fffbeb' : '#f0f9ff', cursor: 'pointer', transition: 'transform 0.15s' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.transform = 'translateX(3px)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.transform = ''}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
                    {insight.priority === 'high' ? <AlertCircle size={13} color="#ef4444" /> : insight.priority === 'medium' ? <Lightbulb size={13} color="#f59e0b" /> : <TrendingUp size={13} color="#0891b2" />}
                    <strong style={{ fontSize: 12.5, fontWeight: 700, color: '#1c1a15', fontFamily: "'DM Sans', sans-serif" }}>{insight.title}</strong>
                  </div>
                  <p style={{ fontSize: 12, color: '#5a5040', lineHeight: 1.5, fontFamily: "'DM Sans', sans-serif" }}>{insight.description} {insight.recommendation}</p>
                  <span style={{ fontSize: 10.5, color: '#b0a088', marginTop: 4, display: 'block', fontFamily: "'DM Sans', sans-serif" }}>{insight.time}</span>
                </div>
              ))}
            </div>
            <div style={{ padding: '12px 14px', borderTop: '1px solid rgba(124,58,237,0.1)', display: 'flex', gap: 8, background: 'rgba(124,58,237,0.04)' }}>
              <input type="text" placeholder="Ask AI about your crops..." style={{ flex: 1, background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(124,58,237,0.18)', borderRadius: 10, padding: '9px 13px', fontSize: 12.5, fontFamily: "'DM Sans', sans-serif", color: '#1c1a15', outline: 'none' }}
                onClick={() => setShowChat(true)} readOnly />
              <button onClick={() => setShowChat(true)}
                style={{ width: 36, height: 36, borderRadius: 10, background: '#5b21b6', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                <Send size={14} color="#fff" />
              </button>
            </div>
          </div>
        </div>

        {/* ── SECTION 3: SOIL METRICS + TASKS ─────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16, marginBottom: 22 }}>

          {/* Soil Quality — earthy terracotta-cream */}
          <div style={{ ...cardSoil, padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <h3 style={{ fontWeight: 700, fontSize: 15, color: '#1c1a15', fontFamily: "'Space Grotesk', sans-serif" }}>Soil Quality</h3>
                <p style={{ fontSize: 12, color: '#9a8870', marginTop: 2, fontFamily: "'DM Sans', sans-serif" }}>{plot?.name} · NPK + pH readings</p>
              </div>
              <button onClick={() => setShowSoilModal(true)} className="btn-g" style={{ fontSize: 12, padding: '7px 14px' }}>
                <Edit3 size={12} /> Edit
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
                <div key={row.key} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 0', borderBottom: '1px solid rgba(160,130,90,0.1)' }}>
                  <div style={{ width: 38, height: 38, borderRadius: 11, background: `${row.accent}12`, border: `1px solid ${row.accent}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <row.icon size={15} color={row.accent} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <div>
                        <span style={{ fontSize: 13.5, fontWeight: 500, color: '#1c1a15', fontFamily: "'DM Sans', sans-serif" }}>{row.label}</span>
                        <span style={{ fontSize: 12, color: '#b0a088', marginLeft: 8, fontFamily: "'DM Sans', sans-serif" }}>{row.detail}</span>
                      </div>
                      <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 16, color: '#1c1a15', flexShrink: 0 }}>
                        {row.value} <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11.5, fontWeight: 400, color: '#9a8870' }}>{row.unit}</span>
                      </span>
                    </div>
                    <div className="ptrack"><div className="pfill" style={{ width: `${row.pct}%`, background: row.accent, opacity: 0.7 }} /></div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, minWidth: 90, flexShrink: 0 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '3px 10px', borderRadius: 100, fontSize: 11, fontWeight: 700, background: statusBg(st), color: statusClr(st), border: `1px solid ${statusBdr(st)}`, fontFamily: "'DM Sans', sans-serif" }}>{stLabel}</span>
                    <span style={{ fontSize: 10.5, color: '#b0a088', fontFamily: "'DM Sans', sans-serif" }}>Ideal: {row.ideal}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Tasks — soft sage green */}
          <div style={{ ...cardTasks, padding: 22, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div>
                <h3 style={{ fontWeight: 700, fontSize: 15, color: '#1c1a15', fontFamily: "'Space Grotesk', sans-serif" }}>Farm Tasks</h3>
                <p style={{ fontSize: 12, color: '#9a8870', marginTop: 2, fontFamily: "'DM Sans', sans-serif" }}>{tasksDone.length}/{tasks.length} completed today</p>
              </div>
              <button style={{ width: 32, height: 32, borderRadius: 9, background: '#f0faf2', border: '1px solid rgba(45,106,79,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#2d6a4f' }}>
                <Plus size={14} />
              </button>
            </div>
            <div style={{ marginBottom: 14 }}>
              <div className="ptrack"><div className="pfill" style={{ width: `${(tasksDone.length / tasks.length) * 100}%`, background: 'linear-gradient(90deg, #2d6a4f, #52b788)' }} /></div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
              {tasks.map(task => (
                <div key={task.id}
                  onClick={() => setTasksDone(prev => prev.includes(task.id) ? prev.filter(x => x !== task.id) : [...prev, task.id])}
                  style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '11px 13px', borderRadius: 12, cursor: 'pointer', background: tasksDone.includes(task.id) ? 'rgba(45,106,79,0.08)' : 'rgba(255,255,255,0.7)', border: `1px solid ${tasksDone.includes(task.id) ? 'rgba(45,106,79,0.2)' : 'rgba(160,130,90,0.14)'}`, transition: 'all .15s' }}>
                  <div style={{ width: 20, height: 20, borderRadius: 6, background: tasksDone.includes(task.id) ? '#2d6a4f' : 'transparent', border: `1.5px solid ${tasksDone.includes(task.id) ? '#2d6a4f' : 'rgba(160,130,90,0.35)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1, transition: 'all .15s' }}>
                    {tasksDone.includes(task.id) && <Check size={11} color="#fff" />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 12.5, fontWeight: 500, color: tasksDone.includes(task.id) ? '#b0a088' : '#1c1a15', textDecoration: tasksDone.includes(task.id) ? 'line-through' : 'none', lineHeight: 1.4, fontFamily: "'DM Sans', sans-serif" }}>{task.title}</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5 }}>
                      <span style={{ fontSize: 10.5, color: '#b0a088', display: 'flex', alignItems: 'center', gap: 3, fontFamily: "'DM Sans', sans-serif" }}><Clock size={10} />{task.due}</span>
                      <span style={{ fontSize: 10.5, fontWeight: 700, padding: '1px 7px', borderRadius: 100, background: task.priority === 'high' ? '#fee2e2' : task.priority === 'medium' ? '#fef3c7' : '#f2ece0', color: task.priority === 'high' ? '#991b1b' : task.priority === 'medium' ? '#92400e' : '#5a5040', fontFamily: "'DM Sans', sans-serif" }}>
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
        <div style={{ marginBottom: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <h2 style={{ fontWeight: 700, fontSize: 16, color: '#1c1a15', fontFamily: "'Space Grotesk', sans-serif" }}>All Plots</h2>
              <p style={{ fontSize: 12, color: '#9a8870', marginTop: 2, fontFamily: "'DM Sans', sans-serif" }}>{plots.length} plots registered</p>
            </div>
            <button onClick={() => { setEditPlot(null); setShowModal(true); }} className="btn-p">
              <Plus size={14} /> Add Plot
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {plots.map((p, idx) => {
              const g  = p.plantedDate && p.harvestDate ? growthPct(p.plantedDate, p.harvestDate) : 0;
              const dl = p.harvestDate ? daysLeft(p.harvestDate) : null;
              return (
                <div key={p.id} onClick={() => { setActivePlotId(p.id); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  style={{ background: plotCardBg(idx), border: `${activePlotId === p.id ? 2 : 1}px solid ${activePlotId === p.id ? '#40916c' : 'rgba(160,130,90,0.2)'}`, borderRadius: 18, boxShadow: '0 2px 12px rgba(100,70,30,0.06)', padding: 20, cursor: 'pointer', transition: 'all 0.2s' }}
                  onMouseEnter={e => { if (activePlotId !== p.id) { (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 10px 32px rgba(100,70,30,0.1)'; } }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = ''; }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 28 }}>{p.emoji}</span>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14.5, color: '#1c1a15', fontFamily: "'Space Grotesk', sans-serif" }}>{p.name}</div>
                        <div style={{ fontSize: 12, color: '#9a8870', marginTop: 1, fontFamily: "'DM Sans', sans-serif" }}>{p.cropType} · {p.variety}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 100, fontSize: 11, fontWeight: 700, background: p.status === 'growing' ? '#d8f3dc' : p.status === 'dormant' ? '#fef3c7' : '#f2ece0', color: p.status === 'growing' ? '#2d6a4f' : p.status === 'dormant' ? '#92400e' : '#5a5040', fontFamily: "'DM Sans', sans-serif" }}>
                        {p.status}
                      </span>
                      <button onClick={e => { e.stopPropagation(); setEditPlot(p); setShowModal(true); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#b0a088', padding: 4, borderRadius: 6 }}><Edit3 size={12} /></button>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
                    {[{ l: 'Area', v: p.area || '—' }, { l: 'Days left', v: dl !== null ? `${dl}d` : '—' }, { l: 'Planted', v: p.plantedDate || '—' }, { l: 'Harvest', v: p.harvestDate || '—' }].map(m => (
                      <div key={m.l} style={{ background: 'rgba(255,255,255,0.55)', borderRadius: 9, padding: '8px 11px', border: '1px solid rgba(160,130,90,0.12)' }}>
                        <div style={{ fontSize: 10.5, color: '#b0a088', textTransform: 'uppercase', letterSpacing: '0.04em', fontFamily: "'DM Sans', sans-serif", fontWeight: 600 }}>{m.l}</div>
                        <div style={{ fontSize: 12.5, fontWeight: 600, color: '#1c1a15', marginTop: 2, fontFamily: "'DM Sans', sans-serif" }}>{m.v}</div>
                      </div>
                    ))}
                  </div>
                  {p.plantedDate && p.harvestDate && (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: '#9a8870', marginBottom: 5, fontFamily: "'DM Sans', sans-serif" }}>
                        <span>Growth</span><span style={{ color: '#2d6a4f', fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif" }}>{g}%</span>
                      </div>
                      <div className="ptrack"><div className="pfill" style={{ width: `${g}%`, background: 'linear-gradient(90deg, #2d6a4f, #52b788)' }} /></div>
                    </>
                  )}
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 12, padding: '3px 10px', borderRadius: 100, background: '#fff8ed', border: '1px solid #fcd34d', color: '#92400e', fontSize: 11, fontWeight: 600, fontFamily: "'DM Sans', sans-serif" }}>
                    <Database size={9} /> Firebase synced
                  </div>
                </div>
              );
            })}
            {/* Add new plot card */}
            <div onClick={() => { setEditPlot(null); setShowModal(true); }}
              style={{ borderRadius: 18, border: '2px dashed rgba(160,130,90,0.28)', minHeight: 180, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, cursor: 'pointer', transition: 'all 0.2s', background: 'transparent' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#40916c'; (e.currentTarget as HTMLElement).style.background = '#f0faf2'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = ''; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
              <div style={{ width: 44, height: 44, borderRadius: 13, background: '#f0faf2', border: '2px dashed rgba(45,106,79,0.28)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Plus size={20} color="#40916c" />
              </div>
              <div style={{ fontWeight: 600, fontSize: 14, color: '#5a5040', fontFamily: "'DM Sans', sans-serif" }}>Add New Plot</div>
              <div style={{ fontSize: 12.5, color: '#b0a088', textAlign: 'center', fontFamily: "'DM Sans', sans-serif" }}>Track a new crop or bed</div>
            </div>
          </div>
        </div>

        {/* ── SECTION 6: QUICK STATS ROW ─────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 22 }}>
          {[
            { icon: Leaf,     label: 'Total Plots',   value: `${plots.length}`, sub: 'Active monitoring', color: '#2d6a4f', pale: '#f0faf2' },
            { icon: Zap,      label: 'Sensor Nodes',  value: '4',               sub: 'ESP32 devices',     color: '#d97706', pale: '#fffbeb' },
            { icon: Target,   label: 'Health Score',  value: `${healthScore}%`, sub: 'Overall farm health', color: '#7c3aed', pale: '#faf5ff' },
            { icon: Calendar, label: 'Next Harvest',  value: remaining !== null ? `${remaining}d` : 'N/A', sub: plot?.cropType || 'No active plot', color: '#0891b2', pale: '#ecfeff' },
          ].map((stat, i) => (
            <div key={stat.label}
              style={{ ...statsCards[i], padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 14, transition: 'transform .2s' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.transform = ''}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: stat.pale, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: `1px solid ${stat.color}22` }}>
                <stat.icon size={19} color={stat.color} />
              </div>
              <div>
                <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 26, color: '#1c1a15', letterSpacing: '-0.02em', lineHeight: 1 }}>{stat.value}</div>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#5a5040', marginTop: 2, fontFamily: "'DM Sans', sans-serif" }}>{stat.label}</div>
                <div style={{ fontSize: 11, color: '#b0a088', marginTop: 1, fontFamily: "'DM Sans', sans-serif" }}>{stat.sub}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ── SECTION 7: SYSTEM LOGS — soft slate-blue tint ──────────────── */}
        <div style={{ ...cardLogs, padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <div>
              <h3 style={{ fontWeight: 700, fontSize: 15, color: '#1c1a15', fontFamily: "'Space Grotesk', sans-serif" }}>System Activity</h3>
              <p style={{ fontSize: 12, color: '#9a8870', marginTop: 2, fontFamily: "'DM Sans', sans-serif" }}>Real-time event log from all sensor nodes</p>
            </div>
            <button style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12.5, color: '#9a8870', background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
              View all <ChevronRight size={14} />
            </button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(160,130,90,0.15)' }}>
                  {['Time', 'Event', 'Sensor / Node', 'Value', 'Status'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 11, fontWeight: 700, color: '#9a8870', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: "'DM Sans', sans-serif" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id} style={{ borderBottom: '1px solid rgba(160,130,90,0.08)', transition: 'background .15s' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(59,130,246,0.04)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}>
                    <td style={{ padding: '12px', color: '#9a8870', fontSize: 12.5, fontFamily: "'DM Sans', sans-serif" }}>{log.time}</td>
                    <td style={{ padding: '12px', color: '#1c1a15', fontWeight: 500, fontFamily: "'DM Sans', sans-serif" }}>{log.event}</td>
                    <td style={{ padding: '12px', color: '#9a8870', fontSize: 12.5, fontFamily: "'DM Sans', sans-serif" }}>{log.sensor}</td>
                    <td style={{ padding: '12px', color: '#5a5040', fontSize: 12.5, fontFamily: "'DM Sans', sans-serif" }}>{log.value}</td>
                    <td style={{ padding: '12px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 11px', borderRadius: 100, fontSize: 11, fontWeight: 700, background: log.status === 'success' ? '#d8f3dc' : log.status === 'warning' ? '#fef3c7' : '#dbeafe', color: log.status === 'success' ? '#2d6a4f' : log.status === 'warning' ? '#92400e' : '#1d4ed8', border: `1px solid ${log.status === 'success' ? '#b7e4c7' : log.status === 'warning' ? '#fde68a' : '#bfdbfe'}`, fontFamily: "'DM Sans', sans-serif" }}>
                        {log.status === 'success' && <CheckCircle size={10} />}
                        {log.status === 'warning' && <AlertTriangle size={10} />}
                        {log.status === 'info' && <Info size={10} />}
                        <span className="capitalize">{log.status === 'info' ? 'Cached' : log.status}</span>
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

      {/* ── AI Chat Modal ──────────────────────────────────────────────────── */}
      {showChat && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(28,26,21,0.5)', backdropFilter: 'blur(8px)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          onClick={() => setShowChat(false)}>
          <div style={{ background: '#fff', border: '1px solid rgba(160,130,90,0.2)', borderRadius: '24px 24px 0 0', width: '100%', maxWidth: 560, boxShadow: '0 -12px 50px rgba(100,70,30,0.18)', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ padding: '16px 22px', borderBottom: '1px solid rgba(160,130,90,0.12)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 11, background: '#2d6a4f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Bot size={16} color="#fff" /></div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#1c1a15', fontFamily: "'Space Grotesk', sans-serif" }}>AI Agronomist</div>
                <div style={{ fontSize: 11, color: '#9a8870', fontFamily: "'DM Sans', sans-serif" }}>{plot?.emoji} {plot?.name} · {plot?.cropType}</div>
              </div>
              <div style={{ display: 'flex', gap: 8, fontSize: 12, color: '#5a5040', flexWrap: 'wrap' }}>
                <span style={{ background: '#f9f5ef', padding: '2px 8px', borderRadius: 100, border: '1px solid rgba(160,130,90,0.2)', fontFamily: "'DM Sans', sans-serif" }}>🌡️ {sensorData.temperature.toFixed(1)}°C</span>
                <span style={{ background: '#f9f5ef', padding: '2px 8px', borderRadius: 100, border: '1px solid rgba(160,130,90,0.2)', fontFamily: "'DM Sans', sans-serif" }}>💧 {sensorData.moisture.toFixed(0)}%</span>
                <span style={{ background: '#f9f5ef', padding: '2px 8px', borderRadius: 100, border: '1px solid rgba(160,130,90,0.2)', fontFamily: "'DM Sans', sans-serif" }}>pH {sensorData.ph}</span>
              </div>
              <button onClick={() => setShowChat(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#b0a088', padding: 6, marginLeft: 4 }}><X size={16} /></button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 14, maxHeight: 380 }}>
              {messages.map(msg => (
                <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, flexDirection: msg.role === 'user' ? 'row-reverse' : 'row' }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: msg.role === 'ai' ? '#2d6a4f' : '#f2ece0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {msg.role === 'ai' ? <Bot size={13} color="#fff" /> : <User size={13} color="#5a5040" />}
                    </div>
                    <div style={{ padding: '11px 15px', borderRadius: msg.role === 'ai' ? '16px 16px 16px 4px' : '16px 16px 4px 16px', background: msg.role === 'ai' ? '#f9f5ef' : '#2d6a4f', border: msg.role === 'ai' ? '1px solid rgba(160,130,90,0.14)' : 'none', color: msg.role === 'ai' ? '#1c1a15' : '#fff', fontSize: 13.5, lineHeight: 1.6, maxWidth: '82%', fontFamily: "'DM Sans', sans-serif" }}>
                      {msg.content}
                    </div>
                  </div>
                </div>
              ))}
              {isAITyping && (
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#2d6a4f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Bot size={13} color="#fff" /></div>
                  <div style={{ padding: '12px 16px', borderRadius: '16px 16px 16px 4px', background: '#f9f5ef', border: '1px solid rgba(160,130,90,0.14)', display: 'flex', gap: 5 }}>
                    {[0, 1, 2].map(i => <span key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: '#40916c', display: 'inline-block', animation: `bounce .9s ${i * 0.15}s ease-in-out infinite` }} />)}
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
            <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(160,130,90,0.1)', display: 'flex', gap: 8 }}>
              <input value={inputMessage} onChange={e => setInputMessage(e.target.value)} onKeyPress={e => e.key === 'Enter' && handleSendMessage()}
                placeholder="Ask anything about your farm…" disabled={isAITyping}
                style={{ flex: 1, background: '#f9f5ef', border: '1px solid rgba(160,130,90,0.2)', borderRadius: 11, padding: '11px 14px', fontSize: 14, fontFamily: "'DM Sans', sans-serif", color: '#1c1a15', outline: 'none' }} />
              <button onClick={handleSendMessage} disabled={isAITyping || !inputMessage.trim()} className="btn-p" style={{ borderRadius: 11, padding: '11px 16px' }}>
                <Send size={14} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}