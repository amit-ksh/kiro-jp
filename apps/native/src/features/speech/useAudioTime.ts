import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { splitStudySpan } from "@packages/learning-core";
import { useStudy } from "../../data/StudyProvider";
// Clock only the actual foreground playback/recording interval, not an idle window.
export function useAudioTime(
  sessionId: string,
  mode: "listening" | "speaking",
  running: boolean,
  conversation = false,
  limitMillis = 30000,
  reference = false,
) {
  const { append } = useStudy(),
    focused = useIsFocused(),
    latest = useRef(append);
  const limit = useRef(limitMillis);
  limit.current = limitMillis;
  latest.current = append;
  useEffect(() => {
    if (!running || !focused || AppState.currentState !== "active") return;
    let wall = Date.now(),
      mono = performance.now(),
      foreground = true,
      remaining = Math.min(30000, Math.max(0, limit.current));
    const flush = () => {
      const now = performance.now(),
        milliseconds = Math.min(remaining, 10000, Math.max(0, now - mono));
      if (foreground && milliseconds > 0) {
        remaining -= milliseconds;
        const start = wall;
        void latest
          .current({
            sessionId,
            kind: "audioActivity",
            stepId: reference ? "reference" : conversation ? "chat" : "recap",
            input: mode,
            spans: splitStudySpan(
              start,
              start + milliseconds,
              new Date(start).getTimezoneOffset(),
            ),
          })
          .catch(() => {});
      }
      wall = Date.now();
      mono = now;
    };
    const timer = setInterval(flush, 5000),
      listener = AppState.addEventListener("change", (state) => {
        flush();
        foreground = state === "active";
      });
    return () => {
      flush();
      clearInterval(timer);
      listener.remove();
    };
  }, [sessionId, mode, running, focused, conversation, reference]);
}
