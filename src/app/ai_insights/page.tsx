'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bot,
  Send,
  Leaf,
  AlertTriangle,
  TrendingUp,
  Droplets,
  Thermometer,
  Waves,
  FlaskConical,
  Zap,
  RefreshCw,
  Sparkles,
  ChevronRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  Info,
  ArrowUpRight,
  ArrowLeft,
  BarChart2,
  CloudRain,
  Sun,
  Wind,
  X,
  Loader2,
  Copy,
  ThumbsUp,
  ThumbsDown
} from 'lucide-react';
import { startRealtimeUpdates, fetchSensorData } from '@/lib/firebase';

const AI_API_KEY = process.env.NEXT_PUBLIC_GROQ_API_KEY ?? '';
const AI_MODEL     = 'llama-3.3-70b-versatile';

// ══════════════════════════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════════════════════════

type SensorData = {
  moisture: number;
  temperature: number;
  humidity: number;
  ph: number;
  nitrogen: number;
  phosphorus: number;
  potassium: number;
};

type Priority = 'critical' | 'high' | 'medium' | 'low';

type Insight = {
  id: string;
  priority: Priority;
  category: string;
  title: string;
  detail: string;
  action: string;
  impact: string;
  confidence: number;
  timestamp: Date;
};

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
};

type QuickPrompt = { 
  label: string; 
  prompt: string; 
  icon: React.ReactNode 
};

// ══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ══════════════════════════════════════════════════════════════════════════════

function cn(...classes: (string | undefined | false | null)[]) {
  return classes.filter(Boolean).join(' ');
}

function formatTime(date: Date) {
  return date.toLocaleTimeString('en-KE', { 
    hour: '2-digit', 
    minute: '2-digit' 
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// AI API FUNCTIONS
// ══════════════════════════════════════════════════════════════════════════════

async function callAI(prompt: string, systemContext: string): Promise<string> {
  if (!AI_API_KEY) {
    return '⚠️ NEXT_PUBLIC_GROQ_API_KEY is not set. Check your .env.local and restart the dev server.';
  }

  const url = 'https://api.groq.com/openai/v1/chat/completions';

  const body = {
    model: AI_MODEL,
    messages: [
      ...(systemContext ? [{ role: 'system', content: systemContext }] : []),
      { role: 'user', content: prompt }
    ],
    temperature: 0.7,
    max_tokens: 1024
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json', 
      'Authorization': `Bearer ${AI_API_KEY}` 
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `AI API error ${res.status}`);
  }

  const data = await res.json();
  return data?.choices?.[0]?.message?.content ?? 'No response received.';
}

async function generateInsights(sensor: SensorData): Promise<Insight[]> {
  const prompt = `
You are an expert agronomist AI. Given the following real-time sensor readings from a tomato farm in Kenya, return a JSON array of exactly 4 insights.

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
4. The FOURTH insight should cover whichever of pH, Nutrition, Disease Risk, or Harvest is most urgent.
5. Each insight must directly reference the actual sensor value in the detail field.

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
    return arr.map((item: Insight, i: number) => ({
      ...item,
      id: String(i + 1),
      timestamp: new Date()
    }));
  } catch (error) {
    console.error('Failed to parse insights:', error);
    return [];
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// STYLING CONFIGURATION
// ══════════════════════════════════════════════════════════════════════════════

const priorityConfig: Record<Priority, { 
  color: string; 
  bg: string; 
  border: string; 
  badge: string; 
  dot: string 
}> = {
  critical: {
    color:  'text-red-400',
    bg:     'bg-red-500/10',
    border: 'border-red-500/40',
    badge:  'bg-red-500/20 text-red-300 border border-red-500/30',
    dot:    'bg-red-500'
  },
  high: {
    color:  'text-amber-400',
    bg:     'bg-amber-500/10',
    border: 'border-amber-500/40',
    badge:  'bg-amber-500/20 text-amber-300 border border-amber-500/30',
    dot:    'bg-amber-500'
  },
  medium: {
    color:  'text-sky-400',
    bg:     'bg-sky-500/10',
    border: 'border-sky-500/40',
    badge:  'bg-sky-500/20 text-sky-300 border border-sky-500/30',
    dot:    'bg-sky-500'
  },
  low: {
    color:  'text-emerald-400',
    bg:     'bg-emerald-500/10',
    border: 'border-emerald-500/40',
    badge:  'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
    dot:    'bg-emerald-500'
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// INSIGHT CARD COMPONENT
// ══════════════════════════════════════════════════════════════════════════════

function InsightCard({ insight, index }: { insight: Insight; index: number }) {
  const [expanded, setExpanded] = useState(true);
  const cfg = priorityConfig[insight.priority];

  const categoryIcon: Record<string, React.ReactNode> = {
    Temperature:    <Thermometer className="w-4 h-4" />,
    Humidity:       <Waves className="w-4 h-4" />,
    Irrigation:     <Droplets className="w-4 h-4" />,
    Nutrition:      <FlaskConical className="w-4 h-4" />,
    pH:             <FlaskConical className="w-4 h-4" />,
    'Disease Risk': <AlertCircle className="w-4 h-4" />,
    Harvest:        <Leaf className="w-4 h-4" />,
    Climate:        <Thermometer className="w-4 h-4" />,
  };

  return (
    <div
      className={cn(
        'rounded-2xl border backdrop-blur-sm transition-all duration-300 overflow-hidden cursor-pointer',
        cfg.bg, 
        cfg.border,
        expanded ? 'shadow-lg' : 'hover:shadow-md hover:-translate-y-0.5'
      )}
      style={{ animationDelay: `${index * 80}ms` }}
      onClick={() => setExpanded(!expanded)}
    >
      {/* Card Header */}
      <div className="flex items-start gap-3 p-4">
        <div className="mt-1 flex-shrink-0">
          <span className={cn('block w-2.5 h-2.5 rounded-full animate-pulse', cfg.dot)} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={cn(
              'inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full capitalize', 
              cfg.badge
            )}>
              {insight.priority}
            </span>
            <span className="inline-flex items-center gap-1 text-xs text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full border border-slate-700">
              {categoryIcon[insight.category] ?? <Info className="w-3 h-3" />}
              {insight.category}
            </span>
            <span className="ml-auto text-[11px] text-slate-500 flex items-center gap-1 flex-shrink-0">
              <Clock className="w-3 h-3" />
              {formatTime(insight.timestamp)}
            </span>
          </div>

          <p className="text-sm font-semibold text-slate-100 leading-snug">
            {insight.title}
          </p>
        </div>

        <ChevronRight className={cn(
          'w-4 h-4 text-slate-500 flex-shrink-0 transition-transform duration-200', 
          expanded && 'rotate-90'
        )} />
      </div>

      {/* Expanded Body */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-slate-700/50 pt-3">
          <p className="text-sm text-slate-300 leading-relaxed">
            {insight.detail}
          </p>

          <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-700/50">
            <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <Zap className="w-3 h-3" /> Recommended Action
            </p>
            <p className="text-sm text-slate-200">{insight.action}</p>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-xs text-slate-400">{insight.impact}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500">Confidence</span>
              <div className="w-24 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-700"
                  style={{ width: `${insight.confidence}%` }}
                />
              </div>
              <span className="text-xs font-semibold text-slate-300">
                {insight.confidence}%
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SENSOR PILL COMPONENT
// ══════════════════════════════════════════════════════════════════════════════

function SensorPill({ 
  icon, 
  label, 
  value, 
  unit, 
  status 
}: {
  icon: React.ReactNode; 
  label: string; 
  value: number | string; 
  unit: string; 
  status: 'ok' | 'warn' | 'alert';
}) {
  const colors = { 
    ok:    'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', 
    warn:  'text-amber-400 bg-amber-500/10 border-amber-500/20', 
    alert: 'text-red-400 bg-red-500/10 border-red-500/20' 
  };

  return (
    <div className={cn(
      'flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium', 
      colors[status]
    )}>
      <span className="opacity-80">{icon}</span>
      <span className="text-slate-400 text-xs">{label}</span>
      <span className="font-bold">
        {value}
        <span className="font-normal text-xs opacity-70 ml-0.5">{unit}</span>
      </span>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════

export default function AIInsightsPage() {
  const router = useRouter();
  // ────────────────────────────────────────────────────────────────────────────
  // STATE
  // ────────────────────────────────────────────────────────────────────────────
  
  // Sensor data (starts at 0 until Firebase loads)
  const [sensor, setSensor] = useState<SensorData>({
    moisture: 0,
    temperature: 0,
    humidity: 0,
    ph: 6.5,
    nitrogen: 45,
    phosphorus: 32,
    potassium: 180
  });

  const [dataLoaded, setDataLoaded] = useState(false);

  // Insights
  const [insights, setInsights] = useState<Insight[]>([]);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  // Chat
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '0',
      role: 'assistant',
      content: "Hello! I'm your AI farm assistant. I have live access to your sensor data. Ask me anything — irrigation schedules, nutrient deficiencies, pest risks, harvest timing, or just chat about your crops! 🌱",
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // UI
  const [activeTab, setActiveTab] = useState<'insights' | 'chat'>('insights');

  // ────────────────────────────────────────────────────────────────────────────
  // FIREBASE INTEGRATION
  // ────────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    // Fetch initial sensor data
    fetchSensorData()
      .then((data: Partial<SensorData>) => {
        setSensor(prev => ({
          ...prev,
          temperature: parseFloat(String(data.temperature ?? prev.temperature)),
          humidity:    parseFloat(String(data.humidity    ?? prev.humidity)),
          moisture:    parseFloat(String(data.moisture    ?? prev.moisture)),
        }));
        setDataLoaded(true);
      })
      .catch(err => {
        console.error('Error fetching sensor data:', err);
      });

    // Set up real-time listener
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

  // ────────────────────────────────────────────────────────────────────────────
  // INSIGHT GENERATION
  // ────────────────────────────────────────────────────────────────────────────

  const handleGenerateInsights = useCallback(async () => {
    if (!dataLoaded) {
      console.log('Waiting for Firebase data before generating insights...');
      return;
    }
    
    setInsightsLoading(true);
    
    try {
      const result = await generateInsights(sensor);
      if (result.length > 0) {
        setInsights(result);
        setLastRefreshed(new Date());
      }
    } catch (error) {
      console.error('Error generating insights:', error);
    } finally {
      setInsightsLoading(false);
    }
  }, [sensor, dataLoaded]);

  // Auto-generate insights ONLY when data first loads
  useEffect(() => {
    if (dataLoaded && insights.length === 0) {
      handleGenerateInsights();
    }
  }, [dataLoaded, insights.length, handleGenerateInsights]);

  // ────────────────────────────────────────────────────────────────────────────
  // CHAT FUNCTIONALITY
  // ────────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const systemContext = `
You are an expert AI agronomist assistant for a smart farm in Kenya.
Current real-time sensor readings:
- Soil Moisture: ${sensor.moisture}%
- Temperature: ${sensor.temperature}°C  
- Humidity: ${sensor.humidity}%
- Soil pH: ${sensor.ph}
- Nitrogen (N): ${sensor.nitrogen} mg/kg
- Phosphorus (P): ${sensor.phosphorus} mg/kg
- Potassium (K): ${sensor.potassium} mg/kg
Current crop: Tomatoes (Roma VF variety), Plot A.
Give concise, actionable advice. Use bullet points sparingly. Be friendly and professional.
  `.trim();

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || chatLoading) return;
    
    setInput('');

    const userMsg: ChatMessage = { 
      id: Date.now().toString(), 
      role: 'user', 
      content: text, 
      timestamp: new Date() 
    };
    setMessages(prev => [...prev, userMsg]);
    setChatLoading(true);

    try {
      const reply = await callAI(text, systemContext);
      const aiMsg: ChatMessage = { 
        id: (Date.now() + 1).toString(), 
        role: 'assistant', 
        content: reply, 
        timestamp: new Date() 
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (err) {
      const errMsg: ChatMessage = {
        id: (Date.now() + 1).toString(), 
        role: 'assistant',
        content: `❌ Error: ${(err as Error).message}`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setChatLoading(false);
    }
  }, [input, chatLoading, systemContext]);

  // ────────────────────────────────────────────────────────────────────────────
  // QUICK PROMPTS
  // ────────────────────────────────────────────────────────────────────────────

  const quickPrompts: QuickPrompt[] = [
    { 
      label: 'Irrigation advice', 
      prompt: 'Based on current moisture and weather, should I irrigate today?', 
      icon: <Droplets className="w-3.5 h-3.5" /> 
    },
    { 
      label: 'Nutrient plan', 
      prompt: 'Create a fertiliser plan based on my soil nutrient levels.', 
      icon: <FlaskConical className="w-3.5 h-3.5" /> 
    },
    { 
      label: 'Harvest forecast', 
      prompt: 'When should I expect to harvest based on current conditions?', 
      icon: <Leaf className="w-3.5 h-3.5" /> 
    },
    { 
      label: 'Disease risk', 
      prompt: 'Is there a risk of fungal disease given the current humidity?', 
      icon: <AlertCircle className="w-3.5 h-3.5" /> 
    },
  ];

  // ────────────────────────────────────────────────────────────────────────────
  // HELPER FUNCTIONS
  // ────────────────────────────────────────────────────────────────────────────

  const countByPriority = (p: Priority) => 
    insights.filter(i => i.priority === p).length;

  // ══════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════════

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">

      {/* Top Gradient Strip */}
      <div className="h-1 w-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500" />

      {/* ════════════════════════════════════════════════════════════════════════ */}
      {/* PAGE HEADER */}
      {/* ════════════════════════════════════════════════════════════════════════ */}

      <div className="px-4 sm:px-6 lg:px-8 pt-6 pb-4 border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          {/* Mobile return icon — part of header, visible only on small screens */}
          <button
            type="button"
            onClick={() => router.back()}
            className="md:hidden p-1.5 -ml-1 text-slate-400 hover:text-slate-100 transition-colors touch-manipulation order-first"
            aria-label="Go back"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          {/* Logo & Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-100 leading-none">
                AI Insights
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                AI-powered · Real-time farm analysis
              </p>
            </div>
          </div>

          {/* Live Sensor Pills */}
          <div className="flex items-center gap-2 flex-wrap">
            <SensorPill 
              icon={<Thermometer className="w-3.5 h-3.5" />} 
              label="Temp" 
              value={sensor.temperature} 
              unit="°C"
              status={
                sensor.temperature > 35 ? 'alert' : 
                sensor.temperature > 30 ? 'warn' : 
                'ok'
              } 
            />
            <SensorPill 
              icon={<Droplets className="w-3.5 h-3.5" />} 
              label="Moisture" 
              value={sensor.moisture} 
              unit="%"
              status={
                sensor.moisture < 30 ? 'alert' : 
                sensor.moisture < 40 ? 'warn' : 
                'ok'
              } 
            />
            <SensorPill 
              icon={<Waves className="w-3.5 h-3.5" />} 
              label="Humidity" 
              value={sensor.humidity} 
              unit="%"
              status={sensor.humidity > 85 ? 'warn' : 'ok'} 
            />

            <button
              onClick={handleGenerateInsights}
              disabled={insightsLoading || !dataLoaded}
              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-all active:scale-95"
            >
              {insightsLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              Refresh
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="max-w-6xl mx-auto mt-4 flex gap-1 bg-slate-800/60 rounded-xl p-1 w-fit">
          {(['insights', 'chat'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-semibold transition-all capitalize',
                activeTab === tab
                  ? 'bg-slate-700 text-slate-100 shadow'
                  : 'text-slate-400 hover:text-slate-200'
              )}
            >
              {tab === 'insights' ? (
                <span className="flex items-center gap-2">
                  <BarChart2 className="w-4 h-4" /> Insights
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Bot className="w-4 h-4" /> Ask AI
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════════ */}
      {/* MAIN CONTENT */}
      {/* ════════════════════════════════════════════════════════════════════════ */}

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

        {/* ──────────────────────────────────────────────────────────────────── */}
        {/* INSIGHTS TAB */}
        {/* ──────────────────────────────────────────────────────────────────── */}

        {activeTab === 'insights' && (
          <div className="space-y-6">

            {/* Priority Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {(['critical', 'high', 'medium', 'low'] as Priority[]).map(p => {
                const cfg = priorityConfig[p];
                return (
                  <div 
                    key={p} 
                    className={cn(
                      'rounded-2xl border p-4 flex items-center gap-3', 
                      cfg.bg, 
                      cfg.border
                    )}
                  >
                    <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center', cfg.bg)}>
                      <span className={cn('text-xl font-black', cfg.color)}>
                        {countByPriority(p)}
                      </span>
                    </div>
                    <div>
                      <p className={cn('text-xs font-bold uppercase tracking-wide', cfg.color)}>
                        {p}
                      </p>
                      <p className="text-[11px] text-slate-500">alerts</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Status Bar */}
            <div className="flex items-center justify-between text-xs text-slate-500 bg-slate-800/40 rounded-xl px-4 py-2.5 border border-slate-700/40">
              <span className="flex items-center gap-2">
                <span className={cn(
                  "w-2 h-2 rounded-full", 
                  dataLoaded ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
                )} />
                {dataLoaded 
                  ? "Firebase live · Plot A – Tomatoes" 
                  : "Loading sensor data..."}
              </span>
              {lastRefreshed && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Last analysed at {formatTime(lastRefreshed)}
                </span>
              )}
            </div>

            {/* Insights Loading State */}
            {insightsLoading && insights.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                  <Loader2 className="w-7 h-7 text-emerald-400 animate-spin" />
                </div>
                <p className="text-slate-400 text-sm">
                  Analysing your sensor data…
                </p>
              </div>
            ) : !dataLoaded ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
                <Loader2 className="w-10 h-10 text-slate-600 animate-spin" />
                <p className="text-slate-400">
                  Loading live sensor data from Firebase...
                </p>
              </div>
            ) : insights.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
                <Sparkles className="w-10 h-10 text-slate-600" />
                <p className="text-slate-400">
                  No insights yet — click <strong>Refresh</strong> to analyse.
                </p>
              </div>
            ) : (
              /* Insights Grid */
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {insights.map((insight, i) => (
                  <InsightCard key={insight.id} insight={insight} index={i} />
                ))}
              </div>
            )}

            {/* Current Soil Snapshot */}
            <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-4 sm:p-6">
              <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-emerald-400" />
                Current Soil Snapshot
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {[
                  { label: 'Moisture', val: sensor.moisture, unit: '%', color: '#3b82f6', max: 100 },
                  { label: 'Temperature', val: sensor.temperature, unit: '°C', color: '#f59e0b', max: 50 },
                  { label: 'Humidity', val: sensor.humidity, unit: '%', color: '#06b6d4', max: 100 },
                  { label: 'pH', val: sensor.ph, unit: '', color: '#a78bfa', max: 14 },
                  { label: 'Nitrogen', val: sensor.nitrogen, unit: ' mg/kg', color: '#f87171', max: 200 },
                  { label: 'Phosphorus', val: sensor.phosphorus, unit: ' mg/kg', color: '#fb923c', max: 100 },
                  { label: 'Potassium', val: sensor.potassium, unit: ' mg/kg', color: '#34d399', max: 300 },
                ].map(m => (
                  <div 
                    key={m.label} 
                    className="bg-slate-900/60 rounded-xl p-3 border border-slate-700/40"
                  >
                    <p className="text-xs text-slate-400 mb-1">{m.label}</p>
                    <p className="text-lg font-bold text-slate-100">
                      {m.val}
                      <span className="text-xs font-normal text-slate-400 ml-0.5">
                        {m.unit}
                      </span>
                    </p>
                    <div className="mt-2 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                      <div 
                        className="h-full rounded-full transition-all duration-700" 
                        style={{ 
                          width: `${Math.min((m.val / m.max) * 100, 100)}%`, 
                          backgroundColor: m.color 
                        }} 
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ──────────────────────────────────────────────────────────────────── */}
        {/* CHAT TAB */}
        {/* ──────────────────────────────────────────────────────────────────── */}

        {activeTab === 'chat' && (
          <div 
            className="flex flex-col" 
            style={{ height: 'calc(100vh - 220px)', minHeight: '500px' }}
          >

            {/* Messages List */}
            <div className="flex-1 overflow-y-auto space-y-4 pb-4 pr-1">
              {messages.map(msg => (
                <div 
                  key={msg.id} 
                  className={cn(
                    'flex gap-3', 
                    msg.role === 'user' ? 'justify-end' : 'justify-start'
                  )}
                >

                  {msg.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center flex-shrink-0 mt-1 shadow-lg shadow-emerald-500/20">
                      <Bot className="w-4 h-4 text-white" />
                    </div>
                  )}

                  <div className={cn(
                    'max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed',
                    msg.role === 'user'
                      ? 'bg-emerald-600 text-white rounded-tr-sm'
                      : 'bg-slate-800 border border-slate-700 text-slate-200 rounded-tl-sm'
                  )}>
                    {msg.content.split('\n').map((line, i) => (
                      <span key={i}>
                        {line}
                        {i < msg.content.split('\n').length - 1 && <br />}
                      </span>
                    ))}
                    <p className={cn(
                      'text-[11px] mt-1.5', 
                      msg.role === 'user' ? 'text-emerald-200' : 'text-slate-500'
                    )}>
                      {formatTime(msg.timestamp)}
                    </p>
                  </div>

                  {msg.role === 'user' && (
                    <div className="w-8 h-8 rounded-xl bg-slate-700 border border-slate-600 flex items-center justify-center flex-shrink-0 mt-1 text-xs font-bold text-slate-300">
                      DM
                    </div>
                  )}
                </div>
              ))}

              {chatLoading && (
                <div className="flex gap-3 items-center">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                  <div className="bg-slate-800 border border-slate-700 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
                    <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />
                    <span className="text-sm text-slate-400">AI is thinking…</span>
                  </div>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>

            {/* Quick Prompts */}
            <div className="flex gap-2 flex-wrap mb-3">
              {quickPrompts.map(qp => (
                <button
                  key={qp.label}
                  onClick={() => setInput(qp.prompt)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-emerald-500/40 text-slate-300 hover:text-emerald-300 rounded-xl text-xs font-medium transition-all"
                >
                  {qp.icon}
                  {qp.label}
                </button>
              ))}
            </div>

            {/* Input Bar */}
            <div className="flex gap-2 bg-slate-800/80 border border-slate-700 rounded-2xl p-2 backdrop-blur-sm">
              <textarea
                rows={1}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { 
                  if (e.key === 'Enter' && !e.shiftKey) { 
                    e.preventDefault(); 
                    handleSend(); 
                  } 
                }}
                placeholder="Ask about your crops, soil, irrigation, pests…"
                className="flex-1 bg-transparent text-sm text-slate-200 placeholder:text-slate-500 resize-none focus:outline-none px-2 py-1.5 leading-relaxed"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || chatLoading}
                className="w-10 h-10 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl flex items-center justify-center text-white transition-all active:scale-95 flex-shrink-0 self-end"
              >
                {chatLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </div>

            <p className="text-center text-[11px] text-slate-600 mt-2">
              AI has access to live sensor data from Firebase · Press Enter to send
            </p>
          </div>
        )}
      </div>
    </div>
  );
}