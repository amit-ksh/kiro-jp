"use node";
import { createHash } from "node:crypto";
import { inspectModelWave, normalizeJapanese } from "@packages/learning-core";
export const readbackVersion = "kore-v1";
const failureCodes = new Set([
  "KANA_SCRIPT_REQUIRED",
  "READBACK_NOT_CONFIGURED",
  "READBACK_CAPACITY_UNAVAILABLE",
  "READBACK_GATEWAY_UNAVAILABLE",
  "INVALID_READBACK_RESPONSE",
  "INVALID_MODEL_AUDIO",
  "INVALID_READBACK_CHECK_RESPONSE",
  "READBACK_TRANSCRIPT_MISMATCH",
]);
// Persist only an exact internal code. Provider exceptions may contain private
// request text or credentials and must never be copied into diagnostic traces.
export function readbackFailureCode(error: unknown): string {
  return error instanceof Error && failureCodes.has(error.message)
    ? error.message
    : "READBACK_UNEXPECTED_FAILURE";
}
export type ReadbackModel = "gemini-3.8-flash-lite-tts" | "gemini-3.8-flash";
export interface ReadbackReceipt {
  operationId: string;
  model: string;
  status: number;
  gatewayLogId?: string;
}
export interface ReadbackControl {
  reserve: (
    operationId: string,
    model: ReadbackModel,
    inputTokenBound: number,
    outputTokenBound: number,
  ) => Promise<boolean>;
  settle: (
    operationId: string,
    inputTokens: number,
    outputTokens: number,
  ) => Promise<void>;
  record: (receipt: ReadbackReceipt) => void;
}
interface Envelope {
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    thoughtsTokenCount?: number;
  };
  candidates?: {
    content?: {
      parts?: {
        thought?: boolean;
        text?: string;
        inlineData?: { mimeType?: string; data?: string };
      }[];
    };
  }[];
}
export async function prepareReadback(
  reading: string,
  config: {
    accountId: string;
    gatewayId: string;
    gatewayToken: string;
    geminiKey: string;
  },
  prefix: string,
  control: ReadbackControl,
  transport: typeof fetch = fetch,
) {
  if (
    !/^[ぁ-ゖァ-ヶー\s。、！？!?・「」『』（）()]+$/u.test(reading) ||
    reading.length > 160 ||
    !/[ぁ-ゖァ-ヶ]/u.test(reading)
  )
    throw new Error("KANA_SCRIPT_REQUIRED");
  if (
    ![config.accountId, config.gatewayId].every((id) =>
      /^[A-Za-z0-9_-]{1,128}$/.test(id),
    ) ||
    !config.gatewayToken ||
    !config.geminiKey ||
    !/^[A-Za-z0-9:._-]{1,120}$/.test(prefix)
  )
    throw new Error("READBACK_NOT_CONFIGURED");
  async function dispatch(
    kind: "synthesize" | "check",
    model: ReadbackModel,
    body: unknown,
    responseBound: number,
  ) {
    const operationId = `${prefix}.${kind}`;
    if (
      !(await control.reserve(
        operationId,
        model,
        kind === "synthesize" ? 8192 : 1048576,
        kind === "synthesize" ? 16384 : 65536,
      ))
    )
      throw new Error("READBACK_CAPACITY_UNAVAILABLE");
    const response = await transport(
      `https://gateway.ai.cloudflare.com/v1/${config.accountId}/${config.gatewayId}/google-ai-studio/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        redirect: "error",
        signal: AbortSignal.timeout(45_000),
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": config.geminiKey,
          "cf-aig-authorization": `Bearer ${config.gatewayToken}`,
          "cf-aig-max-attempts": "1",
          "cf-aig-no-wholesale": "true",
          "cf-aig-skip-cache": "true",
          "cf-aig-collect-log-payload": "false",
        },
        body: JSON.stringify(body),
      },
    );
    const gatewayLogId = response.headers.get("cf-aig-log-id") ?? undefined;
    control.record({
      operationId,
      model,
      status: response.status,
      gatewayLogId,
    });
    if (!response.ok || !gatewayLogId) {
      await response.body?.cancel();
      throw new Error("READBACK_GATEWAY_UNAVAILABLE");
    }
    const reader = response.body?.getReader();
    if (!reader) throw new Error("INVALID_READBACK_RESPONSE");
    let size = 0;
    const chunks: Uint8Array[] = [];
    let result: Envelope;
    try {
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        size += part.value.length;
        if (size > responseBound) throw new Error("INVALID_READBACK_RESPONSE");
        chunks.push(part.value);
      }
      result = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } finally {
      void reader.cancel().catch(() => {});
      reader.releaseLock();
    }
    const usage = result.usageMetadata;
    if (
      Number.isSafeInteger(usage?.promptTokenCount) &&
      Number.isSafeInteger(usage?.candidatesTokenCount) &&
      Number.isSafeInteger(usage?.thoughtsTokenCount ?? 0)
    )
      await control.settle(
        operationId,
        usage!.promptTokenCount!,
        usage!.candidatesTokenCount! + (usage!.thoughtsTokenCount ?? 0),
      );
    return result;
  }
  const generated = await dispatch(
    "synthesize",
    "gemini-3.8-flash-lite-tts",
    {
      contents: [
        {
          role: "user",
          parts: [
            {
              text: reading,
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
    },
    3 * 1024 * 1024,
  );
  const audio = generated.candidates?.[0]?.content?.parts?.find(
    (part) => part.inlineData,
  )?.inlineData;
  if (
    audio?.mimeType !== "audio/wav" ||
    !audio.data ||
    audio.data.length > 2800000 ||
    !/^[A-Za-z0-9+/]*={0,2}$/u.test(audio.data)
  )
    throw new Error("INVALID_MODEL_AUDIO");
  const bytes = Buffer.from(audio.data, "base64"),
    media = inspectModelWave(bytes);
  const checked = await dispatch(
    "check",
    "gemini-3.8-flash",
    {
      contents: [
        {
          role: "user",
          parts: [
            {
              text: 'Listen to this Japanese audio. Transcribe only what is actually audible in hiragana. Do not invent missing sounds. Return only JSON {"kana":"..."}. No explanations.',
            },
            { inlineData: { mimeType: "audio/wav", data: audio.data } },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        maxOutputTokens: 1024,
      },
    },
    65536,
  );
  let answer: unknown;
  try {
    answer = JSON.parse(
      checked.candidates?.[0]?.content?.parts
        ?.filter((part) => !part.thought)
        .map((part) => part.text ?? "")
        .join("") ?? "",
    );
  } catch {
    throw new Error("INVALID_READBACK_CHECK_RESPONSE");
  }
  if (
    !answer ||
    typeof answer !== "object" ||
    Array.isArray(answer) ||
    !("kana" in answer) ||
    typeof answer.kana !== "string"
  )
    throw new Error("INVALID_READBACK_CHECK_RESPONSE");
  const kana = answer.kana;
  if (
    kana.length > 240 ||
    !/^[-ーぁ-ゖ\s。、！？!?]*$/u.test(kana) ||
    normalizeJapanese(kana) !== normalizeJapanese(reading)
  )
    throw new Error("READBACK_TRANSCRIPT_MISMATCH");
  return {
    bytes,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    durationMillis: media.durationMillis,
    checkedKana: kana,
  };
}
