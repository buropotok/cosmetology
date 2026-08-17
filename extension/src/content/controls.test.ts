import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {JSDOM} from 'jsdom';

function useDom(text: string) {
  const dom = new JSDOM(`<main><div data-message-author-role="assistant"><div class="markdown"><p>${text}</p></div></div></main>`, {url: 'https://chatgpt.com/'});
  Object.assign(globalThis, {
    document: dom.window.document,
    Node: dom.window.Node,
    Element: dom.window.Element,
    HTMLElement: dom.window.HTMLElement,
    HTMLTextAreaElement: dom.window.HTMLTextAreaElement,
    Event: dom.window.Event,
    InputEvent: dom.window.InputEvent
  });
  return dom.window.document;
}

beforeEach(() => vi.resetModules());

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('assistant message controls', () => {
  it('rebuilds rewrite controls as numbered choices after streaming completes without duplicates', async () => {
    const document = useDom('Ответ еще загружается');
    vi.stubGlobal('chrome', {runtime: {sendMessage: vi.fn()}});
    const {decorate} = await import('./controls');

    decorate();
    const message = document.querySelector<HTMLElement>('[data-message-author-role="assistant"]')!;
    const firstControls = message.querySelector<HTMLElement>('[data-social-publisher="controls"]')!;
    expect([...firstControls.querySelectorAll('button')].map(button => button.textContent)).not.toContain('1');

    document.querySelector('.markdown')!.innerHTML = '<ol><li>Первый</li><li>Второй</li><li>Третий</li><li>Четвертый</li><li>Пятый</li></ol>';
    decorate();
    decorate();

    const controls = message.querySelectorAll('[data-social-publisher="controls"]');
    expect(controls).toHaveLength(1);
    expect(controls[0]).not.toBe(firstControls);
    expect([...controls[0].querySelectorAll('button')].map(button => button.textContent)).toEqual(['1', '2', '3', '4', '5', 'Опубликовать']);
  });

  it('sends the publisher draft to the background service worker', async () => {
    const document = useDom('Готовый ответ');
    const sendMessage = vi.fn();
    vi.stubGlobal('chrome', {runtime: {sendMessage}});
    const {decorate} = await import('./controls');

    decorate();
    const publish = [...document.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent === 'Опубликовать')!;
    publish.click();

    expect(sendMessage).toHaveBeenCalledWith({type: 'OPEN_PUBLISHER', draft: {text: 'Готовый ответ', images: []}});
  });

  it('restores a draggable preset toolbar position', async () => {
    const document = useDom('Ответ');
    vi.stubGlobal('chrome', {
      storage: {local: {get: vi.fn(async () => ({workerBaseUrl: '', toolbarPosition: {x: 120, y: 80}})), set: vi.fn()}},
      runtime: {sendMessage: vi.fn()}
    });
    const {installToolbar} = await import('./controls');

    await installToolbar();

    const toolbar = document.querySelector<HTMLElement>('[data-social-publisher="toolbar"]')!;
    expect(toolbar.querySelector('.sp-drag-handle')?.getAttribute('aria-label')).toBe('Переместить панель');
    expect(toolbar.style.left).toBe('120px');
    expect(toolbar.style.top).toBe('80px');
  });
});
