import type { AudioSource } from "expo-audio";
import { Asset } from "expo-asset";
import { Directory, File, Paths } from "expo-file-system";
import * as Crypto from "expo-crypto";
import { directionsAudio, directionsAudioChecks } from "./directions-audio";
import { favoritesAudio, favoritesAudioChecks } from "./favorites-audio";
export const lessonAudio: Record<string, AudioSource> = {
  "word-water": require("../../../../../packages/content/assets/requests-v1/word-water.wav"),
  "word-tea": require("../../../../../packages/content/assets/requests-v1/word-tea.wav"),
  "word-book": require("../../../../../packages/content/assets/requests-v1/word-book.wav"),
  "word-yen": require("../../../../../packages/content/assets/requests-v1/word-yen.wav"),
  "kana-1": require("../../../../../packages/content/assets/requests-v1/kana-1.wav"),
  "kana-2": require("../../../../../packages/content/assets/requests-v1/kana-2.wav"),
  "kana-3": require("../../../../../packages/content/assets/requests-v1/kana-3.wav"),
  "request-water": require("../../../../../packages/content/assets/requests-v1/request-water.wav"),
  "request-tea": require("../../../../../packages/content/assets/requests-v1/request-tea.wav"),
  "request-book": require("../../../../../packages/content/assets/requests-v1/request-book.wav"),
  "price-yen": require("../../../../../packages/content/assets/requests-v1/price-yen.wav"),
};
const checks: Record<
  string,
  { sha256: string; languageCheck: { matches: boolean; audioHash: string } }
> = {
  "word-water": require("../../../../../packages/content/assets/requests-v1/word-water.json"),
  "word-tea": require("../../../../../packages/content/assets/requests-v1/word-tea.json"),
  "word-book": require("../../../../../packages/content/assets/requests-v1/word-book.json"),
  "word-yen": require("../../../../../packages/content/assets/requests-v1/word-yen.json"),
  "kana-1": require("../../../../../packages/content/assets/requests-v1/kana-1.json"),
  "kana-2": require("../../../../../packages/content/assets/requests-v1/kana-2.json"),
  "kana-3": require("../../../../../packages/content/assets/requests-v1/kana-3.json"),
  "request-water": require("../../../../../packages/content/assets/requests-v1/request-water.json"),
  "request-tea": require("../../../../../packages/content/assets/requests-v1/request-tea.json"),
  "request-book": require("../../../../../packages/content/assets/requests-v1/request-book.json"),
  "price-yen": require("../../../../../packages/content/assets/requests-v1/price-yen.json"),
};
const preparing = new Map<number, Promise<AudioSource>>();
const audioSets: Record<string,{sources:Record<string,AudioSource>;checks:typeof checks}> = {
  "requests:1":{sources:lessonAudio,checks},
  "directions:1":{sources:directionsAudio,checks:directionsAudioChecks},
  "favorites:1":{sources:favoritesAudio,checks:favoritesAudioChecks},
};
export function preparedLessonAudio(id: string, version: number): Record<string, AudioSource> {
  // Never substitute another lesson/version when a clip has not been prepared.
  return audioSets[`${id}:${version}`]?.sources ?? {};
}
export async function cachePreparedModelAudio(id: string, uri: string, lessonId="requests", version=1) {
  const record = audioSets[`${lessonId}:${version}`]?.checks[id];
  if (
    !record?.languageCheck.matches ||
    record.languageCheck.audioHash !== record.sha256
  )
    throw new Error("Unchecked model audio.");
  const source = new File(uri),
    hash = Array.from(
      new Uint8Array(
        await Crypto.digest(
          Crypto.CryptoDigestAlgorithm.SHA256,
          await source.bytes(),
        ),
      ),
    )
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  if (hash !== record.sha256)
    throw new Error("Prepared model audio checksum changed.");
  const directory = new Directory(Paths.document, "model-audio");
  directory.create({ intermediates: true, idempotent: true });
  const target = new File(directory, `${record.sha256}.wav`);
  if (target.exists) {
    const previous = Array.from(
      new Uint8Array(
        await Crypto.digest(
          Crypto.CryptoDigestAlgorithm.SHA256,
          await target.bytes(),
        ),
      ),
    )
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    if (previous === record.sha256) return;
    target.delete();
  }
  const staged = new File(
    directory,
    `${record.sha256}-${Crypto.randomUUID()}.part`,
  );
  let moved = false;
  try {
    source.copy(staged);
    staged.move(target);
    moved = true;
  } finally {
    if (!moved && staged.exists) staged.delete();
  }
}
export async function persistentAudioSource(
  source: AudioSource,
): Promise<AudioSource> {
  if (typeof source !== "number") return source;
  const previous = preparing.get(source);
  if (previous) return previous;
  const work = (async () => {
    const set = Object.values(audioSets).find(set=>Object.values(set.sources).includes(source));
    const id = set ? Object.keys(set.sources).find(id=>set.sources[id]===source) : undefined;
    const record = id ? set?.checks[id] : undefined;
    if (
      !record?.languageCheck.matches ||
      record.languageCheck.audioHash !== record.sha256
    )
      throw new Error("Unchecked model audio.");
    const directory = new Directory(Paths.document, "model-audio");
    directory.create({ intermediates: true, idempotent: true });
    const target = new File(directory, `${record.sha256}.wav`);
    const verify = async (file: File) => {
      const digest = await Crypto.digest(
        Crypto.CryptoDigestAlgorithm.SHA256,
        await file.bytes(),
      );
      const hash = Array.from(new Uint8Array(digest))
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
      if (hash !== record.sha256) throw new Error("Model audio hash mismatch.");
    };
    if (target.exists) {
      await verify(target);
      return { uri: target.uri };
    }
    const asset = await Asset.fromModule(source).downloadAsync();
    if (!asset.localUri) throw new Error("Audio download unavailable.");
    const downloaded = new File(asset.localUri);
    await verify(downloaded);
    downloaded.copy(target);
    return { uri: target.uri };
  })();
  preparing.set(source, work);
  try {
    return await work;
  } catch (error) {
    preparing.delete(source);
    throw error;
  }
}
