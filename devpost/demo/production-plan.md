# Kiro JP hackathon demo production

## Approved format

- 1920 × 1080, landscape, 30 fps; target 60–75 seconds.
- Indigo `#37469E`, deep indigo `#313790`, orange `#FF5C00`, white.
- Large headline on the left, central Android phone, concise callouts on the right, subtle warm lighting and oversized Japanese background type.
- Exact logo from `apps/native/assets/branding/kiro-mark.svg`; no generated replacement.
- Current Android release: 0.2.10, version code 12. The mobile app is not being redesigned for the video.
- Actual app captures inside the phone. Never present a reconstructed or generated screen as recorded Android UI.

## Proposed sequence

Timing remains provisional until narration is listened to and the real footage is reviewed.

| Scene | Focus | Required real app evidence |
| --- | --- | --- |
| Opening | Learn it. Use it. Remember it. | Approved logo and launch / Home reveal |
| Daily plan | Your level. Your interests. Your daily plan. | Current Home, interests, due reviews and progress |
| Learning | Kanji in useful language | Kanji detail: components, meanings, taught readings; matching grammar example |
| Practice | Hear it. Try it. | Word audio, sentence practice, transcript confirmation / retry |
| Conversation | A conversation worth having | Today's Qloo recommendation, new chat, actual exchange, hint / translation / correction |
| Review | Bring the language back | Save a phrase, meaning / reading reviews, retained progress |
| End card | Kiro JP | Exact approved mark and concise learning-loop tagline |

## Capture requirements

Record Kiro JP 0.2.10 on an Android phone in portrait orientation. Hide notifications and use a synthetic demo account. Avoid email addresses, passwords, API keys and unrelated personal screens. Natural pauses after taps make footage easier to edit. Keep original app colors, fonts, spacing, navigation and messages.

Capture these short clips, preferably as one continuous screen recording:

1. Home: daily plan, due reviews, actual kanji / vocabulary progress and the daily Qloo conversation suggestion.
2. Interests: broad categories such as Food, Culture, Places, Anime and Manga.
3. Lessons: a kanji detail with its named components and relevant readings; then the matching grammar example.
4. Pronunciation / sentence practice: audio, an attempt, recognized transcript and feedback. Never show a fabricated successful assessment.
5. Conversation: current empty-chat entry, type a topic, show a real response, and open an available hint or translation.
6. Save a phrase, then demonstrate a due review and its actual result.

Existing `.android-runtime` captures are older development evidence. They must be inspected individually; they do not establish the appearance of the current Home or Conversation UI. Do not use old screens as if they were current release footage.

The host reported 2,361 MB free RAM during this session. The Android emulator is not running; avoid repeating the previously unstable low-memory capture attempt. Request current phone footage for the final UI proof.

## Build checkpoint

- Remotion skills read; no existing Remotion project found.
- Intended isolated project folder: `videos/kiro-demo` (outside the existing app workspaces).
- Scaffold attempt failed before creating the project because Volta could not write its cache.
- Escalated package installation was not executed: automatic approval review reported capacity.
- Do not bypass that review or silently switch package-install methods.
- Next setup command, to run from the repository in a normal external terminal if automatic review remains unavailable:

```powershell
npx create-video@latest --yes --blank --no-tailwind videos/kiro-demo
cd videos/kiro-demo
npm install
npx remotion studio --no-open
```

After setup, open Studio before editing the composition. Build each scene as an independently editable source node, register its connected composition, and reference only approved assets through `public/`. Inspect representative frames and verify the real footage before final MP4 export. Retain an editable project and save a local final output; do not publish or submit without authorization.

## Truthfulness boundaries

Show the focused starter learning loop. Do not claim a complete N5–N1 course, guaranteed fluency, independent mastery after one lesson, published Google Play availability or production hosting. Qloo informs cultural contexts; it is not the conversation language model. The website is a landing page, not a web learning app.
