import { useState } from "react";
import { requestsLesson } from "@packages/content";
import type { ReviewTrack } from "@packages/learning-core";
import { useStudy } from "../../data/StudyProvider";
import { useProfile } from "../../data/ProfileProvider";
import { Body, Button } from "../../components/ui";
import { SentenceView } from "../lessons/SentenceView";
import { AudioPlay } from "../speech/AudioPlay";
import { PhraseAudio } from "../speech/PhraseAudio";
import { lessonAudio } from "../speech/lesson-audio";

/** Mount only after the answer is saved; model readings must not reveal a recall test. */
export function ReviewAudio({
  track,
  sessionId,
}: {
  track: ReviewTrack;
  sessionId: string;
}) {
  const { phrases } = useStudy(),
    { profile } = useProfile();
  const [open, setOpen] = useState(false);
  const card = track.card;
  if (card.source === "phrase") {
    const phrase = phrases.find(
      (item) => item._id === card.sourceId && item.status === "approved",
    );
    if (!phrase) return null;
    return (
      <>
        <Button
          label={open ? "Hide phrase audio" : "Listen to this phrase"}
          secondary
          onPress={() => setOpen((value) => !value)}
        />
        {open && <PhraseAudio phraseId={phrase._id} practiceId={phrase._id} />}
      </>
    );
  }
  if (
    card.sourceId !== requestsLesson.id ||
    card.sourceVersion !== requestsLesson.version
  )
    return null;
  const exercise = requestsLesson.exercises.find(
    (item) =>
      item.id === card.exercise.id && item.targetId === card.exercise.targetId,
  );
  if (!exercise) return null;
  const word = requestsLesson.words.find(
    (item) => item.id === exercise.targetId,
  );
  const kanaIndex = requestsLesson.kana.findIndex(
    (item) => item.character === exercise.targetId,
  );
  const sentences = word
    ? [word.example]
    : exercise.targetId === requestsLesson.grammar.id
      ? requestsLesson.grammar.examples
      : [];
  const wordId = word
    ? `word-${word.id}`
    : kanaIndex >= 0
      ? `kana-${kanaIndex + 1}`
      : undefined;
  if (!wordId && !sentences.length) return null;
  const settings = {
    romaji: profile.romaji,
    readings: profile.furigana,
    translation: profile.translations,
  };
  return (
    <>
      <Button
        label={open ? "Hide model audio" : "Listen to the model"}
        secondary
        onPress={() => setOpen((value) => !value)}
      />
      {open && (
        <>
          <Body muted>
            Listen after recall. Playback practises listening; it does not
            change this answer or assess pronunciation.
          </Body>
          {word && (
            <Body>
              {word.word} · {word.reading}
              {profile.romaji ? ` · ${word.romaji[0]}` : ""}
            </Body>
          )}
          {wordId && lessonAudio[wordId] && (
            <AudioPlay
              source={lessonAudio[wordId]}
              label={
                word
                  ? `${word.word} word`
                  : requestsLesson.kana[kanaIndex]!.character
              }
              sessionId={sessionId}
              reviewTrackId={track.id}
            />
          )}
          {sentences.map((sentence) => (
            <ReviewSentence
              key={sentence.id}
              sentence={sentence}
              settings={settings}
              sessionId={sessionId}
              trackId={track.id}
            />
          ))}
        </>
      )}
    </>
  );
}

function ReviewSentence({
  sentence,
  settings,
  sessionId,
  trackId,
}: {
  sentence: (typeof requestsLesson.grammar.examples)[number];
  settings: { romaji: boolean; readings: boolean; translation: boolean };
  sessionId: string;
  trackId: string;
}) {
  return (
    <>
      <SentenceView sentence={sentence} {...settings} />
      {lessonAudio[sentence.id] && (
        <AudioPlay
          source={lessonAudio[sentence.id]}
          label={sentence.text}
          sessionId={sessionId}
          reviewTrackId={trackId}
        />
      )}
    </>
  );
}
