import { useState } from "react";
import { View } from "react-native";
import { Body, Button, Field } from "../../components/ui";
import { useSpeech, type LocalRecording } from "./SpeechProvider";
export function TranscriptCard({
  record,
  number,
  onUse,
  onPractice,
  onPause,
}: {
  record: LocalRecording;
  number: number;
  onUse?: (text: string, edited: boolean) => Promise<void>;
  onPractice?: () => void;
  onPause?: () => void;
}) {
  const speech = useSpeech(),
    [notice, setNotice] = useState("");
  const text =
    record.transcriptDraft ??
    record.learnerConfirmedText ??
    record.recognizedTranscript ??
    "";
  const ready =
    record.recognitionStatus === "ready" ||
    record.recognitionStatus === "empty";
  const operation = (work: () => Promise<void>) =>
    void work().catch(() =>
      setNotice(
        "Your recording remains saved. Try again or continue by typing.",
      ),
    );
  return (
    <View style={{ gap: 8 }}>
      {ready ? (
        <>
          <Body>
            {record.recognitionStatus === "empty"
              ? "We couldn't recognize clear speech. You can record again or type what you meant."
              : "Please check what we heard."}
          </Body>
          {record.recognizedTranscript ? (
            <Body>Recognized: {record.recognizedTranscript}</Body>
          ) : null}
          <Field
            label={`Transcript for attempt ${number}`}
            multiline
            value={text}
            maxLength={1000}
            onFocus={onPractice}
            onChangeText={(value) => {
              onPractice?.();
              operation(() => speech.edit(record.id, value));
            }}
          />
          <Button
            label={`Confirm transcript ${number}`}
            secondary
            disabled={!text.trim()}
            onPress={() => {
              onPractice?.();
              onPause?.();
              operation(() => speech.confirm(record.id, text));
            }}
          />
          {record.learnerConfirmedText && (
            <>
              <Body muted>
                Text confirmed
                {record.wasEdited ? " · edited as written practice" : ""}
                {record.confirmationPending
                  ? " · will synchronize when connected"
                  : ""}
                . Pronunciation has not been scored.
              </Body>
              {onUse && (
                <Button
                  label={`Use confirmed answer ${number}`}
                  disabled={text.trim() !== record.learnerConfirmedText}
                  onPress={() =>
                    operation(() =>
                      onUse(
                        record.learnerConfirmedText!,
                        Boolean(record.wasEdited),
                      ),
                    )
                  }
                />
              )}
            </>
          )}
        </>
      ) : (
        <>
          <Body muted>
            {record.recognitionStatus === "unavailable"
              ? "Speech recognition is unavailable. Your attempt is saved; speaking wasn't assessed. Retry or type instead."
              : record.recognitionStatus === "deleted"
                ? "The cloud transcript was deleted. You can record a new attempt."
                : record.recognitionRequested ||
                    ["uploading", "queued", "running"].includes(
                      record.recognitionStatus,
                    )
                  ? speech.online
                    ? "Transcript pending. You can keep studying while it is recognized."
                    : "Offline: transcript requested. It will upload when you reconnect."
                  : "Request a transcript when you're ready. This sends this short recording for recognition."}
          </Body>
          {record.recognitionStatus !== "deleted" && (
            <Button
              label={`${record.recognitionRequested || ["queued", "running", "uploading"].includes(record.recognitionStatus) ? "Check transcript" : record.recognitionStatus === "unavailable" ? "Retry transcript" : "Get transcript"} ${number}`}
              secondary
              disabled={
                speech.recording ||
                ((record.attempt ?? 0) >= 3 &&
                  record.recognitionStatus === "unavailable")
              }
              onPress={() => operation(() => speech.recognize(record.id))}
            />
          )}
        </>
      )}
      {notice ? <Body>{notice}</Body> : null}
    </View>
  );
}
