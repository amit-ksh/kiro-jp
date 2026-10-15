import { useEffect, useRef, useState } from "react";
import {
  useConvex,
  useConvexAuth,
  useConvexConnectionState,
} from "convex/react";
import { router } from "expo-router";
import * as FileSystem from "expo-file-system/legacy";
import * as Crypto from "expo-crypto";
import { api } from "@packages/backend/convex/_generated/api";
import { collectCloudExport, exportCollections } from "@packages/learning-core";
import { useStudy } from "../../data/StudyProvider";
import { useSpeech } from "../../features/speech/SpeechProvider";
import { openAccountDatabase } from "../../data/database";
import { readLocalLearningExport } from "../../data/exportLearning";
import {
  Body,
  Button,
  Message,
  Panel,
  Screen,
  Title,
} from "../../components/ui";

type Work = { cancelled: boolean; includeCloud: boolean };
export default function AccountData() {
  const convex = useConvex(),
    auth = useConvexAuth(),
    connection = useConvexConnectionState();
  const { accountId } = useStudy();
  const speech = useSpeech();
  const online = auth.isAuthenticated && connection.isWebSocketConnected;
  const work = useRef<Work | null>(null);
  const [busy, setBusy] = useState(false),
    [status, setStatus] = useState("");
  const [error, setError] = useState("");
  useEffect(
    () => () => {
      if (work.current) work.current.cancelled = true;
      work.current = null;
    },
    [accountId],
  );
  async function save(includeCloud: boolean) {
    if (work.current || speech.recording) return;
    const task: Work = { cancelled: false, includeCloud };
    work.current = task;
    const check = () => {
      if (work.current !== task || task.cancelled)
        throw new Error("Export cancelled.");
    };
    const current = () => work.current === task && !task.cancelled;
    let destination: string | undefined;
    setBusy(true);
    setError("");
    setStatus("Preparing your saved learning data…");
    const startedAt = Date.now();
    try {
      const cloudStart = includeCloud
        ? await convex.mutation(api.accountData.beginExport, {})
        : null;
      check();
      if (cloudStart && cloudStart.accountId !== accountId)
        throw new Error("Your account changed. Start the export again.");
      const db = await openAccountDatabase(accountId);
      const local = await (async () => {
        try {
          check();
          return await readLocalLearningExport(db);
        } finally {
          await db.closeAsync();
        }
      })();
      check();
      const cloud = cloudStart
        ? {
            createdBefore: cloudStart.cutoff,
            collections: await collectCloudExport(
              accountId,
              (collection, cursor, endCursor) =>
                convex.query(api.accountData.exportPage, {
                  collection,
                  cursor,
                  endCursor,
                  cutoff: cloudStart.cutoff,
                }),
              check,
              (collection, records) => {
                if (current())
                  setStatus(
                    `Reading cloud section ${exportCollections.indexOf(collection) + 1} of ${exportCollections.length} · ${records} records…`,
                  );
              },
            ),
            readFinishedAt: Date.now(),
          }
        : null;
      check();
      const contents = JSON.stringify(
        {
          kind: "japanese-learning-data",
          formatVersion: 1,
          accountId,
          mode: includeCloud ? "device-and-cloud" : "device-only",
          startedAt,
          finishedAt: Date.now(),
          notes: [
            "Device and cloud sections stay separate; unsynchronized answers and drafts are retained.",
            "The device section is one SQLite read snapshot. Cloud collections are read over the recorded interval; mutable records are not a single global snapshot.",
            "Cloud records created after the server cutoff are excluded. Export again to include later work.",
            "This is a learning-data export, not an importable backup. Audio files, credentials, provider diagnostics and private file handles are excluded.",
          ],
          local,
          cloud,
        },
        null,
        2,
      );
      setStatus("Choose a folder for your JSON export…");
      const permission =
        await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
      check();
      if (!permission.granted) {
        setStatus("Export cancelled. Your learning data is unchanged.");
        return;
      }
      destination = await FileSystem.StorageAccessFramework.createFileAsync(
        permission.directoryUri,
        `Japanese-study-${Date.now()}-${Crypto.randomUUID().slice(0, 8)}`,
        "application/json",
      );
      check();
      await FileSystem.writeAsStringAsync(destination, contents, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      check();
      if (
        (await FileSystem.readAsStringAsync(destination, {
          encoding: FileSystem.EncodingType.UTF8,
        })) !== contents
      )
        throw new Error("The saved file could not be checked.");
      check();
      destination = undefined; // The learner now owns the successfully checked file.
      setStatus(
        includeCloud
          ? "Your device and cloud learning data was saved as JSON in the folder you selected."
          : "Data saved on this device was exported as JSON. Cloud data was not included.",
      );
    } catch {
      if (destination) {
        try {
          await FileSystem.deleteAsync(destination, { idempotent: true });
        } catch {
          if (current())
            setError(
              "The export did not finish. A partial file may remain in your chosen folder. Delete it and retry; your study progress is unchanged.",
            );
        }
      }
      if (current()) {
        setStatus("");
        setError(
          (previous) =>
            previous ||
            "The export couldn't finish. Your study data is unchanged. Check the connection or folder access and try again.",
        );
      }
    } finally {
      if (work.current === task) {
        work.current = null;
        setBusy(false);
      }
    }
  }
  function cancel() {
    if (work.current) work.current.cancelled = true;
    work.current = null;
    setBusy(false);
    setStatus("Export cancelled. Your study progress is unchanged.");
  }
  return (
    <Screen
      title="Your learning data"
      subtitle="Keep a copy of your Japanese practice"
    >
      <Panel>
        <Title>Export your learning</Title>
        <Body>
          Save your goals, answers, review history, conversations, saved phrases
          and recognized transcripts as a JSON file. Device drafts and
          unsynchronized activity have their own section.
        </Body>
        <Body muted>
          Audio files, passwords and sign-in tokens are excluded. This file can
          contain personal conversation text. Choose a folder you control.
        </Body>
        <Button
          label="Export with cloud data"
          disabled={!online || busy || speech.recording}
          busy={busy && work.current?.includeCloud === true}
          onPress={() => void save(true)}
        />
        <Button
          label="Export this device only"
          secondary
          busy={busy && work.current?.includeCloud === false}
          disabled={busy || speech.recording}
          onPress={() => void save(false)}
        />
        {!online && (
          <Body muted>
            You are offline. You can export data already saved on this phone, or
            reconnect to include all cloud learning records.
          </Body>
        )}
        {speech.recording && (
          <Body muted>
            Finish your current recording before preparing an export.
          </Body>
        )}
        {busy && <Button label="Cancel export" secondary onPress={cancel} />}
        {status && <Body>{status}</Body>}
        {error && <Message>{error}</Message>}
        <Body muted>
          Cloud records are read over the export period. You can export again
          after new practice synchronizes. Exporting does not change your
          learning progress.
        </Body>
      </Panel>
      <Button label="Back to Profile" secondary onPress={() => router.back()} />
    </Screen>
  );
}
