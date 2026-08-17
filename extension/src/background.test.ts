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
    vi.stubGlobal('chrome', {
      storage: {session: {set}},
      sidePanel: {setPanelBehavior: vi.fn(() => Promise.resolve()), open},
      windows: {getCurrent: vi.fn()},
      runtime: {sendMessage, onMessage: {addListener: vi.fn((fn: typeof listener) => { listener = fn; })}}
    });
    await import('./background');

    listener(
      {type: 'OPEN_PUBLISHER', draft: {text: 'Post', images: ['image']}},
      {tab: {windowId: 42} as chrome.tabs.Tab}
    );
    expect(open).toHaveBeenCalledWith({windowId: 42});
    expect(set).toHaveBeenCalledWith({draft: {text: 'Post', images: ['image']}});
    expect(calls[0]).toBe('panel');
    await vi.waitFor(() => expect(sendMessage).toHaveBeenCalled());

    expect(sendMessage).toHaveBeenCalledWith({type: 'DRAFT_UPDATED', draft: {text: 'Post', images: ['image']}});
    expect(calls).toEqual(['panel', 'storage', 'draft']);
  });
});
