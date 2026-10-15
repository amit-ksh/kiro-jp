export interface ContentReader {
  read: () => Promise<{ done: boolean; value?: Uint8Array }>;
  cancel: () => Promise<unknown>;
}
export async function readContentBytes(
  reader: ContentReader,
  expectedBytes: number,
  current: () => boolean,
) {
  try {
    if (
      !Number.isSafeInteger(expectedBytes) ||
      expectedBytes < 1 ||
      expectedBytes > 2_000_000
    )
      throw new Error("Invalid content file size.");
    const data = new Uint8Array(expectedBytes);
    let bytes = 0;
    while (true) {
      if (!current()) throw new Error("Content download was interrupted.");
      const part = await reader.read();
      if (!current()) throw new Error("Content download was interrupted.");
      if (part.done) break;
      if (
        !(part.value instanceof Uint8Array) ||
        bytes + part.value.length > expectedBytes
      )
        throw new Error("Content download was interrupted.");
      // Own each chunk before another native read or cancellation can reuse it.
      // Allocate only the manifest's bounded size, rather than retaining views.
      data.set(part.value, bytes);
      bytes += part.value.length;
    }
    if (bytes !== expectedBytes)
      throw new Error("Content download is incomplete.");
    return data;
  } finally {
    await reader.cancel().catch(() => {});
  }
}
