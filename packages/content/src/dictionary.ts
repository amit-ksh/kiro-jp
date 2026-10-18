import type { DictionaryCatalog, DictionaryEntry } from "./dictionary-types.ts";
export function assertDictionaryCatalog(catalog: DictionaryCatalog) {
  const keys = new Set(catalog.entries.map((entry) => entry.key));
  if (
    keys.size !== catalog.entries.length ||
    !/^starter-[a-f\d]{16}$/u.test(catalog.release)
  )
    throw Error("Invalid dictionary catalog");
  for (const entry of catalog.entries) {
    if (
      !entry.characters ||
      !entry.meanings.length ||
      !entry.sourceIds.length ||
      !entry.sourceEntryIds.length ||
      entry.relatedKeys.some((key) => !keys.has(key))
    )
      throw Error("Invalid dictionary relationship");
    if (entry.kind === "vocabulary" && !entry.readings.length)
      throw Error("Missing word reading");
    if (
      entry.kind === "kanji" &&
      (!entry.strokeCount ||
        !entry.radicalNumber ||
        (!entry.on.length && !entry.kun.length))
    )
      throw Error("Missing kanji facts");
  }
}
export function findDictionaryEntry(
  entries: readonly DictionaryEntry[],
  kind: DictionaryEntry["kind"],
  characters: string,
  reading?: string,
) {
  return entries.find(
    (entry) =>
      entry.kind === kind &&
      entry.characters === characters &&
      (!reading || entry.readings.includes(reading)),
  );
}
