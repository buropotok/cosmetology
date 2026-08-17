import {ChatGPTAdapter} from './chatgpt-adapter';
import {hasFiveChoices, parseResponse} from './response-parser';
import {choicePrompt, presets, renderPreset, rewrites} from '../presets/presets';
import {
  buildAlternativeIllustrationPrompt,
  buildAlternativeInfographicPrompt,
  buildIllustrationPrompt,
  buildInfographicPrompt
} from '../presets/image-prompts';
import type {PublisherDraft, PublisherImage} from '../publisher/draft';
import {extractTitle} from '../publisher/draft';
import {PublishWorkflow} from './publish-workflow';

const adapter = new ChatGPTAdapter();
const workflow = new PublishWorkflow();

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

function imageFilename(text: string, url: string) {
  const slug = extractTitle(text).toLocaleLowerCase('ru-RU').replace(/[^a-zа-яё0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 48) || 'post';
  const now = new Date();
  const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
  const extension = url.match(/\.(png|jpe?g|webp)(?:[?#]|$)/i)?.[1].replace('jpeg', 'jpg') ?? 'png';
  return `cosmetology-${slug}-${stamp}.${extension}`;
}

function sendDraft(draft: PublisherDraft) {
  chrome.runtime.sendMessage({type: 'OPEN_PUBLISHER', draft});
  workflow.opened();
}

function showPhotoChoice(message: HTMLElement, text: string) {
  workflow.start(message, text);
  const choice = document.createElement('div');
  choice.dataset.socialPublisher = 'photo-choice';
  choice.className = 'sp-controls sp-workflow';
  const question = document.createElement('span');
  question.className = 'sp-question';
  question.textContent = 'Для этого поста нужно фото?';
  choice.append(question);
  choice.append(button('Фото без текста', () => {
    if (!workflow.waitForImage('illustration', adapter.findMessages().length)) return;
    choice.remove();
    void adapter.insert(buildIllustrationPrompt(), true);
  }));
  choice.append(button('Фото с инфографикой и текстом', () => {
    if (!workflow.waitForImage('infographic', adapter.findMessages().length)) return;
    choice.remove();
    void adapter.insert(buildInfographicPrompt(), true);
  }));
  choice.append(button('Фото не нужно', () => {
    const draft = workflow.textOnlyDraft();
    if (draft) sendDraft(draft);
  }));
  message.append(choice);
}

function renderImageCandidate(message: HTMLElement, image: PublisherImage, ready = true) {
  document.querySelectorAll('[data-social-publisher="image-candidate"]').forEach(element => element.remove());
  message.querySelector('[data-social-publisher="controls"]')?.remove();
  const controls = document.createElement('div');
  controls.dataset.socialPublisher = 'image-candidate';
  controls.className = 'sp-controls sp-workflow';
  const use = button(ready ? 'Использовать' : 'Подготовка изображения…', () => {
    const draft = workflow.selectedImageDraft();
    if (draft) sendDraft(draft);
  });
  use.disabled = !ready;
  controls.append(use);
  controls.append(button('Другое', () => {
    if (workflow.state.kind !== 'image_candidate') return;
    const prompt = workflow.state.mode === 'illustration' ? buildAlternativeIllustrationPrompt() : buildAlternativeInfographicPrompt();
    if (!workflow.waitForImage(workflow.state.mode, adapter.findMessages().length)) return;
    void adapter.insert(prompt, true);
  }));
  message.append(controls);
}

function detectImageCandidate(messages: HTMLElement[]) {
  if (workflow.state.kind !== 'waiting_for_image') return;
  for (let index = workflow.state.messageBoundary; index < messages.length; index++) {
    const message = messages[index];
    const found = adapter.getBestImage(message);
    if (!found) continue;
    const image: PublisherImage = {...found, filename: imageFilename(workflow.state.originalText, found.url)};
    if (workflow.setCandidate(message, image)) {
      const needsResolution = image.url.startsWith('blob:');
      renderImageCandidate(message, image, !needsResolution);
      if (needsResolution) {
        void adapter.resolveImageForDownload(found).then(resolved => {
          const resolvedImage = {...image, url: resolved.url};
          if (workflow.updateCandidate(message, resolvedImage)) renderImageCandidate(message, resolvedImage);
        }).catch(error => console.warn('[Cosmetology] Failed to prepare selected image', error));
      }
    }
    return;
  }
}

export async function installToolbar() {
  if (document.querySelector('[data-social-publisher="toolbar"]')) return;
  const bar = document.createElement('div');
  bar.dataset.socialPublisher = 'toolbar';
  bar.className = 'sp-toolbar';
  const {workerBaseUrl = '', toolbarPosition} = await chrome.storage.local.get(['workerBaseUrl', 'toolbarPosition']);
  presets.forEach(preset => bar.append(button(`${preset.icon} ${preset.title}`, () => adapter.insert(renderPreset(preset, workerBaseUrl)))));
  const handle = document.createElement('span');
  handle.className = 'sp-drag-handle';
  handle.textContent = '⋮⋮';
  handle.title = 'Переместить панель';
  handle.setAttribute('aria-label', 'Переместить панель');
  bar.prepend(handle);
  if (toolbarPosition && typeof toolbarPosition.x === 'number' && typeof toolbarPosition.y === 'number') {
    bar.style.left = `${Math.max(0, Math.min(toolbarPosition.x, window.innerWidth - 40))}px`;
    bar.style.top = `${Math.max(0, Math.min(toolbarPosition.y, window.innerHeight - 40))}px`;
    bar.style.bottom = 'auto';
  }
  handle.addEventListener('pointerdown', event => {
    event.preventDefault();
    handle.setPointerCapture(event.pointerId);
    const rect = bar.getBoundingClientRect();
    const offsetX = event.clientX - rect.left;
    const offsetY = event.clientY - rect.top;
    let position = {x: rect.left, y: rect.top};
    const move = (moveEvent: PointerEvent) => {
      const x = Math.max(0, Math.min(moveEvent.clientX - offsetX, window.innerWidth - bar.offsetWidth));
      const y = Math.max(0, Math.min(moveEvent.clientY - offsetY, window.innerHeight - bar.offsetHeight));
      position = {x, y};
      bar.style.left = `${x}px`;
      bar.style.top = `${y}px`;
      bar.style.bottom = 'auto';
    };
    const end = () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', end);
      handle.removeEventListener('pointercancel', end);
      void chrome.storage.local.set({toolbarPosition: position});
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
  });
  document.body.append(bar);
}

export function decorate() {
  const messages = adapter.findMessages();
  detectImageCandidate(messages);
  for (const message of messages) {
    try {
      if (workflow.state.kind === 'image_candidate' && workflow.state.message === message) {
        if (!message.querySelector('[data-social-publisher="image-candidate"]')) renderImageCandidate(message, workflow.state.image);
        continue;
      }
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
      controls.append(button('Опубликовать', () => showPhotoChoice(message, text)));
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
