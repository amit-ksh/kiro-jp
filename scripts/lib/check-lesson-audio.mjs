import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
export async function checkLessonAudio({ client, env, directory, clips }) {
  const records = clips.map((clip) =>
    JSON.parse(
      fs.readFileSync(path.join(directory, `${clip.id}.json`), "utf8"),
    ),
  );
  if (
    records.every(
      (record) =>
        record.languageCheck?.matches === true &&
        record.languageCheck.audioHash === record.sha256,
    )
  )
    return records.map((record) => ({
      id: record.id,
      status: "transcript-consistent",
    }));
  const hash = createHash("sha256")
      .update(
        JSON.stringify(records.map((record) => [record.id, record.sha256])),
      )
      .digest("hex"),
    operationId = `lesson-audio-check-${hash}`,
    model = "gemini-3.8-flash";
  const reservation = await client.mutation("aiBudget:reserve", {
    operationId,
    model,
    inputTokenBound: 1048576,
    outputTokenBound: 65536,
  });
  if (!reservation.start)
    throw new Error("CHECK_ALREADY_DISPATCHED_INSPECT_EVIDENCE");
  const parts = [
    {
      text: "Listen to each numbered Japanese audio clip. Transcribe only what is actually audible in hiragana. Do not invent missing syllables or expand a single sound into a word. Return a JSON array of {id,kana}; one object per clip. No explanations.",
    },
  ];
  for (const clip of clips)
    parts.push(
      { text: clip.id },
      {
        inlineData: {
          mimeType: "audio/wav",
          data: fs
            .readFileSync(path.join(directory, `${clip.id}.wav`))
            .toString("base64"),
        },
      },
    );
  const response = await fetch(
    `https://gateway.ai.cloudflare.com/v1/${env.CLOUDFLARE_ACCOUNT_ID}/${env.CLOUDFLARE_GATEWAY_ID}/google-ai-studio/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      signal: AbortSignal.timeout(45000),
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": env.GEMINI_API_KEY,
        "cf-aig-authorization": `Bearer ${env.CLOUDFLARE_GATEWAY_TOKEN}`,
        "cf-aig-max-attempts": "1",
        "cf-aig-no-wholesale": "true",
        "cf-aig-collect-log-payload": "false",
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: {
          responseMimeType: "application/json",
          maxOutputTokens: 2048,
        },
      }),
    },
  );
  if (!response.ok)
    throw new Error("AUDIO_CHECK_UNAVAILABLE_RESERVATION_RETAINED");
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
  const text =
    body.candidates?.[0]?.content?.parts
      ?.filter((part) => !part.thought)
      .map((part) => part.text ?? "")
      .join("") ?? "";
  const invalid = (answer, reason) => {
    // These are app-authored public teaching clips. Retain schema diagnostics,
    // never request headers, credentials or an unbounded provider response.
    fs.writeFileSync(
      path.join(directory, ".audio-check-failure.json"),
      JSON.stringify(
        {
          code: "INVALID_AUDIO_CHECK_RESPONSE",
          operationId,
          model,
          responseReceived: true,
          finishReason:
            typeof body.candidates?.[0]?.finishReason === "string"
              ? body.candidates[0].finishReason.slice(0, 80)
              : "unknown",
          reason,
          expectedRows: clips.length,
          receivedRows: Array.isArray(answer) ? answer.length : null,
          rows: Array.isArray(answer)
            ? answer.slice(0, 40).map((row) => ({
                id: typeof row?.id === "string" ? row.id.slice(0, 80) : null,
                kana:
                  typeof row?.kana === "string" ? row.kana.slice(0, 240) : null,
              }))
            : [],
        },
        null,
        2,
      ) + "\n",
    );
    throw new Error("INVALID_AUDIO_CHECK_RESPONSE");
  };
  let answer;
  try {
    answer = JSON.parse(text);
  } catch {
    invalid(null, "invalid-json");
  }
  if (
    !Array.isArray(answer) ||
    answer.length !== clips.length ||
    new Set(answer.map((row) => row?.id)).size !== clips.length ||
    answer.some(
      (row) =>
        !row ||
        !clips.some((clip) => clip.id === row.id) ||
        typeof row.kana !== "string" ||
        row.kana.length > 240 ||
        !/^[-ーぁ-ゖ\s。、！？!?]*$/u.test(row.kana),
    )
  )
    invalid(answer, "invalid-rows");
  const normalize = (text) =>
    text.normalize("NFKC").replace(/[\s。、！？!?]/gu, "");
  const results = [];
  for (const record of records) {
    const kana = answer.find((row) => row.id === record.id).kana,
      matches = normalize(kana) === normalize(record.text);
    record.languageCheck = {
      kind: "AI transcript consistency, not native-speaker review",
      model,
      operationId,
      checkedAt: new Date().toISOString(),
      audioHash: record.sha256,
      kana,
      matches,
    };
    fs.writeFileSync(
      path.join(directory, `${record.id}.json`),
      JSON.stringify(record, null, 2) + "\n",
    );
    results.push({
      id: record.id,
      status: matches ? "transcript-consistent" : "needs-audio-review",
    });
  }
  return results;
}
