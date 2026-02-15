"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Leaf,
  BarChart3,
  Cpu,
  Brain,
  Sprout,
  Settings,
  RefreshCw,
  X,
  ChevronLeft,
  ChevronRight,
  Info,
  WifiOff,
  Wifi,
} from "lucide-react";
import { subscribeToESP32Status, type ESP32StatusResult } from "@/lib/firebase";

function SidebarItem({
  href,
  icon: Icon,
  label,
  collapsed,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  collapsed?: boolean;
}) {
  const pathname = usePathname();
  const active = pathname === href;
  return (
    <li className="mx-2 my-1">
      <Link
        href={href}
        className={`flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all duration-200 font-medium ${
          active
            ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20"
            : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
        }`}
      >
        <Icon className="w-5 h-5 flex-shrink-0" />
        {!collapsed && <span className="truncate">{label}</span>}
      </Link>
    </li>
  );
}

// ─── ESP32 Status Indicator ───────────────────────────────────────────────────

function ESP32StatusBadge({
  esp32Status,
  collapsed,
}: {
  esp32Status: ESP32StatusResult;
  collapsed: boolean;
}) {
  const statusConfig = {
    online: {
      dotClass:
        "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)] animate-pulse",
      label: "ESP32 Online",
      textClass: "text-slate-400",
      icon: null,
    },
    offline: {
      dotClass: "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]",
      label: "ESP32 Offline",
      textClass: "text-amber-400",
      icon: WifiOff,
    },
    no_connection: {
      dotClass: "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]",
      label: "No Connection",
      textClass: "text-red-400",
      icon: WifiOff,
    },
  };

  const config = statusConfig[esp32Status.status];
  const IconComp = config.icon;

  // Collapsed: just show the dot as a status indicator
  if (collapsed) {
    return (
      <div className="flex justify-center py-2">
        <span
          className={`w-3 h-3 rounded-full flex-shrink-0 ${config.dotClass}`}
          title={config.label}
        />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className={`flex items-center gap-2 text-sm ${config.textClass}`}>
        {IconComp ? (
          <IconComp className="w-4 h-4 flex-shrink-0" />
        ) : (
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${config.dotClass}`} />
        )}
        <span className="font-medium">{config.label}</span>
      </div>
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <RefreshCw className="w-3 h-3 flex-shrink-0" />
        <span>Last sync: {esp32Status.lastSync}</span>
      </div>
    </div>
  );
}

// ─── Main Sidebar Component ───────────────────────────────────────────────────

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [esp32Status, setEsp32Status] = useState<ESP32StatusResult>({
    status: "no_connection",
    lastSync: "Connecting...",
  });

  // Subscribe to real ESP32 status from Firebase
  useEffect(() => {
    const unsubscribe = subscribeToESP32Status((result) => {
      setEsp32Status(result);
    });
    return () => unsubscribe();
  }, []);

  // Keep CSS variable in sync with sidebar width for layout offset
  useEffect(() => {
    const sidebarWidth = collapsed ? "80px" : "256px";
    document.documentElement.style.setProperty("--sidebar-width", sidebarWidth);
  }, [collapsed]);

  // Listen for mobile menu toggle event dispatched by the header
  useEffect(() => {
    const handleToggleMobileMenu = () => setMobileOpen((prev) => !prev);
    document.addEventListener("toggleMobileMenu", handleToggleMobileMenu);
    return () =>
      document.removeEventListener("toggleMobileMenu", handleToggleMobileMenu);
  }, []);

  // Prevent body scroll while mobile menu is open
  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  const navItems = [
    { href: "/dashboard",         icon: BarChart3, label: "Dashboard" },
    { href: "/sensor_data",       icon: Cpu,       label: "Sensor Data" },
    { href: "/ai_insights",       icon: Brain,     label: "AI Insights" },
    { href: "/plant_performance", icon: Sprout,    label: "Plant Performance" },
    { href: "/setings",           icon: Settings,  label: "Settings" },
    { href: "/about",             icon: Info,      label: "About" },
  ];

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Desktop Sidebar ── */}
      <aside
        className={`fixed h-screen bg-slate-900 border-r border-slate-800 flex flex-col transition-all duration-300 z-50 hidden lg:flex ${
          collapsed ? "w-20" : "w-64"
        }`}
      >
        {/* Logo + collapse toggle */}
        <div
          className={`p-4 border-b border-slate-800 gap-4 ${
            collapsed
              ? "flex flex-col items-center"
              : "flex flex-row items-center justify-between"
          }`}
        >
          <div className="flex items-center gap-3 text-emerald-500">
            <Leaf className="w-8 h-8" />
            {!collapsed && (
              <span className="text-xl font-bold tracking-tight">SmartFarm</span>
            )}
          </div>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={`p-2 rounded-lg hover:bg-slate-800 text-slate-400 transition-colors ${
              collapsed && "order-first"
            }`}
          >
            {collapsed ? (
              <ChevronRight className="w-5 h-5" />
            ) : (
              <ChevronLeft className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* Nav links */}
        <nav className="flex-1 py-4 overflow-y-auto">
          <ul className="space-y-1">
            {navItems.map((item) => (
              <SidebarItem
                key={item.href}
                href={item.href}
                icon={item.icon}
                label={item.label}
                collapsed={collapsed}
              />
            ))}
          </ul>
        </nav>

        {/* Live ESP32 status footer */}
        <div className="p-4 border-t border-slate-800">
          <ESP32StatusBadge esp32Status={esp32Status} collapsed={collapsed} />
        </div>
      </aside>

      {/* ── Mobile Sidebar ── */}
      <aside
        className={`fixed top-0 left-0 w-64 h-screen bg-slate-900 border-r border-slate-800 flex flex-col overflow-hidden transition-all duration-300 z-40 lg:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo + close button */}
        <div className="p-6 flex items-center justify-between border-b border-slate-800 flex-shrink-0">
          <div className="flex items-center gap-3 text-emerald-500">
            <Leaf className="w-8 h-8" />
            <span className="text-xl font-bold tracking-tight">SmartFarm</span>
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav links */}
        <nav className="flex-1 min-h-0 py-4 overflow-y-auto">
          <ul className="space-y-1">
            {navItems.map((item) => (
              <li key={item.href} className="mx-2 my-1">
                <Link
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3.5 px-4 py-3 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                >
                  <item.icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Live ESP32 status footer */}
        <div className="p-4 pb-6 border-t border-slate-800 flex-shrink-0">
          <ESP32StatusBadge esp32Status={esp32Status} collapsed={false} />
        </div>
      </aside>
    </>
  );
}