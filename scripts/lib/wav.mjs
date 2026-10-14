export function inspectWav(bytes) {
  if (
    bytes.length < 44 ||
    bytes.toString("ascii", 0, 4) !== "RIFF" ||
    bytes.toString("ascii", 8, 12) !== "WAVE"
  )
    throw new Error("INVALID_WAV");
  if (bytes.readUInt32LE(4) + 8 !== bytes.length)
    throw new Error("TRUNCATED_WAV");
  let byteRate = 0,
    sampleRate = 0,
    dataLength = 0;
  for (let offset = 12; offset + 8 <= bytes.length; ) {
    const kind = bytes.toString("ascii", offset, offset + 4),
      size = bytes.readUInt32LE(offset + 4);
    if (offset + 8 + size > bytes.length) throw new Error("TRUNCATED_WAV");
    if (kind === "fmt ") {
      if (size < 16) throw new Error("INVALID_WAV_FORMAT");
      sampleRate = bytes.readUInt32LE(offset + 12);
      byteRate = bytes.readUInt32LE(offset + 16);
    }
    if (kind === "data") dataLength += size;
    offset += 8 + size + (size % 2);
  }
  const seconds = dataLength / byteRate;
  if (
    !Number.isFinite(seconds) ||
    seconds < 0.1 ||
    seconds > 20 ||
    sampleRate < 8000 ||
    sampleRate > 96000
  )
    throw new Error("INVALID_AUDIO_DURATION");
  return { seconds, sampleRate };
}
