# Japanese Learning App — Visual direction

The user-approved authority is `references/j-image-main.webp`, as recorded in the approved scope, PRD and technical spec. Kiro JP is an Android learning interface with a separate static landing.

## Android learning surfaces

Use indigo headers and background, rounded white learning panels, orange primary actions, pill controls and white five-destination navigation. Adapt the reference's density to Japanese reading, exercises and audio; retain system Back, safe/keyboard insets, font scaling and 48dp controls. Decorative wave accents may appear outside instructional content. Content uses the same measured spacing and type roles throughout.

## Palette and roles

The reference anchors are `#37469E`, `#313790`, `#FF5C00`, `#F05722` and white. `packages/design-tokens/src/index.ts` maps them to primary/secondary/surface roles and supplies legible ink/secondary-text/error colors and a dark scheme. Orange actions use dark text. Normal Japanese and English appear on calm solid panels; do not substitute decoration for learning content or display invented progress.

The launcher uses an original white open-book mark, with an orange lower page and speech/ribbon accent on indigo. Eight rounded strokes share exact geometry between the editable SVG and native mark. Opaque, transparent, monochrome and native splash PNG exports live in `apps/native/assets/branding`, with source hashes/provenance. Android applies its own circular or rounded mask; the artwork remains within the adaptive-icon safe circle.

Cold startup has one bounded authored moment: 日 reshapes into 本, then opens into the book/conversation logo. The learner approved the logo but found 0.2.9 too fast and its opening character awkward. The revised opening uses a clean joined 日 silhouette, briefly blended into the morph strokes; the approved final logo is unchanged. Native splash and the React overlay share the first Japanese frame, size and indigo background, with native splash retained until the bundled opening image is ready. A 320 ms opening hold, 760 ms first morph, 180 ms 本 hold, 840 ms logo morph, 180 ms final hold and 220 ms exit total 2.5 seconds. It runs once per root mount, respects reduced motion, dismisses on backgrounding and retains a 3.6-second watchdog. Account/network initialization runs underneath independently. Routine loading views use the static final mark and actual state label without replaying startup.

## Main hierarchy

Home has one main Start today's session action. Session title, target kanji, one pattern and a useful outcome lead; review counts, continuation and progress are secondary. Onboarding advances through saved steps with Back/Continue. Full sentences, adjustable readings and English meanings are distinct elements. Fixed-answer practice must hide the answer being tested; revealing it records assistance.

Home also offers one compact Today’s conversation panel below the study plan: a daily Qloo-informed topic, the saved interest behind it and a secondary Start chat action. Why this topic expands source inputs/date, Not interested and Edit interests. Keep the main study action dominant, avoid extra explanatory paragraphs, and show a useful choose-your-own-topic fallback when a new suggestion is unavailable. Daily suggestions rotate by the learner’s local date without changing during ordinary refreshes.

The learner's October 16 hands-on feedback calls for less explanatory text after login. Home uses compact daily-goal, distinct kanji/word/pattern totals and a short session checklist; detailed progress and settings open from clear rows. Profile leads with actual learning totals. Interests are broad selectable chips (Food, Culture, Places, Anime, Manga, Music, Travel, Daily life), with typed custom interests and preserved existing selections. Keep the reference palette and real study evidence.

## Layout and interaction

The October 23 supplied navigation reference replaces the full-width labelled bar with an inset rounded surface over the indigo background. Retain all five destinations as real accessible tabs, selected filled orange icons, 48dp minimum controls, standard tab events and the existing Back history. The bar participates in layout, so it does not cover content, reserves the system bottom inset and hides while typing.

The second October 23 reference applies to word teaching: neutral light/charcoal backgrounds and white/dark-gray cards, oversized regular-weight Japanese, a clear English gloss, adjustable readings/romaji, a compact checked example and orange circular audio controls. A small word strip and actual per-lesson word count provide context; do not copy the reference's invented 248/500. Word and sentence audio, slower playback, sentence breakdowns and pronunciation practice remain available. Memory aids and word-specific reading notes expand on demand. Keep recall exercises separate, with answers hidden, and preserve study timing/saving and lesson advancement.

Everyday screens show live values, concise labels and actions. Remove always-visible helper paragraphs; keep teaching explanations inside learning activities and relevant feedback/errors. Download controls belong beside their lesson, without a second list of duplicate lesson panels.

Use a top context/title region and a comfortable scrollable content area. Controls remain reachable above the keyboard. Five phone destinations: Home, Lessons, Review, Conversation, Profile. No web learning/account UI. The reset landing is only a secure app-opening handoff; it does not change a password.

## Truth and unfinished states

The October 18 revision uses a fixed chat header, incoming/outgoing message bubbles, timestamps and a compact microphone/message/send composer. Learning help expands inside the relevant reply; chat options hold secondary controls. Keep corrections, assistance recording and failure recovery available without filling the conversation with instructions.

Conversation opens an empty chat with a short prompt, four square category cards with icons (Places, Anime & Manga, Food, Daily Life), and a bottom message composer. A tap starts the chat immediately; the server selects a real Qloo result constrained to that category and checks the tag's applicable entity types. The selection stays stable on retry. Offline cards are disabled while typed drafts remain available. Routine local-save and pending-sync panels stay in the background; actionable failures, conflicts, offline availability and export/deletion scope remain visible. History lives behind a header action, with searchable loaded pages and Load older chats; opening a chat returns to the same message UI. Recap/help expand on demand. Keep Home's activity chart unchanged. Kanji remains the main learning track: level detail defaults to Kanji, radicals teach recognizable shapes/components and vocabulary connects kanji to use, with no radical unlock gates. Item details use Meaning, Readings and Related items; component rows open concise recognition lessons and related kanji.

Lessons opens seven real starter levels, each with radical, kanji and vocabulary grids. Kanji details distinguish the dictionary radical from visible components, show on’yomi and kun’yomi with the current word reading, and retain source acknowledgements. Do not invent unimplemented levels, mastery or a complete historical derivation from a partial component list. Daily activity uses a selectable seven-day bar chart of actual non-overlapping study time, with accessible date/minute labels.

Android Back follows detail and visited-tab history, with a parent fallback for direct entry. Only Home with no learning history offers an explicit close confirmation. Standard gesture Back is handled through the Android Back callback; the predictive animation is disabled for this compatibility build.

Initial UI previews are labelled as build-in-progress where activities are not connected. Missing listening audio stays unassessed. Cloud-sync failures preserve local answers and expose retry/conflict actions. No invented Qloo responses, testimonials, mastery, provider success or installable release.

## Verification boundary

Chat's phone action opens a focused voice-call view in the established indigo/white/orange system. Keep the Kiro mark, one clear live status, optional Japanese/English transcript and reachable Mute, Pause/Resume and End call controls. Start call explains automatic transcription/submission once before arming the microphone. Listening, transcribing, preparing reply, speaking and paused are actual states. No decorative ringing or invented connection status. End call returns to the same saved text chat; hints, corrections and finishing the conversation stay there. Record only detected speaking and real playback as practice time. Silence, denied access, unavailable audio and network loss pause with text fallback and never fabricate a successful turn.

The text-chat microphone starts recording directly in the bottom composer. Show a compact Recording label, elapsed timer, Stop and Cancel; opening a separate recording page is not the primary interaction. Stop requests a transcript, then the same composer area offers an editable preview and Use transcript. Preserve any existing typed draft when adding speech, and keep Send explicit. Permission changes, offline recognition and empty audio offer Record again or Type instead without clutter about background storage. This tap-to-record flow stays distinct from the phone action's hands-free calls.

The text-chat microphone starts recording directly in the bottom composer. Show a compact Recording label, elapsed timer, Stop and Cancel; opening a separate recording page is not the primary interaction. Stop requests a transcript, then the same composer area offers an editable preview and Use transcript. Preserve any existing typed draft when adding speech, and keep Send explicit. Permission changes, offline recognition and empty audio offer Record again or Type instead without clutter about background storage. This tap-to-record flow stays distinct from the phone action's hands-free calls.

Native screenshot evidence must come from an actual Android device or emulator, including font scaling and dark theme. The task-local Android 15 emulator and early signed APK are configured; account/onboarding/Home evidence is recorded in devpost/build-evidence.md. Each later learning surface needs its own native check. Browser checks validate the separate landing only and cannot establish native layout/storage/speech correctness.
