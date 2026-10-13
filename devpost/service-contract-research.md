---
doc: service-contract-research
status: complete
checked: 2026-10-13
---

# Speech, Gateway, and Password Service Contracts

Focused first-party evidence for the technical blueprint. Selected services remain unchanged. This research inspected public documentation and source only; no credentials, model request, account setup, or Android integration was tested. `main` source links describe inspected upstream behavior, so verify them against the versions locked during implementation.

## Cloudflare Whisper Transport

Use the retained model-in-path REST route for the selected transcription model:

```text
POST https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/run/@cf/openai/whisper-large-v3-turbo
Authorization: Bearer {workers_ai_api_token}
cf-aig-gateway-id: {gateway_id}
Content-Type: application/json
```

Send model input directly, without a `model`/`input` wrapper. Cloudflare's current gateway reference confirms this retained route and gateway header; it also provides a universal `/ai/run` route whose body instead wraps `model` and `input`. The inference token needs Workers AI permission; an AI Gateway-management-only token is insufficient. Keep Workers AI billing on its existing allocation, with no prepaid-credit or third-party Unified Billing activation assumed. [AI Gateway REST reference](https://developers.cloudflare.com/ai-gateway/usage/rest-api/), [model-in-path API reference](https://developers.cloudflare.com/api/resources/ai/methods/run/)

Proposed body:

```json
{
  "audio": "BASE64_OF_THE_ORIGINAL_RECORDING_FILE_BYTES",
  "language": "ja",
  "task": "transcribe"
}
```

Cloudflare's own transcription-provider implementation encodes turbo Whisper audio as base64 for both binding and REST. It uses numeric-byte arrays for other Whisper variants; do not transfer that older format blindly to turbo. Base64 is the encoding of the recording file bytes, without a data-URL prefix. Its normalization reads `text`, `segments[].text/start/end`, and `transcription_info.language/duration`. [Cloudflare transcription source](https://raw.githubusercontent.com/cloudflare/ai/main/packages/workers-ai-provider/src/workersai-transcription-model.ts)

The model page exposes transcription language/task, silence and hallucination controls, and output `text`, `segments`, `transcription_info`, `word_count`, and `vtt`. These fields do not establish calibrated pronunciation scores. M4A/AAC acceptance from Expo's selected Android recording preset is **not explicitly confirmed** by that page. Test actual recorded Japanese, short isolated words, sentences, silence, corrupted input, and noisy/unclear speech through the configured gateway before choosing the final preset. If the container fails, select a supported recording/encoding path and prove it; never silently label a transcription failure as a wrong answer. [Whisper model documentation](https://developers.cloudflare.com/workers-ai/models/whisper-large-v3-turbo/)

Cloudflare's REST shim serializes model input as JSON and unwraps `response.result`. Thus the server adapter should validate an HTTP JSON envelope before decoding its model result, retain the original recognized text, and normalize segment timing separately. The same source still demonstrates the older gateway-host route `https://gateway.ai.cloudflare.com/v1/{account}/{gateway}/workers-ai/run/{model}` with Bearer auth. This is corroborating source evidence, not a reason to mix route shapes; choose one route and verify its real envelope. [Cloudflare REST shim](https://raw.githubusercontent.com/cloudflare/ai/main/packages/workers-ai-provider/src/utils.ts)

The documented OpenAI-compatible Workers AI endpoints cover chat, embeddings, and model-dependent Responses. They provide **no evidence for `/audio/transcriptions`**. Do not specify an OpenAI audio endpoint merely because the model originates with OpenAI. [Workers AI compatibility documentation](https://developers.cloudflare.com/workers-ai/configuration/open-ai-compatibility/)

## Gemini 3.8 Flash-Lite TTS

For the learner-selected model, compose the provider-native Google route:

```text
POST https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/google-ai-studio/v1beta/models/gemini-3.8-flash-lite-tts:generateContent
x-goog-api-key: {google_api_key}
cf-aig-authorization: Bearer {gateway_auth_token}
Content-Type: application/json
```

Cloudflare documents appending the provider endpoint to its Google AI Studio base and forwarding Google authentication; its examples use `v1`. Using `v1beta` here follows Google's current TTS request endpoint. This composition is a documented-schema inference requiring a real gateway test, not a successfully exercised request. Use the provider key/free allowance route; do not replace it with Cloudflare's third-party Unified Billing API as an assumed free equivalent. [Google provider gateway documentation](https://developers.cloudflare.com/ai-gateway/usage/providers/google-ai-studio/)

Minimal single-speaker body adapted to a Japanese learning phrase:

```json
{
  "contents": [{
    "role": "user",
    "parts": [{ "text": "水をください。" }]
  }],
  "generationConfig": {
    "responseModalities": ["AUDIO"],
    "speechConfig": {
      "voiceConfig": { "voice": "Kore" }
    }
  }
}
```

Google's current GenerateContent guide names the 3.8 Flash-Lite TTS model and treats input text as the exact transcript. Optional style belongs in `parts[].speech_metadata`, rather than being embedded as spoken text. The guide's single-speaker REST response extracts base64 `candidates[0].content.parts[0].inlineData.data` directly into a WAV file. Do **not** reuse the older raw PCM-to-WAV conversion or older single-speaker `prebuiltVoiceConfig.voiceName` example. Validate returned inline-data MIME/container and audio availability, decode bytes, verify playback and Japanese readings, then distribute checked lesson assets. Voice quality, exact account quota, and gateway acceptance remain live gates. [Current GenerateContent TTS guide](https://ai.google.dev/gemini-api/docs/generate-content/speech-generation)

## Convex Auth Reset Links on Android

The built-in Password provider offers `signUp`, `signIn`, `reset`, `reset-verification`, and `email-verification`; it has no Settings password-change flow. A reset request uses `reset` with a configured email provider. The completion request must supply the same account email, reset `code`, and `newPassword` to `reset-verification`. This branch verifies the reset identity, modifies credentials, and invalidates other sessions while preserving the returned reset session. Generic code sign-in cannot substitute for that branch. [Password provider source](https://raw.githubusercontent.com/get-convex/convex-auth/main/src/providers/Password.ts)

Use a Resend reset email provider that sends its generated URL, and an Android App Link opening a dedicated new-password screen. Route the link before attempting authentication; retain its reset token only for the short-lived completion form. The documentation explicitly requires link routing to the second reset step and distinguishes the two Password flows. [Password reset documentation](https://labs.convex.dev/auth/config/passwords)

Convex's email implementation supplies `sendVerificationRequest` with `url`, `token`, and expiry. It creates the destination using `redirectTo`, appending the code. The default redirect policy accepts paths and the configured site origin; any custom callback must allow only the chosen landing/App Link destination. [Email-flow source](https://raw.githubusercontent.com/get-convex/convex-auth/main/src/server/implementation/signIn.ts), [redirect policy source](https://raw.githubusercontent.com/get-convex/convex-auth/main/src/server/implementation/redirects.ts)

`ConvexAuthProvider` exposes `shouldHandleCode` and requires explicit native storage; its React API recommends SecureStore. Set deliberate code handling for native auth routes. The current client source's generic URL-code handler invokes sign-in without a provider, so prevent that path from consuming a password-reset code. Expo Linking/Router should dispatch the dedicated reset form and submit the explicit Password completion call. [React API](https://labs.convex.dev/auth/api_reference/react), [client code-handling source](https://raw.githubusercontent.com/get-convex/convex-auth/main/src/react/client.tsx)

Acceptance tests: installed signed APK, cold and warm starts, expired/used tokens, resend/delivery failure, reset on another device, wrong email/token pairing, changed password signing in, old password rejected, existing learning account retained, and other sessions invalidated. Link opening alone does not prove reset completion.

## Settings Password Change

**Revised after learner review, 2026-10-13:** Use the same verified email reset for Settings and Forgot password. An authenticated query derives the signed-in Password account's normalized email. Settings offers a secure emailed link, invokes the Password `reset` flow, and finishes through the dedicated `reset-verification` route with email, code, and new password. There is no current-password Settings form or application action calling credential-modification helpers. [Password reset documentation](https://labs.convex.dev/auth/config/passwords)

The earlier composition verified the old credential and wrote the new one through separate mutations. A reset between those calls could be overwritten; serializing only Settings calls would not cover recovery. That design is superseded, rather than described as fixed by a Settings-only lock. Using email proof for both entry points removes the competing old-password-authorized writer. The built-in reset validates the new password, verifies reset identity, changes credentials, and invalidates other sessions while returning its reset session. Its helpers are still separate calls; this does not establish atomic reset/session ordering or newest-requested-link precedence. [Password provider source, rechecked](https://raw.githubusercontent.com/get-convex/convex-auth/main/src/providers/Password.ts)

Acceptance tests: authenticated email lookup rejects another account; both entry points use the same reset route; no custom old-password credential writer exists; invalid/expired/used codes and duplicate completion fail safely; interrupted completion permits recovery through a newly requested link; overlapping Settings/recovery completions have checked token/session behavior against the locked library. After successful final completion, the new password signs in, the replaced password fails, the returned reset session works, other sessions are invalidated, and the same learning history remains. No live tests have been performed.
