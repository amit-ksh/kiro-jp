import { useCallback, useState } from "react";
import { Linking, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { requestsLesson } from "@packages/content";
import { useStudy } from "../../data/StudyProvider";
import { useSpeech } from "../../features/speech/SpeechProvider";
import { AudioPlay } from "../../features/speech/AudioPlay";
import { lessonAudio } from "../../features/speech/lesson-audio";
import { useAudioTime } from "../../features/speech/useAudioTime";
import { TranscriptCard } from "../../features/speech/TranscriptCard";
import { useStudyTime } from "../../features/lessons/useStudyTime";
import {
  Body,
  Button,
  Choice,
  Field,
  Panel,
  Screen,
  Title,
} from "../../components/ui";
const sentences = [
  ...new Map(
    [
      ...requestsLesson.words.map((word) => word.example),
      ...requestsLesson.grammar.examples,
    ].map((sentence) => [sentence.id, sentence]),
  ).values(),
];
const cues = [
  ...requestsLesson.words.map((word) => ({
    id: `word-${word.id}`,
    text: word.word,
    reading: word.reading,
    meaning: word.meaning,
  })),
  ...sentences.map((sentence) => ({
    id: sentence.id,
    text: sentence.text,
    reading: sentence.reading,
    meaning: sentence.meaning,
  })),
];
export default function Speech() {
  const {
    sessionId = "",
    cueId = "word-water",
    returnStep = "",
    conversationSegmentId = "",
  } = useLocalSearchParams<{
    sessionId: string;
    cueId: string;
    returnStep: string;
    conversationSegmentId: string;
  }>();
  const study = useStudy(),
    speech = useSpeech(),
    [selected, setSelected] = useState(
      cues.some((cue) => cue.id === cueId) ? cueId : "word-water",
    ),
    [notice, setNotice] = useState("");
  const conversation = Boolean(conversationSegmentId);
  const cue = conversation
    ? {
        id: "chat-answer",
        text: "Your reply",
        reading: "Speak a short Japanese reply, then check the transcript.",
        meaning: "You can change the text before sending it to your tutor.",
      }
    : cues.find((item) => item.id === selected)!;
  const studyId = conversationSegmentId || sessionId;
  const timing = useStudyTime(
    studyId,
    conversation ? "chat" : "recap",
    conversation ? "conversationActivity" : "activity",
  );
  const records = speech.recordings.filter(
    (record) =>
      (conversation
        ? record.conversationSegmentId === conversationSegmentId
        : record.sessionId === sessionId && !record.conversationSegmentId) &&
      record.cueId === cue.id,
  );
  const valid = conversation
    ? Object.values(study.chats).some((chat) =>
        chat.segments.some(
          (segment) => segment.segmentId === conversationSegmentId,
        ),
      )
    : study.events.some(
        (event) => event.sessionId === sessionId && event.kind === "started",
      );
  useAudioTime(studyId, "speaking", speech.recording, conversation);
  const stop = speech.stop;
  useFocusEffect(
    useCallback(
      () => () => {
        void stop();
      },
      [stop],
    ),
  );
  const draft = study.drafts[`${studyId}:speech-${cue.id}`] ?? "";
  const useAnswer = async (text: string, edited: boolean) => {
    timing.pause();
    if (conversation) {
      await study.saveDraft(studyId, "chat-message", text);
      let previous: string[] = [];
      try {
        previous = JSON.parse(study.drafts[`${studyId}:chat-support`] ?? "[]");
      } catch {
        /* Start with the current confirmed input. */
      }
      await study.saveDraft(
        studyId,
        "chat-support",
        JSON.stringify([
          ...new Set([...previous, ...(edited ? ["transcriptEdited"] : [])]),
        ]),
      );
    } else {
      await study.saveDraft(sessionId, returnStep, text);
      await study.saveDraft(
        sessionId,
        `${returnStep}:speech-support`,
        edited ? "transcriptEdited" : "confirmedSpeech",
      );
    }
    router.back();
  };
  if (!valid)
    return (
      <Screen
        title={
          conversation
            ? "Open your saved conversation"
            : "Open your saved lesson"
        }
      >
        <Panel>
          <Body>
            {conversation
              ? "This conversation is not available on this phone yet."
              : "This lesson is not available on this phone yet."}
          </Body>
          <Button
            label="Return Home"
            onPress={() => router.replace("/(learning)/(tabs)")}
          />
        </Panel>
      </Screen>
    );
  return (
    <Screen
      title={conversation ? "Say your reply" : "Hear it. Try it."}
      subtitle={
        conversation
          ? "Record, check, then return to your conversation."
          : "Word by word, then a complete sentence."
      }
    >
      <Panel>
        <Title>{cue.text}</Title>
        <Body>{cue.reading}</Body>
        <Body>{cue.meaning}</Body>
        {!conversation && (
          <AudioPlay
            key={selected}
            source={lessonAudio[selected]}
            sessionId={sessionId}
            label="model audio"
          />
        )}
        <Body muted>
          {conversation
            ? "Recordings stay on this device until you request a transcript."
            : "Prepared model audio · recordings stay on this device until you request a transcript."}
        </Body>
      </Panel>
      <Panel>
        <Title>Your attempt</Title>
        <Body>
          {conversation
            ? "Record your reply, replay it, then check the text before sending. A transcript is a recognition aid, never a pronunciation score."
            : "Listen, repeat, then compare through playback. A transcript is a recognition aid, never a pronunciation score."}
        </Body>
        {speech.recording ? (
          <>
            <Body>
              Recording · {(speech.durationMillis / 1000).toFixed(1)} / 30
              seconds
            </Body>
            <Button
              label="Stop and save recording"
              onPress={() => void speech.stop()}
            />
          </>
        ) : (
          <Button
            label="Record my attempt"
            busy={speech.loading}
            onPress={() => {
              timing.pause();
              void speech.start(
                studyId,
                cue.id,
                conversationSegmentId || undefined,
              );
            }}
          />
        )}
        {speech.permissionDenied && (
          <>
            <Body>Microphone access is off. You can continue by typing.</Body>
            <Button
              label="Type instead"
              secondary
              onPress={() =>
                setNotice(
                  "Use the typed practice below. Speaking remains unassessed.",
                )
              }
            />
            <Button
              label="Enable microphone"
              secondary
              onPress={() => void Linking.openSettings()}
            />
            <Button
              label={
                conversation
                  ? "Continue reading conversation"
                  : "Continue with listening practice"
              }
              secondary
              onPress={() =>
                conversation
                  ? router.back()
                  : setNotice(
                      "Replay the model audio, then try recording whenever you're ready.",
                    )
              }
            />
          </>
        )}
        {speech.error && <Body>{speech.error}</Body>}
        {records.map((record, index) => (
          <View key={record.id} style={{ gap: 8 }}>
            <Body>
              Attempt {records.length - index} ·{" "}
              {(record.durationMillis / 1000).toFixed(1)} seconds · saved on
              this phone
            </Body>
            <AudioPlay
              source={{ uri: record.uri }}
              sessionId={studyId}
              conversation={conversation}
              label={`my recording ${records.length - index}`}
            />
            <TranscriptCard
              record={record}
              number={records.length - index}
              onUse={returnStep || conversation ? useAnswer : undefined}
              onPractice={timing.interact}
              onPause={timing.pause}
            />
            <Button
              label={`Delete recording ${records.length - index}`}
              secondary
              disabled={speech.recording}
              onPress={() =>
                void speech
                  .remove(record.id)
                  .catch(() =>
                    setNotice(
                      "The recording couldn't be deleted. Please try again.",
                    ),
                  )
              }
            />
          </View>
        ))}
        {!records.length && (
          <Body muted>
            Your saved attempts will appear here. You can retry whenever you
            like.
          </Body>
        )}
      </Panel>
      <Panel>
        <Title>Type your practice sentence</Title>
        <Field
          label="Typed practice"
          value={draft}
          multiline
          maxLength={1000}
          onChangeText={(value) => {
            if (value.trim()) timing.interact();
            void study
              .saveDraft(studyId, `speech-${cue.id}`, value)
              .catch(() =>
                setNotice(
                  "Your draft couldn't be saved. Keep this screen open.",
                ),
              );
          }}
        />
        {(conversation ||
          (returnStep &&
            requestsLesson.exercises.some(
              (exercise) =>
                exercise.id === returnStep && exercise.kind === "sentence",
            ))) && (
          <Button
            label="Use this typed answer"
            disabled={!draft.trim() || speech.recording}
            onPress={() => {
              timing.pause();
              void (
                conversation
                  ? study.saveDraft(studyId, "chat-message", draft)
                  : study.saveDraft(sessionId, returnStep, draft)
              )
                .then(() => router.back())
                .catch(() => setNotice("Your draft is still here. Try again."));
            }}
          />
        )}
        <Body muted>
          Typing remains written practice. It does not prove speaking or kana
          literacy.
        </Body>
      </Panel>
      {!conversation && (
        <Panel>
          <Title>Choose another word or sentence</Title>
          {cues.map((item) => (
            <Choice
              key={item.id}
              label={`${item.text} · ${item.reading}`}
              selected={selected === item.id}
              onPress={() => {
                if (!speech.recording) setSelected(item.id);
              }}
            />
          ))}
        </Panel>
      )}
      {notice && (
        <Panel>
          <Body>{notice}</Body>
        </Panel>
      )}
      <Button
        label={conversation ? "Return to conversation" : "Return to lesson"}
        disabled={speech.recording}
        onPress={() => router.back()}
      />
    </Screen>
  );
}
