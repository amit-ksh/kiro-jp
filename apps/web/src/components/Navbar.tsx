"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Download } from "lucide-react";
import confetti from "canvas-confetti";
import { playChime } from "./AudioEffects";

interface NavbarProps {
  apkUrl: string;
}

export function Navbar({ apkUrl }: NavbarProps) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 25);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleDownload = () => {
    playChime("success");
    confetti({
      particleCount: 35,
      spread: 55,
      origin: { y: 0.1 },
      colors: ["#FF5C00", "#37469E", "#FFFFFF"],
    });
  };

  return (
    <header className={`nav-header ${scrolled ? "nav-scrolled" : ""}`}>
      <div className="nav-container nav-container-minimal">
        {/* Brand Logo & Title */}
        <a href="#top" className="nav-brand" onClick={() => playChime("click")}>
          <div className="nav-logo-box">
            <Image
              src="/kiro-mark.svg"
              alt="Kiro JP Logo"
              width={34}
              height={34}
              priority
              unoptimized
            />
          </div>
          <div className="nav-brand-text">
            <span className="nav-brand-title">
              Kiro JP
              <span className="nav-brand-badge">日</span>
            </span>
            <span className="nav-brand-sub">Japanese by Instinct</span>
          </div>
        </a>

        {/* Right CTA Action: Download APK Button Only */}
        <div className="nav-actions">
          <a
            href={apkUrl}
            className="download-app-btn"
            onClick={handleDownload}
            download
          >
            <Download size={15} className="btn-icon-bounce" />
            <span>Download APK</span>
            <span className="btn-platform-tag">v0.2.10</span>
          </a>
        </div>
      </div>
    </header>
  );
}
