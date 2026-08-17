// Centralize all fragile ChatGPT DOM knowledge here.
const S = {
  messages: '[data-message-author-role="assistant"]',
  composer: [
    '#prompt-textarea',
    '[data-testid="composer"] [contenteditable="true"]',
    'form [contenteditable="true"][role="textbox"]',
    'form [contenteditable="true"]',
    'textarea[data-id="root"]',
    'form textarea'
  ].join(', '),
  send: 'button[data-testid="send-button"], button[aria-label*="Send"], button[aria-label*="Отправ"]'
};

export interface ChatGPTImage {
  url: string;
  alt?: string;
  width?: number;
  height?: number;
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Image conversion returned no data'));
    reader.onerror = () => reject(reader.error ?? new Error('Image conversion failed'));
    reader.readAsDataURL(blob);
  });
}

function bestSource(image: HTMLImageElement) {
  const srcset = image.getAttribute('srcset')?.split(',').map(part => {
    const [url, descriptor = '0w'] = part.trim().split(/\s+/);
    return {url, size: Number.parseFloat(descriptor)};
  }).filter(candidate => candidate.url).sort((a, b) => b.size - a.size)[0]?.url;
  const linked = image.closest<HTMLAnchorElement>('a[href]')?.href;
  return srcset || linked || image.currentSrc || image.src;
}

function isUsableComposer(element: HTMLElement) {
  if (!element.isConnected || element.closest('[aria-hidden="true"]')) return false;
  if (element instanceof HTMLTextAreaElement && element.disabled) return false;
  const style = element.ownerDocument.defaultView?.getComputedStyle(element);
  return style?.display !== 'none' && style?.visibility !== 'hidden';
}

function inputEvent(element: HTMLElement, type: 'beforeinput' | 'input', text: string) {
  const InputEventConstructor = element.ownerDocument.defaultView?.InputEvent ?? InputEvent;
  return new InputEventConstructor(type, {
    bubbles: true,
    cancelable: type === 'beforeinput',
    composed: true,
    inputType: 'insertText',
    data: text
  });
}

function replaceTextarea(textarea: HTMLTextAreaElement, text: string) {
  textarea.dispatchEvent(inputEvent(textarea, 'beforeinput', text));
  // Use the native setter so React's value tracker sees an external value change.
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
  setter?.call(textarea, text);
  if (!setter) textarea.value = text;
  textarea.setSelectionRange(text.length, text.length);
  textarea.dispatchEvent(inputEvent(textarea, 'input', text));
  textarea.dispatchEvent(new Event('change', {bubbles: true}));
}

function replaceContentEditable(editor: HTMLElement, text: string) {
  const doc = editor.ownerDocument;
  const selection = doc.getSelection();
  const range = doc.createRange();
  range.selectNodeContents(editor);
  selection?.removeAllRanges();
  selection?.addRange(range);
  editor.dispatchEvent(inputEvent(editor, 'beforeinput', text));

  // execCommand follows the browser's normal editable-element path and preserves
  // ProseMirror's editing behavior. The Range fallback covers environments where
  // the command is unavailable or disabled.
  const inserted = typeof doc.execCommand === 'function' && doc.execCommand('insertText', false, text);
  if (!inserted) {
    range.deleteContents();
    const textNode = doc.createTextNode(text);
    range.insertNode(textNode);
    range.setStartAfter(textNode);
    range.collapse(true);
    selection?.removeAllRanges();
    selection?.addRange(range);
  }
  editor.dispatchEvent(inputEvent(editor, 'input', text));
}

export class ChatGPTAdapter {
  findMessages() { return [...document.querySelectorAll<HTMLElement>(S.messages)]; }
  contentRoot(message: HTMLElement) { return message.querySelector<HTMLElement>('.markdown') ?? message; }

  private findComposer() {
    const active = document.activeElement;
    if (active instanceof HTMLElement && active.matches(S.composer) && isUsableComposer(active)) return active;
    return [...document.querySelectorAll<HTMLElement>(S.composer)].find(isUsableComposer);
  }

  async insert(text: string, submit = false) {
    const editor = this.findComposer();
    if (!editor) {
      console.warn('[Cosmetology] ChatGPT composer not found');
      return;
    }
    try {
      editor.focus();
      if (editor instanceof HTMLTextAreaElement) replaceTextarea(editor, text);
      else replaceContentEditable(editor, text);
      if (submit) {
        await new Promise(resolve => setTimeout(resolve, 50));
        document.querySelector<HTMLButtonElement>(S.send)?.click();
      }
    } catch (error) {
      console.warn('[Cosmetology] Failed to insert preset prompt', error);
    }
  }

  getImages(message: HTMLElement): ChatGPTImage[] {
    return [...this.contentRoot(message).querySelectorAll<HTMLImageElement>('img')]
      .map(image => ({
        url: bestSource(image),
        alt: image.alt || undefined,
        width: image.naturalWidth || image.width || undefined,
        height: image.naturalHeight || image.height || undefined
      }))
      .filter(image => Boolean(image.url) && (image.width === undefined || image.height === undefined || image.width > 200 && image.height > 200));
  }

  getBestImage(message: HTMLElement) {
    return this.getImages(message).sort((a, b) => (b.width ?? 0) * (b.height ?? 0) - (a.width ?? 0) * (a.height ?? 0))[0];
  }

  async resolveImageForDownload(image: ChatGPTImage): Promise<ChatGPTImage> {
    if (!image.url.startsWith('blob:')) return image;
    const response = await fetch(image.url);
    if (!response.ok) throw new Error(`Image fetch failed (${response.status})`);
    return {...image, url: await blobToDataUrl(await response.blob())};
  }

  images(message: HTMLElement) { return this.getImages(message).map(image => image.url); }
  observe(cb: () => void) { let timer = 0; const observer = new MutationObserver(() => { clearTimeout(timer); timer = window.setTimeout(cb, 200); }); observer.observe(document.querySelector('main') ?? document.body, {childList: true, subtree: true}); return observer; }
}
