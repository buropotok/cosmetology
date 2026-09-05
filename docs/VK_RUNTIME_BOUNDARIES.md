# VK runtime boundaries

This document defines the safety boundary for VK cleanup work.

## Protected production contract: VK onboarding

VK onboarding is intentionally isolated and must not be removed, renamed, or behaviorally changed by legacy cleanup.

Protected client path:

- `miniapp/onboarding-api.js` → `POST /api/miniapp/vk-onboarding`
- `miniapp/onboarding-controller.js` → `connectVk()` → Telegram external link
- account refresh through `/api/miniapp/me` and `vkGroup.connected`

Protected Worker path:

- `worker/src/entry.ts` routes:
  - `POST /api/miniapp/vk-onboarding`
  - `GET|POST|OPTIONS /api/vk-onboarding/:token`
- `worker/src/services/vk-onboarding.ts`
- `vk_onboarding_handoffs` persistence
- `user_vk_group` persistence
- `user_onboarding_skip` update for `vk_group`
- `telegram-miniapp-auth` and `telegram-identity` dependencies
- `yandex-vk-replica` is currently a dependency of successful onboarding selection and is therefore protected until it is deliberately decoupled.

## Protected production contract: VK publication preparation

The currently verified Mini App flow is also protected:

- canonical `#publish-vk`
- Composer/DraftStore flush before preparation
- copy publication text to clipboard
- read the saved Mini App draft
- obtain the first saved image through its signed/draft URL
- `Telegram.WebApp.downloadFile()` for the image

`POST /api/miniapp/vk-link` is a separate link-opening/backup UX. It is not required for clipboard/image preparation, but it must not be deleted as part of unrelated cleanup until that UX is restored or explicitly retired.

## Legacy candidates — not yet safe to delete

The following are historical publication mechanisms, but they remain routed from `worker/src/entry.ts` and must be proven unreachable before removal:

- `/vk-test` and `/vk-test-image`
- `worker/src/vk-miniapp.ts`
- `/api/miniapp/vk-handoff`
- `/api/vk-handoff/:token`
- `/api/vk-handoff-upload/:token`
- `/api/vk-handoff-image/:token`
- `worker/src/services/vk-handoff.ts`
- direct VK publishing in `worker/src/services/vk.ts` / publisher path
- VK auth debug tooling

## Cleanup rule

A VK component may be deleted only when both conditions hold:

1. It is outside the two protected contracts above and is not a transitive dependency of them.
2. Repository/runtime evidence shows that no current production entry point depends on it.

Do not infer dead code merely from names such as `handoff`, `test`, `debug`, `replica`, or `legacy`.
