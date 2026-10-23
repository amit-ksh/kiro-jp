import { Directory, File, Paths } from "expo-file-system";
import * as SQLite from "expo-sqlite";
import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import { checkedContentManifests } from "@packages/content";
import { retireAccountDatabase } from "./database";
import { sqliteDirectoryUri } from "./localPaths";

export async function deleteLocalAccount(accountId: string) {
  const namespace = await retireAccountDatabase(accountId);
  if (!/^[a-f0-9]{64}$/.test(namespace))
    throw new Error("Invalid local account partition.");
  const partitions: [string, string][] = [
    ["recordings", namespace],
    ["phrase-audio", namespace],
  ];
  for (const manifest of checkedContentManifests) {
    const suffix =
      manifest.lessonId === "requests" && manifest.version === 1
        ? ""
        : `:${manifest.lessonId}:${manifest.version}`;
    partitions.push([
      "content-packages",
      await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        `${process.env.EXPO_PUBLIC_CONVEX_URL}:${accountId}${suffix}`,
      ),
    ]);
  }
  for (const [folder, partition] of partitions) {
    if (
      !/^[a-f0-9]{64}$/.test(partition) ||
      !["recordings", "phrase-audio", "content-packages"].includes(folder)
    )
      throw new Error("Invalid local cleanup path.");
    const parent = new Directory(Paths.document, folder),
      directory = new Directory(parent, partition);
    // Only exact app-owned hash directories are eligible. Never follow a URI
    // from a draft, cloud result, or user-selected export destination.
    if (
      directory.uri.replace(/\/$/, "") !==
      `${parent.uri.replace(/\/$/, "")}/${partition}`
    )
      throw new Error("Invalid local cleanup path.");
    if (directory.exists) directory.delete();
  }
  const callAudioParent = new Directory(Paths.cache, "conversation-audio"),
    callAudio = new Directory(callAudioParent, namespace);
  if (
    callAudio.uri.replace(/\/$/, "") !==
    `${callAudioParent.uri.replace(/\/$/, "")}/${namespace}`
  )
    throw new Error("Invalid call audio cleanup path.");
  if (callAudio.exists) callAudio.delete();
  const root = SQLite.defaultDatabaseDirectory;
  if (!root) throw new Error("Local database directory unavailable.");
  const name = `learning-${namespace}.db`,
    directoryUri = sqliteDirectoryUri(root),
    main = new File(directoryUri, name);
  if (main.exists) await SQLite.deleteDatabaseAsync(name);
  // SDK 55's Android delete removes only the main file; explicitly remove
  // remaining WAL/SHM after every tracked connection is closed.
  for (const suffix of ["-wal", "-shm"]) {
    const file = new File(directoryUri, name + suffix);
    if (file.exists) file.delete();
  }
  const authNamespace = (
    process.env.EXPO_PUBLIC_CONVEX_URL ?? "unconfigured"
  ).replace(/[^a-zA-Z0-9]/g, "");
  await SecureStore.deleteItemAsync(
    `learning-identity-${authNamespace}-${accountId}`,
  );
}
