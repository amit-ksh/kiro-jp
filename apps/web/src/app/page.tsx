"use client";

import { Navbar } from "@/components/Navbar";
import { Hero } from "@/components/Hero";
import { MarqueeTicker } from "@/components/MarqueeTicker";
import { MethodBento } from "@/components/MethodBento";
import { LessonPreview } from "@/components/LessonPreview";
import { CurriculumSection } from "@/components/CurriculumSection";
import { DownloadHub } from "@/components/DownloadHub";
import { FAQSection } from "@/components/FAQSection";
import { Footer } from "@/components/Footer";

const APK_URL =
  process.env.NEXT_PUBLIC_APK_URL?.trim() ||
  "https://expo.dev/artifacts/eas/5tkdHBwpkv302R-B5_0UQzQzQ3SdmQ1yJerLyKdDwqI.apk";

export default function LandingPage() {
  return (
    <div className="app-landing-root">
      {/* Top Floating Glass Navigation */}
      <Navbar apkUrl={APK_URL} />

      {/* Main Page Flow */}
      <main id="main-content">
        {/* Hero Section with clean 3D phone mockup */}
        <Hero apkUrl={APK_URL} />

        {/* Dual Infinite Kinetic Marquee with real curriculum items */}
        <MarqueeTicker />

        {/* The Kiro Method: 3 Pillars (Radicals, Cultural Context via Qloo, Spaced Review & Offline) */}
        <MethodBento />

        {/* Authentic Starter Level 1 Sample Lesson */}
        <LessonPreview />

        {/* Actual 7-Level Starter Inventory */}
        <CurriculumSection />

        {/* Download Hub: Verified APK v0.2.10, QR Scanner, 3-step guide & iOS disabled status */}
        <DownloadHub apkUrl={APK_URL} />

        {/* Grounded FAQ Accordion */}
        <FAQSection />
      </main>

      {/* Kiro JP Footer */}
      <Footer apkUrl={APK_URL} />
    </div>
  );
}
