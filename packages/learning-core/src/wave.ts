// Bound and inspect prepared PCM speech without decoding or playing it.
export function inspectModelWave(bytes: Uint8Array) {
  if (bytes.length < 44 || bytes.length > 2 * 1024 * 1024)
    throw new Error("INVALID_MODEL_AUDIO");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = (at: number) =>
    String.fromCharCode(...bytes.subarray(at, at + 4));
  if (
    tag(0) !== "RIFF" ||
    tag(8) !== "WAVE" ||
    view.getUint32(4, true) + 8 !== bytes.length
  )
    throw new Error("INVALID_MODEL_AUDIO");
  let offset = 12,
    sampleRate = 0,
    byteRate = 0,
    dataLength = 0,
    formats = 0;
  while (offset < bytes.length) {
    if (offset + 8 > bytes.length) throw new Error("INVALID_MODEL_AUDIO");
    const size = view.getUint32(offset + 4, true),
      end = offset + 8 + size;
    if (end + (size % 2) > bytes.length) throw new Error("INVALID_MODEL_AUDIO");
    if (tag(offset) === "fmt ") {
      if (++formats > 1 || size < 16) throw new Error("INVALID_MODEL_AUDIO");
      const codec = view.getUint16(offset + 8, true),
        channels = view.getUint16(offset + 10, true),
        bits = view.getUint16(offset + 22, true),
        alignment = view.getUint16(offset + 20, true);
      sampleRate = view.getUint32(offset + 12, true);
      byteRate = view.getUint32(offset + 16, true);
      if (
        codec !== 1 ||
        channels < 1 ||
        channels > 2 ||
        bits !== 16 ||
        alignment !== channels * 2 ||
        byteRate !== sampleRate * alignment ||
        sampleRate < 8000 ||
        sampleRate > 96000
      )
        throw new Error("INVALID_MODEL_AUDIO");
    }
    if (tag(offset) === "data") dataLength += size;
    offset = end + (size % 2);
  }
  const durationMillis = (dataLength / byteRate) * 1000;
  if (
    formats !== 1 ||
    !Number.isFinite(durationMillis) ||
    durationMillis < 100 ||
    durationMillis > 20000
  )
    throw new Error("INVALID_MODEL_AUDIO");
  return {
    durationMillis: Math.round(durationMillis),
    sampleRate,
    bytes: bytes.length,
  };
}
