import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

describe('publisher background message', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => vi.unstubAllGlobals());

  it('opens the side panel immediately, then stores and broadcasts the draft', async () => {
    const calls: string[] = [];
    let listener: (message: unknown, sender: chrome.runtime.MessageSender) => void = () => undefined;
    const open = vi.fn(async () => { calls.push('panel'); });
    const set = vi.fn(async () => { calls.push('storage'); });
    const sendMessage = vi.fn(async () => { calls.push('draft'); });
    const download = vi.fn(async () => 1);
    vi.stubGlobal('chrome', {
      storage: {session: {set}},
      sidePanel: {setPanelBehavior: vi.fn(() => Promise.resolve()), open},
      downloads: {download},
      windows: {getCurrent: vi.fn()},
      runtime: {sendMessage, onMessage: {addListener: vi.fn((fn: typeof listener) => { listener = fn; })}}
    });
    await import('./background');

    listener(
      {type: 'OPEN_PUBLISHER', draft: {originalText: 'Почему SPF нужен зимой', publicationText: 'Почему SPF нужен зимой', imageMode: 'illustration', image: {url: 'https://image.test/a.png', filename: 'Почему-SPF-зимой.png'}}},
      {tab: {windowId: 42} as chrome.tabs.Tab}
    );
    expect(open).toHaveBeenCalledWith({windowId: 42});
    expect(download).toHaveBeenCalledWith({url: 'https://image.test/a.png', filename: 'Почему-SPF-зимой.png', saveAs: true});
    expect(set).toHaveBeenCalledWith({draft: {originalText: 'Почему SPF нужен зимой', publicationText: 'Почему SPF нужен зимой', imageMode: 'illustration', image: {url: 'https://image.test/a.png', filename: 'Почему-SPF-зимой.png'}}});
    expect(calls[0]).toBe('panel');
    await vi.waitFor(() => expect(sendMessage).toHaveBeenCalled());

    expect(sendMessage).toHaveBeenCalledWith({type: 'DRAFT_UPDATED', draft: {originalText: 'Почему SPF нужен зимой', publicationText: 'Почему SPF нужен зимой', imageMode: 'illustration', image: {url: 'https://image.test/a.png', filename: 'Почему-SPF-зимой.png'}}});
    expect(calls).toEqual(['panel', 'storage', 'draft']);
  });
});
