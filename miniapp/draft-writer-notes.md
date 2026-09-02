# Draft writer invariants

The Mini App draft autosave writer is single-flight:

- at most one `POST /api/miniapp/draft` is active at a time;
- every local mutation increments `revision`;
- image mutations also update `imageRevision` and set `imagesDirty`;
- a save snapshots its revision and image revision before sending;
- completion only clears `imagesDirty` when no newer image mutation exists;
- if the local revision advanced while a request was in flight, a follow-up save starts immediately with the latest state;
- restore runs while `restoring=true`, so restore-generated DOM/input events do not create local revisions.

The diagnostics panel logs revision, savedRevision, imageRevision, single-flight state, and follow-up saves so race conditions can be verified from Telegram WebView logs.
