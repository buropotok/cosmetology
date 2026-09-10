# Composer state ownership

## Before

| Field | Owner(s) | Draft transport |
| --- | --- | --- |
| Rich content | Tiptap and its compatibility textarea | `drafts.js` read either global editor or textarea |
| Images | `CosmoComposerImages`, input `FileList`, and preview state | `drafts.js` read the input and inferred changes |
| Active photo | local Composer variable and active thumbnail class | `drafts.js` inspected `.active` with a `MutationObserver` |
| Platform | active tab class | `drafts.js` inspected the DOM and restored with a synthetic click |
| Revisions | `drafts.js` | `revision`, `savedRevision`, `imageRevision`, and `imagesDirty` mixed with UI listeners |

## After

| Field | Canonical owner | Draft transport |
| --- | --- | --- |
| Rich content | `CosmoRichEditor` | `ComposerState.getSnapshot()` delegates to the editor; a not-yet-mounted draft is held only by `ComposerState` until `cosmo-rich-ready` |
| Images | `CosmoComposerImages` (`FileList` remains its compatibility boundary) | `ComposerState.getSnapshot()` delegates to the manager |
| Active photo | `ComposerState` | explicit `setActivePhotoIndex()`; Composer only renders `getSnapshot().activePhotoIndex` |
| Platform | `ComposerState` | explicit `setPlatform()` |
| Revisions | `DraftStore` | one `ComposerState.subscribe()` subscription |

`ComposerState` is the lifecycle facade, not a second live editor store. While Tiptap is mounted, rich content has exactly one live owner: `CosmoRichEditor`. During Continue/restore before the lazy editor runtime is ready, `ComposerState` temporarily retains the serialized draft and applies it when the editor emits `cosmo-rich-ready`. The editor runtime no longer reaches back into Composer state to pull pending content.

## Rich editor public contract

`CosmoRichEditor` is the canonical runtime boundary for publication text. Consumers use its explicit methods instead of reading or synchronizing a shadow textarea:

- `getPlainText()` returns the visible plain-text representation used for empty-state validation, character count, and VK clipboard export.
- `getSubmissionValue()` returns the rich `COSMO_RICH_V1` payload used by Telegram Preview and Publish.
- `setDocument(postDocument)` accepts a structured PostDocument directly from the AI flow.
- `subscribe(listener)` reports editor-owned content changes to `ComposerState`, including button-only changes.
- `draftValue()` and `restoreDraft()` serialize/restore the current rich draft.
- `restorePlain()` remains only as the migration boundary for previously persisted plain-text drafts; it is not synchronized to a DOM input.
- `clear()` clears editor-owned content and buttons.

The Composer UI provides `#composer-editor-host` as the editor mount. During bootstrap it replaces the old static textarea placeholder before `ComposerState` is initialized; no runtime module reads or writes textarea content. Preview and Publish construct request payloads explicitly from the editor API. No editor feature replaces `window.fetch`.

## Autosave and retry policy

Ordinary changes use a trailing 4,000 ms debounce. Preview, Telegram Publish, VK Publish, `visibilitychange` to hidden, and `pagehide` explicitly flush pending work. Image files are included only when the image set changed.

A successful save that became stale while in flight schedules one immediate follow-up. A failed save remains unsaved and does **not** start a microtask retry loop; it is retried only by the next scheduled change or explicit flush.
