// Validate ISO-BMFF structure without decoding or exposing learner samples.
export function inspectRecording(bytes: Uint8Array) {
  if (bytes.byteLength < 32 || bytes.byteLength > 2 * 1024 * 1024)
    throw new Error("INVALID_RECORDING_SIZE");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const type = (at: number) =>
    String.fromCharCode(...bytes.subarray(at, at + 4));
  type Box = { type: string; payload: number; end: number };
  function boxes(start: number, end: number): Box[] {
    const result: Box[] = [];
    while (start < end) {
      if (start + 8 > end || result.length > 10000)
        throw new Error("INVALID_MEDIA_BOX");
      let size = view.getUint32(start),
        header = 8;
      if (size === 1) {
        if (start + 16 > end) throw new Error("INVALID_MEDIA_BOX");
        const extended = view.getBigUint64(start + 8);
        if (extended > BigInt(Number.MAX_SAFE_INTEGER))
          throw new Error("INVALID_MEDIA_BOX");
        size = Number(extended);
        header = 16;
      }
      if (size === 0) size = end - start;
      if (size < header || start + size > end)
        throw new Error("INVALID_MEDIA_BOX");
      result.push({
        type: type(start + 4),
        payload: start + header,
        end: start + size,
      });
      start += size;
    }
    return result;
  }
  const root = boxes(0, bytes.length),
    ftyp = root.find((box) => box.type === "ftyp"),
    movie = root.find((box) => box.type === "moov");
  if (
    !ftyp ||
    ftyp.end - ftyp.payload < 8 ||
    !movie ||
    !root.some((box) => box.type === "mdat")
  )
    throw new Error("INVALID_M4A_CONTAINER");
  const tracks = boxes(movie.payload, movie.end).filter(
    (box) => box.type === "trak",
  );
  if (tracks.length !== 1) throw new Error("SINGLE_AUDIO_TRACK_REQUIRED");
  const media = boxes(tracks[0]!.payload, tracks[0]!.end).find(
    (box) => box.type === "mdia",
  );
  if (!media) throw new Error("MISSING_AUDIO_TRACK");
  const children = boxes(media.payload, media.end),
    handler = children.find((box) => box.type === "hdlr"),
    duration = children.find((box) => box.type === "mdhd"),
    information = children.find((box) => box.type === "minf");
  if (
    !handler ||
    handler.payload + 12 > handler.end ||
    type(handler.payload + 8) !== "soun" ||
    !duration ||
    !information
  )
    throw new Error("AUDIO_TRACK_REQUIRED");
  const version = bytes[duration.payload];
  if (version !== 0 && version !== 1) throw new Error("INVALID_MEDIA_DURATION");
  const scaleAt = duration.payload + (version === 1 ? 20 : 12),
    durationAt = scaleAt + 4;
  if (durationAt + (version === 1 ? 8 : 4) > duration.end)
    throw new Error("INVALID_MEDIA_DURATION");
  const scale = view.getUint32(scaleAt),
    ticks =
      version === 1
        ? Number(view.getBigUint64(durationAt))
        : view.getUint32(durationAt),
    seconds = ticks / scale;
  if (
    !Number.isFinite(seconds) ||
    seconds < 0.15 ||
    seconds > 30 ||
    !Number.isSafeInteger(ticks)
  )
    throw new Error("RECORDING_DURATION_OUT_OF_BOUNDS");
  const table = boxes(information.payload, information.end).find(
      (box) => box.type === "stbl",
    ),
    description =
      table &&
      boxes(table.payload, table.end).find((box) => box.type === "stsd");
  if (
    !description ||
    description.payload + 8 > description.end ||
    view.getUint32(description.payload + 4) !== 1 ||
    boxes(description.payload + 8, description.end)[0]?.type !== "mp4a"
  )
    throw new Error("AAC_RECORDING_REQUIRED");
  return {
    mime: "audio/mp4" as const,
    durationMillis: Math.round(seconds * 1000),
    bytes: bytes.length,
  };
}
