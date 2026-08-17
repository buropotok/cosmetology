interface PublisherDraft {
  text: string;
  images: string[];
}

interface OpenPublisherMessage {
  type: 'OPEN_PUBLISHER';
  draft: PublisherDraft;
}

chrome.sidePanel.setPanelBehavior({openPanelOnActionClick: true}).catch(console.warn);

function openPublisher(message: OpenPublisherMessage, sender: chrome.runtime.MessageSender) {
  const windowId = sender.tab?.windowId;
  if (windowId === undefined) {
    console.error('[Cosmetology] Failed to open publisher side panel: sender window not found');
  } else {
    // This must be the first extension API call made for the user-triggered
    // message. Awaiting anything first causes Chrome to discard the gesture.
    void chrome.sidePanel.open({windowId}).catch((error: unknown) => {
      console.error('[Cosmetology] Failed to open publisher side panel', error);
    });
  }

  void chrome.storage.session.set({draft: message.draft}).then(() => {
    // The panel may have loaded before session storage finished. Notify an
    // already-open panel; a later-loading panel reads the same draft on startup.
    void chrome.runtime.sendMessage({type: 'DRAFT_UPDATED', draft: message.draft}).catch(() => undefined);
  }).catch((error: unknown) => {
    console.error('[Cosmetology] Failed to store publisher draft', error);
  });
}

chrome.runtime.onMessage.addListener((message: unknown, sender: chrome.runtime.MessageSender) => {
  if (typeof message !== 'object' || message === null || (message as {type?: unknown}).type !== 'OPEN_PUBLISHER') return;
  openPublisher(message as OpenPublisherMessage, sender);
});
