import { router } from "expo-router";
import { starterLevels } from "@packages/content";
import { Text, View } from "react-native";
import { Body, Panel, Screen, useColors } from "../../../components/ui";
import { ActionRow } from "../../../components/dashboard";
import { useLearningProgress } from "../../../features/profile/useLearningProgress";
export default function Lessons() {
  const progress=useLearningProgress(),colors=useColors();
  return (
    <Screen title="Lessons" subtitle="Your starter levels">
      <Panel>
        <ActionRow
          label="Grammar reference"
          onPress={() => router.push("/(learning)/grammar")}
        />
      </Panel>
      {starterLevels.map((level) => (
        <Panel key={level.number} style={{ padding: 20, gap: 10 }}>
          <View style={{flexDirection:"row",gap:14,alignItems:"center"}}><View style={{width:52,height:52,borderRadius:14,backgroundColor:colors.primary,alignItems:"center",justifyContent:"center"}}><Text style={{fontSize:24,fontWeight:"700",color:colors.onPrimary}}>{level.number}</Text></View><View style={{flex:1}}>
          <ActionRow
            label={`Level ${level.number}`}
            detail={`${level.jlpt} · ${level.title}`}
            onPress={() =>
              router.push({
                pathname: "/(learning)/level",
                params: { level: String(level.number) },
              })
            }
          />
          </View></View>
          <Body style={{fontSize:28,lineHeight:40}}>{level.kanji.join("  ")}</Body>
          <Body muted>{level.radicals.length} radicals · {level.kanji.length} kanji · {level.lesson.words.length} words</Body>
          <Body muted>{level.kanji.filter(kanji=>progress.inventory.kanji.includes(kanji)).length}/{level.kanji.length} kanji introduced</Body>
        </Panel>
      ))}
    </Screen>
  );
}
