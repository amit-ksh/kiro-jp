"use client";

import { useState } from "react";
import { Volume2, BookOpen, Sparkles } from "lucide-react";
import { playChime, speakJapanese } from "./AudioEffects";

interface LessonWord {
  id: string;
  kanji: string;
  word: string;
  reading: string;
  romaji: string;
  meaning: string;
  mnemonic: string;
  readingNote: string;
  sentenceJa: string;
  sentenceReading: string;
  sentenceEn: string;
}

const starterWords: LessonWord[] = [
  {
    id: "water",
    kanji: "水",
    word: "水",
    reading: "みず",
    romaji: "mizu",
    meaning: "Water",
    mnemonic:
      "Imagine a stream with splashes spreading away from its center. Link that picture with water.",
    readingNote:
      "In this word, 水 is みず. Today's question asks for this word, not every reading of the kanji.",
    sentenceJa: "水をください。",
    sentenceReading: "みずをください",
    sentenceEn: "Water, please.",
  },
  {
    id: "tea",
    kanji: "お茶",
    word: "お茶",
    reading: "おちゃ",
    romaji: "ocha",
    meaning: "Tea (Japanese tea)",
    mnemonic:
      "Picture leaves above a little tea stand. Link this shape with a warm cup of tea.",
    readingNote:
      "茶 contributes ちゃ in お茶. Read the whole word おちゃ, including お.",
    sentenceJa: "お茶をください。",
    sentenceReading: "おちゃをください",
    sentenceEn: "Tea, please.",
  },
  {
    id: "book",
    kanji: "本",
    word: "本",
    reading: "ほん",
    romaji: "hon",
    meaning: "A book",
    mnemonic:
      "Imagine a tree with a shelf near its base. Put a book on that shelf in your memory.",
    readingNote: "本 is ほん when it means a book. Its other uses have their own prompts.",
    sentenceJa: "本をください。",
    sentenceReading: "ほんをください",
    sentenceEn: "A book, please.",
  },
  {
    id: "yen",
    kanji: "円",
    word: "円",
    reading: "えん",
    romaji: "en",
    meaning: "Yen (Japanese currency)",
    mnemonic:
      "Picture a coin inside this shape. In a price, 円 tells you the amount is in yen.",
    readingNote: "For prices, 円 is えん. We teach the currency meaning here.",
    sentenceJa: "100円です。",
    sentenceReading: "ひゃくえんです",
    sentenceEn: "It is 100 yen.",
  },
];

export function LessonPreview() {
  const [selectedWordId, setSelectedWordId] = useState("water");
  const [showMnemonic, setShowMnemonic] = useState(true);
  const activeWord = starterWords.find((w) => w.id === selectedWordId) || starterWords[0];

  const handleSelectWord = (id: string) => {
    playChime("click");
    setSelectedWordId(id);
  };

  const handleAudio = (text: string) => {
    playChime("pop");
    speakJapanese(text);
  };

  return (
    <section className="lesson-section" id="sample-lesson">
      <div className="lesson-container">
        {/* Section Header */}
        <div className="lesson-header text-center">
          <div className="lesson-badge">
            <BookOpen size={14} />
            <span>Actual Curriculum Sample</span>
          </div>
          <h2 className="lesson-title">
            Starter Level 1: <span className="gradient-text">A Polite Request</span>
          </h2>
          <p className="lesson-subtitle">
            An authentic look at how Kiro JP introduces kanji, word readings, mnemonic memory aids, and real sentence patterns.
          </p>
        </div>

        {/* Lesson Interaction Layout: Left Word Selector + Right Mobile Mockup Phone */}
        <div className="lesson-card-wrapper">
          {/* Left: Word Selector Tabs & Grammar Pattern */}
          <div className="lesson-word-selector">
            <span className="selector-label">Target Kanji & Words:</span>
            <div className="word-pills-column">
              {starterWords.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`word-pill-item ${selectedWordId === item.id ? "active" : ""}`}
                  onClick={() => handleSelectWord(item.id)}
                >
                  <span className="word-pill-kanji">{item.kanji}</span>
                  <div className="word-pill-info">
                    <span className="word-pill-word">{item.word} ({item.reading})</span>
                    <span className="word-pill-meaning">{item.meaning}</span>
                  </div>
                </button>
              ))}
            </div>

            {/* Grammar pattern callout */}
            <div className="grammar-pattern-card">
              <span className="pattern-tag">Grammar Focus</span>
              <h4>[item] + をください</h4>
              <p>Name the item, add を (pronounced <em>o</em>), then ください to request it politely in a shop or cafe.</p>
            </div>
          </div>

          {/* Right: Phone Mockup Housing the Active Lesson Screen */}
          <div className="lesson-mockup-wrapper">
            <div className="phone-device-frame-curriculum">
              {/* Dynamic Island */}
              <div className="phone-island-top">
                <div className="phone-cam-dot" />
                <div className="phone-mic-dot" />
              </div>

              {/* Status bar */}
              <div className="phone-top-status phone-top-status-light">
                <span>9:41</span>
                <div className="phone-top-icons">
                  <span>5G</span>
                  <span>100%</span>
                </div>
              </div>

              {/* Inner Screen */}
              <div className="lesson-screen-body">
                <div className="lesson-screen-topbar">
                  <span className="lesson-tag-pill">Level 1 · Module Outcome</span>
                  <button
                    type="button"
                    className="lesson-audio-action-btn"
                    onClick={() => handleAudio(activeWord.sentenceJa)}
                    title="Play pronunciation"
                  >
                    <Volume2 size={14} />
                    <span>Hear Audio</span>
                  </button>
                </div>

                {/* Big Kanji Display */}
                <div className="lesson-screen-kanji-box">
                  <span className="lesson-screen-glyph">{activeWord.kanji}</span>
                  <div className="lesson-screen-readings">
                    <span className="lesson-screen-furigana">{activeWord.reading}</span>
                    <span className="lesson-screen-romaji">/{activeWord.romaji}/</span>
                  </div>
                  <h3 className="lesson-screen-meaning">{activeWord.meaning}</h3>
                </div>

                {/* Memory Mnemonic Card */}
                <div className="lesson-screen-mnemonic">
                  <div className="mnemonic-header-row">
                    <span className="mnemonic-badge-title">
                      <Sparkles size={13} color="#FF5C00" />
                      <span>Memory Picture</span>
                    </span>
                    <button
                      type="button"
                      className="mnemonic-toggle-btn"
                      onClick={() => setShowMnemonic(!showMnemonic)}
                    >
                      {showMnemonic ? "Hide" : "Show"}
                    </button>
                  </div>
                  {showMnemonic && <p className="mnemonic-body-text">{activeWord.mnemonic}</p>}
                </div>

                {/* Context Sentence Card */}
                <div className="lesson-screen-sentence">
                  <div className="sentence-audio-row">
                    <span className="sentence-text-japanese">{activeWord.sentenceJa}</span>
                    <button
                      type="button"
                      className="sentence-voice-btn"
                      onClick={() => handleAudio(activeWord.sentenceJa)}
                      aria-label="Play sentence"
                    >
                      <Volume2 size={13} />
                    </button>
                  </div>
                  <span className="sentence-text-reading">{activeWord.sentenceReading}</span>
                  <span className="sentence-text-english">"{activeWord.sentenceEn}"</span>
                </div>

                {/* Pedagogy note */}
                
              </div>

              {/* Bottom Home Indicator */}
              <div className="phone-home-bar phone-home-bar-dark" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
