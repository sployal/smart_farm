import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from "../../components/sidebar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Smart farm project",
  description: "Esp32-based smart farm project",
  icons: {
    icon: "/leaf.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`} style={{ "--sidebar-width": "256px" } as React.CSSProperties}>
        <Sidebar />
        <main className="transition-all duration-300 min-h-screen" style={{ marginLeft: "var(--sidebar-width, 256px)" } as React.CSSProperties} >
          <style>{`
            @media (max-width: 1023px) {
              main {
                margin-left: 0 !important;
              }
            }
          `}</style>
          {children}
        </main>
      </body>
    </html>
  );
}
