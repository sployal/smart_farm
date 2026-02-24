"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3, Cpu, Brain, Sprout, Settings,
  RefreshCw, X, Info, CreditCard,
  ChevronLeft, ChevronRight, Leaf,
} from "lucide-react";
import clsx from "clsx";
import { subscribeToESP32Status, type ESP32StatusResult } from "@/lib/firebase";

// ─── Nav Item ────────────────────────────────────────────────────────────────
function SidebarItem({
  href, icon: Icon, label, collapsed,
}: {
  href: string; icon: React.ElementType; label: string; collapsed?: boolean;
}) {
  const pathname = usePathname();
  const active = pathname === href;

  return (
    <li className="px-3 py-0.5">
      <Link
        href={href}
        className={clsx(
          "relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group overflow-hidden",
          active
            ? "bg-gradient-to-r from-emerald-500/20 to-cyan-500/8 text-slate-100"
            : "text-slate-400 hover:text-slate-100 hover:bg-white/8"
        )}
      >
        {/* Left glow track for active */}
        {active && (
          <span className="absolute left-0 top-1/4 bottom-1/4 w-[3px] rounded-r-full bg-gradient-to-b from-emerald-400 to-cyan-400 shadow-[0_0_10px_rgba(52,211,153,0.7)]" />
        )}

        {/* Icon */}
        <span className={clsx(
          "flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0 transition-all duration-200",
          active
            ? "bg-emerald-500/15 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.25)]"
            : "text-slate-400 group-hover:text-emerald-400 group-hover:bg-emerald-500/10"
        )}>
          <Icon size={16} strokeWidth={active ? 2.5 : 1.8} />
        </span>

        {/* Label */}
        {!collapsed && (
          <span className={clsx(
            "text-sm font-semibold tracking-wide truncate transition-colors duration-200",
            active ? "text-slate-100" : "text-slate-400 group-hover:text-slate-100"
          )}>
            {label}
          </span>
        )}

        {/* Collapsed active dot */}
        {collapsed && active && (
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.9)]" />
        )}
      </Link>
    </li>
  );
}

// ─── ESP32 Status Badge ───────────────────────────────────────────────────────
function ESP32StatusBadge({
  esp32Status, collapsed,
}: {
  esp32Status: ESP32StatusResult; collapsed: boolean;
}) {
  const cfg = {
    online:        { dot: "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]",  label: "ESP32 Online",  text: "text-emerald-400", pulse: true  },
    offline:       { dot: "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.7)]",    label: "ESP32 Offline", text: "text-amber-400",   pulse: false },
    no_connection: { dot: "bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.7)]",     label: "No Connection", text: "text-red-400",     pulse: false },
  }[esp32Status.status];

  if (collapsed) {
    return (
      <div className="flex justify-center py-1">
        <span className={clsx("w-2.5 h-2.5 rounded-full flex-shrink-0", cfg.dot, cfg.pulse && "animate-pulse")} />
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <span className={clsx("w-2 h-2 rounded-full flex-shrink-0", cfg.dot, cfg.pulse && "animate-pulse")} />
        <span className={clsx("text-xs font-semibold", cfg.text)}>{cfg.label}</span>
      </div>
      <div className="flex items-center gap-1.5 pl-4 text-slate-500">
        <RefreshCw size={9} className="animate-spin" style={{ animationDuration: "4s" }} />
        <span className="text-[10px] font-mono tracking-wide">{esp32Status.lastSync}</span>
      </div>
    </div>
  );
}

// ─── Main Sidebar ─────────────────────────────────────────────────────────────
export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [esp32Status, setEsp32Status] = useState<ESP32StatusResult>({
    status: "no_connection",
    lastSync: "Connecting...",
  });

  useEffect(() => {
    const unsubscribe = subscribeToESP32Status(setEsp32Status);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty(
      "--sidebar-width",
      collapsed ? "72px" : "252px"
    );
  }, [collapsed]);

  useEffect(() => {
    const toggle = () => setMobileOpen((p) => !p);
    document.addEventListener("toggleMobileMenu", toggle);
    return () => document.removeEventListener("toggleMobileMenu", toggle);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [mobileOpen]);

  const navItems = [
    { href: "/dashboard",         icon: BarChart3,  label: "Dashboard"   },
    { href: "/sensor_data",       icon: Cpu,        label: "Sensor Data" },
    { href: "/ai_insights",       icon: Brain,      label: "AI Insights" },
    { href: "/plant_performance", icon: Sprout,     label: "Performance" },
    { href: "/setings",           icon: Settings,   label: "Settings"    },
    { href: "/about",             icon: Info,       label: "About"       },
    { href: "/billing",           icon: CreditCard, label: "Billing"     },
  ];

  const SidebarContent = ({ isMobile = false }: { isMobile?: boolean }) => {
    const isExpanded = isMobile || !collapsed;
    return (
      <div className="flex flex-col h-full">

        {/* ── Logo ── */}
        <div className={clsx(
          "flex items-center gap-3 flex-shrink-0 px-4 pt-5 pb-4",
          !isExpanded && "flex-col px-2 pt-4 pb-3"
        )}>
          <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/10 border border-emerald-500/25 flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.1)]">
            <Leaf size={18} className="text-emerald-400" />
          </div>

          {isExpanded && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-100 tracking-wide leading-none mb-1">SmartFarm</p>
              <p className="text-[10px] font-mono text-emerald-500/70 tracking-widest uppercase">v2.0 · Kenya</p>
            </div>
          )}

          {isMobile ? (
            <button
              onClick={() => setMobileOpen(false)}
              className="ml-auto flex items-center justify-center w-7 h-7 rounded-lg border border-slate-600/50 bg-slate-700/50 text-slate-400 hover:text-slate-200 hover:bg-slate-600 transition-colors"
            >
              <X size={14} />
            </button>
          ) : (
            <button
              onClick={() => setCollapsed(!collapsed)}
              className={clsx(
                "flex items-center justify-center w-6 h-6 rounded-md border border-slate-600/50 bg-slate-700/40 text-slate-400",
                "hover:text-emerald-400 hover:border-emerald-500/30 hover:bg-emerald-500/5 transition-all duration-200",
                !isExpanded && "mx-auto"
              )}
            >
              {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
            </button>
          )}
        </div>

        {/* ── Divider ── */}
        <div className="mx-4 h-px bg-gradient-to-r from-transparent via-slate-600/60 to-transparent flex-shrink-0" />

        {/* ── Section label ── */}
        {isExpanded && (
          <p className="px-6 pt-4 pb-1 text-[9px] font-mono font-semibold uppercase tracking-[0.2em] text-slate-500">
            Navigation
          </p>
        )}

        {/* ── Nav links ── */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-2">
          <ul className="space-y-0.5">
            {navItems.map((item) => (
              <SidebarItem
                key={item.href}
                href={item.href}
                icon={item.icon}
                label={item.label}
                collapsed={!isExpanded}
              />
            ))}
          </ul>
        </nav>

        {/* ── Footer ── */}
        <div className="flex-shrink-0">
          <div className="mx-4 h-px bg-gradient-to-r from-transparent via-slate-600/60 to-transparent mb-4" />
          <div className="px-5 pb-6">
            <ESP32StatusBadge esp32Status={esp32Status} collapsed={!isExpanded} />
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Desktop Sidebar ── */}
      <aside
        className={clsx(
          "fixed top-0 left-0 h-screen z-50 hidden lg:block",
          "border-r transition-all duration-300 ease-in-out",
          collapsed ? "w-[72px]" : "w-[252px]"
        )}
        style={{
          background: "linear-gradient(180deg, #1a2535 0%, #162030 60%, #13202e 100%)",
          borderColor: "rgba(255,255,255,0.06)",
        }}
      >
        {/* Glowing right edge */}
        <div className="absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-emerald-500/20 to-transparent pointer-events-none" />
        {/* Ambient top blob */}
        <div className="absolute -top-20 -left-10 w-64 h-64 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(16,185,129,0.07) 0%, transparent 70%)" }} />

        <SidebarContent />
      </aside>

      {/* ── Mobile Sidebar ── */}
      <aside
        className={clsx(
          "fixed top-0 left-0 h-screen w-[252px] z-50 lg:hidden",
          "border-r transition-transform duration-300 ease-in-out",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
        style={{
          background: "linear-gradient(180deg, #1a2535 0%, #162030 60%, #13202e 100%)",
          borderColor: "rgba(255,255,255,0.06)",
        }}
      >
        <div className="absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-emerald-500/20 to-transparent pointer-events-none" />
        <SidebarContent isMobile />
      </aside>
    </>
  );
}