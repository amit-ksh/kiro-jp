export interface ContentAsset {
  id: string;
  kind: "lesson" | "audio";
  mime: "application/json" | "audio/wav";
  bytes: number;
  sha256: string;
}
export interface ContentManifest {
  format: 1;
  lessonId: string;
  version: number;
  title: string;
  assets: ContentAsset[];
  sha256: string;
}
/** Storage deployments may return the same SHA-256 as hex or canonical base64. */
export function storageChecksumHex(value: string) {
  if (/^[a-f0-9]{64}$/i.test(value)) return value.toLowerCase();
  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  if (
    !/^[A-Za-z0-9+/]{43}=$/.test(value) ||
    alphabet.indexOf(value[42]!) % 4 !== 0
  )
    throw new Error("Invalid storage checksum.");
  let bits = 0,
    remaining = 0,
    result = "";
  for (const character of value.slice(0, -1)) {
    bits = (bits << 6) | alphabet.indexOf(character);
    remaining += 6;
    if (remaining >= 8) {
      remaining -= 8;
      result += ((bits >>> remaining) & 255).toString(16).padStart(2, "0");
    }
  }
  if (result.length !== 64) throw new Error("Invalid storage checksum.");
  return result;
}
export function manifestBody(manifest: ContentManifest) {
  return JSON.stringify({
    format: manifest.format,
    lessonId: manifest.lessonId,
    version: manifest.version,
    title: manifest.title,
    assets: manifest.assets.map((asset) => ({
      id: asset.id,
      kind: asset.kind,
      mime: asset.mime,
      bytes: asset.bytes,
      sha256: asset.sha256,
    })),
  });
}
export function validateContentManifest(
  value: unknown,
): asserts value is ContentManifest {
  const m = value as ContentManifest;
  if (
    !m ||
    m.format !== 1 ||
    !/^[a-z][a-z0-9-]{0,50}$/.test(m.lessonId) ||
    !Number.isInteger(m.version) ||
    m.version < 1 ||
    m.version > 100000 ||
    typeof m.title !== "string" ||
    !m.title.trim() ||
    m.title.length > 120 ||
    !/^[a-f0-9]{64}$/.test(m.sha256) ||
    !Array.isArray(m.assets) ||
    !m.assets.length ||
    m.assets.length > 100
  )
    throw new Error("Invalid content manifest.");
  const ids = new Set<string>();
  let total = 0;
  for (const a of m.assets) {
    if (
      !a ||
      !/^[a-z][a-z0-9-]{0,80}$/.test(a.id) ||
      ids.has(a.id) ||
      !["lesson", "audio"].includes(a.kind) ||
      a.mime !== (a.kind === "lesson" ? "application/json" : "audio/wav") ||
      !Number.isSafeInteger(a.bytes) ||
      a.bytes < 1 ||
      a.bytes > 2_000_000 ||
      !/^[a-f0-9]{64}$/.test(a.sha256)
    )
      throw new Error("Invalid content asset.");
    ids.add(a.id);
    total += a.bytes;
  }
  if (
    total > 20_000_000 ||
    m.assets.filter((a) => a.kind === "lesson").length !== 1 ||
    !m.assets.some((a) => a.kind === "audio")
  )
    throw new Error("Incomplete content package.");
}
export async function verifyContentManifest(
  manifest: unknown,
  digest: (text: string) => Promise<string>,
) {
  validateContentManifest(manifest);
  if ((await digest(manifestBody(manifest))) !== manifest.sha256)
    throw new Error("Content manifest checksum changed.");
  return manifest;
}
