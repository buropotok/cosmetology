import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

describe('publisher background message', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => vi.unstubAllGlobals());

  it('stores the draft before opening the side panel in the sender window', async () => {
    const calls: string[] = [];
    let listener: (message: unknown, sender: chrome.runtime.MessageSender) => void = () => undefined;
    const set = vi.fn(async () => { calls.push('storage'); });
    const open = vi.fn(async () => { calls.push('panel'); });
    vi.stubGlobal('chrome', {
      storage: {session: {set}},
      sidePanel: {setPanelBehavior: vi.fn(() => Promise.resolve()), open},
      windows: {getCurrent: vi.fn()},
      runtime: {onMessage: {addListener: vi.fn((fn: typeof listener) => { listener = fn; })}}
    });
    await import('./background');

    listener(
      {type: 'OPEN_PUBLISHER', draft: {text: 'Post', images: ['image']}},
      {tab: {windowId: 42} as chrome.tabs.Tab}
    );
    await vi.waitFor(() => expect(open).toHaveBeenCalled());

    expect(set).toHaveBeenCalledWith({draft: {text: 'Post', images: ['image']}});
    expect(open).toHaveBeenCalledWith({windowId: 42});
    expect(calls).toEqual(['storage', 'panel']);
  });
});
