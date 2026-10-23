import { useCallback, useEffect, useState } from "react";
import { AppState, Pressable, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect } from "expo-router";
import {
  useAudioPlayer,
  useAudioPlayerStatus,
  setAudioModeAsync,
  type AudioSource,
} from "expo-audio";
import { Body, Button, useColors } from "../../components/ui";
import { useAudioTime } from "./useAudioTime";
import { registerPlayer, stopAudioPlayers } from "./audio-focus";
import { useSpeech } from "./SpeechProvider";
import { persistentAudioSource } from "./lesson-audio";
export function AudioPlay({
  source,
  label,
  sessionId,
  conversation = false,
  reference = false,
  reviewTrackId,
  libraryClipId,
  compact = false,
}: {
  source: AudioSource;
  label: string;
  sessionId: string;
  conversation?: boolean;
  reference?: boolean;
  reviewTrackId?: string;
  libraryClipId?: string;
  compact?: boolean;
}) {
  const colors = useColors();
  const player = useAudioPlayer(null, { updateInterval: 100 }),
    status = useAudioPlayerStatus(player),
    speech = useSpeech();
  const [completed, setCompleted] = useState(false),
    [availableOffline, setAvailableOffline] = useState(false);
  useEffect(() => {
    if (status.didJustFinish) setCompleted(true);
  }, [status.didJustFinish]);
  const [error, setError] = useState(""),
    [slow, setSlow] = useState(false);
  const [retry, setRetry] = useState(0),
    sourceKey = JSON.stringify(source);
  useEffect(() => {
    let active = true;
    setError("");
    void persistentAudioSource(source)
      .then((local) => {
        if (active) {
          player.replace(local);
          setAvailableOffline(typeof source === "number");
        }
      })
      .catch(() => {
        if (active)
          setError(
            "Audio is unavailable. Reconnect and retry, or keep practising with the visible reading.",
          );
      });
    return () => {
      active = false;
    };
    // Source identity is the serialized module/URI, independent of render allocation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceKey, player, retry]);
  useAudioTime(
    sessionId,
    "listening",
    status.playing && !status.isBuffering && !speech.recording,
    conversation,
    (Math.max(0, status.duration - status.currentTime) * 1000) /
      (slow ? 0.75 : 1),
    reference,
    reviewTrackId,
    libraryClipId,
  );
  useEffect(() => registerPlayer(player), [player]);
  useFocusEffect(
    useCallback(
      () => () => {
        try {
          player.pause();
        } catch {}
      },
      [player],
    ),
  );
  useEffect(() => {
    const listener = AppState.addEventListener("change", (state) => {
      if (state !== "active") player.pause();
    });
    return () => listener.remove();
  }, [player]);
  const play = () => {
    setError("");
    setCompleted(false);
    if (status.playing) {
      player.pause();
      return;
    }
    stopAudioPlayers(player);
    void setAudioModeAsync({
      playsInSilentMode: true,
      allowsRecording: false,
      shouldPlayInBackground: false,
      interruptionMode: "doNotMix",
    })
      .then(() => player.seekTo(0))
      .then(() => {
        player.setPlaybackRate(slow ? 0.75 : 1);
        player.play();
      })
      .catch(() =>
        setError(
          "Audio couldn't play. The reading and explanation are still available.",
        ),
      );
  };
  const toggleSpeed = () => {
    try {
      player.setPlaybackRate(slow ? 1 : 0.75);
      setSlow(!slow);
    } catch {
      setError(
        "Slower playback is unavailable. Try normal playback or continue reading.",
      );
    }
  };
  if (compact)
    return (
      <View style={{ gap: 10 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: 8,
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              slow ? "Use normal playback" : "Use slower playback"
            }
            accessibilityState={{ disabled: speech.recording }}
            disabled={speech.recording}
            onPress={toggleSpeed}
            style={({ pressed }) => ({
              minWidth: 48,
              minHeight: 48,
              alignItems: "center",
              justifyContent: "center",
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Text
              style={{
                color: colors.studyMuted,
                fontSize: 14,
                fontWeight: "600",
              }}
            >
              {slow ? "0.75×" : "1×"}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              status.playing ? `Stop ${label}` : `Play ${label}`
            }
            accessibilityState={{
              disabled: speech.recording || !status.isLoaded,
            }}
            disabled={speech.recording || !status.isLoaded}
            onPress={play}
            style={({ pressed }) => ({
              width: 52,
              height: 52,
              borderRadius: 26,
              backgroundColor: colors.secondary,
              alignItems: "center",
              justifyContent: "center",
              opacity:
                speech.recording || !status.isLoaded ? 0.45 : pressed ? 0.7 : 1,
            })}
          >
            <Ionicons
              name={status.playing ? "pause" : "play"}
              size={23}
              color={colors.onSecondary}
            />
          </Pressable>
        </View>
        {error && (
          <>
            <Text
              accessibilityLiveRegion="polite"
              style={{ color: colors.studyInk, fontSize: 15, lineHeight: 23 }}
            >
              {error}
            </Text>
            <Button
              secondary
              label={`Retry ${label}`}
              disabled={speech.recording}
              onPress={() => setRetry((value) => value + 1)}
            />
          </>
        )}
      </View>
    );
  return (
    <>
      <Button
        label={status.playing ? `Stop ${label}` : `Play ${label}`}
        secondary
        disabled={speech.recording || !status.isLoaded}
        onPress={play}
      />
      <Button
        label={slow ? "Use normal playback" : "Use slower playback"}
        secondary
        disabled={speech.recording}
        onPress={toggleSpeed}
      />
      {status.playing && (
        <Body muted>
          {Math.min(status.currentTime, status.duration).toFixed(1)} /{" "}
          {status.duration.toFixed(1)} seconds
        </Body>
      )}
      {error && <Body>{error}</Body>}
      {error && (
        <Button
          label={`Retry ${label}`}
          secondary
          disabled={speech.recording}
          onPress={() => setRetry((value) => value + 1)}
        />
      )}
      {completed && (
        <Body muted>
          Playback completed · {status.duration.toFixed(1)} seconds
        </Body>
      )}
      {availableOffline && (
        <Body muted>Model audio saved for offline practice.</Body>
      )}
    </>
  );
}
