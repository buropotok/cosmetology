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
import {buildImageFilename} from '../publisher/draft';
import {PublishWorkflow} from './publish-workflow';

const adapter = new ChatGPTAdapter();
const workflow = new PublishWorkflow();
const imageInspectionSignatures = new WeakMap<HTMLElement, string>();
let turnScanSignature = '';

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
    const turns = adapter.findConversationTurns();
    const boundaryTurn = turns.at(-1) ?? null;
    if (!workflow.waitForImage('illustration', boundaryTurn)) return;
    console.debug('[Cosmetology][ImageFlow] generation boundary set', {turnCount: turns.length, lastTurnTestId: boundaryTurn?.dataset.testid ?? null});
    console.debug('[Cosmetology][ImageFlow] waiting for generated image');
    choice.remove();
    void adapter.insert(buildIllustrationPrompt(), true);
  }));
  choice.append(button('Фото с инфографикой и текстом', () => {
    const turns = adapter.findConversationTurns();
    const boundaryTurn = turns.at(-1) ?? null;
    if (!workflow.waitForImage('infographic', boundaryTurn)) return;
    console.debug('[Cosmetology][ImageFlow] generation boundary set', {turnCount: turns.length, lastTurnTestId: boundaryTurn?.dataset.testid ?? null});
    console.debug('[Cosmetology][ImageFlow] waiting for generated image');
    choice.remove();
    void adapter.insert(buildInfographicPrompt(), true);
  }));
  choice.append(button('Фото не нужно', () => {
    const draft = workflow.textOnlyDraft();
    if (draft) sendDraft(draft);
  }));
  message.append(choice);
}

function renderImageCandidate(turn: HTMLElement, image: PublisherImage, ready = true) {
  document.querySelectorAll('[data-social-publisher="image-candidate"]').forEach(element => element.remove());
  turn.querySelector('[data-social-publisher="controls"]')?.remove();
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
    const mode = workflow.state.mode;
    const prompt = mode === 'illustration' ? buildAlternativeIllustrationPrompt() : buildAlternativeInfographicPrompt();
    const turns = adapter.findConversationTurns();
    const boundaryTurn = turns.at(-1) ?? null;
    if (!workflow.waitForImage(mode, boundaryTurn)) return;
    console.debug('[Cosmetology][ImageFlow] generation boundary set', {turnCount: turns.length, lastTurnTestId: boundaryTurn?.dataset.testid ?? null});
    void adapter.insert(prompt, true);
  }));
  turn.append(controls);
  console.debug('[Cosmetology][ImageFlow] candidate controls rendered');
}

function detectImageCandidate() {
  if (workflow.state.kind !== 'waiting_for_image') return;
  const turns = adapter.findConversationTurns();
  const newTurns = adapter.findConversationTurnsAfter(workflow.state.boundaryTurn);
  const scanSignature = `${turns.length}:${newTurns.length}:${newTurns.map(turn => turn.dataset.testid ?? '').join('|')}`;
  if (turnScanSignature !== scanSignature) {
    turnScanSignature = scanSignature;
    console.debug('[Cosmetology][ImageFlow] scanning new turns', {totalTurns: turns.length, newTurns: newTurns.length});
  }
  for (const turn of newTurns) {
    const inspection = adapter.inspectTurnImages(turn, decorate);
    const signature = JSON.stringify({imageElements: inspection.imageElements, validImages: inspection.validImages, elements: inspection.elements});
    if (imageInspectionSignatures.get(turn) !== signature) {
      imageInspectionSignatures.set(turn, signature);
      console.debug('[Cosmetology][ImageFlow] turn inspection', {
        testId: inspection.turnTestId,
        images: inspection.imageElements,
        generatedAltImages: inspection.generatedAltImages,
        validImages: inspection.validImages
      });
      inspection.elements.forEach(element => console.debug('[Cosmetology][ImageFlow] image element:', element));
    }
    const found = inspection.images.sort((a, b) => (b.width ?? 0) * (b.height ?? 0) - (a.width ?? 0) * (a.height ?? 0))[0];
    if (!found) continue;
    const image: PublisherImage = {...found, filename: buildImageFilename(workflow.state.originalText, found.url)};
    if (workflow.setCandidate(turn, image)) {
      console.debug('[Cosmetology][ImageFlow] generated image detected');
      console.debug('[Cosmetology][ImageFlow] state: waiting_for_image -> image_candidate');
      const needsResolution = image.url.startsWith('blob:');
      renderImageCandidate(turn, image, !needsResolution);
      if (needsResolution) {
        void adapter.resolveImageForDownload(found).then(resolved => {
          const resolvedImage = {...image, url: resolved.url};
          if (workflow.updateCandidate(turn, resolvedImage)) renderImageCandidate(turn, resolvedImage);
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
  detectImageCandidate();
  for (const message of messages) {
    try {
      if (workflow.state.kind === 'image_candidate' && workflow.state.turn.contains(message)) {
        if (!workflow.state.turn.querySelector('[data-social-publisher="image-candidate"]')) renderImageCandidate(workflow.state.turn, workflow.state.image);
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
