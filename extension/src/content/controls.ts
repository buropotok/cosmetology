import {ChatGPTAdapter} from './chatgpt-adapter';
import {hasFiveChoices, parseResponse} from './response-parser';
import {choicePrompt, presets, renderPreset, rewrites} from '../presets/presets';

const adapter = new ChatGPTAdapter();

function button(label: string, fn: () => void) {
  const element = document.createElement('button');
  element.textContent = label;
  element.onclick = event => {
    event.preventDefault();
    event.stopPropagation();
    void Promise.resolve(fn()).catch(console.warn);
  };
  return element;
}

function fingerprint(text: string) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${text.length}:${hash >>> 0}`;
}

export async function installToolbar() {
  if (document.querySelector('[data-social-publisher="toolbar"]')) return;
  const bar = document.createElement('div');
  bar.dataset.socialPublisher = 'toolbar';
  bar.className = 'sp-toolbar';
  const {workerBaseUrl = ''} = await chrome.storage.local.get('workerBaseUrl');
  presets.forEach(preset => bar.append(button(`${preset.icon} ${preset.title}`, () => adapter.insert(renderPreset(preset, workerBaseUrl)))));
  document.body.append(bar);
}

export function decorate() {
  for (const message of adapter.findMessages()) {
    try {
      const text = parseResponse(adapter.contentRoot(message));
      const existing = [...message.querySelectorAll<HTMLElement>('[data-social-publisher="controls"]')];
      if (!text) {
        existing.forEach(controls => controls.remove());
        continue;
      }

      const currentFingerprint = fingerprint(text);
      if (existing[0]?.dataset.textFingerprint === currentFingerprint) {
        existing.slice(1).forEach(controls => controls.remove());
        continue;
      }
      existing.forEach(controls => controls.remove());

      const controls = document.createElement('div');
      controls.dataset.socialPublisher = 'controls';
      controls.dataset.textFingerprint = currentFingerprint;
      controls.className = 'sp-controls';
      if (hasFiveChoices(text)) {
        for (let number = 1; number <= 5; number++) {
          controls.append(button(String(number), () => adapter.insert(choicePrompt(number), true)));
        }
      } else {
        rewrites.forEach(([label, prompt]) => controls.append(button(label, () => adapter.insert(prompt, true))));
      }
      controls.append(button('Опубликовать', () => {
        chrome.runtime.sendMessage({
          type: 'OPEN_PUBLISHER',
          draft: {text, images: adapter.images(message)}
        });
      }));
      message.append(controls);
    } catch (error) {
      console.debug('Social Publisher: message skipped', error);
    }
  }
}

export function observe() {
  adapter.observe(() => {
    decorate();
    void installToolbar();
  });
}
