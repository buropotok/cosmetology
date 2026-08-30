# Publication history and draft lifecycle

## Status

Architecture decision for the Cosmo Sofa Mini App.

## Core decision

Do not treat the server-side saved editor state as a disposable `draft` table that is periodically cleaned up.

The same entity should become the durable **publication history**. A record starts as the user's current draft and is retained after publication as a historical post record. For now, **do not implement automatic deletion of old drafts/posts**.

This gives us seamless editor recovery and publication history from the same source of truth without throwing useful data away.

## Lifecycle

A new post record is created with status:

- `New` — the current editable post. It may contain text, uploaded images, selected platform/UI state and partial publication results.
- `Published` — the post has been successfully published to both required destinations: Telegram and VK.

Publishing to only one platform must **not** clear the current post and must **not** mark it `Published`.

Telegram and VK publication results must be tracked independently. The record becomes `Published` only after both required publication results are successful.

After a record becomes `Published`, creating/starting the next post creates a new `New` record. The previous record remains in the database as publication history.

At this stage there is no cleanup workflow and no background deletion of old records or their media.

## Persistent editor state

The active `New` record is the server-side source of truth for restoring the Mini App after it is closed or reopened.

Persist enough state to reconstruct the last user-visible editor state, including at minimum:

- post text/content;
- uploaded image references (R2 keys/IDs), not browser-local `File` objects;
- image order;
- currently selected/active image in the carousel;
- currently selected publication platform/tab where useful for seamless resume;
- Telegram publication state;
- VK publication state;
- timestamps needed for history and ordering.

Images selected by the user therefore need to become server-side assets if they are expected to survive a full Mini App close/reopen cycle.

On Mini App startup, after authentication and onboarding checks, load the latest active `New` record and restore its editor state. If there is no active `New` record, initialize a new one when the user starts composing.

## Onboarding startup guard

Opening the Mini App must first check the real backend connection/onboarding state. The editor is shown only when all required onboarding steps are complete.

If onboarding is incomplete, open the **first incomplete step in the defined onboarding order**, rather than the editor. The intended order is:

1. Personal managed Telegram bot.
2. Telegram publication group.
3. Personal-bot preview/private-chat setup.
4. VK publication group.

Example: if the personal bot exists but the Telegram group is not connected, open Telegram-group onboarding. If all Telegram requirements are complete but the VK group is missing, open VK-group onboarding.

The same prerequisite guard applies when the user presses Preview or Publish. Publication buttons should not be disabled merely because onboarding is incomplete. Instead, refresh the backend state and route the user to the first missing prerequisite for that action.

## Onboarding refresh behavior

Do not rely on stale client-side onboarding state. Refresh connection state from the backend whenever an onboarding screen is opened or resumed after an external Telegram/VK step. This should allow a user who has just created/started a bot or connected a destination to continue without manually reloading the Mini App.

## Personal managed bot UX

The personal managed bot is the destination for Telegram post previews.

When the personal bot is opened for the first time, its welcome flow should explain that previews will appear there and ask the user to start the bot. After the user starts it, the bot should tell the user to return to Cosmo Sofa and provide an inline button that opens the Mini App.

After a preview is sent to the personal bot, provide two inline actions with the preview:

- `Опубликовать в группе` — publish that preview/post to the configured Telegram publication group.
- `Редактировать` — return to the Cosmo Sofa Mini App and restore the same active `New` post.

## History implications

Because draft records are retained, the data model can later power the History UI directly. A historical record can expose content, images, creation/publication timestamps and per-platform publication results/statuses.

The current architectural direction is therefore:

`editable New post -> per-platform publication state -> Published historical post`

rather than:

`temporary draft -> delete draft -> separate history record`.

This decision intentionally postpones retention/cleanup policy. If storage cleanup is needed later, it should be designed as a separate retention concern and must not be inserted into the synchronous compose/publish critical path.