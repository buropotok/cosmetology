import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('./telegram-quote-preview.css', import.meta.url), 'utf8');
const bootstrap = readFileSync(new URL('./bootstrap.js', import.meta.url), 'utf8');

test('loads Telegram quote styling at bootstrap', () => {
  assert.match(bootstrap, /telegram-quote-preview\.css/);
  assert.match(bootstrap, /data-cosmo-telegram-quotes/);
});

test('styles both AI preview and Tiptap quotes as light Telegram-like cards', () => {
  assert.match(css, /\.publish-ai-wizard__response-body blockquote/);
  assert.match(css, /\.composer-tiptap-editor \.tiptap blockquote/);
  assert.match(css, /border-radius:10px!important/);
  assert.match(css, /background:rgba\(36,129,204,\.07\)!important/);
  assert.match(css, /color:#111!important/);
  assert.match(css, /width:4px!important/);
  assert.doesNotMatch(css, /--tg-theme-bg-color/);
});
