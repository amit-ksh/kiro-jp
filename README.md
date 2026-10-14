# Japanese Learning App

An Android Expo app and a static Next.js landing page, adapted from the requested Convex/Turborepo starter. The approved requirements are in `devpost/prd.md`, the implementation blueprint in `devpost/spec.md`, and progress in `devpost/checklist.md`.

## Current build

The development client includes the first checked lesson, Gateway-routed conversations and sentence feedback, discrete recording/transcription, permanent spaced-review closures, daily review-to-lesson continuation and offline content preparation. Actual Android checks cover restart, offline answers/audio, reconnection and account isolation. The existing standalone APK is an earlier foundation build, not this complete code state. Real Qloo access, the remaining starter lessons, WaniKani import, full progress/data controls, learner hands-on checks and the final standalone release remain open. Verification/recovery are temporarily disabled. See `devpost/build-evidence.md` for the exact observed checks; the full MVP is not yet complete.

## Development

Use Node 24 (or Node 22.16+) and pnpm 10.33.4. AI SDK server actions use Convex's configured Node 22 runtime; account/profile mutations retain the default Convex runtime.

```sh
pnpm install
pnpm config:local
pnpm setup:backend
pnpm dev:android
pnpm dev:landing
```

Copy `.env.example` to the ignored root `.env` and configure the actual service values. `config:local` can also read the existing `starter-japanese/.env` and writes only public Convex URLs into native environment variables. `setup:backend` checks deployment-key/URL alignment, configures Resend and Auth signing metadata, runs the hoisted TypeScript compiler and deploys the backend. Existing private signing keys are preserved. The URLs alone do not authorize deployment.

The temporary `resend.dev` sender delivers only to the Resend account owner's address. Other learners need a verified domain sender. `kiro-jp.vercel.app/auth/reset` is the supplied future handoff URL; verified Android links remain untested until the page and certificate association are deployed there.

At the learner's current request, `ACCOUNT_EMAIL_ENABLED=false`: signup and sign-in work without email confirmation; verification, recovery and password changes are unavailable. Their implementation remains for later activation and testing. Gemini is the sole approved paid exception, with a US$10 total cap enforced by atomic reservations; other providers stay free-only. Prepared placement audio is bundled, with provenance/hashes alongside the WAV files.

Email verification uses a code. Settings password changes and recovery share the same secure email-reset flow. Disable email click tracking for reset links. The landing domain must serve an Android association file matching the frozen package/signing certificate; custom-scheme handoff is a fallback and does not prove verified App Links. Do not change the preview signing identity between early and final APKs.

```sh
pnpm typecheck
pnpm test
pnpm check:content
pnpm content:package --check
pnpm build:landing
pnpm export:android
# Admin-only fixed synthetic probe; reserves real service capacity and Gemini
# spend, so configure the approved budget before running it:
pnpm check:ai-gateway
# From apps/native after EAS project setup:
npx eas-cli build -p android --profile preview
```

Use a development client for native SQLite/audio checks. A browser render is not proof of Android storage, recording, font scaling or link behavior. Standalone APKs must launch without Metro/Expo Go. Live provider and Qloo checks use authorized keys and stay incomplete when no service access is configured.

The first source-checked lesson is `requests` version 1: 水・茶・本・円, a small hiragana group and `[item] + をください`. Fixed-answer practice works locally; novel sentences queue owned feedback and retain their prior schedule while unassessed. Meaning, word reading, kana, grammar and speaking evidence remain separate. Acknowledged review closures are permanent; late stale attempts retain effort without erasing earned advancement.

In Lessons, **Prepare lesson for offline study** downloads the immutable lesson snapshot and all 11 checked model-audio clips. Every required file must pass size/SHA-256 checks before the account's Downloaded marker commits. Cancellation/failure retains a previous ready package. Startup verifies saved files again; Home offers offline continuation. Checked public model audio may be cached across accounts, while downloaded markers, answers and progress stay account scoped. This first package is about 0.8 MB; the other six approved templates are still pending.

`pnpm content:package --prepare` regenerates the checked manifest after a deliberate content-version change. Inspect that change, deploy the backend, then use `pnpm content:package --publish` with the matching private development deploy key. Publication is administrator only, validates all storage hashes/sizes/types and is idempotent for an existing immutable version. No model inference is performed. Never edit a published version's lesson or audio in place; create a new version. The publisher's normal `--check` path needs no credentials or network access.

## Privacy and source

Private environment files, learner profile, local runtime state and starter staging directory are ignored. No passwords are stored in SQLite. Accounts use different local database files and server functions derive ownership from Convex Auth. No separate old-password credential writer exists. No paid fallback is enabled.

Local storage upgrades run transactionally through schema version 4 and preserve earlier profile, study and review data. A newer unsupported or incompatible store is retained with update/retry guidance; the app does not reset it or create an empty replacement. Content, review algorithms and database schema use separate versions.

The starter is Apache-2.0; retain its `LICENSE`. Japanese curriculum is original authoring with source checks and asset/license records before publication. There is no claim of native-speaker review, official JLPT certification, complete course coverage or third-party endorsements.
