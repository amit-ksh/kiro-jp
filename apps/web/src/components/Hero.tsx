"use client";

import { useState } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import {
  Download,
  ShieldCheck,
  CheckCircle,
  Repeat,
  ArrowRight,
  Volume2,
  Flame,
  Check,
} from "lucide-react";
import confetti from "canvas-confetti";
import { playChime, speakJapanese } from "./AudioEffects";

interface HeroProps {
  apkUrl: string;
}

export function Hero({ apkUrl }: HeroProps) {
  const [activeWordIndex, setActiveWordIndex] = useState(0);

  const heroWords = [
    { kanji: "水", reading: "みず", romaji: "mizu", meaning: "Water", sentence: "水をください。", sentenceEn: "Water, please." },
    { kanji: "お茶", reading: "おちゃ", romaji: "ocha", meaning: "Tea", sentence: "お茶をください。", sentenceEn: "Tea, please." },
    { kanji: "本", reading: "ほん", romaji: "hon", meaning: "Book", sentence: "本を読みます。", sentenceEn: "I read a book." },
  ];

  const currentHeroWord = heroWords[activeWordIndex];

  // 3D tilt interaction for the phone showcase
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], [6, -6]), {
    stiffness: 120,
    damping: 20,
  });
  const rotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-8, 8]), {
    stiffness: 120,
    damping: 20,
  });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    mouseX.set(x);
    mouseY.set(y);
  };

  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  const handleDownloadClick = () => {
    playChime("success");
    confetti({
      particleCount: 50,
      spread: 70,
      origin: { y: 0.6 },
      colors: ["#FF5C00", "#37469E", "#FFFFFF"],
    });
  };

  const handlePlayVoice = (text: string) => {
    playChime("pop");
    speakJapanese(text);
  };

  const nextWord = () => {
    playChime("click");
    setActiveWordIndex((prev) => (prev + 1) % heroWords.length);
  };

  return (
    <section
      className="hero-section hero-section-minimal"
      id="top"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Background Seigaiha wave graphic & split ambience */}
      <div className="hero-bg-split">
        <div className="hero-bg-indigo" />
        <div className="hero-bg-orange">
          <svg className="seigaiha-pattern" viewBox="0 0 100 100" preserveAspectRatio="none">
            <defs>
              <pattern id="seigaiha" width="40" height="20" patternUnits="userSpaceOnUse">
                <path
                  d="M 0,20 A 20,20 0 0,1 40,20 A 20,20 0 0,1 80,20 M 20,20 A 10,10 0 0,1 40,20 M -20,20 A 20,20 0 0,1 20,20 M 0,10 A 10,10 0 0,1 20,10 A 10,10 0 0,1 40,10"
                  fill="none"
                  stroke="rgba(255,255,255,0.14)"
                  strokeWidth="1.5"
                />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#seigaiha)" />
          </svg>
        </div>
      </div>

      <div className="hero-container" id="overview">
        {/* Left Column: Kinetic Content */}
        <div className="hero-content">
          {/* Brand pill badge */}
          <div className="hero-badge">
            <span className="hero-badge-tag">日本語</span>
            <span className="hero-badge-text">Kiro JP · Android Japanese Learning</span>
          </div>

          {/* Headline */}
          <h1 className="hero-title">
            <span>Remember it.</span>
            <span className="gradient-text">Understand it.</span>
            <span>Use it.</span>
          </h1>

          {/* Subtitle */}
          <p className="hero-desc">
            Japanese through kanji recall, grammar patterns, and conversations connected to your interests.
            Prepared study is designed to remain useful offline on Android.
          </p>

          {/* CTA Group */}
          <div className="hero-ctas">
            <a
              href={apkUrl}
              className="hero-cta-primary"
              onClick={handleDownloadClick}
              download
            >
              <div className="hero-cta-icon-box">
                <Download size={18} />
              </div>
              <div className="hero-cta-labels">
                <span className="hero-cta-action">Download Android APK</span>
                <span className="hero-cta-meta">v0.2.10 · 102.7 MB · Android 7.0+</span>
              </div>
            </a>
          </div>

          {/* Grounded feature badges */}
          <div className="hero-metrics">
            <div className="metric-item">
              <ShieldCheck size={15} className="metric-icon" />
              <span>Signed Release APK</span>
            </div>
            <div className="metric-divider">·</div>
            <div className="metric-item">
              <CheckCircle size={15} className="metric-icon" />
              <span>7 Prepared N5/N4 Levels</span>
            </div>
            <div className="metric-divider">·</div>
            <div className="metric-item">
              <Repeat size={15} className="metric-icon" />
              <span>Spaced Review</span>
            </div>
          </div>

          {/* Jump to sample lesson */}
          <div className="hero-sublink">
            <a href="#sample-lesson" onClick={() => playChime("click")}>
              <span>Explore authentic Starter Level 1 lesson below</span>
              <ArrowRight size={13} />
            </a>
          </div>
        </div>

        {/* Right Column: Clean 3D Phone Mockup Showcase */}
        <div className="hero-visual">
          <div className="japanese-vertical-banner" aria-hidden="true">
            <span>日本語学習</span>
            <span>漢字・文法</span>
            <span>会話練習</span>
          </div>

          <motion.div
            className="hero-mockup-wrapper"
            style={{
              rotateX,
              rotateY,
              transformStyle: "preserve-3d",
            }}
          >
            {/* Ambient subtle backlights */}
            <div className="mockup-glow-indigo" />
            <div className="mockup-glow-orange" />

            {/* Smartphone Frame (Fixed, minimal, well-proportioned) */}
            <div className="phone-device-frame-hero">
              {/* Dynamic Island */}
              <div className="phone-island-top">
                <div className="phone-cam-dot" />
                <div className="phone-mic-dot" />
              </div>

              {/* Status Bar */}
              <div className="phone-top-status">
                <span>9:41</span>
                <div className="phone-top-icons">
                  <span>5G</span>
                  <span>100%</span>
                </div>
              </div>

              {/* App Screen Content */}
              <div className="phone-app-inner-screen">
                <div className="phone-header-row">
                  <span className="phone-module-chip">Level 1 · N5</span>
                  <div className="phone-streak-chip">
                    <Flame size={12} className="text-orange-500 fill-orange-500" />
                    <span>4d streak</span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="phone-meter-bar">
                  <div className="phone-meter-fill" style={{ width: "65%" }} />
                </div>

                {/* Flashcard Area */}
                <div className="phone-card-surface" onClick={nextWord}>
                  <div className="phone-card-meta">
                    <span className="phone-radical-badge">Radical: 氵 (Water)</span>
                    <button
                      type="button"
                      className="phone-audio-trigger"
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePlayVoice(currentHeroWord.sentence);
                      }}
                      title="Play pronunciation"
                    >
                      <Volume2 size={15} />
                    </button>
                  </div>

                  <div className="phone-kanji-center">
                    <span className="phone-kanji-symbol">{currentHeroWord.kanji}</span>
                    <span className="phone-furigana-text">{currentHeroWord.reading}</span>
                    <span className="phone-romaji-text">/{currentHeroWord.romaji}/</span>
                    <h3 className="phone-meaning-text">{currentHeroWord.meaning}</h3>
                  </div>

                  <div className="phone-sentence-strip">
                    <p className="phone-sentence-japanese">{currentHeroWord.sentence}</p>
                    <p className="phone-sentence-english">"{currentHeroWord.sentenceEn}"</p>
                  </div>
                </div>

                {/* Spaced Review Action Buttons */}
                <div className="phone-srs-row">
                  <button type="button" className="srs-pill srs-pill-hard" onClick={nextWord}>
                    <span>Hard</span>
                    <small>1d</small>
                  </button>
                  <button type="button" className="srs-pill srs-pill-good" onClick={nextWord}>
                    <span>Good</span>
                    <small>3d</small>
                  </button>
                  <button type="button" className="srs-pill srs-pill-easy" onClick={nextWord}>
                    <span>Easy</span>
                    <small>7d</small>
                  </button>
                </div>

                {/* Offline note */}
                <div className="phone-bottom-note">
                  <Check size={12} className="text-emerald-400" />
                  <span>Prepared & Offline Ready</span>
                </div>
              </div>

              {/* Bottom Home Indicator */}
              <div className="phone-home-bar" />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
