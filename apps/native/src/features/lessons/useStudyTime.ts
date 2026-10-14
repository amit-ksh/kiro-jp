import { useCallback, useEffect, useRef } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "expo-router";
import { splitStudySpan } from "@packages/learning-core";
import { useStudy } from "../../data/StudyProvider";
// Interaction opens a bounded reading/thinking window. Route opening earns no time.
export function useStudyTime(sessionId: string, stepId: string, kind: "activity" | "conversationActivity" = "activity") {
  const { append } = useStudy(); const current = useRef({ sessionId, stepId, append, kind }); current.current = { sessionId, stepId, append, kind };
  const clock = useRef({ last: 0, until: 0, wall: 0, focused: false, foreground: AppState.currentState === "active" });
  const flush = useCallback(() => {
    const state = clock.current, now = performance.now(), end = Math.min(now, state.until);
    if (state.focused && state.foreground && state.last && end > state.last) {
      const milliseconds = Math.min(15_000, end - state.last), start = state.wall, finish = start + milliseconds;
      const spans = splitStudySpan(start, finish, new Date(start).getTimezoneOffset());
      void current.current.append({ sessionId: current.current.sessionId, kind: current.current.kind, stepId: current.current.stepId, spans }).catch(() => {});
    }
    state.last = now; state.wall = Date.now();
  }, []);
  const interact = useCallback(() => { flush(); const state = clock.current; state.last = performance.now(); state.wall = Date.now(); state.until = state.last + 30_000; }, [flush]);
  const pause = useCallback(() => { flush(); clock.current.until = 0; }, [flush]);
  useFocusEffect(useCallback(() => { clock.current.focused = true; const timer = setInterval(flush, 15_000); return () => { flush(); clock.current.focused = false; clock.current.until = 0; clearInterval(timer); }; }, [flush]));
  useEffect(() => { const listener = AppState.addEventListener("change", state => { if (clock.current.foreground) flush(); clock.current.foreground = state === "active"; clock.current.until = 0; }); return () => listener.remove(); }, [flush]);
  return { interact, pause };
}
