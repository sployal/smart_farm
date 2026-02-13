"use client";

import React, { useState } from "react";
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
} from "lucide-react";

function SidebarItem({ href, icon: Icon, label, collapsed }: { href: string; icon: React.ElementType; label: string; collapsed?: boolean; }) {
  const pathname = usePathname();
  const active = pathname === href;
  return (
    <li className="mx-2 my-1">
      <Link
        href={href}
        className={`flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all duration-200 font-medium ${active ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20" : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"}`}
      >
        <Icon className="w-5 h-5 flex-shrink-0" />
        {!collapsed && <span className="truncate">{label}</span>}
      </Link>
    </li>
  );
}

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  React.useEffect(() => {
    const sidebarWidth = collapsed ? "80px" : "256px";
    document.documentElement.style.setProperty("--sidebar-width", sidebarWidth);
  }, [collapsed]);

  React.useEffect(() => {
    const handleToggleMobileMenu = () => {
      setMobileOpen(prev => !prev);
    };
    document.addEventListener('toggleMobileMenu', handleToggleMobileMenu);
    return () => document.removeEventListener('toggleMobileMenu', handleToggleMobileMenu);
  }, []);

  // Prevent body scroll when mobile menu is open so viewport height stays stable (no bottom "snap")
  React.useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  return (
    <>
      {/* Mobile backdrop - close menu when clicking outside */}
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Desktop Sidebar */}
      <aside className={`fixed h-screen bg-slate-900 border-r border-slate-800 flex flex-col transition-all duration-300 z-50 hidden lg:flex ${collapsed ? "w-20" : "w-64"}`}>
        <div className={`p-4 border-b border-slate-800 gap-4 ${collapsed ? "flex flex-col items-center" : "flex flex-row items-center justify-between"}`}>
          <div className="flex items-center gap-3 text-emerald-500">
            <Leaf className="w-8 h-8" />
            {!collapsed && <span className="text-xl font-bold tracking-tight">SmartFarm</span>}
          </div>
          <button onClick={() => setCollapsed(!collapsed)} className={`p-2 rounded-lg hover:bg-slate-800 text-slate-400 transition-colors ${collapsed && "order-first"}`}>
            {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          </button>
        </div>

        <nav className="flex-1 py-4 overflow-y-auto">
          <ul className="space-y-1">
            <SidebarItem href="/dashboard" icon={BarChart3} label="Dashboard" collapsed={collapsed} />
            <SidebarItem href="/sensor_data" icon={Cpu} label="Sensor Data" collapsed={collapsed} />
            <SidebarItem href="/ai_insights" icon={Brain} label="AI Insights" collapsed={collapsed} />
            <SidebarItem href="/plant_performance" icon={Sprout} label="Plant Performance" collapsed={collapsed} />
            <SidebarItem href="/setings" icon={Settings} label="Settings" collapsed={collapsed} />
            <SidebarItem href="/about" icon={Info} label="About" collapsed={collapsed} />
          </ul>
        </nav>

        <div className={`p-4 border-t border-slate-800 space-y-3 ${collapsed && "hidden"}`}>
          <div className="flex items-center gap-2 text-sm">
            <span className="w-2 h-2 rounded-full animate-pulse bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
            <span className="text-slate-400">ESP32 Online</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <RefreshCw className="w-3 h-3" />
            <span>Last sync: Just now</span>
          </div>
        </div>
      </aside>

      {/* Mobile Sidebar */}
      <aside className={`fixed top-0 left-0 w-64 h-screen bg-slate-900 border-r border-slate-800 flex flex-col overflow-hidden transition-all duration-300 z-40 lg:hidden ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="p-6 flex items-center justify-between border-b border-slate-800 flex-shrink-0">
          <div className="flex items-center gap-3 text-emerald-500">
            <Leaf className="w-8 h-8" />
            <span className="text-xl font-bold tracking-tight">SmartFarm</span>
          </div>
          <button onClick={() => setMobileOpen(false)} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 min-h-0 py-4 overflow-y-auto">
          <ul className="space-y-1">
            <li className="mx-2 my-1">
              <Link href="/dashboard" onClick={() => setMobileOpen(false)} className="flex items-center gap-3.5 px-4 py-3 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-slate-100">
                <BarChart3 className="w-5 h-5" />
                <span>Dashboard</span>
              </Link>
            </li>
            <li className="mx-2 my-1">
              <Link href="/sensor_data" onClick={() => setMobileOpen(false)} className="flex items-center gap-3.5 px-4 py-3 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-slate-100">
                <Cpu className="w-5 h-5" />
                <span>Sensor Data</span>
              </Link>
            </li>
            <li className="mx-2 my-1">
              <Link href="/ai_insights" onClick={() => setMobileOpen(false)} className="flex items-center gap-3.5 px-4 py-3 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-slate-100">
                <Brain className="w-5 h-5" />
                <span>AI Insights</span>
              </Link>
            </li>
            <li className="mx-2 my-1">
              <Link href="/plant_performance" onClick={() => setMobileOpen(false)} className="flex items-center gap-3.5 px-4 py-3 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-slate-100">
                <Sprout className="w-5 h-5" />
                <span>Plant Performance</span>
              </Link>
            </li>
            <li className="mx-2 my-1">
              <Link href="/setings" onClick={() => setMobileOpen(false)} className="flex items-center gap-3.5 px-4 py-3 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-slate-100">
                <Settings className="w-5 h-5" />
                <span>Settings</span>
              </Link>
            </li>
            <li className="mx-2 my-1">
              <Link href="/about" onClick={() => setMobileOpen(false)} className="flex items-center gap-3.5 px-4 py-3 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-slate-100">
                <Info className="w-5 h-5" />
                <span>About</span>
              </Link>
            </li>
          </ul>
        </nav>

        <div className="p-4 pb-6 border-t border-slate-800 space-y-3 flex-shrink-0">
          <div className="flex items-center gap-2 text-sm">
            <span className="w-2 h-2 rounded-full animate-pulse bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
            <span className="text-slate-400">ESP32 Online</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <RefreshCw className="w-3 h-3" />
            <span>Last sync: Just now</span>
          </div>
        </div>
      </aside>
    </>
  );
}
