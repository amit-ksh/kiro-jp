import {
  verifyContentManifest,
  type ContentAsset,
  type ContentManifest,
} from "@packages/learning-core";

export interface PackageInstallIO {
  digest: (text: string) => Promise<string>;
  freeBytes: () => number;
  createStage: () => Promise<void>;
  fetchAsset: (asset: ContentAsset) => Promise<void>;
  verifyAsset: (asset: ContentAsset) => Promise<void>;
  activate: (manifest: ContentManifest) => Promise<void>;
  discardStage: () => Promise<void>;
  current: () => boolean;
}
/** Nothing becomes ready until every required file has been verified. */
export async function installContent(
  manifest: unknown,
  io: PackageInstallIO,
  onProgress: (done: number, total: number) => void = () => {},
) {
  const checked = await verifyContentManifest(manifest, io.digest);
  const ensureCurrent = () => {
    if (!io.current())
      throw new Error(
        "Preparation was cancelled. Your previous package stays saved.",
      );
  };
  ensureCurrent();
  const bytes = checked.assets.reduce((n, a) => n + a.bytes, 0);
  const free = io.freeBytes();
  if (!Number.isFinite(free) || free < bytes * 2 + 5_000_000)
    throw new Error(
      "Not enough storage. Free some space and try again; your previous package is retained.",
    );
  try {
    await io.createStage();
    onProgress(0, checked.assets.length);
    for (const [at, asset] of checked.assets.entries()) {
      ensureCurrent();
      await io.fetchAsset(asset);
      ensureCurrent();
      await io.verifyAsset(asset);
      ensureCurrent();
      onProgress(at + 1, checked.assets.length);
    }
    ensureCurrent();
    await io.activate(checked);
    return checked;
  } finally {
    await io.discardStage();
  }
}
