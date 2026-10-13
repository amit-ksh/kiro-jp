import { Email } from "@convex-dev/auth/providers/Email";
import { ConvexError } from "convex/values";

function code() {
  const bytes = new Uint8Array(8); crypto.getRandomValues(bytes);
  return Array.from(bytes, value => String(value % 10)).join("");
}
function secretLinkToken() {
  const bytes = new Uint8Array(32); crypto.getRandomValues(bytes);
  return Array.from(bytes, value => value.toString(16).padStart(2, "0")).join("");
}
export function accountEmail(kind: "verify" | "reset") {
  return Email({
    id: kind === "verify" ? "email-verification" : "email-reset",
    maxAge: kind === "verify" ? 15 * 60 : 30 * 60,
    generateVerificationToken: async () => kind === "verify" ? code() : secretLinkToken(),
    async sendVerificationRequest({ identifier, token, expires }) {
      const key = process.env.RESEND_API_KEY; const from = process.env.RESEND_FROM;
      if (!key || !from) throw new ConvexError({ code: "EMAIL_UNAVAILABLE", message: "Account email is unavailable. Please try again later." });
      let text: string;
      if (kind === "verify") text = `Your Japanese Learning App verification code is ${token}. It expires in 15 minutes. If you did not request it, ignore this email.`;
      else {
        const origin = process.env.SITE_URL;
        if (!origin || new URL(origin).protocol !== "https:") throw new ConvexError({ code: "EMAIL_UNAVAILABLE", message: "Password recovery is unavailable. Please try again later." });
        const link = new URL("/auth/reset", origin);
        link.searchParams.set("code", token); link.searchParams.set("email", identifier);
        text = `Set your new Japanese Learning App password: ${link.toString()}\nThis single-use link expires at ${expires.toISOString()}. Opening it alone does not change your password. If you did not request it, ignore this email.`;
      }
      const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ from, to: [identifier], subject: kind === "verify" ? "Verify your Japanese Learning App email" : "Set your Japanese Learning App password", text }) });
      if (!response.ok) throw new ConvexError({ code: "EMAIL_DELIVERY_FAILED", message: "The email could not be sent. Please request another email." });
    },
  });
}
