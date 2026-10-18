import { Linking } from "react-native";
import { Body, Button, Panel, Screen, Title } from "../../components/ui";
export default function Sources() {
  return (
    <Screen title="Sources">
      <Panel>
        <Title>Japanese dictionary</Title>
        <Body>
          JMdict, KANJIDIC2 and KRADFILE are the property of Jim Breen and the
          Electronic Dictionary Research and Development Group. Selected
          vocabulary senses, kanji meanings/readings/stroke counts and component
          lookup data are used under CC BY-SA 4.0. Teaching examples and memory
          aids are separately authored.
        </Body>
        <Button
          label="JMdict documentation"
          secondary
          onPress={() =>
            void Linking.openURL(
              "https://www.edrdg.org/wiki/JMdict-EDICT_Dictionary_Project.html",
            )
          }
        />
        <Button
          label="Component lookup documentation"
          secondary
          onPress={() =>
            void Linking.openURL("https://www.edrdg.org/krad/kradinf.html")
          }
        />
        <Button
          label="KANJIDIC documentation"
          secondary
          onPress={() =>
            void Linking.openURL(
              "https://www.edrdg.org/wiki/index.php/KANJIDIC_Project",
            )
          }
        />
        <Button
          label="Dictionary licence and copyright"
          secondary
          onPress={() =>
            void Linking.openURL("https://www.edrdg.org/edrdg/licence.html")
          }
        />
        <Button
          label="CC BY-SA 4.0"
          secondary
          onPress={() =>
            void Linking.openURL(
              "https://creativecommons.org/licenses/by-sa/4.0/",
            )
          }
        />
      </Panel>
      <Panel>
        <Title>Kanji structure</Title>
        <Body>
          Component shapes and positions are adapted from KanjiVG by Ulrich Apel
          and contributors under CC BY-SA 3.0. Components describe visible
          structure, not a historical or pronunciation rule.
        </Body>
        <Button
          label="KanjiVG project"
          secondary
          onPress={() => void Linking.openURL("https://kanjivg.tagaini.net/")}
        />
        <Button
          label="CC BY-SA 3.0"
          secondary
          onPress={() =>
            void Linking.openURL(
              "https://creativecommons.org/licenses/by-sa/3.0/",
            )
          }
        />
      </Panel>
      <Panel>
        <Title>Radical reference</Title>
        <Body>
          Dictionary radical numbers were checked against Unicode 17.0 Unihan
          data. English radical labels are recognition aids, not Japanese
          vocabulary readings.
        </Body>
        <Button
          label="Unicode radical chart"
          secondary
          onPress={() =>
            void Linking.openURL("https://www.unicode.org/charts/PDF/U2F00.pdf")
          }
        />
      </Panel>
    </Screen>
  );
}
