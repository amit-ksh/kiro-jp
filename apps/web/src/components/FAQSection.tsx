"use client";

import { useState } from "react";
import { ChevronDown, HelpCircle } from "lucide-react";
import { playChime } from "./AudioEffects";

interface FAQItem {
  q: string;
  a: string;
}

const faqs: FAQItem[] = [
  {
    q: "How does Kiro JP teach Japanese?",
    a: "Kiro JP teaches kanji through visible components and radicals first, followed by whole-word readings and grammar patterns. You learn the meaning and reading before being prompted for active recall. Each day's study links into a short conversation about topics you select.",
  },
  {
    q: "Does Kiro JP work offline?",
    a: "Previously prepared starter lessons, review queues, and item audio are cached on device and remain usable without an internet connection. Generating new AI conversation replies and fetching fresh daily topic recommendations requires an active internet connection.",
  },
  {
    q: "What role does Qloo play in Kiro JP?",
    a: "Qloo provides cultural context tools that inform daily conversation topics based on your saved interests—such as ramen dining, Kyoto travel, anime, manga, and Japanese daily life—ensuring conversations feel authentic and relevant.",
  },
  {
    q: "How does speaking practice work?",
    a: "Speaking exercises pair native model audio with your own voice recording and transcript feedback. You can listen, record your phrase, and review the transcription. A typed fallback is always available for quiet environments.",
  },
  {
    q: "Is there an iOS version of Kiro JP?",
    a: "No. Kiro JP is developed specifically as an Android application. iOS is not currently available.",
  },
  {
    q: "What Android version is required?",
    a: "The APK has a manifest minimum of Android 7.0 (API 24) or newer. The signed v0.2.10 release is approximately 102.7 MB.",
  },
];

export function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggleFAQ = (idx: number) => {
    playChime("click");
    setOpenIndex(openIndex === idx ? null : idx);
  };

  return (
    <section className="faq-section" id="faq">
      <div className="faq-container">
        {/* Header */}
        <div className="faq-header text-center">
          <div className="faq-badge">
            <HelpCircle size={14} />
            <span>Questions & Details</span>
          </div>
          <h2 className="faq-title">
            Frequently Asked <span className="gradient-text">Questions</span>
          </h2>
          <p className="faq-subtitle">
            Accurate answers regarding the curriculum, offline capabilities, AI context, and platform availability.
          </p>
        </div>

        {/* Accordion list */}
        <div className="faq-list">
          {faqs.map((item, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div key={idx} className={`faq-card ${isOpen ? "faq-card-open" : ""}`}>
                <button
                  type="button"
                  className="faq-question-btn"
                  onClick={() => toggleFAQ(idx)}
                >
                  <span className="faq-q-text">{item.q}</span>
                  <ChevronDown
                    size={18}
                    className="faq-chevron"
                    style={{
                      transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                      transition: "transform 0.2s ease",
                    }}
                  />
                </button>
                {isOpen && (
                  <div className="faq-answer-wrap">
                    <p className="faq-answer-text">{item.a}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
