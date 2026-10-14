import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  renameSync,
  existsSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { buildContentPackage } from "../scripts/lib/content-package.mjs";
import {
  validateContentManifest,
  verifyContentManifest,
  storageChecksumHex,
  type ContentManifest,
} from "../packages/learning-core/src/content-package.ts";
import {
  installContent,
  type PackageInstallIO,
} from "../apps/native/src/data/installContent.ts";
const hash = (bytes: string | Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");
const root = resolve(import.meta.dirname, "..");
test("storage checksum normalization accepts the observed base64 or hex representation without weakening digest checks", () => {
  const digest = createHash("sha256").update("checked content").digest();
  assert.equal(
    storageChecksumHex(digest.toString("base64")),
    digest.toString("hex"),
  );
  assert.equal(
    storageChecksumHex(digest.toString("hex").toUpperCase()),
    digest.toString("hex"),
  );
  for (const bad of [
    "",
    digest.toString("base64").slice(0, -1),
    "A".repeat(42) + "B=",
    "../checksum",
  ])
    assert.throws(() => storageChecksumHex(bad));
});
function fixture(t: TestContext) {
  const { manifest, files } = buildContentPackage(root) as {
    manifest: ContentManifest;
    files: { id: string; data: Uint8Array }[];
  };
  const directory = mkdtempSync(join(tmpdir(), "kiro-content-")),
    stage = join(directory, "stage"),
    target = join(directory, "ready");
  let db = new DatabaseSync(join(directory, "account.db")),
    active = true,
    free = 100_000_000,
    broken = "";
  db.exec(
    "CREATE TABLE metadata(key TEXT PRIMARY KEY,value TEXT); INSERT INTO metadata VALUES('ready','previous-ready'); CREATE TABLE attempts(id TEXT); INSERT INTO attempts VALUES('retained-attempt');",
  );
  t.after(() => {
    db.close();
    rmSync(directory, { recursive: true, force: true });
  });
  const io: PackageInstallIO = {
    digest: async (text) => hash(text),
    freeBytes: () => free,
    current: () => active,
    createStage: async () => {
      mkdirSync(stage);
    },
    fetchAsset: async (asset) => {
      const source = files.find((f) => f.id === asset.id)!;
      writeFileSync(join(stage, asset.id), source.data);
      if (broken === asset.id)
        writeFileSync(join(stage, asset.id), "interrupted");
    },
    verifyAsset: async (asset) => {
      assert.equal(hash(readFileSync(join(stage, asset.id))), asset.sha256);
    },
    activate: async (m) => {
      renameSync(stage, target);
      db.prepare(
        "INSERT INTO metadata VALUES('ready',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
      ).run(JSON.stringify({ manifest: m, directory: target }));
    },
    discardStage: async () => {
      rmSync(stage, { recursive: true, force: true });
      const ready = db
        .prepare("SELECT value FROM metadata WHERE key='ready'")
        .get() as { value: string };
      if (ready.value === "previous-ready")
        rmSync(target, { recursive: true, force: true });
    },
  };
  return {
    manifest,
    files,
    io,
    stage,
    target,
    setFree: (n: number) => (free = n),
    breakAsset: (id: string) => (broken = id),
    cancel: () => (active = false),
    read: () =>
      (
        db.prepare("SELECT value FROM metadata WHERE key='ready'").get() as {
          value: string;
        }
      ).value,
    reopen: () => {
      db.close();
      db = new DatabaseSync(join(directory, "account.db"));
    },
    failCommit: () =>
      db.exec(
        "CREATE TRIGGER fail_ready BEFORE INSERT ON metadata WHEN NEW.key='ready' BEGIN SELECT RAISE(ABORT,'synthetic storage failure'); END;",
      ),
    retained: () => db.prepare("SELECT count(*) as n FROM attempts").get(),
  };
}
test("the checked package includes every lesson/audio file and rejects a tampered manifest before file work", async (t) => {
  const f = fixture(t);
  assert.equal(f.manifest.assets.length, 12);
  assert.equal(f.files.length, 12);
  assert.deepEqual(
    await verifyContentManifest(f.manifest, async (text) => hash(text)),
    f.manifest,
  );
  for (const asset of f.manifest.assets) {
    const source = f.files.find((file) => file.id === asset.id)!;
    assert.equal(source.data.length, asset.bytes);
    assert.equal(hash(source.data), asset.sha256);
  }
  for (const patch of [
    { lessonId: "../escape" },
    { sha256: "bad" },
    { assets: f.manifest.assets.slice(1) },
    { assets: [...f.manifest.assets, f.manifest.assets[0]] },
  ])
    assert.throws(() => validateContentManifest({ ...f.manifest, ...patch }));
  await assert.rejects(
    installContent({ ...f.manifest, title: "Changed" }, f.io),
    /checksum/,
  );
  assert.equal(existsSync(f.stage), false);
  assert.equal(f.read(), "previous-ready");
});
test("all verified files commit one ready pointer that survives SQLite restart without touching attempts", async (t) => {
  const f = fixture(t),
    progress: number[] = [];
  await installContent(f.manifest, f.io, (n) => progress.push(n));
  assert.equal(progress.at(-1), 12);
  assert.equal(existsSync(f.stage), false);
  f.reopen();
  const ready = JSON.parse(f.read());
  assert.equal(ready.manifest.sha256, f.manifest.sha256);
  for (const asset of f.manifest.assets)
    assert.equal(
      hash(readFileSync(join(ready.directory, asset.id))),
      asset.sha256,
    );
  assert.equal((f.retained() as { n: number }).n, 1);
});
test("an interrupted or corrupt file retains the old ready package, removes staging and can retry", async (t) => {
  const f = fixture(t);
  f.breakAsset(f.manifest.assets[2]!.id);
  await assert.rejects(installContent(f.manifest, f.io));
  f.reopen();
  assert.equal(f.read(), "previous-ready");
  assert.equal(existsSync(f.stage), false);
  assert.equal(existsSync(f.target), false);
  f.breakAsset("");
  await installContent(f.manifest, f.io);
  assert.equal(JSON.parse(f.read()).manifest.sha256, f.manifest.sha256);
});
test("low storage, cancellation and failed activation never replace a previous ready pointer", async (t) => {
  const f = fixture(t);
  f.setFree(1);
  await assert.rejects(installContent(f.manifest, f.io), /storage/);
  assert.equal(existsSync(f.stage), false);
  f.setFree(100_000_000);
  const original = f.io.fetchAsset;
  f.io.fetchAsset = async (asset) => {
    await original(asset);
    f.cancel();
  };
  await assert.rejects(installContent(f.manifest, f.io), /cancel/);
  assert.equal(f.read(), "previous-ready");
  assert.equal(existsSync(f.stage), false);
  const failed = fixture(t);
  failed.failCommit();
  await assert.rejects(
    installContent(failed.manifest, failed.io),
    /synthetic storage/,
  );
  failed.reopen();
  assert.equal(failed.read(), "previous-ready");
  assert.equal(existsSync(failed.target), false);
  assert.equal((failed.retained() as { n: number }).n, 1);
});
test("content publisher version, help and unknown flags resolve before configuration or network access", () => {
  const cli = join(root, "scripts/content-package.mjs");
  const version = spawnSync(process.execPath, [cli, "--version"], {
    encoding: "utf8",
    env: {},
  });
  assert.equal(version.status, 0);
  assert.equal(version.stdout.trim(), "1.0.0");
  const help = spawnSync(process.execPath, [cli, "--help"], {
    encoding: "utf8",
    env: {},
  });
  assert.equal(help.status, 0);
  assert(help.stdout.includes("--publish"));
  const invalid = spawnSync(process.execPath, [cli, "--pubish"], {
    encoding: "utf8",
    env: {},
  });
  assert.equal(invalid.status, 2);
  assert(invalid.stdout.startsWith("error:"));
  assert(!invalid.stderr);
});
