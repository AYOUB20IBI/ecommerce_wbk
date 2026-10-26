
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import "./admin.css";
import "./dashboard-motion.css";

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-admin-geist",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-admin-geist-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Admin",
    template: "%s | Commerce Engine Admin",
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div
      className={[
        "admin-theme",
        "min-h-screen",
        "font-sans",
        geistSans.variable,
        geistMono.variable,
      ].join(" ")}
    >
      {children}
    </div>
  );
}
