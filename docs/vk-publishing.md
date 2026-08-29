# VK publishing

## Confirmed flow

The production direction is Telegram Mini App -> backend draft/handoff -> VK Mini App -> `VKWebAppShowWallPostBox` -> user confirmation in the native VK composer.

Confirmed experimentally:

- `owner_id = -<vk_group_id>` opens/publishes to the target community.
- `message` pre-fills the post text.
- `upload_attachments` with a direct public image URL pre-fills the photo.
- An R2 image exposed through the Worker can be consumed by the VK Mini App flow.

## VK group onboarding

The Telegram Mini App stores a per-user VK destination. The canonical value used for publishing must be the numeric positive `vk_group_id`; the original URL/screen name is auxiliary metadata only.

Current implementation accepts URLs whose numeric ID is encoded in the path:

- `vk.com/club<ID>`
- `vk.com/public<ID>`

## REQUIRED TODO: vanity URL resolver

Before VK group onboarding is considered complete, support ordinary vanity/community URLs such as:

- `vk.com/my_cosmetology`
- `vk.com/some_clinic`

Required behavior:

1. Accept `vk.com/<screen_name>` in the same VK-group field in the Telegram Mini App.
2. Resolve `<screen_name>` to the community's canonical numeric ID.
3. Verify that the resolved VK object is a group/community rather than a user profile or another unsupported object.
4. Store the positive numeric ID as `vk_group_id` in D1.
5. Keep the submitted URL and/or canonical screen name as auxiliary data for display/debugging.
6. All publishing code must use `owner_id = -vk_group_id`; it must never depend on the vanity name at publication time.
7. Return a clear validation error when the URL cannot be resolved or does not refer to a supported VK community.

This TODO is part of the VK onboarding contract, not an optional enhancement. The current `club<ID>` / `public<ID>` parser is intentionally an intermediate implementation.

## Next integration step

Connect the Telegram Mini App publication draft (text + selected/stored image + saved `vk_group_id`) to the VK Mini App via a short-lived, unguessable handoff token. The VK Mini App should fetch the handoff payload and call `VKWebAppShowWallPostBox`; VK credentials/access tokens must not be exported to the Telegram Mini App or backend.
