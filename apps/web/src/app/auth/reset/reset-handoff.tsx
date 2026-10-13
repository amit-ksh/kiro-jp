"use client";
import { useEffect, useState } from "react";
export function ResetHandoff() {
  const [link, setLink] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => {
    const query = new URLSearchParams(window.location.search);
    const code = query.get("code"); const email = query.get("email");
    if (code && /^[a-f0-9]{64}$/.test(code) && email && email.length <= 254) {
      const target = new URL("japanesestudy://auth/reset"); target.searchParams.set("code", code); target.searchParams.set("email", email); setLink(target.toString());
    }
    window.history.replaceState(null, "", window.location.pathname);
    setReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  if (!ready) return <p>Preparing your secure app link…</p>;
  return <><p>This link opens the Android password form. Your password only changes after you choose and submit a new one in the app.</p>{link ? <a className="action" href={link}>Open the Android app</a> : <p>The reset link is missing or invalid. Request a new email from the app.</p>}<p>The app needs to be installed. Opening this page does not sign you in or change your password.</p></>;
}
