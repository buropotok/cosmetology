import {afterEach, describe, expect, it, vi} from 'vitest';
import {JSDOM} from 'jsdom';
import {ChatGPTAdapter} from './chatgpt-adapter';

function useDom(html: string) {
  const dom = new JSDOM(html, {url: 'https://chatgpt.com/'});
  Object.assign(globalThis, {
    document: dom.window.document,
    Event: dom.window.Event,
    InputEvent: dom.window.InputEvent,
    HTMLElement: dom.window.HTMLElement,
    HTMLTextAreaElement: dom.window.HTMLTextAreaElement
  });
  return dom.window.document;
}

afterEach(() => vi.restoreAllMocks());

describe('ChatGPTAdapter prompt insertion', () => {
  it('replaces ProseMirror content and emits editable input events without submitting', async () => {
    const document = useDom('<form><div id="prompt-textarea" class="ProseMirror" role="textbox" contenteditable="true"><p>old prompt</p></div><button data-testid="send-button">Send</button></form>');
    const editor = document.querySelector<HTMLElement>('#prompt-textarea')!;
    const events: string[] = [];
    editor.addEventListener('beforeinput', () => events.push('beforeinput'));
    editor.addEventListener('input', () => events.push('input'));
    const send = document.querySelector<HTMLButtonElement>('button')!;
    const click = vi.spyOn(send, 'click');

    await new ChatGPTAdapter().insert('new preset');

    expect(editor.textContent).toBe('new preset');
    expect(document.activeElement).toBe(editor);
    expect(events).toEqual(['beforeinput', 'input']);
    expect(click).not.toHaveBeenCalled();
  });

  it('replaces a textarea through input and change events', async () => {
    const document = useDom('<form><textarea data-id="root">old prompt</textarea></form>');
    const editor = document.querySelector<HTMLTextAreaElement>('textarea')!;
    const events: string[] = [];
    for (const type of ['beforeinput', 'input', 'change']) editor.addEventListener(type, () => events.push(type));

    await new ChatGPTAdapter().insert('replacement');

    expect(editor.value).toBe('replacement');
    expect(editor.selectionStart).toBe('replacement'.length);
    expect(events).toEqual(['beforeinput', 'input', 'change']);
  });

  it('logs a diagnostic when no composer exists', async () => {
    useDom('<main></main>');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await new ChatGPTAdapter().insert('preset');
    expect(warn).toHaveBeenCalledWith('[Cosmetology] ChatGPT composer not found');
  });

  it('rechecks an initially unloaded generated image when its load event fires', () => {
    const document = useDom('<article data-testid="conversation-turn-4"><div data-message-author-role="assistant"><div class="markdown"></div></div><div data-testid="image-generation"><img src="https://files.oaiusercontent.com/generated.png"></div></article>');
    const message = document.querySelector<HTMLElement>('[data-message-author-role="assistant"]')!;
    const image = document.querySelector<HTMLImageElement>('img')!;
    const loaded = vi.fn();
    const adapter = new ChatGPTAdapter();

    expect(adapter.getBestGeneratedImage(message, loaded)).toBeUndefined();
    Object.defineProperties(image, {
      naturalWidth: {value: 1024, configurable: true},
      naturalHeight: {value: 1024, configurable: true},
      complete: {value: true, configurable: true}
    });
    image.dispatchEvent(new Event('load'));

    expect(loaded).toHaveBeenCalledOnce();
    expect(adapter.getBestGeneratedImage(message)?.url).toBe('https://files.oaiusercontent.com/generated.png');
  });
});
