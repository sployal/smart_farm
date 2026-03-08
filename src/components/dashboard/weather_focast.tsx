'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Wind, Droplets, Eye, Gauge, Sunrise, Sunset,
  Thermometer, CloudRain, CloudSnow, Cloud, Sun,
  Zap, CloudDrizzle, CloudFog, RefreshCw, MapPin,
  ChevronRight, ChevronLeft, ArrowUp, ArrowDown,
  Search, X, Star, Trash2, Check, Plus,
} from 'lucide-react';

// ── Config ─────────────────────────────────────────────────────────────────
const API_KEY = process.env.NEXT_PUBLIC_OPENWEATHER_API_KEY ?? '';
const DEFAULT_LOCATION = { lat: -1.286389, lon: 36.817223, name: 'Nairobi', country: 'KE', state: '' };
const STORAGE_KEY = 'weather_user_location';
const SAVED_LOCATIONS_KEY = 'weather_saved_locations';

// ── Types ──────────────────────────────────────────────────────────────────
interface LocationData {
  lat: number; lon: number; name: string; country: string; state?: string;
}
interface CurrentWeather {
  temp: number; feelsLike: number; humidity: number; windSpeed: number; windDeg: number;
  visibility: number; pressure: number; uvIndex: number; condition: string;
  description: string; icon: string; sunrise: number; sunset: number;
  cityName: string; country: string; dt: number;
}
interface HourlyPoint {
  dt: number; temp: number; pop: number; condition: string; windSpeed: number; humidity: number;
}
interface DailyPoint {
  dt: number; tempMax: number; tempMin: number; pop: number; condition: string;
  description: string; humidity: number; windSpeed: number; uvIndex: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────
function WeatherIcon({ condition, size = 24, color }: { condition: string; size?: number; color?: string }) {
  const s = { width: size, height: size, flexShrink: 0 as const, color };
  if (condition === 'Clear') return <Sun style={s} />;
  if (condition === 'Rain') return <CloudRain style={s} />;
  if (condition === 'Drizzle') return <CloudDrizzle style={s} />;
  if (condition === 'Thunderstorm') return <Zap style={s} />;
  if (condition === 'Snow') return <CloudSnow style={s} />;
  if (['Mist', 'Haze', 'Fog'].includes(condition)) return <CloudFog style={s} />;
  return <Cloud style={s} />;
}

function conditionAccent(c: string) {
  if (c === 'Clear') return '#d97706';
  if (c === 'Rain' || c === 'Drizzle') return '#0891b2';
  if (c === 'Thunderstorm') return '#7c3aed';
  if (c === 'Snow') return '#64748b';
  return '#2d6a4f';
}

function conditionIconColor(c: string) {
  if (c === 'Clear') return '#d97706';
  if (c === 'Rain' || c === 'Drizzle') return '#0891b2';
  if (c === 'Thunderstorm') return '#7c3aed';
  if (c === 'Snow') return '#64748b';
  return '#40916c';
}

function windDirection(deg: number) {
  return ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(deg / 45) % 8];
}
function formatTime(unix: number) {
  return new Date(unix * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}
function formatHour(unix: number) {
  const h = new Date(unix * 1000).getHours();
  return h === 0 ? '12 AM' : h === 12 ? '12 PM' : h < 12 ? `${h} AM` : `${h - 12} PM`;
}
function formatDayShort(unix: number) {
  const d = new Date(unix * 1000);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return 'Today';
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  if (d.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
  return d.toLocaleDateString([], { weekday: 'short' });
}
function formatDayFull(unix: number) {
  return new Date(unix * 1000).toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
}

// ── Ambient Rain — barely visible, 15% opacity ─────────────────────────────
function AmbientRain({ intensity = 18 }: { intensity?: number }) {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
      {Array.from({ length: intensity }).map((_, i) => {
        const left = `${(i * 19 + 3) % 100}%`;
        const dur = `${0.55 + (i % 4) * 0.18}s`;
        const delay = `${(i * 0.13) % 2.2}s`;
        const h = 8 + (i % 3) * 5;
        const opacity = 0.04 + (i % 3) * 0.025;
        return (
          <div key={i} style={{
            position: 'absolute',
            left,
            top: -h,
            width: 1,
            height: h,
            borderRadius: 100,
            background: 'linear-gradient(to bottom, transparent, #0891b2)',
            opacity,
            animation: `sfRain ${dur} ${delay} linear infinite`,
          }} />
        );
      })}
    </div>
  );
}

// ── Ambient Sun glow ───────────────────────────────────────────────────────
function AmbientSun() {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
      <div style={{
        position: 'absolute', top: -20, right: -20, width: 180, height: 180,
        background: 'radial-gradient(circle, rgba(251,191,36,0.13) 0%, transparent 70%)',
        animation: 'sfGlow 4s ease-in-out infinite',
      }} />
      <div style={{
        position: 'absolute', top: 10, right: 10, width: 80, height: 80,
        background: 'radial-gradient(circle, rgba(251,191,36,0.08) 0%, transparent 70%)',
        animation: 'sfGlow 4s ease-in-out infinite',
        animationDelay: '1.5s',
      }} />
    </div>
  );
}

// ── Location Search overlay ────────────────────────────────────────────────
function LocationSearch({ accent, onSelect, onClose }: {
  accent: string;
  onSelect: (loc: LocationData) => void;
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
    setSearching(true); setError(null);
    try {
      const res = await fetch(`https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(q)}&limit=6&appid=${API_KEY}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setResults(data);
      if (!data.length) setError('No locations found. Try a different search.');
    } catch { setError('Search failed. Please try again.'); }
    finally { setSearching(false); }
  }, []);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value; setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 380);
  };

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 60,
      background: 'rgba(249,245,239,0.97)', backdropFilter: 'blur(16px)',
      borderRadius: 'inherit', display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ padding: '18px 22px', borderBottom: '1px solid rgba(160,130,90,0.14)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 15, fontWeight: 600, color: '#1c1a15' }}>Search Location</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9a8870', padding: 6, borderRadius: 8 }}>
            <X size={15} />
          </button>
        </div>
        <div style={{ position: 'relative' }}>
          <Search size={14} color="#b0a088" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
          <input ref={inputRef} value={query} onChange={handleInput} placeholder="Search for a city..."
            style={{
              width: '100%', paddingLeft: 36, paddingRight: 36, paddingTop: 10, paddingBottom: 10,
              borderRadius: 11, fontSize: 13.5, fontFamily: "'DM Sans', sans-serif", color: '#1c1a15',
              background: '#fff', border: `1px solid ${query ? accent + '55' : 'rgba(160,130,90,0.22)'}`,
              outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s',
            }} />
          {searching && <RefreshCw size={13} color="#b0a088" style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', animation: 'sfSpin 1s linear infinite' }} />}
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 5 }}>
        {error && <p style={{ textAlign: 'center', color: '#b0a088', fontSize: 12.5, padding: '20px 0', fontFamily: "'DM Sans', sans-serif" }}>{error}</p>}
        {!error && !results.length && !searching && query.length < 2 && (
          <p style={{ textAlign: 'center', color: '#b0a088', fontSize: 12.5, padding: '20px 0', fontFamily: "'DM Sans', sans-serif" }}>Type at least 2 characters to search</p>
        )}
        {results.map((loc, i) => (
          <button key={i} onClick={() => onSelect({ lat: loc.lat, lon: loc.lon, name: loc.name, country: loc.country, state: loc.state })}
            style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px',
              borderRadius: 12, border: '1px solid rgba(160,130,90,0.18)', background: '#fff',
              cursor: 'pointer', textAlign: 'left', width: '100%', fontFamily: "'DM Sans', sans-serif",
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#f0faf2'; (e.currentTarget as HTMLElement).style.borderColor = `${accent}50`; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#fff'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(160,130,90,0.18)'; }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: `${accent}14`, border: `1px solid ${accent}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <MapPin size={14} color={accent} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: '#1c1a15', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{loc.name}</div>
              <div style={{ fontSize: 11.5, color: '#9a8870', marginTop: 1 }}>{[loc.state, loc.country].filter(Boolean).join(', ')}</div>
            </div>
            <ChevronRight size={13} color="#b0a088" />
          </button>
        ))}
      </div>
      <div style={{ padding: '10px 14px', borderTop: '1px solid rgba(160,130,90,0.12)' }}>
        <button onClick={() => onSelect(DEFAULT_LOCATION)}
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px', borderRadius: 11, border: '1px solid rgba(160,130,90,0.2)', background: '#f9f5ef', cursor: 'pointer', fontSize: 12.5, color: '#9a8870', fontFamily: "'DM Sans', sans-serif" }}>
          <MapPin size={12} /> Use default: Nairobi, Kenya
        </button>
      </div>
    </div>
  );
}

// ── Saved Locations Panel ──────────────────────────────────────────────────
function SavedLocationsPanel({ savedLocations, currentLocation, accent, onSelect, onDelete, onSaveCurrent, onClose }: {
  savedLocations: LocationData[]; currentLocation: LocationData | null; accent: string;
  onSelect: (loc: LocationData) => void; onDelete: (i: number) => void;
  onSaveCurrent: () => void; onClose: () => void;
}) {
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 60,
      background: 'rgba(249,245,239,0.97)', backdropFilter: 'blur(16px)',
      borderRadius: 'inherit', display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ padding: '18px 22px', borderBottom: '1px solid rgba(160,130,90,0.14)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <Star size={14} color={accent} />
        <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 15, fontWeight: 600, color: '#1c1a15' }}>Saved Locations</span>
        <button onClick={onClose} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#9a8870', padding: 6, borderRadius: 8 }}><X size={15} /></button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 5 }}>
        {!savedLocations.length && (
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <Star size={28} color="#d4c4a8" style={{ margin: '0 auto 8px', display: 'block' }} />
            <p style={{ fontSize: 12.5, color: '#9a8870', fontFamily: "'DM Sans', sans-serif" }}>No saved locations yet.</p>
          </div>
        )}
        {savedLocations.map((loc, i) => {
          const isCurrent = loc.lat === currentLocation?.lat && loc.lon === currentLocation?.lon;
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 14px', borderRadius: 12, background: isCurrent ? `${accent}10` : '#fff', border: `1px solid ${isCurrent ? accent + '35' : 'rgba(160,130,90,0.18)'}` }}>
              <button onClick={() => onSelect(loc)} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', minWidth: 0 }}>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: `${accent}14`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {isCurrent ? <Check size={13} color={accent} /> : <MapPin size={13} color={accent} />}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: '#1c1a15', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: "'DM Sans', sans-serif" }}>{loc.name}</div>
                  <div style={{ fontSize: 11.5, color: '#9a8870', fontFamily: "'DM Sans', sans-serif" }}>
                    {[loc.state, loc.country].filter(Boolean).join(', ')}
                    {isCurrent && <span style={{ color: accent }}> · Active</span>}
                  </div>
                </div>
              </button>
              <button onClick={() => onDelete(i)} style={{ padding: 6, borderRadius: 7, background: 'none', border: 'none', cursor: 'pointer', color: '#b0a088', transition: 'all 0.15s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#fee2e2'; (e.currentTarget as HTMLElement).style.color = '#dc2626'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none'; (e.currentTarget as HTMLElement).style.color = '#b0a088'; }}>
                <Trash2 size={13} />
              </button>
            </div>
          );
        })}
      </div>
      <div style={{ padding: '10px 14px', borderTop: '1px solid rgba(160,130,90,0.12)' }}>
        <button onClick={onSaveCurrent}
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '10px', borderRadius: 11, border: `1px solid ${accent}30`, background: `${accent}10`, cursor: 'pointer', fontSize: 12.5, fontWeight: 600, color: accent, fontFamily: "'DM Sans', sans-serif" }}>
          <Star size={12} /> Save Current Location
        </button>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────
export function WeatherForecast() {
  const [view, setView] = useState<'today' | 'week'>('today');
  const [current, setCurrent] = useState<CurrentWeather | null>(null);
  const [hourly, setHourly] = useState<HourlyPoint[]>([]);
  const [daily, setDaily] = useState<DailyPoint[]>([]);
  const [selectedDay, setSelectedDay] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hourlyOffset, setHourlyOffset] = useState(0);
  const [activeLocation, setActiveLocation] = useState<LocationData | null>(null);
  const [savedLocations, setSavedLocations] = useState<LocationData[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const fetchWeather = useCallback(async (lat: number, lon: number) => {
    setLoading(true); setError(null);
    try {
      const [cRes, fRes] = await Promise.all([
        fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric`),
        fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric&cnt=40`),
      ]);
      if (!cRes.ok || !fRes.ok) throw new Error();
      const [cData, fData] = await Promise.all([cRes.json(), fRes.json()]);

      setCurrent({
        temp: Math.round(cData.main.temp), feelsLike: Math.round(cData.main.feels_like),
        humidity: cData.main.humidity, windSpeed: Math.round((cData.wind?.speed ?? 0) * 3.6),
        windDeg: cData.wind?.deg ?? 0, visibility: Math.round((cData.visibility ?? 10000) / 1000),
        pressure: cData.main.pressure, uvIndex: 0,
        condition: cData.weather?.[0]?.main ?? 'Clear',
        description: cData.weather?.[0]?.description ?? '',
        icon: cData.weather?.[0]?.icon ?? '01d',
        sunrise: cData.sys?.sunrise ?? 0, sunset: cData.sys?.sunset ?? 0,
        cityName: cData.name ?? 'Unknown', country: cData.sys?.country ?? '', dt: cData.dt,
      });

      const items: any[] = fData.list ?? [];
      setHourly(items.slice(0, 16).map(item => ({
        dt: item.dt, temp: Math.round(item.main.temp), pop: Math.round((item.pop ?? 0) * 100),
        condition: item.weather?.[0]?.main ?? 'Clear', windSpeed: Math.round((item.wind?.speed ?? 0) * 3.6),
        humidity: item.main.humidity,
      })));

      const dayMap = new Map<string, any[]>();
      items.forEach(item => {
        const key = new Date(item.dt * 1000).toDateString();
        if (!dayMap.has(key)) dayMap.set(key, []);
        dayMap.get(key)!.push(item);
      });
      setDaily(Array.from(dayMap.entries()).slice(0, 7).map(([, pts]) => {
        const temps = pts.map((p: any) => p.main.temp as number);
        const midday = pts[Math.floor(pts.length / 2)];
        return {
          dt: pts[0].dt, tempMax: Math.round(Math.max(...temps)), tempMin: Math.round(Math.min(...temps)),
          pop: Math.round(Math.max(...pts.map((p: any) => p.pop ?? 0)) * 100),
          condition: midday.weather?.[0]?.main ?? 'Clear', description: midday.weather?.[0]?.description ?? '',
          humidity: Math.round(pts.reduce((s: number, p: any) => s + p.main.humidity, 0) / pts.length),
          windSpeed: Math.round(pts.reduce((s: number, p: any) => s + (p.wind?.speed ?? 0), 0) / pts.length * 3.6),
          uvIndex: 0,
        };
      }));
    } catch { setError('Unable to load weather data.'); }
    finally { setLoading(false); }
  }, []);

  const persistLoc = useCallback((loc: LocationData) => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(loc)); } catch {} }, []);
  const persistSaved = useCallback((locs: LocationData[]) => { try { localStorage.setItem(SAVED_LOCATIONS_KEY, JSON.stringify(locs)); } catch {} }, []);

  useEffect(() => {
    try { setSavedLocations(JSON.parse(localStorage.getItem(SAVED_LOCATIONS_KEY) ?? '[]')); } catch { setSavedLocations([]); }
    let startLoc: LocationData | null = null;
    try { const s = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null'); if (s?.lat && s?.lon) startLoc = s; } catch {}
    if (startLoc) { setActiveLocation(startLoc); fetchWeather(startLoc.lat, startLoc.lon); return; }
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => { const loc = { lat: pos.coords.latitude, lon: pos.coords.longitude, name: 'Your Location', country: '' }; setActiveLocation(loc); fetchWeather(loc.lat, loc.lon); },
        () => { setActiveLocation(DEFAULT_LOCATION); fetchWeather(DEFAULT_LOCATION.lat, DEFAULT_LOCATION.lon); },
        { timeout: 6000 }
      );
    } else { setActiveLocation(DEFAULT_LOCATION); fetchWeather(DEFAULT_LOCATION.lat, DEFAULT_LOCATION.lon); }
  }, [fetchWeather]);

  const handleLocationSelect = useCallback((loc: LocationData) => {
    setActiveLocation(loc); persistLoc(loc); fetchWeather(loc.lat, loc.lon);
    setShowSearch(false); setShowSaved(false); setSelectedDay(0); setHourlyOffset(0); setView('today');
  }, [fetchWeather, persistLoc]);

  const handleSaveCurrent = useCallback(() => {
    if (!activeLocation) return;
    if (savedLocations.some(s => s.lat === activeLocation.lat && s.lon === activeLocation.lon)) {
      setToast('Already saved!'); setTimeout(() => setToast(null), 2000); return;
    }
    const updated = [...savedLocations, activeLocation]; setSavedLocations(updated); persistSaved(updated);
    setToast(`${activeLocation.name} saved!`); setTimeout(() => setToast(null), 2000);
  }, [activeLocation, savedLocations, persistSaved]);

  const handleDeleteSaved = useCallback((i: number) => {
    const updated = savedLocations.filter((_, idx) => idx !== i); setSavedLocations(updated); persistSaved(updated);
  }, [savedLocations, persistSaved]);

  const accent = current ? conditionAccent(current.condition) : '#2d6a4f';
  const iconColor = current ? conditionIconColor(current.condition) : '#40916c';
  const isRainy = current && (current.condition === 'Rain' || current.condition === 'Drizzle');
  const isSunny = current && current.condition === 'Clear';
  const tempRange = daily.length
    ? { max: Math.max(...daily.map(d => d.tempMax)), min: Math.min(...daily.map(d => d.tempMin)) }
    : { max: 35, min: 10 };
  const visibleHourly = hourly.slice(hourlyOffset, hourlyOffset + 6);
  const displayName = activeLocation?.name ?? current?.cityName ?? 'Nairobi';
  const displayCountry = activeLocation?.country ?? current?.country ?? 'KE';

  const statusBadge = (label: string, color: string, bg: string, border: string): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 100,
    fontSize: 11, fontWeight: 700, background: bg, color, border: `1px solid ${border}`,
    fontFamily: "'DM Sans', sans-serif",
  });

  // card styling matching dashboard
  const cardBase: React.CSSProperties = {
    border: '1px solid rgba(160,130,90,0.16)',
    borderRadius: 14,
    boxShadow: '0 2px 8px rgba(100,70,30,0.06)',
    background: '#fff',
  };

  return (
    <>
      <style>{`
        @keyframes sfRain {
          0%   { transform: translateY(-20px); opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 1; }
          100% { transform: translateY(240px); opacity: 0; }
        }
        @keyframes sfGlow {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.5; transform: scale(1.08); }
        }
        @keyframes sfSpin  { to { transform: rotate(360deg); } }
        @keyframes sfPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
        @keyframes sfFloat {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-6px); }
        }
        @keyframes sfSlideIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes sfArc {
          from { stroke-dashoffset: 160; }
          to   { stroke-dashoffset: 0; }
        }
        .sf-float   { animation: sfFloat 4s ease-in-out infinite; }
        .sf-spin    { animation: sfSpin 1s linear infinite; }
        .sf-pulse   { animation: sfPulse 2s ease-in-out infinite; }
        .sf-slidein { animation: sfSlideIn 0.4s ease-out forwards; }
        .sf-arc     { stroke-dasharray: 160; animation: sfArc 1.6s ease-out forwards; }
        .sf-hover-lift {
          transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s;
        }
        .sf-hover-lift:hover {
          transform: translateY(-3px);
          box-shadow: 0 8px 24px rgba(100,70,30,0.1);
        }
        .sf-day-row { transition: all 0.18s; }
        .sf-day-row:hover { transform: translateX(3px); }
      `}</style>

      <div style={{ marginBottom: 22 }}>
        {/* Section header matching dashboard style */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <h2 style={{ fontWeight: 700, fontSize: 16, color: '#1c1a15', fontFamily: "'Space Grotesk', sans-serif", margin: 0 }}>Weather Forecast</h2>
            <p style={{ fontSize: 12, color: '#9a8870', marginTop: 2, fontFamily: "'DM Sans', sans-serif" }}>
              {displayName}, {displayCountry} · Live conditions
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { setShowSaved(true); setShowSearch(false); }}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 100, fontSize: 12.5, fontWeight: 500, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", border: '1px solid rgba(160,130,90,0.22)', background: '#fff', color: savedLocations.length ? accent : '#9a8870', transition: 'all 0.15s' }}>
              <Star size={12} color={savedLocations.length ? accent : undefined} />
              {savedLocations.length > 0 ? savedLocations.length : 'Saved'}
            </button>
            <button onClick={() => { setShowSearch(true); setShowSaved(false); }}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 100, fontSize: 12.5, fontWeight: 500, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", border: '1px solid rgba(160,130,90,0.22)', background: '#fff', color: '#9a8870', transition: 'all 0.15s' }}>
              <MapPin size={12} /> Change
            </button>
          </div>
        </div>

        {/* Main card */}
        <div style={{ ...cardBase, borderRadius: 18, overflow: 'hidden', position: 'relative' }}>

          {/* Toast */}
          {toast && (
            <div className="sf-slidein" style={{
              position: 'absolute', top: 14, left: '50%', transform: 'translateX(-50%)', zIndex: 70,
              padding: '6px 16px', borderRadius: 100, fontSize: 12, fontWeight: 700,
              background: `${accent}18`, border: `1px solid ${accent}40`, color: accent,
              display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
              fontFamily: "'DM Sans', sans-serif", boxShadow: '0 4px 16px rgba(100,70,30,0.12)',
            }}>
              <Check size={11} /> {toast}
            </div>
          )}

          {showSearch && <LocationSearch accent={accent} onSelect={handleLocationSelect} onClose={() => setShowSearch(false)} />}
          {showSaved && (
            <SavedLocationsPanel
              savedLocations={savedLocations} currentLocation={activeLocation} accent={accent}
              onSelect={handleLocationSelect} onDelete={handleDeleteSaved}
              onSaveCurrent={handleSaveCurrent} onClose={() => setShowSaved(false)}
            />
          )}

          {/* Loading state */}
          {loading && (
            <div style={{ padding: '48px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: '#f0faf2', border: '1px solid rgba(45,106,79,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <RefreshCw size={22} color="#2d6a4f" className="sf-spin" />
              </div>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: '#1c1a15', fontFamily: "'Space Grotesk', sans-serif" }}>Fetching weather data…</p>
                <p style={{ fontSize: 12, color: '#9a8870', marginTop: 3, fontFamily: "'DM Sans', sans-serif" }}>{displayName}</p>
              </div>
              {[0.7, 0.5, 0.3].map((op, i) => (
                <div key={i} style={{ width: '80%', height: 28, borderRadius: 10, background: `rgba(237,228,211,${op})` }} />
              ))}
            </div>
          )}

          {/* Error state */}
          {!loading && error && (
            <div style={{ padding: '40px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center' }}>
              <CloudFog size={36} color="#b0a088" />
              <p style={{ fontSize: 13.5, color: '#9a8870', fontFamily: "'DM Sans', sans-serif" }}>{error}</p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setShowSearch(true)}
                  style={{ padding: '8px 18px', borderRadius: 100, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", background: `${accent}14`, border: `1px solid ${accent}30`, color: accent }}>
                  Search Location
                </button>
                <button onClick={() => fetchWeather(activeLocation?.lat ?? DEFAULT_LOCATION.lat, activeLocation?.lon ?? DEFAULT_LOCATION.lon)}
                  style={{ padding: '8px 18px', borderRadius: 100, fontSize: 12.5, fontWeight: 500, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", background: '#f9f5ef', border: '1px solid rgba(160,130,90,0.22)', color: '#5a5040' }}>
                  Retry
                </button>
              </div>
            </div>
          )}

          {/* Main weather content */}
          {!loading && !error && current && (
            <>
              {/* ── Hero section — matches dashboard hero banner palette ── */}
              <div style={{
                background: isSunny
                  ? 'linear-gradient(135deg, #fffbeb 0%, #f9f5ef 40%, #f0faf2 100%)'
                  : isRainy
                    ? 'linear-gradient(135deg, #ecfeff 0%, #f9f5ef 50%, #eff6ff 100%)'
                    : current.condition === 'Thunderstorm'
                      ? 'linear-gradient(135deg, #faf5ff 0%, #f9f5ef 50%, #f0f9ff 100%)'
                      : 'linear-gradient(135deg, #f0faf2 0%, #f9f5ef 40%, #f0faf2 100%)',
                padding: '24px 24px 20px',
                borderBottom: '1px solid rgba(160,130,90,0.12)',
                position: 'relative',
                overflow: 'hidden',
              }}>
                {/* Ambient effects */}
                {isRainy && <AmbientRain intensity={isRainy ? 22 : 0} />}
                {isSunny && <AmbientSun />}
                {current.condition === 'Thunderstorm' && <AmbientRain intensity={30} />}

                <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20 }}>
                  {/* Left: main temp */}
                  <div style={{ flex: 1, minWidth: 240 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 11px',
                        borderRadius: 100, fontSize: 11, fontWeight: 700, fontFamily: "'DM Sans', sans-serif",
                        background: isRainy ? '#ecfeff' : isSunny ? '#fffbeb' : '#f0faf2',
                        color: accent, border: `1px solid ${accent}35`,
                      }}>
                        <span className="sf-pulse" style={{ width: 6, height: 6, borderRadius: '50%', background: accent, display: 'inline-block' }} />
                        LIVE · {new Date(current.dt * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 10 }}>
                      <div className="sf-float">
                        <WeatherIcon condition={current.condition} size={60} color={iconColor} />
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'flex-start', lineHeight: 1 }}>
                          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 64, fontWeight: 700, color: '#1c1a15', letterSpacing: '-0.03em', lineHeight: 1 }}>{current.temp}</span>
                          <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 22, color: '#9a8870', fontWeight: 300, marginTop: 8 }}>°C</span>
                        </div>
                        <p style={{ fontSize: 14, fontWeight: 500, color: '#5a5040', textTransform: 'capitalize', marginTop: 4, fontFamily: "'DM Sans', sans-serif" }}>{current.description}</p>
                        <p style={{ fontSize: 12, color: '#b0a088', marginTop: 2, fontFamily: "'DM Sans', sans-serif" }}>Feels like {current.feelsLike}°C</p>
                      </div>
                    </div>
                  </div>

                  {/* Right: stat grid — matches dashboard sensor card grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, minWidth: 280 }}>
                    {([
                      { icon: Droplets,  label: 'Humidity',   value: `${current.humidity}%`,                                      color: '#0891b2', pale: '#ecfeff' },
                      { icon: Wind,      label: 'Wind',        value: `${current.windSpeed} km/h ${windDirection(current.windDeg)}`, color: '#64748b', pale: '#f8fafc' },
                      { icon: Eye,       label: 'Visibility',  value: `${current.visibility} km`,                                  color: '#7c3aed', pale: '#faf5ff' },
                      { icon: Gauge,     label: 'Pressure',    value: `${current.pressure} hPa`,                                   color: '#f97316', pale: '#fff7ed' },
                      { icon: Sunrise,   label: 'Sunrise',     value: formatTime(current.sunrise),                                  color: '#d97706', pale: '#fffbeb' },
                      { icon: Sunset,    label: 'Sunset',      value: formatTime(current.sunset),                                   color: '#ea580c', pale: '#fff7ed' },
                    ] as const).map(stat => (
                      <div key={stat.label}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8, padding: '10px 11px',
                          borderRadius: 12, background: '#fff',
                          border: '1px solid rgba(160,130,90,0.16)',
                          boxShadow: '0 1px 4px rgba(100,70,30,0.05)',
                        }}>
                        <div style={{ width: 30, height: 30, borderRadius: 8, background: stat.pale, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: `1px solid ${stat.color}18` }}>
                          <stat.icon size={14} color={stat.color} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 10, color: '#b0a088', fontFamily: "'DM Sans', sans-serif", textTransform: 'uppercase', letterSpacing: '0.04em' }}>{stat.label}</div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: '#1c1a15', marginTop: 1, fontFamily: "'DM Sans', sans-serif", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{stat.value}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* View toggle — same style as dashboard time range buttons */}
                <div style={{ marginTop: 18, display: 'flex', alignItems: 'center', gap: 4, position: 'relative', zIndex: 1 }}>
                  <div style={{ display: 'flex', padding: 3, borderRadius: 12, background: '#fff', border: '1px solid rgba(160,130,90,0.2)', boxShadow: '0 1px 4px rgba(100,70,30,0.05)' }}>
                    {(['today', 'week'] as const).map(v => (
                      <button key={v} onClick={() => { setView(v); setSelectedDay(0); setHourlyOffset(0); }}
                        style={{
                          padding: '7px 22px', borderRadius: 9, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
                          fontFamily: "'DM Sans', sans-serif", transition: 'all 0.2s', border: 'none',
                          background: view === v ? accent : 'transparent',
                          color: view === v ? '#fff' : '#9a8870',
                          boxShadow: view === v ? `0 2px 10px ${accent}35` : 'none',
                        }}>
                        {v === 'today' ? '⏱ Today' : '📅 7-Day'}
                      </button>
                    ))}
                  </div>
                  <button onClick={() => fetchWeather(activeLocation?.lat ?? DEFAULT_LOCATION.lat, activeLocation?.lon ?? DEFAULT_LOCATION.lon)}
                    style={{ marginLeft: 8, width: 34, height: 34, borderRadius: 10, background: '#fff', border: '1px solid rgba(160,130,90,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#9a8870' }}>
                    <RefreshCw size={13} />
                  </button>
                </div>
              </div>

              {/* ── TODAY view ── */}
              {view === 'today' && (
                <div style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 20, background: '#f9f5ef' }}>

                  {/* Hourly scroll */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                      <h4 style={{ fontSize: 11.5, fontWeight: 700, color: '#9a8870', textTransform: 'uppercase', letterSpacing: '0.07em', fontFamily: "'DM Sans', sans-serif", margin: 0 }}>Hourly Forecast</h4>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {[
                          { fn: () => setHourlyOffset(o => Math.max(0, o - 3)), icon: ChevronLeft, dis: hourlyOffset === 0 },
                          { fn: () => setHourlyOffset(o => Math.min(hourly.length - 6, o + 3)), icon: ChevronRight, dis: hourlyOffset >= hourly.length - 6 },
                        ].map(({ fn, icon: Icon, dis }, i) => (
                          <button key={i} onClick={fn} disabled={dis}
                            style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid rgba(160,130,90,0.22)', background: '#fff', cursor: dis ? 'not-allowed' : 'pointer', color: dis ? '#d4c4a8' : '#9a8870', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Icon size={13} />
                          </button>
                        ))}
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 8 }}>
                      {visibleHourly.map((h, i) => {
                        const isNow = i === 0 && hourlyOffset === 0;
                        return (
                          <div key={h.dt} className="sf-hover-lift"
                            style={{
                              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                              padding: '13px 8px', borderRadius: 14,
                              border: `1.5px solid ${isNow ? accent + '45' : 'rgba(160,130,90,0.16)'}`,
                              background: isNow ? `${accent}10` : '#fff',
                              boxShadow: '0 1px 5px rgba(100,70,30,0.05)',
                            }}>
                            <span style={{ fontSize: 10.5, fontWeight: 700, color: isNow ? accent : '#b0a088', fontFamily: "'DM Sans', sans-serif" }}>{isNow ? 'Now' : formatHour(h.dt)}</span>
                            <WeatherIcon condition={h.condition} size={20} color={conditionIconColor(h.condition)} />
                            <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, color: '#1c1a15', fontWeight: 600 }}>{h.temp}°</span>
                            {h.pop > 0 && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                                <Droplets size={10} color="#0891b2" />
                                <span style={{ fontSize: 10, color: '#0891b2', fontWeight: 700, fontFamily: "'DM Sans', sans-serif" }}>{h.pop}%</span>
                              </div>
                            )}
                            <span style={{ fontSize: 10, color: '#b0a088', fontFamily: "'DM Sans', sans-serif" }}>{h.windSpeed}km/h</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Sun arc card — earthy tint */}
                  <div style={{ ...cardBase, background: 'linear-gradient(155deg, #fdf8f2 0%, #faf5ec 100%)', borderColor: 'rgba(160,100,40,0.18)', padding: '18px 22px' }}>
                    <h4 style={{ fontSize: 11.5, fontWeight: 700, color: '#9a8870', textTransform: 'uppercase', letterSpacing: '0.07em', fontFamily: "'DM Sans', sans-serif", margin: '0 0 14px' }}>Sun Arc</h4>
                    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: '#fffbeb', border: '1px solid rgba(217,119,6,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Sunrise size={17} color="#d97706" />
                        </div>
                        <div>
                          <div style={{ fontSize: 10, color: '#b0a088', fontFamily: "'DM Sans', sans-serif", textTransform: 'uppercase', letterSpacing: '0.04em' }}>Sunrise</div>
                          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 16, fontWeight: 700, color: '#d97706' }}>{formatTime(current.sunrise)}</div>
                        </div>
                      </div>
                      <div style={{ flex: 1, position: 'relative', height: 60 }}>
                        <svg width="100%" height="60" viewBox="0 0 200 60" preserveAspectRatio="none">
                          <path d="M 10 55 Q 100 -10 190 55" stroke="rgba(160,130,90,0.2)" strokeWidth="2" fill="none" />
                          <path d="M 10 55 Q 100 -10 190 55" stroke={accent} strokeWidth="2.5" fill="none" strokeLinecap="round" className="sf-arc" />
                          <circle cx="100" cy="5" r="5" fill={accent} style={{ filter: `drop-shadow(0 0 6px ${accent}80)` }} />
                        </svg>
                        <div style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', fontSize: 10.5, color: '#9a8870', fontFamily: "'DM Sans', sans-serif", whiteSpace: 'nowrap' }}>{formatTime(current.dt)}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, textAlign: 'right' }}>
                        <div>
                          <div style={{ fontSize: 10, color: '#b0a088', fontFamily: "'DM Sans', sans-serif", textTransform: 'uppercase', letterSpacing: '0.04em' }}>Sunset</div>
                          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 16, fontWeight: 700, color: '#ea580c' }}>{formatTime(current.sunset)}</div>
                        </div>
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: '#fff7ed', border: '1px solid rgba(234,88,12,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Sunset size={17} color="#ea580c" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Today stats — matches dashboard stats cards */}
                  {daily[0] && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
                      {([
                        { label: 'High Temp',   value: `${daily[0].tempMax}°C`, icon: ArrowUp,    color: '#dc2626', pale: '#fee2e2', bdr: 'rgba(220,38,38,0.16)',  bg: 'linear-gradient(145deg,#fff1f2,#fee8e8)' },
                        { label: 'Low Temp',    value: `${daily[0].tempMin}°C`, icon: ArrowDown,  color: '#2563eb', pale: '#eff6ff', bdr: 'rgba(37,99,235,0.16)',  bg: 'linear-gradient(145deg,#f0f6ff,#eaf1ff)' },
                        { label: 'Rain Chance', value: `${daily[0].pop}%`,      icon: CloudRain,  color: '#0891b2', pale: '#ecfeff', bdr: 'rgba(8,145,178,0.16)',  bg: 'linear-gradient(145deg,#f0fbff,#e8f8fc)' },
                        { label: 'Humidity',    value: `${daily[0].humidity}%`, icon: Droplets,   color: '#7c3aed', pale: '#faf5ff', bdr: 'rgba(124,58,237,0.16)', bg: 'linear-gradient(145deg,#f5f7ff,#f0ecff)' },
                      ] as const).map(s => (
                        <div key={s.label} className="sf-hover-lift"
                          style={{ background: s.bg, border: `1px solid ${s.bdr}`, borderRadius: 14, boxShadow: '0 2px 8px rgba(100,70,30,0.05)', padding: '16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{ width: 38, height: 38, borderRadius: 11, background: s.pale, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: `1px solid ${s.color}22` }}>
                            <s.icon size={17} color={s.color} />
                          </div>
                          <div>
                            <div style={{ fontSize: 10.5, color: '#b0a088', fontFamily: "'DM Sans', sans-serif", textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s.label}</div>
                            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, color: '#1c1a15', letterSpacing: '-0.02em', lineHeight: 1.1, marginTop: 2 }}>{s.value}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── WEEK view ── */}
              {view === 'week' && (
                <div style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 16, background: '#f9f5ef' }}>
                  <h4 style={{ fontSize: 11.5, fontWeight: 700, color: '#9a8870', textTransform: 'uppercase', letterSpacing: '0.07em', fontFamily: "'DM Sans', sans-serif", margin: 0 }}>7-Day Outlook</h4>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {daily.map((day, i) => {
                      const isSel = selectedDay === i;
                      const range = tempRange.max - tempRange.min || 1;
                      const barStart = ((day.tempMin - tempRange.min) / range) * 100;
                      const barWidth = Math.max(((day.tempMax - day.tempMin) / range) * 100, 8);
                      return (
                        <div key={day.dt} className="sf-day-row"
                          onClick={() => setSelectedDay(i)}
                          style={{
                            borderRadius: 14,
                            border: `1.5px solid ${isSel ? accent + '45' : 'rgba(160,130,90,0.16)'}`,
                            background: isSel ? `${accent}10` : '#fff',
                            padding: '12px 16px',
                            cursor: 'pointer',
                            boxShadow: isSel ? `0 2px 12px ${accent}16` : '0 1px 4px rgba(100,70,30,0.05)',
                          }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ width: 90, flexShrink: 0 }}>
                              <div style={{ fontSize: 13.5, fontWeight: 700, color: isSel ? '#1c1a15' : '#5a5040', fontFamily: "'Space Grotesk', sans-serif" }}>{formatDayShort(day.dt)}</div>
                              <div style={{ fontSize: 11, color: '#b0a088', marginTop: 2, textTransform: 'capitalize', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: "'DM Sans', sans-serif" }}>{day.description}</div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: 56, flexShrink: 0 }}>
                              <WeatherIcon condition={day.condition} size={20} color={conditionIconColor(day.condition)} />
                              {day.pop > 0 && <span style={{ fontSize: 10.5, color: '#0891b2', fontWeight: 700, fontFamily: "'DM Sans', sans-serif" }}>{day.pop}%</span>}
                            </div>
                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontSize: 12.5, color: '#2563eb', fontWeight: 700, width: 32, textAlign: 'right', fontFamily: "'Space Grotesk', sans-serif", flexShrink: 0 }}>{day.tempMin}°</span>
                              <div style={{ flex: 1, position: 'relative', height: 6, borderRadius: 100, background: '#ede4d3', overflow: 'hidden' }}>
                                <div style={{ position: 'absolute', height: '100%', borderRadius: 100, left: `${barStart}%`, width: `${barWidth}%`, background: isSel ? `linear-gradient(90deg, #2563eb, ${accent})` : 'linear-gradient(90deg, #2563eb, #f97316)', transition: 'all 0.5s' }} />
                              </div>
                              <span style={{ fontSize: 12.5, color: '#ea580c', fontWeight: 700, width: 32, fontFamily: "'Space Grotesk', sans-serif", flexShrink: 0 }}>{day.tempMax}°</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, width: 60, flexShrink: 0 }}>
                              <Wind size={11} color="#b0a088" />
                              <span style={{ fontSize: 10.5, color: '#9a8870', fontFamily: "'DM Sans', sans-serif" }}>{day.windSpeed}km/h</span>
                            </div>
                            <ChevronRight size={13} color={isSel ? accent : '#d4c4a8'} style={{ flexShrink: 0, transform: isSel ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
                          </div>

                          {/* Expanded day detail */}
                          {isSel && (
                            <div className="sf-slidein" style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${accent}22`, display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
                              {([
                                { icon: Droplets,    label: 'Humidity',   value: `${day.humidity}%`,              color: '#0891b2', pale: '#ecfeff' },
                                { icon: Wind,        label: 'Wind',       value: `${day.windSpeed} km/h`,          color: '#64748b', pale: '#f8fafc' },
                                { icon: CloudRain,   label: 'Rain Prob.', value: `${day.pop}%`,                    color: '#2563eb', pale: '#eff6ff' },
                                { icon: Thermometer, label: 'Range',      value: `${day.tempMin}–${day.tempMax}°`, color: '#f97316', pale: '#fff7ed' },
                              ] as const).map(s => (
                                <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 10px', borderRadius: 10, background: s.pale, border: `1px solid ${s.color}18` }}>
                                  <s.icon size={13} color={s.color} style={{ flexShrink: 0 }} />
                                  <div>
                                    <div style={{ fontSize: 9.5, color: '#b0a088', fontFamily: "'DM Sans', sans-serif", textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s.label}</div>
                                    <div style={{ fontSize: 12, fontWeight: 700, color: '#1c1a15', fontFamily: "'Space Grotesk', sans-serif", marginTop: 1 }}>{s.value}</div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Selected day summary */}
                  {daily[selectedDay] && (
                    <div className="sf-slidein" style={{ borderRadius: 14, padding: '16px 18px', background: `${accent}0e`, border: `1px solid ${accent}25` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 12, background: `${accent}14`, border: `1px solid ${accent}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <WeatherIcon condition={daily[selectedDay].condition} size={20} color={conditionIconColor(daily[selectedDay].condition)} />
                        </div>
                        <div>
                          <p style={{ fontSize: 14, fontWeight: 600, color: '#1c1a15', fontFamily: "'Space Grotesk', sans-serif", margin: 0 }}>{formatDayFull(daily[selectedDay].dt)}</p>
                          <p style={{ fontSize: 12, color: '#9a8870', textTransform: 'capitalize', fontFamily: "'DM Sans', sans-serif", margin: '2px 0 0' }}>{daily[selectedDay].description}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}