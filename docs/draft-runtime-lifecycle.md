# Draft runtime lifecycle

## Status

Architecture decision for the Cosmo Sofa Mini App draft runtime and Home UX.

This document describes the selected client-side lifecycle for loading, consuming, refreshing, saving, and invalidating the active server-side draft. It complements `publication-history-and-drafts.md`, which describes persistence/history semantics on the backend.

## Purpose of the draft

The server-side draft is primarily a recovery mechanism for an interrupted Mini App session. It allows a user who closed or lost the app to reopen it and continue from the last persisted state.

The draft is **not** the live source of truth while the user is actively working inside AI, Composer, Before/After, or another editing feature. After a draft snapshot has been restored into the owning feature states, those feature states become the active working state and continue autosaving changes to the backend.

A downloaded draft snapshot is therefore temporary. Once it has been used to initialize the current working state, it must not be treated as a durable local cache of the server draft. Any user edit can make that downloaded snapshot stale immediately.

## Selected lifecycle

### 1. Cold start

On initial Mini App startup, after the prerequisites required for draft access are available, the client loads the **full active draft**, not only an existence flag.

During this initial load only, show the blocking draft-loading modal (`Запрос ваших черновиков`).

The load must obtain everything required to restore the last user-visible state, including the draft payload and required media. When it completes:

- if a draft exists, restore the relevant working state and mark Continue as available;
- if no draft exists, Home has no Continue action;
- if loading fails, the initial-load UI may offer retry/skip according to the existing UX.

The important UX invariant is:

> After a successful cold-start draft load, pressing Continue must be immediate and must not cause a second server fetch.

Do **not** split cold start into `check draft exists` followed by a second full load after Continue. That would add unnecessary latency to the primary recovery scenario.

### 2. Consuming a loaded snapshot

When the user presses Continue after cold start, navigation uses the already restored draft state to enter the appropriate feature (AI, Composer, Before/After, etc.).

The downloaded draft snapshot has now served its purpose. The application should conceptually treat it as consumed. The active feature state is now authoritative for the current session.

The client must not rely on the original downloaded draft remaining current after this point. A single text edit, image movement, AI-state change, or other persisted edit can make it obsolete.

### 3. Active work and autosave

While the user works, the owning feature states are the live state. The draft subsystem persists those changes to the backend using autosave/flush behavior.

Successful persistence means that a recoverable server draft exists. It does **not** mean that an old downloaded draft snapshot is still valid for future navigation.

The Home UI may retain lightweight knowledge that a draft exists, but it must not treat an old restored payload as a valid cache after active work has changed it.

### 4. Returning to Home during the same session

Returning to Home must **not** block Home behind the global draft-loading modal.

Home appears immediately. `Новый пост` remains active and usable regardless of draft refresh activity.

If the application knows that a recoverable draft exists, the Continue control is shown immediately but is temporarily disabled while the latest draft snapshot is loaded in the background. The loading indication should live inside the Continue control (for example, a small spinner/loading state), not in a global modal.

Conceptually:

```text
Feature -> Back -> Home immediately
                    |
                    +-- New Post: enabled
                    |
                    +-- Continue: visible, disabled, loading
                                      |
                               refresh full draft
                                      |
                               restore snapshot
                                      |
                              Continue: enabled
```

This keeps Home responsive while still preserving the invariant that Continue only opens a fully restored, current snapshot.

### 5. Continue after an in-session return to Home

The background refresh starts when Home is entered, not when Continue is clicked.

Therefore:

- while refresh is pending, Continue is disabled and shows loading;
- after refresh succeeds and a draft exists, Continue becomes enabled;
- pressing enabled Continue is immediate and performs no additional draft fetch;
- if refresh reports that no draft exists, Continue disappears;
- if refresh fails, Continue must not silently open stale state. The UI should expose a local retry/error state without blocking New Post or the rest of Home.

The exact visual treatment of the local error/retry state may be refined during implementation, but it must remain scoped to draft resume rather than becoming a blocking Home modal.

## Loading UI ownership

There are two intentionally different loading contexts.

### Initial application load

- Full draft load.
- Blocking global draft-loading modal is allowed.
- Purpose: establish recoverable initial application state before the first recovery decision.

### In-session Home refresh

- Full draft refresh in the background.
- No global modal.
- Home is immediately usable.
- New Post stays enabled.
- Continue alone reflects pending/error/ready state.

The global draft-loading modal must therefore be owned by the **initial draft-load lifecycle**, not by a generic `loadStatus === loading` condition that can also occur later in the session.

## New Post semantics

Starting a New Post invalidates the current recovery operation and clears/replaces the active draft according to the existing persistence model.

If a Home draft refresh is in progress when the user presses New Post:

1. immediately invalidate the in-flight restore generation;
2. abort the active fetch with `AbortController` where possible;
3. proceed with the New Post clear/reset operation;
4. ignore every completion from the invalidated load, regardless of whether it returns an old draft, `null`, an error, or an abort result.

New Post must not wait for the Home refresh to finish.

## Race-condition invariant

Cancellation requires **both physical cancellation and logical invalidation**.

`AbortController` is an optimization that may stop unnecessary network or decoding work. It is not the correctness guarantee: the request may already have reached the server or the response may already be in flight, and WebView cancellation behavior can vary.

A monotonically changing load/restore generation (or equivalent operation token) is the correctness mechanism. Every asynchronous stage that could mutate state must verify that its operation is still current before applying its result.

Required invariant:

> After New Post/clear invalidates a draft load, no result from that older load may mutate draft state, feature state, Home state, or Continue state.

This covers both important races:

### Old response arrives after New Post

The server may have already returned the previous draft before the clear request. Even if those bytes reach the client later, the old generation is stale and the result is discarded.

### Clear reaches the server before an earlier GET

The clear/delete operation may overtake a delayed draft GET. That GET may then return no draft. Its result is still associated with the invalidated generation and must not overwrite the new lifecycle state.

The application must be correct in either ordering.

## State model

Implementation names may differ, but the draft subsystem must distinguish these concepts rather than infer them from unrelated DOM state:

- whether a recoverable server draft is known to exist (`hasDraft` or equivalent);
- whether the current resume snapshot is loading, ready, consumed/stale, or failed;
- whether the current load operation is still valid (generation/token);
- the current restore target/screen needed for navigation after a successful load.

Do not equate `hasDraft` with `snapshot is currently loaded and safe to resume`.

A useful conceptual state machine is:

```text
no-draft

known-draft / loading
        -> ready
        -> error
        -> no-draft

ready
        -> consumed/stale when work resumes

consumed/stale
        -> loading on next Home entry
```

The exact implementation should remain as small as possible and should not duplicate state already owned by the draft subsystem.

## Navigation contract

Navigation should consume a public draft-resume contract rather than infer draft readiness from feature-private DOM.

Home/navigation needs only enough information to render and route:

- no draft -> hide Continue;
- refresh pending -> show disabled Continue with loading state;
- current snapshot ready -> enable Continue;
- refresh failed -> local retry/error behavior;
- Continue -> route using the restored target state;
- New Post -> invalidate any pending restore before clearing/resetting.

Feature modules remain responsible for their own live editing state after restoration.

## Memory and stale data

Do not intentionally retain a downloaded draft payload merely as a cache after it has initialized the live feature state. It is expected to become stale almost immediately during active work and has no authority after consumption.

Implementation should release references that are no longer required, especially downloaded `File`/Blob objects, when doing so does not conflict with the feature state that legitimately owns those objects after restoration.

This does **not** mean deleting the server-side draft. Server persistence continues normally for recovery. It means avoiding a second, stale client-side draft copy with ambiguous ownership.

## Implementation constraints for the refactor

The upcoming refactor should preserve these constraints:

- cold-start Continue remains immediate after the initial modal completes;
- no extra existence-only request is added before the cold-start full load;
- returning to Home does not show the global draft modal;
- Home/New Post remains usable during an in-session draft refresh;
- Continue cannot open stale state;
- New Post cancels/invalidates an in-flight refresh and cannot be overwritten by its late completion;
- cancellation correctness does not depend only on `AbortController`;
- late/out-of-order completions are tested;
- iOS/WKWebView and Android WebView behavior are both considered;
- draft UI/state ownership remains inside the draft/Home lifecycle rather than leaking into unrelated feature modules.

## Required tests

At minimum, the refactor should cover:

1. cold start with a draft: full load occurs once and Continue uses the restored state without another fetch;
2. cold start without a draft;
3. cold-start load failure/retry/skip behavior;
4. return to Home with a known draft: Home is immediately usable, New Post enabled, Continue disabled/loading until refresh completes;
5. successful Home refresh enables Continue and Continue performs no second fetch;
6. Home refresh returning no draft removes Continue;
7. Home refresh failure does not block Home/New Post and does not allow stale resume;
8. New Post during Home refresh invalidates and aborts that refresh;
9. a stale draft response arriving after New Post is ignored;
10. a delayed GET that reaches the server after clear and returns `null` cannot corrupt the New Post lifecycle;
11. repeated Home entries do not allow older refresh completions to overwrite newer state;
12. navigation away/unmount during a refresh cannot apply stale completion to a new screen lifecycle.

These tests should validate behavior and ownership rather than freezing accidental import order or private DOM structure.
