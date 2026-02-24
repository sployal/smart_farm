'use client';

import React from 'react';
import { Globe, Droplets, Sun, Cloud } from 'lucide-react';
import clsx, { type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const weekForecast = [
  { day: 'Mon', high: 27, low: 18, icon: Sun, rain: 0 },
  { day: 'Tue', high: 24, low: 16, icon: Cloud, rain: 40 },
  { day: 'Wed', high: 22, low: 15, icon: Cloud, rain: 70 },
  { day: 'Thu', high: 25, low: 17, icon: Sun, rain: 10 },
  { day: 'Fri', high: 28, low: 19, icon: Sun, rain: 0 },
  { day: 'Sat', high: 26, low: 18, icon: Cloud, rain: 20 },
  { day: 'Sun', high: 23, low: 15, icon: Cloud, rain: 50 },
];

export function WeatherForecast() {
  return (
    <>
      {/* ── SECTION 4: WEATHER FORECAST ────────────────────────────────── */}
      <div className="card rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="section-title font-semibold text-slate-100">7-Day Forecast</h3>
            <p className="text-xs text-slate-500 mt-0.5">Weather outlook for your farm region</p>
          </div>
          <span className="flex items-center gap-1.5 text-xs text-slate-400">
            <Globe className="w-3.5 h-3.5 text-cyan-400" /> Nairobi, Kenya
          </span>
        </div>
        <div className="grid grid-cols-7 gap-2">
          {weekForecast.map((day, i) => (
            <div key={day.day}
              className={cn("flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all hover:-translate-y-1 cursor-default",
                i === 0 ? "border" : "")}
              style={{
                background: i === 0 ? 'rgba(16,185,129,0.08)' : 'rgba(15,24,36,0.5)',
                borderColor: i === 0 ? 'rgba(16,185,129,0.2)' : 'transparent',
              }}>
              <span className={cn("text-[11px] font-semibold", i === 0 ? "text-emerald-400" : "text-slate-400")}>{i === 0 ? 'Today' : day.day}</span>
              <day.icon className={cn("w-5 h-5", day.rain > 30 ? "text-cyan-400" : "text-amber-400")} />
              <div className="text-center">
                <div className="stat-number text-xs font-bold text-slate-100">{day.high}°</div>
                <div className="stat-number text-[10px] text-slate-500">{day.low}°</div>
              </div>
              {day.rain > 0 && (
                <div className="flex items-center gap-0.5">
                  <Droplets className="w-2.5 h-2.5 text-cyan-400" />
                  <span className="text-[10px] text-cyan-400 font-medium">{day.rain}%</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
