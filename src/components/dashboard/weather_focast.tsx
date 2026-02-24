'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Wind, Droplets, Eye, Gauge, Sunrise, Sunset,
  Thermometer, CloudRain, CloudSnow, Cloud, Sun,
  Zap, CloudDrizzle, CloudFog, RefreshCw, MapPin,
  ChevronRight, ChevronLeft, ArrowUp, ArrowDown
} from 'lucide-react';
import clsx, { type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ── Types ──────────────────────────────────────────────────────────────────
type WeatherCondition = 'Clear' | 'Clouds' | 'Rain' | 'Drizzle' | 'Thunderstorm' | 'Snow' | 'Mist' | 'Haze' | 'Fog' | string;

interface CurrentWeather {
  temp: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  windDeg: number;
  visibility: number;
  pressure: number;
  uvIndex: number;
  condition: WeatherCondition;
  description: string;
  icon: string;
  sunrise: number;
  sunset: number;
  cityName: string;
  country: string;
  dt: number;
}

interface HourlyPoint {
  dt: number;
  temp: number;
  pop: number; // probability of precipitation
  condition: WeatherCondition;
  icon: string;
  windSpeed: number;
  humidity: number;
}

interface DailyPoint {
  dt: number;
  tempMax: number;
  tempMin: number;
  pop: number;
  condition: WeatherCondition;
  icon: string;
  description: string;
  humidity: number;
  windSpeed: number;
  uvIndex: number;
}

type ViewMode = 'today' | 'week';

// ── Config ─────────────────────────────────────────────────────────────────
const API_KEY = '30c7a3f77093c6e2120885d85381ab0c';
const BASE_URL = 'https://api.openweathermap.org/data/3.0/onecall';
const GEO_URL = 'https://api.openweathermap.org/geo/1.0/reverse';

// ── Weather icon map ───────────────────────────────────────────────────────
function WeatherIcon({ condition, size = 24, className }: { condition: WeatherCondition; size?: number; className?: string }) {
  const cls = cn("flex-shrink-0", className);
  const s = { width: size, height: size };

  if (condition === 'Clear') return <Sun style={s} className={cn(cls, "text-amber-400")} />;
  if (condition === 'Rain') return <CloudRain style={s} className={cn(cls, "text-cyan-400")} />;
  if (condition === 'Drizzle') return <CloudDrizzle style={s} className={cn(cls, "text-cyan-300")} />;
  if (condition === 'Thunderstorm') return <Zap style={s} className={cn(cls, "text-yellow-300")} />;
  if (condition === 'Snow') return <CloudSnow style={s} className={cn(cls, "text-slate-200")} />;
  if (condition === 'Mist' || condition === 'Haze' || condition === 'Fog') return <CloudFog style={s} className={cn(cls, "text-slate-400")} />;
  return <Cloud style={s} className={cn(cls, "text-slate-300")} />;
}

function conditionGradient(condition: WeatherCondition, isNight = false): string {
  if (isNight) return 'linear-gradient(135deg, rgba(15,23,42,0.95) 0%, rgba(30,27,75,0.9) 50%, rgba(15,23,42,0.95) 100%)';
  if (condition === 'Clear') return 'linear-gradient(135deg, rgba(251,191,36,0.12) 0%, rgba(245,158,11,0.06) 40%, rgba(15,24,36,0.95) 100%)';
  if (condition === 'Rain' || condition === 'Drizzle') return 'linear-gradient(135deg, rgba(6,182,212,0.12) 0%, rgba(37,99,235,0.08) 40%, rgba(15,24,36,0.95) 100%)';
  if (condition === 'Thunderstorm') return 'linear-gradient(135deg, rgba(124,58,237,0.15) 0%, rgba(30,27,75,0.1) 40%, rgba(15,24,36,0.95) 100%)';
  if (condition === 'Snow') return 'linear-gradient(135deg, rgba(148,163,184,0.12) 0%, rgba(203,213,225,0.06) 40%, rgba(15,24,36,0.95) 100%)';
  return 'linear-gradient(135deg, rgba(71,85,105,0.12) 0%, rgba(51,65,85,0.08) 40%, rgba(15,24,36,0.95) 100%)';
}

function accentColor(condition: WeatherCondition): string {
  if (condition === 'Clear') return '#fbbf24';
  if (condition === 'Rain' || condition === 'Drizzle') return '#22d3ee';
  if (condition === 'Thunderstorm') return '#a78bfa';
  if (condition === 'Snow') return '#cbd5e1';
  return '#94a3b8';
}

function windDirection(deg: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(deg / 45) % 8];
}

function formatTime(unix: number, offset = 0): string {
  const d = new Date((unix + offset) * 1000);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

function formatHour(unix: number): string {
  const d = new Date(unix * 1000);
  const h = d.getHours();
  return h === 0 ? '12 AM' : h === 12 ? '12 PM' : h < 12 ? `${h} AM` : `${h - 12} PM`;
}

function formatDayFull(unix: number): string {
  return new Date(unix * 1000).toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
}

function formatDayShort(unix: number): string {
  const d = new Date(unix * 1000);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return 'Today';
  const tomorrow = new Date(); tomorrow.setDate(today.getDate() + 1);
  if (d.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
  return d.toLocaleDateString([], { weekday: 'short' });
}

// ── Rain animation ─────────────────────────────────────────────────────────
const RainDrops = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
    {Array.from({ length: 20 }).map((_, i) => (
      <div key={i} className="absolute w-px rounded-full"
        style={{
          left: `${Math.random() * 100}%`,
          top: `-${Math.random() * 20}px`,
          height: `${Math.random() * 16 + 8}px`,
          background: 'linear-gradient(to bottom, transparent, #22d3ee)',
          animationName: 'rain',
          animationDuration: `${Math.random() * 1 + 0.6}s`,
          animationDelay: `${Math.random() * 2}s`,
          animationIterationCount: 'infinite',
          animationTimingFunction: 'linear',
        }} />
    ))}
  </div>
);

// ── Snowflakes animation ───────────────────────────────────────────────────
const Snowflakes = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-30">
    {Array.from({ length: 15 }).map((_, i) => (
      <div key={i} className="absolute text-white text-xs"
        style={{
          left: `${Math.random() * 100}%`,
          animationName: 'snow',
          animationDuration: `${Math.random() * 3 + 2}s`,
          animationDelay: `${Math.random() * 3}s`,
          animationIterationCount: 'infinite',
          animationTimingFunction: 'linear',
        }}>❄</div>
    ))}
  </div>
);

// ── Pulsing sun rays ───────────────────────────────────────────────────────
const SunRays = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    <div className="absolute top-6 right-8 w-24 h-24 opacity-10"
      style={{ background: 'radial-gradient(circle, #fbbf24 0%, transparent 70%)', animation: 'pulse 3s ease-in-out infinite' }} />
    <div className="absolute top-4 right-6 w-36 h-36 opacity-5"
      style={{ background: 'radial-gradient(circle, #fbbf24 0%, transparent 70%)', animation: 'pulse 3s ease-in-out infinite', animationDelay: '1s' }} />
  </div>
);

// ── UV Index bar ───────────────────────────────────────────────────────────
const UVBar = ({ value }: { value: number }) => {
  const pct = Math.min(100, (value / 11) * 100);
  const color = value <= 2 ? '#22c55e' : value <= 5 ? '#eab308' : value <= 7 ? '#f97316' : value <= 10 ? '#ef4444' : '#a21caf';
  const label = value <= 2 ? 'Low' : value <= 5 ? 'Moderate' : value <= 7 ? 'High' : value <= 10 ? 'Very High' : 'Extreme';
  return (
    <div className="w-full">
      <div className="flex justify-between text-[10px] mb-1">
        <span className="text-slate-500">UV Index</span>
        <span className="font-bold" style={{ color }}>{value} · {label}</span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(30,41,59,0.8)' }}>
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
};

// ── Main Component ─────────────────────────────────────────────────────────
export function WeatherForecast() {
  const [view, setView] = useState<ViewMode>('today');
  const [current, setCurrent] = useState<CurrentWeather | null>(null);
  const [hourly, setHourly] = useState<HourlyPoint[]>([]);
  const [daily, setDaily] = useState<DailyPoint[]>([]);
  const [selectedDay, setSelectedDay] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hourlyOffset, setHourlyOffset] = useState(0);
  const [now] = useState(new Date());

  const fetchWeather = useCallback(async (lat: number, lon: number) => {
    setLoading(true);
    setError(null);
    try {
      // Use 2.5 daily forecast API (free tier) + current
      const [currentRes, forecastRes] = await Promise.all([
        fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric`),
        fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric&cnt=40`)
      ]);

      if (!currentRes.ok || !forecastRes.ok) throw new Error('Weather API error');

      const [cData, fData] = await Promise.all([currentRes.json(), forecastRes.json()]);

      // Reverse geocode for city name
      let cityName = cData.name || 'Your Location';
      let country = cData.sys?.country || '';

      setCurrent({
        temp: Math.round(cData.main.temp),
        feelsLike: Math.round(cData.main.feels_like),
        humidity: cData.main.humidity,
        windSpeed: Math.round(cData.wind?.speed * 3.6), // m/s → km/h
        windDeg: cData.wind?.deg || 0,
        visibility: Math.round((cData.visibility || 10000) / 1000),
        pressure: cData.main.pressure,
        uvIndex: 0, // not in free tier current
        condition: cData.weather?.[0]?.main || 'Clear',
        description: cData.weather?.[0]?.description || '',
        icon: cData.weather?.[0]?.icon || '01d',
        sunrise: cData.sys?.sunrise || 0,
        sunset: cData.sys?.sunset || 0,
        cityName,
        country,
        dt: cData.dt,
      });

      // Process 3-hourly forecast into hourly-ish and daily
      const items: any[] = fData.list || [];

      const h: HourlyPoint[] = items.slice(0, 16).map((item: any) => ({
        dt: item.dt,
        temp: Math.round(item.main.temp),
        pop: Math.round((item.pop || 0) * 100),
        condition: item.weather?.[0]?.main || 'Clear',
        icon: item.weather?.[0]?.icon || '01d',
        windSpeed: Math.round((item.wind?.speed || 0) * 3.6),
        humidity: item.main.humidity,
      }));
      setHourly(h);

      // Aggregate into daily
      const dayMap = new Map<string, any[]>();
      items.forEach((item: any) => {
        const key = new Date(item.dt * 1000).toDateString();
        if (!dayMap.has(key)) dayMap.set(key, []);
        dayMap.get(key)!.push(item);
      });

      const d: DailyPoint[] = Array.from(dayMap.entries()).slice(0, 7).map(([, pts]) => {
        const temps = pts.map((p: any) => p.main.temp);
        const midday = pts[Math.floor(pts.length / 2)];
        return {
          dt: pts[0].dt,
          tempMax: Math.round(Math.max(...temps)),
          tempMin: Math.round(Math.min(...temps)),
          pop: Math.round(Math.max(...pts.map((p: any) => p.pop || 0)) * 100),
          condition: midday.weather?.[0]?.main || 'Clear',
          icon: midday.weather?.[0]?.icon || '01d',
          description: midday.weather?.[0]?.description || '',
          humidity: Math.round(pts.reduce((s: number, p: any) => s + p.main.humidity, 0) / pts.length),
          windSpeed: Math.round(pts.reduce((s: number, p: any) => s + (p.wind?.speed || 0), 0) / pts.length * 3.6),
          uvIndex: 0,
        };
      });
      setDaily(d);
    } catch (e) {
      setError('Unable to load weather data. Please check your connection.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) {
      // Default: Nairobi
      fetchWeather(-1.286389, 36.817223);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => fetchWeather(pos.coords.latitude, pos.coords.longitude),
      () => fetchWeather(-1.286389, 36.817223),
      { timeout: 6000 }
    );
  }, [fetchWeather]);

  const accent = current ? accentColor(current.condition) : '#10b981';
  const bg = current ? conditionGradient(current.condition) : conditionGradient('Clear');
  const isNight = current ? (current.dt < current.sunrise || current.dt > current.sunset) : false;
  const tempRangeForBar = daily.length ? { max: Math.max(...daily.map(d => d.tempMax)), min: Math.min(...daily.map(d => d.tempMin)) } : { max: 35, min: 10 };

  const visibleHourly = hourly.slice(hourlyOffset, hourlyOffset + 6);
  const selectedDayData = daily[selectedDay];

  return (
    <>
      <style>{`
        @keyframes rain {
          0% { transform: translateY(-20px) translateX(0px); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateY(200px) translateX(10px); opacity: 0; }
        }
        @keyframes snow {
          0% { transform: translateY(-10px) translateX(0px); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateY(200px) translateX(20px); opacity: 0; }
        }
        @keyframes float-slow {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-6px); }
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .weather-card-anim { animation: fade-in-up 0.5s ease-out forwards; }
        .float-icon { animation: float-slow 4s ease-in-out infinite; }
        .hourly-card:hover { transform: translateY(-4px); border-color: rgba(255,255,255,0.15) !important; }
        .day-card:hover { transform: translateX(3px); }
        .weather-tab { transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
        .stat-pill { transition: all 0.2s ease; }
        .stat-pill:hover { transform: scale(1.03); }
        .sun-arc { stroke-dasharray: 150; animation: arc-draw 1.5s ease-out forwards; }
        @keyframes arc-draw { from { stroke-dashoffset: 150; } to { stroke-dashoffset: 0; } }
        .shimmer-bar { background: linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.04) 50%, rgba(255,255,255,0) 100%); background-size: 200% 100%; animation: shimmer 2s infinite; }
      `}</style>

      <div className="rounded-2xl overflow-hidden weather-card-anim"
        style={{ background: 'rgba(30,41,59,0.6)', border: '1px solid rgba(71,85,105,0.35)', backdropFilter: 'blur(12px)' }}>

        {/* ── Loading state ──────────────────────────────────────────────── */}
        {loading && (
          <div className="p-8 flex flex-col items-center justify-center gap-4" style={{ minHeight: 280 }}>
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}>
              <RefreshCw className="w-7 h-7 text-emerald-400 animate-spin" />
            </div>
            <div className="text-center">
              <p className="text-slate-300 font-semibold">Fetching weather data...</p>
              <p className="text-slate-500 text-xs mt-1">Detecting your location</p>
            </div>
            {/* shimmer rows */}
            <div className="w-full max-w-md space-y-2 mt-2">
              {[0, 1, 2].map(i => (
                <div key={i} className="h-8 rounded-xl shimmer-bar" style={{ background: 'rgba(30,41,59,0.8)', opacity: 1 - i * 0.25 }} />
              ))}
            </div>
          </div>
        )}

        {/* ── Error state ────────────────────────────────────────────────── */}
        {!loading && error && (
          <div className="p-8 flex flex-col items-center justify-center gap-3 text-center" style={{ minHeight: 200 }}>
            <CloudFog className="w-10 h-10 text-slate-500" />
            <p className="text-slate-400 text-sm">{error}</p>
            <button onClick={() => fetchWeather(-1.286389, 36.817223)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/10 transition-colors">
              Retry
            </button>
          </div>
        )}

        {/* ── Main content ───────────────────────────────────────────────── */}
        {!loading && !error && current && (
          <>
            {/* ── Top hero section ──────────────────────────────────────── */}
            <div className="relative overflow-hidden p-5 md:p-6" style={{ background: bg, borderBottom: '1px solid rgba(71,85,105,0.2)' }}>
              {/* Ambient effects */}
              {current.condition === 'Rain' || current.condition === 'Drizzle' ? <RainDrops /> : null}
              {current.condition === 'Snow' ? <Snowflakes /> : null}
              {current.condition === 'Clear' ? <SunRays /> : null}

              <div className="relative flex flex-col md:flex-row md:items-start justify-between gap-4">
                {/* Left: current conditions */}
                <div className="flex-1">
                  {/* Location + meta */}
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold"
                      style={{ background: 'rgba(15,24,36,0.5)', borderColor: 'rgba(71,85,105,0.4)', color: accent }}>
                      <MapPin className="w-3 h-3" />
                      {current.cityName}, {current.country}
                    </div>
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs text-slate-400"
                      style={{ background: 'rgba(15,24,36,0.5)', borderColor: 'rgba(71,85,105,0.3)' }}>
                      <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: accent }} />
                      Live · {now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
                    </div>
                  </div>

                  {/* Temp + icon */}
                  <div className="flex items-center gap-4 mb-2">
                    <div className="float-icon">
                      <WeatherIcon condition={current.condition} size={56} />
                    </div>
                    <div>
                      <div className="flex items-start leading-none">
                        <span className="stat-number text-6xl md:text-7xl font-bold text-slate-100">{current.temp}</span>
                        <span className="text-2xl text-slate-400 font-light mt-2">°C</span>
                      </div>
                      <p className="text-slate-300 text-sm font-medium capitalize mt-1">{current.description}</p>
                      <p className="text-slate-500 text-xs mt-0.5">Feels like {current.feelsLike}°C</p>
                    </div>
                  </div>
                </div>

                {/* Right: stat pills grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:min-w-[320px]">
                  {[
                    { icon: Droplets, label: 'Humidity', value: `${current.humidity}%`, color: '#22d3ee' },
                    { icon: Wind, label: 'Wind', value: `${current.windSpeed} km/h ${windDirection(current.windDeg)}`, color: '#94a3b8' },
                    { icon: Eye, label: 'Visibility', value: `${current.visibility} km`, color: '#a78bfa' },
                    { icon: Gauge, label: 'Pressure', value: `${current.pressure} hPa`, color: '#fb923c' },
                    { icon: Sunrise, label: 'Sunrise', value: formatTime(current.sunrise), color: '#fbbf24' },
                    { icon: Sunset, label: 'Sunset', value: formatTime(current.sunset), color: '#f97316' },
                  ].map(stat => (
                    <div key={stat.label} className="stat-pill flex items-center gap-2 p-2.5 rounded-xl border cursor-default"
                      style={{ background: 'rgba(15,24,36,0.55)', borderColor: 'rgba(71,85,105,0.3)' }}>
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: `${stat.color}18`, border: `1px solid ${stat.color}25` }}>
                        <stat.icon className="w-3.5 h-3.5" style={{ color: stat.color }} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[10px] text-slate-500 leading-none">{stat.label}</div>
                        <div className="stat-number text-xs font-bold text-slate-200 mt-0.5 truncate">{stat.value}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* View toggle */}
              <div className="mt-4 flex gap-1 p-1 rounded-xl w-fit"
                style={{ background: 'rgba(15,24,36,0.6)', border: '1px solid rgba(71,85,105,0.3)' }}>
                {(['today', 'week'] as ViewMode[]).map(v => (
                  <button key={v} onClick={() => { setView(v); setSelectedDay(0); setHourlyOffset(0); }}
                    className="weather-tab px-5 py-2 rounded-lg text-xs font-semibold capitalize"
                    style={{
                      background: view === v ? accent : 'transparent',
                      color: view === v ? '#0f1824' : '#94a3b8',
                      boxShadow: view === v ? `0 4px 12px ${accent}40` : 'none',
                    }}>
                    {v === 'today' ? '⏱ Today' : '📅 7-Day'}
                  </button>
                ))}
                <button onClick={() => fetchWeather(-1.286389, 36.817223)}
                  className="ml-1 p-2 rounded-lg text-slate-500 hover:text-slate-300 transition-colors">
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* ── TODAY VIEW ───────────────────────────────────────────────── */}
            {view === 'today' && (
              <div className="p-5 space-y-5">

                {/* Hourly scroll strip */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Hourly Forecast</h4>
                    <div className="flex gap-1">
                      <button onClick={() => setHourlyOffset(Math.max(0, hourlyOffset - 3))}
                        disabled={hourlyOffset === 0}
                        className="p-1.5 rounded-lg border border-slate-700 text-slate-400 hover:text-slate-200 disabled:opacity-30 transition-all hover:bg-slate-700">
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setHourlyOffset(Math.min(hourly.length - 6, hourlyOffset + 3))}
                        disabled={hourlyOffset >= hourly.length - 6}
                        className="p-1.5 rounded-lg border border-slate-700 text-slate-400 hover:text-slate-200 disabled:opacity-30 transition-all hover:bg-slate-700">
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-6 gap-2">
                    {visibleHourly.map((h, i) => {
                      const isNowSlot = i === 0 && hourlyOffset === 0;
                      return (
                        <div key={h.dt} className="hourly-card flex flex-col items-center gap-1.5 p-2.5 md:p-3 rounded-xl border cursor-default transition-all duration-200"
                          style={{
                            background: isNowSlot ? `${accent}18` : 'rgba(15,24,36,0.5)',
                            borderColor: isNowSlot ? `${accent}40` : 'rgba(71,85,105,0.25)',
                          }}>
                          <span className="text-[10px] font-semibold" style={{ color: isNowSlot ? accent : '#64748b' }}>
                            {isNowSlot ? 'Now' : formatHour(h.dt)}
                          </span>
                          <WeatherIcon condition={h.condition} size={20} />
                          <span className="stat-number text-sm font-bold text-slate-100">{h.temp}°</span>
                          {h.pop > 0 && (
                            <div className="flex items-center gap-0.5">
                              <Droplets className="w-2.5 h-2.5 text-cyan-400" />
                              <span className="text-[10px] text-cyan-400 font-medium">{h.pop}%</span>
                            </div>
                          )}
                          <div className="text-[10px] text-slate-500">{h.windSpeed}km/h</div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Sunrise / Sunset arc */}
                <div className="rounded-xl p-4 border" style={{ background: 'rgba(15,24,36,0.5)', borderColor: 'rgba(71,85,105,0.25)' }}>
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Sun Arc</h4>
                  <div className="flex items-end justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Sunrise className="w-5 h-5 text-amber-400" />
                      <div>
                        <div className="text-[10px] text-slate-500">Sunrise</div>
                        <div className="stat-number text-sm font-bold text-amber-400">{formatTime(current.sunrise)}</div>
                      </div>
                    </div>

                    {/* SVG Arc */}
                    <div className="flex-1 relative flex items-end justify-center" style={{ height: 60 }}>
                      <svg width="100%" height="60" viewBox="0 0 200 60" preserveAspectRatio="none">
                        {/* Background arc */}
                        <path d="M 10 55 Q 100 -10 190 55" stroke="rgba(71,85,105,0.3)" strokeWidth="2" fill="none" />
                        {/* Progress arc */}
                        <path d="M 10 55 Q 100 -10 190 55" stroke={accent} strokeWidth="2.5" fill="none"
                          strokeLinecap="round" className="sun-arc" />
                        {/* Sun position dot */}
                        <circle cx="100" cy="5" r="5" fill={accent} style={{ filter: `drop-shadow(0 0 6px ${accent})` }} />
                      </svg>
                      <div className="absolute bottom-0 left-1/2 -translate-x-1/2">
                        <div className="text-[10px] text-slate-500 text-center">{formatTime(current.dt)}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-right">
                      <div>
                        <div className="text-[10px] text-slate-500">Sunset</div>
                        <div className="stat-number text-sm font-bold text-orange-400">{formatTime(current.sunset)}</div>
                      </div>
                      <Sunset className="w-5 h-5 text-orange-400" />
                    </div>
                  </div>
                </div>

                {/* Today's stats grid */}
                {daily[0] && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {[
                      { label: 'High', value: `${daily[0].tempMax}°C`, icon: ArrowUp, color: '#ef4444', sub: 'Today\'s max' },
                      { label: 'Low', value: `${daily[0].tempMin}°C`, icon: ArrowDown, color: '#3b82f6', sub: 'Today\'s min' },
                      { label: 'Rain Chance', value: `${daily[0].pop}%`, icon: CloudRain, color: '#22d3ee', sub: 'Precipitation' },
                      { label: 'Humidity', value: `${daily[0].humidity}%`, icon: Droplets, color: '#a78bfa', sub: 'Relative humidity' },
                    ].map(s => (
                      <div key={s.label} className="p-3 rounded-xl border flex items-center gap-3 stat-pill cursor-default"
                        style={{ background: 'rgba(15,24,36,0.5)', borderColor: 'rgba(71,85,105,0.25)' }}>
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: `${s.color}15`, border: `1px solid ${s.color}25` }}>
                          <s.icon className="w-4.5 h-4.5" style={{ color: s.color, width: 18, height: 18 }} />
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-500">{s.sub}</div>
                          <div className="stat-number text-base font-bold text-slate-100">{s.value}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── WEEK VIEW ─────────────────────────────────────────────────── */}
            {view === 'week' && (
              <div className="p-5 space-y-4">
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">7-Day Outlook</h4>

                {/* Global min/max for bar scale */}
                <div className="space-y-2">
                  {daily.map((day, i) => {
                    const isSelected = selectedDay === i;
                    const range = tempRangeForBar.max - tempRangeForBar.min || 1;
                    const barStart = ((day.tempMin - tempRangeForBar.min) / range) * 100;
                    const barWidth = ((day.tempMax - day.tempMin) / range) * 100;

                    return (
                      <div key={day.dt} onClick={() => setSelectedDay(i)}
                        className="day-card rounded-xl border cursor-pointer transition-all duration-200"
                        style={{
                          background: isSelected ? `${accent}10` : 'rgba(15,24,36,0.4)',
                          borderColor: isSelected ? `${accent}40` : 'rgba(71,85,105,0.2)',
                          padding: '10px 14px',
                        }}>
                        <div className="flex items-center gap-3">
                          {/* Day name */}
                          <div className="w-20 flex-shrink-0">
                            <div className={cn("text-xs font-bold", isSelected ? "text-slate-100" : "text-slate-300")}>
                              {formatDayShort(day.dt)}
                            </div>
                            <div className="text-[10px] text-slate-500 mt-0.5 capitalize truncate">{day.description}</div>
                          </div>

                          {/* Icon + rain */}
                          <div className="flex items-center gap-1.5 w-14 flex-shrink-0">
                            <WeatherIcon condition={day.condition} size={20} />
                            {day.pop > 0 && (
                              <span className="text-[10px] text-cyan-400 font-semibold">{day.pop}%</span>
                            )}
                          </div>

                          {/* Temp range bar */}
                          <div className="flex-1 flex items-center gap-2">
                            <span className="stat-number text-xs text-blue-400 font-semibold w-8 text-right">{day.tempMin}°</span>
                            <div className="flex-1 relative h-2 rounded-full" style={{ background: 'rgba(30,41,59,0.8)' }}>
                              <div className="absolute h-full rounded-full transition-all duration-500"
                                style={{
                                  left: `${barStart}%`,
                                  width: `${Math.max(barWidth, 8)}%`,
                                  background: isSelected
                                    ? `linear-gradient(90deg, #3b82f6, ${accent})`
                                    : 'linear-gradient(90deg, #3b82f6, #f97316)',
                                  boxShadow: isSelected ? `0 0 8px ${accent}60` : 'none',
                                }} />
                            </div>
                            <span className="stat-number text-xs text-orange-400 font-semibold w-8">{day.tempMax}°</span>
                          </div>

                          {/* Wind */}
                          <div className="hidden sm:flex items-center gap-1 w-16 flex-shrink-0">
                            <Wind className="w-3 h-3 text-slate-500" />
                            <span className="text-[10px] text-slate-400">{day.windSpeed}km/h</span>
                          </div>

                          {/* Selected chevron */}
                          <ChevronRight className="w-3.5 h-3.5 flex-shrink-0 transition-all"
                            style={{ color: isSelected ? accent : '#334155', transform: isSelected ? 'rotate(90deg)' : 'none' }} />
                        </div>

                        {/* Expanded detail panel */}
                        {isSelected && (
                          <div className="mt-3 pt-3 border-t grid grid-cols-2 md:grid-cols-4 gap-2" style={{ borderColor: `${accent}25` }}>
                            {[
                              { icon: Droplets, label: 'Humidity', value: `${day.humidity}%`, color: '#22d3ee' },
                              { icon: Wind, label: 'Wind', value: `${day.windSpeed} km/h`, color: '#94a3b8' },
                              { icon: CloudRain, label: 'Rain Prob.', value: `${day.pop}%`, color: '#3b82f6' },
                              { icon: Thermometer, label: 'Temp Range', value: `${day.tempMin}–${day.tempMax}°`, color: '#f97316' },
                            ].map(s => (
                              <div key={s.label} className="flex items-center gap-2 p-2 rounded-lg"
                                style={{ background: 'rgba(15,24,36,0.5)', border: `1px solid ${s.color}20` }}>
                                <s.icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: s.color }} />
                                <div>
                                  <div className="text-[10px] text-slate-500">{s.label}</div>
                                  <div className="stat-number text-xs font-bold text-slate-200">{s.value}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Selected day full card */}
                {selectedDayData && (
                  <div className="rounded-xl p-4 border" style={{ background: `${accent}08`, borderColor: `${accent}25` }}>
                    <div className="flex items-center gap-2 mb-3">
                      <WeatherIcon condition={selectedDayData.condition} size={22} />
                      <div>
                        <p className="text-sm font-semibold text-slate-200">{formatDayFull(selectedDayData.dt)}</p>
                        <p className="text-xs text-slate-400 capitalize">{selectedDayData.description}</p>
                      </div>
                    </div>
                    <UVBar value={selectedDayData.uvIndex} />
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}