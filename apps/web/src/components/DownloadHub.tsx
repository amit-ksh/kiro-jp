"use client";

import { useState, useEffect } from "react";
import {
  Download,
  Smartphone,
  ShieldCheck,
  ChevronDown,
  HardDrive,
  Cpu,
  QrCode,
  X,
  Maximize2,
} from "lucide-react";
import confetti from "canvas-confetti";
import QRCode from "qrcode";
import { playChime } from "./AudioEffects";

interface DownloadHubProps {
  apkUrl: string;
}

export function DownloadHub({ apkUrl }: DownloadHubProps) {
  const [showInstallSteps, setShowInstallSteps] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [qrExpanded, setQrExpanded] = useState(false);

  useEffect(() => {
    if (apkUrl) {
      QRCode.toDataURL(apkUrl, {
        width: 320,
        margin: 1,
        color: {
          dark: "#17204B",
          light: "#FFFFFF",
        },
      })
        .then((url) => setQrDataUrl(url))
        .catch((err) => console.error("QR Code generation error:", err));
    }
  }, [apkUrl]);

  const handleDownload = () => {
    playChime("success");
    confetti({
      particleCount: 50,
      spread: 70,
      origin: { y: 0.6 },
      colors: ["#FF5C00", "#37469E", "#FFFFFF"],
    });
  };

  return (
    <section className="download-section" id="android">
      <div className="download-container">
        {/* Header */}
        <div className="download-header text-center">
          <div className="download-badge">
            <Smartphone size={14} />
            <span>Installation & Distribution</span>
          </div>
          <h2 className="download-title">
            Install <span className="gradient-text">Kiro JP</span>
          </h2>
          <p className="download-subtitle">
            Kiro JP is an Android native learning application. Prepared study is available offline, and daily conversation recommendations connect to your interests.
          </p>
        </div>

        {/* Centered Android Release Card */}
        <div className="download-cards-single">
          <div className="download-card android-card">
            <div className="card-top-tag live-tag">
              <span className="live-dot" />
              <span>OFFICIAL ANDROID RELEASE</span>
            </div>

            <div className="card-brand-row">
              <div className="card-icon-box android-icon-bg">
                <Smartphone size={28} />
              </div>
              <div>
                <h3>Android APK (Release Build)</h3>
                <span className="card-version-text">Version 0.2.10 · EAS Signed Release</span>
              </div>
            </div>

            <p className="card-desc">
              Includes all 7 N5/N4 starter modules, radical breakdowns, offline review queues, and interest-guided conversations.
            </p>

            <div className="card-specs-row">
              <div className="spec-pill">
                <HardDrive size={13} />
                <span>102.7 MB</span>
              </div>
              <div className="spec-pill">
                <Cpu size={13} />
                <span>Android 7.0+ (API 24+)</span>
              </div>
              <div className="spec-pill">
                <ShieldCheck size={13} />
                <span>Signed Release</span>
              </div>
            </div>

            <div className="card-action-group">
              <a
                href={apkUrl}
                className="btn-download-primary"
                onClick={handleDownload}
                download
              >
                <Download size={18} />
                <span>Download Android APK</span>
              </a>

              {/* Real QR Code - CLICK TO EXPAND BIGGER! */}
              <div
                className="qr-preview-box cursor-pointer group"
                onClick={() => {
                  playChime("click");
                  setQrExpanded(true);
                }}
                title="Click to enlarge QR code for scanning"
              >
                <div className="qr-code-graphic relative">
                  {qrDataUrl ? (
                    <img
                      src={qrDataUrl}
                      alt="Click to enlarge QR Code"
                      width={68}
                      height={68}
                      className="rounded transition-transform group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex items-center justify-center w-[68px] h-[68px] bg-white rounded">
                      <QrCode size={36} className="text-[#17204B] animate-pulse" />
                    </div>
                  )}
                  
                </div>
                <div className="qr-text">
                  <span className="qr-title flex items-center gap-1">
                    <span>Scan on Android</span>
                    <Maximize2 size={11} className="text-[#FF5C00]" />
                  </span>
                  <span className="qr-sub">Click to enlarge</span>
                </div>
              </div>
            </div>

            {/* Sideload Guide Accordion */}
            <div className="install-accordion">
              <button
                type="button"
                className="install-toggle-btn"
                onClick={() => {
                  playChime("click");
                  setShowInstallSteps(!showInstallSteps);
                }}
              >
                <span>Sideloading guide (3 steps)</span>
                <ChevronDown
                  size={15}
                  style={{
                    transform: showInstallSteps ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "transform 0.2s ease",
                  }}
                />
              </button>

              {showInstallSteps && (
                <div className="install-steps-body">
                  <div className="step-row">
                    <span className="step-num">1</span>
                    <p>Tap <strong>Download Android APK</strong> on your device or scan the QR code above.</p>
                  </div>
                  <div className="step-row">
                    <span className="step-num">2</span>
                    <p>Open the downloaded APK file. If prompted, tap <strong>Settings → Allow install from this source</strong>.</p>
                  </div>
                  <div className="step-row">
                    <span className="step-num">3</span>
                    <p>Tap <strong>Install</strong> to start learning Japanese offline.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* BIG QR CODE MODAL ON CLICK */}
      {qrExpanded && (
        <div
          className="qr-modal-backdrop"
          onClick={() => setQrExpanded(false)}
        >
          <div
            className="qr-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="qr-modal-header">
              <div className="flex items-center gap-2">
                <Smartphone size={20} className="text-[#FF5C00]" />
                <h3 className="text-lg font-bold text-white">Scan to Install Kiro JP</h3>
              </div>
              <button
                type="button"
                className="qr-modal-close"
                onClick={() => setQrExpanded(false)}
                aria-label="Close modal"
              >
                <X size={20} />
              </button>
            </div>

            <div className="qr-modal-image-wrapper">
              {qrDataUrl && (
                <img
                  src={qrDataUrl}
                  alt="Full Size QR Code for APK download"
                  width={280}
                  height={280}
                  className="rounded-xl shadow-2xl mx-auto"
                />
              )}
            </div>

            <div className="qr-modal-footer">
              <p className="text-sm font-semibold text-white">
                Point your Android camera at the code
              </p>
              <p className="text-xs text-slate-300 mt-1">
                Your device will immediately prompt you to download the verified v0.2.10 release APK.
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
