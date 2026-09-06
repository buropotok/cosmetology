# AI post generation UX flow

This document defines the intended UX and state contract for the AI-assisted publication flow in the Mini App.

## Goal

After Discovery, the user must be able to move from a selected idea to a ready publication without losing progress if generation fails, and without being left wondering how to edit the generated result.

The generated PostDocument is the canonical publication payload. The AI response area renders that PostDocument for review. The rendered HTML is presentation only and must not be parsed back into application state.

## Main flow

```text
Discovery
  -> user selects an idea
  -> idea_selected
  -> generating
  -> ready_post
  -> Edit and publish
  -> Composer receives the original PostDocument
  -> user edits / adds media / selects platforms
  -> preview / publish
```

In `ready_post`, the rendered publication is already a valid publication preview. The user may optionally ask AI to rewrite it before moving to Composer.

## Ready-post actions

The ready-post state exposes three actions:

- `Короче` — generate a shorter variant of the current publication while preserving the core facts and meaning.
- `Другое` — generate a different full variant with a different presentation while preserving factual accuracy.
- a visually dominant primary CTA: `Редактировать и опубликовать`.

`Редактировать и опубликовать` is the explicit transition from AI review to Composer. It must be visually stronger than `Короче` and `Другое` so the user immediately understands that the generated text is editable and that editing is the normal next step before publication.

When the CTA is pressed, the app must pass the stored canonical PostDocument directly to Composer. It must not reconstruct the document from the rendered response DOM.

The expected data path is:

```text
Gemini PostDocument
  -> AI preview renderer
  -> stored PostDocument
  -> Composer PostDocument
  -> platform serializer
  -> publish
```

`Ручное создание публикации` belongs to the initial AI state. After a ready post exists, the primary next action is `Редактировать и опубликовать`; the manual-create action should not compete with it as an equivalent next step.

## Selected idea must survive generation errors

Selecting a Discovery item is a state transition, not a transient click handler detail.

Before the post-generation request starts, persist the selected idea as `selectedIdea`:

```ts
selectedIdea = {
  id,
  title,
  text,
  date?,
  source?
}
```

`selectedIdea` must remain available until the user explicitly chooses another idea, starts a new post, or otherwise resets the AI flow.

It must also be included in the existing Draft snapshot so a Mini App reload does not force the user to repeat Discovery after an interrupted or failed generation.

## Generation error and retry

A post-generation failure must not reset Discovery, erase `selectedIdea`, or replace the selected thesis with a dead-end error state.

State transition:

```text
generating
  -> generation_error
  -> retry
  -> generating
```

The retry uses the already persisted `selectedIdea` and repeats only the post-generation request. Discovery is not repeated.

On failure, show an explicit modal:

**Не удалось подготовить публикацию**

`Выбранная тема сохранена. Попробовать создать публикацию ещё раз?`

Actions:

- primary: `Попробовать ещё раз`
- secondary: `Отмена`

`Попробовать ещё раз` reruns generation from the saved `selectedIdea` without asking the user to choose the idea again.

`Отмена` closes the modal and leaves the selected idea and recoverable AI state intact.

The retry modal is intentionally explicit. A transient inline error in the response area is insufficient because it can make the user believe the selected Discovery result has been lost.

## State model

The AI publication flow should be treated as an explicit state machine:

```text
discovery
  -> idea_selected
  -> generating
       -> generation_error
            -> generating        (retry)
       -> ready_post
            -> generating        (shorter / another)
            -> edit_and_publish  (open Composer)
```

Minimum state needed for this flow:

```ts
{
  phase: 'discovery' | 'idea_selected' | 'generating' | 'generation_error' | 'ready_post',
  selectedIdea: DiscoveryIdea | null,
  postDocument: PostDocument | null,
  response: string,
  discovery: DiscoveryResult | null
}
```

The exact storage shape may follow the existing Draft implementation, but these semantic values must not be inferred indirectly from DOM state.

## Invariants

1. Discovery is not rerun merely because post generation failed.
2. `selectedIdea` is stored before generation starts.
3. `selectedIdea` survives a generation error and Draft restore.
4. Retry reuses the same thesis unless the user explicitly chooses another one.
5. A successful generation stores the canonical PostDocument separately from its rendered preview.
6. `Короче` and `Другое` operate on the current generated publication and remain optional rewrite actions.
7. `Редактировать и опубликовать` is the primary ready-post CTA.
8. Composer receives the canonical PostDocument directly; rendered HTML is never the source of truth.
9. A generation error is presented with an explicit retry modal rather than forcing the user back through Discovery.
