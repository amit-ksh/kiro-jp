# Japanese Learning App

An Android Expo app and a static Next.js landing page, adapted from the requested Convex/Turborepo starter. The approved requirements are in `devpost/prd.md`, the implementation blueprint in `devpost/spec.md`, and progress in `devpost/checklist.md`.

## Current build

The development client registers seven source-checked lessons, real Qloo-informed Gateway conversations, sentence feedback, discrete recording/transcription, permanent spaced-review closures, daily review-to-lesson continuation and offline content preparation. WaniKani familiarity import and editable goals have passed live isolated-account checks. Home/Profile expose weekly practice and focused extra review without changing schedules. Real Android checks now cover device/cloud exports, picker cancellation and confirmed account deletion with offline restart, durable quarantine and owned file cleanup. Optional reminders still need standalone delivery/tap/reboot checks. Android learning checks cover the first four lessons; the latest three lessons and settings/progress increments still need native review. The existing signed APK is an earlier foundation build; the 0.2.0/version-code-2 configuration prepares an updated internal candidate against the development backend. Broader reliability, learner hands-on checks and the final release remain required. Verification/recovery are temporarily disabled. See `devpost/build-evidence.md` for exact observed coverage; the full MVP is not yet complete.

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

Saving a checked lesson example adds separate phrase meaning/reading cards with stable content-version IDs and checked model audio after recall. Repeated saves preserve the existing cards. Review preparation waits for the source exercise/save events to synchronize before its successful result can be cached. Novel lesson sentences and grammar review answers use the same checked lesson target, including location questions.

Sessions pin a checked lesson ID/version. Lesson rendering, references, assessment, review preparation and speech authorization resolve that exact version; a newer lesson cannot replace a saved answer key. Unsupported versions retain recovery guidance. All seven templates have v1 content: `requests`, `directions`, `favorites`, `availability`, `desire`, `ability` and `try`. Directions teaches 入・出・右・左 through 入口・出口・右・左 and `[place] + はどこですか`. Favorites teaches 日・本・音・楽 through 日本・本・音・音楽 and `[thing] + が好きです`; にほん and にっぽん are accepted for 日本. Availability reinforces 店・本・新・古 and `[item] + はありますか`. Desire teaches 行・見・食・飲 and masu-stem + たいです. Ability teaches 読・書・話・聞 and dictionary-verb + ことができます. Try teaches 買・作・食・見 and te-form + みます, with supported みたいです wishes. Each includes three kana. Ability/try require accepted early N4 with explicit prerequisite refreshers. Later level changes preserve started sessions. Kanji and compound meanings have separate questions/review tracks. The tutor's target comes from the saved lesson. Speaking practice has a distinct own-sentence cue.

Home and Lessons open offline grammar search across all seven patterns by Japanese, romaji, English purpose or level. Each reference includes usage, a common mistake, sentence breakdowns and cached model audio. Expanded sentences link to that explanation and preserve the caller's place on return. Reference playback records listening time without creating a lesson attempt, demonstrating grammar, assessing speaking or earning a streak.

Profile lets learners change their goal, JLPT target and optional exam date alongside the existing level/time/interests/support settings. Goal/target choices save through the account's local profile queue. Dates use YYYY-MM-DD with explicit save/remove controls and appear on Home; invalid calendar dates are rejected locally and on the server. Preferences preserve prior learning and started-session snapshots. Native keyboard/theme/offline interaction checks for these new controls remain open.

The progress view separates meaning, reading, kana and grammar answer results, assisted/pending practice, listening/recording time and Japanese conversation turns. Its seven-day total unions simultaneous activity once while keeping each recorded local day. Partial meaningful practice earns a streak day separately from the daily minute goal. Recurring assessed mistakes across separate sessions can open a focused extra review without changing its scheduled interval. These summaries create no mastery evidence; native interaction checks for the new view remain open.

After finishing a lesson and ending its linked conversation, Home can offer an optional daily reminder. Choose a local HH:MM time or skip; Android permission is requested only when enabling. Settings remain editable in Profile. Quiet local reminders use one identifier, generic text and serialized cancellation on sign-out/account changes. Foreground timezone/offset changes reschedule them. Android may delay delivery under battery restrictions; native delivery, reboot and timezone checks require a current build and remain open.

Profile's learning-data export saves JSON to a folder the learner selects through Android. Choose cloud plus device data or a clearly labelled device-only copy offline. Local drafts, pending attempts, review position and cached transcripts remain included. Cloud reads paginate all allowed learning collections under the authenticated owner and exclude records created after the export cutoff; mutable records are read over the stated interval. The file excludes credentials, private file handles, diagnostics and audio bytes, and is not an importable backup. Tests/live pagination and ownership checks pass; native picker/readback/cancellation checks remain open. Account deletion is still required separately.

In Lessons, **Prepare lesson for offline study** downloads the selected immutable lesson snapshot and its checked model audio. Requests has 11 clips (about 0.8 MB total); directions has 12 and favorites has 14 (about 1.2 MB each); availability/desire have 14 each (about 1.3 MB), ability has 14 (about 1.7 MB) and try has 14 (about 1.5 MB). Every required file must pass size/SHA-256 checks before that account's Downloaded marker commits. Cancellation/failure retains a previous ready package. Startup verifies saved files again; Home offers offline continuation. Package staging is separate, including shared clip IDs. Checked public audio may be cached across accounts, while downloaded markers, answers and progress remain account scoped. Desire/ability/try native interaction and broader download/device/learner checks remain open.

`pnpm check:content` validates every released lesson and its exact manifest. `pnpm content:package --lesson directions --check` checks one package without credentials or network access; omitting `--lesson` selects requests. `--prepare` regenerates the selected manifest after a deliberate content-version change. Inspect that change, deploy the backend, then use `--publish` with the matching private development deploy key. Publication is administrator only, validates all storage hashes/sizes/types and is idempotent for an existing immutable version. No model inference is performed. Never edit a published version's lesson or audio in place; create a new version. Audio preparation also accepts `--lesson`; explicit generation/check operations retain the shared Gateway budget controls.

## Privacy and source

Private environment files, learner profile, local runtime state and starter staging directory are ignored. No passwords are stored in SQLite. Accounts use different local database files and server functions derive ownership from Convex Auth. No separate old-password credential writer exists. No paid fallback is enabled.

Local storage upgrades run transactionally through schema version 4 and preserve earlier profile, study and review data. A newer unsupported or incompatible store is retained with update/retry guidance; the app does not reset it or create an empty replacement. Content, review algorithms and database schema use separate versions.

Incoming study/review pages commit their rows, delivery acknowledgements and cursor in one transaction. Failed writes retry the unchanged page; replay never moves the cursor backward or replaces an immutable event. A push receipt alone keeps a review provisional until its canonical page commits. Remembered identity permits offline study, while cloud synchronization waits for a connected server-confirmed matching account. A revoked or mismatched identity shows reconnection guidance and retains the original account's local work.

The starter is Apache-2.0; retain its `LICENSE`. Japanese curriculum is original authoring with source checks and asset/license records before publication. There is no claim of native-speaker review, official JLPT certification, complete course coverage or third-party endorsements.
