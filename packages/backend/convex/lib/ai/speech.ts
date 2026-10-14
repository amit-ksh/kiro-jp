"use node";
import {
  decodeSpeechResponse,
  whisperModel,
  type RecognizedSpeech,
} from "../speechContract.ts";
import { inspectRecording } from "@packages/learning-core";

export interface SpeechGatewayConfig {
  accountId: string;
  gatewayId: string;
  gatewayToken: string;
  workersToken: string;
  freeOnlyVerified: boolean;
}
export interface SpeechReceipt {
  operationId: string;
  model: string;
  status: number;
  gatewayLogId?: string;
}
export async function transcribeRecording(
  bytes: Uint8Array,
  config: SpeechGatewayConfig,
  operationId: string,
  reserve: () => Promise<boolean>,
  record: (receipt: SpeechReceipt) => void,
  transport: typeof fetch = fetch,
): Promise<RecognizedSpeech> {
  if (!config.freeOnlyVerified) throw new Error("WORKERS_FREE_PLAN_REQUIRED");
  if (
    ![config.accountId, config.gatewayId].every((id) =>
      /^[A-Za-z0-9_-]{1,128}$/.test(id),
    ) ||
    !config.gatewayToken ||
    !config.workersToken
  )
    throw new Error("SPEECH_NOT_CONFIGURED");
  if (!/^[A-Za-z0-9:._-]{1,180}$/.test(operationId))
    throw new Error("INVALID_SPEECH_OPERATION");
  const media = inspectRecording(bytes);
  if (!(await reserve())) throw new Error("SPEECH_CAPACITY_UNAVAILABLE");
  // This Workers REST route requires the Gateway header. Never retry without it.
  const response = await transport(
    `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/ai/run/${whisperModel}`,
    {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(45_000),
      headers: {
        Authorization: `Bearer ${config.workersToken}`,
        "Content-Type": "application/json",
        "cf-aig-gateway-id": config.gatewayId,
        "cf-aig-authorization": `Bearer ${config.gatewayToken}`,
        "cf-aig-max-attempts": "1",
        "cf-aig-no-wholesale": "true",
        "cf-aig-skip-cache": "true",
        "cf-aig-collect-log-payload": "false",
      },
      body: JSON.stringify({
        audio: Buffer.from(bytes).toString("base64"),
        language: "ja",
        task: "transcribe",
        vad_filter: true,
        condition_on_previous_text: false,
      }),
    },
  );
  const gatewayLogId = response.headers.get("cf-aig-log-id") ?? undefined;
  record({
    operationId,
    model: whisperModel,
    status: response.status,
    gatewayLogId,
  });
  if (!response.ok || !gatewayLogId) {
    await response.body?.cancel();
    throw new Error("SPEECH_GATEWAY_UNAVAILABLE");
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error("INVALID_TRANSCRIPT");
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.length;
      if (size > 131072) throw new Error("INVALID_TRANSCRIPT");
      chunks.push(part.value);
    }
    return decodeSpeechResponse(
      JSON.parse(Buffer.concat(chunks).toString("utf8")),
      media.durationMillis,
    );
  } finally {
    void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
