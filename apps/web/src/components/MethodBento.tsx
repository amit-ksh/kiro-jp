"use client";

import { BookOpen, Utensils, Repeat, Wifi, Sparkles, Mic } from "lucide-react";

export function MethodBento() {
  return (
    <section className="bento-section" id="method">
      <div className="bento-container">
        {/* Header */}
        <div className="bento-header text-center">
          <div className="bento-badge">
            <Sparkles size={14} />
            <span>The Kiro Method</span>
          </div>
          <h2 className="bento-title">
            Language Connected to <span className="gradient-text">Your Interests</span>
          </h2>
          <p className="bento-subtitle">
            A cohesive three-part learning structure: build recognizable kanji foundations, explore interest-led conversations, and reinforce memory through spaced review.
          </p>
        </div>

        {/* 3-Pillar Clean Bento Grid */}
        <div className="bento-grid">
          {/* Pillar 1: Kanji & Radicals */}
          <div className="bento-card">
            <div className="bento-card-header">
              <div className="bento-icon-box orange">
                <BookOpen size={22} />
              </div>
              <span className="bento-tag">Component Recognition</span>
            </div>
            <div className="bento-card-body">
              <h3>Recognizable Shapes & Meanings</h3>
              <p>
                Learn recognizable radicals (氵 water, 木 tree, 言 speech) before whole kanji.
                We teach the character and word reading first, then prompt for active recall.
              </p>
              <div className="radical-mini-preview">
                <span className="rad-tag">氵 (Water) + 青 = 清 (Clean)</span>
              </div>
            </div>
          </div>

          {/* Pillar 2: Cultural AI Context */}
          <div className="bento-card">
            <div className="bento-card-header">
              <div className="bento-icon-box indigo">
                <Utensils size={22} />
              </div>
              <span className="bento-tag">Qloo Cultural Context</span>
            </div>
            <div className="bento-card-body">
              <h3>Interest-Led Daily Conversations</h3>
              <p>
                Pick food, anime, manga, music, or travel. Real Qloo cultural context informs daily conversation topics.
                Speaking practice combines model audio, recording, and transcript feedback.
              </p>
              <div className="connection-pill">
                <Wifi size={13} />
                <span>New AI conversations require an internet connection</span>
              </div>
            </div>
          </div>

          {/* Pillar 3: Spaced Review & Prepared Offline Study */}
          <div className="bento-card">
            <div className="bento-card-header">
              <div className="bento-icon-box orange">
                <Repeat size={22} />
              </div>
              <span className="bento-tag">Spaced Review</span>
            </div>
            <div className="bento-card-body">
              <h3>Retention & Offline Prepared Study</h3>
              <p>
                Reviews are scheduled after introductory lessons to strengthen recall over time.
                Prepared lessons, review items, and bundled audio work offline on your Android device.
              </p>
              <div className="offline-pill">
                <span>Prepared study works without Wi-Fi</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
