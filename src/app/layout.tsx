import type { Metadata, Viewport } from "next";
import "./globals.css";
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };
export const metadata: Metadata = {
  title: "LabelDesk — Shipping label workspace",
  description: "Crop shipping labels, separate invoices, and prepare print-ready PDFs privately in your browser."
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
