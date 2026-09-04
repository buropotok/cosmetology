# Stable builds

This file is the canonical history of manually verified stable Cosmo Sofa builds.

## Rule

- Add an entry only after the build has been verified on the real target device/runtime.
- Keep the exact Git commit SHA so the working tree can be restored deterministically.
- New development continues on `main`; this file records recovery points and does not imply that later commits are stable.

## 2026-09-04 — Stable VK clipboard + single-image preparation baseline

**Commit:** `ac182fc5b2dad66b6a71dce3d2146b4859fd4710`

Verified state:

- Verified by the user in the real Telegram Mini App UI after the isolated VK publication rebuild.
- The active VK action uses the canonical `#publish-vk` DOM identity, so it inherits the existing approved VK button styling and icon path rather than maintaining a second visual implementation.
- The obsolete duplicate VK button is removed/replaced in the DOM; there is only one active `#publish-vk` action.
- The active VK action keeps the proven isolated test behavior: publication text is copied to the clipboard when present and one saved draft image is requested through the official `Telegram.WebApp.downloadFile()` API.
- The image is obtained from the existing server draft endpoint and its signed HTTPS download URL; no client-side blob reconstruction or legacy image-save mechanism is used.
- This checkpoint intentionally represents the incremental one-image VK preparation path. Do not infer the older multi-image/VPN handoff behavior from this entry.
- Do not modify the rich-text editor/list behavior when restoring or extending this checkpoint. VK preparation must remain isolated from editor internals.

Use this commit as the rollback point for the verified single-image VK preparation/button baseline.

## 2026-09-03 — Stable Publisher draft entry and navigation UX

**Commit:** `d762e9b66f9584cf07100f2641c136bb32fc193f`

Verified state:

- Verified by the user on the real Android Telegram Mini App runtime after the draft-entry UX and navigation fixes.
- `Продолжить работу` is shown on the first screen only when a non-empty draft exists.
- The second screen provides `Ручное создание публикации`; it clears the existing draft before opening screen 3 / Publisher with empty text and no images.
- While a draft is restoring, image input is disabled and the preview area shows a `Загрузка черновика` loader, preventing user-selected images from racing with stale restore data.
- Screen ownership/navigation is synchronized so manual publication reliably renders Publisher instead of leaving only the Diagnostics section visible.
- Programmatic active-photo selection during draft restore no longer produces a false user change / redundant draft save.
- Diagnostics are sanitized: Telegram init data, signed query strings, and full publication text are not written to the diagnostic log.
- The existing generation-guarded restore and single-flight draft writer semantics remain intact.

Use this commit as the rollback point for the verified Publisher draft-entry/navigation flow.

## 2026-09-02 — Stable Mini App draft writer

**Commit:** `032a11cb324088ca6a7eec2bb15bbd8c62ed4cc6`

Verified state:

- Verified on the real Android Telegram Mini App runtime by the user after repeated draft restore/save/publish cycles.
- Draft autosave uses a single-flight writer: at most one `POST /api/miniapp/draft` is in flight at a time.
- Changes are tracked by monotonic revisions; changes made during an in-flight save are coalesced and persisted by a follow-up save instead of starting a parallel request.
- Image dirty state is revision-aware, so completion of an older request cannot incorrectly acknowledge newer image changes.
- Already-current revisions do not generate redundant draft POSTs (`draft-save-current`).
- Duplicate image change notifications are guarded by the current FileList signature before advancing the image revision.
- Async draft restore is generation-guarded and can be cancelled when entering a new composition, preventing stale restored images from arriving later and overwriting the current screen-3 state.
- `visibilitychange` / API save requests do not create extra POSTs when the current revision is already persisted.
- Diagnostics confirmed successful draft restore, draft save, publication, visibility transitions, and subsequent draft reads without request errors.
- Known performance characteristic, not a correctness failure: draft saves containing images can take several seconds because image binaries are uploaded with the draft. Future optimization may move images to independent uploads referenced by IDs; do not change the stable writer semantics solely to optimize this path without a real-device regression test.

Use this commit as the rollback point for the verified Mini App draft lifecycle.

## 2026-09-02 — Stable VK multi-image save + VPN handoff flow

**Commit:** `6b80b74821f1c938dd419f40a73fa9a263ebccd4`

Verified state:

- Verified on the real Android target device/runtime by the user: the complete Telegram Mini App → VK preparation flow works exactly as intended.
- On `Опубликовать в ВКонтакте`, publication text is copied to the clipboard when present.
- All selected images are saved sequentially through the official `Telegram.WebApp.downloadFile()` API.
- Draft image URLs are short-lived HMAC-signed HTTPS download URLs, so Telegram/Android DownloadManager can fetch them without the Mini App `Authorization: tma ...` header.
- The images were verified to appear in the Android Gallery on the real device.
- Telegram provides the native image-download UI/progress itself. Do not add a custom intermediate photo-saving modal or loader on top of it.
- Only after all image download requests have been accepted does Cosmo Sofa show the VK readiness/VPN modal.
- The readiness modal confirms prepared materials (`Текст скопирован` when applicable and `Изображения сохранены: N`) and then shows:
  1. `Отключите VPN`
  2. `Вернитесь сюда и нажмите "Продолжить".`
- `Продолжить` opens the existing native VK publication handoff.
- If an image download is cancelled or cannot be started, the flow stops before the VPN/VK step.

Use this commit as the current rollback point for the verified Telegram → VK publication flow.

## 2026-09-02 — Stable VK VPN handoff flow

**Commit:** `6f7b86b33715c340fe9fa697f6edd44d2bdb2909`

Verified state:

- Verified on the real target device/runtime by the user: the Telegram → VK publication handoff works correctly.
- Before opening VK, the Telegram Mini App shows a deterministic two-step instruction instead of trying to detect VPN state:
  1. `Отключите VPN`
  2. `Вернитесь сюда и нажмите "Продолжить".`
- If VPN is already disabled, the user can simply press `Продолжить` without changing anything.
- The experimental `SHOW IMAGE` VK Bridge probe has been removed; VK onboarding is back on the `vk-save-get-20260901-1` baseline.
- Do not add Telegram reachability / ping heuristics for VPN detection: Telegram availability does not reliably indicate VPN state because Telegram may work through a proxy or other network path.
- Future optional UX improvement: immediately before opening the native VK new-post interface, show a compact readiness hint such as `Текст скопирован` / `Изображения сохранены`, followed by an instruction to paste the text and add the saved images in VK. This is documentation only; do not change the currently verified publication mechanics solely to add this hint.

Use this commit as the current rollback point for the verified Telegram → VK handoff UX.

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
