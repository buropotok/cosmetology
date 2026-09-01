# Stable builds

This file is the canonical history of manually verified stable Cosmo Sofa builds.

## Rule

- Add an entry only after the build has been verified on the real target device/runtime.
- Keep the exact Git commit SHA so the working tree can be restored deterministically.
- New development continues on `main`; this file records recovery points and does not imply that later commits are stable.

## 2026-09-01 — Legacy PoC JS/CSS cleanup

**Commit:** `c7a17828ad13a190659c7715cdf097808b2f8af4`

Verified state:

- Verified on the real target device/runtime after Stage 3 legacy cleanup.
- Dead legacy DOM handling was removed from `miniapp/composer-mockup.js`.
- Dead styles for the removed account block, manual onboarding/pairing UI, legacy upload UI, and managed-bot PoC were removed from `miniapp/styles.css`.
- Modern composer, photo flow, Telegram/VK flows, Settings, and current onboarding UI remain operational.
- This is the current stable rollback point after the legacy PoC markup, JS, and CSS cleanup.

## 2026-09-01 — Legacy PoC markup removed from composer

**Commit:** `201d2ff00b028d465134516d2b66701709f421e7`

Verified state:

- Verified on the real target device/runtime after Stage 2 legacy PoC removal.
- Legacy account status block, manual VK URL onboarding block, and managed-bot PoC controls are physically removed from `miniapp/index.html`.
- Modern composer remains operational with the required foundational DOM controls retained for `app.js` and `composer-mockup.js`.
- Telegram/VK composer flow, photo controls, settings, and current application UI remain operational in the verified build.
- This is the rollback point before Stage 3 dead legacy JS/CSS cleanup.

## 2026-09-01 — Settings editors + verified VK onboarding

**Commit:** `6050a76a55fa2770cd0dc65d78444933335f4e67`

Verified state:

- VK onboarding opens the VK group picker and discovers managed communities.
- VK group selection is saved successfully from the Android VK WebView.
- VK onboarding success screen is shown after save.
- VK save uses the proven no-preflight transport (`text/plain;charset=UTF-8` with a JSON-string body); do not switch this request back to `application/json` without a real-device regression test.
- Settings display the connected VK group title.
- Settings edit (pencil) actions open their screens immediately and refresh state in the background instead of blocking navigation on `/api/miniapp/me`.

Use this commit as the rollback point before the legacy PoC removal/refactoring work.

## 2026-09-01 — VK onboarding transport baseline

**Commit:** `56998c01f57c61be962b8cc1415d0e3e11087ead`

Verified state:

- VK group discovery works through VK Bridge.
- VK group save succeeds on the real Android VK client after changing the cross-origin save request to the no-preflight transport.
- Success screen and Close action are available.

This is the earlier recovery point before the settings editor responsiveness change.
