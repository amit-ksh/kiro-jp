import { useLocalSearchParams, router } from "expo-router";
import { grammarReferences } from "@packages/content";
import { useProfile } from "../../../data/ProfileProvider";
import { Body, Button, Panel, Screen, Title } from "../../../components/ui";
import { SentenceView } from "../../../features/lessons/SentenceView";
import { AudioPlay } from "../../../features/speech/AudioPlay";
import { lessonAudio } from "../../../features/speech/lesson-audio";
export default function GrammarDetail() {
  const { id } = useLocalSearchParams<{ id: string }>(),
    { profile } = useProfile();
  const entry = grammarReferences.find((entry) => entry.id === id);
  if (!entry)
    return (
      <Screen title="Grammar reference">
        <Panel>
          <Body>
            This checked pattern is not available in this app version.
          </Body>
          <Button
            label="Show available patterns"
            onPress={() => router.replace("/(learning)/grammar")}
          />
        </Panel>
      </Screen>
    );
  const { lesson } = entry,
    grammar = lesson.grammar;
  return (
    <Screen
      title={grammar.pattern}
      subtitle={`${entry.level} starter · ${lesson.title}`}
    >
      <Panel>
        <Title>{lesson.outcome}</Title>
        <Body>{grammar.explanation}</Body>
      </Panel>
      <Panel>
        <Title>When it fits</Title>
        <Body>{grammar.register}</Body>
        <Title>A common mistake</Title>
        <Body>{grammar.mistake}</Body>
      </Panel>
      {grammar.examples.map((sentence) => (
        <Panel key={sentence.id}>
          <SentenceView
            sentence={sentence}
            romaji={profile.romaji}
            readings={profile.furigana}
            translation={profile.translations}
            grammarLinks={false}
          />
          {lesson.id === "requests" &&
          lesson.version === 1 &&
          lessonAudio[sentence.id] ? (
            <AudioPlay
              source={lessonAudio[sentence.id]}
              label={sentence.text}
              sessionId={`library-${lesson.id}-v${lesson.version}`}
              libraryClipId={`${lesson.id}:${lesson.version}:${sentence.id}`}
            />
          ) : (
            <Body muted>
              Model audio is unavailable for this example. Its reading and
              explanation remain available.
            </Body>
          )}
        </Panel>
      ))}
      <Panel>
        <Body muted>
          Original explanations checked against Japan Foundation materials.
          These examples are for learning; replaying them does not demonstrate
          the pattern or assess speaking.
        </Body>
        <Button
          label="Practise in a lesson"
          onPress={() =>
            router.push({
              pathname: "/(learning)/session-preview",
              params: { lessonId: lesson.id },
            })
          }
        />
      </Panel>
      <Button
        label="Return"
        secondary
        onPress={() => router.back()}
      />
    </Screen>
  );
}
