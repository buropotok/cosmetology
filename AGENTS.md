# AGENTS.md — Engineering and Architecture Rules

This file defines mandatory engineering rules for all changes in this repository. It applies to humans and coding agents. The goal is not merely to make a requested feature work; every change must preserve component boundaries, startup reliability, platform compatibility, testability, and the existing architecture.

## 1. Core rule: preserve architecture before adding behavior

A feature is not complete if it works only by creating hidden coupling, global side effects, fragile startup ordering, or dependencies between unrelated components.

Before changing code:

1. Identify the component that owns the requested behavior.
2. Identify the component's public inputs and outputs.
3. Identify whether the behavior belongs to that component's lifecycle.
4. Inspect existing implementation and integration points before creating a new module.
5. Prefer extending the owning component over adding a cross-cutting patch module.
6. Do not make unrelated components prerequisites for each other.
7. If the requested implementation conflicts with the current architecture, fix or extend the architecture explicitly instead of bypassing it.

A small UX request does not justify a global workaround.

## 2. Single responsibility and component ownership

Every module must have one coherent responsibility.

A module may contain several functions only when those functions participate in the same component or lifecycle. Do not group unrelated changes merely because they were requested together, implemented together, or are both described as UX improvements.

Examples:

- An editor placeholder belongs to the editor/component that owns the editable state.
- AI generation progress, cancellation, and generation errors belong to the AI generation component that initiates and owns the request.
- Navigation belongs to the router/navigation layer.
- Draft detection and draft-resume UI belong to the draft/home lifecycle, not to an unrelated Composer enhancement module.
- Before/After behavior belongs to the Before/After component and its explicit bridge/contract with Composer.

Do not create generic dumping-ground files such as `enhancements.js`, `fixes.js`, `helpers.js`, or `ux-improvements.js` to host unrelated behavior. A module name should describe a real architectural responsibility.

## 3. Component isolation

Components must remain independently understandable and independently initializable wherever possible.

A component must not reach into another component's private DOM, internal state, request lifecycle, or implementation details unless that dependency is part of an explicit interface.

For this Mini App, the conceptual relationship between AI generation and Composer is one-way at the integration boundary:

```text
AI Widget -> generated PostDocument/data -> Composer
```

The AI Widget owns generation. Composer owns editing. Composer must not need to know how AI generated the data. The AI Widget must not manipulate Composer internals to represent its own pending/error state.

Cross-component communication should use a deliberately defined contract: function/API call, event with documented payload, shared state abstraction with explicit ownership, or a narrow bridge module whose only responsibility is translating between two public interfaces.

A bridge must not absorb either component's internal logic.

## 4. No accidental coupling through the DOM

DOM availability is not an architectural API.

Do not make one component wait for another component by globally observing `document.body`, polling selectors, or repeatedly searching the whole document unless the application architecture explicitly requires dynamic discovery and no owned lifecycle hook exists.

Prefer:

- initialization from the owning component;
- explicit mount/unmount hooks;
- passing element references into a component;
- scoped observation inside the component's own root;
- events emitted at a documented lifecycle transition.

A `MutationObserver` must have a narrow root, a clear lifecycle, and deterministic cleanup. Observing the entire document to discover another component is a strong indication of incorrect ownership.

## 5. No global monkey-patching for local features

Do not replace or monkey-patch global browser APIs such as:

- `window.fetch`;
- `XMLHttpRequest`;
- `history.pushState` / `replaceState`;
- global event methods;
- timers;
- console methods;
- browser/Telegram APIs.

A local UI feature must not infer another component's state by intercepting global infrastructure.

If a component needs request lifecycle information, the component that performs the request must expose that lifecycle directly or use a dedicated transport abstraction.

Global instrumentation is allowed only when it is an intentional infrastructure-level facility, documented as such, scoped carefully, platform-tested, and required by the architecture.

## 6. Startup path must be minimal and failure-isolated

The Home screen and core navigation are critical application shell functionality. Optional feature modules must not block them.

Startup dependencies must be classified:

### Critical shell
Required to establish the Telegram/platform environment, application shell, router/navigation, and initial Home screen.

### Feature runtime
Required only when a user enters a feature such as Composer, AI generation, Before/After, settings, or publishing.

### Optional enhancement
Cosmetic or convenience behavior that can fail without preventing the application from opening.

Never place feature-runtime or optional-enhancement initialization in the critical path merely because it is convenient to import everything sequentially.

A failure in Composer, AI, Before/After, image generation, draft tooling, or another feature must not prevent Home from rendering unless Home genuinely requires that feature to exist.

Prefer lazy initialization when a module is only needed after a user enters a feature.

## 7. Import-time code must be safe

Importing a module should not unexpectedly mutate unrelated global state or assume that unrelated DOM/components already exist.

Avoid substantial work at module evaluation time. Prefer explicit initialization:

```js
export function initFeature(root, dependencies) {
  // owned initialization
}
```

If the repository uses side-effect modules, keep side effects local, deterministic, idempotent, and safe when expected DOM is not mounted.

Import-time code must not:

- patch global APIs for a local feature;
- start broad observers;
- make unrelated network requests;
- manipulate another component's private DOM;
- change navigation state unexpectedly;
- require optional components to exist;
- throw merely because a feature is not mounted yet.

## 8. Explicit dependency direction

Dependencies must follow the architecture, not implementation convenience.

Higher-level orchestration may depend on component interfaces. Components should not depend on higher-level orchestration or on sibling internals.

When A only needs the output of B, A should depend on the output contract, not on B's DOM or lifecycle implementation.

Do not introduce circular behavioral dependencies such as:

```text
AI controls Composer UI
Composer controls AI pending UI
Navigation repairs both
Bootstrap depends on all three
```

Prefer:

```text
Bootstrap -> shell
Navigation -> screen lifecycle
AI Widget -> AI service
Composer -> editor/state
Integration boundary -> passes AI result to Composer
```

## 9. State has one owner

Every meaningful state must have a clear owner.

Examples:

- AI pending/error/cancelled state: AI generation flow.
- Editor empty/content/focus state: editor/Composer.
- Current screen: router/navigation.
- Draft persistence: draft subsystem.
- Before/After editing state: Before/After subsystem.

Do not duplicate the same state in multiple modules and synchronize it through DOM classes, selector inspection, timing assumptions, or mutation observers.

Derived UI should subscribe to or be rendered from the owning state.

## 10. Events are contracts, not escape hatches

Custom events are appropriate for decoupled boundaries, but they must be intentional.

For each cross-component event define:

- producer/owner;
- consumer(s);
- event name;
- payload shape;
- timing/lifecycle semantics;
- whether it can fire more than once;
- cleanup behavior.

Do not create events simply to avoid designing an interface. Do not rely on undocumented event ordering.

## 11. UI behavior belongs where the state exists

Render UI as close as possible to the state that determines it.

If the editor knows whether it is empty, the editor renders its placeholder.
If the AI flow knows whether a request is pending, the AI flow renders its progress/cancel/error UI.
If navigation knows the current screen, navigation controls screen visibility.

Do not create an external observer module to reconstruct state that the owning component already knows.

## 12. Prefer deletion of obsolete architecture over compatibility layers

When a feature moves to the correct owner, remove the obsolete bridge, observer, monkey patch, duplicate handler, CSS, and bootstrap import.

Do not leave the old mechanism active "just in case". Two competing implementations create nondeterminism and platform-specific races.

Before completing a refactor, search for old selectors, globals, events, imports, styles, and tests that represent the previous architecture.

## 13. Do not fix architecture problems with initialization ordering

Reordering imports can expose or hide a bug without solving it.

If component A must load before component B only because B reaches into A's internals, the dependency itself must be examined.

Initialization order is legitimate only when there is a real dependency. Document that dependency in code structure or comments/tests.

Never use startup ordering as a substitute for isolation.

## 14. Progressive startup and graceful degradation

The application shell should become usable as soon as its true prerequisites are ready.

Feature failure should be contained to the feature. A user should receive a local error state rather than a blank application whenever possible.

Do not implement a fallback that merely reveals partially initialized screens while leaving the application in an inconsistent state. Failure isolation must come from dependency boundaries, not from showing UI after bootstrap has already failed.

## 15. iOS/WebKit and Telegram Mini App compatibility

The Mini App must work in both Android Telegram WebView and iOS Telegram/WKWebView. Do not treat success on Android/desktop Chrome as sufficient validation.

When using browser APIs or syntax, consider the actual WebView runtime, not only current desktop browsers.

Pay special attention to:

- AbortController/AbortSignal behavior;
- newer properties such as `AbortSignal.reason`;
- focus and keyboard behavior;
- viewport and safe-area behavior;
- history/navigation semantics;
- media/image decoding;
- asynchronous scheduling APIs;
- DOM lifecycle timing;
- fetch cancellation and network errors;
- WebView caching;
- Telegram WebApp API differences.

Avoid unnecessary reliance on recently introduced APIs when a simple compatible implementation exists. Feature-detect optional APIs when appropriate.

Platform-specific workarounds must be isolated behind a narrow compatibility boundary and documented. Do not spread `isIOS` branches throughout business logic.

## 16. Async code and cancellation

The component that starts an asynchronous operation owns its pending, success, failure, and cancellation lifecycle.

Cancellation must be explicit. Do not create nested AbortControllers unless there is a real ownership boundary requiring signal composition.

If signals must be composed, preserve compatibility and define exactly who is allowed to abort what.

Always handle:

- success;
- expected cancellation;
- network failure;
- non-2xx response;
- stale/out-of-order completion;
- component unmount/navigation during the request.

Do not allow an old asynchronous completion to mutate a newly mounted screen.

## 17. Navigation is infrastructure

Navigation must not depend on feature implementation details.

Navigation decides which screen is active and invokes documented screen lifecycle hooks. It should not repair arbitrary feature DOM or infer feature state by querying internal classes.

Features may request navigation through the router/public navigation API; they should not create competing navigation systems.

Back behavior must have a single authoritative path. Telegram BackButton behavior, in-app back controls, and internal feature back transitions must not independently mutate navigation state without coordination.

## 18. Bootstrap is orchestration, not a feature container

`bootstrap.js` should describe application startup at a high level. It must not become a list of every JavaScript file in the product merely to guarantee execution.

A feature should normally be initialized by its owning screen/component when that feature becomes relevant.

Before adding an import to bootstrap, answer:

1. Is this required to render the initial shell/Home?
2. If it throws, should the entire application really fail to start?
3. Could it initialize when its owning screen mounts instead?
4. Does adding it create a hidden ordering dependency?

If the answers indicate it is a feature, keep it out of the critical shell path.

## 19. Changes must be minimal in scope

Do not opportunistically modify unrelated modules while implementing a feature.

A PR should have one coherent purpose. If implementation reveals a separate architectural problem, either address it as an explicit prerequisite/refactor or create a separate change.

Avoid "while here" edits that enlarge the regression surface.

## 20. Understand before editing

Before writing code, inspect:

- the owning component;
- callers and consumers;
- relevant tests;
- bootstrap/import path;
- globals/events/selectors used as interfaces;
- platform-sensitive APIs;
- recent related changes when diagnosing a regression.

Do not infer architecture from filenames alone. Trace the actual runtime path.

For regressions, compare a known-good commit with the first known-bad state and narrow the change set. Do not immediately redesign unrelated code.

## 21. Debug by isolation, not by stacking patches

When a regression has multiple suspects:

1. Restore a known deterministic baseline.
2. Change one variable at a time.
3. Remove/disable one suspect without changing surrounding ordering or behavior.
4. Reproduce on the affected platform.
5. Narrow to the smallest failing behavior.
6. Fix the owning component.
7. Remove diagnostic code afterward.

Do not add several speculative fixes in one PR. That destroys causal information.

## 22. Never mask exceptions without understanding them

Do not catch broad startup exceptions merely to keep the UI visible unless the error is also correctly isolated and surfaced.

A catch that turns a crash into a partially initialized application can make diagnosis harder and create secondary corruption.

Catch errors at the boundary that can actually recover from them. Log enough context to identify the failing component while avoiding sensitive data.

## 23. Idempotent initialization and cleanup

Any initializer that can run more than once must be idempotent or explicitly reject duplicate initialization.

Listeners, observers, timers, subscriptions, object URLs, pending requests, and Telegram handlers must be cleaned up when their owning component is destroyed or reinitialized.

Do not rely on a full page reload to clean state.

## 24. Avoid ambient globals

Do not introduce new `window.*` APIs unless they are deliberate application-level public interfaces.

Prefer module imports and explicit dependency injection. If a global is required because of the current non-bundled architecture, treat it as a public API:

- give it a stable name;
- document ownership;
- expose the smallest possible surface;
- make initialization deterministic;
- test consumers against the contract.

Do not use globals as shared mutable storage between unrelated components.

## 25. CSS ownership

Component CSS should live with or be clearly owned by the component. Do not inject unrelated CSS from a generic JavaScript enhancement module.

Runtime style injection is acceptable only when there is a specific reason. Prefer static stylesheets/component styles when styling does not genuinely depend on runtime data.

CSS selectors must not become hidden cross-component control channels.

## 26. Data contracts over DOM transfer

When moving information between components, pass structured data rather than scraping rendered DOM.

For AI-to-Composer transfer, prefer a stable PostDocument/data contract. Rendering is a presentation concern and should not be the transport format unless explicitly designed that way.

Validate boundary data where malformed input can destabilize downstream components.

## 27. Tests must protect architecture, not only output

Tests should verify observable behavior and important architectural invariants.

Useful invariants include:

- Home can initialize without optional feature runtimes.
- AI failure does not prevent navigation/Home.
- Composer can initialize independently of AI generation UI.
- AI result transfer uses the documented contract.
- no feature globally replaces `window.fetch` unless explicitly intended;
- back navigation has one deterministic outcome;
- initialization is safe when optional DOM is absent.

Do not write tests that freeze an accidental implementation order unless that order represents a real dependency.

A test that merely asserts "module X imports before module Y" can institutionalize bad architecture.

## 28. Test the failure path

For every meaningful asynchronous or integration feature, test failure as well as success.

At minimum consider:

- API failure;
- timeout/cancellation;
- missing optional DOM/component;
- repeated initialization;
- navigation away during operation;
- malformed response;
- platform-specific unavailable API where relevant.

The expected result should be local degradation, not corruption of unrelated screens.

## 29. Platform validation for Mini App changes

Changes affecting bootstrap, navigation, editor, keyboard/focus, AI requests, images, uploads, Before/After, or Telegram APIs require explicit consideration of both iOS and Android behavior.

Automated Node tests are necessary but not proof of WebView compatibility. Keep browser-facing logic simple enough that platform differences are minimized by design.

When a bug is iOS-only, first look for lifecycle timing, unsupported/new Web APIs, WebKit behavior, global side effects, and race conditions before adding user-agent-specific branches.

## 30. Performance and startup budget

Do not initialize expensive feature code before it is needed.

Startup should avoid:

- broad MutationObservers;
- feature-specific network requests;
- loading large optional modules;
- decoding feature assets;
- constructing hidden feature UI;
- unnecessary sequential imports.

Hidden UI is still initialized UI. `hidden=true` does not make initialization free.

## 31. Security and secrets

Never place platform tokens, bot tokens, Cloudflare secrets, API keys, or privileged credentials in Mini App/browser code.

Client code calls authenticated backend boundaries. Server/Worker code owns secrets and privileged platform operations.

Do not log secrets, authorization headers, sensitive payloads, or unnecessary user data.

## 32. Repository workflow

Do not push feature work directly to `main` unless explicitly instructed for an exceptional operational reason.

Normal flow:

1. create a focused branch;
2. make the smallest coherent change;
3. run/trigger relevant tests;
4. create a PR with an accurate description;
5. inspect the actual diff;
6. do not merge without explicit authorization.

A CI-trigger-only change must be harmless and must match workflow path filters. Do not alter unrelated files merely to trigger CI.

Never claim tests or deployment succeeded without checking their actual status.

## 33. PR review checklist

Before considering a change ready, answer all of the following:

- What component owns this behavior?
- Did the change stay inside that ownership boundary?
- Did it introduce a dependency on a sibling component's internals?
- Did it add a global variable, global listener, global observer, or monkey patch?
- Is any new bootstrap dependency truly required for Home?
- Can the feature fail without breaking the shell?
- Is state owned in exactly one place?
- Are async cancellation and stale completion handled?
- Does navigation remain deterministic?
- Are listeners/observers cleaned up?
- Does it work when optional DOM is absent?
- Is iOS/WKWebView compatibility considered?
- Are tests validating behavior rather than accidental ordering?
- Is obsolete code removed?
- Is the diff limited to the requested architectural responsibility?

If any answer is unclear, the change is not ready.

## 34. Red flags requiring redesign before merge

Stop and reconsider the design when a change requires any of these without a strong architectural justification:

- patching `window.fetch` for UI state;
- observing all of `document.body` to find another component;
- importing a feature before Home merely so its side effects run;
- adding unrelated behavior to an `enhancements` module;
- manipulating another component's private DOM;
- duplicate ownership of the same state;
- fixing a race by adding delays/timeouts;
- fixing dependency problems by repeatedly reordering imports;
- adding broad try/catch to hide startup errors;
- making Android success the only browser validation;
- keeping two implementations active during a migration;
- adding a global API because passing an explicit dependency is inconvenient.

## 35. Preferred decision hierarchy

When several implementations are possible, prefer them in this order:

1. behavior implemented inside the component that owns the state;
2. explicit public component interface;
3. narrow integration/bridge between documented interfaces;
4. scoped event contract;
5. shared infrastructure abstraction when multiple components genuinely require the same infrastructure;
6. global mechanism only when the concern itself is truly global.

Never jump directly to level 6 for convenience.

## 36. Definition of done

A task is done only when:

- requested behavior works;
- component ownership is correct;
- no unnecessary coupling was introduced;
- critical startup remains independent of optional features;
- failure is isolated;
- obsolete implementation is removed;
- relevant tests pass;
- platform implications have been considered;
- the actual PR diff has been reviewed;
- documentation/contracts are updated when architecture changed.

Working code with degraded architecture is not a completed task. Architecture is part of correctness.
