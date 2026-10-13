import { router, useLocalSearchParams } from "expo-router";
import { requestsLesson } from "@packages/content";
import { sessionProjection } from "@packages/learning-core";
import { useStudy } from "../../data/StudyProvider";
import { Body, Button, Panel, Screen, Title } from "../../components/ui";
import { SentenceView } from "../../features/lessons/SentenceView";
export default function Reference() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>(); const { events } = useStudy(); const session = events.filter(event => event.sessionId === sessionId); const context = session.find(event => event.kind === "started")?.context;
  const projection = sessionProjection(requestsLesson, session);
  return <Screen title="Keep it with you." subtitle="Your session reference"><Panel><Title>{requestsLesson.title}</Title><Body>{context?.theme ?? "Everyday Japanese"}</Body><Body>{projection.initiallyLearned.length} kanji introduced · grammar {projection.grammarState}. Speaking and the conversation goal remain unpractised.</Body></Panel>{requestsLesson.words.map(word => <Panel key={word.id}><Title>{word.kanji} · {word.meaning}</Title><Body>{word.word} · {word.reading}{context?.romaji ? ` · ${word.romaji[0]}` : ""}</Body><Body>{word.mnemonic}</Body><SentenceView sentence={word.example} romaji={context?.romaji ?? true} readings={context?.furigana ?? true} translation={context?.translations ?? true}/></Panel>)}<Panel><Title>{requestsLesson.grammar.pattern}</Title><Body>{requestsLesson.grammar.explanation}</Body><Body>{requestsLesson.grammar.register}</Body><Body>{requestsLesson.grammar.mistake}</Body><Body muted>Original AI-assisted content, source-checked against Japan Foundation materials. Audio is not yet available for these lesson examples.</Body><Button label="Return" onPress={() => router.back()}/></Panel></Screen>;
}
