import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
const argv = process.argv.slice(2),
  version = "1.1.0";
if (argv.length === 1 && ["--version", "-v", "-V"].includes(argv[0])) {
  console.log(version);
  process.exit(0);
}
const help = () => {
  console.log(
    `bin: ${JSON.stringify(fileURLToPath(import.meta.url))}\ndescription: Prepare source-checked lesson audio through the guarded Gateway.\nflags: --lesson <id> (default requests), --generate, --check, --dry-run (default), --limit <1..100> (default all clips), --attempt <1..3> (generate retry only), --help\nexamples[3]:\n  node --experimental-strip-types scripts/prepare-lesson-audio.mjs --dry-run\n  node --experimental-strip-types scripts/prepare-lesson-audio.mjs --lesson directions --generate\n  node --experimental-strip-types scripts/prepare-lesson-audio.mjs --lesson directions --check`,
  );
};
let generate = false,
  check = false,
  limit = 100,
  lessonId = "requests",
  attempt = 1;
const used = new Set();
if (argv.includes("--help")) { help(); process.exit(0); }
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "--help") {
    help();
    process.exit(0);
  }
  if (used.has(argv[i])) { console.log('error: "Duplicate option; pass each flag once."'); process.exit(2); }
  used.add(argv[i]);
  if (argv[i] === "--generate") generate = true;
  else if (argv[i] === "--check") check = true;
  else if (argv[i] === "--dry-run") generate = false;
  else if (argv[i] === "--lesson" && /^[a-z][a-z0-9-]{0,79}$/u.test(argv[i + 1] ?? "")) lessonId = argv[++i];
  else if (argv[i] === "--attempt" && /^[1-3]$/u.test(argv[i + 1] ?? "")) attempt = Number(argv[++i]);
  else if (argv[i] === "--limit" && /^[1-9][0-9]*$/u.test(argv[i + 1] ?? "")) {
    limit = Number(argv[++i]);
  } else {
    console.log(
      'error: "Invalid input; use --lesson <id>, --generate, --check, --dry-run, --limit <1..100>, --attempt <1..3>, or --help."',
    );
    process.exit(2);
  }
}
if (limit < 1 || limit > 100) {
  console.log('error: "--limit must be between 1 and 100."');
  process.exit(2);
}
if (used.has("--attempt") && !generate) { console.log('error: "--attempt is only for an explicit --generate retry; completed clips are retained."'); process.exit(2); }
if (
  argv.filter((arg) => ["--generate", "--check", "--dry-run"].includes(arg))
    .length > 1
) {
  console.log(
    'error: "Use exactly one mode: --generate, --check, or --dry-run."',
  );
  process.exit(2);
}
const rows = [];
try {
  const { authoringCurriculum, authoringLessons } = await import("../packages/content/src/authoring.ts");
  const lesson = authoringCurriculum.get(lessonId);
  if (!lesson) { console.log('error: "Unknown authoring lesson."\nhelp: '+JSON.stringify('Use --lesson with '+authoringLessons.map(item=>item.id).join(', ')+'.')); process.exit(2); }
  const { checkPreparedLesson } =
    await import("../packages/learning-core/src/content-check.ts");
  const { inspectWav } = await import("./lib/wav.mjs");
  if (checkPreparedLesson(lesson).length)
    throw new Error("CONTENT_NOT_CHECKED");
  const sentences = [
    ...new Map(
      [
        ...lesson.words.map((word) => word.example),
        ...lesson.grammar.examples,
      ].map((sentence) => [sentence.id, sentence]),
    ).values(),
  ];
  const clips = [
    ...lesson.words.map((word) => ({
      id: `word-${word.id}`,
      kind: "word",
      text: word.reading,
      display: word.word,
      meaning: word.vocabulary?.meaning ?? word.meaning,
    })),
    ...lesson.kana.map((kana, i) => ({
      id: `kana-${i + 1}`,
      kind: "kana",
      text: kana.character,
      display: kana.character,
      meaning: kana.sound,
    })),
    ...sentences.map((sentence) => ({
      id: sentence.id,
      kind: "sentence",
      text: sentence.reading + "。",
      display: sentence.text,
      meaning: sentence.meaning,
    })),
  ].slice(0, limit);
  const directory = `packages/content/assets/${lesson.id}-v${lesson.version}`;
  let client,
    env = process.env;
  const model = "gemini-3.8-flash-lite-tts";
  if (generate || check) {
    const source = [".env", ".env.local", "starter-japanese/.env"].find(
      (file) => fs.existsSync(file),
    );
    if (!source) throw new Error("CONFIGURATION_MISSING");
    process.loadEnvFile(source);
    if (
      env.GEMINI_ALLOW_PAID !== "true" ||
      ![
        "CONVEX_CLOUD_URL",
        "CONVEX_DEPLOY_KEY",
        "GEMINI_API_KEY",
        "CLOUDFLARE_ACCOUNT_ID",
        "CLOUDFLARE_GATEWAY_ID",
        "CLOUDFLARE_GATEWAY_TOKEN",
      ].every((key) => env[key])
    )
      throw new Error("GENERATION_CONFIGURATION_MISSING");
    const { ConvexHttpClient } = await import("convex/browser");
    client = new ConvexHttpClient(env.CONVEX_CLOUD_URL, { logger: false });
    client.setAdminAuth(env.CONVEX_DEPLOY_KEY);
    fs.mkdirSync(directory, { recursive: true });
  }
  for (const clip of clips) {
    const target = path.join(directory, `${clip.id}.wav`),
      recordFile = path.join(directory, `${clip.id}.json`);
    const fingerprint = createHash("sha256")
      .update(JSON.stringify([lesson.id, lesson.version, clip, model, "Kore"]))
      .digest("hex");
    if (fs.existsSync(target) && fs.existsSync(recordFile)) {
      const record = JSON.parse(fs.readFileSync(recordFile, "utf8")),
        bytes = fs.readFileSync(target);
      if (
        record.scriptHash !== fingerprint ||
        createHash("sha256").update(bytes).digest("hex") !== record.sha256
      )
        throw new Error("CACHED_AUDIO_CHANGED");
      inspectWav(bytes);
      rows.push({
        id: clip.id,
        kind: clip.kind,
        status: "cached-awaiting-audio-check",
      });
      continue;
    }
    if (check) throw new Error("GENERATE_MISSING_AUDIO_BEFORE_CHECK");
    if (!generate) {
      rows.push({ id: clip.id, kind: clip.kind, status: "needs-generation" });
      continue;
    }
    const originalOperationId = `lesson-audio-${lesson.id}-v${lesson.version}-${clip.id}-${fingerprint.slice(0, 12)}`;
    const operationId = attempt === 1 ? originalOperationId : `${originalOperationId}-attempt-${attempt}`;
    const reservation = await client.mutation("aiBudget:reserve", {
      operationId,
      model,
      inputTokenBound: 8192,
      outputTokenBound: 16384,
    });
    if (!reservation.start)
      throw new Error("ALREADY_DISPATCHED_INSPECT_RESERVATION");
    const base = `https://gateway.ai.cloudflare.com/v1/${env.CLOUDFLARE_ACCOUNT_ID}/${env.CLOUDFLARE_GATEWAY_ID}/google-ai-studio/v1beta/models/`;
    const response = await fetch(`${base}${model}:generateContent`, {
      method: "POST",
      signal: AbortSignal.timeout(45000),
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": env.GEMINI_API_KEY,
        "cf-aig-authorization": `Bearer ${env.CLOUDFLARE_GATEWAY_TOKEN}`,
        "cf-aig-max-attempts": "1",
        "cf-aig-no-wholesale": "true",
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: clip.text,
                speech_metadata: {
                  style: "Clear, neutral Japanese for a beginning learner.",
                },
              },
            ],
          },
        ],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: { voiceConfig: { voice: "Kore" } },
        },
      }),
    });
    if (!response.ok)
      throw new Error(`GATEWAY_AUDIO_HTTP_${response.status}_RESERVATION_RETAINED`);
    const body = await response.json(),
      usage = body.usageMetadata;
    if (
      Number.isSafeInteger(usage?.promptTokenCount) &&
      Number.isSafeInteger(usage?.candidatesTokenCount)
    )
      await client.mutation("aiBudget:settle", {
        operationId,
        inputTokens: usage.promptTokenCount,
        outputTokens:
          usage.candidatesTokenCount + (usage.thoughtsTokenCount ?? 0),
      });
    const part = body.candidates?.[0]?.content?.parts?.find(
      (part) => part.inlineData,
    )?.inlineData;
    if (!part?.data || part.mimeType !== "audio/wav")
      throw new Error("UNSUPPORTED_AUDIO_NO_ASSET_PUBLISHED");
    const bytes = Buffer.from(part.data, "base64"),
      format = inspectWav(bytes);
    const record = {
      ...clip,
      lessonId: lesson.id,
      lessonVersion: lesson.version,
      scriptHash: fingerprint,
      model,
      voice: "Kore",
      operationId,
      generationAttempt: attempt,
      ...(attempt > 1 ? { originalOperationId } : {}),
      routedThrough: "Cloudflare AI Gateway",
      mime: part.mimeType,
      ...format,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      createdAt: new Date().toISOString(),
      languageCheck: "pending",
      source:
        "https://ai.google.dev/gemini-api/docs/generate-content/speech-generation",
    };
    // Keep an interrupted asset invisible to the completed-pair cache check.
    fs.writeFileSync(target, bytes);
    fs.writeFileSync(recordFile, JSON.stringify(record, null, 2) + "\n");
    rows.push({
      id: clip.id,
      kind: clip.kind,
      status: "generated-awaiting-audio-check",
    });
    console.error(
      `${clip.id}: prepared candidate audio; language/playback checks pending.`,
    );
  }
  console.log(
    `count: ${rows.length}\nclips[${rows.length}]{id,kind,status}:\n${rows.map((row) => `  ${row.id},${row.kind},${row.status}`).join("\n")}`,
  );
  if (check) {
    const { checkLessonAudio } = await import("./lib/check-lesson-audio.mjs");
    const results = await checkLessonAudio({ client, env, directory, clips });
    console.log(
      `checks[${results.length}]{id,status}:\n${results.map((row) => `  ${row.id},${row.status}`).join("\n")}`,
    );
    if (results.some((row) => row.status !== "transcript-consistent"))
      process.exitCode = 1;
  }
} catch (error) {
  console.log(
    `error: ${JSON.stringify(/^[A-Z0-9_]+$/u.test(error.message) ? error.message : "PREPARATION_FAILED_PRIVATE_DETAILS_WITHHELD")}\nhelp: "Keep prepared candidates and reservations. After checking availability/budget, an explicit --generate --attempt 2 (maximum 3) retries only missing clips."`,
  );
  process.exitCode = 1;
}
