'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, ReferenceArea
} from 'recharts';
import {
  Thermometer, Droplets, Waves, FlaskConical, Leaf,
  TrendingUp, TrendingDown, Minus, AlertTriangle,
  CheckCircle, Info, ChevronDown, Activity, Zap,
  RefreshCw, Clock, Target, ArrowUpRight, ArrowDownRight,
  BarChart3, Eye, Cpu
} from 'lucide-react';
import clsx, { type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, subHours, subDays } from 'date-fns';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ─── Types ────────────────────────────────────────────────────────────────────

type TimeRange = '6h' | '24h' | '7d' | '30d';
type SensorKey = 'temperature' | 'humidity' | 'moisture' | 'ph';

type DataPoint = {
  time: string;
  value: number;
  min?: number;
  max?: number;
};

type SensorConfig = {
  key: SensorKey;
  label: string;
  unit: string;
  icon: React.ElementType;
  color: string;
  gradientId: string;
  accentBg: string;
  accentText: string;
  accentBorder: string;
  optimalMin: number;
  optimalMax: number;
  criticalMin: number;
  criticalMax: number;
  currentValue: number;
  description: string;
};

// ─── Mock Data ─────────────────────────────────────────────────────────────────

function generateSensorHistory(
  points: number,
  base: number,
  variance: number,
  driftFn?: (i: number, total: number) => number
): DataPoint[] {
  const now = new Date();
  return Array.from({ length: points }, (_, i) => {
    const hoursBack = points - 1 - i;
    const date = subHours(now, hoursBack);
    const drift = driftFn ? driftFn(i, points) : 0;
    const value = +(base + drift + (Math.random() - 0.5) * variance * 2).toFixed(2);
    return {
      time: format(date, points <= 24 ? 'HH:mm' : 'MMM dd'),
      value,
      min: +(value - variance * 0.6).toFixed(2),
      max: +(value + variance * 0.6).toFixed(2),
    };
  });
}

// ─── Sensor Config ─────────────────────────────────────────────────────────────

const SENSOR_CONFIGS: SensorConfig[] = [
  {
    key: 'temperature',
    label: 'Temperature',
    unit: '°C',
    icon: Thermometer,
    color: '#f59e0b',
    gradientId: 'tempGrad',
    accentBg: 'bg-amber-500/10',
    accentText: 'text-amber-400',
    accentBorder: 'border-amber-500/30',
    optimalMin: 18,
    optimalMax: 28,
    criticalMin: 10,
    criticalMax: 38,
    currentValue: 24.3,
    description:
      'Soil and ambient temperature directly impacts plant metabolic rates, nutrient uptake efficiency, and germination speed. Temperatures outside the 18–28°C range begin to inhibit enzymatic activity.',
  },
  {
    key: 'humidity',
    label: 'Humidity',
    unit: '%',
    icon: Waves,
    color: '#06b6d4',
    gradientId: 'humidGrad',
    accentBg: 'bg-cyan-500/10',
    accentText: 'text-cyan-400',
    accentBorder: 'border-cyan-500/30',
    optimalMin: 55,
    optimalMax: 80,
    criticalMin: 30,
    criticalMax: 95,
    currentValue: 68.5,
    description:
      'Relative humidity governs transpiration rates and pathogen susceptibility. Sustained levels above 85% create fungal disease conditions. Below 40% triggers stomatal closure, reducing photosynthesis.',
  },
  {
    key: 'moisture',
    label: 'Soil Moisture',
    unit: '%',
    icon: Droplets,
    color: '#3b82f6',
    gradientId: 'moistGrad',
    accentBg: 'bg-blue-500/10',
    accentText: 'text-blue-400',
    accentBorder: 'border-blue-500/30',
    optimalMin: 40,
    optimalMax: 70,
    criticalMin: 20,
    criticalMax: 85,
    currentValue: 58.2,
    description:
      'Volumetric water content in the root zone. Field capacity for loamy soil is 40–60%. Values below 25% indicate wilting point stress. Over-irrigation above 80% reduces oxygen availability for roots.',
  },
  {
    key: 'ph',
    label: 'Soil pH',
    unit: 'pH',
    icon: FlaskConical,
    color: '#a855f7',
    gradientId: 'phGrad',
    accentBg: 'bg-violet-500/10',
    accentText: 'text-violet-400',
    accentBorder: 'border-violet-500/30',
    optimalMin: 6.0,
    optimalMax: 7.0,
    criticalMin: 4.5,
    criticalMax: 8.5,
    currentValue: 6.4,
    description:
      'Soil pH controls nutrient availability and microbial activity. Most nutrients are optimally available between pH 6.0–7.0. Below 5.5 causes aluminum and manganese toxicity; above 7.5 locks out iron, zinc, and manganese.',
  },
];

// ─── Analysis Engine ───────────────────────────────────────────────────────────

type AnalysisResult = {
  status: 'optimal' | 'warning' | 'critical';
  label: string;
  trend: 'rising' | 'falling' | 'stable';
  trendPct: number;
  avgValue: number;
  minValue: number;
  maxValue: number;
  insights: string[];
  recommendation: string;
};

function analyzeData(cfg: SensorConfig, data: DataPoint[]): AnalysisResult {
  if (!data.length) {
    return {
      status: 'optimal', label: 'No data', trend: 'stable', trendPct: 0,
      avgValue: 0, minValue: 0, maxValue: 0, insights: [], recommendation: ''
    };
  }

  const values = data.map(d => d.value);
  const avgValue = +(values.reduce((a, b) => a + b, 0) / values.length).toFixed(2);
  const minValue = +Math.min(...values).toFixed(2);
  const maxValue = +Math.max(...values).toFixed(2);

  const firstHalf = values.slice(0, Math.floor(values.length / 2));
  const secondHalf = values.slice(Math.floor(values.length / 2));
  const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
  const trendPct = +((secondAvg - firstAvg) / firstAvg * 100).toFixed(1);
  const trend = trendPct > 1.5 ? 'rising' : trendPct < -1.5 ? 'falling' : 'stable';

  const cur = cfg.currentValue;
  let status: AnalysisResult['status'] = 'optimal';
  if (cur < cfg.criticalMin || cur > cfg.criticalMax) status = 'critical';
  else if (cur < cfg.optimalMin || cur > cfg.optimalMax) status = 'warning';

  const rangeSpread = +((maxValue - minValue)).toFixed(2);
  const stabilityPct = +(rangeSpread / avgValue * 100).toFixed(1);

  const insights: string[] = [];

  if (stabilityPct > 20)
    insights.push(`High variance detected — readings fluctuate ±${(rangeSpread / 2).toFixed(1)}${cfg.unit}, indicating sensor or environmental instability.`);
  else
    insights.push(`Readings are stable with low variance (±${(rangeSpread / 2).toFixed(1)}${cfg.unit}), suggesting consistent conditions.`);

  if (trend === 'rising')
    insights.push(`Upward trend of +${Math.abs(trendPct)}% observed over the period. Monitor for exceeding upper threshold of ${cfg.optimalMax}${cfg.unit}.`);
  else if (trend === 'falling')
    insights.push(`Downward trend of ${trendPct}% over the period. If decline continues, consider intervention before reaching ${cfg.optimalMin}${cfg.unit}.`);
  else
    insights.push(`Values have remained stable around ${avgValue}${cfg.unit} with no significant directional drift.`);

  if (status === 'optimal')
    insights.push(`Current value of ${cur}${cfg.unit} is within the optimal range (${cfg.optimalMin}–${cfg.optimalMax}${cfg.unit}). No immediate action required.`);
  else if (status === 'warning')
    insights.push(`Current value of ${cur}${cfg.unit} is outside the optimal range. Conditions are suboptimal but not yet critical.`);
  else
    insights.push(`⚠ Current value of ${cur}${cfg.unit} has crossed critical thresholds. Immediate intervention recommended.`);

  const label = status === 'optimal' ? 'Optimal' : status === 'warning' ? 'Suboptimal' : 'Critical';

  const recommendations: Record<SensorKey, Record<string, string>> = {
    temperature: {
      optimal: 'Maintain current ventilation and shade levels. No action needed.',
      warning: cur < cfg.optimalMin
        ? 'Temperature is below optimal. Consider activating row covers or mulching to retain soil heat.'
        : 'Temperature is above optimal. Increase ventilation, apply reflective mulch, or consider shade netting.',
      critical: cur < cfg.criticalMin
        ? 'Frost risk is high. Apply emergency frost protection immediately and activate heating systems.'
        : 'Heat stress threshold exceeded. Activate emergency cooling, increase irrigation frequency.',
    },
    humidity: {
      optimal: 'Humidity levels support healthy transpiration. Maintain current airflow.',
      warning: cur > cfg.optimalMax
        ? 'High humidity increases fungal disease risk. Improve air circulation and reduce irrigation frequency.'
        : 'Low humidity may cause increased transpiration stress. Consider misting or shade cloth.',
      critical: cur > cfg.criticalMax
        ? 'Critically high humidity — immediate fungicide application and ventilation required.'
        : 'Critically low humidity. Activate emergency misting systems and shade structures.',
    },
    moisture: {
      optimal: 'Soil moisture is at field capacity. Maintain current irrigation schedule.',
      warning: cur < cfg.optimalMin
        ? 'Soil moisture is declining. Schedule irrigation within the next 12 hours.'
        : 'Over-irrigation risk. Skip next scheduled irrigation and monitor drainage.',
      critical: cur < cfg.criticalMin
        ? 'Plants are approaching wilting point. Begin emergency irrigation immediately.'
        : 'Waterlogged conditions. Stop irrigation, check drainage systems, and apply fungicide.',
    },
    ph: {
      optimal: 'pH is in the ideal range for nutrient absorption. Maintain current amendment schedule.',
      warning: cur < cfg.optimalMin
        ? 'Slightly acidic soil. Apply lime (calcium carbonate) at 50 kg/ha to raise pH.'
        : 'Slightly alkaline soil. Apply sulfur at 30 kg/ha or use acidifying fertilizers.',
      critical: cur < cfg.criticalMin
        ? 'Critically low pH causes aluminum toxicity. Apply agricultural lime at 200 kg/ha urgently.'
        : 'Critically high pH locks out micronutrients. Apply gypsum and acidifying amendments immediately.',
    },
  };

  const recommendation = recommendations[cfg.key][status];

  return { status, label, trend, trendPct, avgValue, minValue, maxValue, insights, recommendation };
}

// ─── Custom Tooltip ────────────────────────────────────────────────────────────

const CustomTooltip = ({
  active, payload, label, unit, color
}: {
  active?: boolean; payload?: any[]; label?: string; unit: string; color: string;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 shadow-2xl text-sm">
      <p className="text-slate-400 mb-1 text-xs font-mono">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="font-semibold" style={{ color: p.color || color }}>
          {p.name}: {typeof p.value === 'number' ? p.value.toFixed(2) : p.value}{unit}
        </p>
      ))}
    </div>
  );
};

// ─── Stat Badge ────────────────────────────────────────────────────────────────

const StatBadge = ({
  label, value, unit, sub, colorClass
}: {
  label: string; value: string | number; unit?: string; sub?: string; colorClass: string;
}) => (
  <div className="flex flex-col gap-0.5">
    <span className="text-xs text-slate-500 uppercase tracking-widest font-medium">{label}</span>
    <span className={cn("text-2xl font-bold font-mono tabular-nums", colorClass)}>
      {value}<span className="text-sm font-normal text-slate-400 ml-0.5">{unit}</span>
    </span>
    {sub && <span className="text-xs text-slate-500">{sub}</span>}
  </div>
);

// ─── Trend Indicator ──────────────────────────────────────────────────────────

const TrendBadge = ({ trend, pct }: { trend: 'rising' | 'falling' | 'stable'; pct: number }) => {
  const map = {
    rising: { Icon: ArrowUpRight, color: 'text-rose-400 bg-rose-500/10 border-rose-500/20', label: `+${Math.abs(pct)}%` },
    falling: { Icon: ArrowDownRight, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', label: `${pct}%` },
    stable: { Icon: Minus, color: 'text-slate-400 bg-slate-700/50 border-slate-600/30', label: `~${Math.abs(pct)}%` },
  };
  const { Icon, color, label } = map[trend];
  return (
    <span className={cn("inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border", color)}>
      <Icon className="w-3.5 h-3.5" />
      {label}
    </span>
  );
};

// ─── Status Badge ─────────────────────────────────────────────────────────────

const StatusBadge = ({ status }: { status: 'optimal' | 'warning' | 'critical' }) => {
  const map = {
    optimal: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    warning: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    critical: 'bg-red-500/10 text-red-400 border-red-500/20',
  };
  const icons = {
    optimal: <CheckCircle className="w-3.5 h-3.5" />,
    warning: <AlertTriangle className="w-3.5 h-3.5" />,
    critical: <Zap className="w-3.5 h-3.5" />,
  };
  const labels = { optimal: 'Optimal', warning: 'Suboptimal', critical: 'Critical' };
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border", map[status])}>
      {icons[status]}
      {labels[status]}
    </span>
  );
};

// ─── Individual Sensor Section ────────────────────────────────────────────────

type SensorSectionProps = {
  cfg: SensorConfig;
  timeRange: TimeRange;
};

function SensorSection({ cfg, timeRange }: SensorSectionProps) {
  const points = timeRange === '6h' ? 24 : timeRange === '24h' ? 48 : timeRange === '7d' ? 84 : 120;

  const driftMap: Record<SensorKey, (i: number, t: number) => number> = {
    temperature: (i, t) => Math.sin((i / t) * Math.PI * 2) * 3,
    humidity: (i, t) => -Math.sin((i / t) * Math.PI) * 8,
    moisture: (i, t) => -((i / t) * 15),
    ph: (i, t) => Math.cos((i / t) * Math.PI) * 0.3,
  };

  const data = generateSensorHistory(points, cfg.currentValue, cfg.key === 'ph' ? 0.3 : 5, driftMap[cfg.key]);
  const analysis = analyzeData(cfg, data);
  const Icon = cfg.icon;

  return (
    <section className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
      {/* Section Header */}
      <div className={cn("p-4 md:p-6 border-b border-slate-800/80", cfg.accentBg)}>
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          <div className="flex items-center gap-4 flex-1">
            <div className={cn(
              "w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 border",
              cfg.accentBg, cfg.accentBorder
            )}>
              <Icon className={cn("w-6 h-6", cfg.accentText)} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-100 tracking-tight">{cfg.label}</h2>
              <p className="text-sm text-slate-400 mt-0.5 max-w-xl">{cfg.description}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 sm:flex-shrink-0">
            <StatusBadge status={analysis.status} />
            <TrendBadge trend={analysis.trend} pct={analysis.trendPct} />
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-slate-800">
        {[
          { label: 'Current', value: cfg.currentValue, unit: cfg.unit, sub: 'Live reading' },
          { label: 'Average', value: analysis.avgValue, unit: cfg.unit, sub: 'Over period' },
          { label: 'Min', value: analysis.minValue, unit: cfg.unit, sub: 'Lowest recorded' },
          { label: 'Max', value: analysis.maxValue, unit: cfg.unit, sub: 'Peak recorded' },
        ].map((s, i) => (
          <div key={i} className="bg-slate-900 p-4 md:p-5">
            <StatBadge
              label={s.label}
              value={s.value}
              unit={s.unit}
              sub={s.sub}
              colorClass={i === 0 ? cfg.accentText : 'text-slate-200'}
            />
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="p-4 md:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Activity className="w-4 h-4" style={{ color: cfg.color }} />
            <span>Historical trend — <span className="text-slate-300 font-medium">{timeRange.toUpperCase()} view</span></span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <span className="w-3 h-0.5 rounded" style={{ backgroundColor: cfg.color }} />
              {cfg.label}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-0.5 rounded bg-emerald-500/50 border-dashed" style={{ borderTop: '1px dashed #10b981' }} />
              Optimal range
            </span>
          </div>
        </div>

        <div className="h-[280px] sm:h-[320px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id={cfg.gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={cfg.color} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={cfg.color} stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id={`${cfg.gradientId}Opt`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.06} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0.06} />
                </linearGradient>
              </defs>
              <ReferenceArea
                y1={cfg.optimalMin}
                y2={cfg.optimalMax}
                fill="url(#${cfg.gradientId}Opt)"
                fillOpacity={1}
                stroke="#10b981"
                strokeOpacity={0.2}
                strokeDasharray="4 4"
              />
              <ReferenceLine
                y={cfg.optimalMax}
                stroke="#10b981"
                strokeDasharray="4 4"
                strokeOpacity={0.5}
                label={{ value: `${cfg.optimalMax}${cfg.unit}`, fill: '#10b981', fontSize: 10, position: 'insideTopRight' }}
              />
              <ReferenceLine
                y={cfg.optimalMin}
                stroke="#10b981"
                strokeDasharray="4 4"
                strokeOpacity={0.5}
                label={{ value: `${cfg.optimalMin}${cfg.unit}`, fill: '#10b981', fontSize: 10, position: 'insideBottomRight' }}
              />
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis
                dataKey="time"
                stroke="#1e293b"
                tick={{ fill: '#64748b', fontSize: 11, fontFamily: 'monospace' }}
                tickLine={false}
                axisLine={false}
                interval={Math.floor(points / 8)}
              />
              <YAxis
                stroke="#1e293b"
                tick={{ fill: '#64748b', fontSize: 11, fontFamily: 'monospace' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${v}${cfg.unit}`}
              />
              <Tooltip content={<CustomTooltip unit={cfg.unit} color={cfg.color} />} />
              <Area
                type="monotone"
                dataKey="value"
                name={cfg.label}
                stroke={cfg.color}
                strokeWidth={2.5}
                fill={`url(#${cfg.gradientId})`}
                dot={false}
                activeDot={{ r: 5, fill: cfg.color, strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Analysis Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-px bg-slate-800 border-t border-slate-800">
        {/* Key Insights */}
        <div className="bg-slate-900 p-4 md:p-6">
          <div className="flex items-center gap-2 mb-4">
            <Eye className="w-4 h-4 text-slate-400" />
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Analysis</h3>
          </div>
          <ul className="space-y-3">
            {analysis.insights.map((insight, i) => (
              <li key={i} className="flex gap-3 text-sm text-slate-400 leading-relaxed">
                <span
                  className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: i === 2 ? cfg.color : '#475569' }}
                />
                {insight}
              </li>
            ))}
          </ul>
        </div>

        {/* Recommendation */}
        <div className="bg-slate-900 p-4 md:p-6">
          <div className="flex items-center gap-2 mb-4">
            <Target className="w-4 h-4 text-slate-400" />
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Recommendation</h3>
          </div>
          <div className={cn("p-4 rounded-xl border text-sm leading-relaxed", cfg.accentBg, cfg.accentBorder)}>
            <p className={cn("font-medium mb-2", cfg.accentText)}>Action required:</p>
            <p className="text-slate-300">{analysis.recommendation}</p>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
            <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/50">
              <p className="text-slate-500 mb-1">Optimal range</p>
              <p className="text-slate-200 font-semibold font-mono">
                {cfg.optimalMin} – {cfg.optimalMax}<span className="text-slate-500 font-normal ml-0.5">{cfg.unit}</span>
              </p>
            </div>
            <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/50">
              <p className="text-slate-500 mb-1">Critical thresholds</p>
              <p className="text-slate-200 font-semibold font-mono">
                {cfg.criticalMin} / {cfg.criticalMax}<span className="text-slate-500 font-normal ml-0.5">{cfg.unit}</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Overview Summary Bar ─────────────────────────────────────────────────────

function OverviewBar({ configs, timeRange, setTimeRange }: {
  configs: SensorConfig[];
  timeRange: TimeRange;
  setTimeRange: (r: TimeRange) => void;
}) {
  const ranges: TimeRange[] = ['6h', '24h', '7d', '30d'];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 md:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight">Sensor Analytics</h1>
          <p className="text-sm text-slate-400 mt-1">Full historical data and analysis for all monitored parameters</p>
        </div>
        <div className="flex items-center gap-1.5 bg-slate-800 rounded-xl p-1 border border-slate-700">
          {ranges.map(r => (
            <button
              key={r}
              onClick={() => setTimeRange(r)}
              className={cn(
                "px-3.5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-150",
                timeRange === r
                  ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-700"
              )}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {configs.map(cfg => {
          const Icon = cfg.icon;
          const isOptimal = cfg.currentValue >= cfg.optimalMin && cfg.currentValue <= cfg.optimalMax;
          const isWarning = !isOptimal && cfg.currentValue >= cfg.criticalMin && cfg.currentValue <= cfg.criticalMax;

          return (
            <div
              key={cfg.key}
              className={cn(
                "flex items-center gap-3 p-3.5 rounded-xl border transition-all",
                isOptimal ? "bg-slate-800/60 border-slate-700/50" : isWarning ? "bg-amber-500/5 border-amber-500/20" : "bg-red-500/5 border-red-500/20"
              )}
            >
              <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0", cfg.accentBg)}>
                <Icon className={cn("w-4.5 h-4.5 w-5 h-5", cfg.accentText)} />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-slate-500 truncate">{cfg.label}</p>
                <p className="text-lg font-bold font-mono tabular-nums text-slate-100">
                  {cfg.currentValue}<span className="text-xs text-slate-400 font-normal ml-0.5">{cfg.unit}</span>
                </p>
              </div>
              <div className="ml-auto">
                {isOptimal
                  ? <CheckCircle className="w-4 h-4 text-emerald-400" />
                  : isWarning
                    ? <AlertTriangle className="w-4 h-4 text-amber-400" />
                    : <Zap className="w-4 h-4 text-red-400" />}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SensorDataPage() {
  const [timeRange, setTimeRange] = useState<TimeRange>('24h');
  const [refreshKey, setRefreshKey] = useState(0);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  const refresh = () => {
    setRefreshKey(k => k + 1);
    setLastUpdated(new Date());
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Topbar */}
      <div className="sticky top-0 z-30 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80 px-4 md:px-8 h-14 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Cpu className="w-5 h-5 text-emerald-400" />
          <span className="text-sm font-semibold text-slate-300">Sensor Data</span>
          <span className="hidden sm:block text-slate-700">/</span>
          <span className="hidden sm:block text-xs text-slate-500">Plot A — Tomatoes</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500">
            <Clock className="w-3.5 h-3.5" />
            {format(lastUpdated, 'HH:mm:ss')}
          </span>
          <button
            onClick={refresh}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-300 hover:bg-slate-700 transition-all active:scale-95"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 md:p-6 lg:p-8 max-w-[1400px] mx-auto space-y-6 md:space-y-8" key={refreshKey}>
        <OverviewBar configs={SENSOR_CONFIGS} timeRange={timeRange} setTimeRange={setTimeRange} />

        {SENSOR_CONFIGS.map(cfg => (
          <SensorSection key={cfg.key} cfg={cfg} timeRange={timeRange} />
        ))}

        {/* Footer note */}
        <div className="flex items-center justify-center gap-2 py-4 text-xs text-slate-600">
          <Info className="w-3.5 h-3.5" />
          <span>Data sourced from ESP32 sensors via Firebase Realtime Database. Graphs show synthetic historical data for demonstration.</span>
        </div>
      </div>
    </div>
  );
}