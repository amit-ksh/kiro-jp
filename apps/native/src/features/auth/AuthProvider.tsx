import { ConvexAuthProvider, useAuthToken, useConvexAuth } from "@convex-dev/auth/react";
import { ConvexReactClient, useConvexAuth as useServerAuth, useConvexConnectionState, useQuery } from "convex/react";
import * as SecureStore from "expo-secure-store";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AppState } from "react-native";
import { api } from "@packages/backend/convex/_generated/api";
import { accountCacheAccess, localAccountFromToken, localSessionFromToken } from "@packages/learning-core";
import { ProfileProvider } from "../../data/ProfileProvider";
import { StudyProvider } from "../../data/StudyProvider";
import { ReviewProvider } from "../../data/ReviewProvider";
import { Loading, Panel, Body, Screen, Button } from "../../components/ui";
import { authNamespace, clearUsableTokens, flushRevocations, queueRevocation } from "./revocations";
import { studyReminders } from "../reminders/nativeReminders";
import { quarantineAccountDatabase } from "../../data/database";

const url = process.env.EXPO_PUBLIC_CONVEX_URL;
const Control = createContext<((token: string | null, deleted?: boolean) => Promise<void>) | null>(null);
function SessionRuntime({ changed }: { changed: (session: string | null) => void }) {
  const token = useAuthToken();
  const { isLoading } = useConvexAuth();
  const session = localSessionFromToken(token, process.env.EXPO_PUBLIC_CONVEX_SITE_URL ?? "");
  useEffect(() => { if (!isLoading) changed(session); }, [session, isLoading, changed]);
  useEffect(() => { if (!isLoading && !session) void studyReminders.retire().catch(() => {}); }, [isLoading, session]);
  return null;
}
export function AuthProvider({ children }: { children: ReactNode }) {
  const [generation, setGeneration] = useState(0); const [signingOut, setSigningOut] = useState(false);
  const retired = useRef(false);
  const storageWrites = useRef(Promise.resolve());
  const previousSession = useRef<string | null>(null);
  const runtime = useMemo(() => ({ id: generation, closeTimer: null as ReturnType<typeof setTimeout> | null, client: url ? new ConvexReactClient(url, { unsavedChangesWarning: false, logger: false }) : null }), [generation]);
  const convex = runtime.client;
  const storage = useMemo(() => { const guard = { active: true, generation }; retired.current = false;
    const write = (fn: () => Promise<void>) => { const next = storageWrites.current.then(async () => { if (guard.active && !retired.current) await fn(); }); storageWrites.current = next.catch(() => {}); return next; };
    return { guard, getItem: SecureStore.getItemAsync, setItem: (key: string, value: string) => write(() => SecureStore.setItemAsync(key, value)), removeItem: (key: string) => write(() => SecureStore.deleteItemAsync(key)) };
  }, [generation]);
  const sessionChanged = useCallback((session: string | null) => {
    const previous = previousSession.current;
    previousSession.current = session;
    // Auth 0.0.96 keeps fetchAccessToken stable for authenticated replacements.
    // New tokens are already durably stored; retire old writers before remount.
    if (previous && session && previous !== session) {
      storage.guard.active = false;
      setGeneration(value => value + 1);
    }
  }, [storage]);
  useEffect(() => { void flushRevocations(); const listener = AppState.addEventListener("change", state => { if (state === "active") void flushRevocations(); }); return () => listener.remove(); }, []);
  useEffect(() => {
    if (runtime.closeTimer) clearTimeout(runtime.closeTimer);
    runtime.closeTimer = null;
    storage.guard.active = true;
    return () => {
      storage.guard.active = false;
      // React can release and immediately reacquire this runtime in StrictMode.
      // Only close after that replay window has passed without reacquisition.
      runtime.closeTimer = setTimeout(() => { void runtime.client?.close(); }, 0);
    };
  }, [runtime, storage]);
  if (!convex) return <Screen title="Japanese Learning App"><Panel><Body>The Android configuration is not ready. Run pnpm config:local using your private environment file, then restart the development build.</Body></Panel></Screen>;
  const immediateSignOut = async (token: string | null, deleted = false) => {
    // Invalidate in-flight schedules before clearing identity or unmounting.
    await studyReminders.retire();
    previousSession.current = null;
    retired.current = true; storage.guard.active = false; setSigningOut(true);
    try { await storageWrites.current; if (!deleted) await queueRevocation(token); }
    finally { await clearUsableTokens(); setGeneration(value => value + 1); setSigningOut(false); void flushRevocations(); }
  };
  return <Control.Provider value={immediateSignOut}>{signingOut ? <Loading label="Signing out on this phone…"/> : <ConvexAuthProvider key={generation} client={convex} storage={storage} shouldHandleCode={false}><SessionRuntime changed={sessionChanged}/>{children}</ConvexAuthProvider>}</Control.Provider>;
}
export function LearningAccount({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const server = useServerAuth(); const token = useAuthToken();
  const connection = useConvexConnectionState();
  const signOut = useSignOut();
  const current = useQuery(api.account.current, server.isAuthenticated ? {} : "skip");
  const subject = localAccountFromToken(token, process.env.EXPO_PUBLIC_CONVEX_SITE_URL ?? "");
  const [remembered, setRemembered] = useState<{ accountId: string } | null | undefined>(undefined);
  const key = `learning-identity-${authNamespace}-${subject ?? "none"}`;
  useEffect(() => { let active = true; setRemembered(undefined); void SecureStore.getItemAsync(key).then(value => { if (active) setRemembered(value ? JSON.parse(value) : null); }).catch(() => { if (active) setRemembered(null); }); return () => { active = false; }; }, [key]);
  useEffect(() => { if (subject && current?.id === subject) { const identity = { accountId: subject }; setRemembered(identity); void SecureStore.setItemAsync(key, JSON.stringify(identity)); } }, [subject, current?.id, key]);
  useEffect(() => {
    if (subject && current === null && connection.isWebSocketConnected && server.isAuthenticated) {
      // Persist the quarantine when a different phone learns the user is gone;
      // restarting offline must not reopen its remembered learning partition.
      void quarantineAccountDatabase(subject).then(() => SecureStore.deleteItemAsync(key)).catch(() => {});
      void studyReminders.retire().catch(() => {});
    }
  }, [subject, current, connection.isWebSocketConnected, server.isAuthenticated, key]);
  if (isLoading || remembered === undefined) return <Loading />;
  if (!isAuthenticated) return <Loading label="Sign in to continue." />;
  const access = accountCacheAccess({ subject, currentId: current?.id ?? (current === null ? null : undefined), rememberedId: remembered?.accountId, connected: connection.isWebSocketConnected, serverLoading: server.isLoading, serverAuthenticated: server.isAuthenticated });
  if (access.state === "reconnect") return <Screen title="Reconnect your account"><Panel><Body>Sign in again to reconnect your progress. Study saved on this phone remains linked to its original account.</Body><Button label="Return to sign in" onPress={() => { void signOut(); }}/></Panel></Screen>;
  if (access.state === "connect") return <Loading label="Connect once to prepare your account for offline study." />;
  const { accountId: id, cloudReady } = access;
  return <ProfileProvider key={id} accountId={id} cloudReady={cloudReady}><StudyProvider accountId={id} cloudReady={cloudReady}><ReviewProvider cloudReady={cloudReady}>{children}</ReviewProvider></StudyProvider></ProfileProvider>;
}
export function useSignOut() {
  const control = useContext(Control); const token = useAuthToken();
  return async () => { if (!control) throw new Error("Authentication control is unavailable."); await control(token); };
}
export function useDeletedAccountSignOut() {
  const control = useContext(Control), token = useAuthToken();
  return async () => { if (!control) throw new Error("Authentication control is unavailable."); await control(token, true); };
}
