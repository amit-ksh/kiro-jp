---
doc: scope
status: approved
---

# Japanese Learning App

An Android app that helps English-speaking beginners learn a few kanji and one grammar pattern, practise pronunciation, and use Japanese in level-appropriate conversations about their cultural interests and chosen topics.

## The Unique Kernel

Connect remembering Japanese to using it: reviewed teaching supplies the target language, real Qloo results inform relevant cultural contexts, and one free-conversation mode lets the learner use Japanese around interests and topics they choose. Lessons can suggest a topic and an everyday goal using their kanji, vocabulary, and grammar, then open the same chat. The learner may change subject or finish freely; relevant target-language use can count across topics. Spaced follow-up turns the session into continued learning.

## Who It's For

The first demo serves an English-speaking beginner or early-stage learner with no assumed knowledge of kana, kanji, or grammar. They need readings, audio, explanations, and a suitable starting point rather than an unexplained Japanese interface.

It also supports a learner who already studies with WaniKani but needs grammar and practical use. Imported kanji/vocabulary familiarity must not imply equivalent grammar, listening, or speaking ability.

## The Core Loop

1. Sign in, select an estimated level or "I'm not sure," and answer short predefined placement questions covering kana, vocabulary, grammar, and listening. Accept or adjust the recommended starting level and choose cultural interests during onboarding. Interests can be updated later.
2. Review due kanji and vocabulary, recalling both meanings and relevant readings.
3. Learn 3–5 kanji with useful vocabulary, simple reviewed explanations, and mnemonics. Hear and practise the relevant readings or words individually, then in complete sentences.
4. Learn one grammar pattern using those words, with a clear explanation, sentence breakdowns, and exercises that ask the learner to construct or say a sentence.
5. Listen to model audio, record an attempt, hear it back, inspect speech-recognition transcripts and feedback, and retry. A lesson previews a concrete conversation goal and suggests a topic and target language. Open the same free-conversation mode available for standalone practice. The learner types or says what they want to discuss, and the AI begins a natural level-appropriate exchange with hints, translations, and corrections. Qloo can enrich the discussion or suggest basic conversations, scenarios, and roleplay around interests. The learner's chosen topic takes priority over saved interests.
6. Finish whenever desired, keeping actual practice time, a recap, useful corrections, and phrases to save. Keep a reusable lesson reference sheet with words, grammar, examples, and audio. Record chat completion separately from whether the lesson's conversation goal was practised. If no appropriate target-language use occurred, the goal remains "Not yet practised," with optional "Practise this pattern." Preserve completed kanji/grammar exercises; appropriate target-language use in a changed topic still counts.
7. Return for spaced reviews. Correct recall gradually lengthens intervals; mistakes bring items back sooner. Follow-up also revisits grammar and sentence use. Completion begins learning; mastery reflects consistent recall over time.

The learner's level constrains Japanese difficulty. Interests inform suggested contexts, but the topic chosen directly in chat takes priority. Qloo informs cultural relevance rather than language proficiency. Conversation goals provide lesson-linked practice opportunities, with no gate preventing topic changes or ending a chat. Topic selection happens in chat; there is no separate custom-scenario creation flow.

## Inspiration & Identity

- Product inspiration: [Babbel](https://play.google.com/store/apps/details?hl=en_US&id=com.babbel.mobile.android.en), particularly learning usable language in context.
- Primary visual reference: `references/j-image-main.webp`. **Use its same color palette and overall UI layout for the app:** indigo surfaces, orange emphasis/actions, rounded white content panels, pill-shaped controls, white bottom navigation, Japanese pattern accents, and bold typography, adapted to learning content. Sampled palette anchors are indigo `#37469E`, deeper indigo `#313790`, vivid orange `#FF5C00`, warm orange `#F05722`, and white `#FFFFFF`. Preserve readable Japanese and beginner support within this direction.
- Additional supplied references: `references/j-app-flashcard.webp`, `references/j-app-layout.jpg`, and `references/j-app-main.mp4`. The video still needs inspection before it informs design.
- Interests can include shrines, manga, anime, Japanese places, and culture. Examples should support useful daily-life Japanese at the learner's level.

## Why This Matters to the Learner

The learner uses WaniKani but finds it difficult to use remembered kanji without grammar and contextual examples. Their personal goals are written and spoken communication, watching anime in Japanese, and exploring Japanese places and culture. Their learning goal for this project is planning features and knowing the right way to carry out each task or feature.

## What "Working" Looks Like

A newcomer can sign in on Android, complete placement, choose interests, and finish an appropriately supported session teaching 3–5 kanji and one grammar pattern. They can hear and practise words and sentences, record and replay their speech, receive recognized-transcript feedback, and use the taught language in the shared free-conversation mode. The app records an ended chat, practised lesson goals, and long-term mastery separately.

For example, a shrine-interest lesson can prepare asking where the entrance is. If the learner changes the chat to anime without using the target request pattern, save the completed chat and recap, preserve completed exercises, and show that the pattern is not yet practised. If they use it appropriately in the new topic, it counts. They receive corrections, keep the reference sheet, save phrases, and return to saved progress and correctly scheduled reviews. This same complete experience is the product milestone for both submissions.

Integration proof includes real Qloo results, functioning speech recognition and playback, persistent account/learning data, and switching between two configured AI providers through the shared adapter without changing learning-feature code. A demonstration alone is insufficient: another person must be able to use the complete loop themselves.

## The MVP Boundary

- One shared MVP for Devpost Learn and the Qloo hackathon, evaluated by user value, integration reliability, and demonstrable quality. Assume AI-assisted development; do not size the scope using estimates of human coding hours.
- Android is the sole learning app, using Expo / React Native. The Next.js web portion is a landing page only.
- Focused reviewed N5/N4 starter lessons and interest-based conversation contexts; no claim of complete N5/N4 course coverage.
- Sign-in with Convex Auth and email/password, including email verification/recovery and remembered sessions; predefined placement with an adjustable recommendation, onboarding interest selection, and the ability to update interests later.
- The full core loop above, including individual/sentence pronunciation practice, recording playback, speech recognition, transcript feedback and retries, one free-conversation mode with Qloo-informed suggestions and lesson-linked goals, recap/reference sheet, saved flashcards, and functioning spaced reviews.
- Optional WaniKani import for kanji/vocabulary familiarity, kept separate from grammar, listening, and speaking ability.
- Support beginners with small kana groups, audio/meaning, romaji, and selectable input, keeping kana literacy separate from reading recall. Count partial active study toward a daily time goal and meaningful-step streaks separately from mastery.
- Previously downloaded/cached flashcards, lessons, references, audio, recording/playback, and sentence drafts work offline. Preserve pending AI feedback and local activity, then synchronize without duplicates or changing original study dates.
- TypeScript and Turborepo; Convex stores account and learning progress. Lessons, flashcards, and saved progress remain useful during AI-provider outages or quota exhaustion.
- Cloudflare AI Gateway routes AI connections through an adapter that supports switching between two real configured providers. Concrete providers and supported capabilities belong in the technical spec.
- Use the requested starter at implementation: `npx create-convex@latest -t get-convex/turbo-expo-nextjs-clerk-convex-monorepo`, adapting its Clerk authentication to the chosen Convex Auth and limiting its web app to the landing page.
- Prefer free tiers and free AI options where practical. Detailed screens, behavior, review rules, feedback, and failure states belong in the PRD and technical spec.

## Later

Higher-level JLPT courses, full mock exams, continuous voice conversations, specialized pitch-accent scoring, richer voices, subscriptions, iOS, and social sign-in are explicitly deferred by the learner. The wider feature wishlist remains in `devpost/learner-profile.md`; additional features need a separate scope decision rather than becoming implicit MVP commitments.

## Explicitly Cut

- A web/PWA learning app and completing the core journey across web and Android: the learner chose Android-only learning and a web landing page.
- Separate reduced and expanded product milestones for the two events: the learner wants the same complete MVP for both.
- Conversation tasks unrelated to the learner's interests or the language taught in that session: conversation goals must follow the interest, level, and lesson.
- A separate custom-scenario creation flow: topics and suggested scenarios/roleplay are handled within the shared conversation mode.

## Submission Targets

Use the shared product milestone for the Devpost Learn exercise and the Qloo hackathon. Check each event's eligibility and submission requirements separately before submission; product scope approval does not perform those checks.

The current working Qloo target is the [Qloo Agentic Hackathon](https://qloo.devpost.com/). Its [official rules](https://qloo.devpost.com/rules), checked October 13, 2026, require Qloo API integration and an agentic tool, an agent framework, or Qloo integrated into an existing agent, plus a functional demo link and public open-source repository. Its deadline is October 31, 2026 at 9:15 a.m. IST. The technical plan must explain how the learning workflow meets the agent requirement; no agent architecture has been chosen yet.
