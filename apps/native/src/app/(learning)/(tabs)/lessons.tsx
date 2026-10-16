import { router } from "expo-router";
import { lessonCatalog, curriculum } from "@packages/content";
import { Body, Panel, Screen } from "../../../components/ui";
import { ActionRow } from "../../../components/dashboard";
import { OfflineLesson } from "../../../features/lessons/OfflineLesson";
export default function Lessons() {
  return (
    <Screen title="Lessons">
      <Panel>
        <ActionRow
          label="Grammar reference"
          onPress={() => router.push("/(learning)/grammar")}
        />
      </Panel>
      {lessonCatalog.map((lesson) => (
        <Panel key={lesson.id} style={{ padding: 20, gap: 10 }}>
          <ActionRow
            label={lesson.title}
            detail={lesson.pattern}
            onPress={() =>
              router.push({
                pathname: "/(learning)/session-preview",
                params: { lessonId: lesson.id },
              })
            }
          />
          <Body>{lesson.kanji.join("  ")}</Body>
          <OfflineLesson
            inline
            lessonId={lesson.id}
            version={curriculum.get(lesson.id)!.version}
          />
        </Panel>
      ))}
    </Screen>
  );
}
