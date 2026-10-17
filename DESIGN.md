# Japanese Learning App — Visual direction

The user-approved authority is `references/j-image-main.webp`, as recorded in the approved scope, PRD and technical spec. Kiro JP is an Android learning interface with a separate static landing.

## Android learning surfaces

Use indigo headers and background, rounded white learning panels, orange primary actions, pill controls and white five-destination navigation. Adapt the reference's density to Japanese reading, exercises and audio; retain system Back, safe/keyboard insets, font scaling and 48dp controls. Decorative wave accents may appear outside instructional content. Content uses the same measured spacing and type roles throughout.

## Palette and roles

The reference anchors are `#37469E`, `#313790`, `#FF5C00`, `#F05722` and white. `packages/design-tokens/src/index.ts` maps them to primary/secondary/surface roles and supplies legible ink/secondary-text/error colors and a dark scheme. Orange actions use dark text. Normal Japanese and English appear on calm solid panels; do not substitute decoration for learning content or display invented progress.

The launcher uses an original white 日 mark with an orange conversation tail on indigo. The editable vector and opaque/transparent/monochrome PNG exports live in `apps/native/assets/branding`. Android applies its own circular or rounded mask; the artwork remains within the adaptive-icon safe circle. The icon introduces no additional text or decoration inside learning screens.

## Main hierarchy

Home has one main Start today's session action. Session title, target kanji, one pattern and a useful outcome lead; review counts, continuation and progress are secondary. Onboarding advances through saved steps with Back/Continue. Full sentences, adjustable readings and English meanings are distinct elements. Fixed-answer practice must hide the answer being tested; revealing it records assistance.

The learner's October 16 hands-on feedback calls for less explanatory text after login. Home uses compact daily-goal, distinct kanji/word/pattern totals and a short session checklist; detailed progress and settings open from clear rows. Profile leads with actual learning totals. Interests are broad selectable chips (Food, Culture, Places, Anime, Manga, Music, Travel, Daily life), with typed custom interests and preserved existing selections. Keep the reference palette and real study evidence.

## Layout and interaction

Everyday screens show live values, concise labels and actions. Remove always-visible helper paragraphs; keep teaching explanations inside learning activities and relevant feedback/errors. Download controls belong beside their lesson, without a second list of duplicate lesson panels.

Use a top context/title region and a comfortable scrollable content area. Controls remain reachable above the keyboard. Five phone destinations: Home, Lessons, Review, Conversation, Profile. No web learning/account UI. The reset landing is only a secure app-opening handoff; it does not change a password.

## Truth and unfinished states

Initial UI previews are labelled as build-in-progress where activities are not connected. Missing listening audio stays unassessed. Cloud-sync failures preserve local answers and expose retry/conflict actions. No invented Qloo responses, testimonials, mastery, provider success or installable release.

## Verification boundary

Native screenshot evidence must come from an actual Android device or emulator, including font scaling and dark theme. The task-local Android 15 emulator and early signed APK are configured; account/onboarding/Home evidence is recorded in devpost/build-evidence.md. Each later learning surface needs its own native check. Browser checks validate the separate landing only and cannot establish native layout/storage/speech correctness.
