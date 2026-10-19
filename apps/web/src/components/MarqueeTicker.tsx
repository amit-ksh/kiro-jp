"use client";

const realVocabulary = [
  { kanji: "水", reading: "みず", meaning: "Water", tag: "Level 1" },
  { kanji: "お茶", reading: "おちゃ", meaning: "Tea", tag: "Level 1" },
  { kanji: "本", reading: "ほん", meaning: "Book", tag: "Level 1" },
  { kanji: "円", reading: "えん", meaning: "Yen", tag: "Level 1" },
  { kanji: "入口", reading: "いりぐち", meaning: "Entrance", tag: "Level 2" },
  { kanji: "出口", reading: "でぐち", meaning: "Exit", tag: "Level 2" },
  { kanji: "右", reading: "みぎ", meaning: "Right", tag: "Level 2" },
  { kanji: "左", reading: "ひだり", meaning: "Left", tag: "Level 2" },
  { kanji: "店", reading: "みせ", meaning: "Shop / Store", tag: "Level 4" },
  { kanji: "音楽", reading: "おんがく", meaning: "Music", tag: "Level 3" },
  { kanji: "日本", reading: "にほん", meaning: "Japan", tag: "Starter" },
  { kanji: "食べる", reading: "たべる", meaning: "To Eat", tag: "Level 5" },
];

export function MarqueeTicker() {
  return (
    <div className="marquee-wrapper" aria-hidden="true">
      {/* Row 1: Authentic Japanese Vocabulary */}
      <div className="marquee-track-container">
        <div className="marquee-track track-left">
          {[...realVocabulary, ...realVocabulary, ...realVocabulary].map((item, idx) => (
            <div key={idx} className="marquee-item">
              <span className="marquee-kanji">{item.kanji}</span>
              <div className="marquee-meta">
                <span className="marquee-reading">{item.reading}</span>
                <span className="marquee-meaning">{item.meaning}</span>
              </div>
              <span className="marquee-tag">{item.tag}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
