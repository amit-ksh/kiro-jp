---
doc: learner-profile
status: complete
---

# Learner Profile

## Initial Idea

A Japanese language-learning app for English-speaking beginners and people already learning kanji and vocabulary with WaniKani. It should connect remembering words, understanding grammar, preparing for the JLPT, and using Japanese in everyday written and spoken communication.

The learner supplied a substantial product vision. The following are requested features and preferences, not an approved proof-of-concept scope; later planning must agree on the first version and retain the wider vision.

### Submission Targets

The learner wants **one shared MVP for both the Devpost Learn exercise and a Qloo hackathon submission**, with the same complete learning experience. They explicitly rejected separate reduced/expanded product milestones and requested scope based on user value, integration reliability, and demonstrable quality, assuming AI-assisted development and without estimates of human coding hours. Check each event's eligibility and submission requirements separately.

The current event found during research is the [Qloo Agentic Hackathon](https://qloo.devpost.com/). Its [official rules](https://qloo.devpost.com/rules), checked on October 13, 2026, require Qloo API integration and an agentic tool, agent framework, or integration into an existing agent, plus a functional demo link and a public, open-source repository. The listed deadline is October 30, 2026 at 11:45 p.m. EDT, equivalent to October 31, 2026 at 9:15 a.m. IST. Treat this as the likely event until the learner identifies another edition; participation, terms acknowledgment, and eligibility have not been established. This is research context, not evidence of registration or submission.

### Requested Product Vision

- Sign-in and onboarding for Japanese level, goals, daily study time, and interests; optional placement exercises and beginner/existing-learner paths.
- JLPT paths from N5 to N1, prioritizing N5/N4 initially. Target level and optional exam date should organize vocabulary, kanji, grammar, reading, and listening. Include JLPT-style quizzes, timed practice, mock sessions, explanations, results, and revision recommendations.
- Hiragana and katakana reading/listening foundations. WaniKani-style spaced repetition for kana, radicals/kanji, vocabulary, and useful phrases, with optional WaniKani progress import. Cards should support mnemonics, audio, example sentences, personal notes, separate reading/meaning practice, adjustable new-card limits, and difficult-item practice.
- Reviewed lessons for everyday situations such as food, shopping, travel, and introductions. Include dialogues, listening comprehension, multiple-choice questions, sentence building, and written/spoken answers. Integrate grammar explanations, patterns, politeness/register, common mistakes, and a searchable grammar reference. Tapping a sentence should reveal words, readings, meanings, and grammar.
- **One free-conversation mode** supports text or discrete spoken turns, suited to the learner's level. The learner types or says a topic; it takes priority over saved interests. Qloo can enrich discussion and suggest basic conversations or interest-based scenarios/roleplay. Lessons suggest a topic, target vocabulary/grammar, and an everyday goal, then open the same chat; changing subject and ending freely are allowed. Provide hints, translations, corrections, practice time, a recap, and phrases to save. Topic selection occurs in chat, with no separate custom-scenario creation flow. Record conversation completion, lesson-goal practice, exercise completion, and mastery separately; appropriate target-language use in a new topic counts, but an ended chat alone does not establish goal achievement or mastery.
- Speech recognition, model audio, recording playback, recognized transcripts, slower playback, retry feedback, and typed fallback. Display Japanese with furigana/kana, English explanations, and optional romaji. Save words and phrases from practice into flashcards.
- Qloo-informed lesson and conversation contexts around cultural interests such as food, films, music, and places. Ask interests during onboarding and let learners update them later; the AI uses those interests to begin conversations. Explain recommendations and allow changing or disliking suggested contexts.
- Daily study plans, review queues, progress, streaks, optional reminders, and weekly summaries. Track vocabulary, grammar, reading, listening, and speaking separately, including listening/speaking time. Recommend follow-up practice from recurring mistakes; resume unfinished sessions and revise missed questions.
- Adjustable furigana, translations, text size, and audio, with accessible controls. Account recovery, learning-data export, and account deletion. Persistent cloud-backed account/progress for Android, with basic offline lessons and flashcard reviews where practical. Web is a landing page only.
- Prefer free tiers and free AI options where practical; monetization can come later. Lessons and flashcards should remain usable during AI-provider outages or quota exhaustion.

### Technology Preferences

- Expo / React Native for the Android learning app. The learner's latest direction is **Android-only learning, with Next.js used for a web landing page only**; there is no web/PWA learning journey. iOS is deferred.
- TypeScript and a shared Turborepo monorepo.
- Convex backend, database, and synchronized learning progress.
- **Convex Auth is the learner's chosen authentication direction.** The requested starter uses Clerk; address replacing its authentication during technical planning rather than reopening the learner's preference.
- Cloudflare AI Gateway for connections to AI models, through an AI adapter.
- Qloo for personalized lesson and conversation contexts.
- Requested implementation starter: `npx create-convex@latest -t get-convex/turbo-expo-nextjs-clerk-convex-monorepo`. Do not scaffold during planning; verify compatibility when preparing implementation.

### Product and Visual References

- Product inspiration: [Babbel's Google Play listing](https://play.google.com/store/apps/details?hl=en_US&id=com.babbel.mobile.android.en).
- **Primary visual reference:** `references/j-image-main.webp`. At scope approval, the learner explicitly requested its **same color palette and overall UI layout for the app**: indigo surfaces, orange emphasis/actions, rounded white panels, pill-shaped controls, white bottom navigation, Japanese pattern accents, and bold typography. Palette anchors sampled from the supplied image: `#37469E`, `#313790`, `#FF5C00`, `#F05722`, and `#FFFFFF`. Detailed learning screens still belong in the PRD, using this established direction.
- Other supplied references: `references/j-app-flashcard.webp`, `references/j-app-layout.jpg`, and `references/j-app-main.mp4`. The three still images were inspected during onboarding; the video has not yet been inspected. These do not supersede the explicitly selected primary reference.

## Demonstrated Technical and Agent Experience

Reported background: software developer. Has used Codex, Claude, and Antigravity.

Evidence: "i am software dev and i have used codex, claude, antigravity."

Experience with the specific requested frameworks and services has not been established. Naming a preferred stack does not demonstrate prior implementation experience with each tool.

## Planning-Workflow Experience

Familiar with planning first, based on answering "yes i have" to the plan-first/spec-driven workflow question. Specific planning practices and depth were not explored.

## Desired Learning Outcome

"planning the features and knowing its right way to do the task or feature."

Use real feature decisions to practice clarifying user needs, comparing approaches, defining behavior, and specifying testable outcomes. This learning intention should not add features to the scope.

## Learning Moments

- During scope, articulated a complete learning loop: due reviews, 3–5 new kanji and useful words, one grammar pattern, pronunciation practice, practical conversation, a reference sheet, and spaced follow-up. Distinguished session completion from mastery established through consistent recall over time.
- Specified that real Qloo results should shape culturally relevant contexts while Japanese stays appropriate to the learner's level. Onboarding collects editable interests and the AI begins the conversation. During the PRD interview, clarified the role of an everyday task: it is the goal of the interest-led conversation, using that session's taught language, rather than an unrelated imposed task. Examples include shrine directions, politely requesting manga, and exchanging anime favorites.
- Defined the first demo audience as beginners with no assumed kana/kanji/grammar knowledge. Placement uses predefined kana, vocabulary, grammar, and listening questions; its recommendation can be accepted or adjusted. WaniKani familiarity does not establish other skills.
- Chose one complete product milestone for both submissions, with real integration proof and persistent reviews, and explicitly deferred higher-level courses, full mock exams, continuous voice, pitch-accent scoring, richer voices, subscriptions, and iOS. Narrowed the learning client to Android and web to a landing page.
- Approved the revised scope after correcting conversation mode to AI-initiated interest exploration, adding the requirement to use the primary reference's same color palette and overall app layout.
- During PRD discovery, defined teaching before recall, word-specific reading questions, reviewed answer alternatives, assisted practice, and fair feedback for a valid sentence using a different grammar pattern. These decisions became observable criteria under `prd.md > Features and Behavior > New Kanji and Active Recall` and `Grammar Teaching and Sentence Practice`.
- Distinguished a completed chat from target-language evidence and mastery, including the changed-topic case. Also distinguished correct romaji reading from kana literacy, and active effort/streaks from mastery. These are actual learner-articulated product decisions, not evidence that implementation is finished.
- Anticipated unavailable audio/AI, uncertain transcription, partial study, offline pending feedback, duplicate synchronization, and original study dates; defined usable next actions and preserved progress. See `prd.md > States and Boundaries` and `Offline Study and Reconnection`.

## Interests, Inspirations, and Goals

- Uses WaniKani to learn kanji with flashcards. Reports finding its free learning limit restrictive.
- Reports missing examples of where to use learned kanji and lacking grammar knowledge, making practical use difficult. This is an observed learner problem to explore during scope.
- Personal goals: Japanese communication, explicitly including **both written and spoken communication**, and watching anime in Japanese rather than dubbed versions. Subtitle preferences are not established.
- Also interested in Japanese places and culture; no specific places or cultural interests have been named yet.
- Wants the app to serve English-speaking beginners and WaniKani learners in addition to its personal relevance.

## Vocabulary and Concepts Likely to Need Explanation

Not established. Calibrate to the reported developer background and planning experience; explain unfamiliar tools or tradeoffs when they arise rather than assuming familiarity with the entire stack.

## Collaboration and Communication Preferences

Wants detailed questioning about user engagement, UI/UX, and other decisions needed for a good Japanese-learning experience. Has not chosen grouped versus one-at-a-time questions or concise versus guided explanations. Continue the default guided, one-at-a-time approach until they state a preference. Avoid repeating decisions already supplied in the product vision.

## Areas Where the Learner Wants Ownership

No additional boundaries explicitly stated. Convex Auth and the primary visual reference are already chosen. Other consequential product and implementation decisions remain learner-led.

## Likely Support Needs

Help organizing a broad feature vision into a coherent first version, relating features to learning outcomes, and assessing the right approach for each task. Technical setup assistance needs are not established.

## Review Format

html — create visual HTML companions for scope, PRD, and spec reviews, with Markdown remaining canonical. Do not create an HTML build checklist.

## Notes and Open Questions

- `1-start`, `2-scope`, `3-prd`, and `4-spec` are complete. `devpost/scope.md`, `devpost/prd.md`, and the revised `devpost/spec.md` are approved with checked HTML companions. The learner approved the revised technical blueprint on 2026-10-13: "yes its look good." `5-build` is active: the seven-slice Markdown checklist is approved with the learner's reviewed sequence, including an early signed APK/App Link check in slice 1 and basic review/study evidence from slice 2. The learner chose "fast mode." Build and mechanically verify/commit each slice, pausing at the planned early, spoken/offline and final hands-on checkpoints. No application slice is complete yet. Keep the full shared-MVP objective active through implementation, reviews, revisions and the app map.
- The learner authorized Git initialization with "yes" on 2026-10-13. The workspace now has a Git repository, with no commits yet. Confirmed `.gitignore` excludes this profile, nested `.env`/`.env.*`, and `.lavish`; stage only intended project files. Git commands need the command-scoped `-c safe.directory=D:/personal/apps/kiro` in the sandbox because the workspace owner differs from the sandbox account. The sandbox exec helper then failed setup refresh; read-only escalated checks succeeded. Do not broaden trust to all repositories or change global configuration as a workaround.
- Integration evidence is saved in `devpost/spec-research.md`, `devpost/qloo-integration-research.md`, and `devpost/service-contract-research.md`. This is documentation/source evidence, not live integration proof. The learner reports Convex, Cloudflare, and Qloo access. Sender/domain, keys/quotas, package/signing identity, voice, and actual deployment/build URLs remain setup values and explicit early validation gates.
- Agreed account/offline choices: Resend free tier for verification/recovery emails; phone-local SQLite for lessons/reviews/drafts/position; persistent downloaded audio/recordings; Convex for shared progress; unique attempt IDs, original study dates, and shared TypeScript review rules. No paid budget is agreed.
- Agreed AI/speech choices: Gemini 3.8 Flash primary; OpenRouter free Nemotron 3 Super initial alternative subject to Japanese/goal-evidence checks; authenticated Convex actions with a server-configured adapter; all model requests through Cloudflare AI Gateway; a bounded AI SDK Qloo/content tool-calling tutor; Cloudflare Whisper discrete speech recognition; Gemini Flash-Lite TTS for checked/downloadable model audio. Use available free quotas with no automatic paid fallback.
- Agreed demonstration route: EAS standalone Android APK linked from a static Next.js landing page on Cloudflare Pages, with hosted Convex for independent testing. Google Play is deferred: "yeah good for now, i will do later google play part." This is a planning decision, not an installed build or published service.
- Agreed content process: "AI-assisted, source-checked process initially." No native-speaker/expert reviewer is arranged; record actual sources/check status for original lessons, answers, breakdowns, and model audio. Asked what needed more technical explanation, the learner answered "no, nothing come on my mind right now." No invented uncertainty or comprehension exercise is needed.
- The revised spec's derived defaults for the seven-template inventory, placement thresholds, stage intervals/mastery, active-time cutoff, clip/batch/agent limits, retention, event ancestry/merge rules, chat continuation segments, and deployment-wide free-capacity guards were accepted with spec approval; they were not independently chosen earlier. Independent review previously addressed reset-email handoff, offline ancestry, ended-chat continuation, and free-budget gaps. The HTML's desktop/light/dark/390px/320px controls and layout have been checked; no live-app verification is claimed.
- Technical-spec review on 2026-10-13 requested two repairs: old-password Settings changes could overwrite an intervening reset, and a late stale review failure could invalidate weeks of advancement. The approved revision uses the learner-offered email-reset remedy for Settings, removing the separate credential writer. It also uses permanent first-server-commit opportunity closure: late stale answers preserve effort/mistake evidence without changing acknowledged schedule/mastery/descendants; conflicting offline branches are explicitly provisional until synchronization. An independent focused recheck found no actionable gaps; the revised HTML passed light/dark desktop and 390px/320px interaction/layout checks with 27 canonical headings represented. These are document checks, not live auth or sync tests. The learner subsequently approved both revised Markdown/HTML; keep these fixes intact in the build.
- The approved scope carries the agreed core journey and MVP boundary. The original wishlist is retained as context, not a commitment to every feature in the shared MVP.
- HTML is the selected format for planning reviews. Learn versus fast build mode belongs at build time.
- PRD onboarding detail supplied: Welcome; account creation/sign-in; estimated level, goal, and daily study time; optional WaniKani import; optional predefined level check with "I don't know" and an adjustable recommendation; skippable interest selection with supported specific favorites; and a first-session preview with an explicit outcome. Use progress, Back/Continue, saved answers, microphone permission at speaking practice, and a reminder offer after the first completed session. Level, goals, and interests can be changed later. Treat device synchronization as Android-device progress, with web still a landing page only.
- PRD Home detail supplied: one primary "Start today's session" action; daily study goal/streak; due-review counts and "Start review"; recommended theme, kanji, grammar, and outcome; unfinished-session continuation; current/target JLPT level with strengths and practice needs; and quick saved-reference access. New users see their first session and an explanation that reviews appear after learning. Allow choosing another session or theme. Five bottom sections: Home, Lessons, Review, Conversation, Profile.
- PRD conversation refinement supplied: one free-conversation mode shared with lessons, with topics entered directly in chat, optional Qloo suggestions/scenarios, current topic priority, and freely ending with a saved recap. Example when target language is absent: "You practised discussing anime. You haven't practised today's request pattern yet," with optional "Practise this pattern." Preserve exercise progress and record goal evidence independently from chat completion; relevant use across topics still counts.
- PRD kanji interaction supplied: teach before active recall. Show a large kanji, taught meanings/readings, mnemonic, useful words, highlighted everyday example, audio for readings/words/sentences, and optional furigana, translation, and breakdown. "Try it" tests typed meaning, the kana reading of a specific word, sentence use/completion, and speech separately. Accept reviewed alternative meanings and word-appropriate readings. Correct answers show confirmation, expected answer, and optional audio; mistakes show correction/explanation and return after other questions. "I don't know" reveals help and schedules another attempt. Record assistance. Introduction establishes initial learning; meaning/reading reviews remain separate, with mastery requiring consistent recall over time.
- PRD grammar interaction supplied: show a practical goal, one useful pattern with English explanation, meaningful parts, usage, readings, translation, and audio; progress from listening/phrase choice to arranging pieces and filling gaps, then an interest-related typed/spoken sentence. Spoken transcripts are inspectable/editable before submission. Help progresses through word bank, pattern hint, and example, with assistance recorded and another try. Errors highlight the relevant part, show/explain a corrected sentence, offer audio, and allow retry. Recognize valid different patterns while keeping today's target unpractised. Save the pattern, corrected sentence, examples/audio, and independent/assisted/needs-practice status; revisit in later exercises/conversations.
- PRD failure behavior supplied: brief explanation, retained progress, and useful next action. Microphone denied: "Type instead," "Enable microphone," or "Continue with listening practice." Uncertain/missing transcript: show recognized text where available, ask the learner to check it, and offer re-record/edit/type; uncertainty is not a wrong answer. Recognition unavailable: typed practice and available model audio, with speaking unassessed. Failed AI reply: preserve the learner's message and offer Retry, Resume later, or Continue studying into available kanji reviews, grammar, or references. Failed audio: preserve sentence/reading/explanation for reading/writing. Unavailable activities are not practised, never counted as mistakes or as achieved speaking/conversation goals; completed exercise progress persists.
- Clarified "Daily conversation: Lingos" to mean ordinary day-to-day conversations used in daily life. It is not an established app name or a separate slang requirement. The final app name remains unspecified.
- PRD beginner support supplied: Japanese with kana readings, optional romaji, English meaning, and word/sentence audio; small kana groups reused in each beginner session; English meaning input, initial romaji reading answers, and selectable word/kana tiles; speech/romaji/suggested Japanese with audio in conversation; adjustable, restorable reading aids. Romaji can establish reading recall but not kana literacy; track meaning, reading, kana, and speaking separately.
- PRD account methods supplied: email/password signup with password confirmation and email verification; remembered sign-in sessions; Forgot password? with secure emailed reset links; sign-out and password change in settings; delivery/expiry explanations and re-request. Preserve the same account's progress. Social sign-in is deferred.
- PRD daily progress supplied: actual active study time including partial reviews/lessons, genuine conversation, listening/speaking, wrong and assisted attempts; exclude idle/app-open/topic-selection time and overlapping activity duplication. A completed review attempt, lesson exercise, or substantive Japanese turn earns the local-calendar-day streak; meeting the full time goal is separate. Example: six minutes of a 15-minute goal gives 6/15 and a streak day. Preserve effort before failure; offline effort belongs to its original day.
- PRD offline scope supplied: downloaded/cached flashcards, kana/kanji/grammar lessons, predefined/approved-answer exercises, sentence-building, saved references, model audio, recording/playback, and sentence drafts. Save results/place/time/streak locally. AI-dependent answers are Awaiting feedback; transcription/AI assessment waits. New AI replies, Qloo recommendations, imports, signup/recovery, and cloud sync need internet. Clearly mark available content; offer Continue offline study, or connect-once guidance if empty. Reconnect without duplicate activity or changing its original date.
- The workspace has reference assets and curriculum skills, with no existing application source or Git repository observed during onboarding. `devpost/` was created, and `.gitignore` excludes `/devpost/learner-profile.md`, `.env`, and `.env.*` while allowing `.env.example`.

- Build resume on 2026-10-13: learner completed local Expo login; a preview Android APK was queued on EAS and a task-local Android emulator booted. Accounts/setup remain slice 1 work in progress; no hands-on checkpoint or first-slice commit yet. Learner confirmed SITE_URL is a future kiro-jp.vercel.app placeholder with /auth/reset route and authorized temporary Resend test-sender use while setting up a domain. Required owner test address and Gateway/TTS credentials are pending. See build-evidence.md for actual mechanical observations; do not infer full authentication or native installation from bundling.

- Subsequent steering: learner explicitly deferred email confirmation/verification, password recovery and password changes until their sender is ready; no test recipient is needed now. They added Gateway/Gemini credentials, confirmed Gemini billing enabled and approved US$10 total Gemini development/demo spend. Keep other providers free-only. Real no-mail backend account/isolation checks passed, three placement WAV clips and AI transcript checks passed through Gateway, and the lifetime budget ledger includes conservative held failure capacity. This entry described the first build while pending; later installed-APK evidence is recorded below.
- Current steering: Qloo key requested from the organizer and pending; implement from the supplied guide, then test live when access arrives. They briefly requested OTP login but cancelled it before any code change and twice confirmed the previous email/password flow. Resend remains deferred. Keep remembered sessions and existing progress; do not introduce OTP or claim mail delivery passed.
- Native progress: first APK installed/launched, remembered setup survived an offline restart, predefined placement/Back/resume and separate interest-based previews reached Home. Larger app text was checked. A second APK with bundled placement audio and disabled recovery controls is queued. The partial foundation checkpoint is committed as bd24578; slice 1 and all hands-on checkpoints remain open pending their required evidence.
- Later foundation acceptance: updated build d846bd95 installed with the same certificate, retained saved account/setup, hid deferred recovery controls and supported fresh password signup. Three bundled players worked offline; twelve placement answers and an explained recommendation survived restart and synchronized. Adjusted level/interests reached saved Home. Slice 1 now passes revised mechanical checks; the learner's early hands-on check is still planned after slice 2. Gateway preflight committed as c328ae6; both fixed synthetic provider probes passed. One-time continuation requested for October 14 at 04:00 India time in this chat.
