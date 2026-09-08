# Draft runtime lifecycle

## Status

Architecture decision for the Cosmo Sofa Mini App draft runtime, Home UX, session restoration, and navigation semantics.

This document complements `publication-history-and-drafts.md`, which describes persistence/history semantics on the backend.

## Core model

The server-side draft is a **recovery snapshot of the working session**. It is not the live source of truth while the Mini App remains open.

The client session contains the current working state of all relevant features, including AI, Publisher/Composer, and Before/After. Those feature states remain authoritative during the active Mini App session and are persisted to the server by the draft/autosave subsystem.

The central rule is:

> Draft restores a working session, not a navigation route.

A stored `screen` value may remain as metadata or for compatibility while the implementation is migrated, but it must not decide which feature the user is forced into after Continue.

## Home startup

Home is part of the critical application shell and must not wait for full draft materialization.

On Mini App startup:

- render Home as soon as its true shell prerequisites are ready;
- show `Новый пост` immediately;
- show `Продолжить с черновика` when lightweight startup data says that a recoverable draft exists;
- do **not** download the full draft payload or its media merely to render Home;
- do **not** show the old blocking draft-loading modal during normal startup.

The lightweight draft-existence signal should come from already-required startup data where practical. Do not add a heavy feature-runtime dependency to bootstrap solely to discover the draft.

If no recoverable draft is known to exist, Continue is hidden.

## Continue semantics

### First Continue after a fresh application start

When no live client session has yet been restored, pressing Continue performs the expensive recovery operation:

```text
Home
  -> Continue
  -> "Восстанавливаем сессию…"
  -> full draft load, including required media
  -> restore AI + Publisher/Composer + Before/After working buffers
  -> New Post menu
```

The recovery UI belongs to this explicit Continue operation. It must not be a generic global reaction to any draft request.

After successful restoration, navigation always opens the standard New Post menu with the three feature choices. The user chooses where to continue.

Do not automatically jump to AI, Publisher, or Before/After based on `draft.screen`.

### Continue while a live session exists

Returning to Home does not destroy the current client session. Therefore, when a live session already exists:

```text
Home -> Continue -> New Post menu
```

This transition is immediate. It performs no draft reload and shows no recovery spinner/modal.

The server draft remains the recovery copy for a future interrupted/restarted application, not a cache that must be re-read every time Home is visited.

## New Post semantics

`Новый пост` and `Продолжить с черновика` enter the **same New Post workspace**. The difference is only how the session buffer is prepared.

```text
New Post  -> empty/reset session    -> New Post menu
Continue  -> restored/live session -> New Post menu
```

Starting New Post must:

1. invalidate any pending session restore;
2. abort its active network operation where possible;
3. clear/reset the live client session;
4. clear/replace the recoverable server draft according to persistence semantics;
5. open the same New Post menu used by Continue.

New Post must not wait for an older restore to finish.

## Active session and autosave

Once a session exists in the frontend, feature-owned state is live state:

- AI owns its current generation/work state;
- Publisher/Composer owns post content and completed media attached to the post;
- Before/After owns its current unfinished editing state;
- the draft subsystem persists recovery snapshots of those states;
- navigation owns only logical screen/location state.

Returning to Home is navigation only. It must not trigger a full draft refresh and must not replace live state with a server snapshot that may lag behind the current session.

If the Mini App is closed or interrupted, the next Continue can reconstruct the session from the latest persisted server draft.

## Restore cancellation and stale completion

Session restoration is asynchronous and must be safe if its lifecycle is invalidated.

Cancellation requires both:

- physical cancellation with `AbortController` where supported; and
- logical invalidation with a monotonically changing generation/token or equivalent operation identity.

`AbortController` is an optimization, not the correctness guarantee. A request may already have reached the server, media decoding may already be in progress, or WebView cancellation may behave differently across platforms.

After every meaningful asynchronous stage that can lead to state mutation, verify that the restore operation is still current before applying its result.

Required invariant:

> After New Post or another lifecycle transition invalidates a restore, no completion from that restore may mutate the new client session, draft state, Home state, or navigation state.

This includes an old draft response arriving late, a delayed request returning `null` after a clear, media finishing after navigation, and out-of-order restore attempts.

## Navigation is a logical state machine

Navigation must be defined by logical product states, not by physical DOM containers, iframes, or whichever element happened to be visible previously.

The current New Post workflow has these logical states:

```text
HOME
  |
  +-- New Post -------------------+
  |                               |
  +-- Continue -- restore/live ---+
                                  v
                           NEW_POST_MENU
                                  |
                    +-------------+-------------+
                    |             |             |
                    v             v             v
                   AI          PUBLISH    BEFORE_AFTER
                    |             |             |
                   Back          Back          Back
                    +-------------+-------------+
                                  v
                           NEW_POST_MENU
                                  |
                                 Back
                                  v
                                 HOME
```

`NEW_POST_MENU`, `AI`, `PUBLISH`, and `BEFORE_AFTER` are distinct navigation states even if some of them currently reuse the same Composer DOM or if Before/After is physically rendered in an iframe.

### Authoritative Back transitions

The required transitions are:

| Current logical state | Back destination |
| --- | --- |
| `BEFORE_AFTER` | `NEW_POST_MENU` |
| `AI` | `NEW_POST_MENU` |
| `PUBLISH` | `NEW_POST_MENU` |
| `NEW_POST_MENU` | `HOME` |
| `HOME` | platform/application-shell behavior |

Telegram BackButton, in-app Back controls, and feature-specific controls must all resolve through the same authoritative navigation semantics rather than independently manipulating visibility.

The way a session was created does not alter this chain. A restored session and a new empty session use the same navigation graph.

## Contextual tools and future navigation

The navigation model must support features being entered from more than one parent context without rewriting draft logic.

Before/After is conceptually an **image-editing tool**, not inherently a top-level post type. It is currently reachable from the New Post menu, but it may also be exposed from Publisher next to actions such as `Создать фото` so that a post can contain multiple completed Before/After collages.

A future Publisher flow can therefore be:

```text
PUBLISH
   |
   +-- Create photo
   |
   +-- Before/After
          |
          v
   BEFORE_AFTER_EDITOR
       |          |
      Back       Done
       |          |
       v          v
    PUBLISH   rendered image
                  |
                  v
          Publisher.images[]
```

This requires **contextual return navigation**. Before/After must not hard-code `Back -> Composer` or `Back -> New Post menu`. Its return destination is the navigation context from which the tool was opened.

For example:

```text
NEW_POST_MENU -> BEFORE_AFTER -> Back -> NEW_POST_MENU
PUBLISH       -> BEFORE_AFTER -> Back -> PUBLISH
```

This is still one navigation system: the router/state machine records the legitimate parent context for the tool invocation rather than letting the feature invent its own back stack.

## Before/After ownership and completed results

Before/After owns only its current editable work. The draft should persist the latest unfinished Before/After state so that an interrupted session can recover that work.

When the user finishes a collage (`Готово` or equivalent):

1. Before/After renders/produces the completed image result;
2. the result is transferred through an explicit data contract to Publisher;
3. Publisher becomes the owner of that completed image as part of the post;
4. the draft/autosave mechanism persists the updated Publisher state;
5. Before/After remains available to start/edit another image according to its own lifecycle.

Therefore multiple completed collages do not require the draft to maintain an archive of multiple Before/After editor states. They are ordinary completed Publisher media items. The draft needs to preserve the current unfinished Before/After work plus Publisher's already accepted results.

Conceptually:

```text
Before/After working state -- Done --> rendered image --> Publisher media
         |
         +-- recovery snapshot preserves unfinished work
```

This preserves ownership boundaries and makes it possible to add, move, or reuse image-editing tools without changing recovery semantics.

## Separation of responsibilities

The architecture must keep four concerns separate:

### Session

The aggregate live working context composed of feature-owned states. It survives navigation to Home while the Mini App remains alive.

### Draft

The persisted recovery representation of the session. It can reconstruct the session after interruption but does not choose the route.

### Navigation

The authoritative logical state machine. It decides screen transitions and Back destinations without scraping feature DOM or depending on iframe/container structure.

### Feature result transfer

A feature such as Before/After produces structured output through an explicit contract. Once accepted, the receiving owner (Publisher in this case) owns the completed result.

The central product invariant is:

> Session stores the work, Draft recovers the session, Navigation moves the user, and completed tool results move to their owning feature through explicit data contracts.

## Implementation constraints for the refactor

The upcoming refactor must preserve these constraints:

- Home startup is not blocked by full draft loading;
- full recovery starts only when Continue actually needs to restore a missing live session;
- recovery restores the complete available session, not only the previously active screen;
- successful recovery opens `NEW_POST_MENU`, never auto-routes by `draft.screen`;
- Continue from Home is immediate while a live session exists;
- returning to Home does not refresh/reload the draft;
- New Post and Continue use the same workspace/navigation entry point after preparing different session contents;
- New Post invalidates any pending restore and cannot be overwritten by late completion;
- correctness does not depend only on `AbortController`;
- AI, Publish, and Before/After all return Back to `NEW_POST_MENU` when entered from that menu;
- `NEW_POST_MENU` returns Back to Home;
- Before/After can later be invoked from Publisher with `Back -> PUBLISH` without changing draft semantics;
- completed Before/After images become Publisher-owned media;
- unfinished Before/After editing state remains recoverable in the draft;
- navigation behavior is independent of iframe/DOM implementation details;
- iOS/WKWebView and Android WebView behavior are both considered.

## Required tests

At minimum, the refactor should cover:

1. startup renders Home without a full draft fetch;
2. startup with a known draft shows Continue without materializing the full draft;
3. first Continue with no live session performs one full restore and shows `Восстанавливаем сессию…`;
4. successful restore populates AI, Publisher/Composer, and Before/After state and opens `NEW_POST_MENU` regardless of stored `draft.screen`;
5. restore failure remains local to Continue and does not corrupt Home;
6. returning from a feature to Home preserves the live session;
7. Continue from Home with a live session opens `NEW_POST_MENU` immediately without a draft fetch;
8. New Post creates/resets an empty session and opens the same `NEW_POST_MENU`;
9. New Post during restore invalidates and aborts that restore;
10. a stale draft response or media completion after New Post is ignored;
11. `AI -> Back -> NEW_POST_MENU -> Back -> HOME`;
12. `PUBLISH -> Back -> NEW_POST_MENU -> Back -> HOME`;
13. `BEFORE_AFTER -> Back -> NEW_POST_MENU -> Back -> HOME` when BA was opened from the menu;
14. restored sessions use the same Back chains as newly created sessions;
15. repeated `Home -> Continue -> NEW_POST_MENU` is immediate while the live session exists;
16. contextual invocation `PUBLISH -> BEFORE_AFTER -> Back -> PUBLISH`;
17. completing Before/After transfers the rendered image to Publisher without making navigation depend on BA internals;
18. multiple completed Before/After collages can coexist as Publisher media while the draft contains only the current unfinished BA editing state;
19. navigation away/unmount during restore cannot apply stale completion to a new lifecycle.

Tests should validate observable behavior, ownership, and the logical navigation contract rather than accidental import order, private DOM structure, or iframe implementation details.
