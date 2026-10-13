# Build evidence — 2026-10-13

Slice 1 remains in progress. This records observed checks, not completion of the MVP.

| Check | Observed result |
| --- | --- |
| Requested starter | Downloaded successfully; its automatic npm install rejected `workspace:*`. Adapted its pnpm monorepo without overwriting plans or private environment files. |
| Workspace TypeScript | All six packages passed. Subsequent auth/profile changes passed native and backend compilation. |
| Lint | Native and landing passed after repairing effect lifetimes and reset handoff. |
| Domain tests | Nine passing tests cover placement thresholds, unavailable listening, bank revisions, account/cache selection, malformed tokens and reset-session identity. These do not prove Android persistence. |
| Backend deployment | Auth/account/profile functions deployed to the configured development Convex project. Setup uses a hoisted compiler after API generation. |
| Anonymous access | `account.current` returned null; `profile.get` rejected anonymous access. |
| Public auth signing metadata | HTTPS JWKS returned 200, valid JSON with one RS256 public key and no private fields. Repaired serialization while preserving the existing private key. |
| Expo compatibility | SDK 55 dependency check passed after patch alignment. |
| Android export | Hermes export succeeded; later auth changes were separately compiled/exported. Bundling is not installation evidence. |
| EAS source archive | 84 files; no private env/profile/starter/runtime files and zero matches for the configured deployment/email secret bytes. Public backend URLs are intentionally included. |
| EAS identity | Project `48bd39bd-9a50-4802-a67a-63eeda132992`, package `com.kiro.japanesestudy`; Expo created and retains the Android keystore. Preserve this identity. |
| Early APK | Build `d63fee23-1b4d-4ec2-920e-0969a847432e` finished, downloaded (89,342,526 bytes), signature verified and installed on the task-local Android emulator. It launches without Metro. This snapshot predates the later bundled audio/email-control revisions. |
| Signing certificate | SHA-256 `3D:07:88:90:1F:50:B8:8B:1E:B4:72:45:6E:97:5B:25:C3:7A:64:4E:86:1D:B5:5F:B1:D3:8D:E9:82:40:61:A1`; matching association JSON prepared in the static landing, not yet hosted. |
| Native startup/sign-in | Actual welcome screen captured from APK. Synthetic account sign-in reached saved onboarding; initial startup produced no ReactNativeJS/AndroidRuntime errors in the scoped check. |
| Native offline restart | Selected Completely new, saved it, enabled airplane mode, force-stopped/restarted the app. Remembered account and selected setup survived; captured native accessibility tree showed Completely new selected. This does not prove future review-event reconciliation. |
| Android target | Task-local API 35 Google APIs x86_64 emulator booted, Android 15, WHPX acceleration; reduced data partition to fit local disk. |
| Landing | Static Next.js build passed. Browser checks at 1440/390/320 px found no page errors or horizontal overflow. Self-hosted Lexend; Japanese labels remained on one line after a narrow-layout repair. |
| Reset web handoff | Valid-format synthetic token produced the expected app link; query was removed from browser history. Invalid-format token showed request-new-link guidance. No real credential change was claimed. |
| Resend | Current sender uses owner-only `resend.dev` testing. Learner explicitly authorized this temporary sender; verified domain delivery to another learner remains pending. |
| Current account policy | Learner subsequently deferred all mail verification/reset flows. Both providers are now disabled by `ACCOUNT_EMAIL_ENABLED`; no recovery is claimed. |
| Live account checks | Eight checks passed: two distinct accounts, isolated owned profiles, stale-revision rejection, foreign-owner argument rejection, normalized sign-in to the same account, retained profile and wrong-password rejection. Synthetic addresses; no email sent. |
| Gemini Gateway | Model metadata for Flash and Flash-Lite TTS returned 200 through the configured Gateway. Three WAV generations and the successful transcript check also used Gateway; no direct-provider fallback. |
| Placement clips | Water request, right and tea desire clips generated; WAV format/duration/hash recorded. AI transcript consistency matched all three intended kana strings. Native-speaker review is not claimed. |
| Paid budget | Learner approved US$10 total Gemini usage. Ledger currently records 1,788 micro-USD in estimated token cost and holds 1,032,192 micro-USD for the failed first audio check. Conservative held capacity is not a charge claim. |
| HTTPS host | Learner confirmed `kiro-jp.vercel.app` is a future placeholder and `/auth/reset` is the planned route. It currently returns 404. Verified App Links require deployment and the actual APK certificate association. |

## Remaining first-slice checks

Build/install the latest source snapshot, including bundled placement audio and disabled recovery controls. Finish the complete native setup/Home path, inspect font scaling and account switching, and check audio playback. Verified reset links and email recovery are explicitly deferred at the learner's request.

Gateway/TTS credentials are configured and the three clips are prepared. No Resend recipient is required while email is disabled. Listening remains unassessed if audio playback is unavailable. Later learning, Qloo/chat, speech, spaced-review and release slices have not been accepted or committed.
