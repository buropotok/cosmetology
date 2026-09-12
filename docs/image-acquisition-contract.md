# Image acquisition contract

## Ownership

Image acquisition policy crosses the AI -> Composer boundary as structured data. The AI Widget may decide which policy applies to the generated post, but Composer owns that policy after the user transfers the post into the editor.

The image component must not inspect AI preset DOM or infer a rubric from publication text.

## Contract

```js
{
  document: PostDocument,
  imageOptions: {
    internetSearch: true,
    searchProfile: 'cosmetic_product',
    sourcePolicy: 'official'
  }
}
```

`internetSearch` selects the acquisition mode only.

- `false` -> existing generative endpoint `/api/miniapp/ai/image`.
- `true` -> OpenAI image web search endpoint `/api/miniapp/ai/image/search`.

`searchProfile` selects a server-side prompt profile. Prompt text is never sent by the browser as configuration.

`sourcePolicy` restricts which source classes the search prompt requests. For `official`, the search is constrained to manufacturer or brand websites.

Unknown profiles or policies fail explicitly; there is no silent fallback.

## Current preset mapping

`Разбор препарата`:

```js
{
  internetSearch: true,
  searchProfile: 'cosmetic_product',
  sourcePolicy: 'official'
}
```

Other current AI presets use `{ internetSearch: false }`.

## Persistence

`ComposerState` is the canonical owner of `imageOptions` after handoff. `DraftStore` persists the value in `miniapp_drafts.image_options` and restores it with the Composer snapshot.

Search results themselves are not persisted. Once the user selects an image, Composer receives it as a normal `File`; from that point the existing Composer/DraftStore flow owns it and the existing draft save persists it to R2. Search code does not write to R2 or the database.

## Internet image search

For `internetSearch: true` the Worker:

1. builds the server-owned search prompt from `searchProfile` and `sourcePolicy`;
2. calls the OpenAI Responses API with the `web_search` tool, `search_content_types: ['image', 'text']`, `image_settings`, and `include: ['web_search_call.results']`;
3. reads `image_result` entries directly from `web_search_call.results[]`;
4. normalizes and returns up to eight results to Composer as JSON containing the canonical image URL, thumbnail URL, source page URL, caption, and a short-lived import token.

Composer renders these results as a chooser. Nothing is added to the post until the user selects one result.

Because Telegram WebViews cannot reliably fetch arbitrary third-party image bytes because of CORS, selection posts the chosen `imageUrl + importToken` back to `/api/miniapp/ai/image/search`. The same image-search component accepts only a URL carrying the short-lived token created by its search response, downloads and validates that selected image, and streams the bytes back to Composer. It does not persist the image.

Composer converts the returned blob to the same `File` contract used for manually selected/generated images and passes it to `CosmoComposerImages`. Draft persistence and publishing remain unchanged.

There is no automatic fallback from internet search to image generation. A failed or empty search is surfaced locally and the user may retry.
