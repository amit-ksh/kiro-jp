import { useEffect, useMemo, useState } from "react";
import { AppState } from "react-native";
import { curriculum } from "@packages/content";
import { learningProgress, localDayAt } from "@packages/learning-core";
import { useStudy } from "../../data/StudyProvider";
import { useReviews } from "../../data/ReviewProvider";
import { useProfile } from "../../data/ProfileProvider";

export function useLearningProgress() {
  const study = useStudy(),
    reviews = useReviews(),
    { profile } = useProfile();
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    const listener = AppState.addEventListener("change", (state) => {
      if (state === "active") setNow(Date.now());
    });
    return () => {
      clearInterval(timer);
      listener.remove();
    };
  }, []);
  const today = localDayAt(now, new Date(now).getTimezoneOffset());
  const result = useMemo(
    () =>
      learningProgress({
        today,
        dailyMinutes: profile.dailyMinutes,
        events: study.events,
        checked: study.checked,
        curriculum,
        reviews,
      }),
    [today, profile.dailyMinutes, study.events, study.checked, reviews],
  );
  return {
    ...result,
    dailyMinutes: profile.dailyMinutes,
    loading: study.loading || reviews.loading,
  };
}
