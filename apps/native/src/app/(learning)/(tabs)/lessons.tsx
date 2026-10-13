import { router } from "expo-router";
import { lessonCatalog } from "@packages/content";
import { Body, Button, Panel, Screen, Title } from "../../../components/ui";
export default function Lessons() { return <Screen title="Language you can use." subtitle="Focused N5/N4 starter lessons"><Panel><Body>This is the planned starter inventory. Exercise content is being added in the next build steps.</Body></Panel>{lessonCatalog.map(lesson => <Panel key={lesson.id}><Title>{lesson.title}</Title><Body>{lesson.kanji.join(" · ")} · {lesson.pattern}</Body><Body muted>{lesson.outcome}</Body><Button label="View session preview" secondary onPress={() => router.push({ pathname: "/(learning)/session-preview", params: { lessonId: lesson.id } })}/></Panel>)}</Screen>; }
