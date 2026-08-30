# Main screen mockup integration

Visual source: `cosmo_sofa_main_screen_iphone_v13.html` supplied by the product owner.

- `composer-mockup.css` scopes all visual overrides under `#composer-screen` so Settings/Onboarding remain unchanged.
- `composer-mockup.js` injects only visual assistant controls and a visual-only formatting toolbar.
- Toolbar controls deliberately have no formatting behavior; a dedicated editor library will replace them later.
- Existing `#image`, `#text`, `#publish`, `#publish-vk`, settings button and existing app.js handlers remain in place.
- This branch is intentionally isolated from `main` until visual QA.
