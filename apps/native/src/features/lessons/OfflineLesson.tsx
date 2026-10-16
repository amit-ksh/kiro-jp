import { Body, Button, Panel, Title } from "../../components/ui";
import { View } from "react-native";
import { useContent } from "../../data/ContentProvider";
export function OfflineLesson({
  lessonId = "requests",
  version = 1,
  inline = false,
}: {
  lessonId?: string;
  version?: number;
  inline?: boolean;
}) {
  const content = useContent(lessonId, version);
  const audioCount = content.manifest.assets.filter(
    (asset) => asset.kind === "audio",
  ).length;
  const megabytes = (
    content.manifest.assets.reduce((total, asset) => total + asset.bytes, 0) /
    1_000_000
  ).toFixed(1);
  const controls = (
    <>
      <Body>
        {content.loading
          ? "Checking download…"
          : content.ready
            ? "Downloaded"
            : `${audioCount} audio · ${megabytes} MB`}
      </Body>
      {content.busy ? (
        <>
          <Body>
            {content.progress} / {content.total}
          </Body>
          <Button label="Cancel download" secondary onPress={content.cancel} />
        </>
      ) : (
        <Button
          label={content.ready ? "Refresh download" : "Download"}
          secondary
          disabled={content.loading || !content.online}
          onPress={() => void content.prepare()}
        />
      )}
      {!content.online && <Body muted>Offline</Body>}
      {content.error && <Body>{content.error}</Body>}
    </>
  );
  return inline ? (
    <View style={{ gap: 8 }}>{controls}</View>
  ) : (
    <Panel>
      <Title>Offline study</Title>
      {controls}
    </Panel>
  );
}
