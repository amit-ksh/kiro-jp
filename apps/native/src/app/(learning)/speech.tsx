import { useCallback, useState } from "react";
import { Linking, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { requestsLesson } from "@packages/content";
import { useStudy } from "../../data/StudyProvider";
import { useSpeech } from "../../features/speech/SpeechProvider";
import { AudioPlay } from "../../features/speech/AudioPlay";
import { lessonAudio } from "../../features/speech/lesson-audio";
import { useAudioTime } from "../../features/speech/useAudioTime";
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
  } = useLocalSearchParams<{
    sessionId: string;
    cueId: string;
    returnStep: string;
  }>();
  const study = useStudy(),
    speech = useSpeech(),
    [selected, setSelected] = useState(
      cues.some((cue) => cue.id === cueId) ? cueId : "word-water",
    ),
    [notice, setNotice] = useState("");
  const cue = cues.find((item) => item.id === selected)!;
  const records = speech.recordings.filter(
    (record) => record.sessionId === sessionId && record.cueId === cue.id,
  );
  const valid = study.events.some(
    (event) => event.sessionId === sessionId && event.kind === "started",
  );
  useAudioTime(sessionId, "speaking", speech.recording);
  const stop = speech.stop;
  useFocusEffect(
    useCallback(
      () => () => {
        void stop();
      },
      [stop],
    ),
  );
  const draft = study.drafts[`${sessionId}:speech-${selected}`] ?? "";
  if (!valid)
    return (
      <Screen title="Open your saved lesson">
        <Panel>
          <Body>This lesson is not available on this phone yet.</Body>
          <Button
            label="Return Home"
            onPress={() => router.replace("/(learning)/(tabs)")}
          />
        </Panel>
      </Screen>
    );
  return (
    <Screen
      title="Hear it. Try it."
      subtitle="Word by word, then a complete sentence."
    >
      <Panel>
        <Title>{cue.text}</Title>
        <Body>{cue.reading}</Body>
        <Body>{cue.meaning}</Body>
        <AudioPlay
          key={selected}
          source={lessonAudio[selected]}
          sessionId={sessionId}
          label="model audio"
        />
        <Body muted>
          Prepared model audio · recordings stay on this device until you
          request a transcript.
        </Body>
      </Panel>
      <Panel>
        <Title>Your attempt</Title>
        <Body>
          Listen, repeat, then compare through playback. A transcript is a
          recognition aid, never a pronunciation score.
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
            onPress={() => void speech.start(sessionId, selected)}
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
              label="Continue with listening practice"
              secondary
              onPress={() =>
                setNotice(
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
              sessionId={sessionId}
              label={`my recording ${records.length - index}`}
            />
            <Body muted>
              Transcript awaiting connection and recognition service. Speaking
              has not been assessed.
            </Body>
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
          onChangeText={(value) =>
            void study
              .saveDraft(sessionId, `speech-${selected}`, value)
              .catch(() =>
                setNotice(
                  "Your draft couldn't be saved. Keep this screen open.",
                ),
              )
          }
        />
        {returnStep &&
          requestsLesson.exercises.some(
            (exercise) =>
              exercise.id === returnStep && exercise.kind === "sentence",
          ) && (
            <Button
              label="Use this typed answer"
              disabled={!draft.trim() || speech.recording}
              onPress={() =>
                void study
                  .saveDraft(sessionId, returnStep, draft)
                  .then(() => router.back())
                  .catch(() =>
                    setNotice("Your draft is still here. Try again."),
                  )
              }
            />
          )}
        <Body muted>
          Typing remains written practice. It does not prove speaking or kana
          literacy.
        </Body>
      </Panel>
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
      {notice && (
        <Panel>
          <Body>{notice}</Body>
        </Panel>
      )}
      <Button
        label="Return to lesson"
        disabled={speech.recording}
        onPress={() => router.back()}
      />
    </Screen>
  );
}
