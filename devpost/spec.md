---
doc: spec
status: approved
checked: 2026-10-13
---

# Japanese Learning App — Technical Spec

Implements the approved `prd.md` and `scope.md`. Android is the learning client; Next.js is a landing page only. One complete MVP serves both events. The learner approved this revised implementation blueprint on 2026-10-13; approval is not evidence of a working build. The descriptive working title does not establish a final brand.

## How This Works, In Plain Language

The Android app teaches from a small set of lessons prepared and checked before use. It stores available lessons, answers, progress, and unsent study attempts in SQLite on the phone. Downloaded audio and recordings live in the app's persistent files. This lets a learner continue prepared study without internet and keep their place after restarting.

Convex holds the shared account history. When the phone reconnects, it sends each study attempt with its unique ID and original study date. Convex recognizes retries, applies the same TypeScript review rules as the phone, and returns updated progress. The first eligible answer accepted by the server closes its scheduled review permanently. A stale phone's later answer remains study and skill evidence; it cannot undo that review or later acknowledged advances. Offline schedules are provisional until synchronized.

The online tutor runs through authenticated Convex actions. A shared AI adapter connects to Gemini or OpenRouter through Cloudflare AI Gateway. Its bounded tool-calling agent can fetch relevant cultural contexts from Qloo and look up checked teaching material. Qloo informs what the conversation is about; the curriculum and learner records determine its Japanese difficulty. Speech recognition and generated audio are separate capabilities, so a conversation-provider switch does not change their interfaces.

Convex Auth manages email/password accounts. Resend delivers verification and reset emails. The web landing page explains the app and links to a signed standalone Android APK. Google Play is deferred. Available free quotas are the starting budget, with no automatic paid fallback.

## The Core Journey Through the System

Implements `prd.md > The Core Journey`.

1. **Account:** Android calls Convex Auth; Resend sends email. SecureStore remembers tokens. The app confirms the authenticated user before loading that account's local/cloud records.
2. **Setup:** Saved onboarding answers update the profile. A fixed placement bank computes an explained recommendation; the learner accepts/adjusts it. WaniKani import supplies separate familiarity evidence. Confirmed interests/favorites are stored independently of Qloo availability.
3. **Home:** Local progress plus acknowledged cloud changes determine due counts, active time, streak, continuation, and a recommended eligible lesson. An online context lookup can enrich its theme. Starting a session saves a snapshot of its content version and target language.
4. **Review and learning:** The session reads its prepared package. Fixed answer checks run locally. Every attempt commits locally before feedback/progress advances. Kana support and assistance are recorded separately from recall outcomes.
5. **Grammar and speech:** Fixed exercises use checked answers; open sentences receive online assessment or remain Awaiting feedback. Audio playback/recording works from files. Online transcription returns recognized text for the learner to inspect and edit before submitting an answer.
6. **Conversation:** The same chat accepts a standalone topic or lesson suggestion. The server loads account/lesson context and invokes the tutor. Real Qloo tools can resolve interests and retrieve context; a validated response becomes a saved assistant message. A chosen topic overrides profile interests.
7. **Finish:** Ending chat saves its actual effort and completion immediately; recap generation can finish afterward. Target-pattern evidence is assessed from learner turns and remains distinct from chat completion. The reference builder combines checked lesson material, accepted corrections, and saved phrases.
8. **Return:** New material becomes initially learned and enters its own review tracks. Future due reviews and grammar prompts bring it back. Offline activity synchronizes using original event IDs/dates; retries and a second reconnect do not duplicate results.

## Stack

Learner-selected choices and agreed implementation direction:

| Piece | Choice and reason | Documentation / verification |
| --- | --- | --- |
| Monorepo | TypeScript, pnpm, Turborepo; keep native/web/backend boundaries from the requested starter | [Starter](https://github.com/get-convex/turbo-expo-nextjs-clerk-convex-monorepo), [Turborepo](https://turborepo.com/docs) |
| Android | Expo / React Native with Expo Router; standalone preview APK | [Expo](https://docs.expo.dev/), [Router](https://docs.expo.dev/router/introduction/) |
| Landing | Next.js static export on Cloudflare Pages | [Next.js static export](https://nextjs.org/docs/app/guides/static-exports), [Pages](https://developers.cloudflare.com/pages/framework-guides/nextjs/deploy-a-static-nextjs-site/) |
| Account/backend | Convex and Convex Auth, replacing starter Clerk integration | [Convex](https://docs.convex.dev/), [Convex Auth](https://labs.convex.dev/auth) |
| Phone storage | Expo SQLite; FileSystem for persistent assets; SecureStore for tokens | [SQLite SDK 55](https://docs.expo.dev/versions/v55.0.0/sdk/sqlite/), [FileSystem](https://docs.expo.dev/versions/v55.0.0/sdk/filesystem/), [SecureStore](https://docs.expo.dev/versions/v55.0.0/sdk/securestore/) |
| Audio | Expo Audio, discrete recording/replay and downloaded model audio | [Audio SDK 55](https://docs.expo.dev/versions/v55.0.0/sdk/audio/) |
| Tutor | AI SDK ToolLoopAgent, typed provider adapter, validated tool/result schemas | [Agents](https://ai-sdk.dev/docs/agents/building-agents), [Google provider](https://ai-sdk.dev/providers/ai-sdk-providers/google), [compatible provider](https://ai-sdk.dev/providers/openai-compatible-providers) |
| Model routing | Cloudflare AI Gateway; Gemini 3.8 Flash primary, OpenRouter free Nemotron 3 Super initial alternative | [Google gateway](https://developers.cloudflare.com/ai-gateway/usage/providers/google-ai-studio/), [OpenRouter gateway](https://developers.cloudflare.com/ai-gateway/usage/providers/openrouter/) |
| Speech models | Cloudflare Whisper Large v3 Turbo for transcription; Gemini 3.8 Flash-Lite TTS for model audio | [Whisper](https://developers.cloudflare.com/workers-ai/models/whisper-large-v3-turbo/), [TTS](https://ai.google.dev/gemini-api/docs/generate-content/speech-generation) |
| Cultural context | Server-only Qloo lookup/Insights tools; private provenance/cache | [Qloo guide](https://docs.qloo.com/reference/qloo-llm-hackathon-developer-guide) |
| Account email | Resend free tier with verified sender/domain | [Resend API](https://resend.com/docs/api-reference/emails/send-email) |
| Reminders | Expo Notifications local scheduling, after first completed session | [Notifications](https://docs.expo.dev/versions/v55.0.0/sdk/notifications/) |

Inspected upstream starter versions: Expo `~55.0.16`, React `19.2.0`, React Native `0.83.6`, Expo Router `~55.0.13`, TypeScript `5.9.3`; root pnpm `10.33.0`, Turbo `2.9.6`, Node `>=20.20.0`. These are documentation observations, not installed versions. Preserve a compatible starter set and install Expo modules through `expo install`. Lock the resolved versions, including AI SDK/provider packages and Convex Auth. Check AI SDK's current loop/output APIs against that lockfile rather than mixing examples from different major versions. See `spec-research.md > Starter and Workspace`.

Use native React Native components/StyleSheet and small reusable learning controls; share design tokens rather than adding a cross-platform UI framework. Use runtime validation at external/API/content boundaries; Zod schemas can feed AI SDK tools, while Convex validators secure backend entry points. These are derived implementation choices, not additional learner-selected services.

## Where It Runs and How Someone Tries It

### Development and Starter Adaptation

No scaffold has run. Preserve the existing `devpost/`, references, and skills when applying the requested starter during `5-build`:

```text
npx create-convex@latest -t get-convex/turbo-expo-nextjs-clerk-convex-monorepo
```

If the generator needs an empty destination, generate into a temporary sibling inside this workspace and merge the application files deliberately; never overwrite planning assets. Keep `apps/native`, `apps/web`, and `packages/backend`. Remove Clerk packages, providers, JWT issuer configuration, protected web notes routes, and sample notes/summary features. Set up Convex Auth tables/routes/providers in the backend and its SecureStore-backed React Native provider. Web receives no Convex learning client or account pages.

After dependencies and backend setup, the expected commands are:

```text
pnpm install
pnpm --filter @packages/backend setup
pnpm dev
pnpm --filter native-app exec expo start --dev-client
```

Confirm generated package names/scripts first. `pnpm dev` starts the backend and web/native development tasks. Open the printed local web URL for the landing page and the development build on an Android device/emulator for learning. A real Android device is required for final microphone/audio/link checks; emulator checks supplement it. This host's bundled Node is available if its Volta shims fail; do not make its absolute path part of portable repo scripts.

### Standalone Demo and Landing Deployment

Use an EAS `preview` profile with `android.buildType: apk`, a bundled JavaScript release build, and a stable signing key/package ID. It must launch without Metro or Expo Go. Run from `apps/native`:

```text
pnpm exec eas build -p android --profile preview
```

Use available free build quota. The exact EAS project ID, application ID, package name, signing credentials, landing domain, and downloaded APK URL are setup values; freeze the package/signing identity before configuring Android App Links. Document install/update instructions and the tested Android version/device in the README. Keep the same signing key for subsequent preview updates.

Deploy the Convex production backend separately from development using the backend package's Convex CLI. Set native production configuration to that deployment before creating the preview APK. Export the landing with Next.js `output: export`, build `apps/web`, and deploy its `out/` directory to Cloudflare Pages. Put the real APK link/build version and installation instructions in landing configuration. Host `.well-known/assetlinks.json` and a minimal app-opening handoff on the same HTTPS domain for email links; that handoff supplies no web learning/account UI.

Each event still needs its own eligibility/submission audit. Prepare the demo video and public repository required by the learning workflow; the working Qloo rules also require an accessible functional demo and an open-source repository. The APK/landing link lets others try the full loop. No registration, publication, terms acknowledgment, or submission is performed by spec approval. Google Play and iOS remain deferred.

### Configuration and Secrets

Public native configuration: Convex deployment/site URLs, app scheme, HTTPS app-link host, build/content version. Public web configuration: app name, APK URL/version, support/source links. Secrets live in Convex deployment configuration, never `EXPO_PUBLIC_*`, Next public variables, checked content packages, or the repository.

Server configuration: Resend key/sender; Convex Auth-generated key material; Cloudflare account/gateway IDs and scoped API/gateway tokens; Gemini key; OpenRouter key/model; Qloo key/base URL; active provider/model; explicit free-only policy and request budgets. Gateway IDs/hosts may be nonsecret but should still be server-owned configuration. WaniKani's personal token is supplied only for an authenticated import and discarded afterward. Provide `.env.example` names without values. Keep learner-profile and `.env*` files excluded as already agreed.

## Look and Feel

Implements `prd.md > Look and Feel` and `scope.md > Inspiration & Identity`.

Use `references/j-image-main.webp` as the primary reference: indigo `#37469E`, deeper indigo `#313790`, orange `#FF5C00`, warm orange `#F05722`, and white. Share these token values in `packages/design-tokens`. Native surfaces use indigo headers/backgrounds, rounded white learning panels, orange primary actions, pill controls, and white five-section bottom navigation. The landing carries the same identity. Use Japanese wave accents sparingly behind non-instructional areas.

Large bold Japanese, comfortable English explanations, and clear audio/record controls take priority over decorative density. Bundle readable Japanese/Latin fonts with documented redistribution rights, or use tested platform fallbacks; exact font assets can be finalized during UI preparation. Native furigana is a structured reading component, not an assumption that React Native supports HTML ruby. Store word/reading segments so the component and screen reader can expose the same content.

Use a derived dark ink for normal text on orange and a checked darker orange for small orange text on white when contrast requires it; retain the supplied palette as surface/action anchors. Verify actual contrast, Android font scaling, Japanese wrapping, ≥48dp touch targets, accessible labels, reduced motion, focus order, and controls distinguishable without color. Hide answer-revealing readings in recall prompts; restoring them marks assistance. Do not infer design from the uninspected video.

## Components

### Account and Email-Link Handling

**Current build override — 2026-10-13:** The learner explicitly deferred mail confirmation/verification and all reset/password-change flows until their sender is ready. `ACCOUNT_EMAIL_ENABLED=false` disables both Convex Auth email providers; email/password signup returns an authenticated session immediately, and native recovery/change actions remain unavailable. Preserve the designed email-reset implementation below for later activation. The original email delivery, expiry, overlap and verified reset-link gates apply when that switch is enabled, not to the current no-email build.

Implements `prd.md > Account Access and Recovery` (ACC-1–ACC-3).

Use Convex Auth's Password provider with verification/reset email providers backed by Resend. Form validation includes email, password policy, confirmation, and visible server errors. Persist auth tokens using SecureStore with an app/deployment namespace. Never persist a password. Verified account identity owns every progress operation.

Email verification can use a code entered in Android; the PRD requires verified email, while reset specifically uses a secure emailed link. Reset requests send a short-lived single-use token in an HTTPS app-opening link. The dedicated reset route preserves the token and account email, asks for a new password/confirmation, and calls `signIn('password', {flow:'reset-verification',email,code,newPassword})`; generic code sign-in must not consume it first. The reset link/provider handoff must carry the normalized email for cold starts or other-device use, with no password; validate the email/token pairing through the auth library. Do not reset a password just by opening a link. Restrict redirects to configured app/HTTPS origins, remove tokens/email from the visible URL after handoff, and disable email click tracking for these links. Expiry/delivery errors offer re-request.

**One password-update path:** Settings' Change password uses the same verified email reset as Forgot password. An authenticated `account.passwordResetEmail` query derives the signed-in user's existing Password-account email; Settings displays it and offers Email me a secure link. Request it with `signIn('password', {flow:'reset',email})`, then complete the dedicated email-link route described above. Settings does not ask for the current password or call `modifyAccountCredentials` from an application action. Every password update requires the reset flow's fresh email proof and shared password validation. This removes the separate old-password-validated writer that could overwrite an intervening reset. Do not accept a caller-supplied identity as authority for the Settings account query, create a second credential-update endpoint, or patch auth tables.

The reset completion returns the reset-authenticated session; persist those returned tokens and let Convex Auth invalidate other sessions, including a previous Settings session. Keep the same user ID and learning history. Do not promise to retain the old Settings session. The built-in reset implementation still uses separate helper calls; using one flow is not a claim of an atomic password/session transaction or of newest-requested-link ordering. Against the locked library, test duplicate/overlapping link completions, token reuse/expiry, invalid new passwords, and recovery after an interrupted completion. A successful final completion must allow its new password, reject the replaced password, and retain that account's history. [Password flow documentation](https://labs.convex.dev/auth/config/passwords), [provider source](https://raw.githubusercontent.com/get-convex/convex-auth/main/src/providers/Password.ts).

Sign-out immediately clears tokens and access to the account's local store, cancels jobs/reminders, and returns to Welcome. Unsent records remain quarantined in that account's device store for the same account to synchronize after reauthentication; another account cannot read them. Online sign-out also revokes the session. Offline sign-out queues server revocation information in protected storage while clearing usable credentials. A new account opens a different store; content assets may be shared only if they contain no account/private context.

### Learner Profile, Placement, and Preferences

Implements `prd.md > Onboarding, Placement, and Preferences` (ONB-1–ONB-4).

Represent onboarding as saved step plus valid answers, optional-step decisions, assessment responses, and accepted recommendation. Save after each answer/change; Back edits prior values. Auth/account steps require network; returning remembered accounts may continue supported downloaded steps offline. Permission requests remain at point of use.

Maintain estimated level, accepted starting band, goal, target JLPT level/optional date where selected, daily minutes, interests/favorites/dislikes, reading aids, text/audio settings, and reminder preference. Keep skill evidence separate from selected level. A preference change affects future recommendations; it does not erase attempts or rewrite an already-started session snapshot.

**Proposed deterministic placement default:** eight checked starter questions, two per domain (kana, vocabulary, grammar, listening), with four optional follow-up questions if the starter is strong. Each item declares skill, difficulty, correct/accepted response, reading aids, and audio. I don't know scores as demonstrated uncertainty; skipped/unavailable questions remain unassessed. Never replace unavailable listening with a reading score.

Recommend supported foundations if fewer than six starter items are assessable, at most three are correct, or neither grammar nor listening has a correct response. Otherwise recommend early N5, keeping kana support when literacy evidence is weak. Offer early N4 only after at least six starter answers are correct and at least three follow-ups are correct, including both grammar and listening follow-ups. Explain the actual evidence/missing domains; these bands are starting recommendations, not JLPT certification. The learner accepts/adjusts or skips into their selected band; I'm not sure without a check defaults to supported foundations. All thresholds/bank versions are checked fixtures and reviewable technical defaults.

### Prepared Curriculum and Content Checks

Implements `prd.md > Beginner Support and Kana Foundations`, `New Kanji and Active Recall`, and `Grammar Teaching and Sentence Practice` (BEG-1–BEG-3, KAN-1–KAN-4, GRA-1–GRA-4).

The learner chose an AI-assisted, source-checked process initially. Author original explanations, mnemonics, dialogues, prompts, approved answers, and breakdowns. Cross-check meanings/readings with suitable dictionary records and grammar/usage against first-party learning references, such as Japan Foundation material. Record source URLs, retrieval date, reviewer/check method, findings, license/provenance for reused data, and version. Resolve flagged errors before publishing. A second model review helps find issues but is not described as native-speaker/expert review. No human Japanese reviewer is arranged.

Use a small checked starter inventory. The following seven lesson templates are proposed seed-content defaults; each introduces 3–5 kanji with word-specific readings, one pattern, and a small appropriate kana group:

| Seed lesson | Band / target pattern | Kanji to introduce or reinforce | Interest-linked outcome |
| --- | --- | --- | --- |
| Request an item | Supported N5 / `[item] をください` | 水・茶・本・円 | Request a drink or a manga politely |
| Ask where it is | N5 / `〜はどこですか` | 入・出・右・左 | Ask for a shrine entrance/direction |
| Share a favorite | N5 / `〜が好きです` | 日・本・音・楽 | Share an anime/media/music preference and ask back |
| Ask if it is available | N5 / `〜はありますか` | 店・本・新・古 | Ask whether a shop has an item |
| Say what you want to do | Later N5 / `〜たいです` | 行・見・食・飲 | Discuss an activity connected to an interest |
| Say what you can do | N4 starter / `〜ことができます` | 読・書・話・聞 | Discuss ability in an everyday/media context |
| Try an activity | N4 starter / `〜てみます` | 買・作・食・見 | Say what you would like to try |

Readings come from the actual taught words (for example 水→みず, 入口→いりぐち), not every possible reading of each character. Compound words can introduce reinforced or supported components; prerequisites and support metadata make unfamiliar components explicit. Repeated kanji can be reinforced while vocabulary/grammar expand. Fixed kana microgroups are paired with each beginner lesson; they teach sounds used in its words without requiring complete kana literacy. Gate N4 templates on accepted band and demonstrated/explicitly supported prerequisite forms. The implemented contract chooses explicit support: accepted early N4, a version-pinned prerequisite and checked refresher examples/explanation shown before learning. Imported familiarity or completion cannot substitute for that support. New starts validate the saved starting-band snapshot; subsequent level changes do not invalidate an existing offline/resumed session. Missing/incompatible entry metadata fails content validation. Do not present this set as a complete N5/N4 course.

Qloo context variants select relevant entities/topics and approved lesson examples without altering checked answer keys. Proper names receive supported readings where verified; unverified name pronunciation is not graded as a lesson skill. If no suitable result exists, use the app's ordinary checked theme and label it plainly. The first useful session remains possible with personalization skipped.

Content packages include checksummed manifest, schema version, lesson IDs/versions, kana/kanji/vocabulary/grammar records, exercise definitions, accepted answers/romaji variants, word segments, translations, audio IDs/durations, prerequisites, and reference templates. A build/content validation script checks references, readings/answer sets, exercise-to-target consistency, missing assets, source records, and published review status. Seed only published packages into Convex; bundle a minimal checked text starter in the APK and prepare downloadable audio on first connected setup. Published versions are immutable; revisions get new versions so old attempts stay interpretable.

The shared curriculum registry indexes checked lessons by ID and exact version. Latest-version lookup is for new sessions; saved events, assessment jobs, review cards and speech sources resolve their pinned version. Unknown versions never fall back to the first/latest lesson. Protocol-only conversation/review/reference activity validates without inventing a learning lesson; library listening resolves the version embedded in its checked clip key. Native append derives later events from the durable starting snapshot, and the daily handoff reads that snapshot from SQLite rather than waiting for a React update. Shared speech cues bind words, sentences and the distinct own-sentence prompt to the selected lesson. Model audio is scoped by lesson/version. All seven starter templates have checked v1 lessons, audio and manifests: requests, directions, favorites, availability, desire, ability and try. Whole-word glosses remain separate from individual kanji meanings where they differ. Tutor targets and the reviewed-language tool use the pinned version; free conversation can consult all seven. Availability's N5 preview links requests and desire links favorites. N4 ability and try require early N4 with explicit support pinned to desire v1 and ability v1 respectively. Desire/ability/try Android interaction and offline checks remain open.

### Home and Session Runner

Implements `prd.md > Home and Daily Plan` (HOME-1–HOME-3), `Screens and Layout`, and `The Core Journey`.

Home reads an account-scoped local projection reconciled with cloud updates. It shows one primary Start today's session, due counts/Start review, the recommended theme/target/outcome, continuation, time/streak, level/JLPT strengths/practice needs, and saved-reference shortcuts. Cold-start offline reads SQLite without waiting for a cloud query. Fresh accounts show the first eligible supported session and explain future reviews. Missing offline packages lead to connect-once preparation guidance.

The runner snapshots lesson/version, context provenance, target words/pattern, support preferences, and exercise sequence. Proposed short-session default: begin with up to eight due questions, then its 3–5 kanji, kana micropractice where needed, one pattern, speech, and optional transition into shared conversation. Remaining due questions stay visible in Review; the cap does not mark the entire queue complete. Each substep can save/pause; Continue resumes the first unfinished step. Choosing another theme/session does not destroy prior progress.

The implemented daily coordinator first saves or reuses the owned unfinished lesson, then stores the review run and its lesson handoff in account SQLite on the serialized repository queue. An unfinished run keeps its exact question IDs, draft, support flags and position through restart. Completing that set hands off to the same lesson for the current local day; returning on another day can prepare newly due questions before it. A pending sentence answer remains saved for feedback and keeps its prior schedule, while other ready questions and the lesson remain usable. Preparing or finishing the capped set neither completes leftover reviews nor awards lesson completion or mastery. A failed plan write preserves the saved lesson and permits a retry.

Keep `exerciseCompleted`, `initiallyLearned`, `speakingPractised`, `conversationEnded`, `goalEvidence`, and `mastery` distinct. A session may have an ended chat and an unpractised target. Only the actually completed sections advance. A recap/reference can exist for partial work; the runner never invents completion to close a session. The first fully completed learning session triggers the optional reminder offer.

### Answer Evaluation and Learning Evidence

Implements `prd.md > New Kanji and Active Recall`, `Grammar Teaching and Sentence Practice`, and `Beginner Support and Kana Foundations`.

`packages/learning-core` normalizes/checks fixed answers using versioned content definitions. English meanings use Unicode normalization, trimming/case/approved punctuation handling, and explicit aliases. Word readings compare approved kana variants, with consistent hiragana/katakana normalization; beginner romaji uses checked aliases/transliteration rules and records `inputScript: romaji`. Do not accept unrelated readings or broad fuzzy matches. A romaji answer can advance word-reading recall while contributing no kana-literacy evidence.

Sentence tiles/gaps/multiple choice use exact approved constraints and meaning-compatible alternatives. Open typed/spoken sentences first check recognized approved forms, then request AI assessment for novel language. When offline/provider-unavailable, novel answers remain Awaiting feedback. Valid different grammar is `validAlternative`, with the target still unobserved. Record `independent`, `assisted`, `incorrect`, `dontKnow`, `unassessed`, and `pending` distinctly. Unavailable audio/transcription never becomes incorrect.

Every attempt carries support flags (word bank, pattern hint, revealed example, exposed tested reading, suggested reply, transcript edit), original input, normalized answer, input mode, checked target IDs, content version, and assessment source. A correction reveals answers, so its within-session retry remains practice evidence and cannot immediately produce an independent mastery advance. Show confirmation/correction, short reason, expected answer, optional audio, and a return after other questions.

The AI assessment result includes overall validity, target-pattern status, cited learner-message ID and exact supporting span, correction/explanation, and assistance state. The server validates that evidence belongs to a submitted learner message and matches its span; assistant output, quotations about a pattern, unrelated substring matches, and topic selection do not establish use. The semantic rubric checks appropriateness and task/context, including appropriate use after a topic change. Disagreement/invalid response becomes needs-feedback, with retry, rather than success or a wrong-answer penalty. Automated rubric tests cover the learner's changed-topic and valid-alternative cases.

### Review Scheduling and References

Implements `prd.md > References, Flashcards, and Spaced Review` (REV-1–REV-4).

Use a small deterministic, versioned stage scheduler for the MVP; shared pure TypeScript functions run locally and on Convex. This avoids making the AI a review scheduler. The following are app-defined implementation defaults accepted with spec approval, not efficacy or exam guarantees:

| Event | Schedule/evidence update |
| --- | --- |
| Complete introduction | Initially learned, stage 0, first review in 4 hours |
| First eligible due independent correct recall on an open opportunity | Close it and advance one stage; next intervals: 4h, 8h, 1d, 3d, 7d, 14d, 30d, 90d, capped at final stage |
| First eligible due incorrect or I don't know on an open opportunity | Close it and drop one stage, minimum 0; next review within 4h; retry after at least two other questions in the current practice queue |
| First eligible due assisted correct on an open opportunity | Close it and preserve stage; review within 4h; record assisted evidence |
| Extra practice or same-session retry | Record effort/results; do not advance scheduled stage |
| Later answer on an already-closed opportunity | Record effort, original-day streak activity, and success/mistake evidence; leave its resolution, earned schedule/mastery, and descendants unchanged |
| Pending/unavailable | Preserve prior schedule and mastery; record pending/unassessed state |
| Grammar initial practice | First follow-up in 1d; independent due sentence/target use advances through 1d, 3d, 7d, 14d, 30d, 90d |

Define stage indexes explicitly in code: introduction sets index 0 with `intervals[0]`; an eligible due independent pass sets `min(index+1,last)` and uses that resulting index's interval. Eligible review errors/assistance use `min(stageInterval,4h)`. These transitions apply once to an open opportunity; the Offline Repository component defines its immutable closure. Introduction of an existing track does not reset its schedule. Never count correction retries as newly due independent opportunities. Meaning and word-reading tracks have separate IDs/state. Kana literacy and grammar-use tracks have their own evidence and scheduling. Saving a checked lesson sentence creates separate phrase meaning/whole-sentence reading cards, pinned to that lesson version and deduplicated by example ID. This save creates no recall, grammar or mastery result. The client supplies its advancement/save event IDs when preparing canonical reviews; the server rejects preparation until all those source events are present, so a successful early request cannot cache an incomplete source snapshot. Novel sentence feedback and later review feedback share the pinned lesson target and grading generator.

Display a strong/mastered recall status only with stage ≥6 (the final stage, index 5, for the shorter grammar ladder), at least five qualifying independent successes on distinct local days since the latest accepted lapse, and at least 21 days since introduction. A lapse accepted on a new current opportunity can remove that status. A late mistake on a closed opportunity informs weak-area practice without deleting earned qualifying successes or changing mastery retrospectively. A session completion, imported familiarity, immediate repetitions, romaji literacy inference, or speaking attempt cannot award unrelated mastery. Keep progress UI explainable and identify these thresholds as app-defined; label unacknowledged offline schedule/mastery projections as provisional.

References store checked pattern/word examples and the learner's accepted corrected sentence, with audio availability. Lessons' grammar reference indexes prepared pattern names, Japanese forms, English purposes, and level locally for simple offline search. Sentence taps show the prepared word/reading/meaning segments and relevant grammar; unassessed new conversation breakdowns remain labelled as generated feedback. Saving a conversation phrase first checks its text/readings/meaning; questionable readings remain Awaiting feedback. Approved phrases enter Review; pending ones remain references/drafts. Dedupe saves by account and normalized text/content ID while retaining sources. Missing generated audio does not prevent text flashcards; show actual availability. A new content version never silently rewrites an old assessment's answers.

The implemented offline grammar index exposes all seven checked v1 patterns. The first five are N5; ability and try are N4. NFKC-normalized Japanese, romaji, English purpose and level searches work locally, with an explicit empty result. Home, Lessons and expanded checked sentence segments open the same detail route. Library playback uses account-owned `audioActivity` with lesson `library`, protocol version 1, session `library-<contentId>-v<version>` and step `library:<contentId>:<version>:<clipId>`. Shared validation binds it to an actual checked clip and listening-only spans. It needs no invented lesson session and awards no answer, speaking, grammar or streak evidence; ordinary span union handles listening time.

Checked model audio is available from the saved lesson reference and optional post-answer review feedback. A recall question does not expose its model reading before submission. Review feedback resolves audio only from its exact supported checked content version, or from that account's approved saved phrase. Playback records actual listening, with no recall/speaking grade. Review listening uses `audioActivity`, lesson `review`, and step `review:<trackId>`; local validation allows listening spans only and the server requires the owned track. Retrying an uploaded activity ID is idempotent. Its time participates in the existing overlap union, while the immutable review result and schedule remain separate.

The implemented grammar-review feedback job snapshots the owned immutable review attempt, actual assistance and checked card version. Fixed approved answers remain deterministic/offline; novel answers queue assessment only after their canonical attempt has synchronized. A 60-second claim lease, at most three explicit generation attempts and a source/claim check before budget reservation bound work. Queued/running/ready/unavailable metadata and generated corrections travel with revisioned receipts. A ready semantic grade re-enters the ordinary transactional review decision: it can close only its still-open eligible opportunity; a competitor's permanent closure and descendants remain unchanged. A resolved child can wait for its offline parent without losing its grade. Unavailable/uncertain feedback preserves the earlier schedule and permits retry. Completing a submitted pending attempt earns effort/streak credit, while network waiting earns no study time. The native feedback history remains available after finishing the review and offers a correction-assisted extra-practice retry, never an immediate independent schedule advance. Romaji renderings do not prove kana literacy or pronunciation.

### Speech Recording, Transcription, and Model Audio

Implements `prd.md > Pronunciation and Spoken Input` (SPK-1–SPK-3) and its microphone/transcript/audio failure states.

Expo Audio supplies individual-word/sentence playback, slower playback where the tested platform supports it, recording, replay, stop, and retry controls. Save retained recordings/downloaded audio in the documents directory, not temporary cache. Request permission at the first recording. Permission denied offers Type instead, Enable microphone, and listening. Stop/release recording when leaving the activity/backgrounding; continuous background voice is out of scope.

The first implemented audio increment checks/copies public model files by SHA-256 into documents storage, keeps private attempts under an account/deployment hash and validates their single AAC audio track and media duration. Capture targets 29 seconds to leave framing/stop headroom below the 30-second acceptance bound. Audio activity spans preserve original dates and union with other active study time without awarding recall or grammar evidence. Whisper remains a separate integration gate; the learner confirmed Workers Free on October 14 and supplied its scoped token. Disable the free-only flag if that account plan changes.

Proposed limits: discrete clips ≤30s and ≤2MiB, supported MIME/container verified on real Expo recordings. Upload through an authenticated Convex HTTP action with attempt ID and body-size validation, attach the stored blob to that owned attempt, and schedule the server transcription action. Never put base64 audio in an ordinary Convex mutation argument. Node transcription loads the stored blob, routes Whisper through AI Gateway, and stores text/segments/status. The app subscribes/polls its owned job and saves feedback locally.

Keep `recognizedTranscript`, `learnerConfirmedText`, `wasEdited`, and `recognitionStatus` distinct. The learner can inspect/edit before answer assessment. An edited transcript is written-language evidence; it is not a pronunciation score. Silence/empty/uncertain recognition offers Record again/Edit/Type, with speaking unassessed. Recording/playback time is useful effort offline; transcription waits. A technical recognition failure does not downgrade meaning/reading mastery.

The implemented upload protocol prepares an immutable account-owned recording ID/hash/byte count, accepts a bounded binary stream at `/speech/upload`, verifies one AAC audio track and media duration, then attaches private storage to a leased job. Three explicit generation attempts are allowed; duplicate upload/request IDs share the existing work. User deletion leaves a separate tombstone even if it arrives before preparation, so a delayed request cannot recreate it. Terminal results remove the blob; generation-specific 24-hour expiration and an hourly orphan sweep cover interrupted work. The sweep starts at 23 hours to leave room for the hourly cadence and retains one fixed cutoff while paginating. A cleanup task for an older generation cannot cancel its replacement. Owned public results omit raw audio URLs, provider traces and hashes. SQLite caches recognized and learner-confirmed text separately, queues explicitly requested offline recognition/deletion, and returns confirmed sentences to the lesson or shared chat composer without automatically submitting them. Edited text retains its assistance flag.

Whisper dispatch requires the human-confirmed Workers Free flag, the configured Gateway identity and an atomic reservation for each actual request. Conservative project ceilings are 100/day and six/minute; per learner 30/day and three/minute. Each accepted ≤30-second container reserves 24 neurons and failures retain their reservation for that UTC window. The account's Workers Free limit remains the final boundary for outside app usage; a plan change requires disabling this path. Gateway routing and payload logging controls are mandatory; a successful HTTP response without a Gateway receipt is not accepted as recognized evidence. Listening spans are capped by the remaining clip duration/rate so a delayed native status cannot keep earning time.

Prepare short model audio from checked text/reading scripts through Gemini TTS via Gateway, inspect output, and publish it with content hashes and transcript IDs. Reuse prepared clips across sessions; speech readbacks of new approved chat phrases are generated on demand and cached by text/voice/version. Audio quota failures retain text and retry/listening-reference paths. Use one tested prebuilt voice initially; no cloning or richer-voice flow. Raw learner audio is local by default; uploaded transcription blobs are private and deleted after success/terminal failure, with a 24h cleanup backstop. Keep a pending local recording until feedback/retry is resolved; user-initiated deletion is available for recordings. This retention policy is a proposed technical default.

Saved-phrase readbacks use an owned approved phrase snapshot and `kore-v1`; saved references already deduplicate normalized Japanese. Two bounded attempts share a cached job. Each actual Gemini dispatch reserves capacity against the shared total ledger, including a separate audio-only transcript consistency check whose prompt omits the expected reading. Unsupported scripts, invalid PCM WAVs, missing Gateway receipts and mismatched transcripts never produce a playable asset. The private `readbackAssets` result supplies only status/hash/size/duration; authenticated `/speech/model` streams the owned checked WAV without publishing a file URL. Native storage verifies the hash and stages the clip under the account/deployment partition before saving availability in SQLite. Listening contributes only active time, using its original conversation segment when cached or the owned checked reference otherwise. It awards no recall, grammar or streak evidence. Account deletion must remove owned generated blobs, local phrase-audio files and metadata alongside private recordings. The hourly sweep removes abandoned generated objects using their dedicated MIME marker, preserving ready cached assets.

### Tutor Agent, Conversation, and Qloo Context

Implements `prd.md > One Free-Conversation Mode` (CON-1–CON-5).

Standalone and lesson entry use one conversation record/UI, with saved practice segments inside a conversation. Current topic, accepted level, actual vocabulary/grammar evidence, confidence preference, optional lesson targets, and a bounded message history form the server prompt. Imported WaniKani familiarity can guide vocabulary but is not a grammar/speaking rating. Keep Japanese short and appropriate, supply English support/readings as configured, and make hints/translation/corrections available. The learner may change topic/end freely.

A bounded AI SDK agent exposes read-only tools: `findConversationContext` and `lookupReviewedLanguage`. For the first topic it chooses ordinary conversation, a broad interest or a learner-named favorite, plus a bounded query and allowed entity category. The context tool encapsulates real tag/entity resolution and Insights, keeping the signal-ID handoff on the server. Ordinary mode makes no Qloo request. Select an applicable returned tag with an exact normalized label; otherwise return no matching signal rather than guess. Normalize the app's Shrines chip to the provisioned shrine lookup. A named favorite with multiple unresolved candidates requires the learner's choice; only the actual confirmed ID can signal Insights. Validate schemas/type allowlists and scope each invocation to the authenticated account/session. At most two tool rounds/three model generations per user turn; at most three Qloo calls when new context is needed, then reuse relevant private cached context. Tools cannot accept arbitrary URLs, access other accounts, write mastery, purchase services, or run code. App actions—not model tool assertions—commit learning results.

Use real Qloo IDs and return small structured context plus provenance. Places/shrines use `urn:entity:place`, manga `urn:entity:book`, anime `urn:entity:tv_show`/`urn:entity:movie`. Broad chips remain valid app interests even without Qloo matches; resolve tags rather than inventing IDs. Show disambiguation for specific favorites. Explain recommendations from actual chosen inputs and optional Qloo explanation fields. Save dislikes and omit those contexts later. If the chosen topic changes, prioritize it; do not force an old interest/lesson subject.

Implemented context records keep decoded candidates, recommended entities, resolved input names and lookup dates with the owned tutor message. Confirmed identities are saved separately by account/query/type and can be removed in Profile. A choice must match an offered identity; it cannot submit an arbitrary cultural ID. Private decoded cache entries are reusable for 24 hours, separated by host/decoder/parameters/dislikes; absent access does not report a cached lookup as available. Choosing contexts or preferences produces no learning evidence.

Later turns also receive up to ten real recommendation snapshots from the last ten messages in the same owned, immutable job snapshot. Only non-stale assistant records can supply source IDs; learner text, disliked contexts and older out-of-window records cannot. Validate citations against newly fetched or those retained sources. If an earlier source is used again, save its original input names and check time beside the new reply; do not label it as a new lookup. New lookups supersede older snapshots with the same ID. Topic priority remains under the conversation rules.

Conversation begins with a durable user topic/message in an active segment. Turn IDs dedupe network retries. Allow one pending reply in the active segment; preserve edits/drafts while waiting. A request snapshots conversation revision, segment ID/revision, and source-message IDs. If it ends or changes before the result returns, retain the result as a stale/draft record in its original segment rather than append it to the new one. Retry uses the original user-message ID with a new bounded generation attempt; completed assistant messages are never duplicated. A job claim/lease prevents concurrent duplicate generation; transactionally check status/revision again before commit. Recovery of stuck jobs is bounded and may require user Retry.

Ending chat saves the active segment's `endedAt` and actual effort immediately, then queues its recap/evidence job against a fixed message snapshot. Its status can be recap pending or recap ready. A simple saved-message summary/reference remains available if generation fails; do not pretend a generated assessment exists. Lesson goal state is `notObserved`, `assisted`, `independent`, or `awaitingAssessment`, with evidence IDs. Appropriate target use on a new topic counts; unrelated valid language does not. Ending a chat never sets mastery. A recap with no target use says it remains unpractised and offers Practise this pattern in the same chat.

The recap output schema follows the immutable pending-candidate snapshot. With no pending candidates it requests a summary only and retains existing evidence. Otherwise it restricts assessment IDs and maximum count to those candidates; duplicate IDs and unsupported source evidence are still rejected. A recap cannot replace an accepted goal by reassessing unrelated conversation history.

Practise this pattern or Continue conversation on an ended segment calls an explicit continuation transition, creating a new segment ID under the same conversation and shared chat UI. It preserves the earlier completion, recap, time, pending assessment, and message evidence. The new segment references the eligible lesson targets and has its own active state/revision. Resume unfinished chat instead resumes the existing active segment. Recap/evidence jobs commit only to their source segment; a delayed old recap cannot replace the current segment's recap. Lesson-goal evidence can aggregate appropriate use across linked segments without rewriting previous practice time or counting one turn twice.

The AI adapter exposes typed conversation, sentence assessment, recap, transcription, and synthesis capabilities; provider-specific payloads stay in adapter transports. Validate result objects before use and keep schema-invalid output from becoming skill evidence. The demonstration changes a server configuration between two configured conversation providers, then repeats the same beginner conversation and real Qloo tool operation without editing learning code. Record provider/model/request IDs in private integration evidence; provider/model names do not clutter learner flows.

### Active Study Time, Streaks, and Skill Progress

Implements `prd.md > Daily Goal, Streaks, and Progress` (PRO-1–PRO-4).

Capture bounded active intervals after explicit learning interactions: typing/answering, feedback review, reading interactions, audio playback, or recording. Route opening/topic selection alone starts no credited interval. Keep timers monotonic within a running app; persist completed chunks at least every 15s and on navigation/pause/background. For interaction-led reading/thinking, stop credit 30s after the last interaction and resume on a new one. Actual audio/recording progress supplies its duration while the practice view is foreground. Network waiting and inactive/background screens add no time. This is a transparent activity-based estimate, not a claim to measure attention perfectly.

Store UTC start/end, local-day/timezone/offset, and activity tags. Union overlapping intervals for total daily active time; listening/speaking tags provide separate skill-time summaries without being added twice. Split spans crossing local midnight into their original local days. On two-device sync, union overlapping real-time spans instead of summing them blindly. Large/impossible clock jumps are flagged and retain raw attempts for reconciliation; do not silently move yesterday to today.

A completed review attempt or lesson exercise earns a meaningful-step event even if incorrect/assisted. A substantive Japanese chat turn earns it when the submitted learner response is genuine Japanese practice, including supported romaji/suggested Japanese in context. Topic-only English prompts do not. Fixed reply/lesson checks can establish this locally; novel uncertain turns await assessment. Preserve active effort while evidence is pending. Derive streak from original local study days; the full minute goal is a separate boolean. The six-of-fifteen-minute example must pass.

Skill summaries aggregate evidence for vocabulary/meaning, word reading, kana, grammar, listening, and speaking separately. Imported familiarity is its own layer. Listening quiz responses can establish comprehension; playback alone is practice time. Recording is speaking effort; confirmed recognition/target use is separate evidence. Weekly summaries/recommended weak-area practice use recurring assessed errors, never infrastructure failures. Local reminders use the learner's selected time and are rescheduled after timezone/preferences changes, canceled on sign-out, and requested only after the first completed session.

### Offline Repository, Assets, and Reconciliation

Implements `prd.md > Offline Study and Reconnection` (OFF-1–OFF-4).

SQLite is the account-scoped read/write entry point for offline-capable learning. A local transaction appends an immutable event, updates its projection, saves resume position, and adds an outbox item. The UI acknowledges only after commit; failure keeps the answer on screen for retry. Download a content manifest and files to a staging location, verify hash/size/references, and atomically mark a package ready only when mandatory assets are present. Text-only availability and missing audio are explicit. Low storage or interrupted downloads leave the previous ready package intact.

Account write transactions use a dedicated Expo connection to the exact same account/deployment file, retaining its open options with `useNewConnection: true`. Configure a five-second busy timeout before `BEGIN IMMEDIATE`, then run all transaction statements on that connection. This reserves the writer before any immutable-cache reads; Expo's deferred exclusive helper otherwise permits another handle's commit to make the read snapshot impossible to upgrade. Commit or roll back atomically and close the dedicated connection, preserving the original task/commit error if cleanup also fails. A failed begin never runs the task or attempts rollback. The parent connection remains open; account file names, schema and review rules do not change. A busy timeout is bounded recovery, not a promise against indefinite lock holders. [SQLite isolation](https://www.sqlite.org/isolation.html), [transaction modes](https://www.sqlite.org/lang_transaction.html).

The implemented first package pins the shipped checked `requests` v1 text snapshot and 11 checked WAVs. `content.getPackage` returns that published manifest and public file URLs; publication/upload functions are internal administrator operations and validate every storage file before committing. Manifests carry no learner or raw Qloo data. The preparation CLI checks source/audio records, supports a local check without secrets/network, and refuses changing an existing published digest. Storage checksum normalization handles the observed canonical base64 representation as well as hex, without truncating SHA-256.

Native preparation uses account/deployment document directories and the existing account SQLite metadata. Downloads are bounded to declared bytes, verified in staging and activated by a ready pointer only after every required file is present. A crash before that pointer leaves the previous package selected. Startup verifies the saved manifest and each file again; interrupted staging never becomes ready. The checked public audio cache may reuse identical hashes across accounts, but ready markers and learning data do not cross accounts. Home offers prepared study offline. Text remains bundled at its pinned checked version; a partial audio cache is described as text/available-audio support rather than a fully Downloaded package. A new content version requires the corresponding checked app curriculum; this is not remote executable lesson code.

Each event has `eventId`, `deviceId`, sequence, account binding, kind, occurrence UTC/local date/timezone, content/algorithm versions, target track, base schedule revision/opportunity ID, parent opportunity/resolution ID, result/support flags, and active spans where relevant. Opportunity records have `open`/`closed` status, due instant, stage before review, parent resolution, and, once closed, closing event ID, outcome, resulting stage/due, immutable resolution ID, next opportunity ID, and server closure cursor. Do not trust a client-supplied user ID; Convex binds incoming events to the authenticated owner. Retain IDs through retries. Batch size default ≤50 events and bounded payload; validate IDs, kinds, timestamps, target definitions, and package versions.

`sync.push` atomically inserts unseen events, classifies their scheduling effect, and assigns a monotonic per-account change cursor. Duplicate IDs return the stored receipt without applying the result twice. The event's original occurrence/date drives study history, time, streaks, and due-time validation; it does not reorder already-committed review closures. Keep the immutable attempt log separate from the server's append-only closure log.

**Closure rule:** An opportunity stays open until the first eligible graded due attempt is accepted in a server mutation. That mutation checks the current open opportunity and exact parent resolution, validates the content/result and occurrence at/after its due instant, then closes it, records its result, applies the shared scheduler once, and creates its successor atomically. Independent correct, incorrect/I don't know, and assisted correct can close it with their respective rules; extra practice, too-early/same-session retries, and pending/unavailable assessment cannot. Concurrent mutations contend on that same opportunity record, so only the first successful server commit closes it. There is no unbounded failure-aggregation window. Once closed, neither an earlier occurrence timestamp nor a later conflicting answer changes its outcome, stage, due instant, resolution ID, or descendants.

**Later stale attempts:** Accept an otherwise valid answer referencing a closed opportunity as `stale-practice`. Keep its actual success/mistake, assistance, effort, and original local day. A stale failure contributes weak-area evidence and can recommend extra practice or a fresh due review; it does not downgrade the current schedule, remove earned mastery, or invalidate later acknowledged opportunities. Do not silently rebind that old answer to the currently open opportunity. A failure answering the new current opportunity can still lower its stage normally. Thus a phone returning with an old failure after another phone has completed weeks of reviews cannot undo those weeks.

**Offline chains:** The phone provisionally closes its cached open opportunity with its first eligible attempt and uses the same pure schedule transition. Define the resolution ID from opportunity ID, closing event ID, result, and algorithm version; define the successor opportunity ID from track/version and that resolution. Exclude server receipt time/cursor from these IDs, so a valid offline chain matches the server when accepted. Process a batch in parent-before-child order, then original occurrence/device sequence/event ID for competing candidates within the batch. Accept successive due attempts on the matching chain, including multiple offline reviews; a lost acknowledgement/retry returns the same closures. If a parent event has not arrived, retain descendants as `awaiting-parent` without a schedule effect and reprocess them when the parent is classified; a missing parent alone is not an invalid answer.

If another device already closed an ancestor using a different event, classify the conflicting unacknowledged branch and its descendants as stale practice. Preserve every result, time, date, and evidence record, but do not apply that branch's provisional advances to the acknowledged schedule. Show: Your study was saved. The review schedule changed on another device; these attempts count as extra practice. Offer the current due queue. This is an explicit offline limitation: local advances are provisional until server acceptance, while acknowledged advances are never rolled back by a late branch. There is no claim that conflicting first-arrival orders produce the same winning result. First server commit chooses the permanent result; invariants are one closure, retained effort, and no retroactive rewriting.

The phone rebuilds from acknowledged closures in server cursor order, then overlays eligible still-unacknowledged local attempts provisionally. It must not replay all attempts by occurrence time to regenerate an already-closed chain. The server can recompute study-time/weak-area summaries for late original-day activity without changing closed schedules. Tests cover both competing arrival orders with the corresponding winner, weeks-late failures, a failure closing first followed by a stale success, valid multi-step offline successors, divergent provisional branches, missing parents, and duplicate/lost acknowledgements.

Study-time uploads for review answers and review model-audio playback wait until the account has acknowledged that track's introduction. The local outbox keeps their original rows while the dependency is missing, lets unrelated study upload, and releases eligible rows in insertion order within the 50-row batch limit. Another track's or account's marker cannot satisfy this dependency. Retry retains the same event IDs and original occurrence/date/spans; it never turns playback into an answer or closure.

`sync.pull` returns changes after a stored cursor, paginated, including acknowledged schedules/profile/sessions and invalidation versions. The phone applies remote changes plus still-unacknowledged local events in a transaction, preserving local drafts. A crash/lost acknowledgement simply replays the same IDs. Deletes/invalidation use explicit tombstones, never a missing-page assumption. Keep account data partitioned and clear active caches on account switch. Preference edits use revision checks; a conflicting edit is retained and visibly refreshed rather than silently overwriting a newer choice. Session resume fields merge completed-step sets; preserve distinct sessions/conversations.

Incoming study/review cache writers share the transactional page contract: at most 50 strictly ordered cursor entries, immutable event/change identities, and a cursor that cannot regress on an old replay. Rows, canonical review acknowledgements and ready-track markers commit with that cursor or all roll back. A review push acknowledgement remains delivery state 2 until its canonical pull entry commits as state 1. Study pages, reference caches and sentence feedback retry on the existing explicit/periodic retry signal even if their server query value is unchanged.

First login/verification requires internet. Remembered accounts can enter prepared offline study while token refresh is unavailable; cloud synchronization requires a connected authenticated server with a matching current account. If the session is revoked on reconnect, quarantine local work and require the same account to sign in before upload. Pending AI answers/recordings remain pending through reconnect and are assessed once by job/attempt ID. New Qloo/AI replies/imports/recovery stay online. No content/progress has been prepared means connect once, with no fabricated due queue.

### WaniKani Familiarity Import

Implements `prd.md > Onboarding, Placement, and Preferences` and the optional import boundary.

Take a read-only personal token through the authenticated Android import flow. The server reads user/assignments and resolves matching subjects for the prepared catalog, respecting pagination/rate responses and actual returned access. Store subject ID, type, characters/word mapping, SRS stage/started-at/import time as external familiarity. Do not import account credentials, proprietary lesson prose, or local mastery; do not write reviews back to WaniKani. Invalid/expired token offers Retry/Skip, leaving prior import intact. Discard the token after the import. Grammar/listening/speaking checks remain independent.

The implemented optional flow is available in onboarding and Profile. Resolve only checked-catalog kanji/word slugs, then fetch assignments for the returned matching subject IDs. Retain only non-hidden subjects within the user's actual `max_level_granted`, with a started assignment and SRS stage 1–9. A complete candidate atomically replaces the account snapshot; missing, inconsistent, truncated or rate-limited pages never replace prior data. A per-account generation fence and 45-second lease prevent concurrent/stale publication; removal advances the fence and cannot be undone by a delayed result. A scheduled expiry carries only owner/generation, with no token. Credentials remain in the current request, are cleared from the native field on submit/background, and are absent from stored snapshots/jobs. The tutor can reuse up to twenty matched word/kanji hints at the accepted level, with all support and independent skill checks retained. No review, study-time, streak or mastery event is created by import. Real import/refresh with limited access and tutor use pass; real pagination beyond the available single-page account and native acceptance remain open, as recorded in build evidence.

### Landing and Distribution Surface

Implements `prd.md > Web Landing Page`.

Static Next.js copy/screens explain the learning loop, reference identity, Android compatibility, build version, sources/privacy information, and APK installation. A download link points to the real signed build. Keep setup/domain association/app-opening handoff as small infrastructure files; no web learner dashboard, progress, flashcards, or account forms. Final name/domain/contact/build URL are publication values, not invented brand decisions.

## Data Model

Convex owns shared records; SQLite mirrors only the current account's required content/projections plus local drafts/events. Exact field validators/indexes follow this model; auth tables come from Convex Auth.

| Record / main key | Contents and update authority | Local persistence / return behavior |
| --- | --- | --- |
| Auth library tables | Users, password accounts, sessions, verification/rate limits; Auth library only | Tokens in SecureStore; never mirror password/hash/token tables |
| `learnerProfiles` / user | Onboarding, chosen level/goals/JLPT target, time, interests/dislikes, settings, revisions | SQLite profile snapshot and pending edits; resume setup |
| `placementAttempts` / user + attempt | Bank version, answers/assessable domains, explanation, accepted/adjusted recommendation | Fixed bank and saved responses available locally |
| `contentPackages` / package + version | Published manifest, checked content/answers/sources/assets; seed/import tooling | Ready downloaded package immutable; never private Qloo payload |
| `learningSessions` / user + session | Lesson/version/context snapshot, target IDs, completed steps, resume point | Local session record; merge actual completed steps |
| `studyEvents` / user + event | Immutable attempts/activity; separate scheduling receipt: applied, stale-practice, extra-practice, awaiting-parent, or pending-assessment | Durable local log/outbox; IDs/results/original dates survive restarts/retries |
| `reviewOpportunities` / user + track + opportunity | Open due snapshot or immutable closing event/result/resolution, successor and closure cursor; server closes atomically | Cached acknowledged closures plus clearly provisional offline closures; late failures cannot rewrite them |
| `reviewTracks` / user + item + facet | Current stage/due/open opportunity/revision, qualifying days/lapses from accepted closures, evidence summary | Replay acknowledged closure log, then eligible provisional local branch; reconcile without rollback of acknowledged advances |
| `reviewAttempts` / user + event | Immutable owned review input/support/date/snapshot; revisioned schedule receipt and sentence-feedback metadata | Account SQLite `review_events`; keep delivered provisional attempts until canonical pull applies |
| `reviewAssessments` / user + event | Immutable attempt/card snapshot, queued/running/ready/unavailable status, bounded retry count/claim lease, semantic result and private Gateway trace | Cache only learner-facing receipt/feedback; no provider diagnostics or budget authority locally |
| `reviewChanges` / user + cursor | Introductions, permanent closures and revised review receipts; paired with `reviewCursors` | Apply account-local `review_changes` and cursor together; replay acknowledged changes before provisional local attempts |
| `skillEvidence` / user + evidence | Skill/target/source attempt/message, assistance/validity, assessment version | Pending/unassessed distinguishable; no unrelated mastery |
| `dailyActivity` / user + local day | Unioned time, tagged listening/speaking, meaningful-step IDs | Derived from original intervals/events; no sync-date reassignment |
| `conversations` / user + chat | Topic/revision, optional session targets, open/ended status, recap status | Local message cache/draft; saved chat resumable online |
| `conversationSegments` / user + chat + segment | Independent active/ended state, target association, message snapshot, effort and recap status | Continuing ended chat makes a new segment; earlier completion remains saved |
| `conversationMessages` / user + chat + segment + ID | User/assistant text, readings/support, request IDs, actual evidence source | Preserve sent/pending/failed/stale messages distinctly |
| `aiRequests` / user + request | Capability/job/lease/status, bounded attempts, source revision, validated output/provenance | Job status/owned result mirrored; secrets/raw provider diagnostics private |
| `speechAttempts` / user + recording ID | Immutable source/hash, upload/job lease and bounded retries, recognized/confirmed text, deletion tombstone; temporary blob reference removed at terminal state | Partitioned private recording and recognition cache; explicit offline request/confirmation/deletion |
| `speechReservations` / deployment + operation | Atomic UTC-day/rolling-minute free-only Whisper capacity; conservative retained neuron bound | No authority to dispatch or raise quotas locally |
| `speechDeletions` / user + recording ID | Prevent deletion-before-preparation/upload races from recreating an attempt | Local deletion outbox survives offline restart |
| `readbackAssets` / user + checked phrase + voice version | Immutable checked phrase snapshot, owned leased generation/check job, validated private WAV/hash; raw traces server only | Partitioned persistent phrase audio and hash metadata, available offline after preparation |
| `savedReferences` / user + reference | Lesson sheet or validated saved phrase, sources/checked readings/audio availability | Available offline; pending phrase does not become approved review card |
| `waniKaniImports` / user + import | External familiarity snapshots and completed/failed import summary | Familiarity summary cached; token never mirrored |
| `qlooContextCache` / cache key | Resolved IDs, private result/context/explanation, fetched time, input hash | Raw responses remain server-only; persist only app-owned learning references unless terms allow more |
| `syncChanges` / user + cursor | Acknowledged changes/tombstones for incremental pull | SQLite cursor updated only with applied transaction |
| `serviceBudgets` and `usageReservations` / deployment + service + window | Authorized free bounds, generation/clip/token reservations, observed usage, expiry/reconciliation; server only | No local authority to raise limits; every online capability reserves capacity |
| File storage / owned attempt or content asset | Checked public lesson audio; private temporary transcription blobs | Private recordings/docs directory with manifest; explicit availability |

Indexes cover owner+event ID, owner+track, owner+track+opportunity ID, owner+opportunity status/closure cursor, owner+parent resolution for deferred events, owner+due date, owner+session/chat, request ID/status, package/version, and owner+change cursor. Every query/mutation/action verifies owner; background actions take internally derived IDs. Opportunity closure, track changes, and dedupe receipts commit atomically. Deferred receipt classification is revisioned and emitted through `sync.pull`; duplicate pushes return its current stored status. Data migration versions cover SQLite schema, content, assessment, scheduler, and sync protocol separately. A scheduler migration must preserve closed resolutions and earned evidence; it may explicitly version future open opportunities rather than reinterpret the past.

The native store currently uses SQLite schema version 4. Its forward-only migrations preserve the prior v1 profile/drafts, v2 study/outbox metadata and v3 review history; v4 adds lookup/outbox indexes only. Schema structure/integrity checks run before opening the repository. A newer unsupported schema is refused before schema/journal writes, and incompatible/corrupt files remain available for recovery. Each upgrade's DDL and version changes commit together or roll back together. No migration regenerates closures, rewrites answers, changes original dates or awards mastery. An app update is required to read a future schema; the current app must never reset its version number to an older value.

## Internal Contracts

These are planned callable surfaces, not an assertion they exist:

- `profile.get/update`: authenticated saved setup/preferences; update includes expected revision.
- `reviews.ensureLesson/ensurePhrase`: derive immutable review cards from owned synchronized lesson evidence or an approved phrase; existing tracks keep their schedules. `reviews.push/pull` implement the review part of the sync contract with a separate account cursor; `study.push/changes` retain the activity journal. SQLite delivery state 2 keeps a provisional attempt until its canonical receipt/closure change is saved as state 1. Replays use server change order before unresolved local attempts.
- `account.passwordResetEmail`: authenticated query deriving the signed-in Password account's email for Settings; returns no credential/token and performs no credential write. Both Settings and Forgot password invoke the same Auth `reset`/`reset-verification` flows.
- `content.manifest/getPackage`: published versioned content; no private results or secrets.
- `sessions.start/get`: stable client session ID, eligible lesson/version and optional context; duplicate start returns existing session.
- `sync.push({protocolVersion,deviceId,events})`: bounded batch → `{acks:[{eventId,duplicate,receiptRevision,status,opportunityId?,resolutionId?,closureCursor?}],cursor}`. Status distinguishes applied-to-schedule, stale-practice, extra-practice, awaiting-parent, pending-assessment, accepted-activity, and invalid-with-reason. `duplicate` is a delivery flag, not a new scheduling result; invalid activity is retained locally for recovery. Deferred receipt revisions arrive through pull.
- `sync.pull({afterCursor,limit})`: `{changes,nextCursor,hasMore}`; changes include record revisions/tombstones.
- `conversation.submitTurn({conversationId,segmentId,clientTurnId,text,inputMode,supportFlags,expectedRevision})`: durable user message + queued request ID; one pending reply in the active segment.
- `conversation.finish({conversationId,segmentId,clientFinishId,expectedRevision})`: ended segment + pending/ready recap from its message snapshot; no implicit target success.
- `conversation.continue({conversationId,clientSegmentId,expectedRevision,lessonSessionId?})`: idempotent new active segment under the same chat; verify ownership/targets and preserve earlier segments/recaps.
- `assessment.submit({attemptId,targetId,answer,supportFlags})`: queued once; result `{validity,targetEvidence,correction,explanation,source}` after schema/evidence checks.
- `references.save`: idempotent source-message/content association; saved card only after reading/answer validation.
- Authenticated HTTP `/speech/upload`: owned attempt ID + supported audio bytes → durable transcription request ID. Reject unsupported/oversize bodies before model calls.
- `jobs.get`: owned queued/running/succeeded/failed/pending-input result, with learner-safe messages.
- `waniKani.import({personalToken})`: authenticated, read-only, discard token; normalized familiarity/import summary.

Store app events locally first; cloud-only entry points still persist pending user intent. Expected errors use stable codes such as `OFFLINE`, `AUTH_REQUIRED`, `QUOTA_UNAVAILABLE`, `TRANSCRIPT_UNCERTAIN`, `ASSESSMENT_PENDING`, `STALE_REVISION`, and `CONTENT_UNAVAILABLE`, mapped to the PRD's continuation actions.

## File Structure

Planned additions derived from the requested starter; generated dependencies/API files omitted:

```text
kiro/
├── apps/
│   ├── native/
│   │   ├── src/app/
│   │   │   ├── _layout.tsx                 # Auth, local repository, navigation
│   │   │   ├── (auth)/                    # Welcome, signup/signin, verify/reset
│   │   │   ├── (onboarding)/              # Seven saved setup steps
│   │   │   ├── (tabs)/                    # Home, Lessons, Review, Conversation, Profile
│   │   │   ├── study/[sessionId].tsx       # Shared session runner
│   │   │   └── references/[id].tsx         # Saved sheet/phrase detail
│   │   ├── src/features/
│   │   │   ├── auth/                      # Forms, reset-link handling, SecureStore adapter
│   │   │   ├── onboarding/                # Placement and saved setup
│   │   │   ├── study/                     # Teach/recall/grammar/practice UI
│   │   │   ├── review/                    # Due/extra queue UI
│   │   │   ├── conversation/              # One chat and recap UI
│   │   │   ├── speech/                    # Recorder, playback, transcript confirmation
│   │   │   └── profile/                   # Preferences, progress, import, reminders
│   │   ├── src/components/                # Japanese readings, audio controls, learning panels
│   │   ├── src/data/
│   │   │   ├── database.ts                # SQLite opening/migrations/account scope
│   │   │   ├── repository.ts              # Atomic local events/projections/drafts
│   │   │   ├── sync.ts                    # Durable outbox, push/pull, cursor replay
│   │   │   └── assets.ts                  # Checked staged downloads/manifest
│   │   ├── src/lib/                       # Active timer, connectivity, links, reminders
│   │   ├── assets/                        # Checked fonts/patterns/minimal starter
│   │   ├── app.config.ts                  # Android permissions/package/app links
│   │   └── eas.json                       # Development and standalone preview profiles
│   └── web/
│       ├── src/app/                       # Static landing and app-opening handoff
│       ├── public/.well-known/            # Android association file at publication
│       ├── public/                        # App-owned landing assets
│       └── next.config.ts                 # Static export, no learning backend routes
├── packages/
│   ├── backend/convex/
│   │   ├── schema.ts                      # Auth and owner-scoped learning records/indexes
│   │   ├── auth.ts                        # Password provider/verification/reset
│   │   ├── http.ts                        # Auth routes and private speech upload
│   │   ├── account.ts                     # Authenticated Settings reset-email lookup; no credential writer
│   │   ├── profile.ts                     # Onboarding/settings/placement persistence
│   │   ├── content.ts                     # Published packages and assets
│   │   ├── sessions.ts                    # Session snapshots/resume
│   │   ├── sync.ts                        # Dedupe, immutable opportunity closure, deferred receipts/cursor
│   │   ├── conversation.ts                # Durable messages/end/recap jobs
│   │   ├── assessment.ts                  # Validated language/goal evidence
│   │   ├── references.ts                  # Checked saved phrases/sheets
│   │   ├── imports.ts                     # Read-only WaniKani familiarity
│   │   ├── jobs.ts                        # Status/leases/recovery/temporary-audio cleanup
│   │   └── lib/
│   │       ├── ai/                        # Server-only adapter, providers, bounded tutor/tools
│   │       ├── qloo.ts                    # GET contracts/decoders/private cache
│   │       ├── email.ts                   # Resend templates and send errors
│   │       ├── budgets.ts                 # Deployment-wide free usage reservations
│   │       └── ownership.ts               # Shared auth/owner enforcement
│   ├── learning-core/src/
│   │   ├── grading.ts                     # Fixed answer normalization/accepted sets
│   │   ├── placement.ts                   # Versioned recommendation rules
│   │   ├── scheduling.ts                  # Same stage reducer on phone/server
│   │   ├── activity.ts                    # Interval union/local-day/streak rules
│   │   └── events.ts                      # Closed-log replay, provisional ancestry/evidence helpers
│   ├── contracts/src/                     # Versioned content/event/result schemas
│   ├── content/
│   │   ├── lessons/                       # Original seven-template starter data
│   │   ├── placement/                     # Checked fixed bank and assets
│   │   ├── sources/                       # Check records/licence notices/provenance
│   │   └── manifests/                     # Published package/audio hashes
│   └── design-tokens/src/                 # Shared reference palette/type/spacing
├── scripts/                               # Content validation/seed and provider probes
├── tests/                                 # Domain, sync, auth ownership, provider rubric fixtures
├── devpost/                               # Canonical plans and HTML review companions
├── references/                            # User-supplied visual direction
├── package.json                           # Workspace checks/run scripts
├── pnpm-workspace.yaml
├── turbo.json
├── .env.example                           # Names only
├── .gitignore
└── README.md                              # Setup, architecture, APK/demo instructions
```

## External Services and Dependencies

Checked source details are in `spec-research.md`, `qloo-integration-research.md`, and `service-contract-research.md`. Documentation support and authenticated acceptance are different; the following probes run before dependent feature slices are declared working.

### Convex and Convex Auth

Use generated Convex function references through its client; account-scoped mutations are transactional, external I/O belongs in actions. Auth setup includes `authTables`, exported auth actions, HTTP routes, and SecureStore-backed provider. [Actions](https://docs.convex.dev/functions/actions), [mutations](https://docs.convex.dev/functions/mutation-functions), [Auth React API](https://labs.convex.dev/auth/api_reference/react), [Password configuration](https://labs.convex.dev/auth/config/passwords).

Password actions use `{email,password,flow:'signUp'|'signIn'}`; verification uses the configured email provider and `email-verification`; both Settings password change and Forgot password request `{flow:'reset',email}` and complete `{flow:'reset-verification',email,code,newPassword}`. There is no separate application credential-update action. Exact provider IDs/params must match the locked library. Keep tokens library-managed, enforce owner checks, and test recovery/change preserves user/history. Convex Auth remains beta. Development/production Convex quotas and file/action limits must be read from the provisioned plan; no unlimited/free production claim.

### Resend Email

Server `POST https://api.resend.com/emails`, `Authorization: Bearer <key>`, JSON `{from,to,subject,text,html}` → message `id` or error. Send failure keeps verification/reset pending with visible re-request; bounded request cooldown prevents mail loops. Use the verified domain/sender; default `resend.dev` only serves owner-address testing. Free-plan documentation lists 100/day; confirm monthly/API limits and use no automatic paid overage. [Send API](https://resend.com/docs/api-reference/emails/send-email), [domain restriction](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain), [pricing](https://resend.com/pricing).

### Cloudflare AI Gateway and Conversation Providers

**Build compatibility and transport evidence — 2026-10-13:** AI SDK 7.0.139 with Google 4.0.95/OpenAI-compatible 3.0.68 uses Node 22+. Workspace commands require Node 22.16+ (Node 24 recommended); Convex Node actions explicitly use Node 22, while queries/mutations keep the default runtime. Fixed synthetic structured-output probes passed from Node 22.23.2 through both configured providers. OpenRouter's verified path is `/openrouter/chat/completions`. This is transport/schema evidence only; the learner conversation, tool loop and target-language rubric remain required. Spending/capacity gates execute in guarded transport middleware, because SDK lifecycle callback errors can be swallowed. Gateway payload logging is suppressed while metadata is retained, caching is skipped, and each real dispatch reserves capacity before sending. Free OpenRouter routing includes a free-model constraint, zero maximum token/request prices, no paid plugins and no provider/model fallback.

**Current budget override — 2026-10-13:** The learner's Gemini project has billing enabled, and they approved US$10 total for this app's Gemini development/demo requests. `GEMINI_ALLOW_PAID` plus the explicit micro-USD limit enables that one exception. Reserve conservative request costs atomically before generation and settle only confirmed usage; pending/failed requests retain their reservations. The cap includes prepared audio, checks, tutor/assessment/recap calls and retries. Other providers retain the free-only rules below. The earlier prohibition on all paid inference is superseded only for this bounded Gemini usage.

Google native base: `https://gateway.ai.cloudflare.com/v1/{account}/{gateway}/google-ai-studio`; use `/v1beta/models/gemini-3.8-flash:generateContent` for compatible native transport. Headers: JSON content type, `x-goog-api-key`, `cf-aig-authorization: Bearer <gateway token>` when authenticated gateway is configured. Body maps messages to `contents[].role/parts`, with system instructions, declared tools/function calls, and the result schema through the chosen SDK/transport. Native text/function results come from candidate parts; normalize them into the adapter's shared contract. [Google Gateway](https://developers.cloudflare.com/ai-gateway/usage/providers/google-ai-studio/), [GenerateContent](https://ai.google.dev/gemini-api/docs/generate-content).

OpenRouter uses the Cloudflare `/openrouter` provider prefix, Bearer OpenRouter token, configured `nvidia/nemotron-3-super-120b-a12b:free`, `messages`, bounded `max_tokens`, tools, and result-format schema → chat choices/tool calls/usage. Cloudflare's URL text and cURL disagree about the additional `/v1`; probe the documented route variants in isolation, lock the successful route, and add that transport contract to its checks. No direct-provider bypass on failure. [OpenRouter Gateway](https://developers.cloudflare.com/ai-gateway/usage/providers/openrouter/), [initial model](https://openrouter.ai/nvidia/nemotron-3-super-120b-a12b:free).

Both adapters must pass the same target-language rubric, schema validation, real Qloo tool call, timeout/retry, and provider-switch checks. Limit a normal turn to three model generations and a 45s overall deadline; allow one bounded retry/fallback for transient/quota failures with the same durable turn ID. Skip shared conversation caching; private caching is allowed only for reviewed reusable synthesis/context. Configure gateway logging/redaction so passwords, auth/reset tokens, keys, and raw recordings never appear in logs; retain minimal request/provider/error metadata. Free provider data policies differ and must be accurately stated in the app's privacy copy before public testing.

Google currently lists a free tier for the selected Flash/TTS models; limits depend on account/model. OpenRouter documents 50/day and 20/minute for no-credit free accounts, with failed/multi-step requests consuming quota. Use server budgets per account/turn and a free-only model allowlist. Do not route into paid models or buy credits automatically. [Google pricing](https://ai.google.dev/gemini-api/docs/pricing), [rate limits](https://ai.google.dev/gemini-api/docs/rate-limits), [OpenRouter limits](https://openrouter.ai/blog/tutorials/how-to-get-the-lowest-cost-llm-inference-on-openrouter/).

Enforce deployment-wide service/window budgets as well as per-learner limits. An atomic reservation is required before every actual model generation, including tools-loop steps, retries, fallbacks, sentence assessment, recaps, transcription, and synthesis. OpenRouter's proposed project ceiling is 40 model requests/day and 15/minute, leaving headroom below the documented no-credit allocation. Gemini text/TTS and Workers AI reserve request/token/audio/neuron upper bounds from the provisioned quotas and configured output/clip caps; failed requests still consume conservative capacity. Reconcile known actual usage without prematurely releasing a reservation for an uncertain timeout. A conversation-provider switch does not reset speech or project budgets. Serialize concurrent reservations, reset windows on the provider's documented clock, and test all capability paths under a nearly exhausted shared budget.

Use dedicated project credentials and confirm actual billing/usage settings before enabling inference. For a shared paid Workers AI account with untracked outside usage, local counters alone cannot guarantee remaining free allocation: keep that capability disabled until a verifiable free-only boundary or provider-enforced cap is established. Unknown quota/cost estimates block the request and expose the PRD fallback; they do not justify paid inference. Configure no automatic upgrades, overages, or third-party Unified Billing. Speech, text generation, and TTS each need their own free-capacity acceptance check.

### Whisper and Gemini Audio

Whisper transport: `POST https://api.cloudflare.com/client/v4/accounts/{account}/ai/run/@cf/openai/whisper-large-v3-turbo`, with Workers AI `Authorization: Bearer <token>`, `cf-aig-gateway-id: <gateway ID>`, and JSON content type. Send `{audio: <base64 of original recording bytes>, language: 'ja', task: 'transcribe'}` directly, without a model/input wrapper or data-URL prefix. Turbo uses base64 here; other Whisper variants use different formats. Validate `success/result`, then read `result.text`, optional `segments[].text/start/end`, and `transcription_info.language/duration`. Do not substitute an undocumented `/audio/transcriptions` endpoint. Real M4A/AAC acceptance still needs the first Expo recording probe. [Gateway REST](https://developers.cloudflare.com/ai-gateway/usage/rest-api/), [Cloudflare transcription source](https://raw.githubusercontent.com/cloudflare/ai/main/packages/workers-ai-provider/src/workersai-transcription-model.ts), [contract evidence](service-contract-research.md).

TTS uses the Google Gateway base with `/v1beta/models/gemini-3.8-flash-lite-tts:generateContent`. Body: `contents: [{role:'user',parts:[{text:<checked Japanese>}]}]` and `generationConfig: {responseModalities:['AUDIO'],speechConfig:{voiceConfig:{voice:'Kore'}}}` as the initial voice probe. Optional delivery style belongs in each part's `speech_metadata`; it is not spoken transcript text. Decode `candidates[].content.parts[].inlineData.data` using its actual returned MIME format. Current 3.8 docs describe WAV defaults; do not prepend a second header using an old raw-PCM example. Final voice acceptance depends on checked readings/playback. Verify gateway passage, proper-name handling, truncation, downloads, and slow playback on Android. [Native TTS](https://ai.google.dev/gemini-api/docs/generate-content/speech-generation), [contract evidence](service-contract-research.md).

Workers AI currently includes 10,000 neurons/day shared across models; recognition uses that allocation and stops/falls back when exhausted. Actual plan/token limits remain account checks. Clip limits, preserved attempts, typed fallback, and prepared audio keep other study available. [Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/).

### Qloo

**Provisioned integration status — 2026-10-15:** The supplied key authenticates against the hackathon host. Live tag, search and Insights requests succeeded for anime, manga and shrines; each Insights probe returned five entities, and all five place results carried Japan's country code. Actual `/search` responses omit `success` and identify category through a single-element `types[]`; Tags/Insights retain `success: true`. Support these distinct validated envelopes, reject explicit failures/ambiguous types, and invalidate caches from the older decoder. Provisioned `/v2/tags` items use `id`, so configure `QLOO_TAG_ID_FIELD=id`. Both tutor providers have passed actual Qloo context tools and validated citations through Gateway. The new context boundary also passed live matching recommendations for all three starter interests. Native Qloo interaction acceptance and the learner hands-on checkpoint remain open. No key or raw response belongs in Git. See `qloo-integration-research.md` and `build-evidence.md` for performed checks and limitations.

For hackathon-issued keys, use configurable base `https://hackathon.api.qloo.com`, `X-Api-Key`, and GET Insights. Other keys must use their provisioned environment; do not silently retry against unrelated hosts. Calls:

- `/search?query=<favorite>&types=<allowed type>&take=5` → `results[]`; normalize `entity_id/name` and the provisioned single-element `types[]` or documented `subtype`, optional descriptions/tags. Only this route may omit `success`; explicit `success: false` or error envelopes fail.
- `/v2/tags?filter.query=<broad interest>&take=10` → `results.tags[]`; lock actual tag lookup fields with the provisioned response.
- `/v2/insights?filter.type=<allowed type>&signal.interests.entities=<resolved IDs>&take=5&feature.explainability=true`, or valid returned tag signals → `results.entities[]` plus optional explanation/warnings.

No invented category/URN; applicable country filters only for supported place queries. Keep raw/explanation cache server-private; use synthetic fixtures in the public repo. Private server caching permission does not establish offline redistribution rights. Numeric limits/key availability are provisioned checks; a hackathon key can expire after judging. Offline teaching uses app-owned checked content. [Detailed contracts and limitations](qloo-integration-research.md), [official guide](https://docs.qloo.com/reference/qloo-llm-hackathon-developer-guide).

### WaniKani

Authenticated read-only server calls `GET https://api.wanikani.com/v2/user`, `/subjects?slugs=<checked catalog characters>&types=kanji,vocabulary,kana_vocabulary&hidden=false`, then `/assignments?subject_ids=<matched IDs>&started=true`, with personal Bearer token and `Wanikani-Revision: 20170710`. This narrower order avoids importing thousands of unrelated assignments/subjects. Collections use `data[]`, `total_count` and `pages.next_url`; validate HTTPS origin, route, credentials/fragments, cycles, unique IDs and complete counts before publishing. Do not forward tokens to arbitrary returned URLs or follow redirects. Bound the import to twenty requests, thirty seconds overall, eight seconds per request and 1 MiB per body; exhausted bounds retain the earlier snapshot. Read actual subject/SRS/access fields, normalize only catalog familiarity, stop on 429/rate responses, discard token. No write endpoints. [API](https://docs.api.wanikani.com/20170710/).

### Content References, Expo, and Hosting

Original lesson authoring/source checks use dictionary and first-party grammar references. Any redistributed dictionary extracts retain their own license/notices and a Sources entry; source checking alone is not redistribution of a textbook/audio file. Check all selected font/pattern/audio assets too. [Dictionary licence](https://www.edrdg.org/edrdg/licence.html), [Irodori](https://www.irodori.jpf.go.jp/en/starter/pdf.html). Expo EAS builds/signs the APK; Cloudflare Pages serves static exports; Convex hosts backend jobs/data. Use provisioned free capacity without unapproved upgrades. Exact IDs/domains/secrets belong to setup, not fake values in the demo.

## Important Failure Modes

Implements `prd.md > States and Boundaries`.

- **Service/quota or invalid AI result:** Save learner input, prior effort, and job status; Retry/Resume later/Continue studying opens prepared reviews/grammar/references. Pending/unavailable evidence never becomes a mistake or goal success. Qloo failures allow checked generic contexts labelled accurately.
- **Speech/audio problems:** Mic denied → type/settings/listening. Empty/uncertain transcription → inspect/re-record/edit/type. Preserve readings/explanations when playback fails. Speaking remains unassessed where appropriate, and offline recording remains playback practice.
- **Storage/sync/auth problems:** Retain committed local events/place/date, bound sync batches/retries, recover by IDs/cursors, and isolate account data. No prepared content → connect-once message. Disk/full or failed local write does not pretend progress was saved. Expired auth requires the same account to reconnect; reset-email issues expose re-request.

## Verification and Integration Gates

This is the evidence `5-build` must produce, not a claim that checks already passed.

1. **Starter/auth gate:** Typecheck compatible installed modules; remove Clerk/sample routes; prove account create/verify, restart, cold/warm reset link, expiry/re-request, Settings change through the same verified email reset, same user/history, returned reset session, other-session invalidation, and two-account isolation on a signed Android build. Check that no separate old-password-validated credential writer exists; test overlapping Settings/recovery requests, duplicate/expired/reused links, interruption, invalid new passwords, and final new-password acceptance/old-password rejection. Prove Resend mail reaches a second learner address.
2. **Model/speech/Qloo gate:** Real requests through Gateway for both providers; same Japanese/target-evidence rubric and real Qloo tool trace; known wrong/alternative/quoted target/changed-topic cases; real Expo word/sentence/silence recordings; native TTS decoding and offline replay. Fail this gate visibly if a configured model is unavailable or unsuitable; substitute an agreed free option by configuration, not fake successful output.
3. **Content gate:** Seven checked templates, small kana groups, fixed placement bank, reviewed answer/breakdown sets, sources/versions/notices, inspected audio, and complete downloadable manifests. Unchecked content cannot publish.
4. **Learning/sync gate:** Meaning/reading independence; romaji without false kana evidence; independent/assisted/incorrect/pending scheduling; time/streak example; duplicate push/lost ack/restart/reconnect; late original-day activity. Prove atomic first-commit opportunity closure in both competing arrival orders, weeks-late stale failure preserving all acknowledged advances/qualifying days/descendants, failure-first with later stale success, valid offline chains, divergent provisional branches, and out-of-order parent receipt/reclassification. Also test ended-chat continuation with delayed old recap, deployment-wide concurrent/free-budget reservations across all online capabilities, and account switch/offline session expiry. Use meaningful deterministic and transaction tests here, not tests that merely repeat implementation.
5. **End-to-end gate:** A fresh learner completes supported setup, learns/practises, uses the same chat, saves reference/phrase, returns for due review, and resumes partial work. Repeat with no-kana support, denied mic, exhausted AI quota, and prepared/empty offline states. Verify every PRD acceptance criterion; keep a traceability map of component/tests to ACC/ONB/HOME/BEG/KAN/GRA/SPK/CON/REV/PRO/OFF IDs.
6. **Demo gate:** Fresh-device APK installs/launches without Metro; landing/download/link works; hosted progress persists; no secrets/private Qloo fixtures enter the public repo; reference palette/layout, Japanese wrapping, accessible font scaling, audio controls, and reminders pass device review. Prepare video/repo/event-specific submission evidence separately.

## What Was Simplified and Why

- Focused immutable starter content and a small fixed placement bank; expand the curriculum later. Cultural personalization changes checked examples/context and conversation, while teaching remains traceable.
- One chat with bounded text/discrete spoken turns and a small read-only tool loop. No continuous voice or scenario builder.
- Versioned stage scheduling, immutable server review closures, and provisional offline replay using shared TypeScript. No extra scheduling service, generic collaborative document sync, or AI-calculated mastery.
- One verified email reset path also serves Settings password changes. No custom current-password change action or unsupported cross-flow locking scheme.
- Foreground/start/reconnect synchronization and local reminders. No promise of reliable always-running background workers on Android.
- Prepared single-voice lesson audio plus optional new phrase readbacks. No pitch-accent scoring or voice cloning.
- Static landing, standalone APK, hosted Convex. Google Play comes later; web remains outside learning.

These choices preserve the entire approved loop and real integration proof. Scope is based on user value, reliability, and quality; no human coding-hour estimate is used.

## Decisions and Open Issues

### Learner Decisions Already Agreed

Android Expo learning only, Next.js landing only, TypeScript/Turborepo, Convex/Convex Auth replacing Clerk, requested starter; Resend email; SQLite/persistent files/unique-event synchronization/shared rules; Gemini primary and OpenRouter free Nemotron initial alternative; server adapter through Cloudflare AI Gateway; bounded AI SDK tutor with Qloo tools; Whisper recognition/Gemini TTS; free quotas with no automatic paid fallback; EAS standalone APK/Cloudflare Pages/hosted Convex; Google Play deferred; initial AI-assisted, source-checked lesson process; same visual reference and shared MVP for both events.

### Derived Defaults Accepted at Spec Review

The seven-template seed inventory, placement thresholds, stage intervals/mastery criteria, time-idle window, batch/clip/loop limits, temporary-audio retention, data/table organization, revised merge rules, and file structure implement the approved behaviors. These derived technical recommendations were accepted with the revised spec on 2026-10-13; they are not statements that the learner independently chose each number earlier. Any component wording describing a proposed default now refers to these accepted baseline choices. Changes affecting learner behavior or a paid service require an explicit new decision.

### Learner Uncertainty

Asked which technical part needed more explanation before drafting, the learner answered: "no, nothing come on my mind right now." No specific uncertainty was identified; no invented uncertainty or comprehension quiz is required. Integration probes and traceable feature verification still support the learner's goal of understanding the right way to carry out each feature.

### Learner Review Revisions — 2026-10-13

The learner identified a race between Settings' old-password validation and email reset. Use the offered simpler remedy: Settings also requires a verified email reset, with no separate old-password-based writer. This preserves the PRD's password-change control and account history while giving both entry points the same authorization path.

The learner also identified that unlimited failure aggregation could undo weeks of reviews when a stale phone synchronized. Replace that rule with permanent first-server-commit opportunity closure. Late stale results retain effort and mistake evidence but cannot rewrite earned progress. Shared-domain tests now assert immutability, not identical winners under reversed conflicting arrival order. Offline advances remain provisional, and a conflicting unacknowledged branch is explicitly shown as extra practice on reconciliation. After reviewing both repairs, the learner approved the revised blueprint on 2026-10-13: "yes its look good." This approved version supersedes the earlier draft.

### Setup Values and Early Checks

Final brand, domain/sender, Android package/signing identity, EAS project, actual keys/quotas, voice, build URL, gateway route variants, and locked package versions must be supplied/configured and tested during setup before dependent features are accepted. Auth helpers/link handling, real Japanese model/recording quality, Qloo tag/entity coverage/terms, and temporary file cleanup have explicit gates above. These are implementation validation gates, not missing product intentions. No paid spend, event eligibility, native-speaker review, deployed app, or functioning API access is claimed by this document.
