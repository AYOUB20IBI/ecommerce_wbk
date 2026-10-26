
import type { Metadata } from "next";
import "./storefront.css";

export const metadata: Metadata = {
  title: {
    default: "Online Store",
    template: "%s | Online Store",
  },
};

export default function StorefrontLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="storefront-theme min-h-screen font-sans">
      {children}
    </div>
  );
}
