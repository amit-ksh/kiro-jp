import { useState } from "react";
import { Keyboard } from "react-native";
import { router } from "expo-router";
import { grammarReferences } from "@packages/content";
import { searchGrammarReferences } from "@packages/learning-core";
import {
  Body,
  Button,
  Field,
  Panel,
  Screen,
  Title,
} from "../../../components/ui";
export default function GrammarLibrary() {
  const [query, setQuery] = useState("");
  const results = searchGrammarReferences(grammarReferences, query);
  return (
    <Screen title="Find the pattern." subtitle="Your checked grammar reference">
      <Panel>
        <Field
          label="Search grammar"
          placeholder="Try ください, polite request or N5"
          value={query}
          onChangeText={setQuery}
          maxLength={120}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
        <Body muted>
          {grammarReferences.length} checked{" "}
          {grammarReferences.length === 1 ? "pattern" : "patterns"} available
          offline. More starter patterns will appear as their content checks are
          completed.
        </Body>
        {query && (
          <Button label="Clear search" secondary onPress={() => setQuery("")} />
        )}
      </Panel>
      {results.map((entry) => (
        <Panel key={entry.id}>
          <Title>{entry.lesson.grammar.pattern}</Title>
          <Body>
            {entry.level} starter · {entry.lesson.title}
          </Body>
          <Body>{entry.lesson.outcome}</Body>
          <Button
            label={`Open ${entry.lesson.title}`}
            secondary
            onPress={() => {
              Keyboard.dismiss();
              router.push({
                pathname: "/(learning)/grammar/[id]",
                params: { id: entry.id },
              });
            }}
          />
        </Panel>
      ))}
      {!results.length && (
        <Panel>
          <Title>No checked pattern found</Title>
          <Body>
            Try a Japanese form, an English purpose or a level. This starter
            library is still growing; a missing result does not mean the
            Japanese is incorrect.
          </Body>
          <Button
            label="Show available patterns"
            secondary
            onPress={() => setQuery("")}
          />
        </Panel>
      )}
      <Button
        label="Return"
        secondary
        onPress={() => router.back()}
      />
    </Screen>
  );
}
