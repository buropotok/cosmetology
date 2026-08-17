declare module 'jsdom' {
  interface DOMWindow extends Window {
    document: Document;
    Node: typeof Node;
    Element: typeof Element;
    Event: typeof Event;
    InputEvent: typeof InputEvent;
    HTMLElement: typeof HTMLElement;
    HTMLTextAreaElement: typeof HTMLTextAreaElement;
    MutationObserver: typeof MutationObserver;
  }

  export class JSDOM {
    constructor(html?: string, options?: {url?: string});
    window: DOMWindow;
  }
}
