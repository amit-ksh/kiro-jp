import { router, useLocalSearchParams } from "expo-router";
import { requestsLesson } from "@packages/content";
import { sessionProjection } from "@packages/learning-core";
import { useStudy } from "../../data/StudyProvider";
import {
  Body,
  Button,
  Panel,
  Screen,
  Title,
  Loading,
} from "../../components/ui";
import { SentenceView } from "../../features/lessons/SentenceView";
import { LessonConversation } from "../../features/conversation/LessonConversation";
import { SentenceFeedback } from "../../features/lessons/SentenceFeedback";
import { AudioPlay } from "../../features/speech/AudioPlay";
import { lessonAudio } from "../../features/speech/lesson-audio";
export default function Reference() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const { events, checked, loading } = useStudy();
  const session = events.filter((event) => event.sessionId === sessionId);
  const started = session.find((event) => event.kind === "started");
  const context = started?.context;
  const projection = sessionProjection(requestsLesson, session, checked);
  if (loading) return <Loading label="Opening your saved reference…" />;
  if (
    !started ||
    started.lessonId !== requestsLesson.id ||
    started.lessonVersion !== requestsLesson.version
  )
    return (
      <Screen title="Your session reference">
        <Panel>
          <Body>
            This session reference is not available on this account. Open a
            saved lesson from Home.
          </Body>
          <Button label="Return" onPress={() => router.back()} />
        </Panel>
      </Screen>
    );
  return (
    <Screen title="Keep it with you." subtitle="Your session reference">
      <Panel>
        <Title>{requestsLesson.title}</Title>
        <Body>{context?.theme ?? "Everyday Japanese"}</Body>
        <Body>
          {projection.initiallyLearned.length} kanji introduced · grammar{" "}
          {projection.grammarState}. Speaking practice is tracked separately.
        </Body>
        {sessionId && (
          <LessonConversation
            sessionId={sessionId}
            theme={context?.theme ?? "Everyday Japanese"}
          />
        )}
      </Panel>
      {sessionId && <SentenceFeedback sessionId={sessionId} />}
      {requestsLesson.words.map((word) => (
        <Panel key={word.id}>
          <Title>
            {word.kanji} · {word.meaning}
          </Title>
          <Body>
            {word.word} · {word.reading}
            {context?.romaji ? ` · ${word.romaji[0]}` : ""}
          </Body>
          <Body>{word.mnemonic}</Body>
          <AudioPlay
            source={lessonAudio[`word-${word.id}`]!}
            label={`${word.word} word`}
            sessionId={sessionId}
          />
          <SentenceView
            sentence={word.example}
            romaji={context?.romaji ?? true}
            readings={context?.furigana ?? true}
            translation={context?.translations ?? true}
          />
          <AudioPlay
            source={lessonAudio[word.example.id]!}
            label={word.example.text}
            sessionId={sessionId}
          />
        </Panel>
      ))}
      <Panel>
        <Title>{requestsLesson.grammar.pattern}</Title>
        <Body>{requestsLesson.grammar.explanation}</Body>
        <Body>{requestsLesson.grammar.register}</Body>
        <Body>{requestsLesson.grammar.mistake}</Body>
        <Body muted>
          Original AI-assisted content, source-checked against Japan Foundation
          materials. Model audio has separate transcript and file checks; no
          native-speaker quality review is claimed.
        </Body>
        <Button label="Return" onPress={() => router.back()} />
      </Panel>
    </Screen>
  );
}
