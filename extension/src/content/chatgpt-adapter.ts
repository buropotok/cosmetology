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

export interface ImageInspection {
  turnTestId: string;
  imageElements: number;
  generatedAltImages: number;
  validImages: number;
  elements: Array<{
    tag: string;
    srcType: 'blob' | 'data' | 'https' | 'other';
    naturalWidth: number;
    naturalHeight: number;
    renderedWidth: number;
    renderedHeight: number;
    declaredWidth: number;
    declaredHeight: number;
  }>;
  images: ChatGPTImage[];
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

function sourceType(url: string): ImageInspection['elements'][number]['srcType'] {
  if (url.startsWith('blob:')) return 'blob';
  if (url.startsWith('data:')) return 'data';
  if (url.startsWith('https:')) return 'https';
  return 'other';
}

function assistantTurnRoot(message: HTMLElement) {
  // Current ChatGPT turns can render generated-media blocks as siblings of the
  // .markdown node (and sometimes of the author-role node) inside the turn.
  return message.closest<HTMLElement>('[data-testid^="conversation-turn-"], article') ?? message;
}

function isGeneratedAlt(alt: string) {
  return /(?:сформированное|созданное|generated)\s+(?:изображение|image)/i.test(alt.trim());
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
  private pendingImageLoads = new WeakSet<HTMLImageElement>();
  findMessages() { return [...document.querySelectorAll<HTMLElement>(S.messages)]; }
  findConversationTurns() {
    const turns = [...document.querySelectorAll<HTMLElement>('[data-testid^="conversation-turn-"]')];
    if (turns.length) return turns;
    return [...document.querySelectorAll<HTMLElement>('main article')].filter(turn => turn.matches('article') && (turn.querySelector(S.messages) || turn.querySelector('img')));
  }
  findConversationTurnsAfter(boundaryTurn: HTMLElement | null) {
    const turns = this.findConversationTurns();
    if (!boundaryTurn) return turns;
    let boundaryIndex = turns.indexOf(boundaryTurn);
    if (boundaryIndex < 0 && boundaryTurn.dataset.testid) boundaryIndex = turns.findIndex(turn => turn.dataset.testid === boundaryTurn.dataset.testid);
    // If ChatGPT removed the boundary and its stable id cannot be recovered,
    // fail closed rather than attaching an older image to the active draft.
    return boundaryIndex < 0 ? [] : turns.slice(boundaryIndex + 1);
  }
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

  inspectTurnImages(turn: HTMLElement, onImageLoad?: () => void): ImageInspection {
    const elements = [...turn.querySelectorAll<HTMLImageElement>('img')].filter(image => !image.closest('[data-social-publisher], [aria-hidden="true"]'));
    const details = elements.map(image => {
      const url = bestSource(image);
      const rect = image.getBoundingClientRect();
      if ((!image.complete || image.naturalWidth === 0 || image.naturalHeight === 0) && onImageLoad && !this.pendingImageLoads.has(image)) {
        this.pendingImageLoads.add(image);
        const loaded = () => {
          this.pendingImageLoads.delete(image);
          image.removeEventListener('error', failed);
          onImageLoad();
        };
        const failed = () => {
          this.pendingImageLoads.delete(image);
          image.removeEventListener('load', loaded);
        };
        image.addEventListener('load', loaded, {once: true});
        image.addEventListener('error', failed, {once: true});
      }
      return {
        element: image,
        url,
        tag: image.tagName.toLowerCase(),
        srcType: sourceType(url),
        naturalWidth: image.naturalWidth,
        naturalHeight: image.naturalHeight,
        renderedWidth: Math.round(rect.width),
        renderedHeight: Math.round(rect.height),
        declaredWidth: image.width,
        declaredHeight: image.height
      };
    });
    const valid = details.filter(item => {
      if (!item.url || item.url.startsWith('data:image/svg') || /\.svg(?:[?#]|$)/i.test(item.url)) return false;
      const width = Math.max(item.naturalWidth, item.renderedWidth, item.element.width);
      const height = Math.max(item.naturalHeight, item.renderedHeight, item.element.height);
      return width >= 200 && height >= 200;
    });
    return {
      turnTestId: turn.dataset.testid || turn.id || 'unknown',
      imageElements: elements.length,
      generatedAltImages: elements.filter(image => isGeneratedAlt(image.alt)).length,
      validImages: valid.length,
      elements: details.map(({element: _element, url: _url, ...detail}) => detail),
      images: valid.map(item => ({
        url: item.url,
        alt: item.element.alt || undefined,
        width: Math.max(item.naturalWidth, item.renderedWidth, item.element.width) || undefined,
        height: Math.max(item.naturalHeight, item.renderedHeight, item.element.height) || undefined
      }))
    };
  }

  inspectAssistantMessageImages(message: HTMLElement, onImageLoad?: () => void) {
    return this.inspectTurnImages(assistantTurnRoot(message), onImageLoad);
  }

  getAssistantMessageImages(message: HTMLElement, onImageLoad?: () => void) {
    return this.inspectAssistantMessageImages(message, onImageLoad).images;
  }

  getBestGeneratedImage(message: HTMLElement, onImageLoad?: () => void) {
    return this.getAssistantMessageImages(message, onImageLoad).sort((a, b) => (b.width ?? 0) * (b.height ?? 0) - (a.width ?? 0) * (a.height ?? 0))[0];
  }

  getImages(message: HTMLElement) { return this.getAssistantMessageImages(message); }
  getBestImage(message: HTMLElement) { return this.getBestGeneratedImage(message); }

  async resolveImageForDownload(image: ChatGPTImage): Promise<ChatGPTImage> {
    if (!image.url.startsWith('blob:')) return image;
    const response = await fetch(image.url);
    if (!response.ok) throw new Error(`Image fetch failed (${response.status})`);
    return {...image, url: await blobToDataUrl(await response.blob())};
  }

  images(message: HTMLElement) { return this.getImages(message).map(image => image.url); }
  observe(cb: () => void) {
    let timer = 0;
    const observer = new MutationObserver(() => {
      clearTimeout(timer);
      timer = window.setTimeout(cb, 200);
    });
    observer.observe(document.querySelector('main') ?? document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src', 'srcset', 'href', 'width', 'height', 'data-src']
    });
    return observer;
  }
}
