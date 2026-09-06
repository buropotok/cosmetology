import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const css = await readFile(new URL('./styles.css', import.meta.url), 'utf8');

test('defines one global top spacer and applies it at the Mini App root', () => {
  assert.match(css, /:root\{[^}]*--cosmo-app-top-spacer:32px;/);
  assert.match(css, /main\{[^}]*padding:calc\(22px \+ env\(safe-area-inset-top\) \+ var\(--cosmo-app-top-spacer\)\)/);
});

test('does not duplicate the global spacer inside nested Settings or Onboarding layouts', () => {
  const occurrences = css.match(/var\(--cosmo-app-top-spacer\)/g) ?? [];
  assert.equal(occurrences.length, 1);
  assert.match(css, /\.settings-screen\{margin:-22px -18px -24px;padding:calc\(16px \+ env\(safe-area-inset-top\)\)/);
  assert.match(css, /\.onboarding-step-screen\{padding-left:20px;padding-right:20px\}/);
});
