export { requestsLesson } from "./requests.ts";
export { directionsLesson } from "./directions.ts";
export { favoritesLesson } from "./favorites.ts";
export { availabilityLesson } from "./availability.ts";
export { desireLesson } from "./desire.ts";
export { abilityLesson } from "./ability.ts";
export { tryLesson } from "./try.ts";
import { curriculum } from "./curriculum.ts";
import { lessonEntry, type LearningBand } from "@packages/learning-core";
export { checkedContentManifests } from "./content-manifests.ts";
export { grammarReferences } from "./grammar-reference.ts";
export { curriculum, preparedLessons } from "./curriculum.ts";
export const interests = ["Shrines", "Manga", "Anime", "Food", "Travel", "Music", "Japanese places"] as const;
export const lessonCatalog = [
  { id: "requests", title: "A polite request", band: "early-n5", kanji: ["水", "茶", "本", "円"], pattern: "[item] + をください", outcome: "Request something politely", themes: ["Food", "Manga", "Travel"], prerequisite: undefined },
  { id: "directions", title: "Find your way", band: "early-n5", kanji: ["入", "出", "右", "左"], pattern: "〜はどこですか", outcome: "Ask where something is and understand a simple direction", themes: ["Shrines", "Travel", "Japanese places"], prerequisite: undefined },
  { id: "favorites", title: "Talk about what you like", band: "early-n5", kanji: ["日", "本", "音", "楽"], pattern: "〜が好きです", outcome: "Say what you like, ask about a favorite and respond", themes: ["Anime", "Manga", "Music"], prerequisite: undefined },
  { id: "availability", title: "Ask what is available", band: "early-n5", kanji: ["店", "本", "新", "古"], pattern: "〜はありますか", outcome: "Ask whether a shop has something", themes: ["Manga", "Food", "Travel"], prerequisite: "requests" },
  { id: "desire", title: "Say what you want to do", band: "early-n5", kanji: ["行", "見", "食", "飲"], pattern: "〜たいです", outcome: "Say what you would like to do", themes: ["Travel", "Anime", "Food"], prerequisite: "favorites" },
  { id: "ability", title: "Say what you can do", band: "early-n4", kanji: ["読", "書", "話", "聞"], pattern: "〜ことができます", outcome: "Discuss an ability in a simple conversation", themes: ["Manga", "Music", "Japanese places"], prerequisite: "desire" },
  { id: "try", title: "Try something new", band: "early-n4", kanji: ["買", "作", "食", "見"], pattern: "〜てみます", outcome: "Say what you would like to try", themes: ["Food", "Travel", "Anime"], prerequisite: "ability" },
] as const;
export function recommendFirstLesson(chosenInterests: readonly string[], band: LearningBand = "foundations") {
  const eligible = lessonCatalog.filter(item => {
    const lesson = curriculum.get(item.id);
    return lesson && lessonEntry(lesson,band).allowed && (!item.prerequisite || Boolean(lesson.entry));
  });
  const matchingBand = band === "early-n4" ? eligible.filter(item => item.band === "early-n4") : [];
  const pool = matchingBand.length ? matchingBand : eligible;
  return pool.find(lesson => lesson.themes.some(theme => chosenInterests.includes(theme))) ?? pool[0] ?? lessonCatalog[0];
}
export const placementBank = [
  { id: "kana-a", bankVersion: 1, domain: "kana", phase: "starter", prompt: "Which sound does this hiragana make?", japanese: "あ", options: ["a", "i", "u", "e"], correctIndex: 0, explanation: "あ makes the sound a." },
  { id: "kana-ka", bankVersion: 1, domain: "kana", phase: "starter", prompt: "Which sound does this katakana make?", japanese: "カ", options: ["sa", "ka", "ta", "na"], correctIndex: 1, explanation: "カ makes the sound ka." },
  { id: "vocab-water", bankVersion: 1, domain: "vocabulary", phase: "starter", prompt: "What does this word mean?", japanese: "水", options: ["Book", "Water", "Tea", "Shop"], correctIndex: 1, explanation: "水 means water. This word is read みず (mizu)." },
  { id: "vocab-book", bankVersion: 1, domain: "vocabulary", phase: "starter", prompt: "What does this word mean?", japanese: "本", options: ["Book", "Entrance", "Right", "Music"], correctIndex: 0, explanation: "本 means book. This word is read ほん (hon)." },
  { id: "grammar-request", bankVersion: 1, domain: "grammar", phase: "starter", prompt: "Which sentence politely asks for water?", options: ["水が好きです。", "水をください。", "水はどこですか。"], correctIndex: 1, explanation: "水をください means Water, please." },
  { id: "grammar-location", bankVersion: 1, domain: "grammar", phase: "starter", prompt: "What is the person asking?", japanese: "入口はどこですか。", options: ["Is this the entrance?", "Where is the entrance?", "I like the entrance."], correctIndex: 1, explanation: "〜はどこですか asks Where is ...?" },
  { id: "listen-water", bankVersion: 1, domain: "listening", phase: "starter", prompt: "Listen. What does the speaker request?", options: ["Water", "A book", "Tea"], correctIndex: 0, explanation: "The speaker asks 水をください (Water, please).", audioId: "placement-water" },
  { id: "listen-right", bankVersion: 1, domain: "listening", phase: "starter", prompt: "Listen. Which direction do you hear?", options: ["Left", "Right", "Straight ahead"], correctIndex: 1, explanation: "右 (みぎ, migi) means right.", audioId: "placement-right" },
  { id: "follow-kana", bankVersion: 1, domain: "kana", phase: "followup", prompt: "Which reading matches this word?", japanese: "りょこう", options: ["ryokou", "rikou", "ryouko"], correctIndex: 0, explanation: "りょこう is read ryokou." },
  { id: "follow-vocab", bankVersion: 1, domain: "vocabulary", phase: "followup", prompt: "What does this word mean?", japanese: "駅", options: ["Hospital", "Station", "Library"], correctIndex: 1, explanation: "駅 (えき, eki) means station." },
  { id: "follow-grammar", bankVersion: 1, domain: "grammar", phase: "followup", prompt: "What can this person do?", japanese: "日本語を読むことができます。", options: ["They can read Japanese.", "They want to read Japanese.", "They tried reading Japanese."], correctIndex: 0, explanation: "〜ことができます expresses ability." },
  { id: "follow-listen", bankVersion: 1, domain: "listening", phase: "followup", prompt: "Listen. What does the speaker want to do?", options: ["Read a book", "Drink tea", "Visit a shrine"], correctIndex: 1, explanation: "お茶を飲みたいです means I want to drink tea.", audioId: "placement-desire" },
] as const;
