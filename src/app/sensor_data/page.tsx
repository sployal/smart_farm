'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';
import {
  Thermometer, Droplets, Waves, FlaskConical,
  CheckCircle, AlertTriangle, Zap, RefreshCw,
  ArrowUpRight, ArrowDownRight, Minus, Target, Eye, Menu,
  Activity, TrendingUp, TrendingDown, Wifi, WifiOff,
  ChevronRight, Info, Shield, BarChart2
} from 'lucide-react';
import { format } from 'date-fns';
import clsx, { type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { startRealtimeUpdates, fetchSensorData, fetchHistoricalData, type HistoricalDataPoint } from '@/lib/firebase';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type TimeRange = '6h' | '24h' | '7d' | '30d';
type SensorKey = 'temperature' | 'humidity' | 'moisture' | 'ph';
type DataPoint = { time: string; value: number };

type SensorConfig = {
  key: SensorKey;
  label: string;
  unit: string;
  icon: React.ElementType;
  color: string;
  colorDim: string;
  optimalMin: number;
  optimalMax: number;
  criticalMin: number;
  criticalMax: number;
  currentValue: number;
  description: string;
};

const SENSOR_BASES = [
  {
    key: 'temperature' as SensorKey,
    label: 'Temperature',
    unit: '°C',
    icon: Thermometer,
    color: '#f97316',
    colorDim: '#f9731608',
    optimalMin: 18, optimalMax: 28,
    criticalMin: 10, criticalMax: 38,
    description:
      'Air and soil temperature drives metabolic rates, enzymatic activity, and nutrient uptake. Consistent temperatures between 18–28°C support vigorous growth and fruit development.',
  },
  {
    key: 'humidity' as SensorKey,
    label: 'Relative Humidity',
    unit: '%',
    icon: Waves,
    color: '#06b6d4',
    colorDim: '#06b6d408',
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
    color: '#3b82f6',
    colorDim: '#3b82f608',
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
    color: '#a78bfa',
    colorDim: '#a78bfa08',
    optimalMin: 6.0, optimalMax: 7.0,
    criticalMin: 4.5, criticalMax: 8.5,
    description:
      'Soil pH governs nutrient solubility and microbial activity. Most macronutrients are available at pH 6–7. Below 5.5 causes aluminium toxicity; above 7.5 locks out iron and manganese.',
  },
];

function processHistoricalData(
  historyData: HistoricalDataPoint[],
  key: SensorKey,
  range: TimeRange
): DataPoint[] {
  if (historyData.length === 0) return [];
  const keyMap: Record<SensorKey, keyof HistoricalDataPoint> = {
    temperature: 'temperature',
    humidity: 'humidity',
    moisture: 'soilMoisture',
    ph: 'temperature',
  };
  const dataKey = keyMap[key];
  return historyData.map(item => ({
    time: format(new Date(item.timestamp * 1000), range === '6h' || range === '24h' ? 'HH:mm' : 'MMM d'),
    value: key === 'ph' ? 6.5 : +(item[dataKey] || 0).toFixed(2),
  }));
}

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

// ── Custom Tooltip ─────────────────────────────────────────────────────────────
const ChartTooltip = ({ active, payload, label, color, unit }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="border rounded-xl px-4 py-3 shadow-2xl text-sm pointer-events-none"
      style={{ background: 'rgba(15,24,36,0.95)', backdropFilter: 'blur(12px)', borderColor: 'rgba(71,85,105,0.5)' }}>
      <p className="text-slate-400 text-[11px] font-mono mb-1.5 uppercase tracking-wider">{label}</p>
      <p className="font-black text-xl tabular-nums" style={{ color }}>
        {payload[0].value?.toFixed(2)}<span className="text-sm font-medium text-slate-400 ml-1">{unit}</span>
      </p>
    </div>
  );
};

// ── Sparkline for status strip ─────────────────────────────────────────────────
const TinySparkline = ({ data, color }: { data: DataPoint[]; color: string }) => (
  <ResponsiveContainer width={80} height={32}>
    <AreaChart data={data.slice(-12)}>
      <defs>
        <linearGradient id={`spark-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.3} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <Area type="monotone" dataKey="value" stroke={color} strokeWidth={1.5}
        fill={`url(#spark-${color.replace('#', '')})`} dot={false} isAnimationActive={false} />
    </AreaChart>
  </ResponsiveContainer>
);

// ── Sensor Section ─────────────────────────────────────────────────────────────
function SensorSection({ cfg, range }: { cfg: SensorConfig; range: TimeRange }) {
  const [data, setData] = useState<DataPoint[]>([]);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const hoursMap: Record<TimeRange, number> = { '6h': 6, '24h': 24, '7d': 168, '30d': 720 };
      const historyData = await fetchHistoricalData(hoursMap[range]);
      const chartData = processHistoricalData(historyData, cfg.key, range);
      const finalData = chartData.length > 0 ? chartData : [{ time: format(new Date(), 'HH:mm'), value: cfg.currentValue }];
      setData(finalData);
      setAnalysis(analyze(cfg, finalData));
      setLoading(false);
    };
    loadData();
  }, [cfg.key, cfg.currentValue, range]);

  if (!analysis || loading) {
    return (
      <div className="py-16 flex items-center justify-center gap-3">
        <div className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: `${cfg.color}40`, borderTopColor: cfg.color }} />
        <span className="text-slate-400 text-sm font-medium">Loading {cfg.label} data...</span>
      </div>
    );
  }

  const Icon = cfg.icon;

  const statusConfig = {
    optimal: {
      label: 'Optimal', badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25',
      glow: 'rgba(16,185,129,0.06)', icon: CheckCircle, dot: 'bg-emerald-400'
    },
    warning: {
      label: 'Suboptimal', badge: 'bg-amber-500/10 text-amber-400 border-amber-500/25',
      glow: 'rgba(245,158,11,0.06)', icon: AlertTriangle, dot: 'bg-amber-400'
    },
    critical: {
      label: 'Critical', badge: 'bg-red-500/10 text-red-400 border-red-500/25',
      glow: 'rgba(239,68,68,0.08)', icon: Zap, dot: 'bg-red-400'
    },
  };
  const st = statusConfig[analysis.status];
  const StatusIcon = st.icon;

  const trendInfo = {
    rising:  { icon: ArrowUpRight, label: `+${Math.abs(analysis.trendPct)}%`, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
    falling: { icon: ArrowDownRight, label: `${analysis.trendPct}%`, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
    stable:  { icon: Minus, label: 'Stable', color: 'text-slate-400', bg: 'bg-slate-500/10 border-slate-500/20' },
  }[analysis.trend];
  const TrendIcon = trendInfo.icon;

  // Gauge bar percentage
  const range_span = cfg.criticalMax - cfg.criticalMin;
  const val_pct = Math.min(100, Math.max(0, ((cfg.currentValue - cfg.criticalMin) / range_span) * 100));
  const opt_min_pct = ((cfg.optimalMin - cfg.criticalMin) / range_span) * 100;
  const opt_max_pct = ((cfg.optimalMax - cfg.criticalMin) / range_span) * 100;

  return (
    <div className="py-12 relative">
      {/* Ambient glow for this sensor */}
      <div className="absolute top-0 right-0 w-[500px] h-[300px] pointer-events-none"
        style={{ background: `radial-gradient(ellipse at top right, ${cfg.color}05 0%, transparent 70%)` }} />

      {/* ── Card wrapper ── */}
      <div className="relative rounded-2xl overflow-hidden border"
        style={{ background: 'rgba(22,32,46,0.6)', backdropFilter: 'blur(12px)', borderColor: 'rgba(71,85,105,0.3)' }}>

        {/* Colored top accent line */}
        <div className="h-0.5 w-full" style={{ background: `linear-gradient(90deg, ${cfg.color}, ${cfg.color}40, transparent)` }} />

        <div className="p-6 md:p-8">

          {/* ── Header ── */}
          <div className="flex flex-col sm:flex-row sm:items-start gap-5 mb-8">
            {/* Icon */}
            <div className="relative flex-shrink-0">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{ background: `${cfg.color}12`, border: `1px solid ${cfg.color}25`, boxShadow: `0 0 30px ${cfg.color}10` }}>
                <Icon className="w-7 h-7" style={{ color: cfg.color }} />
              </div>
              {/* Status dot */}
              <span className={cn("absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 animate-pulse", st.dot)}
                style={{ borderColor: '#0f1824' }} />
            </div>

            {/* Labels */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2.5 mb-2">
                <h2 className="text-2xl font-black tracking-tight text-slate-100"
                  style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{cfg.label}</h2>
                <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border', st.badge)}>
                  <StatusIcon className="w-3 h-3" />{st.label}
                </span>
                <span className={cn("inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border", trendInfo.bg, trendInfo.color)}>
                  <TrendIcon className="w-3.5 h-3.5" />{trendInfo.label}
                </span>
              </div>
              <p className="text-slate-400 text-sm leading-relaxed max-w-2xl">{cfg.description}</p>
            </div>

            {/* Live value */}
            <div className="flex-shrink-0 sm:text-right">
              <div className="stat-number text-5xl font-black tabular-nums leading-none" style={{ color: cfg.color }}>
                {cfg.currentValue}
                <span className="text-lg font-medium text-slate-400 ml-1">{cfg.unit}</span>
              </div>
              <div className="flex sm:justify-end items-center gap-1.5 mt-2">
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: cfg.color }} />
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest">Live Reading</span>
              </div>
            </div>
          </div>

          {/* ── Gauge bar ── */}
          <div className="mb-8">
            <div className="flex justify-between text-[11px] text-slate-500 mb-2 font-mono">
              <span>Critical Low {cfg.criticalMin}{cfg.unit}</span>
              <span>Optimal {cfg.optimalMin}–{cfg.optimalMax}{cfg.unit}</span>
              <span>Critical High {cfg.criticalMax}{cfg.unit}</span>
            </div>
            <div className="relative h-3 rounded-full overflow-visible" style={{ background: 'rgba(15,24,36,0.8)' }}>
              {/* Optimal zone highlight */}
              <div className="absolute top-0 bottom-0 rounded-full opacity-20"
                style={{ left: `${opt_min_pct}%`, width: `${opt_max_pct - opt_min_pct}%`, backgroundColor: cfg.color }} />
              {/* Optimal zone border */}
              <div className="absolute top-0 bottom-0 border-l border-r border-dashed"
                style={{ left: `${opt_min_pct}%`, width: `${opt_max_pct - opt_min_pct}%`, borderColor: `${cfg.color}50` }} />
              {/* Value indicator */}
              <div className="absolute top-1/2 -translate-y-1/2 w-5 h-5 rounded-full border-2 border-white shadow-lg transition-all duration-700 -translate-x-1/2"
                style={{ left: `${val_pct}%`, backgroundColor: cfg.color, boxShadow: `0 0 12px ${cfg.color}60` }} />
              {/* Track fill */}
              <div className="h-full rounded-full transition-all duration-700 opacity-40"
                style={{ width: `${val_pct}%`, background: `linear-gradient(90deg, ${cfg.color}60, ${cfg.color})` }} />
            </div>
          </div>

          {/* ── Stats strip ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
            {[
              { l: 'Average', v: `${analysis.avg}${cfg.unit}`, sub: `${range} mean` },
              { l: 'Minimum', v: `${analysis.min}${cfg.unit}`, sub: 'period low' },
              { l: 'Maximum', v: `${analysis.max}${cfg.unit}`, sub: 'period high' },
              { l: 'Optimal Band', v: `${cfg.optimalMin}–${cfg.optimalMax}`, sub: cfg.unit },
            ].map((s, i) => (
              <div key={i} className="rounded-xl p-3.5 border"
                style={{ background: 'rgba(15,24,36,0.5)', borderColor: 'rgba(71,85,105,0.2)' }}>
                <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-1">{s.l}</div>
                <div className="stat-number text-lg font-black text-slate-100">{s.v}</div>
                <div className="text-[11px] text-slate-500 mt-0.5">{s.sub}</div>
              </div>
            ))}
          </div>

          {/* ── Chart ── */}
          <div className="w-full h-[260px] sm:h-[320px] mb-3">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id={`grad-${cfg.key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={cfg.color} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={cfg.color} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(71,85,105,0.2)" strokeDasharray="0" vertical={false} />
                <ReferenceLine y={cfg.optimalMax} stroke={cfg.color} strokeDasharray="4 4" strokeOpacity={0.5}
                  label={{ value: `↑ ${cfg.optimalMax}${cfg.unit}`, fill: cfg.color, fontSize: 10, position: 'insideTopRight', opacity: 0.7 }} />
                <ReferenceLine y={cfg.optimalMin} stroke={cfg.color} strokeDasharray="4 4" strokeOpacity={0.5}
                  label={{ value: `↓ ${cfg.optimalMin}${cfg.unit}`, fill: cfg.color, fontSize: 10, position: 'insideBottomRight', opacity: 0.7 }} />
                <XAxis dataKey="time" stroke="transparent"
                  tick={{ fill: '#64748b', fontSize: 11, fontFamily: 'monospace' }}
                  tickLine={false} axisLine={false}
                  interval={Math.floor(data.length / 7)} />
                <YAxis stroke="transparent"
                  tick={{ fill: '#64748b', fontSize: 11, fontFamily: 'monospace' }}
                  tickLine={false} axisLine={false}
                  tickFormatter={v => `${v}${cfg.unit}`} />
                <Tooltip content={(props: any) => <ChartTooltip {...props} color={cfg.color} unit={cfg.unit} />} />
                <Area type="monotone" dataKey="value" stroke={cfg.color} strokeWidth={2.5}
                  fill={`url(#grad-${cfg.key})`} dot={false} isAnimationActive={false}
                  activeDot={{ r: 5, fill: cfg.color, stroke: '#0f1824', strokeWidth: 3 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Chart legend */}
          <div className="flex items-center gap-6 mb-8 pl-1">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="w-6 h-0.5 rounded-full" style={{ backgroundColor: cfg.color }} />
              {cfg.label}
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="w-6 inline-block" style={{ borderTop: `1.5px dashed ${cfg.color}80` }} />
              Optimal range
            </div>
          </div>

          {/* ── Analysis + Recommendation ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Analysis */}
            <div className="rounded-2xl p-5 border"
              style={{ background: 'rgba(15,24,36,0.5)', borderColor: 'rgba(71,85,105,0.2)' }}>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{ background: `${cfg.color}15`, border: `1px solid ${cfg.color}25` }}>
                  <Eye className="w-3.5 h-3.5" style={{ color: cfg.color }} />
                </div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Analysis</span>
              </div>
              <ul className="space-y-3.5">
                {analysis.insights.map((insight, i) => (
                  <li key={i} className="flex gap-3 text-sm text-slate-300 leading-relaxed">
                    <span className="mt-2 w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: i === 2 ? cfg.color : 'rgba(71,85,105,0.6)' }} />
                    {insight}
                  </li>
                ))}
              </ul>
            </div>

            {/* Recommendation */}
            <div className="rounded-2xl p-5 border"
              style={{ background: 'rgba(15,24,36,0.5)', borderColor: 'rgba(71,85,105,0.2)' }}>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{ background: `${cfg.color}15`, border: `1px solid ${cfg.color}25` }}>
                  <Target className="w-3.5 h-3.5" style={{ color: cfg.color }} />
                </div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Recommendation</span>
              </div>
              <p className="text-sm text-slate-200 leading-relaxed mb-5">{analysis.recommendation}</p>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { l: 'Optimal', v: `${cfg.optimalMin}–${cfg.optimalMax}${cfg.unit}`, c: cfg.color },
                  { l: 'Crit. Low', v: `${cfg.criticalMin}${cfg.unit}`, c: '#f87171' },
                  { l: 'Crit. High', v: `${cfg.criticalMax}${cfg.unit}`, c: '#f87171' },
                ].map((item, i) => (
                  <div key={i} className="rounded-xl p-2.5 text-center border"
                    style={{ background: 'rgba(15,24,36,0.6)', borderColor: 'rgba(71,85,105,0.2)' }}>
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">{item.l}</div>
                    <div className="text-sm font-black tabular-nums" style={{ color: item.c }}>{item.v}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Divider between sensors */}
      <div className="mt-10 h-px mx-4"
        style={{ background: `linear-gradient(to right, transparent, ${cfg.color}20, rgba(71,85,105,0.2), transparent)` }} />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function SensorDataPage() {
  const router = useRouter();
  const [range, setRange] = useState<TimeRange>('24h');
  const [refreshKey, setRefreshKey] = useState(0);
  const [now, setNow] = useState(new Date());
  const [isConnected, setIsConnected] = useState(false);
  const [lastSync, setLastSync] = useState('—');
  const [sensorData, setSensorData] = useState<Record<SensorKey, DataPoint[]>>({
    temperature: [], humidity: [], moisture: [], ph: [],
  });

  const [liveValues, setLiveValues] = useState<Record<SensorKey, number>>({
    temperature: 0, humidity: 0, moisture: 0, ph: 6.5,
  });

  const ranges: TimeRange[] = ['6h', '24h', '7d', '30d'];

  useEffect(() => {
    fetchSensorData().then((data: any) => {
      setLiveValues(prev => ({
        ...prev,
        temperature: parseFloat(data.temperature?.toString() || prev.temperature.toString()),
        humidity: parseFloat(data.humidity?.toString() || prev.humidity.toString()),
        moisture: parseFloat(data.moisture?.toString() || prev.moisture.toString()),
      }));
      setIsConnected(true);
      setLastSync(format(new Date(), 'HH:mm:ss'));
    }).catch(() => setIsConnected(false));

    const unsubscribe = startRealtimeUpdates((data: any) => {
      setLiveValues(prev => ({
        ...prev,
        temperature: parseFloat(data.temperature?.toString() || prev.temperature.toString()),
        humidity: parseFloat(data.humidity?.toString() || prev.humidity.toString()),
        moisture: parseFloat(data.moisture?.toString() || prev.moisture.toString()),
      }));
      setIsConnected(true);
      setLastSync(format(new Date(), 'HH:mm:ss'));
      setNow(new Date());
    });

    return () => unsubscribe();
  }, []);

  const refresh = () => { setRefreshKey(k => k + 1); setNow(new Date()); };

  const SENSORS: SensorConfig[] = SENSOR_BASES.map(base => ({
    ...base,
    currentValue: liveValues[base.key],
  }));

  return (
    <div className="min-h-screen text-slate-100" style={{ background: '#0f1824', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&family=Space+Grotesk:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: #1e293b; }
        ::-webkit-scrollbar-thumb { background: #334155; border-radius: 2px; }
        .stat-number { font-family: 'Space Grotesk', monospace; }
        .section-title { font-family: 'Space Grotesk', sans-serif; }
      `}</style>

      {/* Ambient blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-60 right-0 w-[700px] h-[700px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.03) 0%, transparent 70%)' }} />
        <div className="absolute top-1/3 -left-40 w-[500px] h-[500px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.025) 0%, transparent 70%)' }} />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(167,139,250,0.025) 0%, transparent 70%)' }} />
      </div>

      {/* ── Topbar ── */}
      <header className="relative z-40 sticky top-0 h-14 border-b flex items-center justify-between px-5 md:px-8 gap-4"
        style={{ background: 'rgba(15,24,36,0.85)', backdropFilter: 'blur(20px)', borderColor: 'rgba(71,85,105,0.3)' }}>

        <div className="flex items-center gap-3">
          <button onClick={() => document.dispatchEvent(new CustomEvent('toggleMobileMenu'))}
            className="lg:hidden p-2 rounded-lg hover:bg-slate-800 text-slate-400 transition-colors">
            <Menu className="w-5 h-5" />
          </button>

          {/* Connection status */}
          <div className={cn("flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all",
            isConnected
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
              : "bg-red-500/10 border-red-500/30 text-red-400")}>
            <span className="relative flex h-2 w-2">
              <span className={cn("animate-ping absolute inline-flex h-full w-full rounded-full opacity-75", isConnected ? "bg-emerald-400" : "bg-red-400")} />
              <span className={cn("relative inline-flex rounded-full h-2 w-2", isConnected ? "bg-emerald-400" : "bg-red-400")} />
            </span>
            <span>{isConnected ? 'Live' : 'Offline'}</span>
          </div>

          <div className="hidden sm:flex items-center gap-2 text-sm text-slate-400">
            <span className="text-slate-600">/</span>
            <span className="font-medium text-slate-300">Sensor Analytics</span>
            {lastSync !== '—' && (
              <span className="hidden md:block text-[11px] text-slate-500 font-mono">· {lastSync}</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Time range selector */}
          <div className="flex items-center gap-1 rounded-xl p-1 border"
            style={{ background: 'rgba(15,24,36,0.8)', borderColor: 'rgba(71,85,105,0.3)' }}>
            {ranges.map(r => (
              <button key={r} onClick={() => setRange(r)}
                className={cn("px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all",
                  range === r
                    ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800")}>
                {r}
              </button>
            ))}
          </div>
          <button onClick={refresh}
            className="p-2.5 rounded-xl border hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-all active:scale-95"
            style={{ borderColor: 'rgba(71,85,105,0.3)', background: 'rgba(15,24,36,0.5)' }}>
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* ── Main content ── */}
      <div className="relative z-10 px-5 md:px-8 lg:px-12 max-w-[1280px] mx-auto" key={refreshKey}>

        {/* Page heading */}
        <div className="pt-12 pb-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              LIVE SENSORS
            </span>
            <span className="text-xs text-slate-500">Plot A — Tomatoes · ESP32-Node1</span>
          </div>
          <h1 className="section-title text-4xl md:text-5xl font-black tracking-tight text-slate-100 mb-3">
            Sensor Analytics
          </h1>
          <p className="text-slate-400 text-base max-w-xl leading-relaxed">
            Real-time readings and historical trend analysis across all monitored environmental parameters.
          </p>
        </div>

        {/* ── Quick status strip ── */}
        <div className="rounded-2xl border p-4 mb-2"
          style={{ background: 'rgba(22,32,46,0.6)', backdropFilter: 'blur(12px)', borderColor: 'rgba(71,85,105,0.3)' }}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {SENSORS.map(cfg => {
              const isOptimal = cfg.currentValue >= cfg.optimalMin && cfg.currentValue <= cfg.optimalMax;
              const isCritical = cfg.currentValue < cfg.criticalMin || cfg.currentValue > cfg.criticalMax;
              const Icon = cfg.icon;
              const StatusIc = isCritical ? Zap : isOptimal ? CheckCircle : AlertTriangle;
              const statusColor = isCritical ? '#f87171' : isOptimal ? '#34d399' : '#fbbf24';
              return (
                <div key={cfg.key} className="flex items-center gap-3 p-3 rounded-xl border transition-all hover:scale-[1.01]"
                  style={{ background: 'rgba(15,24,36,0.5)', borderColor: `${cfg.color}20` }}>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: `${cfg.color}12`, border: `1px solid ${cfg.color}20` }}>
                    <Icon className="w-4 h-4" style={{ color: cfg.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold truncate">{cfg.label}</div>
                    <div className="stat-number text-lg font-black leading-tight" style={{ color: cfg.color }}>
                      {cfg.currentValue}<span className="text-xs font-medium text-slate-400 ml-0.5">{cfg.unit}</span>
                    </div>
                  </div>
                  <StatusIc className="w-4 h-4 flex-shrink-0" style={{ color: statusColor }} />
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Sensor sections ── */}
        {SENSORS.map(cfg => (
          <SensorSection key={`${cfg.key}-${refreshKey}`} cfg={cfg} range={range} />
        ))}

        <p className="pb-10 text-xs text-slate-600 text-center font-mono">
          ESP32 · Firebase Realtime DB · {format(now, 'PPpp')}
        </p>
      </div>
    </div>
  );
}