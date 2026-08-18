import type {PublisherDraft} from './publisher/draft';

interface OpenPublisherMessage {
  type: 'OPEN_PUBLISHER';
  draft: PublisherDraft;
}

chrome.sidePanel.setPanelBehavior({openPanelOnActionClick: true}).catch(console.warn);

function openSidePanel(sender: chrome.runtime.MessageSender) {
  const windowId = sender.tab?.windowId;
  if (windowId === undefined) {
    console.error('[Cosmetology] Failed to open publisher side panel: sender window not found');
    return false;
  }
  // This must remain synchronous with the content-script click message.
  void chrome.sidePanel.open({windowId}).catch((error: unknown) => {
    console.error('[Cosmetology] Failed to open publisher side panel', error);
  });
  return true;
}

function openPublisher(message: OpenPublisherMessage, sender: chrome.runtime.MessageSender) {
  if (openSidePanel(sender)) {
    if (message.draft.image) {
      void chrome.downloads.download({
        url: message.draft.image.url,
        filename: message.draft.image.filename,
        saveAs: true
      }).catch((error: unknown) => {
        console.error('[Cosmetology] Failed to download selected image', error);
      });
    }
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
  if (typeof message !== 'object' || message === null) return;
  const type = (message as {type?: unknown}).type;
  if (type === 'OPEN_PUBLISHER') openPublisher(message as OpenPublisherMessage, sender);
  if (type === 'OPEN_BEFORE_AFTER') {
    openSidePanel(sender);
    void chrome.storage.session.set({sidePanelMode: 'before_after'}).then(() => {
      void chrome.runtime.sendMessage({type: 'OPEN_BEFORE_AFTER_EDITOR'}).catch(() => undefined);
    }).catch((error: unknown) => console.error('[Cosmetology] Failed to open Before/After editor', error));
  }
});
