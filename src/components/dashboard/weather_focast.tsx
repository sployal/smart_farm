'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Wind, Droplets, Eye, Gauge, Sunrise, Sunset,
  Thermometer, CloudRain, CloudSnow, Cloud, Sun,
  Zap, CloudDrizzle, CloudFog, RefreshCw, MapPin,
  ChevronRight, ChevronLeft, ArrowUp, ArrowDown,
  Search, X, Star, Trash2, Check,
} from 'lucide-react';

// ── Utility ────────────────────────────────────────────────────────────────
function cn(...classes: (string | undefined | false | null)[]) {
  return classes.filter(Boolean).join(' ');
}

// ── Config ─────────────────────────────────────────────────────────────────
const API_KEY = process.env.NEXT_PUBLIC_OPENWEATHER_API_KEY ?? '';
const DEFAULT_LOCATION = { lat: -1.286389, lon: 36.817223, name: 'Nairobi', country: 'KE', state: '' };
const STORAGE_KEY = 'weather_user_location';
const SAVED_LOCATIONS_KEY = 'weather_saved_locations';

// ── Types ──────────────────────────────────────────────────────────────────
interface LocationData {
  lat: number;
  lon: number;
  name: string;
  country: string;
  state?: string;
}

interface CurrentWeather {
  temp: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  windDeg: number;
  visibility: number;
  pressure: number;
  uvIndex: number;
  condition: string;
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
  pop: number;
  condition: string;
  windSpeed: number;
  humidity: number;
}

interface DailyPoint {
  dt: number;
  tempMax: number;
  tempMin: number;
  pop: number;
  condition: string;
  description: string;
  humidity: number;
  windSpeed: number;
  uvIndex: number;
}

interface Toast {
  type: 'success' | 'info';
  msg: string;
}

// ── Weather helpers ─────────────────────────────────────────────────────────
function WeatherIcon({ condition, size = 24, className }: { condition: string; size?: number; className?: string }) {
  const s = { width: size, height: size };
  if (condition === 'Clear') return <Sun style={s} className={cn('flex-shrink-0 text-amber-400', className)} />;
  if (condition === 'Rain') return <CloudRain style={s} className={cn('flex-shrink-0 text-cyan-400', className)} />;
  if (condition === 'Drizzle') return <CloudDrizzle style={s} className={cn('flex-shrink-0 text-cyan-300', className)} />;
  if (condition === 'Thunderstorm') return <Zap style={s} className={cn('flex-shrink-0 text-yellow-300', className)} />;
  if (condition === 'Snow') return <CloudSnow style={s} className={cn('flex-shrink-0 text-slate-200', className)} />;
  if (condition === 'Mist' || condition === 'Haze' || condition === 'Fog')
    return <CloudFog style={s} className={cn('flex-shrink-0 text-slate-400', className)} />;
  return <Cloud style={s} className={cn('flex-shrink-0 text-slate-300', className)} />;
}

function conditionGradient(condition: string) {
  if (condition === 'Clear') return 'linear-gradient(135deg, rgba(251,191,36,0.12) 0%, rgba(245,158,11,0.06) 40%, rgba(15,24,36,0.95) 100%)';
  if (condition === 'Rain' || condition === 'Drizzle') return 'linear-gradient(135deg, rgba(6,182,212,0.12) 0%, rgba(37,99,235,0.08) 40%, rgba(15,24,36,0.95) 100%)';
  if (condition === 'Thunderstorm') return 'linear-gradient(135deg, rgba(124,58,237,0.15) 0%, rgba(30,27,75,0.1) 40%, rgba(15,24,36,0.95) 100%)';
  if (condition === 'Snow') return 'linear-gradient(135deg, rgba(148,163,184,0.12) 0%, rgba(203,213,225,0.06) 40%, rgba(15,24,36,0.95) 100%)';
  return 'linear-gradient(135deg, rgba(71,85,105,0.12) 0%, rgba(51,65,85,0.08) 40%, rgba(15,24,36,0.95) 100%)';
}

function accentColor(condition: string) {
  if (condition === 'Clear') return '#fbbf24';
  if (condition === 'Rain' || condition === 'Drizzle') return '#22d3ee';
  if (condition === 'Thunderstorm') return '#a78bfa';
  if (condition === 'Snow') return '#cbd5e1';
  return '#94a3b8';
}

function windDirection(deg: number) {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(deg / 45) % 8];
}

function formatTime(unix: number) {
  return new Date(unix * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

function formatHour(unix: number) {
  const h = new Date(unix * 1000).getHours();
  return h === 0 ? '12 AM' : h === 12 ? '12 PM' : h < 12 ? `${h} AM` : `${h - 12} PM`;
}

function formatDayFull(unix: number) {
  return new Date(unix * 1000).toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
}

function formatDayShort(unix: number) {
  const d = new Date(unix * 1000);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return 'Today';
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  if (d.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
  return d.toLocaleDateString([], { weekday: 'short' });
}

// ── Ambient effects ─────────────────────────────────────────────────────────
const RainDrops = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
    {Array.from({ length: 20 }).map((_, i) => (
      <div key={i} className="absolute w-px rounded-full"
        style={{
          left: `${(i * 17 + 5) % 100}%`,
          top: `-${(i * 7) % 20}px`,
          height: `${(i % 3) * 6 + 8}px`,
          background: 'linear-gradient(to bottom, transparent, #22d3ee)',
          animationName: 'rain',
          animationDuration: `${(i % 3) * 0.4 + 0.6}s`,
          animationDelay: `${(i * 0.1) % 2}s`,
          animationIterationCount: 'infinite',
          animationTimingFunction: 'linear',
        }} />
    ))}
  </div>
);

const Snowflakes = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-30">
    {Array.from({ length: 15 }).map((_, i) => (
      <div key={i} className="absolute text-white text-xs"
        style={{
          left: `${(i * 23 + 3) % 100}%`,
          animationName: 'snow',
          animationDuration: `${(i % 3) * 1 + 2}s`,
          animationDelay: `${(i * 0.2) % 3}s`,
          animationIterationCount: 'infinite',
          animationTimingFunction: 'linear',
        }}>❄</div>
    ))}
  </div>
);

const SunRays = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    <div className="absolute top-6 right-8 w-24 h-24 opacity-10"
      style={{ background: 'radial-gradient(circle, #fbbf24 0%, transparent 70%)', animation: 'pulse 3s ease-in-out infinite' }} />
    <div className="absolute top-4 right-6 w-36 h-36 opacity-5"
      style={{ background: 'radial-gradient(circle, #fbbf24 0%, transparent 70%)', animation: 'pulse 3s ease-in-out infinite', animationDelay: '1s' }} />
  </div>
);

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

// ── Location Search Component ───────────────────────────────────────────────
function LocationSearch({ onSelect, accent, onClose }: {
  onSelect: (loc: LocationData) => void;
  accent: string;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const search = useCallback(async (q: string) => {
    if (!q || q.length < 2) { setResults([]); return; }
    setSearching(true);
    setError(null);
    try {
      const res = await fetch(
        `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(q)}&limit=6&appid=${API_KEY}`
      );
      if (!res.ok) throw new Error('Search failed');
      const data = await res.json();
      setResults(data);
      if (data.length === 0) setError('No locations found. Try a different search.');
    } catch {
      setError('Search failed. Please try again.');
    } finally {
      setSearching(false);
    }
  }, []);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 400);
  };

  return (
    <div className="absolute inset-0 z-50 flex flex-col"
      style={{ background: 'rgba(10,16,28,0.97)', backdropFilter: 'blur(20px)', borderRadius: 'inherit' }}>
      <div className="p-4 border-b" style={{ borderColor: 'rgba(71,85,105,0.3)' }}>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-sm font-semibold text-slate-200">Search Location</span>
          <button onClick={onClose} className="ml-auto p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            ref={inputRef}
            value={query}
            onChange={handleInput}
            placeholder="Search for a city..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm text-slate-200 placeholder-slate-600 outline-none border"
            style={{
              background: 'rgba(15,24,36,0.8)',
              borderColor: query ? `${accent}50` : 'rgba(71,85,105,0.3)',
              transition: 'border-color 0.2s',
            }}
          />
          {searching && (
            <RefreshCw className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 animate-spin" />
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        {error && !searching && (
          <p className="text-center text-slate-500 text-xs py-6">{error}</p>
        )}
        {!error && results.length === 0 && !searching && query.length < 2 && (
          <p className="text-center text-slate-600 text-xs py-6">Type at least 2 characters to search</p>
        )}
        {results.map((loc, i) => (
          <button key={i}
            onClick={() => onSelect({ lat: loc.lat, lon: loc.lon, name: loc.name, country: loc.country, state: loc.state })}
            className="w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all"
            style={{ background: 'rgba(15,24,36,0.5)', borderColor: 'rgba(71,85,105,0.2)' }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = `${accent}50`)}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(71,85,105,0.2)')}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: `${accent}15`, border: `1px solid ${accent}25` }}>
              <MapPin className="w-4 h-4" style={{ color: accent }} />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-slate-200 truncate">{loc.name}</div>
              <div className="text-xs text-slate-500 truncate">
                {[loc.state, loc.country].filter(Boolean).join(', ')}
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-600 ml-auto flex-shrink-0" />
          </button>
        ))}
      </div>

      <div className="p-3 border-t" style={{ borderColor: 'rgba(71,85,105,0.2)' }}>
        <button onClick={() => onSelect(DEFAULT_LOCATION)}
          className="w-full flex items-center gap-2 p-2.5 rounded-xl border text-xs text-slate-400 transition-all hover:text-slate-200"
          style={{ background: 'rgba(15,24,36,0.4)', borderColor: 'rgba(71,85,105,0.2)' }}>
          <MapPin className="w-3.5 h-3.5" />
          Use default: Nairobi, Kenya
        </button>
      </div>
    </div>
  );
}

// ── Saved Locations Panel ──────────────────────────────────────────────────
function SavedLocationsPanel({ savedLocations, currentLocation, accent, onSelect, onDelete, onSaveCurrent, onClose }: {
  savedLocations: LocationData[];
  currentLocation: LocationData | null;
  accent: string;
  onSelect: (loc: LocationData) => void;
  onDelete: (index: number) => void;
  onSaveCurrent: () => void;
  onClose: () => void;
}) {
  return (
    <div className="absolute inset-0 z-50 flex flex-col"
      style={{ background: 'rgba(10,16,28,0.97)', backdropFilter: 'blur(20px)', borderRadius: 'inherit' }}>
      <div className="p-4 border-b" style={{ borderColor: 'rgba(71,85,105,0.3)' }}>
        <div className="flex items-center gap-2">
          <Star className="w-4 h-4" style={{ color: accent }} />
          <span className="text-sm font-semibold text-slate-200">Saved Locations</span>
          <button onClick={onClose} className="ml-auto p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        {savedLocations.length === 0 && (
          <div className="text-center py-10">
            <Star className="w-8 h-8 text-slate-700 mx-auto mb-2" />
            <p className="text-slate-500 text-xs">No saved locations yet.</p>
            <p className="text-slate-600 text-xs mt-1">Save your current location to access it quickly.</p>
          </div>
        )}
        {savedLocations.map((loc, i) => {
          const isCurrent = loc.lat === currentLocation?.lat && loc.lon === currentLocation?.lon;
          return (
            <div key={i} className="flex items-center gap-2 p-3 rounded-xl border"
              style={{
                background: isCurrent ? `${accent}10` : 'rgba(15,24,36,0.5)',
                borderColor: isCurrent ? `${accent}40` : 'rgba(71,85,105,0.2)',
              }}>
              <button onClick={() => onSelect(loc)} className="flex-1 flex items-center gap-3 text-left min-w-0">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: `${accent}15`, border: `1px solid ${accent}25` }}>
                  {isCurrent
                    ? <Check className="w-4 h-4" style={{ color: accent }} />
                    : <MapPin className="w-4 h-4" style={{ color: accent }} />}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-200 truncate">{loc.name}</div>
                  <div className="text-xs text-slate-500 truncate">
                    {[loc.state, loc.country].filter(Boolean).join(', ')}
                    {isCurrent && <span style={{ color: accent }}> · Active</span>}
                  </div>
                </div>
              </button>
              <button onClick={() => onDelete(i)}
                className="p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-400/10 transition-all flex-shrink-0">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      <div className="p-3 border-t" style={{ borderColor: 'rgba(71,85,105,0.2)' }}>
        <button onClick={onSaveCurrent}
          className="w-full flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-semibold transition-all"
          style={{ background: `${accent}15`, borderColor: `${accent}30`, color: accent }}>
          <Star className="w-3.5 h-3.5" />
          Save Current Location
        </button>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────
export function WeatherForecast() {
  // ── ALL hooks declared first, unconditionally ──────────────────────────
  const [view, setView] = useState<'today' | 'week'>('today');
  const [current, setCurrent] = useState<CurrentWeather | null>(null);
  const [hourly, setHourly] = useState<HourlyPoint[]>([]);
  const [daily, setDaily] = useState<DailyPoint[]>([]);
  const [selectedDay, setSelectedDay] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hourlyOffset, setHourlyOffset] = useState(0);
  const [now] = useState(() => new Date());
  const [activeLocation, setActiveLocation] = useState<LocationData | null>(null);
  const [savedLocations, setSavedLocations] = useState<LocationData[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [saveToast, setSaveToast] = useState<Toast | null>(null);

  // ── fetchWeather defined BEFORE the useEffect that calls it ──────────────
  const fetchWeather = useCallback(async (lat: number, lon: number) => {
    setLoading(true);
    setError(null);
    try {
      const [currentRes, forecastRes] = await Promise.all([
        fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric`),
        fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric&cnt=40`),
      ]);
      if (!currentRes.ok || !forecastRes.ok) throw new Error('Weather API error');
      const [cData, fData] = await Promise.all([currentRes.json(), forecastRes.json()]);

      setCurrent({
        temp: Math.round(cData.main.temp),
        feelsLike: Math.round(cData.main.feels_like),
        humidity: cData.main.humidity,
        windSpeed: Math.round((cData.wind?.speed ?? 0) * 3.6),
        windDeg: cData.wind?.deg ?? 0,
        visibility: Math.round((cData.visibility ?? 10000) / 1000),
        pressure: cData.main.pressure,
        uvIndex: 0,
        condition: cData.weather?.[0]?.main ?? 'Clear',
        description: cData.weather?.[0]?.description ?? '',
        icon: cData.weather?.[0]?.icon ?? '01d',
        sunrise: cData.sys?.sunrise ?? 0,
        sunset: cData.sys?.sunset ?? 0,
        cityName: cData.name ?? 'Unknown',
        country: cData.sys?.country ?? '',
        dt: cData.dt,
      });

      const items: any[] = fData.list ?? [];
      setHourly(
        items.slice(0, 16).map(item => ({
          dt: item.dt,
          temp: Math.round(item.main.temp),
          pop: Math.round((item.pop ?? 0) * 100),
          condition: item.weather?.[0]?.main ?? 'Clear',
          windSpeed: Math.round((item.wind?.speed ?? 0) * 3.6),
          humidity: item.main.humidity,
        }))
      );

      const dayMap = new Map<string, any[]>();
      items.forEach(item => {
        const key = new Date(item.dt * 1000).toDateString();
        if (!dayMap.has(key)) dayMap.set(key, []);
        dayMap.get(key)!.push(item);
      });

      setDaily(
        Array.from(dayMap.entries())
          .slice(0, 7)
          .map(([, pts]) => {
            const temps = pts.map((p: any) => p.main.temp as number);
            const midday = pts[Math.floor(pts.length / 2)];
            return {
              dt: pts[0].dt,
              tempMax: Math.round(Math.max(...temps)),
              tempMin: Math.round(Math.min(...temps)),
              pop: Math.round(Math.max(...pts.map((p: any) => p.pop ?? 0)) * 100),
              condition: midday.weather?.[0]?.main ?? 'Clear',
              description: midday.weather?.[0]?.description ?? '',
              humidity: Math.round(pts.reduce((s: number, p: any) => s + p.main.humidity, 0) / pts.length),
              windSpeed: Math.round(pts.reduce((s: number, p: any) => s + (p.wind?.speed ?? 0), 0) / pts.length * 3.6),
              uvIndex: 0,
            };
          })
      );
    } catch {
      setError('Unable to load weather data. Please check your connection.');
    } finally {
      setLoading(false);
    }
  }, []); // no deps — only uses setters which are stable

  // ── Persist helpers ───────────────────────────────────────────────────────
  const persistLocation = useCallback((loc: LocationData) => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(loc)); } catch { /* noop */ }
  }, []);

  const persistSavedLocations = useCallback((locs: LocationData[]) => {
    try { localStorage.setItem(SAVED_LOCATIONS_KEY, JSON.stringify(locs)); } catch { /* noop */ }
  }, []);

  // ── Init: load persisted location, then fetch ─────────────────────────────
  useEffect(() => {
    // Load saved locations list
    try {
      const saved = JSON.parse(localStorage.getItem(SAVED_LOCATIONS_KEY) ?? '[]') as LocationData[];
      setSavedLocations(saved);
    } catch {
      setSavedLocations([]);
    }

    // Determine starting location
    let startLoc: LocationData | null = null;
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as LocationData | null;
      if (stored?.lat && stored?.lon) startLoc = stored;
    } catch { /* noop */ }

    if (startLoc) {
      setActiveLocation(startLoc);
      fetchWeather(startLoc.lat, startLoc.lon);
      return;
    }

    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => {
          const loc: LocationData = {
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
            name: 'Your Location',
            country: '',
          };
          setActiveLocation(loc);
          fetchWeather(loc.lat, loc.lon);
        },
        () => {
          setActiveLocation(DEFAULT_LOCATION);
          fetchWeather(DEFAULT_LOCATION.lat, DEFAULT_LOCATION.lon);
        },
        { timeout: 6000 }
      );
    } else {
      setActiveLocation(DEFAULT_LOCATION);
      fetchWeather(DEFAULT_LOCATION.lat, DEFAULT_LOCATION.lon);
    }
  }, [fetchWeather]); // fetchWeather is stable (no deps in its own useCallback)

  // ── Location select ───────────────────────────────────────────────────────
  const handleLocationSelect = useCallback((loc: LocationData) => {
    setActiveLocation(loc);
    persistLocation(loc);
    fetchWeather(loc.lat, loc.lon);
    setShowSearch(false);
    setShowSaved(false);
    setSelectedDay(0);
    setHourlyOffset(0);
    setView('today');
  }, [fetchWeather, persistLocation]);

  // ── Save current location ─────────────────────────────────────────────────
  const handleSaveCurrentLocation = useCallback(() => {
    if (!activeLocation) return;
    const loc = { ...activeLocation };
    const exists = savedLocations.some(s => s.lat === loc.lat && s.lon === loc.lon);
    if (exists) {
      setSaveToast({ type: 'info', msg: 'Location already saved!' });
      setTimeout(() => setSaveToast(null), 2000);
      return;
    }
    const updated = [...savedLocations, loc];
    setSavedLocations(updated);
    persistSavedLocations(updated);
    setSaveToast({ type: 'success', msg: `${loc.name} saved!` });
    setTimeout(() => setSaveToast(null), 2000);
  }, [activeLocation, savedLocations, persistSavedLocations]);

  // ── Delete saved location ─────────────────────────────────────────────────
  const handleDeleteSaved = useCallback((index: number) => {
    const updated = savedLocations.filter((_, i) => i !== index);
    setSavedLocations(updated);
    persistSavedLocations(updated);
  }, [savedLocations, persistSavedLocations]);

  // ── Derived values ────────────────────────────────────────────────────────
  const accent = current ? accentColor(current.condition) : '#10b981';
  const bg = current ? conditionGradient(current.condition) : conditionGradient('Clear');
  const tempRangeForBar = daily.length
    ? { max: Math.max(...daily.map(d => d.tempMax)), min: Math.min(...daily.map(d => d.tempMin)) }
    : { max: 35, min: 10 };
  const visibleHourly = hourly.slice(hourlyOffset, hourlyOffset + 6);
  const selectedDayData = daily[selectedDay] ?? null;
  const displayName = activeLocation?.name ?? current?.cityName ?? 'Nairobi';
  const displayCountry = activeLocation?.country ?? current?.country ?? 'KE';

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @keyframes rain {
          0%   { transform: translateY(-20px) translateX(0); opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 1; }
          100% { transform: translateY(200px) translateX(10px); opacity: 0; }
        }
        @keyframes snow {
          0%   { transform: translateY(-10px); opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 1; }
          100% { transform: translateY(200px) translateX(20px); opacity: 0; }
        }
        @keyframes float-slow {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-6px); }
        }
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes slide-down {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes arc-draw {
          from { stroke-dashoffset: 150; }
          to   { stroke-dashoffset: 0; }
        }
        .weather-card-anim { animation: fade-in-up 0.5s ease-out forwards; }
        .float-icon        { animation: float-slow 4s ease-in-out infinite; }
        .hourly-card       { transition: transform 0.2s, border-color 0.2s; }
        .hourly-card:hover { transform: translateY(-4px); border-color: rgba(255,255,255,0.15) !important; }
        .day-card:hover    { transform: translateX(3px); }
        .weather-tab       { transition: all 0.3s cubic-bezier(0.4,0,0.2,1); }
        .stat-pill         { transition: all 0.2s ease; }
        .stat-pill:hover   { transform: scale(1.03); }
        .toast-anim        { animation: slide-down 0.3s ease-out; }
        .loc-btn           { transition: all 0.2s ease; }
        .loc-btn:hover     { transform: translateY(-1px); }
        .sun-arc           { stroke-dasharray: 150; animation: arc-draw 1.5s ease-out forwards; }
      `}</style>

      <div className="rounded-2xl overflow-hidden weather-card-anim relative"
        style={{ background: 'rgba(30,41,59,0.6)', border: '1px solid rgba(71,85,105,0.35)', backdropFilter: 'blur(12px)' }}>

        {/* Toast */}
        {saveToast && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-50 toast-anim px-4 py-2 rounded-full text-xs font-semibold shadow-lg"
            style={{ background: `${accent}20`, border: `1px solid ${accent}40`, color: accent }}>
            <div className="flex items-center gap-1.5">
              {saveToast.type === 'success' ? <Check className="w-3.5 h-3.5" /> : <Star className="w-3.5 h-3.5" />}
              {saveToast.msg}
            </div>
          </div>
        )}

        {/* Overlays */}
        {showSearch && (
          <LocationSearch accent={accent} onSelect={handleLocationSelect} onClose={() => setShowSearch(false)} />
        )}
        {showSaved && (
          <SavedLocationsPanel
            savedLocations={savedLocations}
            currentLocation={activeLocation}
            accent={accent}
            onSelect={handleLocationSelect}
            onDelete={handleDeleteSaved}
            onSaveCurrent={handleSaveCurrentLocation}
            onClose={() => setShowSaved(false)}
          />
        )}

        {/* Loading */}
        {loading && (
          <div className="p-8 flex flex-col items-center justify-center gap-4" style={{ minHeight: 280 }}>
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}>
              <RefreshCw className="w-7 h-7 text-emerald-400 animate-spin" />
            </div>
            <div className="text-center">
              <p className="text-slate-300 font-semibold">Fetching weather data...</p>
              <p className="text-slate-500 text-xs mt-1">{displayName}</p>
            </div>
            <div className="w-full max-w-md space-y-2 mt-2">
              {[0.8, 0.6, 0.4].map((op, i) => (
                <div key={i} className="h-8 rounded-xl" style={{ background: `rgba(30,41,59,${op})` }} />
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="p-8 flex flex-col items-center justify-center gap-3 text-center" style={{ minHeight: 200 }}>
            <CloudFog className="w-10 h-10 text-slate-500" />
            <p className="text-slate-400 text-sm">{error}</p>
            <div className="flex gap-2">
              <button onClick={() => setShowSearch(true)}
                className="px-4 py-2 rounded-xl text-xs font-semibold border transition-colors"
                style={{ color: accent, borderColor: `${accent}30`, background: `${accent}10` }}>
                Search Location
              </button>
              <button
                onClick={() => fetchWeather(activeLocation?.lat ?? DEFAULT_LOCATION.lat, activeLocation?.lon ?? DEFAULT_LOCATION.lon)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 border border-slate-700 hover:bg-slate-700 transition-colors">
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Main */}
        {!loading && !error && current && (
          <>
            {/* Hero */}
            <div className="relative overflow-hidden p-5 md:p-6"
              style={{ background: bg, borderBottom: '1px solid rgba(71,85,105,0.2)' }}>
              {(current.condition === 'Rain' || current.condition === 'Drizzle') && <RainDrops />}
              {current.condition === 'Snow' && <Snowflakes />}
              {current.condition === 'Clear' && <SunRays />}

              <div className="relative flex flex-col md:flex-row md:items-start justify-between gap-4">
                {/* Left */}
                <div className="flex-1">
                  {/* Location row */}
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <button onClick={() => { setShowSearch(true); setShowSaved(false); }}
                      className="loc-btn flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold"
                      style={{ background: 'rgba(15,24,36,0.5)', borderColor: `${accent}50`, color: accent }}>
                      <MapPin className="w-3 h-3" />
                      {displayName}, {displayCountry}
                      <Search className="w-3 h-3 ml-0.5 opacity-60" />
                    </button>

                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs text-slate-400"
                      style={{ background: 'rgba(15,24,36,0.5)', borderColor: 'rgba(71,85,105,0.3)' }}>
                      <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: accent }} />
                      Live · {now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
                    </div>

                    <button
                      onClick={() => { setShowSaved(true); setShowSearch(false); }}
                      className="loc-btn flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs text-slate-400"
                      style={{ background: 'rgba(15,24,36,0.5)', borderColor: 'rgba(71,85,105,0.3)' }}
                      title={`${savedLocations.length} saved location${savedLocations.length !== 1 ? 's' : ''}`}>
                      <Star className="w-3 h-3" style={{ color: savedLocations.length > 0 ? accent : undefined }} />
                      {savedLocations.length > 0 ? savedLocations.length : 'Save'}
                    </button>
                  </div>

                  {/* Temp */}
                  <div className="flex items-center gap-4 mb-2">
                    <div className="float-icon">
                      <WeatherIcon condition={current.condition} size={56} />
                    </div>
                    <div>
                      <div className="flex items-start leading-none">
                        <span className="text-6xl md:text-7xl font-bold text-slate-100">{current.temp}</span>
                        <span className="text-2xl text-slate-400 font-light mt-2">°C</span>
                      </div>
                      <p className="text-slate-300 text-sm font-medium capitalize mt-1">{current.description}</p>
                      <p className="text-slate-500 text-xs mt-0.5">Feels like {current.feelsLike}°C</p>
                    </div>
                  </div>
                </div>

                {/* Right: stat pills */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:min-w-[320px]">
                  {([
                    { icon: Droplets, label: 'Humidity',  value: `${current.humidity}%`,                                    color: '#22d3ee' },
                    { icon: Wind,     label: 'Wind',      value: `${current.windSpeed} km/h ${windDirection(current.windDeg)}`, color: '#94a3b8' },
                    { icon: Eye,      label: 'Visibility',value: `${current.visibility} km`,                                color: '#a78bfa' },
                    { icon: Gauge,    label: 'Pressure',  value: `${current.pressure} hPa`,                                 color: '#fb923c' },
                    { icon: Sunrise,  label: 'Sunrise',   value: formatTime(current.sunrise),                               color: '#fbbf24' },
                    { icon: Sunset,   label: 'Sunset',    value: formatTime(current.sunset),                                color: '#f97316' },
                  ] as const).map(stat => (
                    <div key={stat.label} className="stat-pill flex items-center gap-2 p-2.5 rounded-xl border cursor-default"
                      style={{ background: 'rgba(15,24,36,0.55)', borderColor: 'rgba(71,85,105,0.3)' }}>
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: `${stat.color}18`, border: `1px solid ${stat.color}25` }}>
                        <stat.icon className="w-3.5 h-3.5" style={{ color: stat.color }} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[10px] text-slate-500 leading-none">{stat.label}</div>
                        <div className="text-xs font-bold text-slate-200 mt-0.5 truncate">{stat.value}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* View toggle */}
              <div className="mt-4 flex gap-1 p-1 rounded-xl w-fit"
                style={{ background: 'rgba(15,24,36,0.6)', border: '1px solid rgba(71,85,105,0.3)' }}>
                {(['today', 'week'] as const).map(v => (
                  <button key={v} onClick={() => { setView(v); setSelectedDay(0); setHourlyOffset(0); }}
                    className="weather-tab px-5 py-2 rounded-lg text-xs font-semibold capitalize"
                    style={{
                      background: view === v ? accent : 'transparent',
                      color:      view === v ? '#0f1824' : '#94a3b8',
                      boxShadow:  view === v ? `0 4px 12px ${accent}40` : 'none',
                    }}>
                    {v === 'today' ? '⏱ Today' : '📅 7-Day'}
                  </button>
                ))}
                <button
                  onClick={() => fetchWeather(activeLocation?.lat ?? DEFAULT_LOCATION.lat, activeLocation?.lon ?? DEFAULT_LOCATION.lon)}
                  className="ml-1 p-2 rounded-lg text-slate-500 hover:text-slate-300 transition-colors" title="Refresh">
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* TODAY */}
            {view === 'today' && (
              <div className="p-5 space-y-5">
                {/* Hourly */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Hourly Forecast</h4>
                    <div className="flex gap-1">
                      <button onClick={() => setHourlyOffset(o => Math.max(0, o - 3))}
                        disabled={hourlyOffset === 0}
                        className="p-1.5 rounded-lg border border-slate-700 text-slate-400 hover:text-slate-200 disabled:opacity-30 transition-all hover:bg-slate-700">
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setHourlyOffset(o => Math.min(hourly.length - 6, o + 3))}
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
                        <div key={h.dt} className="hourly-card flex flex-col items-center gap-1.5 p-2.5 md:p-3 rounded-xl border cursor-default"
                          style={{
                            background:   isNowSlot ? `${accent}18` : 'rgba(15,24,36,0.5)',
                            borderColor:  isNowSlot ? `${accent}40` : 'rgba(71,85,105,0.25)',
                          }}>
                          <span className="text-[10px] font-semibold" style={{ color: isNowSlot ? accent : '#64748b' }}>
                            {isNowSlot ? 'Now' : formatHour(h.dt)}
                          </span>
                          <WeatherIcon condition={h.condition} size={20} />
                          <span className="text-sm font-bold text-slate-100">{h.temp}°</span>
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

                {/* Sun arc */}
                <div className="rounded-xl p-4 border" style={{ background: 'rgba(15,24,36,0.5)', borderColor: 'rgba(71,85,105,0.25)' }}>
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Sun Arc</h4>
                  <div className="flex items-end justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Sunrise className="w-5 h-5 text-amber-400" />
                      <div>
                        <div className="text-[10px] text-slate-500">Sunrise</div>
                        <div className="text-sm font-bold text-amber-400">{formatTime(current.sunrise)}</div>
                      </div>
                    </div>
                    <div className="flex-1 relative flex items-end justify-center" style={{ height: 60 }}>
                      <svg width="100%" height="60" viewBox="0 0 200 60" preserveAspectRatio="none">
                        <path d="M 10 55 Q 100 -10 190 55" stroke="rgba(71,85,105,0.3)" strokeWidth="2" fill="none" />
                        <path d="M 10 55 Q 100 -10 190 55" stroke={accent} strokeWidth="2.5" fill="none" strokeLinecap="round" className="sun-arc" />
                        <circle cx="100" cy="5" r="5" fill={accent} style={{ filter: `drop-shadow(0 0 6px ${accent})` }} />
                      </svg>
                      <div className="absolute bottom-0 left-1/2 -translate-x-1/2">
                        <div className="text-[10px] text-slate-500 text-center">{formatTime(current.dt)}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-right">
                      <div>
                        <div className="text-[10px] text-slate-500">Sunset</div>
                        <div className="text-sm font-bold text-orange-400">{formatTime(current.sunset)}</div>
                      </div>
                      <Sunset className="w-5 h-5 text-orange-400" />
                    </div>
                  </div>
                </div>

                {/* Today stats */}
                {daily[0] && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {([
                      { label: 'High',       value: `${daily[0].tempMax}°C`, icon: ArrowUp,    color: '#ef4444', sub: "Today's max" },
                      { label: 'Low',        value: `${daily[0].tempMin}°C`, icon: ArrowDown,  color: '#3b82f6', sub: "Today's min" },
                      { label: 'Rain Chance',value: `${daily[0].pop}%`,      icon: CloudRain,  color: '#22d3ee', sub: 'Precipitation' },
                      { label: 'Humidity',   value: `${daily[0].humidity}%`, icon: Droplets,   color: '#a78bfa', sub: 'Relative humidity' },
                    ] as const).map(s => (
                      <div key={s.label} className="p-3 rounded-xl border flex items-center gap-3 stat-pill cursor-default"
                        style={{ background: 'rgba(15,24,36,0.5)', borderColor: 'rgba(71,85,105,0.25)' }}>
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: `${s.color}15`, border: `1px solid ${s.color}25` }}>
                          <s.icon style={{ color: s.color, width: 18, height: 18 }} />
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-500">{s.sub}</div>
                          <div className="text-base font-bold text-slate-100">{s.value}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* WEEK */}
            {view === 'week' && (
              <div className="p-5 space-y-4">
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">7-Day Outlook</h4>
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
                          background:  isSelected ? `${accent}10` : 'rgba(15,24,36,0.4)',
                          borderColor: isSelected ? `${accent}40` : 'rgba(71,85,105,0.2)',
                          padding: '10px 14px',
                        }}>
                        <div className="flex items-center gap-3">
                          <div className="w-20 flex-shrink-0">
                            <div className={`text-xs font-bold ${isSelected ? 'text-slate-100' : 'text-slate-300'}`}>
                              {formatDayShort(day.dt)}
                            </div>
                            <div className="text-[10px] text-slate-500 mt-0.5 capitalize truncate">{day.description}</div>
                          </div>
                          <div className="flex items-center gap-1.5 w-14 flex-shrink-0">
                            <WeatherIcon condition={day.condition} size={20} />
                            {day.pop > 0 && <span className="text-[10px] text-cyan-400 font-semibold">{day.pop}%</span>}
                          </div>
                          <div className="flex-1 flex items-center gap-2">
                            <span className="text-xs text-blue-400 font-semibold w-8 text-right">{day.tempMin}°</span>
                            <div className="flex-1 relative h-2 rounded-full" style={{ background: 'rgba(30,41,59,0.8)' }}>
                              <div className="absolute h-full rounded-full transition-all duration-500"
                                style={{
                                  left:      `${barStart}%`,
                                  width:     `${Math.max(barWidth, 8)}%`,
                                  background: isSelected
                                    ? `linear-gradient(90deg, #3b82f6, ${accent})`
                                    : 'linear-gradient(90deg, #3b82f6, #f97316)',
                                  boxShadow: isSelected ? `0 0 8px ${accent}60` : 'none',
                                }} />
                            </div>
                            <span className="text-xs text-orange-400 font-semibold w-8">{day.tempMax}°</span>
                          </div>
                          <div className="hidden sm:flex items-center gap-1 w-16 flex-shrink-0">
                            <Wind className="w-3 h-3 text-slate-500" />
                            <span className="text-[10px] text-slate-400">{day.windSpeed}km/h</span>
                          </div>
                          <ChevronRight className="w-3.5 h-3.5 flex-shrink-0 transition-all"
                            style={{ color: isSelected ? accent : '#334155', transform: isSelected ? 'rotate(90deg)' : 'none' }} />
                        </div>

                        {isSelected && (
                          <div className="mt-3 pt-3 border-t grid grid-cols-2 md:grid-cols-4 gap-2"
                            style={{ borderColor: `${accent}25` }}>
                            {([
                              { icon: Droplets,   label: 'Humidity',   value: `${day.humidity}%`,              color: '#22d3ee' },
                              { icon: Wind,       label: 'Wind',       value: `${day.windSpeed} km/h`,         color: '#94a3b8' },
                              { icon: CloudRain,  label: 'Rain Prob.', value: `${day.pop}%`,                   color: '#3b82f6' },
                              { icon: Thermometer,label: 'Temp Range', value: `${day.tempMin}–${day.tempMax}°`,color: '#f97316' },
                            ] as const).map(s => (
                              <div key={s.label} className="flex items-center gap-2 p-2 rounded-lg"
                                style={{ background: 'rgba(15,24,36,0.5)', border: `1px solid ${s.color}20` }}>
                                <s.icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: s.color }} />
                                <div>
                                  <div className="text-[10px] text-slate-500">{s.label}</div>
                                  <div className="text-xs font-bold text-slate-200">{s.value}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

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