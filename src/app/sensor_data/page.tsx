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
  ArrowUpRight, ArrowDownRight, Minus, Target, Eye,
  Activity, Layers, Wind,
  ChevronRight, Cpu, Check
} from 'lucide-react';
import { format } from 'date-fns';
import { startRealtimeUpdates, fetchSensorData, fetchHistoricalData, type HistoricalDataPoint } from '@/lib/firebase';

type TimeRange = '6h' | '24h' | '7d' | '30d';
type SensorKey = 'temperature' | 'humidity' | 'moisture' | 'ph';
type DataPoint = { time: string; value: number };

type SensorConfig = {
  key: SensorKey;
  label: string;
  unit: string;
  icon: React.ElementType;
  color: string;
  pale: string;
  cardBg: string;
  cardBorder: string;
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
    pale: '#fff7ed',
    // Warm amber-cream tint — matches dashboard cardTemperature
    cardBg: 'linear-gradient(145deg, #fffaf3 0%, #fff8ed 100%)',
    cardBorder: 'rgba(249,115,22,0.18)',
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
    color: '#0891b2',
    pale: '#ecfeff',
    // Cool aqua tint — matches dashboard cardHumidity
    cardBg: 'linear-gradient(145deg, #f0fbff 0%, #e8f8fc 100%)',
    cardBorder: 'rgba(8,145,178,0.18)',
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
    color: '#2563eb',
    pale: '#eff6ff',
    // Soft blue tint — matches dashboard cardMoisture
    cardBg: 'linear-gradient(145deg, #f0f6ff 0%, #eaf1ff 100%)',
    cardBorder: 'rgba(37,99,235,0.18)',
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
    color: '#7c3aed',
    pale: '#faf5ff',
    // Lavender tint — matches dashboard cardAI / lavender accents
    cardBg: 'linear-gradient(145deg, #f5f7ff 0%, #f2eeff 100%)',
    cardBorder: 'rgba(124,58,237,0.18)',
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

// ── Custom Tooltip — matches dashboard tooltip style ───────────────────────────
const ChartTooltip = ({ active, payload, label, color, unit }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#fff', border: '1px solid rgba(160,130,90,0.2)', borderRadius: 12, padding: '10px 14px', fontFamily: "'DM Sans', sans-serif", fontSize: 12, boxShadow: '0 8px 24px rgba(100,70,30,0.12)', color: '#1c1a15' }}>
      <p style={{ color: '#9a8870', fontSize: 11, marginBottom: 4 }}>{label}</p>
      <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 20, color: color, margin: 0 }}>
        {payload[0].value?.toFixed(2)}<span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: '#9a8870', marginLeft: 3 }}>{unit}</span>
      </p>
    </div>
  );
};

// ── Status helpers — identical to dashboard ────────────────────────────────────
const statusBg  = (s: 'optimal'|'warning'|'critical') => ({ optimal: '#f0faf2', warning: '#fffbeb', critical: '#fff1f2' }[s]);
const statusClr = (s: 'optimal'|'warning'|'critical') => ({ optimal: '#2d6a4f', warning: '#92400e', critical: '#991b1b' }[s]);
const statusBdr = (s: 'optimal'|'warning'|'critical') => ({ optimal: '#bbf7d0', warning: '#fde68a', critical: '#fecaca' }[s]);
const statusLbl = (s: 'optimal'|'warning'|'critical') => ({ optimal: 'Optimal', warning: 'Suboptimal', critical: 'Critical' }[s]);

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
      <div style={{ background: cfg.cardBg, border: `1px solid ${cfg.cardBorder}`, borderRadius: 18, boxShadow: '0 2px 12px rgba(100,70,30,0.06)', padding: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
        <RefreshCw size={16} color="#9a8870" style={{ animation: 'spin 1s linear infinite' }} />
        <span style={{ fontSize: 13, color: '#9a8870', fontFamily: "'DM Sans', sans-serif" }}>Loading {cfg.label} data…</span>
      </div>
    );
  }

  const Icon = cfg.icon;
  const StatusIcon = analysis.status === 'optimal' ? Check : analysis.status === 'warning' ? AlertTriangle : Zap;

  const trendInfo = {
    rising:  { icon: ArrowUpRight,   label: `+${Math.abs(analysis.trendPct)}%`, color: '#2d6a4f', bg: '#f0faf2', bdr: '#bbf7d0' },
    falling: { icon: ArrowDownRight, label: `${analysis.trendPct}%`,            color: '#991b1b', bg: '#fff1f2', bdr: '#fecaca' },
    stable:  { icon: Minus,          label: 'Stable',                           color: '#5a5040', bg: '#f9f5ef', bdr: 'rgba(160,130,90,0.22)' },
  }[analysis.trend];
  const TrendIcon = trendInfo.icon;

  const range_span  = cfg.criticalMax - cfg.criticalMin;
  const val_pct     = Math.min(100, Math.max(0, ((cfg.currentValue - cfg.criticalMin) / range_span) * 100));
  const opt_min_pct = ((cfg.optimalMin - cfg.criticalMin) / range_span) * 100;
  const opt_max_pct = ((cfg.optimalMax - cfg.criticalMin) / range_span) * 100;

  return (
    <div style={{ background: cfg.cardBg, border: `1px solid ${cfg.cardBorder}`, borderRadius: 18, boxShadow: '0 2px 12px rgba(100,70,30,0.06)', overflow: 'hidden', transition: 'box-shadow 0.2s' }}>
      {/* Colored top accent bar */}
      <div style={{ height: 3, background: `linear-gradient(90deg, ${cfg.color}, ${cfg.color}40, transparent)` }} />

      <div style={{ padding: '24px 28px' }}>
        {/* ── Header ── */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: 20, marginBottom: 24 }}>
          {/* Icon */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: cfg.pale, border: `1px solid ${cfg.color}25`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon size={22} color={cfg.color} />
            </div>
            <span style={{ position: 'absolute', bottom: -3, right: -3, width: 12, height: 12, borderRadius: '50%', background: statusBg(analysis.status), border: `2px solid #fff`, display: 'inline-block' }} className="pls" />
          </div>

          {/* Labels */}
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, fontWeight: 600, color: '#1c1a15', letterSpacing: '-0.01em', margin: 0 }}>{cfg.label}</h2>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 11px', borderRadius: 100, fontSize: 11.5, fontWeight: 700, background: statusBg(analysis.status), color: statusClr(analysis.status), border: `1px solid ${statusBdr(analysis.status)}`, fontFamily: "'DM Sans', sans-serif" }}>
                <StatusIcon size={10} /> {statusLbl(analysis.status)}
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 11px', borderRadius: 100, fontSize: 11.5, fontWeight: 600, background: trendInfo.bg, color: trendInfo.color, border: `1px solid ${trendInfo.bdr}`, fontFamily: "'DM Sans', sans-serif" }}>
                <TrendIcon size={12} /> {trendInfo.label}
              </span>
            </div>
            <p style={{ fontSize: 13.5, color: '#9a8870', lineHeight: 1.6, maxWidth: 560, fontFamily: "'DM Sans', sans-serif", margin: 0 }}>{cfg.description}</p>
          </div>

          {/* Live value */}
          <div style={{ flexShrink: 0, textAlign: 'right' }}>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 52, letterSpacing: '-0.03em', color: cfg.color, lineHeight: 1 }}>
              {cfg.currentValue}
              <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 16, color: '#9a8870', marginLeft: 4, fontWeight: 400 }}>{cfg.unit}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, marginTop: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.color, display: 'inline-block' }} className="pls" />
              <span style={{ fontSize: 11, fontWeight: 700, color: '#b0a088', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: "'DM Sans', sans-serif" }}>Live Reading</span>
            </div>
          </div>
        </div>

        {/* ── Gauge bar ── */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#b0a088', marginBottom: 8, fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}>
            <span>Critical Low {cfg.criticalMin}{cfg.unit}</span>
            <span>Optimal {cfg.optimalMin}–{cfg.optimalMax}{cfg.unit}</span>
            <span>Critical High {cfg.criticalMax}{cfg.unit}</span>
          </div>
          <div style={{ position: 'relative', height: 10, borderRadius: 100, background: '#ede4d3', overflow: 'visible' }}>
            {/* Optimal zone highlight */}
            <div style={{ position: 'absolute', top: 0, bottom: 0, borderRadius: 100, background: cfg.color, opacity: 0.15, left: `${opt_min_pct}%`, width: `${opt_max_pct - opt_min_pct}%` }} />
            <div style={{ position: 'absolute', top: 0, bottom: 0, borderLeft: `1.5px dashed ${cfg.color}50`, borderRight: `1.5px dashed ${cfg.color}50`, left: `${opt_min_pct}%`, width: `${opt_max_pct - opt_min_pct}%` }} />
            {/* Fill */}
            <div style={{ height: '100%', borderRadius: 100, transition: 'width 0.7s cubic-bezier(.34,1.56,.64,1)', width: `${val_pct}%`, background: `linear-gradient(90deg, ${cfg.color}60, ${cfg.color})` }} />
            {/* Indicator dot */}
            <div style={{ position: 'absolute', top: '50%', transform: 'translate(-50%, -50%)', width: 18, height: 18, borderRadius: '50%', background: cfg.color, border: '3px solid #fff', boxShadow: `0 0 12px ${cfg.color}60`, transition: 'left 0.7s cubic-bezier(.34,1.56,.64,1)', left: `${val_pct}%` }} />
          </div>
        </div>

        {/* ── Stats strip ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
          {[
            { l: 'Average',      v: `${analysis.avg}${cfg.unit}`, sub: `${range} mean`   },
            { l: 'Minimum',      v: `${analysis.min}${cfg.unit}`, sub: 'period low'       },
            { l: 'Maximum',      v: `${analysis.max}${cfg.unit}`, sub: 'period high'      },
            { l: 'Optimal Band', v: `${cfg.optimalMin}–${cfg.optimalMax}`, sub: cfg.unit  },
          ].map((s, i) => (
            <div key={i} style={{ background: 'rgba(255,255,255,0.65)', borderRadius: 12, padding: '12px 14px', border: '1px solid rgba(160,130,90,0.12)', backdropFilter: 'blur(4px)' }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: '#b0a088', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5, fontFamily: "'DM Sans', sans-serif" }}>{s.l}</div>
              <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 17, color: '#1c1a15' }}>{s.v}</div>
              <div style={{ fontSize: 11, color: '#b0a088', marginTop: 3, fontFamily: "'DM Sans', sans-serif" }}>{s.sub}</div>
            </div>
          ))}
        </div>

        {/* ── Chart ── */}
        <div style={{ width: '100%', height: 260, marginBottom: 16 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
              <defs>
                <linearGradient id={`grad-${cfg.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={cfg.color} stopOpacity={0.22} />
                  <stop offset="95%" stopColor={cfg.color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(160,130,90,0.12)" vertical={false} />
              <ReferenceLine y={cfg.optimalMax} stroke={cfg.color} strokeDasharray="4 4" strokeOpacity={0.45}
                label={{ value: `↑ ${cfg.optimalMax}${cfg.unit}`, fill: cfg.color, fontSize: 10, position: 'insideTopRight', opacity: 0.6 }} />
              <ReferenceLine y={cfg.optimalMin} stroke={cfg.color} strokeDasharray="4 4" strokeOpacity={0.45}
                label={{ value: `↓ ${cfg.optimalMin}${cfg.unit}`, fill: cfg.color, fontSize: 10, position: 'insideBottomRight', opacity: 0.6 }} />
              <XAxis dataKey="time"
                tick={{ fill: '#b0a088', fontSize: 11, fontFamily: "'DM Sans', sans-serif" }}
                tickLine={false} axisLine={{ stroke: 'rgba(160,130,90,0.2)' }}
                interval={Math.floor(data.length / 7)} />
              <YAxis
                tick={{ fill: '#b0a088', fontSize: 11, fontFamily: "'DM Sans', sans-serif" }}
                tickLine={false} axisLine={false}
                tickFormatter={v => `${v}${cfg.unit}`} />
              <Tooltip content={(props: any) => <ChartTooltip {...props} color={cfg.color} unit={cfg.unit} />} />
              <Area type="monotone" dataKey="value" stroke={cfg.color} strokeWidth={2.5}
                fill={`url(#grad-${cfg.key})`} dot={false} isAnimationActive={false}
                activeDot={{ r: 5, fill: cfg.color, stroke: '#fff', strokeWidth: 2 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Chart legend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 22, paddingTop: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#9a8870', fontFamily: "'DM Sans', sans-serif" }}>
            <span style={{ width: 24, height: 2, borderRadius: 100, background: cfg.color, display: 'inline-block' }} />
            {cfg.label}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#9a8870', fontFamily: "'DM Sans', sans-serif" }}>
            <span style={{ width: 24, display: 'inline-block', borderTop: `1.5px dashed ${cfg.color}70` }} />
            Optimal range
          </div>
        </div>

        {/* ── Analysis + Recommendation — earthy card tints ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {/* Analysis — matches cardSoil earthy terracotta-cream */}
          <div style={{ background: 'linear-gradient(155deg, #fdf8f2 0%, #faf5ec 100%)', borderRadius: 14, padding: 20, border: '1px solid rgba(160,100,40,0.16)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <div style={{ width: 30, height: 30, borderRadius: 9, background: `${cfg.color}12`, border: `1px solid ${cfg.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Eye size={13} color={cfg.color} />
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#9a8870', textTransform: 'uppercase', letterSpacing: '0.07em', fontFamily: "'DM Sans', sans-serif" }}>Analysis</span>
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {analysis.insights.map((insight, i) => (
                <li key={i} style={{ display: 'flex', gap: 10, fontSize: 13, color: '#5a5040', lineHeight: 1.6, fontFamily: "'DM Sans', sans-serif" }}>
                  <span style={{ marginTop: 8, width: 5, height: 5, borderRadius: '50%', flexShrink: 0, background: i === 2 ? cfg.color : 'rgba(160,130,90,0.35)', display: 'inline-block' }} />
                  {insight}
                </li>
              ))}
            </ul>
          </div>

          {/* Recommendation — matches cardTasks soft sage green */}
          <div style={{ background: 'linear-gradient(155deg, #f3fbf5 0%, #eef8f0 100%)', borderRadius: 14, padding: 20, border: '1px solid rgba(45,106,79,0.16)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <div style={{ width: 30, height: 30, borderRadius: 9, background: `${cfg.color}12`, border: `1px solid ${cfg.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Target size={13} color={cfg.color} />
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#9a8870', textTransform: 'uppercase', letterSpacing: '0.07em', fontFamily: "'DM Sans', sans-serif" }}>Recommendation</span>
            </div>
            <p style={{ fontSize: 13.5, color: '#1c1a15', lineHeight: 1.65, marginBottom: 16, fontFamily: "'DM Sans', sans-serif" }}>{analysis.recommendation}</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {[
                { l: 'Optimal',    v: `${cfg.optimalMin}–${cfg.optimalMax}${cfg.unit}`, c: cfg.color  },
                { l: 'Crit. Low',  v: `${cfg.criticalMin}${cfg.unit}`,                  c: '#dc2626'  },
                { l: 'Crit. High', v: `${cfg.criticalMax}${cfg.unit}`,                  c: '#dc2626'  },
              ].map((item, i) => (
                <div key={i} style={{ background: 'rgba(255,255,255,0.7)', borderRadius: 10, padding: '8px 10px', textAlign: 'center', border: '1px solid rgba(160,130,90,0.14)' }}>
                  <div style={{ fontSize: 10, color: '#b0a088', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4, fontFamily: "'DM Sans', sans-serif", fontWeight: 600 }}>{item.l}</div>
                  <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 15, color: item.c }}>{item.v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function SensorDataPage() {
  const router = useRouter();
  const [range, setRange] = useState<TimeRange>('24h');
  const [refreshKey, setRefreshKey] = useState(0);
  const [now, setNow] = useState<Date | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastSync, setLastSync] = useState('—');
  const [isMounted, setIsMounted] = useState(false);

  const [liveValues, setLiveValues] = useState<Record<SensorKey, number>>({
    temperature: 0, humidity: 0, moisture: 0, ph: 6.5,
  });

  const ranges: TimeRange[] = ['6h', '24h', '7d', '30d'];

  useEffect(() => {
    setIsMounted(true);
    setNow(new Date());
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

  const SENSORS: SensorConfig[] = SENSOR_BASES.map(base => ({
    ...base,
    currentValue: liveValues[base.key],
  }));

  // Quick status strip card — matches dashboard cardLogs soft slate-blue
  const quickStripCard: React.CSSProperties = {
    background: 'linear-gradient(155deg, #f6f8ff 0%, #f2f5fe 100%)',
    border: '1px solid rgba(59,130,246,0.14)',
    borderRadius: 18,
    boxShadow: '0 2px 12px rgba(100,70,30,0.06)',
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f9f5ef', fontFamily: "'DM Sans', system-ui, sans-serif", color: '#1c1a15' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,300&family=Space+Grotesk:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: #f2ece0; }
        ::-webkit-scrollbar-thumb { background: #d4c4a8; border-radius: 2px; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pls { 0%,100%{opacity:1}50%{opacity:0.4} }
        .pls { animation: pls 2s infinite; }
        .ptrack { width:100%;height:6px;background:#ede4d3;border-radius:100px;overflow:hidden; }
        .pfill  { height:100%;border-radius:100px;transition:width 1.2s cubic-bezier(.34,1.56,.64,1); }
        .btn-p { background:#2d6a4f;color:#fff;border:none;border-radius:100px;padding:10px 20px;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:7px;transition:all .2s;box-shadow:0 2px 10px rgba(45,106,79,0.28); }
        .btn-p:hover { background:#40916c;transform:translateY(-1px); }
        .btn-g { background:transparent;border:1px solid rgba(160,130,90,0.22);color:#5a5040;border-radius:100px;padding:9px 18px;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:500;cursor:pointer;display:inline-flex;align-items:center;gap:7px;transition:all .15s; }
        .btn-g:hover { background:#f2ece0;border-color:rgba(160,130,90,0.4);color:#1c1a15; }
      `}</style>

      {/* ── Header — original structure, updated colors ──────────────────────── */}
      <header style={{ position: 'sticky', top: 0, zIndex: 50, height: 60, background: 'rgba(249,245,239,0.92)', backdropFilter: 'blur(14px)', borderBottom: '1px solid rgba(160,130,90,0.14)', display: 'flex', alignItems: 'center', padding: '0 24px', gap: 14 }}>

        {/* Connection indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 13px', borderRadius: 100, background: '#fff', border: `1px solid ${isConnected ? 'rgba(45,106,79,0.25)' : 'rgba(160,130,90,0.2)'}`, fontSize: 12, color: isConnected ? '#2d6a4f' : '#9a8870', fontWeight: 600, flexShrink: 0, fontFamily: "'DM Sans', sans-serif" }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: isConnected ? '#40916c' : '#b0a088', display: 'inline-block' }} className={isConnected ? 'pls' : ''} />
          {isConnected ? `Live · ${lastSync}` : 'Offline'}
        </div>

        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, color: '#1c1a15' }}>Sensor Analytics</span>
          {lastSync !== '—' && (
            <span style={{ fontSize: 11.5, color: '#b0a088', fontFamily: "'DM Sans', sans-serif" }}>· ESP32-Node1 · synced {lastSync}</span>
          )}
        </div>

        {/* Time range selector */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {ranges.map(r => (
            <button key={r} onClick={() => setRange(r)}
              style={{ padding: '6px 14px', borderRadius: 100, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", border: `1.5px solid ${range === r ? '#40916c' : 'rgba(160,130,90,0.22)'}`, background: range === r ? '#f0faf2' : '#fff', color: range === r ? '#2d6a4f' : '#5a5040', transition: 'all .15s' }}>
              {r.toUpperCase()}
            </button>
          ))}
          <button onClick={refresh}
            style={{ background: '#fff', border: '1px solid rgba(160,130,90,0.2)', borderRadius: 10, width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#9a8870', marginLeft: 4 }}>
            <RefreshCw size={14} />
          </button>
        </div>
      </header>

      {/* ── Main Content ───────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 24px 60px' }} key={refreshKey}>

        {/* ── Hero banner — matches dashboard hero section ── */}
        <div style={{ background: 'linear-gradient(135deg, #e8f5eb 0%, #f3fbf4 40%, #eef4ff 100%)', border: '1px solid rgba(45,106,79,0.18)', borderRadius: 18, boxShadow: '0 2px 16px rgba(45,106,79,0.08)', padding: '24px 28px', marginBottom: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 11px', borderRadius: 100, fontSize: 11, fontWeight: 700, background: '#d8f3dc', color: '#2d6a4f', border: '1px solid #b7e4c7', fontFamily: "'DM Sans', sans-serif" }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#40916c', display: 'inline-block' }} className="pls" />
              LIVE MONITORING
            </span>
            <span style={{ fontSize: 11.5, color: '#9a8870', fontFamily: "'DM Sans', sans-serif" }}>Last sync: {lastSync}</span>
          </div>
          <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 32, fontWeight: 700, color: '#1c1a15', letterSpacing: '-0.02em', lineHeight: 1.1, marginBottom: 6 }}>
            Sensor Analytics
          </h1>
          <p style={{ fontSize: 14, color: '#9a8870', fontFamily: "'DM Sans', sans-serif", margin: 0 }}>
            Real-time readings and historical trend analysis across all monitored environmental parameters.
          </p>
        </div>

        {/* ── Quick status strip — soft slate-blue tint like cardLogs ── */}
        <div style={{ ...quickStripCard, padding: 20, marginBottom: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h2 style={{ fontSize: 11.5, fontWeight: 700, color: '#9a8870', textTransform: 'uppercase', letterSpacing: '0.07em', fontFamily: "'DM Sans', sans-serif", margin: 0 }}>Current Readings</h2>
            <span style={{ fontSize: 11.5, color: '#b0a088', display: 'flex', alignItems: 'center', gap: 5, fontFamily: "'DM Sans', sans-serif" }}>
              <Cpu size={12} /> {isMounted && now ? format(now, 'HH:mm:ss · d MMM yyyy') : '—'}
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {SENSORS.map(cfg => {
              const isOptimal  = cfg.currentValue >= cfg.optimalMin && cfg.currentValue <= cfg.optimalMax;
              const isCritical = cfg.currentValue < cfg.criticalMin || cfg.currentValue > cfg.criticalMax;
              const Icon = cfg.icon;
              const StatusIc  = isCritical ? Zap : isOptimal ? Check : AlertTriangle;
              const st = isCritical ? 'critical' : isOptimal ? 'optimal' : 'warning' as const;
              return (
                <div key={cfg.key}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', borderRadius: 14, border: `1px solid ${cfg.color}20`, background: 'rgba(255,255,255,0.65)', backdropFilter: 'blur(4px)', transition: 'transform .15s', cursor: 'default' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.transform = ''}>
                  <div style={{ width: 36, height: 36, borderRadius: 11, background: cfg.pale, border: `1px solid ${cfg.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={16} color={cfg.color} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 10.5, color: '#b0a088', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700, marginBottom: 2, fontFamily: "'DM Sans', sans-serif" }}>{cfg.label}</div>
                    <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 20, color: cfg.color, lineHeight: 1 }}>
                      {cfg.currentValue}<span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: '#9a8870', marginLeft: 2 }}>{cfg.unit}</span>
                    </div>
                  </div>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 100, fontSize: 10.5, fontWeight: 700, background: statusBg(st), color: statusClr(st), border: `1px solid ${statusBdr(st)}`, flexShrink: 0, fontFamily: "'DM Sans', sans-serif" }}>
                    <StatusIc size={10} /> {statusLbl(st)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Sensor sections ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {SENSORS.map(cfg => (
            <SensorSection key={`${cfg.key}-${refreshKey}`} cfg={cfg} range={range} />
          ))}
        </div>

        <p style={{ paddingTop: 28, textAlign: 'center', fontSize: 11.5, color: '#c4b49a', fontFamily: "'DM Sans', sans-serif" }} suppressHydrationWarning>
          ESP32 · Firebase Realtime DB · {isMounted && now ? format(now, 'PPpp') : '—'}
        </p>
      </div>
    </div>
  );
}