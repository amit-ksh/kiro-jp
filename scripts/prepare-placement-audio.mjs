import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { ConvexHttpClient } from "convex/browser";

const source = [".env", ".env.local", "starter-japanese/.env"].find(file => fs.existsSync(file));
if (!source) throw new Error("Private configuration is missing.");
process.loadEnvFile(source);
const env = process.env;
if (env.GEMINI_ALLOW_PAID !== "true") throw new Error("Gemini spending is disabled.");
const client = new ConvexHttpClient(env.CONVEX_CLOUD_URL, { logger: false });
client.setAdminAuth(env.CONVEX_DEPLOY_KEY);
const model = "gemini-3.8-flash-lite-tts";
const base = `https://gateway.ai.cloudflare.com/v1/${env.CLOUDFLARE_ACCOUNT_ID}/${env.CLOUDFLARE_GATEWAY_ID}/google-ai-studio/v1beta/models/`;
const clips = [
  { id: "placement-water", text: "みずをください。", meaning: "Water, please." },
  { id: "placement-right", text: "みぎ", meaning: "Right." },
  { id: "placement-desire", text: "おちゃをのみたいです。", meaning: "I want to drink tea." },
];
const directory = "packages/content/assets/placement";
fs.mkdirSync(directory, { recursive: true });
const records = [];
function inspectWav(bytes) {
  if (bytes.toString("ascii", 0, 4) !== "RIFF" || bytes.toString("ascii", 8, 12) !== "WAVE") throw new Error("The returned audio is not WAV; do not add another header.");
  let byteRate = 0, dataLength = 0, sampleRate = 0;
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const kind = bytes.toString("ascii", offset, offset + 4), size = bytes.readUInt32LE(offset + 4);
    if (offset + 8 + size > bytes.length) throw new Error("Truncated WAV.");
    if (kind === "fmt ") { sampleRate = bytes.readUInt32LE(offset + 12); byteRate = bytes.readUInt32LE(offset + 16); }
    if (kind === "data") dataLength = size;
    offset += 8 + size + (size % 2);
  }
  const seconds = dataLength / byteRate;
  if (!Number.isFinite(seconds) || seconds < 0.2 || seconds > 20) throw new Error("Invalid placement audio duration.");
  return { seconds, sampleRate };
}
for (const clip of clips) {
  const target = path.join(directory, `${clip.id}.wav`), recordFile = path.join(directory, `${clip.id}.json`);
  if (fs.existsSync(target) && fs.existsSync(recordFile)) {
    const bytes = fs.readFileSync(target), record = JSON.parse(fs.readFileSync(recordFile));
    if (createHash("sha256").update(bytes).digest("hex") !== record.sha256) throw new Error(`${clip.id}: cached asset hash changed; inspect before publishing.`);
    inspectWav(bytes); records.push(record); continue;
  }
  const operationId = `placement-audio-v1-${clip.id}`;
  // Reserve the model's entire published token limits, rather than relying on
  // a TTS-specific maxOutputTokens assumption. Confirmed usage releases excess.
  const reservation = await client.mutation("aiBudget:reserve", { operationId, model, inputTokenBound: 8192, outputTokenBound: 16384 });
  if (!reservation.start) throw new Error(`${clip.id}: operation already dispatched; inspect its result before retrying.`);
  const response = await fetch(`${base}${model}:generateContent`, {
    method: "POST", signal: AbortSignal.timeout(45000),
    headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY, "cf-aig-authorization": `Bearer ${env.CLOUDFLARE_GATEWAY_TOKEN}`, "cf-aig-max-attempts": "1", "cf-aig-no-wholesale": "true" },
    body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: clip.text, speech_metadata: { style: "Clear, neutral Japanese for a beginning learner." } }] }], generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { voice: "Kore" } } } }),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(`${clip.id}: Gateway generation failed (${response.status}). Reservation retained; no automatic retry.`);
  const usage = body.usageMetadata;
  if (Number.isSafeInteger(usage?.promptTokenCount) && Number.isSafeInteger(usage?.candidatesTokenCount)) await client.mutation("aiBudget:settle", { operationId, inputTokens: usage.promptTokenCount, outputTokens: usage.candidatesTokenCount + (usage.thoughtsTokenCount ?? 0) });
  const part = body.candidates?.[0]?.content?.parts?.find(part => part.inlineData)?.inlineData;
  if (!part?.data || part.mimeType !== "audio/wav") throw new Error(`${clip.id}: unexpected audio format. No asset published.`);
  const bytes = Buffer.from(part.data, "base64");
  const format = inspectWav(bytes);
  const record = { ...clip, model, voice: "Kore", routedThrough: "Cloudflare AI Gateway", operationId, mime: part.mimeType, ...format, sha256: createHash("sha256").update(bytes).digest("hex"), createdAt: new Date().toISOString(), languageCheck: "pending", source: "https://ai.google.dev/gemini-api/docs/generate-content/speech-generation" };
  fs.writeFileSync(target, bytes); fs.writeFileSync(recordFile, JSON.stringify(record, null, 2) + "\n"); records.push(record);
  console.log(JSON.stringify({ id: clip.id, status: response.status, seconds: format.seconds, bytes: bytes.length, usageRecorded: Boolean(usage) }));
}
console.log(JSON.stringify({ assetsPrepared: records.length, budget: await client.query("aiBudget:status", {}) }));
