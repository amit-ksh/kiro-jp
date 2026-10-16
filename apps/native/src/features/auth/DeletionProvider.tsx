import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AppState, type ScrollView } from "react-native";
import {
  useAuthActions,
  useAuthToken,
  useConvexAuth,
} from "@convex-dev/auth/react";
import { ConvexHttpClient } from "convex/browser";
import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import { api } from "@packages/backend/convex/_generated/api";
import { localAccountFromToken } from "@packages/learning-core";
import {
  Body,
  Button,
  Field,
  Loading,
  Message,
  Panel,
  Screen,
  Title,
} from "../../components/ui";
import { deleteLocalAccount } from "../../data/deleteLocalAccount";
import { studyReminders } from "../reminders/nativeReminders";
import { authNamespace, forgetDeletedAccountRevocations } from "./revocations";
import { useDeletedAccountSignOut } from "./AuthProvider";
import {
  advanceDeletion,
  parseDeletionIntent,
  type DeletionIntent,
} from "./deletionFlow";

const key = `account-deletion-${authNamespace}`;
const Context = createContext<((accountId: string) => Promise<void>) | null>(
  null,
);
function http() {
  const url = process.env.EXPO_PUBLIC_CONVEX_URL;
  if (!url) throw new Error("Account connection is unavailable.");
  return new ConvexHttpClient(url, {
    logger: false,
    fetch: async (input, init) => {
      const controller = new AbortController(),
        timer = setTimeout(() => controller.abort(), 10000);
      try {
        return await fetch(input, { ...init, signal: controller.signal });
      } finally {
        clearTimeout(timer);
      }
    },
  });
}
export function DeletionProvider({ children }: { children: ReactNode }) {
  const token = useAuthToken(),
    auth = useConvexAuth(),
    { signIn } = useAuthActions();
  const finishSignOut = useDeletedAccountSignOut();
  const current = useRef({ token, finishSignOut });
  current.current = { token, finishSignOut };
  const [intent, setIntent] = useState<DeletionIntent | null>(null),
    [loading, setLoading] = useState(true),
    [retry, setRetry] = useState(0);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [showLogin, setShowLogin] = useState(false);
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState("");
  const starting = useRef(false),
    running = useRef(false),
    live = useRef(true);
  const scroll = useRef<ScrollView>(null);
  const revealInput = () =>
    setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 300);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);
  useEffect(() => {
    let active = true;
    void SecureStore.getItemAsync(key)
      .then((value) => {
        if (active) setIntent(value ? parseDeletionIntent(value) : null);
      })
      .catch(() => {
        if (active)
          setError(
            "Deletion recovery could not be read. Restart the app to retry before studying.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!intent || (intent.phase === "complete" && !token)) return;
    const retryNow = () => {
      if (!running.current) setRetry((n) => n + 1);
    };
    const timer = setInterval(retryNow, 12000);
    const listener = AppState.addEventListener("change", (state) => {
      if (state === "active") retryNow();
    });
    return () => {
      listener.remove();
      clearInterval(timer);
    };
  }, [intent, token]);
  useEffect(() => {
    if (!intent || loading || running.current) return;
    running.current = true;
    setBusy(true);
    let stage = "status";
    void (async () => {
      if (intent.phase === "complete") {
        if (current.current.token) await current.current.finishSignOut();
        return;
      }
      await advanceDeletion({
        status: () =>
          http().query(api.accountDeletion.status, { receipt: intent.receipt }),
        request: async () => {
          stage = "submit";
          const credentials = current.current.token;
          if (
            localAccountFromToken(
              credentials,
              process.env.EXPO_PUBLIC_CONVEX_SITE_URL ?? "",
            ) !== intent.accountId
          )
            throw new Error(
              "Sign in to the original account to finish submitting this deletion.",
            );
          const client = http();
          client.setAuth(credentials!);
          await client.mutation(api.accountDeletion.request, {
            receipt: intent.receipt,
            confirmation: "DELETE",
          });
        },
        cleanup: async () => {
          stage = "reminders";
          await studyReminders.retire();
          stage = "local-files";
          await deleteLocalAccount(intent.accountId);
          stage = "revocations";
          await forgetDeletedAccountRevocations(intent.accountId);
        },
        complete: async () => {
          stage = "finish";
          const completed: DeletionIntent = { ...intent, phase: "complete" };
          await SecureStore.setItemAsync(key, JSON.stringify(completed));
          if (live.current) setIntent(completed);
          await current.current.finishSignOut();
        },
      });
      if (live.current) setError("");
    })()
      .catch((error) => {
        if (__DEV__)
          console.warn(
            "Account deletion pending",
            stage,
            error instanceof Error ? error.name : "Error",
            stage === "local-files" && error instanceof Error
              ? error.message
              : "",
          );
        if (live.current)
          setError(
            "Deletion is still pending. Connect to the internet and retry. Your learning stays closed while the request or device cleanup finishes.",
          );
      })
      .finally(() => {
        running.current = false;
        if (live.current) setBusy(false);
      });
  }, [intent, loading, retry, token]);
  async function start(accountId: string) {
    if (starting.current || intent) return;
    starting.current = true;
    try {
      const receipt = Array.from(await Crypto.getRandomBytesAsync(32), (byte) =>
        byte.toString(16).padStart(2, "0"),
      ).join("");
      const next: DeletionIntent = {
        version: 1,
        accountId,
        receipt,
        phase: "requested",
      };
      await SecureStore.setItemAsync(key, JSON.stringify(next));
      setIntent(next);
    } finally {
      starting.current = false;
    }
  }
  async function reconnect() {
    setBusy(true);
    setError("");
    try {
      await signIn("password", {
        flow: "signIn",
        email: email.trim().toLowerCase(),
        password,
      });
      setPassword("");
      setShowLogin(false);
      setRetry((n) => n + 1);
    } catch {
      setError(
        "Sign-in couldn't finish. Use the original account's email and password, then retry.",
      );
    } finally {
      setBusy(false);
    }
  }
  const done = intent?.phase === "complete";
  if (loading) return <Loading label="Checking saved account controls…" />;
  if (!intent && error)
    return (
      <Screen title="Account controls unavailable">
        <Panel>
          <Message>{error}</Message>
        </Panel>
      </Screen>
    );
  return (
    <Context.Provider value={start}>
      {intent ? (
        <Screen
          title={done ? "Account deleted" : "Deleting your account"}
          keyboardAware
          scrollRef={scroll}
        >
          <Panel>
            <Title>
              {done
                ? "Your account has been removed"
                : "Keeping your data closed"}
            </Title>
            <Body>
              {done
                ? "Your cloud learning records, private audio and this phone's study data have been removed. Files you exported yourself remain in the folder you chose."
                : "Your confirmed request is saved on this phone. Cloud cleanup continues after it is accepted. Keep the app online to finish and remove this phone's local study data."}
            </Body>
            <Body muted>
              Other offline devices cannot be erased remotely. They will lose
              cloud access and quarantine this account&apos;s cached study when
              they reconnect.
            </Body>
            {error && <Message>{error}</Message>}
            {!done && (
              <>
                <Button
                  label="Retry deletion"
                  busy={busy}
                  onPress={() => setRetry((n) => n + 1)}
                />
                <Button
                  label="Sign in to finish submission"
                  secondary
                  disabled={busy}
                  onPress={() => setShowLogin((value) => !value)}
                />
                {showLogin && (
                  <>
                    <Field
                      label="Original account email"
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      onFocus={revealInput}
                    />
                    <Field
                      label="Password"
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry
                      onFocus={revealInput}
                    />
                    <Button
                      label="Sign in"
                      busy={busy}
                      disabled={!email.trim() || !password}
                      onPress={() => void reconnect()}
                    />
                  </>
                )}
              </>
            )}
            {done && (
              <Button
                label="Return to Welcome"
                disabled={busy || auth.isLoading || auth.isAuthenticated}
                onPress={() => {
                  void SecureStore.deleteItemAsync(key).then(() => {
                    setIntent(null);
                    setError("");
                  });
                }}
              />
            )}
          </Panel>
        </Screen>
      ) : (
        children
      )}
    </Context.Provider>
  );
}
export function useAccountDeletion() {
  const value = useContext(Context);
  if (!value) throw new Error("Account deletion is unavailable.");
  return value;
}
