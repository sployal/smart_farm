'use client';

import React, { useState, useEffect } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';
import {
  Thermometer, Droplets, Waves, FlaskConical,
  CheckCircle, AlertTriangle, Zap, RefreshCw,
  ArrowUpRight, ArrowDownRight, Minus, Target, Eye
} from 'lucide-react';
import { format, subHours } from 'date-fns';
import clsx, { type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { startRealtimeUpdates, fetchSensorData } from '@/lib/firebase';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ─── Types ────────────────────────────────────────────────────────────────────

type TimeRange = '6h' | '24h' | '7d' | '30d';
type SensorKey = 'temperature' | 'humidity' | 'moisture' | 'ph';
type DataPoint = { time: string; value: number };

type SensorConfig = {
  key: SensorKey;
  label: string;
  unit: string;
  icon: React.ElementType;
  color: string;
  colorDim: string;      // muted version for slate backgrounds
  optimalMin: number;
  optimalMax: number;
  criticalMin: number;
  criticalMax: number;
  currentValue: number;
  description: string;
};

// ─── Sensor base configs ──────────────────────────────────────────────────────

const SENSOR_BASES = [
  {
    key: 'temperature' as SensorKey,
    label: 'Temperature',
    unit: '°C',
    icon: Thermometer,
    color: '#f59e0b',    // amber-400 — matches dashboard temp card
    colorDim: '#f59e0b22',
    optimalMin: 18, optimalMax: 28,
    criticalMin: 10, criticalMax: 38,
    description:
      'Air and soil temperature drives metabolic rates, enzymatic activity, and nutrient uptake. Consistent temperatures between 18–28°C support vigorous tomato growth and fruit development.',
  },
  {
    key: 'humidity' as SensorKey,
    label: 'Relative Humidity',
    unit: '%',
    icon: Waves,
    color: '#06b6d4',    // cyan-500 — matches dashboard humidity card
    colorDim: '#06b6d422',
    optimalMin: 55, optimalMax: 80,
    criticalMin: 30, criticalMax: 95,
    description:
      'Relative humidity controls transpiration and pathogen pressure. Levels above 85% for extended periods create fungal disease conditions. Below 40% forces stomatal closure.',
  },
  {
    key: 'moisture' as SensorKey,
    label: 'Soil Moisture',
    unit: '%',
    icon: Droplets,
    color: '#3b82f6',    // blue-500 — matches dashboard moisture card
    colorDim: '#3b82f622',
    optimalMin: 40, optimalMax: 70,
    criticalMin: 20, criticalMax: 85,
    description:
      'Volumetric water content in the root zone determines nutrient availability and oxygen access. Field capacity is 40–60% for loamy soil. Below 25% triggers wilting stress.',
  },
  {
    key: 'ph' as SensorKey,
    label: 'Soil pH',
    unit: 'pH',
    icon: FlaskConical,
    color: '#a855f7',    // violet-500 — matches dashboard pH table row
    colorDim: '#a855f722',
    optimalMin: 6.0, optimalMax: 7.0,
    criticalMin: 4.5, criticalMax: 8.5,
    description:
      'Soil pH governs nutrient solubility and microbial activity. Most macronutrients are available at pH 6–7. Below 5.5 causes aluminium toxicity; above 7.5 locks out iron and manganese.',
  },
];

// ─── Data generation ──────────────────────────────────────────────────────────

function buildData(key: SensorKey, range: TimeRange, base: number): DataPoint[] {
  const pts = range === '6h' ? 24 : range === '24h' ? 48 : range === '7d' ? 84 : 120;
  const now = new Date();
  const drifts: Record<SensorKey, (i: number, t: number) => number> = {
    temperature: (i, t) => Math.sin((i / t) * Math.PI * 2) * 3,
    humidity:    (i, t) => -Math.sin((i / t) * Math.PI) * 8,
    moisture:    (i, t) => -((i / t) * 12),
    ph:          (i, t) => Math.cos((i / t) * Math.PI) * 0.25,
  };
  const variance = key === 'ph' ? 0.25 : 4.5;
  return Array.from({ length: pts }, (_, i) => {
    const date = subHours(now, pts - 1 - i);
    const value = +(base + drifts[key](i, pts) + (Math.random() - 0.5) * variance * 2).toFixed(2);
    return { time: format(date, pts <= 48 ? 'HH:mm' : 'MMM d'), value };
  });
}

// ─── Analysis ─────────────────────────────────────────────────────────────────

type Analysis = {
  status: 'optimal' | 'warning' | 'critical';
  trend: 'rising' | 'falling' | 'stable';
  trendPct: number;
  avg: number; min: number; max: number;
  insights: string[];
  recommendation: string;
};

function analyze(cfg: SensorConfig, data: DataPoint[]): Analysis {
  const vals = data.map(d => d.value);
  const avg = +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2);
  const min = +Math.min(...vals).toFixed(2);
  const max = +Math.max(...vals).toFixed(2);
  const half = Math.floor(vals.length / 2);
  const a1 = vals.slice(0, half).reduce((a, b) => a + b, 0) / half;
  const a2 = vals.slice(half).reduce((a, b) => a + b, 0) / (vals.length - half);
  const trendPct = +((a2 - a1) / a1 * 100).toFixed(1);
  const trend = trendPct > 1.5 ? 'rising' : trendPct < -1.5 ? 'falling' : 'stable';
  const cur = cfg.currentValue;
  const status: Analysis['status'] =
    cur < cfg.criticalMin || cur > cfg.criticalMax ? 'critical' :
    cur < cfg.optimalMin  || cur > cfg.optimalMax  ? 'warning'  : 'optimal';
  const spread = max - min;
  const variancePct = +(spread / avg * 100).toFixed(1);

  const insights = [
    variancePct > 20
      ? `High variance detected — readings swing ±${(spread / 2).toFixed(1)}${cfg.unit}, suggesting environmental instability or sensor noise.`
      : `Readings are stable with low variance (±${(spread / 2).toFixed(1)}${cfg.unit}) — conditions are consistent.`,
    trend === 'rising'
      ? `Upward trend of +${Math.abs(trendPct)}% over the period. Watch for approach toward the ${cfg.optimalMax}${cfg.unit} upper threshold.`
      : trend === 'falling'
      ? `Downward trend of ${trendPct}% recorded. Continued decline may breach the lower optimal of ${cfg.optimalMin}${cfg.unit}.`
      : `No significant directional drift — values are holding steady around ${avg}${cfg.unit}.`,
    status === 'optimal'
      ? `Current value ${cur}${cfg.unit} sits comfortably within the optimal band (${cfg.optimalMin}–${cfg.optimalMax}${cfg.unit}). No corrective action needed.`
      : status === 'warning'
      ? `Current value ${cur}${cfg.unit} is outside optimal range — conditions are suboptimal but manageable.`
      : `Current value ${cur}${cfg.unit} has crossed a critical threshold. Immediate action required.`,
  ];

  const recs: Record<SensorKey, Record<string, string>> = {
    temperature: {
      optimal: 'Maintain current ventilation and shading. Conditions support strong metabolic activity.',
      warning: cur < cfg.optimalMin ? 'Apply row covers or black plastic mulch to retain heat. Monitor overnight minimums.' : 'Increase airflow, apply reflective mulch, and consider shade netting during peak afternoon hours.',
      critical: cur < cfg.criticalMin ? 'Frost risk is present. Deploy emergency frost blankets and activate heating infrastructure immediately.' : 'Heat stress exceeds critical threshold. Activate cooling misting, maximise shade coverage, and increase irrigation.',
    },
    humidity: {
      optimal: 'Humidity supports healthy transpiration. Maintain current irrigation and ventilation schedule.',
      warning: cur > cfg.optimalMax ? 'Elevated humidity increases fungal risk. Improve inter-row airflow and reduce evening irrigation.' : 'Low humidity is elevating transpiration stress. Consider overhead misting or shade cloth.',
      critical: cur > cfg.criticalMax ? 'Critically high humidity — apply preventative fungicide, ventilate immediately, and suspend irrigation.' : 'Critically low humidity. Activate emergency misting and review irrigation schedule.',
    },
    moisture: {
      optimal: 'Soil moisture is at field capacity. Continue current irrigation cycle.',
      warning: cur < cfg.optimalMin ? 'Moisture declining — schedule a 20-minute drip irrigation run within the next 8 hours.' : 'Trending toward over-saturation. Skip one irrigation cycle and inspect drainage capacity.',
      critical: cur < cfg.criticalMin ? 'Soil is approaching wilting point. Begin emergency irrigation immediately and check for drip blockages.' : 'Waterlogged conditions detected. Stop all irrigation, open drainage channels, and apply protective fungicide.',
    },
    ph: {
      optimal: 'pH is ideal for nutrient availability. Maintain current soil amendment schedule.',
      warning: cur < cfg.optimalMin ? 'Slightly acidic — apply agricultural lime at 50 kg/ha to nudge pH upward.' : 'Slightly alkaline — incorporate elemental sulfur at 30 kg/ha or switch to acidifying NPK blends.',
      critical: cur < cfg.criticalMin ? 'Critically acidic soil will cause aluminium toxicity. Apply lime at 200 kg/ha urgently and retest in 48 hours.' : 'Critically alkaline — micronutrient lockout is imminent. Apply gypsum and acidifying amendments without delay.',
    },
  };

  return { status, trend, trendPct, avg, min, max, insights, recommendation: recs[cfg.key][status] };
}

// ─── Custom Tooltip — dark to match slate dashboard ──────────────────────────

const ChartTooltip = ({ active, payload, label, color, unit }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 shadow-2xl text-sm pointer-events-none">
      <p className="text-slate-500 text-xs font-mono mb-1">{label}</p>
      <p className="font-bold text-base" style={{ color }}>
        {payload[0].value?.toFixed(2)}{unit}
      </p>
    </div>
  );
};

// ─── Sensor Section — flowing, no box isolation ───────────────────────────────

function SensorSection({ cfg, range }: { cfg: SensorConfig; range: TimeRange }) {
  const [data, setData] = useState<DataPoint[]>([]);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  
  useEffect(() => {
    const chartData = buildData(cfg.key, range, cfg.currentValue);
    setData(chartData);
    setAnalysis(analyze(cfg, chartData));
  }, [cfg, range]);
  
  // Don't render until data is available (client-side only)
  if (!analysis) return null;
  
  const Icon = cfg.icon;

  const statusMap = {
    optimal: { label: 'Optimal',    icon: <CheckCircle className="w-3.5 h-3.5" />, cls: 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20' },
    warning: { label: 'Suboptimal', icon: <AlertTriangle className="w-3.5 h-3.5" />, cls: 'text-amber-400 bg-amber-500/10 border border-amber-500/20' },
    critical: { label: 'Critical',  icon: <Zap className="w-3.5 h-3.5" />,           cls: 'text-red-400 bg-red-500/10 border border-red-500/20' },
  };
  const st = statusMap[analysis.status];

  const trendEl =
    analysis.trend === 'rising'
      ? <><ArrowUpRight className="w-4 h-4" />+{Math.abs(analysis.trendPct)}%</>
      : analysis.trend === 'falling'
      ? <><ArrowDownRight className="w-4 h-4" />{analysis.trendPct}%</>
      : <><Minus className="w-4 h-4" />Stable</>;

  return (
    <div className="py-14">

      {/* ── Header row ── */}
      <div className="flex flex-col sm:flex-row sm:items-end gap-5 mb-8">

        {/* Icon */}
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 bg-slate-800"
          style={{ boxShadow: `0 0 0 1px ${cfg.color}30` }}
        >
          <Icon className="w-6 h-6" style={{ color: cfg.color }} />
        </div>

        {/* Label + badges + description */}
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-3 mb-2">
            <h2 className="text-3xl font-black tracking-tight text-slate-100">{cfg.label}</h2>
            <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold', st.cls)}>
              {st.icon}{st.label}
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400 bg-slate-800 px-2.5 py-1 rounded-full border border-slate-700">
              {trendEl}
            </span>
          </div>
          <p className="text-slate-400 text-sm max-w-2xl leading-relaxed">{cfg.description}</p>
        </div>

        {/* Live value */}
        <div className="text-right flex-shrink-0 sm:ml-4">
          <div className="text-5xl font-black tabular-nums" style={{ color: cfg.color }}>
            {cfg.currentValue}
            <span className="text-xl font-medium text-slate-500 ml-1">{cfg.unit}</span>
          </div>
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest mt-1">Live</p>
        </div>
      </div>

      {/* ── Stats inline — no boxes ── */}
      <div className="flex flex-wrap gap-x-10 gap-y-3 mb-10">
        {[
          { l: 'Avg',     v: `${analysis.avg}${cfg.unit}` },
          { l: 'Min',     v: `${analysis.min}${cfg.unit}` },
          { l: 'Max',     v: `${analysis.max}${cfg.unit}` },
          { l: 'Optimal', v: `${cfg.optimalMin}–${cfg.optimalMax}${cfg.unit}` },
        ].map((s, i) => (
          <div key={i}>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest mb-0.5">{s.l}</p>
            <p className="text-xl font-bold text-slate-200 tabular-nums">{s.v}</p>
          </div>
        ))}
      </div>

      {/* ── Chart — bare, no wrapping box ── */}
      <div className="w-full h-[280px] sm:h-[340px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 4, left: -22, bottom: 0 }}>
            <defs>
              <linearGradient id={`g-${cfg.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={cfg.color} stopOpacity={0.25} />
                <stop offset="100%" stopColor={cfg.color} stopOpacity={0.02} />
              </linearGradient>
            </defs>

            {/* subtle optimal zone fill */}
            <defs>
              <linearGradient id={`zone-${cfg.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={cfg.color} stopOpacity={0.06} />
                <stop offset="100%" stopColor={cfg.color} stopOpacity={0.06} />
              </linearGradient>
            </defs>

            <CartesianGrid stroke="#1e293b" strokeDasharray="0" vertical={false} />

            <ReferenceLine
              y={cfg.optimalMax}
              stroke={cfg.color}
              strokeDasharray="5 4"
              strokeOpacity={0.4}
              label={{ value: `${cfg.optimalMax}${cfg.unit}`, fill: cfg.color, fontSize: 10, position: 'insideTopRight' }}
            />
            <ReferenceLine
              y={cfg.optimalMin}
              stroke={cfg.color}
              strokeDasharray="5 4"
              strokeOpacity={0.4}
              label={{ value: `${cfg.optimalMin}${cfg.unit}`, fill: cfg.color, fontSize: 10, position: 'insideBottomRight' }}
            />

            <XAxis
              dataKey="time"
              stroke="transparent"
              tick={{ fill: '#475569', fontSize: 11, fontFamily: 'monospace' }}
              tickLine={false}
              axisLine={false}
              interval={Math.floor(data.length / 7)}
            />
            <YAxis
              stroke="transparent"
              tick={{ fill: '#475569', fontSize: 11, fontFamily: 'monospace' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={v => `${v}${cfg.unit}`}
            />
            <Tooltip content={(props: any) => <ChartTooltip {...props} color={cfg.color} unit={cfg.unit} />} />
            <Area
              type="monotone"
              dataKey="value"
              stroke={cfg.color}
              strokeWidth={2.5}
              fill={`url(#g-${cfg.key})`}
              dot={false}
              activeDot={{ r: 6, fill: cfg.color, stroke: '#0f172a', strokeWidth: 3 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* ── Legend ── */}
      <div className="flex items-center gap-6 mt-2 mb-12 pl-1">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="w-5 h-0.5 rounded-full inline-block" style={{ backgroundColor: cfg.color }} />
          {cfg.label}
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="w-5 inline-block" style={{ borderTop: `1.5px dashed ${cfg.color}` }} />
          Optimal range ({cfg.optimalMin}–{cfg.optimalMax}{cfg.unit})
        </div>
      </div>

      {/* ── Analysis + Recommendation — flowing text, no cards ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-20">

        <div>
          <div className="flex items-center gap-2 mb-5">
            <Eye className="w-4 h-4" style={{ color: cfg.color }} />
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Analysis</span>
          </div>
          <ul className="space-y-4">
            {analysis.insights.map((insight, i) => (
              <li key={i} className="flex gap-3.5 text-sm text-slate-400 leading-relaxed">
                <span
                  className="mt-2 w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: i === 2 ? cfg.color : '#334155' }}
                />
                {insight}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-5">
            <Target className="w-4 h-4" style={{ color: cfg.color }} />
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Recommendation</span>
          </div>
          <p className="text-sm text-slate-300 leading-relaxed mb-8">{analysis.recommendation}</p>

          <div className="flex flex-wrap gap-8">
            {[
              { l: 'Optimal range', v: `${cfg.optimalMin}–${cfg.optimalMax}${cfg.unit}`, highlight: true },
              { l: 'Critical low',  v: `${cfg.criticalMin}${cfg.unit}`,  highlight: false },
              { l: 'Critical high', v: `${cfg.criticalMax}${cfg.unit}`, highlight: false },
            ].map((item, i) => (
              <div key={i}>
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest mb-1">{item.l}</p>
                <p className="text-lg font-bold tabular-nums" style={{ color: item.highlight ? cfg.color : '#f87171' }}>
                  {item.v}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Section divider — colored fade on dark ── */}
      <div
        className="mt-16 h-px w-full"
        style={{ background: `linear-gradient(to right, ${cfg.color}40, ${cfg.color}10, transparent)` }}
      />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SensorDataPage() {
  const [range, setRange]           = useState<TimeRange>('24h');
  const [refreshKey, setRefreshKey] = useState(0);
  const [now, setNow]               = useState(new Date());
  const [isConnected, setIsConnected] = useState(false);
  const [lastSync, setLastSync]     = useState('—');

  const [liveValues, setLiveValues] = useState<Record<SensorKey, number>>({
    temperature: 22.8,
    humidity:    65,
    moisture:    58,
    ph:          6.5,   // static — ESP32 doesn't send pH
  });

  const ranges: TimeRange[] = ['6h', '24h', '7d', '30d'];

  // ── Firebase ──
  useEffect(() => {
    fetchSensorData().then((data: any) => {
      setLiveValues(prev => ({
        ...prev,
        temperature: parseFloat(data.temperature?.toString() || prev.temperature.toString()),
        humidity:    parseFloat(data.humidity?.toString()    || prev.humidity.toString()),
        moisture:    parseFloat(data.moisture?.toString()    || prev.moisture.toString()),
      }));
      setIsConnected(true);
      setLastSync(format(new Date(), 'HH:mm:ss'));
    }).catch(() => setIsConnected(false));

    const unsubscribe = startRealtimeUpdates((data: any) => {
      setLiveValues(prev => ({
        ...prev,
        temperature: parseFloat(data.temperature?.toString() || prev.temperature.toString()),
        humidity:    parseFloat(data.humidity?.toString()    || prev.humidity.toString()),
        moisture:    parseFloat(data.moisture?.toString()    || prev.moisture.toString()),
      }));
      setIsConnected(true);
      setLastSync(format(new Date(), 'HH:mm:ss'));
      setNow(new Date());
    });

    return () => unsubscribe();
  }, []);

  const refresh = () => { setRefreshKey(k => k + 1); setNow(new Date()); };

  // Merge live values into full configs
  const SENSORS: SensorConfig[] = SENSOR_BASES.map(base => ({
    ...base,
    currentValue: liveValues[base.key],
  }));

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">

      {/* ── Topbar — same style as dashboard header ── */}
      <div className="sticky top-0 z-30 h-14 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 flex items-center justify-between px-6 md:px-10 gap-4">
        <div className="flex items-center gap-3">
          <span className={cn(
            'w-2 h-2 rounded-full animate-pulse',
            isConnected
              ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]'
              : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]'
          )} />
          <span className="text-sm font-semibold text-slate-300">Sensor Data</span>
          <span className="text-slate-700">/</span>
          <span className="text-sm text-slate-500 hidden sm:block">Plot A — Tomatoes</span>
          {lastSync !== '—' && (
            <span className="hidden md:block text-xs text-slate-600">· synced {lastSync}</span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Time range selector */}
          <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-xl p-1">
            {ranges.map(r => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all duration-150',
                  range === r
                    ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                    : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
                )}
              >
                {r}
              </button>
            ))}
          </div>

          <button
            onClick={refresh}
            className="p-2 rounded-xl hover:bg-slate-800 text-slate-500 hover:text-slate-300 transition-all active:scale-95"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Page content ── */}
      <div className="px-6 md:px-10 lg:px-14 max-w-[1200px] mx-auto" key={refreshKey}>

        {/* Page heading */}
        <div className="pt-12 pb-4">
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-slate-100 mb-3">
            Sensor Analytics
          </h1>
          <p className="text-slate-400 text-base max-w-xl leading-relaxed">
            Real-time readings and trend analysis across all monitored environmental parameters for Plot A.
          </p>
        </div>

        {/* ── Quick status strip — inline, no boxes ── */}
        <div className="flex flex-wrap gap-x-8 gap-y-3 py-6 border-y border-slate-800 mb-2">
          {SENSORS.map(cfg => {
            const isOptimal = cfg.currentValue >= cfg.optimalMin && cfg.currentValue <= cfg.optimalMax;
            const isWarning = !isOptimal && cfg.currentValue >= cfg.criticalMin && cfg.currentValue <= cfg.criticalMax;
            const Icon = cfg.icon;
            return (
              <div key={cfg.key} className="flex items-center gap-2.5">
                <Icon className="w-4 h-4" style={{ color: cfg.color }} />
                <span className="text-sm text-slate-500">{cfg.label}</span>
                <span className="text-sm font-black tabular-nums" style={{ color: cfg.color }}>
                  {cfg.currentValue}{cfg.unit}
                </span>
                {isOptimal
                  ? <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                  : isWarning
                  ? <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                  : <Zap className="w-3.5 h-3.5 text-red-500" />}
              </div>
            );
          })}
        </div>

        {/* ── All sensor sections, flowing ── */}
        {SENSORS.map(cfg => (
          <SensorSection key={`${cfg.key}-${refreshKey}`} cfg={cfg} range={range} />
        ))}

        <p className="pb-10 text-xs text-slate-700 text-center">
          ESP32 via Firebase · {format(now, 'PPpp')}
        </p>
      </div>
    </div>
  );
}