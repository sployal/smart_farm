'use client';

import React, { useState } from 'react';
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
  colorLight: string;
  textClass: string;
  optimalMin: number;
  optimalMax: number;
  criticalMin: number;
  criticalMax: number;
  currentValue: number;
  description: string;
};

// ─── Sensor configs with vivid colors ────────────────────────────────────────

const SENSORS: SensorConfig[] = [
  {
    key: 'temperature',
    label: 'Temperature',
    unit: '°C',
    icon: Thermometer,
    color: '#f97316',
    colorLight: '#fff7ed',
    textClass: 'text-orange-500',
    optimalMin: 18,
    optimalMax: 28,
    criticalMin: 10,
    criticalMax: 38,
    currentValue: 24.3,
    description:
      'Air and soil temperature drives metabolic rates, enzymatic activity, and nutrient uptake. Consistent temperatures between 18–28°C support vigorous tomato growth and fruit development.',
  },
  {
    key: 'humidity',
    label: 'Relative Humidity',
    unit: '%',
    icon: Waves,
    color: '#0ea5e9',
    colorLight: '#f0f9ff',
    textClass: 'text-sky-500',
    optimalMin: 55,
    optimalMax: 80,
    criticalMin: 30,
    criticalMax: 95,
    currentValue: 68.5,
    description:
      'Relative humidity controls transpiration and pathogen pressure. Levels above 85% for extended periods create fungal disease conditions. Below 40% forces stomatal closure.',
  },
  {
    key: 'moisture',
    label: 'Soil Moisture',
    unit: '%',
    icon: Droplets,
    color: '#6366f1',
    colorLight: '#eef2ff',
    textClass: 'text-indigo-500',
    optimalMin: 40,
    optimalMax: 70,
    criticalMin: 20,
    criticalMax: 85,
    currentValue: 58.2,
    description:
      'Volumetric water content in the root zone determines nutrient availability and oxygen access. Field capacity is 40–60% for loamy soil. Below 25% triggers wilting stress.',
  },
  {
    key: 'ph',
    label: 'Soil pH',
    unit: 'pH',
    icon: FlaskConical,
    color: '#10b981',
    colorLight: '#ecfdf5',
    textClass: 'text-emerald-500',
    optimalMin: 6.0,
    optimalMax: 7.0,
    criticalMin: 4.5,
    criticalMax: 8.5,
    currentValue: 6.4,
    description:
      'Soil pH governs nutrient solubility and microbial activity. Most macronutrients are available at pH 6–7. Below 5.5 causes aluminium toxicity; above 7.5 locks out iron and manganese.',
  },
];

// ─── Data generation ──────────────────────────────────────────────────────────

function buildData(cfg: SensorConfig, range: TimeRange): DataPoint[] {
  const pts = range === '6h' ? 24 : range === '24h' ? 48 : range === '7d' ? 84 : 120;
  const now = new Date();
  const drifts: Record<SensorKey, (i: number, t: number) => number> = {
    temperature: (i, t) => Math.sin((i / t) * Math.PI * 2) * 3,
    humidity: (i, t) => -Math.sin((i / t) * Math.PI) * 8,
    moisture: (i, t) => -((i / t) * 12),
    ph: (i, t) => Math.cos((i / t) * Math.PI) * 0.25,
  };
  const variance = cfg.key === 'ph' ? 0.25 : 4.5;
  return Array.from({ length: pts }, (_, i) => {
    const hoursBack = pts - 1 - i;
    const date = subHours(now, hoursBack);
    const drift = drifts[cfg.key](i, pts);
    const value = +(cfg.currentValue + drift + (Math.random() - 0.5) * variance * 2).toFixed(2);
    return { time: format(date, pts <= 48 ? 'HH:mm' : 'MMM d'), value };
  });
}

// ─── Analysis ─────────────────────────────────────────────────────────────────

type Analysis = {
  status: 'optimal' | 'warning' | 'critical';
  trend: 'rising' | 'falling' | 'stable';
  trendPct: number;
  avg: number;
  min: number;
  max: number;
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
    cur < cfg.optimalMin || cur > cfg.optimalMax ? 'warning' : 'optimal';

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
      warning: cur < cfg.optimalMin
        ? 'Apply row covers or black plastic mulch to retain heat. Monitor overnight minimums.'
        : 'Increase airflow, apply reflective mulch, and consider shade netting during peak afternoon hours.',
      critical: cur < cfg.criticalMin
        ? 'Frost risk is present. Deploy emergency frost blankets and activate any heating infrastructure immediately.'
        : 'Heat stress exceeds critical threshold. Activate cooling misting, maximise shade coverage, and increase irrigation.',
    },
    humidity: {
      optimal: 'Humidity supports healthy transpiration. Maintain current irrigation and ventilation schedule.',
      warning: cur > cfg.optimalMax
        ? 'Elevated humidity increases fungal risk. Improve inter-row airflow and reduce evening irrigation.'
        : 'Low humidity is elevating transpiration stress. Consider overhead misting or shade cloth.',
      critical: cur > cfg.criticalMax
        ? 'Critically high humidity — apply preventative fungicide, ventilate immediately, and suspend irrigation.'
        : 'Critically low humidity. Activate emergency misting and review irrigation schedule.',
    },
    moisture: {
      optimal: 'Soil moisture is at field capacity. Continue current irrigation cycle.',
      warning: cur < cfg.optimalMin
        ? 'Moisture declining — schedule a 20-minute drip irrigation run within the next 8 hours.'
        : 'Trending toward over-saturation. Skip one irrigation cycle and inspect drainage capacity.',
      critical: cur < cfg.criticalMin
        ? 'Soil is approaching wilting point. Begin emergency irrigation immediately and check for drip blockages.'
        : 'Waterlogged conditions detected. Stop all irrigation, open drainage channels, and apply protective fungicide.',
    },
    ph: {
      optimal: 'pH is ideal for nutrient availability. Maintain current soil amendment schedule.',
      warning: cur < cfg.optimalMin
        ? 'Slightly acidic — apply agricultural lime at 50 kg/ha to nudge pH upward.'
        : 'Slightly alkaline — incorporate elemental sulfur at 30 kg/ha or switch to acidifying NPK blends.',
      critical: cur < cfg.criticalMin
        ? 'Critically acidic soil will cause aluminium toxicity. Apply lime at 200 kg/ha urgently and retest in 48 hours.'
        : 'Critically alkaline — micronutrient lockout is imminent. Apply gypsum and acidifying amendments without delay.',
    },
  };

  return { status, trend, trendPct, avg, min, max, insights, recommendation: recs[cfg.key][status] };
}

// ─── Custom tooltip ───────────────────────────────────────────────────────────

const ChartTooltip = ({ active, payload, label, color, unit }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white shadow-2xl rounded-2xl px-4 py-3 border border-gray-100 text-sm pointer-events-none">
      <p className="text-gray-400 text-xs font-mono mb-1">{label}</p>
      <p className="font-bold text-base" style={{ color }}>
        {payload[0].value?.toFixed(2)}{unit}
      </p>
    </div>
  );
};

// ─── Sensor section ───────────────────────────────────────────────────────────

function SensorSection({ cfg, range }: { cfg: SensorConfig; range: TimeRange }) {
  const data = buildData(cfg, range);
  const analysis = analyze(cfg, data);
  const Icon = cfg.icon;

  const statusMap = {
    optimal: { label: 'Optimal', icon: <CheckCircle className="w-3.5 h-3.5" />, cls: 'text-emerald-600 bg-emerald-50' },
    warning: { label: 'Suboptimal', icon: <AlertTriangle className="w-3.5 h-3.5" />, cls: 'text-amber-600 bg-amber-50' },
    critical: { label: 'Critical', icon: <Zap className="w-3.5 h-3.5" />, cls: 'text-red-600 bg-red-50' },
  };
  const st = statusMap[analysis.status];

  const trendEl =
    analysis.trend === 'rising'
      ? <><ArrowUpRight className="w-4 h-4" /> +{Math.abs(analysis.trendPct)}%</>
      : analysis.trend === 'falling'
      ? <><ArrowDownRight className="w-4 h-4" /> {analysis.trendPct}%</>
      : <><Minus className="w-4 h-4" /> Stable</>;

  return (
    <div className="py-14">

      {/* Sensor label */}
      <div className="flex flex-col sm:flex-row sm:items-end gap-5 mb-8">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: cfg.colorLight }}
        >
          <Icon className="w-6 h-6" style={{ color: cfg.color }} />
        </div>

        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-3 mb-1.5">
            <h2 className="text-3xl font-black tracking-tight text-gray-900">{cfg.label}</h2>
            <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold', st.cls)}>
              {st.icon}{st.label}
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">
              {trendEl}
            </span>
          </div>
          <p className="text-gray-500 text-sm max-w-2xl leading-relaxed">{cfg.description}</p>
        </div>

        {/* Live value — right side */}
        <div className="text-right flex-shrink-0 sm:ml-4">
          <div className="text-5xl font-black tabular-nums" style={{ color: cfg.color }}>
            {cfg.currentValue}
            <span className="text-xl font-medium text-gray-400 ml-1">{cfg.unit}</span>
          </div>
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mt-1">Live</p>
        </div>
      </div>

      {/* Stats inline — no boxes */}
      <div className="flex flex-wrap gap-x-10 gap-y-3 mb-10">
        {[
          { l: 'Avg', v: `${analysis.avg}${cfg.unit}` },
          { l: 'Min', v: `${analysis.min}${cfg.unit}` },
          { l: 'Max', v: `${analysis.max}${cfg.unit}` },
          { l: 'Optimal', v: `${cfg.optimalMin}–${cfg.optimalMax}${cfg.unit}` },
        ].map((s, i) => (
          <div key={i}>
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-0.5">{s.l}</p>
            <p className="text-xl font-bold text-gray-700 tabular-nums">{s.v}</p>
          </div>
        ))}
      </div>

      {/* Chart — full width, borderless */}
      <div className="w-full h-[280px] sm:h-[340px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 4, left: -22, bottom: 0 }}>
            <defs>
              <linearGradient id={`g-${cfg.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={cfg.color} stopOpacity={0.2} />
                <stop offset="100%" stopColor={cfg.color} stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#f1f5f9" strokeDasharray="0" vertical={false} />
            <ReferenceLine
              y={cfg.optimalMax}
              stroke={cfg.color}
              strokeDasharray="5 4"
              strokeOpacity={0.5}
              label={{ value: `${cfg.optimalMax}${cfg.unit}`, fill: cfg.color, fontSize: 10, position: 'insideTopRight' }}
            />
            <ReferenceLine
              y={cfg.optimalMin}
              stroke={cfg.color}
              strokeDasharray="5 4"
              strokeOpacity={0.5}
              label={{ value: `${cfg.optimalMin}${cfg.unit}`, fill: cfg.color, fontSize: 10, position: 'insideBottomRight' }}
            />
            <XAxis
              dataKey="time"
              stroke="transparent"
              tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'monospace' }}
              tickLine={false}
              axisLine={false}
              interval={Math.floor(data.length / 7)}
            />
            <YAxis
              stroke="transparent"
              tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'monospace' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={v => `${v}${cfg.unit}`}
            />
            <Tooltip content={(props: any) => (
              <ChartTooltip {...props} color={cfg.color} unit={cfg.unit} />
            )} />
            <Area
              type="monotone"
              dataKey="value"
              stroke={cfg.color}
              strokeWidth={3}
              fill={`url(#g-${cfg.key})`}
              dot={false}
              activeDot={{ r: 6, fill: cfg.color, stroke: '#fff', strokeWidth: 3 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 mt-2 mb-12 pl-1">
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span className="w-5 h-0.5 rounded-full inline-block" style={{ backgroundColor: cfg.color }} />
          {cfg.label}
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span className="w-5 inline-block" style={{ borderTop: `1.5px dashed ${cfg.color}` }} />
          Optimal range
        </div>
      </div>

      {/* Analysis + Recommendation — flowing, no cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-20">

        <div>
          <div className="flex items-center gap-2 mb-5">
            <Eye className="w-4 h-4" style={{ color: cfg.color }} />
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Analysis</span>
          </div>
          <ul className="space-y-4">
            {analysis.insights.map((insight, i) => (
              <li key={i} className="flex gap-3.5 text-sm text-gray-600 leading-relaxed">
                <span
                  className="mt-2 w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: i === 2 ? cfg.color : '#e2e8f0' }}
                />
                {insight}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-5">
            <Target className="w-4 h-4" style={{ color: cfg.color }} />
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Recommendation</span>
          </div>
          <p className="text-sm text-gray-700 leading-relaxed mb-8">{analysis.recommendation}</p>

          <div className="flex flex-wrap gap-8">
            {[
              { l: 'Optimal range', v: `${cfg.optimalMin}–${cfg.optimalMax}${cfg.unit}`, highlight: true },
              { l: 'Critical low', v: `${cfg.criticalMin}${cfg.unit}`, highlight: false },
              { l: 'Critical high', v: `${cfg.criticalMax}${cfg.unit}`, highlight: false },
            ].map((item, i) => (
              <div key={i}>
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-1">{item.l}</p>
                <p
                  className="text-lg font-bold tabular-nums"
                  style={{ color: item.highlight ? cfg.color : '#ef4444' }}
                >
                  {item.v}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Flowing divider — colored fade */}
      <div
        className="mt-16 h-px w-full"
        style={{ background: `linear-gradient(to right, ${cfg.color}50, ${cfg.color}10, transparent)` }}
      />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SensorDataPage() {
  const [range, setRange] = useState<TimeRange>('24h');
  const [refreshKey, setRefreshKey] = useState(0);
  const [now, setNow] = useState(new Date());
  const ranges: TimeRange[] = ['6h', '24h', '7d', '30d'];

  const refresh = () => { setRefreshKey(k => k + 1); setNow(new Date()); };

  return (
    <div className="min-h-screen bg-white text-gray-900">

      {/* ── Sticky topbar ── */}
      <div className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-gray-100 px-6 md:px-12 h-14 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d39999]" />
          <span className="text-sm font-semibold text-gray-700">Sensor Data</span>
          <span className="text-gray-300">/</span>
          <span className="text-sm text-gray-400 hidden sm:block">Plot A — Tomatoes</span>
        </div>
        <div className="flex items-center gap-3">
          {/* Time range pills */}
          <div className="flex items-center gap-1 bg-gray-50 border border-gray-100 rounded-xl p-1">
            {ranges.map(r => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={cn(
                  'px-3.5 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all duration-150',
                  range === r ? 'bg-gray-900 text-white shadow' : 'text-gray-400 hover:text-gray-700'
                )}
              >
                {r}
              </button>
            ))}
          </div>
          <button
            onClick={refresh}
            className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 transition-all active:scale-95"
            title="Refresh data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Page content ── */}
      <div className="px-6 md:px-12 lg:px-16 max-w-[1200px] mx-auto" key={refreshKey}>

        {/* Page heading */}
        <div className="pt-14 pb-4">
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-gray-900 mb-3">
            Sensor Analytics
          </h1>
          <p className="text-gray-500 text-base max-w-xl leading-relaxed">
            Real-time readings and trend analysis across all monitored environmental parameters for Plot A.
          </p>
        </div>

        {/* Quick status strip — completely inline, no cards */}
        <div className="flex flex-wrap gap-x-8 gap-y-3 py-6 border-y border-gray-100 mb-2">
          {SENSORS.map(cfg => {
            const isOptimal = cfg.currentValue >= cfg.optimalMin && cfg.currentValue <= cfg.optimalMax;
            const isWarning = !isOptimal && cfg.currentValue >= cfg.criticalMin && cfg.currentValue <= cfg.criticalMax;
            const Icon = cfg.icon;
            return (
              <div key={cfg.key} className="flex items-center gap-2.5">
                <Icon className="w-4 h-4" style={{ color: cfg.color }} />
                <span className="text-sm text-gray-500">{cfg.label}</span>
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

        {/* All sensors flowing one after another */}
        {SENSORS.map(cfg => (
          <SensorSection key={`${cfg.key}-${refreshKey}`} cfg={cfg} range={range} />
        ))}

        <p className="pb-10 text-xs text-gray-300 text-center">
          ESP32 via Firebase · {format(now, 'PPpp')}
        </p>
      </div>
    </div>
  );
}