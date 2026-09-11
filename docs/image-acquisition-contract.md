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
- `true` -> internet-search endpoint `/api/miniapp/ai/image/search`.

`searchProfile` selects a server-side prompt profile. Prompt text is never sent by the browser as configuration.

`sourcePolicy` restricts which source classes are acceptable. For `official`, only a manufacturer, brand, or explicitly official distributor is acceptable.

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

`ComposerState` is the canonical owner of `imageOptions` after handoff. `DraftStore` persists the value in `miniapp_drafts.image_options` and restores it with the Composer snapshot. This prevents a resumed product-review draft from silently reverting to generative image creation.

## Internet image search

The server does not ask an image-generation model to recreate a found image.

For `internetSearch: true` it:

1. selects the prompt from the server-side `searchProfile` registry;
2. uses grounded Google Search to locate an official page for the exact subject;
3. requires the grounded answer to name the hostname of the official source it selected;
4. follows only grounded URL sources whose final hostname matches that selected official hostname;
5. validates redirects before following them and rejects obvious non-official hosts for `sourcePolicy: official`;
6. extracts real page image metadata (`og:image`, `twitter:image`, `image_src`);
7. downloads and validates the actual image bytes;
8. returns those bytes to Composer with the official page URL in `X-Cosmo-Image-Source`.

If no valid official image is found, the endpoint returns `AI_IMAGE_SEARCH_NOT_FOUND`. Composer then asks the user whether to fall back to the existing generative image flow. It never falls back silently.
