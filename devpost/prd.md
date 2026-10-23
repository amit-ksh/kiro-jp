---
doc: prd
status: approved
---

# Japanese Learning App — Product Requirements

An Android learning app for English-speaking beginners and early-stage learners that combines kanji, kana, grammar, pronunciation, conversation, and spaced review. The web presence is a landing page only. “Japanese Learning App” is a descriptive working title; a final brand name has not been chosen.

Source: `scope.md > The Unique Kernel`, `Who It's For`, `The Core Loop`, and `The MVP Boundary`. This document develops those requirements using the learner's PRD interview answers. One shared MVP serves both submission targets.

## The Core Journey

1. Open Welcome, choose Get started or Sign in, and access an email/password account. Verify a new account's email address; returning sessions remain remembered across app restarts.
2. Complete saved, resumable onboarding: estimated level, goal and daily study time; optional WaniKani import; optional predefined placement questions; interests; then a first-session preview. Recommendations are adjustable and unfamiliar answers can be acknowledged honestly.
3. Reach Home with one primary action, **Start today's session**. See due reviews, a suitable recommended session, unfinished learning, level/JLPT progress, and saved references. A newcomer sees their first session and why no reviews are due yet.
4. Review due material, then study a session's 3–5 kanji and useful words. Beginners also learn a small group of kana and use audio, meaning, romaji, and selectable input without a kana-fluency prerequisite.
5. Study one reviewed grammar pattern using the session's vocabulary. Move from explanation and guided exercises to an independently constructed typed or spoken sentence, with useful corrections and recorded assistance.
6. Practise relevant readings, words, and complete sentences through model audio, recording, playback, recognized transcripts, and retries. Inspect and correct a spoken-answer transcript before submitting it.
7. Open the single free-conversation mode. A lesson can suggest a topic, target language, and an everyday goal. The learner can instead type or say a chosen topic, follow Qloo-informed suggestions or roleplay, change the subject, and finish freely. The chosen topic takes priority over saved interests.
8. Save the ended conversation, actual practice time, corrections, and recap separately from evidence of practising the lesson goal. Keep the reference sheet and save useful words/phrases into flashcards.
9. Return to due reviews and future sentence/pattern practice. Preserve partial work and give study credit for meaningful effort. Initial learning, independent/assisted practice, goal achievement, kana literacy, and mastery remain distinct.
10. When offline, continue with available downloaded/cached material, preserve local progress and pending answers, and synchronize later without duplicates or moving activity to the synchronization date.

## Screens and Layout

Source: `scope.md > The Core Loop`, `Inspiration & Identity`, and `The MVP Boundary`.

### Onboarding Screens

| Screen | What the learner sees and does |
| --- | --- |
| Welcome | “Learn Japanese through kanji, grammar and conversations connected to your interests.” Get started and Sign in. |
| Account access | Sign-up/sign-in fields, email verification, and Forgot password? Account recovery remains part of this flow. |
| Learning setup | Estimated Japanese level, including Completely new and I'm not sure; goal: daily conversation, travel, JLPT, or enjoying Japanese media; preferred daily study time. |
| Optional WaniKani import | Import progress or Skip for now. Explain the limited meaning of imported kanji/vocabulary familiarity. |
| Short level check | One predefined kana, vocabulary, grammar, or listening question at a time; I don't know and Skip. Finish with an explained recommendation and Accept this level or Adjust it. |
| Choose interests | Shrines, manga, anime, food, travel, and supported specific favorites. Allow skipping personalization and later editing. |
| First-session preview | Theme, kanji set, one grammar pattern, pronunciation practice, suggested conversation, and a concrete everyday outcome. Start my session. |

Show clear progress through the onboarding sequence, Back and Continue where applicable, and automatically saved answers. A skipped optional step does not block the next one. Microphone permission is requested when speaking practice begins; reminders are offered after the first completed session.

### Main App Navigation

Five sections use the reference's white bottom navigation:

- **Home:** Daily plan and main Start today's session action; daily-goal progress/streak; due-review counts and Start review; recommended theme, kanji, grammar, and outcome; Continue learning; current level and target JLPT level with strengths/practice needs; saved-reference shortcuts. Allow selecting another session or theme.
- **Lessons:** Kana foundations, the focused N5/N4 starter lessons and learning paths, practical grammar teaching, and grammar reference. Lesson detail and study steps lead through the shared session journey.
- **Review:** Due kanji, vocabulary, and phrase flashcards, meaning/reading checks, and extra practice.
- **Conversation:** One text/voice conversation surface. Topics, suggestions, and scenario/roleplay choices occur in chat; there is no separate scenario builder.
- **Profile:** Detailed recorded progress, goals, estimated/recommended level, interests, WaniKani import, and account/settings controls.

Lesson reference sheets, grammar explanations, and saved phrases are reachable from the relevant learning area and Home's saved-reference shortcuts. Focused exercises show their current step, input, feedback, and next action. Navigation and interruption preserve completed work and resumable position.

### Web Landing Page

Describe the app and provide access to the Android experience, following the established visual direction. The web page has no lesson, review, or learning-account interface. Final branding, copy, and Android distribution-link details can be finalized before publication.

## Look and Feel

October 18 learner revision: improve the Kiro JP logo while retaining indigo/orange/white branding, and add a brief app startup/loading experience that morphs Japanese character shapes into the new logo. Keep the icon, welcome and static landing consistent. Startup animation must respect reduced motion, remain bounded and never depend on network availability or interfere with account progress/navigation. Routine loading states retain useful state labels without replaying the launch animation.

Source: `scope.md > Inspiration & Identity`.

Use the same palette and overall layout direction as `references/j-image-main.webp`: indigo surfaces, orange primary actions/emphasis, rounded white panels, pill-shaped controls, white bottom navigation, Japanese pattern accents, and bold typography adapted to learning content.

Palette anchors sampled from the supplied image: `#37469E`, `#313790`, `#FF5C00`, `#F05722`, and `#FFFFFF`. Show large, readable Japanese, clear English learner support, distinct audio/record controls, and accessible text/controls. Reading support can be adjusted and restored. Patterns must leave instructional text legible.

Product reference: [Babbel](https://play.google.com/store/apps/details?hl=en_US&id=com.babbel.mobile.android.en). Other local references remain supplementary; the supplied video has not been used to make design decisions.

## Features and Behavior

### Account Access and Recovery

**Current build override — 2026-10-13:** At the learner's request, account email confirmation/verification, password recovery and password changes are temporarily unavailable while their sender is being arranged. Email/password signup and remembered sign-in remain usable without email confirmation. Show the recovery limitation clearly; preserve account/progress ownership. The full email behaviors below remain the planned later activation rather than a claim that they work in this early build.

Source: `scope.md > The MVP Boundary`; PRD account-method decision.

- Sign up with email, password, and password confirmation; verify the email address.
- Sign in with email/password. Remember the session across app restarts and keep account progress available across the learner's Android devices.
- Forgot password? sends a secure reset link. Settings allow sign-out and password changes.
- Explain failed email delivery and expired links, and allow requesting another email. Recovery and password changes keep learning history linked to the same account.
- New account access and recovery require internet. A remembered account can use its available offline study material.
- Account data controls include learning-data export and confirmed account deletion, as retained in the approved build checklist. Export can include cloud learning records and unsynchronized device activity, or clearly offer a device-only copy offline. Credentials and raw audio files are excluded from the JSON learning-data export.

Acceptance criteria:

- **ACC-1:** A newcomer can create and verify an account, sign in, restart the app, and return to saved onboarding/learning progress.
- **ACC-2:** Password reset and password change preserve the same learning history; expired/failed email actions have a visible retry path.
- **ACC-3:** Sign-out is available; account progress is not presented as another learner's progress.
- **ACC-4:** A learner can save their learning-data export without changing progress. The export identifies its device/cloud coverage, retains drafts and pending attempts, and exposes no other account's records or authentication secrets. An incomplete cloud read is not reported as a complete export.
- **ACC-5:** Confirmed deletion removes the owned account/learning records and private audio, cancels owned jobs/reminders, and removes or quarantines local data so delayed work cannot restore it. Other learners and shared public lesson assets remain intact. This requires its own implementation and verification; export does not establish deletion support.

### Onboarding, Placement, and Preferences

Source: `scope.md > Who It's For` and `The Core Loop`.

- Follow the seven screens above. Preserve answers and position when the learner goes Back or returns later.
- Placement uses short predefined questions covering kana, vocabulary, grammar, and listening. I don't know is an honest response, not an instruction to guess.
- Explain the recommendation; permit accepting or adjusting it. Skipping uses the selected level. Completely new requires supported beginner content, not kana fluency.
- Imported WaniKani familiarity helps choose appropriate kanji/vocabulary. It does not assign matching grammar, listening, or speaking proficiency.
- Collect interests, permit supported specific favorites or skipping, and let the learner change level, goals, study time, and interests later without losing completed work.
- Offer broad interest choices: Food, Culture, Places, Anime, Manga, Music, Travel and Daily life. Specific topics such as shrines are typed as custom interests, not default categories. Existing saved choices remain editable.
- The first preview states an outcome tied to its language and suggested context, such as asking where something is at a shrine. It leads to Start my session.

Acceptance criteria:

- **ONB-1:** Back, interruption, and optional-step skipping preserve valid answers and allow reaching the first preview.
- **ONB-2:** Both accepting and adjusting a recommendation visibly affect the starting content; skipped placement uses the learner's selection.
- **ONB-3:** WaniKani vocabulary familiarity never substitutes for the other skill results.
- **ONB-4:** Changing interests affects subsequent suggestions; an empty interest selection still permits learning and choosing a topic in chat.

### Home and Daily Plan

October 18 learner addition: show one **Today’s conversation** recommendation based on saved interests, using real Qloo results. Rotate its subject each local calendar day where results allow, otherwise vary the conversation angle. Keep it stable through refresh/restart on that day; changing interests or disliking the topic can replace it. A secondary Start chat action opens the existing level-aware free conversation without requiring a lesson or overwriting another topic draft. Optional details explain the interest/source and allow Not interested or Edit interests. Empty interests, offline access and unavailable Qloo results retain a useful choose-your-own-topic/settings action. A recommendation, click or initial English topic does not earn study credit, streak or mastery.

Source: `scope.md > The Core Loop` and `What "Working" Looks Like`.

- Make Start today's session the main action. The recommended journey connects reviews, new language, grammar, pronunciation, and conversation.
- Keep the post-login daily plan compact: time goal/streak, distinct kanji and vocabulary introduced, grammar patterns practised, due reviews and a short session checklist. Detailed rules and settings belong behind clear links. Initial introduction is distinct from lasting recall; meaning/reading tracks, repeated lessons and WaniKani familiarity must not inflate learned-item totals.
- Show the specified Home sections and alternative-session/theme choice. Due counts must correspond to the displayed review queue, with check types clearly identified during review.
- Offer Continue learning for an unfinished lesson or conversation, and quick access to saved references.
- A first-time learner sees the first suitable session and an explanation that reviews appear after learning.
- Daily-goal time and streak indicators are separate from mastery and lesson-goal evidence. Level/JLPT progress describes recorded starting/starter learning; it does not imply complete course coverage or an exam-readiness score.

Acceptance criteria:

- **HOME-1:** A new learner can start a session despite having no due reviews, history, or references yet.
- **HOME-2:** A returning learner can start reviews, start/change a recommendation, resume saved work, and reopen a saved reference.
- **HOME-3:** Displayed time, streak, due queue, and completed work agree with saved activity, including after synchronization.

### Beginner Support and Kana Foundations

Source: `scope.md > Who It's For`; PRD beginner-support decision.

- Show Japanese with kana readings, optional romaji, English meaning, and replayable word/sentence audio.
- Beginner sessions introduce a small group of hiragana or katakana, practise sounds, and reuse them in that session's words and phrases.
- Accept English for meaning questions and romaji for initial reading answers. Offer selectable word/kana tiles for sentence-building; show corresponding Japanese after submission.
- Conversation supports speech, romaji, suggested Japanese phrases with audio, and help expressing an idea followed by another attempt.
- Furigana/romaji remain adjustable and restorable. Encourage trying less support without withholding it.
- Track meaning knowledge, reading recall, kana literacy, and speaking practice separately. Romaji correctness can establish a word's reading knowledge without establishing kana reading/typing.

Acceptance criteria:

- **BEG-1:** A learner with no kana typing ability can complete a supported first session and use a useful phrase.
- **BEG-2:** A correct romaji answer contributes reading evidence but no false kana-literacy evidence.
- **BEG-3:** The learner can hide and restore reading aids, hear a word separately, and practise the small kana group.

### New Kanji and Active Recall

October 18 follow-up: keep kanji as the main learning track, without introducing radical-based locks. Teach the radicals/components used inside each kanji through named shapes, variant forms, brief recognition lessons, linked kanji and original memory stories. Keep dictionary facts separate from original teaching content and existing graded answers. Vocabulary references link back to their known starter kanji. Reading a reference does not create mastery or change the review schedule.

October 18 learner revision: Lessons also offers a WaniKani-style browser of the seven implemented starter levels. Each level groups radicals, kanji and vocabulary. Kanji details explain recognizable components and the dictionary radical, label on’yomi and kun’yomi separately, and show the reading in a useful lesson word. A missing dictionary reading is stated honestly. Browsing does not award learning or mastery; existing lesson exercises remain the teaching and recall path.

Source: `scope.md > The Core Loop`.

- Teach first. Show a large kanji, its meaning and taught readings, a short mnemonic, useful words, and a highlighted everyday example. Offer audio for individual readings, words, and the whole sentence, plus optional readings, translation, and breakdown.
- Try it moves to distinct meaning recall, reading recall for a specific word, sentence use/completion, and speaking practice. The recall view hides the answer being tested; answer-revealing help is recorded as assistance.
- Accept approved alternative meanings and readings appropriate to that specific word. A reading question makes the required word/reading clear rather than accepting an unrelated reading of the same kanji.
- Correct answers show brief confirmation, the expected answer, and optional audio. Incorrect answers show correction and a short explanation, then return after other questions. I don't know reveals help and schedules another attempt.
- Finishing introduction establishes initially learned material. Meaning and reading enter separately tracked spaced reviews; mastery requires consistent successful recall over time.

Acceptance criteria:

- **KAN-1:** A learner studies the teaching view before testing; meaning, reading, sentence, and speech results are distinguishable.
- **KAN-2:** Reviewed alternatives are accepted; a wrong word-specific reading is explained and scheduled for another attempt.
- **KAN-3:** Incorrect, I don't know, and assisted responses do not become independent successful recall.
- **KAN-4:** Initially learned material appears in future reviews with separate meaning/reading status.

### Grammar Teaching and Sentence Practice

Source: `scope.md > The Core Loop` and `The Unique Kernel`.

- Teach one useful pattern using the session's vocabulary/kanji. Start with a practical purpose, for example requesting something politely, and an example such as 水をください.
- Show the pattern, short English explanation, meaningful sentence parts, when to use it, readings/translation, and audio.
- Move from listening and choosing an appropriate phrase through arranging pieces and filling a gap to a typed/spoken sentence connected to the learner's interests. Gradually reduce assistance.
- Before submitting spoken answers, allow inspecting and correcting the recognized transcript.
- Help progresses through a word bank, pattern hint, and example. Record assistance and offer another attempt.
- Highlight a mistaken part, show the corrected sentence, briefly explain the change, offer its audio, and permit retry. Explain why a correct answer works.
- A valid different pattern is acknowledged as valid while today's target remains unpractised. Save independent, assisted, or still-needs-practice evidence.
- Include the pattern, the learner's corrected sentence, examples, and audio in a reference sheet. Revisit the pattern in later exercises/conversations.

Acceptance criteria:

- **GRA-1:** A beginner moves from explanation and guided practice to their own sentence using the same session's language.
- **GRA-2:** Help is available in the stated sequence and retained as assisted practice.
- **GRA-3:** A valid alternative construction is not falsely labelled wrong and does not automatically satisfy the target-pattern goal.
- **GRA-4:** The corrected sentence and practice status remain available after leaving or resuming the lesson.

### Pronunciation and Spoken Input

Source: `scope.md > The Core Loop` and `The MVP Boundary`.

- Hear and practise the relevant word individually, then in a complete sentence. Record an attempt, replay it, view recognized text/feedback, and retry.
- Request microphone permission at the first speaking activity, not during initial onboarding. Offer typing and listening paths when access is unavailable.
- Show uncertain recognized text for confirmation or editing. An unclear/missing transcript is not a wrong Japanese answer.
- Speech recognition feedback must remain distinguishable from the learner's intended/edited text. An edited transcript or typed replacement is not proof of accurate spoken pronunciation.
- Preserve textual readings, meaning, and explanation when audio is unavailable. Offline recording/playback can still be useful practice while transcription/AI assessment waits.

Acceptance criteria:

- **SPK-1:** A learner can listen, record, replay, inspect/edit recognized text, and retry both word and sentence practice.
- **SPK-2:** Denied permission, uncertain recognition, and unavailable recognition each expose the continuation paths in States and Boundaries.
- **SPK-3:** Recognition uncertainty or service failure never lowers recall mastery as if the learner answered incorrectly.

### One Free-Conversation Mode

October 18 phone feedback: the Conversation tab opens an empty chat with a short invitation, up to four interest suggestions and a bottom message box. History is available through a header action; older chats load in owned cursor pages and open the existing chat view. Learning help and completed recaps expand on demand. This replaces the always-visible topic form and repeated saved-chat cards. The Home activity chart remains unchanged.

Source: `scope.md > The Unique Kernel`, `The Core Loop`, and `Explicitly Cut`.

- Start by typing or saying what to discuss, or selecting a suggestion. The AI begins a natural conversation suited to the learner's Japanese level.
- The current topic takes priority over saved interests. The learner can change subject at any time.
- Qloo can enrich the chosen discussion and suggest basic conversations or interest-based scenarios/roleplay. Use real relevant results; no separate custom-scenario creation flow.
- A lesson suggests a topic, target vocabulary/grammar, and a practical outcome, then opens this same chat. The AI creates natural opportunities to use the target language, but practice remains free to change.
- Offer hints, translations, corrections, help expressing an idea, and useful phrases. Beginner input can use speech, romaji, or suggested Japanese with audio.
- The learner can finish whenever desired. Save actual practice time and a short recap with useful corrections and phrases that can be saved for review.
- An ended conversation is completed as a conversation session. The lesson's goal is practised only when appropriate target-language use is observed, including in a changed topic. Otherwise show Not yet practised, with optional Practise this pattern.
- Preserve completed kanji/grammar work. Ending a conversation or changing subject never automatically establishes target-goal achievement or mastery.

Acceptance criteria:

- **CON-1:** Both standalone and lesson entry use the same conversation mode and support changing the topic.
- **CON-2:** Real Qloo results can inform suggestions/context, while a learner-chosen topic overrides profile interests.
- **CON-3:** Ending a chat saves a recap and effort even if its lesson goal remains unpractised.
- **CON-4:** Appropriate target use on a new topic still counts; unrelated correct language does not automatically satisfy the target.
- **CON-5:** A failed reply preserves the learner's message and supports Retry, Resume later, or available study.

### References, Flashcards, and Spaced Review

Source: `scope.md > The Core Loop` and `What "Working" Looks Like`.

- Session reference sheets contain taught words, grammar, useful examples/corrections, and audio. Saved references include phrases, grammar explanations, mnemonics, and sentence breakdowns.
- Save useful words/phrases from lessons and conversation recaps into review material; expose them in Review and relevant reference shortcuts.
- Review due kanji, vocabulary, and phrases with meaning/reading checks and appropriate approved answers. Maintain meaning and reading records separately.
- Correct consistent recall lengthens intervals; mistakes bring items back sooner. Assistance remains visible as assisted practice. Grammar and sentence use also return for practice.
- Extra practice is available. It counts as study effort; mastery must still reflect consistent recall/use over time rather than immediate repetition alone.

Acceptance criteria:

- **REV-1:** Saved material is reopened later and appears in its appropriate learning/review area.
- **REV-2:** Due material is offered when due; separate meaning/reading outcomes update the appropriate record.
- **REV-3:** Repeated successful reviews and mistakes produce the specified interval direction, without introduction/chat completion falsely awarding mastery.
- **REV-4:** Grammar and sentence practice can be revisited from references, later exercises, and conversation follow-up.

### Daily Goal, Streaks, and Progress

Source: `scope.md > What "Working" Looks Like`; PRD daily-progress decision.

- Daily-goal progress is actual active study time. Partial review queues, unfinished lessons, short conversations, wrong answers, and assisted practice can all contribute effort.
- Count attempting answers, checking feedback, active lesson work, genuine Japanese conversation, and actual listening/speaking practice. Do not count overlapping activities twice.
- Opening the app, merely selecting a topic, or leaving a screen idle gives no study credit. Preserve completed effort when an activity fails.
- Earn a streak day after at least one meaningful step: a completed review attempt, lesson exercise, or substantive Japanese conversation turn. Finishing the full daily time goal is a separate achievement.
- Use the learner's local calendar day. Offline activity counts toward the original local day on synchronization.
- Track meaning knowledge, reading recall, kana literacy, grammar-pattern evidence, speaking practice, and lesson/conversation completion distinctly. Effort does not automatically establish mastery.
- Offer optional reminders after the first completed session. Preferences remain editable.

Acceptance criteria:

- **PRO-1:** The learner's example is reproducible: six active minutes and completed reviews against a 15-minute goal show 6/15 minutes and an earned streak day, while the daily time goal remains unfinished.
- **PRO-2:** Wrong/assisted practice retains effort; idle/topic-only activity gives no effort or streak credit.
- **PRO-3:** Simultaneous conversation and speaking/listening are not added twice to total study time.
- **PRO-4:** Offline effort returns to its original study day and synchronization does not duplicate time, reviews, or streak activity.

### Offline Study and Reconnection

Source: `scope.md > The MVP Boundary`; PRD offline-scope decision.

- Clearly mark downloaded/cached content and show an offline message with Continue offline study. Home offers an available lesson or review queue.
- Offline support includes due flashcards, downloaded kana/kanji/grammar lessons, predefined quizzes, sentence-building and approved-answer checks, saved references, downloaded model audio, recording, and playback.
- Save review results, lesson position, active study time, and streak activity locally for later synchronization.
- Preserve draft sentences. When an answer requires AI assessment, label it Awaiting feedback and assess it when online; do not treat pending assessment as incorrect or independently demonstrated skill.
- New AI replies, fresh Qloo recommendations, WaniKani imports, sign-up/password recovery, and cloud synchronization require internet. Automatic transcription and AI speech feedback wait for reconnection.
- If no material is available offline, explain that the learner must connect once to prepare material. Preserve available progress and avoid presenting nonexistent offline activities as usable.
- Reconnection synchronizes saved activity without duplicate results and keeps its original study date. Available online assessment can then complete pending feedback.

Acceptance criteria:

- **OFF-1:** With suitable material prepared, a learner can perform each listed offline activity and restart without losing work or position.
- **OFF-2:** AI-dependent answers remain Awaiting feedback; offline playback/recording does not falsely claim automatic speech assessment.
- **OFF-3:** Reconnecting twice does not duplicate results or move yesterday's study to today.
- **OFF-4:** A device with no prepared material shows a clear connect-once explanation instead of a broken lesson/review promise.

## States and Boundaries

Source: `scope.md > The Core Loop`, `The MVP Boundary`, and the PRD failure/offline decisions.

| State | Visible explanation and next action | Progress treatment |
| --- | --- | --- |
| First use / no reviews | Offer the first suitable session; explain that reviews appear after learning. | No invented prior history or mastery. |
| Empty saved references | Learning and recaps provide material to save. | No block on starting a session. |
| Interrupted onboarding or lesson | Return to saved answers/place; offer continuation. | Preserve completed work. |
| Microphone denied | “Microphone access is off. You can continue by typing.” Type instead, Enable microphone, Continue with listening practice. | Typing/listening remain useful; missing speaking assessment is not a mistake or achieved speaking goal. |
| Uncertain/missing transcript | Show recognized text when available and “Please check what we heard.” Record again, Edit transcript, Type instead. | Uncertain transcription is not graded as a wrong answer. |
| Recognition unavailable | Offer typed sentence practice and available model audio. | Clearly show that speaking was not assessed. |
| AI reply failure | “The conversation couldn't continue right now.” Preserve the message; Retry, Resume later, Continue studying. | Keep prior work/effort; failed activity does not achieve a goal. |
| Audio unavailable | Keep sentence, reading, meaning, and explanation visible; continue reading/writing. | Available practice counts; unavailable audio activity does not. |
| AI assessment pending | Awaiting feedback on the preserved answer. | No false success, mastery, or mistake before assessment. |
| Conversation ended without target use | Save recap and effort; Not yet practised for the target, optionally Practise this pattern. | Chat complete; target still unpractised; completed exercises remain. |
| Valid different grammar pattern | Acknowledge validity and explain that today's pattern needs practice. | Do not label correct language wrong or award unobserved target use. |
| Offline with content | Continue offline study; show available material and pending feedback where relevant. | Save results/position/time/local day; synchronize later. |
| Offline without content | Explain connect once to prepare material. | Preserve existing progress; no fabricated usable content. |
| Failed email / expired link | Clear reason and request another email/link. | Keep learning attached to the same account. |

Unavailable activities are recorded as not practised/unassessed as appropriate, with a way to revisit. Actual practice already completed survives the failure. Practice effort, exercise completion, assessment evidence, and mastery remain distinguishable.

## Product Decisions

- **One shared MVP for both events:** Demonstrate the same complete experience; check each event's eligibility and submission obligations separately.
- **Android learning, web landing only:** Keep the learning journey in the Android app.
- **Email/password first:** Include verification/recovery and remembered sessions; defer social sign-in.
- **No kana-fluency gate:** Combine supported input, small kana groups, and separate literacy evidence so complete beginners can start useful practice.
- **Teach before recall:** Provide explanations and context before testing; record meaning, reading, sentence use, and speech separately.
- **One free-conversation mode:** Use a shared chat for standalone/lesson practice, topics selected in chat, optional Qloo roleplay suggestions, and freedom to change or finish.
- **Separate completion from evidence:** An ended chat is completed, but target use and mastery require their own evidence.
- **Count partial effort:** Active time and meaningful-step streaks reward practice without pretending an unfinished goal or assisted answer establishes mastery.
- **Offline cached study:** Permit the specified available activities, retain pending feedback, and synchronize without duplication or changing original study dates.
- **Exact reference direction:** Use the selected palette and overall app layout, with clear Japanese/English learning support.

## What We're Building

The seven-step onboarding and five-section Android app; email/password accounts; a focused reviewed N5/N4 starter set plus short kana foundations; 3–5 kanji and one grammar pattern per learning session; active recall; audio/recording/transcript practice and useful fallbacks; one Qloo-enriched conversation mode; saved references/flashcards; persistent spaced review and partial progress; daily goals/streaks; optional reminders; optional WaniKani familiarity import; the listed offline activities and reconnection behavior; and a web landing page.

Preserve the scope's real integration proof, including real Qloo results, working speech recognition, persistent reviews, and changing between two configured AI providers without changing learning-feature code. Provider choices, supported capabilities, and how this meets Qloo's agent requirement belong in `4-spec`.

## Deferred From the MVP

- Higher-level JLPT courses and full mock exams: the accepted boundary is focused starter content.
- Full-duplex streaming conversations, specialized pitch-accent scoring, and richer voices remain later work. The October 23 learner-authorized revision adds hands-free call mode over bounded recorded turns: speech, automatic transcript submission, audible AI replies and pause/mute controls. The transcript stays visible, unclear/empty recognition pauses without marking an answer wrong, and text chat remains available.
- Subscriptions and iOS: explicitly deferred by the learner.
- Social sign-in: email/password is the chosen MVP account experience.
- Broader original-wishlist features beyond this defined journey need a separate scope decision; they are not implicit acceptance criteria here.

## Possible Later Enhancements

Expanded JLPT curriculum, richer exam planning, advanced flashcard controls, and wider personalized content can build on the same progress records. Additional conveniences beyond the approved MVP need an explicit scope decision. Account-data export/deletion are included in the approved build checklist and the account requirements above.

## Non-Goals

- A web/PWA learning application or distinct reduced/expanded products for the events.
- A separate custom-scenario builder or a forced conversation path preventing topic changes.
- Requiring kana fluency before the first useful session.
- Equating imported WaniKani familiarity, romaji input, chat completion, study time, or assisted practice with unrelated skill mastery.
- Fresh AI replies, new Qloo results, imports, account recovery, or cloud synchronization while offline.
- Presenting starter lessons as complete higher-level courses or speech-recognition transcripts as specialized pronunciation/pitch scoring.

## Open Questions and Next Planning Work

- **Final app name:** Not chosen; the descriptive title does not invent a brand. This does not block product requirements or technical planning, but should be finalized before public landing/submission copy.
- **Technical investigations for `4-spec`:** Verify the requested account-email flows and Android link handling, Qloo-supported entities/favorites, speech capabilities, the two-provider demonstration, offline reconciliation, and the event's agent requirement. These must be resolved in the technical plan before implementation depends on them.
- **Implementation details for `4-spec`:** Define exact reviewed starter content, placement recommendation rules, approved answer sets, interval/mastery rules consistent with this PRD, reliable active-time measurement, and the availability/preparation of offline assets. Do not substitute new product intentions for these documented rules.
- **Separate submission audit:** The shared product plan does not establish eligibility or complete either event's submission; check both independently.
