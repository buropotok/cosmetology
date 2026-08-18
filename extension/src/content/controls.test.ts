import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {JSDOM} from 'jsdom';

function useDom(text: string) {
  const dom = new JSDOM(`<main><article data-testid="conversation-turn-1"><div data-message-author-role="assistant"><div class="markdown"><p>${text}</p></div></div></article></main>`, {url: 'https://chatgpt.com/'});
  Object.assign(globalThis, {
    document: dom.window.document,
    window: dom.window,
    Node: dom.window.Node,
    Element: dom.window.Element,
    HTMLElement: dom.window.HTMLElement,
    HTMLTextAreaElement: dom.window.HTMLTextAreaElement,
    MutationObserver: dom.window.MutationObserver,
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
    const {ChatGPTAdapter} = await import('./chatgpt-adapter');
    const insert = vi.spyOn(ChatGPTAdapter.prototype, 'insert').mockResolvedValue();
    const {decorate} = await import('./controls');

    decorate();
    const message = document.querySelector<HTMLElement>('[data-message-author-role="assistant"]')!;
    const firstControls = message.querySelector<HTMLElement>('[data-social-publisher="controls"]')!;
    expect([...firstControls.querySelectorAll('button')].map(button => button.textContent)).not.toContain('1');
    [...firstControls.querySelectorAll('button')].find(button => button.textContent === 'Короче')!.click();
    expect(insert).toHaveBeenCalledWith(expect.stringContaining('короче'), true);

    document.querySelector('.markdown')!.innerHTML = '<ol><li>Первый</li><li>Второй</li><li>Третий</li><li>Четвертый</li><li>Пятый</li></ol>';
    decorate();
    decorate();

    const controls = message.querySelectorAll('[data-social-publisher="controls"]');
    expect(controls).toHaveLength(1);
    expect(controls[0]).not.toBe(firstControls);
    expect([...controls[0].querySelectorAll('button')].map(button => button.textContent)).toEqual(['1', '2', '3', '4', '5', 'Опубликовать']);
    controls[0].querySelector<HTMLButtonElement>('button')!.click();
    expect(insert).toHaveBeenLastCalledWith(expect.stringContaining('вариант №1'), true);
  });

  it('shows photo choices without immediately opening the publisher', async () => {
    const document = useDom('Готовый ответ');
    const sendMessage = vi.fn();
    vi.stubGlobal('chrome', {runtime: {sendMessage}});
    const {decorate} = await import('./controls');

    decorate();
    const publish = [...document.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent === 'Опубликовать')!;
    publish.click();

    expect(sendMessage).not.toHaveBeenCalled();
    expect([...document.querySelectorAll<HTMLButtonElement>('[data-social-publisher="photo-choice"] button')].map(button => button.textContent)).toEqual([
      'Фото без текста', 'Фото с инфографикой и текстом', 'Фото не нужно'
    ]);

    [...document.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent === 'Фото не нужно')!.click();
    expect(sendMessage).toHaveBeenCalledWith({
      type: 'OPEN_PUBLISHER',
      draft: {originalText: 'Готовый ответ', publicationText: 'Готовый ответ', imageMode: 'text_only', image: null}
    });
  });

  it('submits an illustration prompt and selects only the subsequent image', async () => {
    const document = useDom('Полный пост');
    const sendMessage = vi.fn();
    vi.stubGlobal('chrome', {runtime: {sendMessage}});
    const {ChatGPTAdapter} = await import('./chatgpt-adapter');
    const insert = vi.spyOn(ChatGPTAdapter.prototype, 'insert').mockResolvedValue();
    const {decorate} = await import('./controls');

    decorate();
    [...document.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent === 'Опубликовать')!.click();
    [...document.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent === 'Фото без текста')!.click();
    expect(insert).toHaveBeenCalledWith(expect.stringContaining('без текста и надписей'), true);

    const observer = new ChatGPTAdapter().observe(decorate);
    document.querySelector('main')!.insertAdjacentHTML('beforeend', '<article data-testid="conversation-turn-2"><div data-testid="image-generation"></div></article>');
    await new Promise(resolve => setTimeout(resolve, 250));
    expect([...document.querySelectorAll<HTMLButtonElement>('button')].map(button => button.textContent)).not.toContain('Использовать');
    document.querySelector('[data-testid="image-generation"]')!.insertAdjacentHTML('beforeend', '<img src="https://files.oaiusercontent.com/a.png" width="1024" height="1024">');
    await new Promise(resolve => setTimeout(resolve, 250));
    decorate();
    expect([...document.querySelectorAll<HTMLButtonElement>('[data-social-publisher="image-candidate"] button')].map(button => button.textContent)).toEqual(['Использовать', 'Другое']);
    expect(document.querySelectorAll('[data-social-publisher="image-candidate"]')).toHaveLength(1);
    [...document.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent === 'Использовать')!.click();
    observer.disconnect();

    expect(sendMessage).toHaveBeenLastCalledWith({type: 'OPEN_PUBLISHER', draft: expect.objectContaining({
      originalText: 'Полный пост', publicationText: 'Полный пост', imageMode: 'illustration', image: expect.objectContaining({url: 'https://files.oaiusercontent.com/a.png'})
    })});
  });

  it('extracts an infographic title and does not select a stale regenerated image', async () => {
    const document = useDom('## Заголовок поста\n\nПолный длинный текст');
    const sendMessage = vi.fn();
    vi.stubGlobal('chrome', {runtime: {sendMessage}});
    const {ChatGPTAdapter} = await import('./chatgpt-adapter');
    const insert = vi.spyOn(ChatGPTAdapter.prototype, 'insert').mockResolvedValue();
    const {decorate} = await import('./controls');

    decorate();
    document.querySelector('.markdown')!.insertAdjacentHTML('beforeend', '<img src="https://files.oaiusercontent.com/old.png" width="1024" height="1024">');
    [...document.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent === 'Опубликовать')!.click();
    [...document.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent === 'Фото с инфографикой и текстом')!.click();
    expect(insert).toHaveBeenCalledWith(expect.stringContaining('хорошо читаемой инфографики'), true);
    decorate();
    expect([...document.querySelectorAll<HTMLButtonElement>('button')].map(button => button.textContent)).not.toContain('Использовать');
    document.querySelector('main')!.insertAdjacentHTML('beforeend', '<article data-testid="conversation-turn-2"><div data-testid="image-generation"><img alt="Сформированное изображение" src="https://chatgpt.com/backend-api/estuary/content?id=a" width="1254" height="1254"></div></article>');
    decorate();
    [...document.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent === 'Другое')!.click();
    expect(insert).toHaveBeenLastCalledWith(expect.stringContaining('другую композицию'), true);

    document.querySelector('main')!.insertAdjacentHTML('beforeend', '<article data-testid="conversation-turn-3"><div data-testid="image-generation"><img alt="Сформированное изображение" src="https://chatgpt.com/backend-api/estuary/content?id=b" width="1254" height="1254"></div></article>');
    decorate();
    [...document.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent === 'Использовать')!.click();
    const draft = sendMessage.mock.calls.at(-1)?.[0].draft;
    expect(draft).toMatchObject({
      originalText: '## Заголовок поста\n\nПолный длинный текст',
      publicationText: 'Заголовок поста',
      imageMode: 'infographic',
      image: {url: 'https://chatgpt.com/backend-api/estuary/content?id=b'}
    });
  });

  it('restores a draggable preset toolbar position', async () => {
    const document = useDom('Ответ');
    vi.stubGlobal('chrome', {
      storage: {local: {get: vi.fn(async () => ({workerBaseUrl: '', toolbarPosition: {x: 120, y: 80}})), set: vi.fn()}},
      runtime: {sendMessage: vi.fn()}
    });
    const {ChatGPTAdapter} = await import('./chatgpt-adapter');
    const insert = vi.spyOn(ChatGPTAdapter.prototype, 'insert').mockResolvedValue();
    const {installToolbar} = await import('./controls');

    await installToolbar();

    const toolbar = document.querySelector<HTMLElement>('[data-social-publisher="toolbar"]')!;
    expect(toolbar.querySelector('.sp-drag-handle')?.getAttribute('aria-label')).toBe('Переместить панель');
    expect(toolbar.style.left).toBe('120px');
    expect(toolbar.style.top).toBe('80px');
    [...toolbar.querySelectorAll('button')].find(button => button.textContent?.includes('Новости'))!.click();
    expect(insert).toHaveBeenCalledWith(expect.stringContaining('актуальные новости'));
  });
});
