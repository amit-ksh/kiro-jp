export const maxRecordingBytes = 2 * 1024 * 1024;
export const whisperNeuronBound = 24; // ceil(30 seconds / 60 * 46.63 neurons/minute)
export const whisperDailyRequests = 100;
export const whisperModel = "@cf/openai/whisper-large-v3-turbo";
export type SpeechSource = {
  lessonSessionId?: string;
  conversationSegmentId?: string;
  cueId: string;
};
export function validSpeechSource(source: SpeechSource) {
  return (
    Boolean(source.lessonSessionId) !== Boolean(source.conversationSegmentId) &&
    /^[A-Za-z0-9_-]{1,100}$/.test(source.cueId) &&
    [source.lessonSessionId, source.conversationSegmentId].every(
      (id) => id === undefined || /^[A-Za-z0-9_-]{8,100}$/.test(id),
    )
  );
}
// HTTP streams are bounded before storage; Content-Length is only an early hint.
export async function boundedSpeechBody(request: Request) {
  const mime = request.headers
    .get("content-type")
    ?.split(";")[0]
    ?.trim()
    .toLowerCase();
  if (mime !== "audio/mp4" && mime !== "audio/x-m4a")
    throw new Error("UNSUPPORTED_AUDIO");
  const length = request.headers.get("content-length");
  if (length && (!/^\d+$/.test(length) || Number(length) > maxRecordingBytes))
    throw new Error("AUDIO_TOO_LARGE");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("EMPTY_AUDIO");
  const chunks: Uint8Array[] = [];
  let size = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("UPLOAD_TIMEOUT")), 25_000);
  });
  try {
    while (true) {
      const chunk = await Promise.race([reader.read(), deadline]);
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > maxRecordingBytes) throw new Error("AUDIO_TOO_LARGE");
      chunks.push(chunk.value);
    }
    if (!size || (length && Number(length) !== size))
      throw new Error("INVALID_AUDIO_LENGTH");
    const result = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    return result;
  } finally {
    clearTimeout(timer);
    void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
export interface RecognizedSpeech {
  text: string;
  segments: { text: string; start: number; end: number }[];
}
export function decodeSpeechResponse(
  raw: unknown,
  durationMillis: number,
): RecognizedSpeech {
  const body = raw as {
    success?: unknown;
    result?: { text?: unknown; segments?: unknown };
  };
  if (
    body?.success !== true ||
    !body.result ||
    typeof body.result.text !== "string" ||
    body.result.text.length > 1000
  )
    throw new Error("INVALID_TRANSCRIPT");
  const text = body.result.text.trim();
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(text))
    throw new Error("INVALID_TRANSCRIPT");
  const segments: RecognizedSpeech["segments"] = [];
  if (body.result.segments !== undefined) {
    if (
      !Array.isArray(body.result.segments) ||
      body.result.segments.length > 100
    )
      throw new Error("INVALID_TRANSCRIPT");
    for (const entry of body.result.segments) {
      if (
        !entry ||
        typeof entry.text !== "string" ||
        entry.text.length > 1000 ||
        !Number.isFinite(entry.start) ||
        !Number.isFinite(entry.end) ||
        entry.start < 0 ||
        entry.end < entry.start ||
        entry.end > durationMillis / 1000 + 2
      )
        throw new Error("INVALID_TRANSCRIPT");
      segments.push({
        text: entry.text.trim(),
        start: entry.start,
        end: entry.end,
      });
    }
  }
  return { text, segments };
}
