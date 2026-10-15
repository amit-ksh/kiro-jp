import { router } from "expo-router";
import { lessonCatalog, curriculum, preparedLessons } from "@packages/content";
import { Body, Button, Panel, Screen, Title } from "../../../components/ui";
import { OfflineLesson } from "../../../features/lessons/OfflineLesson";
export default function Lessons() {
  return (
    <Screen
      title="Language you can use."
      subtitle="Focused N5/N4 starter lessons"
    >
      <Panel>
        <Body>
          {preparedLessons.length} starter lessons connect words, grammar and conversation. Choose a situation to practise.
        </Body>
      </Panel>
      {preparedLessons.map(lesson=><OfflineLesson key={`${lesson.id}:${lesson.version}`} lessonId={lesson.id} version={lesson.version}/>)}
      <Panel>
        <Title>Grammar reference</Title>
        <Body>
          Find a useful pattern, read its explanation and replay checked
          examples.
        </Body>
        <Button
          label="Search grammar"
          secondary
          onPress={() => router.push("/(learning)/grammar")}
        />
      </Panel>
      {lessonCatalog.map((lesson) => (
        <Panel key={lesson.id}>
          <Title>{lesson.title}</Title>
          <Body>
            {lesson.kanji.join(" · ")} · {lesson.pattern}
          </Body>
          <Body muted>{lesson.outcome}</Body>
          <Button
            label={
              curriculum.get(lesson.id) ? lesson.id === "requests" ? "Learn a polite request" : `Open ${lesson.title}` : "Preview upcoming lesson"
            }
            secondary
            onPress={() =>
              router.push({
                pathname: "/(learning)/session-preview",
                params: { lessonId: lesson.id },
              })
            }
          />
        </Panel>
      ))}
    </Screen>
  );
}
