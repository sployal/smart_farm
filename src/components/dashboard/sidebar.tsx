"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3, Cpu, Brain, Sprout, Settings,
  RefreshCw, X, Info, CreditCard,
  ChevronLeft, ChevronRight, Leaf,
} from "lucide-react";
import { subscribeToESP32Status, type ESP32StatusResult } from "@/lib/firebase";

// ─────────────────────────────────────────────────────────────────────────────
// Because Tailwind cannot express arbitrary multi-stop gradients or CSS custom
// properties at build time, the three values below remain as inline style
// constants (they are non-purgeable design tokens, not layout/spacing).
// Everything else is Tailwind.
// ─────────────────────────────────────────────────────────────────────────────

const BG = `linear-gradient(
  180deg,
  #1b4332 0%,
  #2d6a4f 22%,
  #3a5a40 42%,
  #52714a 55%,
  #7c6b3a 70%,
  #7c5c2e 83%,
  #6b3f1e 100%
)`;

// ── Nav Item ──────────────────────────────────────────────────────────────────
function SidebarItem({
  href,
  icon: Icon,
  label,
  collapsed,
  onNavigate,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const active = pathname === href;

  return (
    <li className="px-[10px] py-[2px]">
      <Link
        href={href}
        onClick={onNavigate}
        style={
          active
            ? {
                background: "rgba(216,243,220,0.13)",
                border: "1px solid rgba(216,243,220,0.22)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.1)",
                color: "#d8f3dc",
              }
            : { border: "1px solid transparent", color: "rgba(240,232,213,0.72)" }
        }
        className={[
          "relative flex items-center rounded-[13px] no-underline transition-all duration-[180ms] ease-[cubic-bezier(0.4,0,0.2,1)]",
          collapsed ? "justify-center py-[10px] px-0" : "justify-start py-[9px] px-[13px]",
          "gap-[10px]",
        ].join(" ")}
        onMouseEnter={(e) => {
          if (!active) {
            const el = e.currentTarget as HTMLElement;
            el.style.background = "rgba(255,255,255,0.09)";
            el.style.color = "#f0e8d5";
            el.style.borderColor = "rgba(255,255,255,0.15)";
          }
        }}
        onMouseLeave={(e) => {
          if (!active) {
            const el = e.currentTarget as HTMLElement;
            el.style.background = "transparent";
            el.style.color = "rgba(240,232,213,0.72)";
            el.style.borderColor = "transparent";
          }
        }}
      >
        {/* Active left accent bar */}
        {active && (
          <span
            className="absolute left-0 top-[16%] bottom-[16%] w-[3px] rounded-r-[4px]"
            style={{
              background: "linear-gradient(to bottom, #95d5b2, #52b788, #40916c)",
              boxShadow: "2px 0 10px rgba(82,183,136,0.55)",
            }}
          />
        )}

        {/* Icon bubble */}
        <span
          className="flex items-center justify-center w-[34px] h-[34px] rounded-[10px] shrink-0 transition-all duration-[180ms]"
          style={
            active
              ? {
                  background: "rgba(216,243,220,0.16)",
                  border: "1px solid rgba(216,243,220,0.28)",
                  color: "#d8f3dc",
                }
              : {
                  background: "rgba(255,255,255,0.07)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "rgba(240,232,213,0.72)",
                }
          }
        >
          <Icon size={15} strokeWidth={active ? 2.5 : 1.9} />
        </span>

        {/* Label */}
        {!collapsed && (
          <span
            className="text-[13px] whitespace-nowrap overflow-hidden text-ellipsis"
            style={{
              fontWeight: active ? 700 : 500,
              fontFamily: "'Outfit', sans-serif",
              letterSpacing: "0.01em",
              color: "inherit",
            }}
          >
            {label}
          </span>
        )}

        {/* Collapsed active dot */}
        {collapsed && active && (
          <span
            className="absolute top-[5px] right-[5px] w-[5px] h-[5px] rounded-full"
            style={{
              background: "#95d5b2",
              boxShadow: "0 0 7px rgba(149,213,178,0.8)",
            }}
          />
        )}
      </Link>
    </li>
  );
}

// ── ESP32 Badge ───────────────────────────────────────────────────────────────
function ESP32StatusBadge({
  esp32Status,
  collapsed,
}: {
  esp32Status: ESP32StatusResult;
  collapsed: boolean;
}) {
  const cfg = {
    online: {
      dot: "#52b788",
      glow: "rgba(82,183,136,0.7)",
      label: "ESP32 Online",
      sub: "#95d5b2",
      pulse: true,
    },
    offline: {
      dot: "#f59e0b",
      glow: "rgba(245,158,11,0.7)",
      label: "ESP32 Offline",
      sub: "#fcd34d",
      pulse: false,
    },
    no_connection: {
      dot: "#f87171",
      glow: "rgba(248,113,113,0.7)",
      label: "No Connection",
      sub: "#fca5a5",
      pulse: false,
    },
  }[esp32Status.status];

  if (collapsed) {
    return (
      <div className="flex justify-center py-[4px]">
        <span
          className="inline-block w-[9px] h-[9px] rounded-full"
          style={{
            background: cfg.dot,
            boxShadow: `0 0 10px ${cfg.glow}`,
            animation: cfg.pulse ? "sb-pulse 2s infinite" : "none",
          }}
        />
      </div>
    );
  }

  return (
    <div
      className="px-[13px] py-[11px] rounded-[13px] backdrop-blur-[4px]"
      style={{
        background: "rgba(0,0,0,0.22)",
        border: "1px solid rgba(255,255,255,0.1)",
      }}
    >
      <div className="flex items-center gap-[8px] mb-[6px]">
        <span
          className="inline-block w-[7px] h-[7px] rounded-full shrink-0"
          style={{
            background: cfg.dot,
            boxShadow: `0 0 8px ${cfg.glow}`,
            animation: cfg.pulse ? "sb-pulse 2s infinite" : "none",
          }}
        />
        <span
          className="text-[12px] font-bold"
          style={{
            color: cfg.sub,
            fontFamily: "'Outfit', sans-serif",
            letterSpacing: "0.01em",
          }}
        >
          {cfg.label}
        </span>
      </div>
      <div className="flex items-center gap-[6px] pl-[15px]">
        <RefreshCw
          size={9}
          color="rgba(240,232,213,0.4)"
          style={{ animation: "sb-spin 4s linear infinite" }}
        />
        <span
          className="text-[10.5px]"
          style={{
            color: "rgba(240,232,213,0.45)",
            fontFamily: "monospace",
            letterSpacing: "0.05em",
          }}
        >
          {esp32Status.lastSync}
        </span>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [esp32Status, setEsp32Status] = useState<ESP32StatusResult>({
    status: "no_connection",
    lastSync: "Connecting...",
  });

  const pathname = usePathname();

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    const unsub = subscribeToESP32Status(setEsp32Status);
    return () => unsub();
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
    return () => {
      document.body.style.overflow = prev;
    };
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

  // ── Shared inner content ──────────────────────────────────────────────────
  const SidebarContent = ({ isMobile = false }: { isMobile?: boolean }) => {
    const isExpanded = isMobile || !collapsed;

    return (
      <div className="flex flex-col h-full relative overflow-hidden">

        {/* Subtle noise / texture overlay */}
        <div
          className="absolute inset-0 pointer-events-none z-0 opacity-[0.55]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='250' height='250'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='250' height='250' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E")`,
            backgroundRepeat: "repeat",
            backgroundSize: "200px 200px",
          }}
        />

        {/* Radial top-right glow */}
        <div
          className="absolute pointer-events-none z-0 rounded-full"
          style={{
            top: -60,
            right: -60,
            width: 200,
            height: 200,
            background: "radial-gradient(circle, rgba(82,183,136,0.22) 0%, transparent 68%)",
          }}
        />

        {/* Radial bottom-left warm glow */}
        <div
          className="absolute pointer-events-none z-0 rounded-full"
          style={{
            bottom: -40,
            left: -40,
            width: 180,
            height: 180,
            background: "radial-gradient(circle, rgba(217,119,6,0.2) 0%, transparent 68%)",
          }}
        />

        {/* Watermark leaf */}
        <div
          className="absolute pointer-events-none z-0"
          style={{
            bottom: 70,
            right: isExpanded ? -18 : -22,
            width: isExpanded ? 130 : 80,
            height: isExpanded ? 130 : 80,
            opacity: 0.06,
            transform: "rotate(-18deg)",
          }}
        >
          <svg
            viewBox="0 0 100 120"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-full h-full"
          >
            <path
              d="M50 8 C22 8 6 38 6 68 C6 90 24 112 50 112 C76 112 94 90 94 68 C94 38 78 8 50 8Z"
              fill="#d8f3dc"
            />
            <line x1="50" y1="8" x2="50" y2="112" stroke="#d8f3dc" strokeWidth="2.5" />
            <path d="M50 32 Q28 44 6 52"  stroke="#d8f3dc" strokeWidth="1.8" fill="none" />
            <path d="M50 32 Q72 44 94 52" stroke="#d8f3dc" strokeWidth="1.8" fill="none" />
            <path d="M50 55 Q24 64 6 75"  stroke="#d8f3dc" strokeWidth="1.4" fill="none" />
            <path d="M50 55 Q76 64 94 75" stroke="#d8f3dc" strokeWidth="1.4" fill="none" />
          </svg>
        </div>

        {/* ─── All real content above decorations ─── */}
        <div className="relative z-[1] flex flex-col h-full">

          {/* Logo row */}
          <div
            className={[
              "flex items-center shrink-0",
              isExpanded
                ? "flex-row gap-[11px] px-[18px] pt-[22px] pb-[18px]"
                : "flex-col gap-0 px-[8px] pt-[18px] pb-[16px]",
            ].join(" ")}
          >
            {/* Mark */}
            <div
              className="w-[38px] h-[38px] rounded-[11px] shrink-0 flex items-center justify-center"
              style={{
                background: "linear-gradient(135deg, #52b788 0%, #2d6a4f 60%, #1b4332 100%)",
                boxShadow: "0 4px 18px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.18)",
                border: "1px solid rgba(255,255,255,0.18)",
              }}
            >
              <Leaf size={17} color="#d8f3dc" strokeWidth={2.2} />
            </div>

            {isExpanded && (
              <div className="flex-1 min-w-0">
                <p
                  className="text-[19px] leading-[1.1] m-0"
                  style={{
                    fontFamily: "'Instrument Serif', serif",
                    color: "#d8f3dc",
                    letterSpacing: "-0.01em",
                    textShadow: "0 1px 6px rgba(0,0,0,0.35)",
                  }}
                >
                  smartfarm
                </p>
                <p
                  className="text-[9px] mt-[3px] mb-0 uppercase"
                  style={{
                    fontFamily: "monospace",
                    color: "rgba(216,243,220,0.45)",
                    letterSpacing: "0.18em",
                  }}
                >
                  v2.0 · Kenya
                </p>
              </div>
            )}

            {/* Collapse / close */}
            {isMobile ? (
              <button
                onClick={() => setMobileOpen(false)}
                className="ml-auto flex items-center justify-center w-[28px] h-[28px] rounded-[8px] cursor-pointer"
                style={{
                  background: "rgba(255,255,255,0.1)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  color: "#d8f3dc",
                }}
              >
                <X size={14} />
              </button>
            ) : (
              <button
                onClick={() => setCollapsed(!collapsed)}
                className={[
                  "flex items-center justify-center w-[24px] h-[24px] rounded-[7px] cursor-pointer transition-all duration-150",
                  isExpanded ? "ml-auto" : "ml-0",
                ].join(" ")}
                style={{
                  background: "rgba(255,255,255,0.1)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  color: "#d8f3dc",
                }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.background = "rgba(82,183,136,0.25)";
                  el.style.borderColor = "rgba(82,183,136,0.5)";
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.background = "rgba(255,255,255,0.1)";
                  el.style.borderColor = "rgba(255,255,255,0.15)";
                }}
              >
                {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
              </button>
            )}
          </div>

          {/* Divider */}
          <div
            className="mx-[14px] mb-[4px] h-[1px] shrink-0"
            style={{
              background: "linear-gradient(to right, transparent, rgba(255,255,255,0.12), transparent)",
            }}
          />

          {/* Section label */}
          {isExpanded && (
            <p
              className="px-[22px] pt-[10px] pb-[4px] m-0 shrink-0 text-[9px] font-semibold uppercase"
              style={{
                fontFamily: "monospace",
                letterSpacing: "0.22em",
                color: "rgba(216,243,220,0.38)",
              }}
            >
              Navigation
            </p>
          )}

          {/* Nav */}
          <nav className="flex-1 overflow-y-auto overflow-x-hidden py-[6px]">
            <ul className="list-none m-0 p-0">
              {navItems.map((item) => (
                <SidebarItem
                  key={item.href}
                  href={item.href}
                  icon={item.icon}
                  label={item.label}
                  collapsed={!isExpanded}
                  onNavigate={isMobile ? () => setMobileOpen(false) : undefined}
                />
              ))}

              {isMobile && (
                <li className="px-[18px] pt-[14px] pb-[4px]">
                  <div
                    className="mb-[12px] h-[1px]"
                    style={{
                      background:
                        "linear-gradient(to right, transparent, rgba(255,255,255,0.12), transparent)",
                    }}
                  />
                  <ESP32StatusBadge esp32Status={esp32Status} collapsed={false} />
                </li>
              )}
            </ul>
          </nav>

          {/* Footer */}
          {!isMobile && (
            <div className="shrink-0">
              <div
                className="mx-[14px] mb-[12px] h-[1px]"
                style={{
                  background:
                    "linear-gradient(to right, transparent, rgba(255,255,255,0.12), transparent)",
                }}
              />
              <div className={isExpanded ? "px-[14px] pb-[22px]" : "px-[10px] pb-[20px]"}>
                <ESP32StatusBadge
                  esp32Status={esp32Status}
                  collapsed={!isExpanded}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Outfit:wght@400;500;600;700&display=swap');
        @keyframes sb-pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes sb-spin  { to{transform:rotate(360deg)} }
        aside ::-webkit-scrollbar { width: 0 }
      `}</style>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => setMobileOpen(false)}
          className="lg:hidden fixed inset-0 z-40 border-none cursor-pointer backdrop-blur-[4px]"
          style={{ background: "rgba(10,8,4,0.55)" }}
        />
      )}

      {/* Desktop */}
      <aside
        className="hidden lg:block fixed top-0 left-0 h-screen z-50 overflow-hidden transition-[width] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
        style={{
          background: BG,
          borderRight: "1px solid rgba(255,255,255,0.1)",
          boxShadow: "4px 0 32px rgba(0,0,0,0.25)",
          width: collapsed ? 72 : 252,
        }}
      >
        {/* Top shimmer */}
        <div
          className="absolute top-0 left-0 right-0 h-[2px] z-10 pointer-events-none"
          style={{
            background:
              "linear-gradient(to right, transparent, rgba(149,213,178,0.6), rgba(255,255,255,0.3), transparent)",
          }}
        />
        <SidebarContent />
      </aside>

      {/* Mobile */}
      <aside
        className="lg:hidden fixed top-0 left-0 h-screen z-50 w-[252px] transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
        style={{
          background: BG,
          borderRight: "1px solid rgba(255,255,255,0.1)",
          boxShadow: "4px 0 32px rgba(0,0,0,0.25)",
          transform: mobileOpen ? "translateX(0)" : "translateX(-100%)",
        }}
      >
        <div
          className="absolute top-0 left-0 right-0 h-[2px] z-10 pointer-events-none"
          style={{
            background:
              "linear-gradient(to right, transparent, rgba(149,213,178,0.6), rgba(255,255,255,0.3), transparent)",
          }}
        />
        <SidebarContent isMobile />
      </aside>
    </>
  );
}