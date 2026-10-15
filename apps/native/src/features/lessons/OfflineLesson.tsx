import { Body, Button, Panel, Title } from "../../components/ui";
import { useContent } from "../../data/ContentProvider";
export function OfflineLesson({
  lessonId = "requests",
  version = 1,
}: {
  lessonId?: string;
  version?: number;
}) {
  const content = useContent(lessonId, version);
  const audioCount = content.manifest.assets.filter(
    (asset) => asset.kind === "audio",
  ).length;
  const megabytes = (
    content.manifest.assets.reduce((total, asset) => total + asset.bytes, 0) /
    1_000_000
  ).toFixed(1);
  return (
    <Panel>
      <Title>Study without a connection</Title>
      <Body>
        {content.loading
          ? "Checking saved content on this phone…"
          : content.ready
            ? `Downloaded · ${content.manifest.title}, its exercises and references, and all ${audioCount} model-audio clips.`
            : `${content.manifest.title}: checked text, exercises and saved answers work on this phone. Prepare all ${audioCount} audio clips for reliable offline listening too (about ${megabytes} MB).`}
      </Body>
      {content.busy ? (
        <>
          <Body>
            Preparing {content.progress} of {content.total} checked files. The
            previous ready package stays available.
          </Body>
          <Button
            label="Cancel preparation"
            secondary
            onPress={content.cancel}
          />
        </>
      ) : (
        <Button
          label={
            content.ready
              ? "Check and prepare again"
              : "Prepare lesson for offline study"
          }
          secondary
          disabled={content.loading || !content.online}
          onPress={() => void content.prepare()}
        />
      )}
      {!content.online && (
        <Body muted>
          You are offline. Continue with prepared text, downloaded audio and
          saved reviews. New AI replies and automatic transcripts need a
          connection.
        </Body>
      )}
      {content.error && <Body>{content.error}</Body>}
    </Panel>
  );
}
