# Japanese Learning App — Visual direction

The user-approved authority is `references/j-image-main.webp`, as recorded in the approved scope, PRD and technical spec. Kiro JP is an Android learning interface with a separate static landing.

## Android learning surfaces

Use indigo headers and background, rounded white learning panels, orange primary actions, pill controls and white five-destination navigation. Adapt the reference's density to Japanese reading, exercises and audio; retain system Back, safe/keyboard insets, font scaling and 48dp controls. Decorative wave accents may appear outside instructional content. Content uses the same measured spacing and type roles throughout.

## Palette and roles

The reference anchors are `#37469E`, `#313790`, `#FF5C00`, `#F05722` and white. `packages/design-tokens/src/index.ts` maps them to primary/secondary/surface roles and supplies legible ink/secondary-text/error colors and a dark scheme. Orange actions use dark text. Normal Japanese and English appear on calm solid panels; do not substitute decoration for learning content or display invented progress.

The launcher uses an original white 日 mark with an orange conversation tail on indigo. The editable vector and opaque/transparent/monochrome PNG exports live in `apps/native/assets/branding`. Android applies its own circular or rounded mask; the artwork remains within the adaptive-icon safe circle. The icon introduces no additional text or decoration inside learning screens.

## Main hierarchy

Home has one main Start today's session action. Session title, target kanji, one pattern and a useful outcome lead; review counts, continuation and progress are secondary. Onboarding advances through saved steps with Back/Continue. Full sentences, adjustable readings and English meanings are distinct elements. Fixed-answer practice must hide the answer being tested; revealing it records assistance.

Home also offers one compact Today’s conversation panel below the study plan: a daily Qloo-informed topic, the saved interest behind it and a secondary Start chat action. Why this topic expands source inputs/date, Not interested and Edit interests. Keep the main study action dominant, avoid extra explanatory paragraphs, and show a useful choose-your-own-topic fallback when a new suggestion is unavailable. Daily suggestions rotate by the learner’s local date without changing during ordinary refreshes.

The learner's October 16 hands-on feedback calls for less explanatory text after login. Home uses compact daily-goal, distinct kanji/word/pattern totals and a short session checklist; detailed progress and settings open from clear rows. Profile leads with actual learning totals. Interests are broad selectable chips (Food, Culture, Places, Anime, Manga, Music, Travel, Daily life), with typed custom interests and preserved existing selections. Keep the reference palette and real study evidence.

## Layout and interaction

Everyday screens show live values, concise labels and actions. Remove always-visible helper paragraphs; keep teaching explanations inside learning activities and relevant feedback/errors. Download controls belong beside their lesson, without a second list of duplicate lesson panels.

Use a top context/title region and a comfortable scrollable content area. Controls remain reachable above the keyboard. Five phone destinations: Home, Lessons, Review, Conversation, Profile. No web learning/account UI. The reset landing is only a secure app-opening handoff; it does not change a password.

## Truth and unfinished states

The October 18 revision uses a fixed chat header, incoming/outgoing message bubbles, timestamps and a compact microphone/message/send composer. Learning help expands inside the relevant reply; chat options hold secondary controls. Keep corrections, assistance recording and failure recovery available without filling the conversation with instructions.

The learner's follow-up replaces the Conversation entry form with an empty chat: a short prompt, at most four saved-interest suggestions and a bottom message composer. History lives behind a header action, with searchable loaded pages and Load older chats; opening a chat returns to the same message UI. Recap/help expand on demand. Keep Home's activity chart unchanged. The user clarified that kanji remains the main learning track: level detail defaults to Kanji, radicals teach recognizable shapes/components and vocabulary connects kanji to use, with no new radical unlock gates. Item details use Meaning, Readings and Related items; component rows open concise recognition lessons and related kanji.

Lessons opens seven real starter levels, each with radical, kanji and vocabulary grids. Kanji details distinguish the dictionary radical from visible components, show on’yomi and kun’yomi with the current word reading, and retain source acknowledgements. Do not invent unimplemented levels, mastery or a complete historical derivation from a partial component list. Daily activity uses a selectable seven-day bar chart of actual non-overlapping study time, with accessible date/minute labels.

Android Back follows detail and visited-tab history, with a parent fallback for direct entry. Only Home with no learning history offers an explicit close confirmation. Standard gesture Back is handled through the Android Back callback; the predictive animation is disabled for this compatibility build.

Initial UI previews are labelled as build-in-progress where activities are not connected. Missing listening audio stays unassessed. Cloud-sync failures preserve local answers and expose retry/conflict actions. No invented Qloo responses, testimonials, mastery, provider success or installable release.

## Verification boundary

Native screenshot evidence must come from an actual Android device or emulator, including font scaling and dark theme. The task-local Android 15 emulator and early signed APK are configured; account/onboarding/Home evidence is recorded in devpost/build-evidence.md. Each later learning surface needs its own native check. Browser checks validate the separate landing only and cannot establish native layout/storage/speech correctness.
