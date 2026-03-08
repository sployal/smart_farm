'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bot, Send, Leaf, AlertTriangle, TrendingUp, Droplets,
  Thermometer, Waves, FlaskConical, Zap, RefreshCw, Sparkles,
  ChevronRight, Clock, AlertCircle, Info, Menu, BarChart2,
  X, Loader2, Check, Activity, Layers, Wind, User
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
// PRIORITY CONFIG — matching dashboard color language
// ══════════════════════════════════════════════════════════════════════════════

type PriorityCfg = {
  accentColor: string;
  bg: string;
  border: string;
  badgeBg: string;
  badgeColor: string;
  badgeBorder: string;
  dotColor: string;
  label: string;
};

const priorityConfig: Record<Priority, PriorityCfg> = {
  critical: {
    accentColor: '#ef4444',
    bg: '#fff1f2',
    border: '#fecaca',
    badgeBg: '#fee2e2',
    badgeColor: '#991b1b',
    badgeBorder: '#fecaca',
    dotColor: '#dc2626',
    label: 'Critical',
  },
  high: {
    accentColor: '#f59e0b',
    bg: '#fffbeb',
    border: '#fde68a',
    badgeBg: '#fef3c7',
    badgeColor: '#92400e',
    badgeBorder: '#fde68a',
    dotColor: '#d97706',
    label: 'High',
  },
  medium: {
    accentColor: '#0891b2',
    bg: '#ecfeff',
    border: '#a5f3fc',
    badgeBg: '#cffafe',
    badgeColor: '#164e63',
    badgeBorder: '#a5f3fc',
    dotColor: '#0891b2',
    label: 'Medium',
  },
  low: {
    accentColor: '#2d6a4f',
    bg: '#f0faf2',
    border: '#bbf7d0',
    badgeBg: '#d8f3dc',
    badgeColor: '#2d6a4f',
    badgeBorder: '#b7e4c7',
    dotColor: '#40916c',
    label: 'Low',
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// INSIGHT CARD — dashboard card styling
// ══════════════════════════════════════════════════════════════════════════════

function InsightCard({ insight }: { insight: Insight }) {
  const [expanded, setExpanded] = useState(true);
  const cfg = priorityConfig[insight.priority];

  const categoryIcon: Record<string, React.ReactNode> = {
    Temperature:    <Thermometer size={13} />,
    Humidity:       <Waves size={13} />,
    Irrigation:     <Droplets size={13} />,
    Nutrition:      <FlaskConical size={13} />,
    pH:             <FlaskConical size={13} />,
    'Disease Risk': <AlertCircle size={13} />,
    Harvest:        <Leaf size={13} />,
    Climate:        <Thermometer size={13} />,
  };

  return (
    <div
      onClick={() => setExpanded(!expanded)}
      style={{
        background: '#ffffff',
        border: `1px solid rgba(160,130,90,0.18)`,
        borderLeft: `3px solid ${cfg.accentColor}`,
        borderRadius: 18,
        boxShadow: expanded ? '0 4px 20px rgba(100,70,30,0.09)' : '0 2px 12px rgba(100,70,30,0.06)',
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'transform 0.2s, box-shadow 0.2s',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 10px 32px rgba(100,70,30,0.12)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = ''; }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '16px 18px' }}>
        {/* Priority dot */}
        <div style={{ marginTop: 8, flexShrink: 0 }}>
          <span style={{ display: 'block', width: 8, height: 8, borderRadius: '50%', background: cfg.dotColor, animation: 'pls 2s infinite' }} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Badges row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 100, fontSize: 11, fontWeight: 700, background: cfg.badgeBg, color: cfg.badgeColor, border: `1px solid ${cfg.badgeBorder}`, fontFamily: "'DM Sans', sans-serif", textTransform: 'capitalize' }}>
              {cfg.label}
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 100, fontSize: 11, fontWeight: 500, background: '#f9f5ef', color: '#5a5040', border: '1px solid rgba(160,130,90,0.22)', fontFamily: "'DM Sans', sans-serif" }}>
              {categoryIcon[insight.category] ?? <Info size={12} />} {insight.category}
            </span>
            <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, fontSize: 10.5, color: '#b0a088', fontFamily: "'DM Sans', sans-serif", flexShrink: 0 }}>
              <Clock size={10} /> {formatTime(insight.timestamp)}
            </span>
          </div>
          <p style={{ fontSize: 13.5, fontWeight: 700, color: '#1c1a15', fontFamily: "'Space Grotesk', sans-serif", lineHeight: 1.35 }}>{insight.title}</p>
        </div>

        <ChevronRight size={15} style={{ color: '#b0a088', flexShrink: 0, marginTop: 2, transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
      </div>

      {/* Expanded body */}
      {expanded && (
        <div style={{ padding: '0 18px 18px', borderTop: '1px solid rgba(160,130,90,0.1)' }}>
          <p style={{ fontSize: 13, color: '#5a5040', lineHeight: 1.6, fontFamily: "'DM Sans', sans-serif", padding: '12px 0 10px' }}>{insight.detail}</p>

          {/* Recommended action */}
          <div style={{ background: '#f9f5ef', border: '1px solid rgba(160,130,90,0.18)', borderRadius: 12, padding: '11px 14px', marginBottom: 10 }}>
            <p style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#2d6a4f', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5, fontFamily: "'DM Sans', sans-serif" }}>
              <Zap size={11} /> Recommended Action
            </p>
            <p style={{ fontSize: 13, color: '#1c1a15', lineHeight: 1.5, fontFamily: "'DM Sans', sans-serif" }}>{insight.action}</p>
          </div>

          {/* Impact + confidence */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: 1 }}>
              <TrendingUp size={13} color="#b0a088" style={{ flexShrink: 0 }} />
              <span style={{ fontSize: 11.5, color: '#9a8870', fontFamily: "'DM Sans', sans-serif", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{insight.impact}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              <span style={{ fontSize: 10.5, color: '#b0a088', fontFamily: "'DM Sans', sans-serif" }}>Confidence</span>
              <div style={{ width: 72, height: 5, borderRadius: 100, background: '#ede4d3', overflow: 'hidden' }}>
                <div style={{ width: `${insight.confidence}%`, height: '100%', borderRadius: 100, background: cfg.accentColor, transition: 'width 0.7s cubic-bezier(.34,1.56,.64,1)' }} />
              </div>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: '#1c1a15', fontFamily: "'Space Grotesk', sans-serif" }}>{insight.confidence}%</span>
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
    { label: 'Irrigation advice',  prompt: 'Based on current moisture and weather, should I irrigate today?',  icon: <Droplets size={13} /> },
    { label: 'Nutrient plan',      prompt: 'Create a fertiliser plan based on my soil nutrient levels.',        icon: <FlaskConical size={13} /> },
    { label: 'Harvest forecast',   prompt: 'When should I expect to harvest based on current conditions?',      icon: <Leaf size={13} /> },
    { label: 'Disease risk',       prompt: 'Is there a risk of fungal disease given the current humidity?',     icon: <AlertCircle size={13} /> },
  ];

  const countByPriority = (p: Priority) => insights.filter(i => i.priority === p).length;

  const timestampLabel = insightsSource === 'cache' && lastRefreshed
    ? `Cached · ${formatTime(lastRefreshed)}`
    : insightsSource === 'fresh' && lastRefreshed
      ? `Refreshed ${formatTime(lastRefreshed)}`
      : null;

  // ── Shared card style matching dashboard ──
  const cardBase: React.CSSProperties = {
    background: '#ffffff',
    border: '1px solid rgba(160,130,90,0.18)',
    borderRadius: 18,
    boxShadow: '0 2px 12px rgba(100,70,30,0.06)',
  };

  const statsCards: React.CSSProperties[] = [
    { ...cardBase, background: 'linear-gradient(145deg, #fff1f2 0%, #ffe4e6 100%)', borderColor: 'rgba(239,68,68,0.18)' },
    { ...cardBase, background: 'linear-gradient(145deg, #fffaf0 0%, #fff6e3 100%)', borderColor: 'rgba(217,119,6,0.18)' },
    { ...cardBase, background: 'linear-gradient(145deg, #f0fbff 0%, #e6f7fc 100%)', borderColor: 'rgba(8,145,178,0.18)' },
    { ...cardBase, background: 'linear-gradient(145deg, #f3fbf5 0%, #edf7ef 100%)', borderColor: 'rgba(45,106,79,0.18)' },
  ];

  const soilCardStyle: React.CSSProperties = {
    ...cardBase,
    background: 'linear-gradient(160deg, #f6f8ff 0%, #f2f5fe 100%)',
    borderColor: 'rgba(59,130,246,0.14)',
  };

  const chatCardStyle: React.CSSProperties = {
    ...cardBase,
    background: 'linear-gradient(160deg, #f5f7ff 0%, #f8f5ff 100%)',
    borderColor: 'rgba(124,58,237,0.14)',
  };

  // ══════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════════

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
        @keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
        @keyframes pls{0%,100%{opacity:1}50%{opacity:0.4}}
        .pls{animation:pls 2s infinite}
        .btn-p{background:#2d6a4f;color:#fff;border:none;border-radius:100px;padding:9px 18px;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:7px;transition:all .2s;box-shadow:0 2px 10px rgba(45,106,79,0.28)}
        .btn-p:hover{background:#40916c;transform:translateY(-1px)}
        .btn-p:disabled{opacity:.5;cursor:not-allowed;transform:none}
        .btn-g{background:transparent;border:1px solid rgba(160,130,90,0.22);color:#5a5040;border-radius:100px;padding:8px 16px;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:500;cursor:pointer;display:inline-flex;align-items:center;gap:7px;transition:all .15s}
        .btn-g:hover{background:#f2ece0;border-color:rgba(160,130,90,0.4);color:#1c1a15}
        .ptrack{width:100%;height:5px;background:#ede4d3;border-radius:100px;overflow:hidden}
        .pfill{height:100%;border-radius:100px;transition:width 0.7s cubic-bezier(.34,1.56,.64,1)}
        .tab-btn{display:flex;align-items:center;gap:8px;padding:9px 18px;border-radius:10px;font-size:13.5px;font-weight:600;cursor:pointer;font-family:'Space Grotesk',sans-serif;border:none;transition:all .15s}
        .quick-btn{display:inline-flex;align-items:center;gap:6px;padding:7px 14px;border-radius:100px;font-size:12px;font-weight:500;cursor:pointer;font-family:'DM Sans',sans-serif;background:rgba(255,255,255,0.8);border:1px solid rgba(160,130,90,0.22);color:#5a5040;transition:all .15s}
        .quick-btn:hover{border-color:rgba(45,106,79,0.35);color:#2d6a4f;background:#fff}
      `}</style>

      {/* ── Header ── */}
      <header style={{ position: 'sticky', top: 0, zIndex: 50, height: 'auto', background: 'rgba(249,245,239,0.92)', backdropFilter: 'blur(14px)', borderBottom: '1px solid rgba(160,130,90,0.14)' }}>

        {/* Top row */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '0 24px', height: 64, gap: 16 }}>

          {/* Brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 11, background: 'linear-gradient(135deg, #2d6a4f, #0891b2)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(45,106,79,0.25)', flexShrink: 0 }}>
              <Sparkles size={16} color="#fff" />
            </div>
            <div>
              <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 15, fontWeight: 700, color: '#1c1a15', lineHeight: 1 }}>AI Insights</h1>
              <p style={{ fontSize: 11, color: '#b0a088', marginTop: 2, fontFamily: "'DM Sans', sans-serif" }}>
                {plot ? `${plot.emoji} ${plot.name} — ${plot.cropType} (${plot.variety})` : 'AI-powered · Real-time farm analysis'}
              </p>
            </div>
          </div>

          {/* Sensor pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto', flexWrap: 'wrap' }}>
            {[
              { icon: <Thermometer size={12} />, label: 'Temp',     value: sensor.temperature.toFixed(1), unit: '°C', status: sensor.temperature > 35 ? 'alert' : sensor.temperature > 30 ? 'warn' : 'ok' },
              { icon: <Droplets size={12} />,    label: 'Moisture', value: sensor.moisture.toFixed(0),    unit: '%',  status: sensor.moisture < 30 ? 'alert' : sensor.moisture < 40 ? 'warn' : 'ok' },
              { icon: <Waves size={12} />,       label: 'Humidity', value: sensor.humidity.toFixed(0),    unit: '%',  status: sensor.humidity > 85 ? 'warn' : 'ok' },
            ].map(s => {
              const colors = {
                ok:    { bg: '#f0faf2', border: 'rgba(45,106,79,0.25)',  text: '#2d6a4f' },
                warn:  { bg: '#fffbeb', border: 'rgba(217,119,6,0.25)',  text: '#92400e' },
                alert: { bg: '#fff1f2', border: 'rgba(220,38,38,0.25)', text: '#991b1b' },
              }[s.status as 'ok'|'warn'|'alert'] || { bg: '#f0faf2', border: 'rgba(45,106,79,0.25)', text: '#2d6a4f' };
              return (
                <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 100, fontSize: 12, fontWeight: 600, border: `1px solid ${colors.border}`, background: colors.bg, color: colors.text, fontFamily: "'DM Sans', sans-serif" }}>
                  <span style={{ opacity: 0.85 }}>{s.icon}</span>
                  <span style={{ color: '#9a8870', fontWeight: 400 }}>{s.label}</span>
                  <span style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{s.value}<span style={{ fontWeight: 400, opacity: 0.7, marginLeft: 2 }}>{s.unit}</span></span>
                </div>
              );
            })}

            {/* Live indicator */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 13px', borderRadius: 100, fontSize: 12, fontWeight: 600, background: '#f0faf2', border: '1px solid rgba(45,106,79,0.25)', color: '#2d6a4f', fontFamily: "'DM Sans', sans-serif" }}>
              <span style={{ position: 'relative', display: 'inline-flex', width: 8, height: 8 }}>
                <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: '#40916c', opacity: 0.75, animation: 'ping 1.2s cubic-bezier(0,0,.2,1) infinite' }} />
                <span style={{ position: 'relative', display: 'inline-flex', borderRadius: '50%', width: 8, height: 8, background: '#40916c' }} />
              </span>
              Live
            </div>

            {/* Refresh */}
            <button
              onClick={() => handleGenerateInsights(true)}
              disabled={insightsLoading || !dataLoaded}
              className="btn-p"
              style={{ borderRadius: 100 }}
            >
              {insightsLoading
                ? <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} />
                : <RefreshCw size={13} />}
              Refresh
            </button>
          </div>
        </div>

        {/* Tab bar */}
        <div style={{ padding: '0 24px 12px', display: 'flex' }}>
          <div style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 13, background: 'rgba(160,130,90,0.1)', border: '1px solid rgba(160,130,90,0.18)' }}>
            {(['chat', 'insights'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className="tab-btn"
                style={activeTab === tab
                  ? { background: '#ffffff', color: '#1c1a15', boxShadow: '0 2px 8px rgba(100,70,30,0.10)' }
                  : { color: '#9a8870', background: 'transparent' }}
              >
                {tab === 'insights'
                  ? <><BarChart2 size={15} /> Insights {insights.length > 0 && <span style={{ padding: '2px 8px', borderRadius: 100, fontSize: 10.5, background: '#d8f3dc', color: '#2d6a4f', fontFamily: "'DM Sans', sans-serif" }}>{insights.length}</span>}</>
                  : <><Bot size={15} /> Ask AI</>}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* ── Main Content ── */}
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '24px 24px 60px', display: 'flex', flexDirection: 'column', gap: 18 }}>

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* INSIGHTS TAB                                                       */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'insights' && (
          <>
            {/* Priority summary cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
              {(['critical', 'high', 'medium', 'low'] as Priority[]).map((p, i) => {
                const cfg = priorityConfig[p];
                const count = countByPriority(p);
                return (
                  <div key={p}
                    style={{ ...statsCards[i], padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14, borderLeft: `3px solid ${cfg.accentColor}`, transition: 'transform .2s' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.transform = ''}>
                    <div style={{ width: 42, height: 42, borderRadius: 12, background: cfg.bg, border: `1px solid ${cfg.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, fontWeight: 900, color: cfg.accentColor }}>{count}</span>
                    </div>
                    <div>
                      <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: cfg.accentColor }}>{p}</p>
                      <p style={{ fontSize: 11, color: '#b0a088', fontFamily: "'DM Sans', sans-serif" }}>alerts</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Status bar */}
            <div style={{ ...cardBase, padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, color: '#9a8870', fontFamily: "'DM Sans', sans-serif" }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: dataLoaded ? '#40916c' : '#d97706', display: 'inline-block' }} className={dataLoaded ? 'pls' : ''} />
                {dataLoaded
                  ? (plot ? `Live Data · ${plot.emoji} ${plot.name} – ${plot.cropType}` : 'Live Data · No plot selected')
                  : 'Loading sensor data…'}
              </span>
              {timestampLabel && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#b0a088' }}>
                  <Clock size={11} /> {timestampLabel}
                </span>
              )}
            </div>

            {/* Loading / empty states */}
            {insightsLoading && insights.length === 0 ? (
              <div style={{ ...cardBase, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '72px 24px', gap: 14 }}>
                <div style={{ width: 52, height: 52, borderRadius: 16, background: '#f0faf2', border: '1px solid rgba(45,106,79,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <RefreshCw size={22} color="#2d6a4f" style={{ animation: 'spin 1s linear infinite' }} />
                </div>
                <p style={{ fontSize: 13.5, color: '#9a8870', fontFamily: "'DM Sans', sans-serif" }}>Analysing your sensor data…</p>
              </div>
            ) : !dataLoaded ? (
              <div style={{ ...cardBase, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '72px 24px', gap: 12 }}>
                <RefreshCw size={36} color="#b0a088" style={{ animation: 'spin 1s linear infinite' }} />
                <p style={{ fontSize: 13.5, color: '#9a8870', fontFamily: "'DM Sans', sans-serif" }}>Loading live sensor data…</p>
              </div>
            ) : insights.length === 0 ? (
              <div style={{ ...cardBase, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '72px 24px', gap: 12 }}>
                <div style={{ width: 52, height: 52, borderRadius: 16, background: '#f9f5ef', border: '1px solid rgba(160,130,90,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Sparkles size={22} color="#b0a088" />
                </div>
                <p style={{ fontSize: 13.5, color: '#9a8870', fontFamily: "'DM Sans', sans-serif" }}>No insights yet — click <strong style={{ color: '#2d6a4f' }}>Refresh</strong> to analyse.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                {insights.map((insight, i) => (
                  <InsightCard key={insight.id} insight={insight} />
                ))}
              </div>
            )}

            {/* Soil Snapshot — matching dashboard soil card style */}
            <div style={{ ...soilCardStyle, padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                <div>
                  <h3 style={{ fontWeight: 700, fontSize: 15, color: '#1c1a15', fontFamily: "'Space Grotesk', sans-serif" }}>Soil Snapshot</h3>
                  <p style={{ fontSize: 12, color: '#9a8870', marginTop: 2, fontFamily: "'DM Sans', sans-serif" }}>Live readings from all sensors</p>
                </div>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, padding: '4px 12px', borderRadius: 100, background: '#f9f5ef', border: '1px solid rgba(160,130,90,0.22)', color: '#9a8870', fontFamily: "'DM Sans', sans-serif" }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#40916c', display: 'inline-block' }} className="pls" /> Real-time
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
                {[
                  { label: 'Moisture',    val: sensor.moisture,    unit: '%',     accent: '#2563eb', max: 100, icon: <Droplets size={14} /> },
                  { label: 'Temperature', val: sensor.temperature, unit: '°C',    accent: '#f97316', max: 50,  icon: <Thermometer size={14} /> },
                  { label: 'Humidity',    val: sensor.humidity,    unit: '%',     accent: '#0891b2', max: 100, icon: <Waves size={14} /> },
                  { label: 'pH',          val: sensor.ph,          unit: '',      accent: '#7c3aed', max: 14,  icon: <FlaskConical size={14} /> },
                  { label: 'Nitrogen',    val: sensor.nitrogen,    unit: 'mg/kg', accent: '#dc2626', max: 200, icon: <Activity size={14} /> },
                  { label: 'Phosphorus',  val: sensor.phosphorus,  unit: 'mg/kg', accent: '#d97706', max: 100, icon: <Layers size={14} /> },
                  { label: 'Potassium',   val: sensor.potassium,   unit: 'mg/kg', accent: '#2d6a4f', max: 300, icon: <Wind size={14} /> },
                ].map(m => (
                  <div key={m.label}
                    style={{ background: '#f9f5ef', border: '1px solid rgba(160,130,90,0.14)', borderRadius: 14, padding: '14px 16px', transition: 'transform .2s' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.transform = ''}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                      <span style={{ color: m.accent }}>{m.icon}</span>
                      <p style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, color: '#b0a088', fontFamily: "'DM Sans', sans-serif" }}>{m.label}</p>
                    </div>
                    <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 20, fontWeight: 700, color: '#1c1a15', lineHeight: 1 }}>
                      {m.unit === '' ? Number(m.val).toFixed(1) : Math.round(Number(m.val))}
                      <span style={{ fontSize: 11.5, fontWeight: 400, color: '#9a8870', marginLeft: 3, fontFamily: "'DM Sans', sans-serif" }}>{m.unit}</span>
                    </p>
                    <div className="ptrack" style={{ marginTop: 10 }}>
                      <div className="pfill" style={{ width: `${Math.min((Number(m.val) / m.max) * 100, 100)}%`, background: m.accent, opacity: 0.75 }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* CHAT TAB — matches dashboard AI chat panel style                   */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'chat' && (
          <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 200px)', minHeight: 500 }}>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 16, paddingRight: 4 }}>
              {messages.map(msg => (
                <div key={msg.id} style={{ display: 'flex', gap: 10, justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  {msg.role === 'assistant' && (
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#2d6a4f', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                      <Bot size={14} color="#fff" />
                    </div>
                  )}
                  <div style={{
                    maxWidth: '80%', borderRadius: msg.role === 'assistant' ? '16px 16px 16px 4px' : '16px 16px 4px 16px',
                    padding: '12px 16px', fontSize: 13.5, lineHeight: 1.6, fontFamily: "'DM Sans', sans-serif",
                    background: msg.role === 'user' ? '#2d6a4f' : 'linear-gradient(145deg, #eef8f1 0%, #e8f5ec 100%)',
                    border: msg.role === 'user' ? 'none' : '1px solid rgba(45,106,79,0.18)',
                    color: msg.role === 'user' ? '#fff' : '#1c1a15',
                  }}>
                    {msg.content.split('\n').map((line, i, arr) => (
                      <span key={i}>{line}{i < arr.length - 1 && <br />}</span>
                    ))}
                    <p style={{ fontSize: 10.5, marginTop: 6, color: msg.role === 'user' ? 'rgba(255,255,255,0.55)' : '#b0a088' }}>
                      {formatTime(msg.timestamp)}
                    </p>
                  </div>
                  {msg.role === 'user' && (
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#fff', border: '1px solid rgba(160,130,90,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                      <User size={14} color="#5a5040" />
                    </div>
                  )}
                </div>
              ))}

              {chatLoading && (
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#2d6a4f', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Bot size={14} color="#fff" />
                  </div>
                  <div style={{ padding: '12px 16px', borderRadius: '16px 16px 16px 4px', background: '#f9f5ef', border: '1px solid rgba(160,130,90,0.14)', display: 'flex', gap: 5, alignItems: 'center' }}>
                    {[0, 1, 2].map(i => (
                      <span key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: '#40916c', display: 'inline-block', animation: `bounce .9s ${i * 0.15}s ease-in-out infinite` }} />
                    ))}
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input area */}
            <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>

              {/* Quick prompts */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {quickPrompts.map(qp => (
                  <button key={qp.label} onClick={() => setInput(qp.prompt)} className="quick-btn">
                    {qp.icon} {qp.label}
                  </button>
                ))}
              </div>

              {/* Sensor context strip */}
              <div style={{ ...cardBase, padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: 12, color: '#9a8870', fontFamily: "'DM Sans', sans-serif" }}>
                <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, color: '#2d6a4f', fontSize: 12.5 }}>{plot?.emoji} {plot?.name}</span>
                <span>🌡️ {sensor.temperature.toFixed(1)}°C</span>
                <span>💧 {sensor.moisture.toFixed(0)}%</span>
                <span>💦 {sensor.humidity.toFixed(0)}%</span>
                <span>pH {sensor.ph}</span>
                <span style={{ marginLeft: 'auto', color: '#c4b49a' }}>AI has access to live data</span>
              </div>

              {/* Input bar */}
              <div style={{ ...chatCardStyle, padding: 8, display: 'flex', gap: 8, borderRadius: 18 }}>
                <textarea
                  rows={1}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  placeholder="Ask about your crops, soil, irrigation, pests…"
                  style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', resize: 'none', fontSize: 13.5, fontFamily: "'DM Sans', sans-serif", color: '#1c1a15', padding: '8px 10px', lineHeight: 1.5 }}
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || chatLoading}
                  className="btn-p"
                  style={{ borderRadius: 12, padding: '0 16px', height: 40, alignSelf: 'flex-end', flexShrink: 0 }}
                >
                  {chatLoading
                    ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} />
                    : <Send size={14} />}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}