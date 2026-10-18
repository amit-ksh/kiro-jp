export interface DictionaryEntry {
  key: string;
  kind: "radical" | "kanji" | "vocabulary";
  characters: string;
  meanings: readonly string[];
  readings: readonly string[];
  on: readonly string[];
  kun: readonly string[];
  components: readonly string[];
  radicalNumber: number;
  strokeCount: number;
  sourceIds: readonly string[];
  sourceEntryIds: readonly string[];
  relatedKeys: readonly string[];
  lessonIds: readonly string[];
}
export interface DictionaryCatalog {
  release: string;
  sources: readonly {
    id: string;
    url: string;
    licence: string;
    sha256: string;
    date: string;
  }[];
  entries: readonly DictionaryEntry[];
}
