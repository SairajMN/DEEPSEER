import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { VisualEditsMessenger } from "orchids-visual-edits";
import { Header } from "@/components/layout/header";
import { LiveDataBootstrap } from "@/components/layout/live-data-bootstrap";
import { ConnectionBanner } from "@/components/shared/connection-banner";
import { WalletListener } from "@/components/wallet/wallet-listener";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DeepSeer — AI-Assisted Prediction Market",
  description: "Institutional-grade, AI-assisted, verifiable prediction market with live blockchain data and Chainlink oracle integration.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-background`}
      >
        <WalletListener />
        <LiveDataBootstrap />
        <Header />
        <ConnectionBanner />
        <main className="flex-1">{children}</main>
        <Toaster />
        <VisualEditsMessenger />
      </body>
    </html>
  );
}
