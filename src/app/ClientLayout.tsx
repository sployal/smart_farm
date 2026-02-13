"use client";
import Sidebar from "../../components/dashboard/sidebar";
import { usePathname } from "next/navigation";
import { Geist, Geist_Mono } from "next/font/google";
import React from "react";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideSidebar = pathname === "/";
  return (
    <div className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
      {!hideSidebar && <Sidebar />}
      <main
        className="transition-all duration-300 min-h-screen"
        style={hideSidebar ? {} : { marginLeft: "var(--sidebar-width, 256px)" } as React.CSSProperties}
      >
        <style>{`
          @media (max-width: 1023px) {
            main {
              margin-left: 0 !important;
            }
          }
        `}</style>
        {children}
      </main>
    </div>
  );
}
