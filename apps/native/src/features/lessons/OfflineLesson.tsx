import { Body, Button, Panel, Title } from "../../components/ui";
import { useContent } from "../../data/ContentProvider";
export function OfflineLesson() {
  const content = useContent();
  return (
    <Panel>
      <Title>Study without a connection</Title>
      <Body>
        {content.loading
          ? "Checking saved content on this phone…"
          : content.ready
            ? "Downloaded · A polite request, its exercises and references, and all 11 model-audio clips."
            : "Checked lesson text, exercises and saved answers work on this phone. Prepare all 11 audio clips for reliable offline listening too (about 0.8 MB)."}
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
