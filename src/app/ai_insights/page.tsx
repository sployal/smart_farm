'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bot, Send, Leaf, AlertTriangle, TrendingUp, Droplets,
  Thermometer, Waves, FlaskConical, Zap, RefreshCw, Sparkles,
  ChevronRight, Clock, AlertCircle, Info, Menu, BarChart2,
  X, Loader2, Check, Activity, Layers, Wind
} from 'lucide-react';
import { startRealtimeUpdates, fetchSensorData, auth } from '@/lib/firebase';
import { onAuthStateChanged, type User as AuthUser } from 'firebase/auth';
import { doc, onSnapshot, collection } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const AI_API_KEY = process.env.NEXT_PUBLIC_GROQ_API_KEY ?? '';
const AI_MODEL   = 'llama-3.3-70b-versatile';

// ══════════════════════════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════════════════════════

type SensorData = {
  moisture: number; temperature: number; humidity: number;
  ph: number; nitrogen: number; phosphorus: number; potassium: number;
};

type Plot = {
  id: string; name: string; cropType: string; variety: string;
  area: string; plantedDate: string; harvestDate: string;
  status: 'growing' | 'dormant' | 'harvested'; emoji: string;
};

type Priority = 'critical' | 'high' | 'medium' | 'low';

type Insight = {
  id: string; priority: Priority; category: string;
  title: string; detail: string; action: string;
  impact: string; confidence: number; timestamp: Date;
};

type InsightCached = Omit<Insight, 'timestamp'> & { timestamp: string };

type ChatMessage = {
  id: string; role: 'user' | 'assistant';
  content: string; timestamp: Date; isStreaming?: boolean;
};

type QuickPrompt = { label: string; prompt: string; icon: React.ReactNode };

// ══════════════════════════════════════════════════════════════════════════════
// CACHE HELPERS
// ══════════════════════════════════════════════════════════════════════════════

const INSIGHTS_CACHE_PREFIX = 'farm_ai_insights_';

function loadCachedInsights(plotId: string): Insight[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(`${INSIGHTS_CACHE_PREFIX}${plotId}`);
    if (!raw) return null;
    const parsed: InsightCached[] = JSON.parse(raw);
    return parsed.map(item => ({ ...item, timestamp: new Date(item.timestamp) }));
  } catch { return null; }
}

function saveCachedInsights(plotId: string, insights: Insight[]): void {
  if (typeof window === 'undefined') return;
  try {
    const serialisable: InsightCached[] = insights.map(item => ({
      ...item, timestamp: item.timestamp.toISOString()
    }));
    localStorage.setItem(`${INSIGHTS_CACHE_PREFIX}${plotId}`, JSON.stringify(serialisable));
  } catch {}
}

// ══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════════════════════

function cn(...classes: (string | undefined | false | null)[]) {
  return classes.filter(Boolean).join(' ');
}

function formatTime(date: Date) {
  return date.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' });
}

// ══════════════════════════════════════════════════════════════════════════════
// AI API
// ══════════════════════════════════════════════════════════════════════════════

async function callAI(prompt: string, systemContext: string): Promise<string> {
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
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `AI API error ${res.status}`);
  }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content ?? 'No response received.';
}

async function generateInsights(sensor: SensorData, plot: Plot | undefined): Promise<Insight[]> {
  const cropLabel = plot
    ? `${plot.cropType}${plot.variety ? ` (${plot.variety})` : ''} farm in Kenya — Plot: ${plot.name}`
    : 'farm in Kenya';

  const prompt = `
You are an expert agronomist AI. Given the following real-time sensor readings from a ${cropLabel}, return a JSON array of exactly 4 insights.

SENSOR DATA:
- Temperature: ${sensor.temperature}°C
- Humidity: ${sensor.humidity}%
- Soil Moisture: ${sensor.moisture}%
- Soil pH: ${sensor.ph}
- Nitrogen (N): ${sensor.nitrogen} mg/kg
- Phosphorus (P): ${sensor.phosphorus} mg/kg
- Potassium (K): ${sensor.potassium} mg/kg

IMPORTANT RULES:
1. The FIRST insight MUST be about Temperature.
2. The SECOND insight MUST be about Humidity.
3. The THIRD insight MUST be about Soil Moisture.
4. The FOURTH should cover whichever of pH, Nutrition, Disease Risk, or Harvest is most urgent.
5. Each insight must directly reference the actual sensor value in the detail field.
6. All recommendations must be specific to ${plot?.cropType ?? 'the crop'} cultivation.

Return ONLY valid JSON (no markdown fences) in this exact format:
[
  {
    "id": "1",
    "priority": "critical|high|medium|low",
    "category": "Temperature|Humidity|Irrigation|Nutrition|pH|Disease Risk|Harvest|Climate",
    "title": "Short title referencing the actual value",
    "detail": "2-sentence description referencing the exact sensor reading and what it means for the crops",
    "action": "Specific actionable recommendation",
    "impact": "Expected outcome if action is taken",
    "confidence": 88
  }
]
`;

  const raw = await callAI(prompt, '');
  try {
    const cleaned = raw.replace(/```json|```/g, '').trim();
    const arr = JSON.parse(cleaned);
    return arr.map((item: Insight, i: number) => ({ ...item, id: String(i + 1), timestamp: new Date() }));
  } catch (error) {
    console.error('Failed to parse insights:', error);
    return [];
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// PRIORITY CONFIG — dashboard-consistent colors
// ══════════════════════════════════════════════════════════════════════════════

const priorityConfig: Record<Priority, {
  color: string; bg: string; border: string; badge: string; dot: string; accentColor: string;
}> = {
  critical: {
    color: 'text-red-400', bg: 'rgba(239,68,68,0.06)', border: 'rgba(239,68,68,0.3)',
    badge: 'bg-red-500/10 text-red-400 border border-red-500/20', dot: '#ef4444', accentColor: '#ef4444'
  },
  high: {
    color: 'text-amber-400', bg: 'rgba(245,158,11,0.06)', border: 'rgba(245,158,11,0.3)',
    badge: 'bg-amber-500/10 text-amber-400 border border-amber-500/20', dot: '#f59e0b', accentColor: '#f59e0b'
  },
  medium: {
    color: 'text-sky-400', bg: 'rgba(14,165,233,0.06)', border: 'rgba(14,165,233,0.3)',
    badge: 'bg-sky-500/10 text-sky-400 border border-sky-500/20', dot: '#0ea5e9', accentColor: '#0ea5e9'
  },
  low: {
    color: 'text-emerald-400', bg: 'rgba(16,185,129,0.06)', border: 'rgba(16,185,129,0.3)',
    badge: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20', dot: '#10b981', accentColor: '#10b981'
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// INSIGHT CARD
// ══════════════════════════════════════════════════════════════════════════════

function InsightCard({ insight, index }: { insight: Insight; index: number }) {
  const [expanded, setExpanded] = useState(true);
  const cfg = priorityConfig[insight.priority];

  const categoryIcon: Record<string, React.ReactNode> = {
    Temperature:    <Thermometer className="w-3.5 h-3.5" />,
    Humidity:       <Waves className="w-3.5 h-3.5" />,
    Irrigation:     <Droplets className="w-3.5 h-3.5" />,
    Nutrition:      <FlaskConical className="w-3.5 h-3.5" />,
    pH:             <FlaskConical className="w-3.5 h-3.5" />,
    'Disease Risk': <AlertCircle className="w-3.5 h-3.5" />,
    Harvest:        <Leaf className="w-3.5 h-3.5" />,
    Climate:        <Thermometer className="w-3.5 h-3.5" />,
  };

  return (
    <div
      className="rounded-2xl transition-all duration-300 overflow-hidden cursor-pointer hover:-translate-y-0.5"
      style={{
        background: 'rgba(30,41,59,0.6)',
        border: `1px solid ${expanded ? cfg.border : 'rgba(71,85,105,0.35)'}`,
        backdropFilter: 'blur(12px)',
        borderLeft: `3px solid ${cfg.accentColor}`,
        boxShadow: expanded ? `0 0 30px ${cfg.accentColor}08` : 'none',
      }}
      onClick={() => setExpanded(!expanded)}
    >
      {/* Header */}
      <div className="flex items-start gap-3 p-4">
        {/* Priority dot */}
        <div className="mt-1.5 flex-shrink-0">
          <span className="block w-2 h-2 rounded-full animate-pulse" style={{ background: cfg.accentColor }} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span className={cn('inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full capitalize', cfg.badge)}>
              {insight.priority}
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(15,24,36,0.6)', border: '1px solid rgba(71,85,105,0.3)' }}>
              {categoryIcon[insight.category] ?? <Info className="w-3 h-3" />}
              <span className="ml-0.5">{insight.category}</span>
            </span>
            <span className="ml-auto text-[10px] text-slate-500 flex items-center gap-1 flex-shrink-0">
              <Clock className="w-3 h-3" />
              {formatTime(insight.timestamp)}
            </span>
          </div>
          <p className="text-sm font-semibold text-slate-100 leading-snug section-title">{insight.title}</p>
        </div>

        <ChevronRight className={cn(
          'w-4 h-4 text-slate-500 flex-shrink-0 transition-transform duration-200 mt-0.5',
          expanded && 'rotate-90'
        )} />
      </div>

      {/* Expanded body */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3" style={{ borderTop: '1px solid rgba(71,85,105,0.2)' }}>
          <p className="text-sm text-slate-300 leading-relaxed pt-3">{insight.detail}</p>

          <div className="rounded-xl p-3 border"
            style={{ background: 'rgba(15,24,36,0.6)', borderColor: 'rgba(71,85,105,0.25)' }}>
            <p className="text-[10px] font-semibold text-emerald-400 uppercase tracking-widest mb-1.5 flex items-center gap-1">
              <Zap className="w-3 h-3" /> Recommended Action
            </p>
            <p className="text-sm text-slate-200">{insight.action}</p>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-1.5 min-w-0">
              <TrendingUp className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
              <span className="text-xs text-slate-400 truncate">{insight.impact}</span>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span className="text-[10px] text-slate-500">Confidence</span>
              <div className="w-20 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(30,41,59,0.8)' }}>
                <div className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${insight.confidence}%`, backgroundColor: cfg.accentColor }} />
              </div>
              <span className="text-[11px] font-semibold text-slate-300 stat-number">{insight.confidence}%</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════

export default function AIInsightsPage() {
  const router = useRouter();

  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [plots, setPlots] = useState<Plot[]>([]);
  const [activePlotId, setActivePlotId] = useState('plot-a');

  const [sensor, setSensor] = useState<SensorData>({
    moisture: 0, temperature: 0, humidity: 0,
    ph: 6.5, nitrogen: 45, phosphorus: 32, potassium: 180
  });

  const [dataLoaded, setDataLoaded] = useState(false);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsSource, setInsightsSource] = useState<'cache' | 'fresh' | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([{
    id: '0', role: 'assistant',
    content: "Hello! I'm your AI farm assistant. I have live access to your sensor data. Ask me anything — irrigation schedules, nutrient deficiencies, pest risks, harvest timing, or just chat about your crops! 🌱",
    timestamp: new Date()
  }]);
  const [input, setInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const autoLoadedRef = useRef(false);
  const [activeTab, setActiveTab] = useState<'insights' | 'chat'>('chat');

  const plot = plots.find(p => p.id === activePlotId) ?? plots[0];

  // ── Firebase ────────────────────────────────────────────────────────────────
  useEffect(() => onAuthStateChanged(auth, setCurrentUser), []);

  useEffect(() => {
    return onSnapshot(collection(db, 'plots'), snap => {
      if (!snap.empty) {
        const plotData = snap.docs.map(d => d.data() as Plot);
        setPlots(plotData);
        if (plotData.length > 0 && !activePlotId) setActivePlotId(plotData[0].id);
      }
    });
  }, []);

  useEffect(() => {
    if (!activePlotId) return;
    return onSnapshot(doc(db, 'plots', activePlotId, 'soil_metrics', 'current'), snap => {
      if (snap.exists()) {
        const d = snap.data();
        setSensor(prev => ({
          ...prev,
          ph: d.ph ?? prev.ph, nitrogen: d.nitrogen ?? prev.nitrogen,
          phosphorus: d.phosphorus ?? prev.phosphorus, potassium: d.potassium ?? prev.potassium,
        }));
      }
    });
  }, [activePlotId]);

  useEffect(() => {
    fetchSensorData().then((data: Partial<SensorData>) => {
      setSensor(prev => ({
        ...prev,
        temperature: parseFloat(String(data.temperature ?? prev.temperature)),
        humidity:    parseFloat(String(data.humidity    ?? prev.humidity)),
        moisture:    parseFloat(String(data.moisture    ?? prev.moisture)),
      }));
      setDataLoaded(true);
    }).catch(err => console.error(err));

    const unsubscribe = startRealtimeUpdates((data: Partial<SensorData>) => {
      setSensor(prev => ({
        ...prev,
        temperature: parseFloat(String(data.temperature ?? prev.temperature)),
        humidity:    parseFloat(String(data.humidity    ?? prev.humidity)),
        moisture:    parseFloat(String(data.moisture    ?? prev.moisture)),
      }));
      setDataLoaded(true);
    });
    return () => unsubscribe();
  }, []);

  // ── Insight generation ──────────────────────────────────────────────────────
  const handleGenerateInsights = useCallback(async (force = false) => {
    if (!dataLoaded) return;
    const plotId = plot?.id ?? activePlotId;
    if (!force) {
      const cached = loadCachedInsights(plotId);
      if (cached && cached.length > 0) {
        setInsights(cached);
        setInsightsSource('cache');
        setLastRefreshed(cached[0].timestamp);
        return;
      }
    }
    setInsightsLoading(true);
    try {
      const result = await generateInsights(sensor, plot);
      if (result.length > 0) {
        saveCachedInsights(plotId, result);
        setInsights(result);
        setLastRefreshed(new Date());
        setInsightsSource('fresh');
      }
    } catch (error) {
      console.error('Error generating insights:', error);
    } finally {
      setInsightsLoading(false);
    }
  }, [sensor, dataLoaded, plot, activePlotId]);

  useEffect(() => {
    if (dataLoaded && !autoLoadedRef.current) {
      autoLoadedRef.current = true;
      handleGenerateInsights(false);
    }
  }, [dataLoaded]); // eslint-disable-line

  // ── Chat ────────────────────────────────────────────────────────────────────
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const systemContext = `
You are an expert AI agronomist assistant for a smart farm in Kenya.
Active plot: ${plot?.name ?? 'N/A'} — ${plot?.cropType ?? 'N/A'} (${plot?.variety ?? 'N/A'}).
Sensor readings: Soil Moisture ${sensor.moisture}%, Temperature ${sensor.temperature}°C, Humidity ${sensor.humidity}%, pH ${sensor.ph}, N ${sensor.nitrogen} mg/kg, P ${sensor.phosphorus} mg/kg, K ${sensor.potassium} mg/kg.
Give concise, actionable advice specific to ${plot?.cropType ?? 'the crop'}. Be friendly and professional.
  `.trim();

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || chatLoading) return;
    setInput('');
    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: text, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setChatLoading(true);
    try {
      const reply = await callAI(text, systemContext);
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', content: reply, timestamp: new Date() }]);
    } catch (err) {
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', content: `❌ Error: ${(err as Error).message}`, timestamp: new Date() }]);
    } finally { setChatLoading(false); }
  }, [input, chatLoading, systemContext]);

  const quickPrompts: QuickPrompt[] = [
    { label: 'Irrigation advice',  prompt: 'Based on current moisture and weather, should I irrigate today?',  icon: <Droplets className="w-3.5 h-3.5" /> },
    { label: 'Nutrient plan',      prompt: 'Create a fertiliser plan based on my soil nutrient levels.',        icon: <FlaskConical className="w-3.5 h-3.5" /> },
    { label: 'Harvest forecast',   prompt: 'When should I expect to harvest based on current conditions?',      icon: <Leaf className="w-3.5 h-3.5" /> },
    { label: 'Disease risk',       prompt: 'Is there a risk of fungal disease given the current humidity?',     icon: <AlertCircle className="w-3.5 h-3.5" /> },
  ];

  const countByPriority = (p: Priority) => insights.filter(i => i.priority === p).length;

  const timestampLabel = insightsSource === 'cache' && lastRefreshed
    ? `Cached · ${formatTime(lastRefreshed)}`
    : insightsSource === 'fresh' && lastRefreshed
      ? `Refreshed ${formatTime(lastRefreshed)}`
      : null;

  // ══════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════════

  return (
    <div className="text-slate-100 min-h-screen" style={{ background: '#0f1824', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&family=Space+Grotesk:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: #1e293b; }
        ::-webkit-scrollbar-thumb { background: #334155; border-radius: 2px; }
        .card { background: rgba(30,41,59,0.6); border: 1px solid rgba(71,85,105,0.35); backdrop-filter: blur(12px); }
        .card-glow-green:hover { box-shadow: 0 0 40px rgba(16,185,129,0.08); border-color: rgba(16,185,129,0.2); }
        .shimmer { background: linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.03) 50%, rgba(255,255,255,0) 100%); background-size: 200% 100%; animation: shimmer 2s infinite; }
        @keyframes shimmer { from { background-position: -200% 0; } to { background-position: 200% 0; } }
        .stat-number { font-family: 'Space Grotesk', monospace; }
        .section-title { font-family: 'Space Grotesk', sans-serif; }
      `}</style>

      {/* Ambient blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.04) 0%, transparent 70%)' }} />
        <div className="absolute top-1/2 -left-40 w-[400px] h-[400px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.03) 0%, transparent 70%)' }} />
        <div className="absolute -bottom-40 right-1/3 w-[500px] h-[500px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(168,85,247,0.02) 0%, transparent 70%)' }} />
      </div>

      {/* ── Header ── */}
      <header className="relative z-40 sticky top-0 h-auto border-b"
        style={{ background: 'rgba(15,24,36,0.85)', backdropFilter: 'blur(20px)', borderColor: 'rgba(71,85,105,0.3)' }}>

        {/* Top row */}
        <div className="flex items-center justify-between px-4 md:px-6 h-16 gap-4">
          <button onClick={() => document.dispatchEvent(new CustomEvent('toggleMobileMenu'))}
            className="lg:hidden p-2 rounded-lg hover:bg-slate-800 text-slate-400 transition-colors">
            <Menu className="w-5 h-5" />
          </button>

          {/* Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #059669, #0891b2)', boxShadow: '0 4px 12px rgba(5,150,105,0.25)' }}>
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="section-title text-base font-bold text-slate-100 leading-none">AI Insights</h1>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {plot ? `${plot.emoji} ${plot.name} — ${plot.cropType} (${plot.variety})` : 'AI-powered · Real-time farm analysis'}
              </p>
            </div>
          </div>

          {/* Sensor pills + refresh */}
          <div className="flex items-center gap-2 flex-wrap ml-auto">
            {[
              { icon: <Thermometer className="w-3 h-3" />, label: 'Temp', value: sensor.temperature.toFixed(1), unit: '°C',
                status: sensor.temperature > 35 ? 'alert' : sensor.temperature > 30 ? 'warn' : 'ok' },
              { icon: <Droplets className="w-3 h-3" />, label: 'Moisture', value: sensor.moisture.toFixed(0), unit: '%',
                status: sensor.moisture < 30 ? 'alert' : sensor.moisture < 40 ? 'warn' : 'ok' },
              { icon: <Waves className="w-3 h-3" />, label: 'Humidity', value: sensor.humidity.toFixed(0), unit: '%',
                status: sensor.humidity > 85 ? 'warn' : 'ok' },
            ].map(s => {
              const colors = {
                ok:    { bg: 'rgba(16,185,129,0.08)',  border: 'rgba(16,185,129,0.2)',  text: '#10b981' },
                warn:  { bg: 'rgba(245,158,11,0.08)',  border: 'rgba(245,158,11,0.2)',  text: '#f59e0b' },
                alert: { bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.2)',   text: '#ef4444' },
              }[s.status] || { bg: 'rgba(16,185,129,0.08)',  border: 'rgba(16,185,129,0.2)',  text: '#10b981' };
              return (
                <div key={s.label} className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium border"
                  style={{ background: colors.bg, borderColor: colors.border, color: colors.text }}>
                  <span className="opacity-80">{s.icon}</span>
                  <span className="text-slate-400">{s.label}</span>
                  <span className="stat-number font-bold">{s.value}<span className="font-normal opacity-70 ml-0.5">{s.unit}</span></span>
                </div>
              );
            })}

            {/* Connection dot */}
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-[11px] font-semibold"
              style={{ background: 'rgba(16,185,129,0.08)', borderColor: 'rgba(16,185,129,0.2)', color: '#10b981' }}>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-emerald-400" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
              </span>
              <span className="hidden sm:inline">Live</span>
            </div>

            <button onClick={() => handleGenerateInsights(true)}
              disabled={insightsLoading || !dataLoaded}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold transition-all active:scale-95">
              {insightsLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              Refresh
            </button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="px-4 md:px-6 pb-3">
          <div className="flex gap-1 p-1 rounded-xl w-fit"
            style={{ background: 'rgba(15,24,36,0.6)', border: '1px solid rgba(71,85,105,0.3)' }}>
            {(['chat', 'insights'] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all section-title"
                style={activeTab === tab
                  ? { background: 'rgba(30,41,59,0.9)', color: '#f1f5f9', boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }
                  : { color: '#64748b' }}>
                {tab === 'insights'
                  ? <><BarChart2 className="w-4 h-4" /> Insights {insights.length > 0 && <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-emerald-500/15 text-emerald-400">{insights.length}</span>}</>
                  : <><Bot className="w-4 h-4" /> Ask AI</>}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* ── Main Content ── */}
      <div className="relative z-10 p-4 md:p-6 max-w-[1400px] mx-auto space-y-5">

        {/* ── INSIGHTS TAB ── */}
        {activeTab === 'insights' && (
          <>
            {/* Priority summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {(['critical', 'high', 'medium', 'low'] as Priority[]).map(p => {
                const cfg = priorityConfig[p];
                const count = countByPriority(p);
                return (
                  <div key={p} className="card card-glow-green rounded-2xl p-4 flex items-center gap-3 transition-all"
                    style={{ borderLeft: `3px solid ${cfg.accentColor}` }}>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}>
                      <span className="stat-number text-xl font-black" style={{ color: cfg.accentColor }}>{count}</span>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider section-title" style={{ color: cfg.accentColor }}>{p}</p>
                      <p className="text-[11px] text-slate-500">alerts</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Status bar */}
            <div className="card rounded-xl px-4 py-2.5 flex items-center justify-between text-xs text-slate-500">
              <span className="flex items-center gap-2">
                <span className={cn('w-2 h-2 rounded-full', dataLoaded ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500')} />
                {dataLoaded
                  ? (plot ? `Live Data · ${plot.emoji} ${plot.name} – ${plot.cropType}` : 'Live Data · No plot selected')
                  : 'Loading sensor data…'}
              </span>
              {timestampLabel && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {timestampLabel}
                </span>
              )}
            </div>

            {/* Loading / empty states */}
            {insightsLoading && insights.length === 0 ? (
              <div className="card rounded-2xl flex flex-col items-center justify-center py-20 gap-4">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                  style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
                  <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
                </div>
                <p className="text-slate-400 text-sm">Analysing your sensor data…</p>
              </div>
            ) : !dataLoaded ? (
              <div className="card rounded-2xl flex flex-col items-center justify-center py-20 gap-3 text-center">
                <Loader2 className="w-10 h-10 text-slate-600 animate-spin" />
                <p className="text-slate-400">Loading live sensor data…</p>
              </div>
            ) : insights.length === 0 ? (
              <div className="card rounded-2xl flex flex-col items-center justify-center py-20 gap-3 text-center">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                  style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)' }}>
                  <Sparkles className="w-6 h-6 text-slate-600" />
                </div>
                <p className="text-slate-400 text-sm">No insights yet — click <strong className="text-emerald-400">Refresh</strong> to analyse.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {insights.map((insight, i) => (
                  <InsightCard key={insight.id} insight={insight} index={i} />
                ))}
              </div>
            )}

            {/* Soil snapshot */}
            <div className="card rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="section-title font-semibold text-slate-100">Soil Snapshot</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Live readings from all sensors</p>
                </div>
                <span className="flex items-center gap-1.5 text-[11px] text-slate-500 px-2.5 py-1 rounded-full border"
                  style={{ background: 'rgba(15,24,36,0.6)', borderColor: 'rgba(71,85,105,0.3)' }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Real-time
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {[
                  { label: 'Moisture',    val: sensor.moisture,    unit: '%',     color: '#3b82f6',  max: 100, icon: <Droplets className="w-3.5 h-3.5" /> },
                  { label: 'Temperature', val: sensor.temperature, unit: '°C',    color: '#f59e0b',  max: 50,  icon: <Thermometer className="w-3.5 h-3.5" /> },
                  { label: 'Humidity',    val: sensor.humidity,    unit: '%',     color: '#06b6d4',  max: 100, icon: <Waves className="w-3.5 h-3.5" /> },
                  { label: 'pH',          val: sensor.ph,          unit: '',      color: '#a78bfa',  max: 14,  icon: <FlaskConical className="w-3.5 h-3.5" /> },
                  { label: 'Nitrogen',    val: sensor.nitrogen,    unit: 'mg/kg', color: '#f87171',  max: 200, icon: <Activity className="w-3.5 h-3.5" /> },
                  { label: 'Phosphorus',  val: sensor.phosphorus,  unit: 'mg/kg', color: '#fb923c',  max: 100, icon: <Layers className="w-3.5 h-3.5" /> },
                  { label: 'Potassium',   val: sensor.potassium,   unit: 'mg/kg', color: '#34d399',  max: 300, icon: <Wind className="w-3.5 h-3.5" /> },
                ].map(m => (
                  <div key={m.label} className="rounded-xl p-3 transition-all hover:-translate-y-0.5"
                    style={{ background: 'rgba(15,24,36,0.6)', border: '1px solid rgba(71,85,105,0.25)' }}>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span style={{ color: m.color }}>{m.icon}</span>
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">{m.label}</p>
                    </div>
                    <p className="stat-number text-lg font-bold text-slate-100">
                      {typeof m.val === 'number' && m.unit === '' ? m.val.toFixed(1) : Math.round(Number(m.val))}
                      <span className="text-xs font-normal text-slate-400 ml-1">{m.unit}</span>
                    </p>
                    <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(30,41,59,0.8)' }}>
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${Math.min((Number(m.val) / m.max) * 100, 100)}%`, backgroundColor: m.color, boxShadow: `0 0 6px ${m.color}40` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ── CHAT TAB ── */}
        {activeTab === 'chat' && (
          <div className="flex flex-col" style={{ height: 'calc(100vh - 200px)', minHeight: '500px' }}>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto space-y-4 pb-4 pr-1">
              {messages.map(msg => (
                <div key={msg.id} className={cn('flex gap-3', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                  {msg.role === 'assistant' && (
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-1 shadow-lg shadow-emerald-500/20"
                      style={{ background: 'linear-gradient(135deg, #059669, #0891b2)' }}>
                      <Bot className="w-4 h-4 text-white" />
                    </div>
                  )}

                  <div className={cn(
                    'max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed',
                    msg.role === 'user' ? 'text-white rounded-tr-sm' : 'text-slate-200 rounded-tl-sm card'
                  )}
                  style={msg.role === 'user'
                    ? { background: 'linear-gradient(135deg, #059669, #0891b2)' }
                    : {}}>
                    {msg.content.split('\n').map((line, i, arr) => (
                      <span key={i}>{line}{i < arr.length - 1 && <br />}</span>
                    ))}
                    <p className={cn('text-[10px] mt-1.5', msg.role === 'user' ? 'text-emerald-100/70' : 'text-slate-500')}>
                      {formatTime(msg.timestamp)}
                    </p>
                  </div>

                  {msg.role === 'user' && (
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-1 text-xs font-bold text-slate-300 section-title"
                      style={{ background: 'rgba(30,41,59,0.8)', border: '1px solid rgba(71,85,105,0.35)' }}>
                      Me
                    </div>
                  )}
                </div>
              ))}

              {chatLoading && (
                <div className="flex gap-3 items-center">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-emerald-500/20"
                    style={{ background: 'linear-gradient(135deg, #059669, #0891b2)' }}>
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                  <div className="card rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
                    <div className="flex gap-1">
                      {[0, 150, 300].map(d => (
                        <span key={d} className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"
                          style={{ animationDelay: `${d}ms` }} />
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input area */}
            <div className="mt-auto space-y-3">
              {/* Quick prompts */}
              <div className="flex gap-2 flex-wrap">
                {quickPrompts.map(qp => (
                  <button key={qp.label} onClick={() => setInput(qp.prompt)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all hover:-translate-y-0.5"
                    style={{ background: 'rgba(30,41,59,0.6)', border: '1px solid rgba(71,85,105,0.35)', color: '#94a3b8' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(16,185,129,0.4)'; e.currentTarget.style.color = '#6ee7b7'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(71,85,105,0.35)'; e.currentTarget.style.color = '#94a3b8'; }}>
                    {qp.icon} {qp.label}
                  </button>
                ))}
              </div>

              {/* Sensor context strip */}
              <div className="card rounded-xl px-4 py-2 flex items-center gap-3 flex-wrap text-[11px] text-slate-400">
                <span className="text-emerald-400 font-semibold section-title">{plot?.emoji} {plot?.name}</span>
                <span>🌡️ {sensor.temperature.toFixed(1)}°C</span>
                <span>💧 {sensor.moisture.toFixed(0)}%</span>
                <span>💦 {sensor.humidity.toFixed(0)}%</span>
                <span>pH {sensor.ph}</span>
                <span className="ml-auto text-slate-600">AI has access to live data</span>
              </div>

              {/* Input bar */}
              <div className="card rounded-2xl p-2 flex gap-2">
                <textarea rows={1} value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  placeholder="Ask about your crops, soil, irrigation, pests…"
                  className="flex-1 bg-transparent text-sm text-slate-200 placeholder:text-slate-600 resize-none focus:outline-none px-2 py-1.5 leading-relaxed" />
                <button onClick={handleSend} disabled={!input.trim() || chatLoading}
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white transition-all active:scale-95 disabled:opacity-40 flex-shrink-0 self-end"
                  style={{ background: 'linear-gradient(135deg, #059669, #0891b2)', boxShadow: '0 4px 12px rgba(5,150,105,0.25)' }}>
                  {chatLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}