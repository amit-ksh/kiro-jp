"use client";

import Image from "next/image";
import { Smartphone, ExternalLink } from "lucide-react";

interface FooterProps {
  apkUrl: string;
}

export function Footer({ apkUrl }: FooterProps) {
  return (
    <footer className="aceternity-footer" id="footer">
      <div className="aceternity-footer-container">
        {/* Main Grid: Left Brand Block + Right 4-Columns Link Grid */}
        <div className="aceternity-footer-main">
          {/* Brand Info */}
          <div className="aceternity-footer-brand">
            <div className="aceternity-brand-header">
              <Image
                src="/kiro-mark.svg"
                alt="Kiro JP Logo"
                width={36}
                height={36}
                unoptimized
                className="aceternity-brand-logo"
              />
              <div className="aceternity-brand-text">
                <span className="aceternity-brand-title">Kiro JP</span>
                <span className="aceternity-brand-badge">日本語</span>
              </div>
            </div>

            <p className="aceternity-brand-tagline">
              Japanese by instinct. Native Android learning experience connecting
              kanji components, grammar patterns, and conversations.
            </p>

            <div className="aceternity-brand-powered">
              <span className="powered-label">Powered by</span>
              <span className="powered-nebius">Nebius AI Studio</span>
            </div>
          </div>

          {/* 4 Link Grids */}
          <div className="aceternity-four-grids">
            {/* Grid 1: Pages */}
            <div className="aceternity-grid-col">
              <h4 className="aceternity-grid-title">Pages</h4>
              <ul className="aceternity-grid-links">
                <li><a href="#overview">Overview</a></li>
                <li><a href="#method">The Kiro Method</a></li>
                <li><a href="#sample-lesson">Sample Lesson</a></li>
                <li><a href="#curriculum">Curriculum</a></li>
                <li><a href="#faq">FAQ</a></li>
              </ul>
            </div>

            {/* Grid 2: Socials */}
            <div className="aceternity-grid-col">
              <h4 className="aceternity-grid-title">Socials</h4>
              <ul className="aceternity-grid-links">
                <li>
                  <a href="https://x.com" target="_blank" rel="noopener noreferrer">
                    <span>Twitter / X</span>
                  </a>
                </li>
                <li>
                  <a href="https://discord.com" target="_blank" rel="noopener noreferrer">
                    <span>Discord Community</span>
                  </a>
                </li>
                <li>
                  <a href="https://github.com" target="_blank" rel="noopener noreferrer">
                    <span>GitHub</span>
                  </a>
                </li>
                <li>
                  <a href="https://reddit.com/r/LearnJapanese" target="_blank" rel="noopener noreferrer">
                    <span>Reddit</span>
                  </a>
                </li>
              </ul>
            </div>

            {/* Grid 3: Legal */}
            <div className="aceternity-grid-col">
              <h4 className="aceternity-grid-title">Legal</h4>
              <ul className="aceternity-grid-links">
                <li><a href="#faq">Privacy Policy</a></li>
                <li><a href="#faq">Terms of Service</a></li>
                <li><a href="#faq">Distribution Policy</a></li>
                <li><a href="#faq">Offline Licensing</a></li>
              </ul>
            </div>

            {/* Grid 4: Download */}
            <div className="aceternity-grid-col">
              <h4 className="aceternity-grid-title">Download</h4>
              <ul className="aceternity-grid-links">
                <li>
                  <a href={apkUrl} className="aceternity-apk-btn" download>
                    <Smartphone size={13} className="text-[#FF5C00]" />
                    <span>Android APK</span>
                  </a>
                </li>
                <li><span className="aceternity-meta-item">EAS Signed Build</span></li>
                <li><span className="aceternity-meta-item">API 24+ Compatible</span></li>
                <li><span className="aceternity-meta-item">Offline Ready</span></li>
              </ul>
            </div>
          </div>
        </div>

        {/* Bottom Bar: Divider + Copyright & Attribution */}
        <div className="aceternity-footer-bottom">
          <p className="aceternity-copyright">
            © 2026 Kiro JP. All rights reserved.
          </p>
          <div className="aceternity-bottom-right">
            <span className="aceternity-bottom-note">
              Crafted for Native Android
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
