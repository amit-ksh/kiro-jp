# Kiro JP

An Android app for English-speaking beginners learning Japanese. It connects kanji, vocabulary and one useful grammar pattern per lesson with spaced reviews and an AI tutor conversation built around the learner's own interests through Qloo.

- Landing page: https://kiro-jp.vercel.app/
- Demo video: [`kiro-jp-demo.mp4`](kiro-jp-demo.mp4) (62 s, 1080p)
- Source: https://github.com/amit-ksh/kiro-jp

## Media

| File | Contents |
| --- | --- |
| `kiro-jp-demo.mp4` | Narrated walkthrough recorded on a real Android phone |
| `cover-3x2.png` | 1500 x 1000 cover |
| `gallery-01.png` | Daily plan and interests |
| `gallery-02.png` | Kanji detail: meaning, readings, radicals, vocabulary |
| `gallery-03.png` | Sentence building practice |
| `gallery-04.png` | Tutor reply with a Qloo recommendation |
| `gallery-05.png` | Ongoing tutor conversation and saved phrases |
| `gallery-06.png` | Spaced review recall |

All phone footage and screens come from Kiro JP 0.2.16 on a moto g32, recorded October 24, 2026.

## Features

- **Daily plan:** level (supported foundations, early N5, early N4), daily minutes, learning goal, JLPT target and exam date. Home shows today's session, due reviews, streak and kanji/word/pattern counts.
- **Lessons:** seven source-checked starter lessons. Each covers four kanji, three kana and one grammar pattern (for example 水・茶・本・円 with `[item] + をください`). Steps include model and slower audio, meaning, reading and kana recall, phrase choice, tile sentence building and particle fill-in.
- **Kanji detail:** meaning, memory aid, on'yomi and kun'yomi, radicals and related vocabulary, from JMdict, KANJIDIC2 and KanjiVG data.
- **Grammar reference:** offline search across all seven patterns, with usage, a common mistake, sentence breakdowns and cached audio.
- **Tutor conversation:** pick a category (Places, Anime & Manga, Food, Daily Life) or type any topic. Replies are short Japanese with kana, romaji and English help, reply hints and phrases you can save.
- **Qloo cultural context:** saved interests and the current topic drive real Qloo recommendations, with source details, disambiguation when a title matches more than one entry, and "Not interested".
- **Spaced reviews:** meaning and reading are tracked as separate cards. Saved phrases become cards. Extra practice doesn't move the schedule.
- **Speaking:** recorded attempts with recognition transcripts, inline voice input in chat, and hands-free voice calls.
- **Offline and account:** prepared lessons and reviews work offline; WaniKani familiarity import; data export and account deletion.

## How the tutor agent uses Qloo

The tutor is a Vercel AI SDK agent running Gemini through Cloudflare AI Gateway (`packages/backend/convex/conversationAI.ts`). It decides on each turn whether to call two tools:

- `findConversationContext` turns a broad interest or a named favourite into real Qloo signals (`/search`, `/v2/tags`), then calls `/v2/insights`. It returns recommendations or disambiguation candidates and excludes the learner's dislikes.
- `lookupReviewedLanguage` is a read-only lookup of checked vocabulary and grammar, limited to four calls per turn.

Qloo IDs must come from tool results, and every reply cites the IDs it used. Tool output is treated as data, not instructions. When Qloo has nothing usable, the tutor carries on with an ordinary conversation and makes no Qloo claim. Qloo chooses the cultural context; lesson content and level are set by the checked curriculum.

## Stack

| Area | Technology |
| --- | --- |
| Android app | Expo, React Native, TypeScript, Expo Router, SQLite, WanaKana |
| Backend | Convex, Convex Auth |
| AI | Vercel AI SDK, Gemini 3.8 Flash, Gemini 3.8 Flash Lite TTS, Cloudflare AI Gateway, Cloudflare Workers AI (Whisper large v3 turbo) |
| Culture | Qloo Insights API |
| Landing page | Next.js on Vercel |
| Monorepo | Turborepo, pnpm |

## Current limits

- Starter N5/N4 content only; not a full N5-N1 course.
- Android only; not yet on Google Play. The website is a landing page.
- Content is checked against primary sources but not certified by a native-speaker reviewer.
- Known issues: tutor topic and Qloo card can disagree, some kana/romaji formatting (katakana shown as hiragana, は romanised as "ha"), duplicated Qloo years, a few Back navigation destinations, and the keyboard covering "Check my answer".

## Roadmap

From the project's deferred scope: N3-N1 courses, full JLPT mock exams, continuous voice conversations, pitch-accent feedback, richer voices, placement tests, weekly summaries, native-speaker content review, social sign-in, iOS, and a Google Play release.

### Pricing reference

Not decided yet. Comparable apps, from third-party reviews checked October 24, 2026:

| App | Focus | Price |
| --- | --- | --- |
| WaniKani | Kanji SRS | $9/mo, $89/yr, $299 lifetime; levels 1-3 free |
| Bunpro | Grammar SRS | $5/mo, $50/yr, $150 lifetime; 30-day trial |
| Duolingo | General | Super about $12.99/mo; Max (AI) about $29.99/mo or $168/yr |
| Speak | AI speaking tutor | about $17.99/mo or $84/yr |
| Praktika | AI tutor | about $8-10/mo |

Running costs to cover: Gemini tokens per chat turn and TTS clip (budgeted in `packages/backend/convex/aiBudget.ts`), Whisper minutes, Convex usage, Qloo API access and Cloudflare Gateway.

Sources: [WaniKani plans](https://knowledge.wanikani.com/account-and-membership/payment-and-billing/subscription-plans/), [Bunpro pricing](https://bunpro.jp/pricing), [Duolingo cost](https://www.dealnews.com/features/duolingo/cost/), [Duolingo Max review](https://kidedtools.com/blog/duolingo-max-ai-language-learning-review-2026/), [Speak pricing](https://recurdash.com/subscription-pricing/speak), [Praktika review](https://www.icanlearn.com/praktika/).
