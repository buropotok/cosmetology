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
| Rich content | `CosmoRichEditor` (textarea is compatibility fallback) | `ComposerState.getSnapshot()` delegates to the editor |
| Images | `CosmoComposerImages` (`FileList` remains its compatibility boundary) | `ComposerState.getSnapshot()` delegates to the manager |
| Active photo | `ComposerState` | explicit `setActivePhotoIndex()`; Composer only renders `getSnapshot().activePhotoIndex` |
| Platform | `ComposerState` | explicit `setPlatform()` |
| Revisions | `DraftStore` | one `ComposerState.subscribe()` subscription |

`ComposerState` is a facade, not another content or image store. Restore flows strictly from the server through `DraftStore` and `ComposerState.restore()` to the existing rich editor, image manager, active-photo state, and platform state.

## Rich editor public contract

`CosmoRichEditor` is the canonical runtime boundary for publication text once Tiptap is available. Consumers use its explicit methods instead of reading the compatibility textarea or intercepting network requests:

- `getPlainText()` returns the visible plain-text representation used for empty-state validation, character count, and VK clipboard export.
- `getSubmissionValue()` returns the rich `COSMO_RICH_V1` payload used by Telegram Preview and Publish.
- `setDocument(postDocument)` accepts a structured PostDocument directly from the AI flow.
- `subscribe(listener)` reports editor-owned content changes to `ComposerState`, including button-only changes.
- `draftValue()`, `restoreDraft()`, `restorePlain()`, and `clear()` retain the draft and fallback contracts while the compatibility textarea still exists.

Preview and Publish construct their request payloads explicitly from this API. No editor feature replaces `window.fetch`. The textarea remains only as a temporary fallback/synchronization boundary until the final compatibility-removal stage.

## Autosave and retry policy

Ordinary changes use a trailing 4,000 ms debounce. Preview, Telegram Publish, VK Publish, `visibilitychange` to hidden, and `pagehide` explicitly flush pending work. Image files are included only when the image set changed.

A successful save that became stale while in flight schedules one immediate follow-up. A failed save remains unsaved and does **not** start a microtask retry loop; it is retried only by the next scheduled change or explicit flush.
