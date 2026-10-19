"use client";

import { useState } from "react";
import { BookOpen, CheckCircle2 } from "lucide-react";
import { playChime } from "./AudioEffects";

interface RealLevel {
  level: number;
  title: string;
  outcome: string;
  kanji: string[];
  grammar: string;
}

const realLevels: RealLevel[] = [
  {
    level: 1,
    title: "A Polite Request",
    outcome: "Request water, tea or a book politely in a shop or café",
    kanji: ["水", "茶", "本", "円"],
    grammar: "[item] + をください",
  },
  {
    level: 2,
    title: "Asking Directions",
    outcome: "Locate entrances, exits, and understand left and right",
    kanji: ["入", "出", "右", "左"],
    grammar: "[place] + に行きます",
  },
  {
    level: 3,
    title: "Expressing Favorites",
    outcome: "Share musical and cultural preferences with native speakers",
    kanji: ["日", "音", "楽"],
    grammar: "[topic] + が好きです",
  },
  {
    level: 4,
    title: "Availability & Shops",
    outcome: "Inquire about shops, new items, and what exists nearby",
    kanji: ["店", "新", "古"],
    grammar: "〜があります / 〜がいます",
  },
  {
    level: 5,
    title: "Desires & Activities",
    outcome: "Express what you want to eat, drink, see, or experience",
    kanji: ["行", "見", "食", "飲"],
    grammar: "〜たいです (Desire form)",
  },
  {
    level: 6,
    title: "Language & Ability",
    outcome: "Discuss skills in reading, writing, listening, and speaking",
    kanji: ["読", "書", "話", "聞"],
    grammar: "〜ができる (Potential form)",
  },
  {
    level: 7,
    title: "Trying Experiences",
    outcome: "Encourage trying local dishes, shopping, and everyday tasks",
    kanji: ["買", "作"],
    grammar: "〜てみます (Try doing)",
  },
];

export function CurriculumSection() {
  const [activeLevelNum, setActiveLevelNum] = useState(1);
  const activeLevel = realLevels.find((l) => l.level === activeLevelNum) || realLevels[0];

  return (
    <section className="curriculum-section" id="curriculum">
      <div className="curriculum-container">
        {/* Header */}
        <div className="curriculum-header text-center">
          <div className="curriculum-badge">
            <BookOpen size={14} />
            <span>Actual Seven-Level Inventory</span>
          </div>
          <h2 className="curriculum-title">
            Structured Starter <span className="gradient-text">Curriculum</span>
          </h2>
          <p className="curriculum-subtitle">
            Kiro JP launches with seven source-checked starter modules designed for N5/N4 beginners, leading into practical daily conversations.
          </p>
        </div>

        {/* Level Switcher Buttons */}
        <div className="level-pills-row">
          {realLevels.map((lvl) => (
            <button
              key={lvl.level}
              type="button"
              className={`level-pill-btn ${activeLevelNum === lvl.level ? "active" : ""}`}
              onClick={() => {
                playChime("click");
                setActiveLevelNum(lvl.level);
              }}
            >
              <span className="lvl-pill-num">Level {lvl.level}</span>
              <span className="lvl-pill-title">{lvl.title}</span>
            </button>
          ))}
        </div>

        {/* Active Level Detail Surface */}
        <div className="level-detail-card">
          <div className="lvl-card-header">
            <div>
              <span className="lvl-card-tag">STARTER LEVEL {activeLevel.level} SYLLABUS</span>
              <h3>{activeLevel.title}</h3>
              <p className="lvl-theme">Goal: {activeLevel.outcome}</p>
            </div>
            <div className="lvl-status-badge">
              <CheckCircle2 size={16} />
              <span>Prepared & Available</span>
            </div>
          </div>

          <div className="lvl-card-grid">
            {/* Kanji Card */}
            <div className="lvl-subcard">
              <span className="lvl-subcard-label">Target Kanji in Lesson</span>
              <div className="lvl-kanji-row">
                {activeLevel.kanji.map((k, i) => (
                  <span key={i} className="lvl-kanji-item">
                    {k}
                  </span>
                ))}
              </div>
              <span className="lvl-subcard-hint">Visible components and readings taught first</span>
            </div>

            {/* Grammar Card */}
            <div className="lvl-subcard">
              <span className="lvl-subcard-label">Grammar Pattern</span>
              <div className="lvl-grammar-box">
                <code>{activeLevel.grammar}</code>
              </div>
              <span className="lvl-subcard-hint">Practiced with model audio and sentence exercises</span>
            </div>

            {/* Learning Flow Card */}
            <div className="lvl-subcard">
              <span className="lvl-subcard-label">Learning Progression</span>
              <p className="lvl-prog-text">
                Radical Recognition → Word Readings → Sentence Pattern → Interest-Led Chat Practice.
              </p>
              <span className="lvl-subcard-hint">Spaced reviews unlock as sessions are completed</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
