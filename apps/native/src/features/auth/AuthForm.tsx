import { useAuthActions, useConvexAuth } from "@convex-dev/auth/react";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@packages/backend/convex/_generated/api";
import { Body, Button, Field, Message, Panel, Screen } from "../../components/ui";

export function AuthForm({ flow }: { flow: "signUp" | "signIn" | "reset" | "email-verification" | "reset-verification" }) {
  const params = useLocalSearchParams<{ email?: string; code?: string }>();
  const [email, setEmail] = useState(params.email ?? "");
  const [password, setPassword] = useState(""); const [confirmation, setConfirmation] = useState("");
  const [code, setCode] = useState(params.code ?? ""); const [busy, setBusy] = useState(false);
  const [error, setError] = useState(""); const [sent, setSent] = useState(false);
  const { signIn } = useAuthActions(); const { isAuthenticated } = useConvexAuth();
  const capabilities = useQuery(api.account.capabilities);
  useEffect(() => { if (isAuthenticated && (flow === "signIn" || flow === "signUp" || flow === "email-verification")) router.replace("/(learning)/(tabs)"); }, [isAuthenticated, flow]);
  useEffect(() => { if (flow === "reset-verification" && params.code) { setCode(params.code); if (params.email) setEmail(params.email); router.setParams({ code: undefined, email: undefined }); } }, [flow, params.code, params.email]);
  const titles = { signUp: "Create your account", signIn: "Welcome back", reset: "Recover your account", "email-verification": "Check your email", "reset-verification": "Set your new password" };
  const passwordFlow = flow === "signUp" || flow === "signIn" || flow === "reset-verification";
  async function submit() {
    setError(""); const normalized = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) { setError("Enter a valid email address."); return; }
    if ((flow === "signUp" || flow === "reset-verification") && (password.length < 10 || password.length > 128 || password !== confirmation)) { setError(password !== confirmation ? "The passwords do not match." : "Use a password between 10 and 128 characters."); return; }
    if ((flow === "email-verification" || flow === "reset-verification") && !code) { setError("Enter the email code or open a new reset link."); return; }
    setBusy(true);
    try {
      const result = await signIn("password", { flow, email: normalized, ...(flow === "reset-verification" ? { code, newPassword: password } : flow === "email-verification" ? { code } : passwordFlow ? { password } : {}) });
      if (flow === "signUp") router.replace(result.signingIn ? "/(learning)/(tabs)" : { pathname: "/auth/verify", params: { email: normalized } });
      else if (flow === "signIn" && !result.signingIn) router.replace({ pathname: "/auth/verify", params: { email: normalized } });
      else if (flow === "reset") setSent(true);
      else if (flow === "reset-verification") { setPassword(""); setConfirmation(""); setCode(""); router.replace("/(learning)/(tabs)"); }
    } catch (failure) {
      const detail = String(failure);
      setError(detail.includes("EMAIL_COOLDOWN") ? "Wait one minute before requesting another email. Your previous code remains valid." : detail.includes("EMAIL_CAPACITY") ? "Account email is unavailable today. Try again tomorrow." : detail.includes("EMAIL_") ? "The email couldn't be sent. Please request another email." : flow.includes("verification") ? "The link or code is invalid or expired. Request another email and try again." : flow === "signIn" ? "We couldn't sign you in. Check your email and password, or recover your account." : "We couldn't complete that request. Check your connection and try again.");
    } finally { setBusy(false); }
  }
  async function resend() {
    setBusy(true); setError("");
    try { await signIn("password", { flow: "email-verification", email: email.trim().toLowerCase() }); setSent(true); }
    catch (failure) { setError(String(failure).includes("EMAIL_COOLDOWN") ? "Wait one minute before requesting another email. Your previous code remains valid." : "The email couldn't be sent. Please try again."); } finally { setBusy(false); }
  }
  if ((flow === "reset" || flow === "reset-verification") && capabilities?.passwordRecovery === false) return <Screen title="Password recovery"><Panel><Body>Password recovery is unavailable in this build. You can still sign in with your current password.</Body><Button label="Back to sign in" onPress={() => router.replace("/auth/signin")}/></Panel></Screen>;
  return <Screen title={titles[flow]} subtitle="Your learning progress stays linked to the same account."><Panel>
    {flow === "signUp" && capabilities?.passwordRecovery === false && <Body muted>Password recovery is unavailable in this early build. Keep your password somewhere secure.</Body>}
    {flow === "email-verification" && <Body>Enter the code from your verification email. It expires after 15 minutes.</Body>}
    {flow === "reset" && <Body>We&apos;ll email a secure link to set a new password. This also serves password changes from Settings.</Body>}
    {flow === "reset-verification" && <Body>Your email link authorizes this password change. Opening the link alone does not change your password.</Body>}
    <Field label="Email address" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email"/>
    {passwordFlow && <Field label={flow === "reset-verification" ? "New password" : "Password"} value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoComplete={flow === "signIn" ? "current-password" : "new-password"}/>}
    {(flow === "signUp" || flow === "reset-verification") && <Field label="Confirm password" value={confirmation} onChangeText={setConfirmation} secureTextEntry autoComplete="new-password"/>}
    {flow === "email-verification" && <Field label="Verification code" value={code} onChangeText={setCode} keyboardType="number-pad" autoComplete="one-time-code"/>}
    {error && <Message>{error}</Message>}{sent && <Body>Email requested. Check your inbox; you can request another if it does not arrive.</Body>}
    <Button label={flow === "signUp" ? "Create account" : flow === "signIn" ? "Sign in" : flow === "reset" ? sent ? "Send another link" : "Send reset link" : flow === "email-verification" ? "Verify email" : "Save new password"} onPress={() => void submit()} busy={busy}/>
    {flow === "email-verification" && <Button label="Send another verification email" secondary onPress={() => void resend()} disabled={busy}/>}
    {flow === "signIn" && capabilities?.passwordRecovery && <Button label="Forgot password?" secondary onPress={() => router.push("/auth/forgot")}/>}
    {flow === "reset-verification" && <Button label="Request a new reset link" secondary onPress={() => router.replace("/auth/forgot")}/>}
    <Button label="Back" secondary onPress={() => router.canGoBack() ? router.back() : router.replace("/")}/>
  </Panel></Screen>;
}
