import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AppState } from "react-native";
import { router } from "expo-router";
import { curriculum } from "@packages/content";
import {
  reminderClock,
  hasCompletedReminderSession,
  type ReminderStatus,
} from "@packages/learning-core";
import { useProfile } from "../../data/ProfileProvider";
import { useStudy } from "../../data/StudyProvider";
import {
  notificationModule,
  prepareReminderPermission,
  studyReminderId,
  studyReminders,
} from "./nativeReminders";

type State = {
  eligible: boolean;
  status: ReminderStatus | "checking" | "unavailable";
  busy: boolean;
  error: string;
  enable: (time: string) => Promise<boolean>;
  disable: () => Promise<boolean>;
  saveTime: (time: string) => Promise<boolean>;
  skip: () => Promise<boolean>;
  retry: () => void;
};
const Context = createContext<State | null>(null);
function timezoneKey() {
  return `${Intl.DateTimeFormat().resolvedOptions().timeZone}:${new Date().getTimezoneOffset()}`;
}
export function ReminderProvider({ children }: { children: ReactNode }) {
  const { profile, update, loading: profileLoading } = useProfile();
  const study = useStudy();
  const [status, setStatus] = useState<State["status"]>("checking");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const leaseRef = useRef<ReturnType<typeof studyReminders.acquire> | null>(
    null,
  );
  const active = useRef(false);
  const [zone, setZone] = useState(timezoneKey);
  const [retryCount, setRetryCount] = useState(0);
  const eligible = useMemo(() => {
    const ended = new Set(
      Object.values(study.chats).flatMap((chat) =>
        chat.segments
          .filter(
            (segment) => segment.state === "ended" && segment.lessonSessionId,
          )
          .map((segment) => segment.lessonSessionId!),
      ),
    );
    return hasCompletedReminderSession(
      study.events,
      ended,
      (event) => curriculum.forEvent(event),
      study.checked,
    );
  }, [study.events, study.chats, study.checked]);
  useEffect(() => {
    active.current = true;
    const lease = studyReminders.acquire();
    leaseRef.current = lease;
    const listener = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        setZone(timezoneKey());
        setRetryCount((value) => value + 1);
      }
    });
    const timer = setInterval(() => setZone(timezoneKey()), 60_000);
    let subscription: { remove: () => void } | undefined;
    void notificationModule()
      .then((notifications) => {
        if (!active.current || leaseRef.current !== lease) return;
        const openHome = (id: string) => {
          if (active.current && id === studyReminderId)
            router.push("/(learning)/(tabs)");
        };
        const previous = notifications.getLastNotificationResponse();
        if (previous) {
          openHome(previous.notification.request.identifier);
          notifications.clearLastNotificationResponse();
        }
        subscription = notifications.addNotificationResponseReceivedListener(
          (response) => {
            openHome(response.notification.request.identifier);
          },
        );
      })
      .catch(() => {});
    return () => {
      active.current = false;
      listener.remove();
      clearInterval(timer);
      subscription?.remove();
      if (leaseRef.current === lease) leaseRef.current = null;
      void lease.dispose().catch(() => {});
    };
  }, [study.accountId]);
  useEffect(() => {
    if (profileLoading || study.loading || !leaseRef.current) return;
    let current = true;
    setStatus("checking");
    void leaseRef.current
      .reconcile(
        eligible && profile.reminderEnabled,
        profile.reminderTime ?? "20:00",
      )
      .then((result) => {
        if (current) {
          setStatus(result);
          setError("");
        }
      })
      .catch(() => {
        if (current) {
          setStatus("unavailable");
          setError(
            "The reminder couldn't be scheduled on this phone. Your study progress is safe. Try again or turn reminders off.",
          );
        }
      });
    return () => {
      current = false;
    };
  }, [
    eligible,
    profile.reminderEnabled,
    profile.reminderTime,
    profileLoading,
    study.loading,
    zone,
    retryCount,
  ]);
  const operate = useCallback(async (work: () => Promise<void | boolean>) => {
    if (busyRef.current) return false;
    busyRef.current = true;
    setBusy(true);
    setError("");
    try {
      return (await work()) !== false;
    } catch {
      if (active.current) {
        setStatus("unavailable");
        setError(
          "The reminder couldn't be updated on this phone. Your study progress is safe. Please try again.",
        );
      }
      return false;
    } finally {
      busyRef.current = false;
      if (active.current) setBusy(false);
    }
  }, []);
  const clockOrThrow = (time: string) => {
    if (!reminderClock(time)) throw new Error("Use HH:MM in 24-hour time.");
  };
  const state: State = {
    eligible,
    status,
    busy,
    error,
    enable: (time) =>
      operate(async () => {
        clockOrThrow(time);
        if (!eligible)
          throw new Error("Complete your first learning session first.");
        const lease = leaseRef.current;
        if (!(await prepareReminderPermission(true))) {
          if (active.current && leaseRef.current === lease)
            setStatus("permission-needed");
          return false;
        }
        if (!active.current || leaseRef.current !== lease) return false;
        await update({
          reminderEnabled: true,
          reminderTime: time,
          reminderOfferDismissed: true,
        });
        if (active.current) setRetryCount((value) => value + 1);
      }),
    disable: () =>
      operate(async () => {
        await update({ reminderEnabled: false, reminderOfferDismissed: true });
        await leaseRef.current?.reconcile(false, "20:00");
        if (active.current) setRetryCount((value) => value + 1);
      }),
    saveTime: (time) =>
      operate(async () => {
        clockOrThrow(time);
        await update({ reminderTime: time });
        if (active.current) setRetryCount((value) => value + 1);
      }),
    skip: () => operate(() => update({ reminderOfferDismissed: true })),
    retry: () => setRetryCount((value) => value + 1),
  };
  return <Context.Provider value={state}>{children}</Context.Provider>;
}
export function useReminders() {
  const state = useContext(Context);
  if (!state) throw new Error("ReminderProvider is required.");
  return state;
}
