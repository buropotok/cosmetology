interface PublisherDraft {
  text: string;
  images: string[];
}

interface OpenPublisherMessage {
  type: 'OPEN_PUBLISHER';
  draft: PublisherDraft;
}

chrome.sidePanel.setPanelBehavior({openPanelOnActionClick: true}).catch(console.warn);

async function openPublisher(message: OpenPublisherMessage, sender: chrome.runtime.MessageSender) {
  await chrome.storage.session.set({draft: message.draft});
  const windowId = sender.tab?.windowId ?? (await chrome.windows.getCurrent()).id;
  if (windowId !== undefined) await chrome.sidePanel.open({windowId});
}

chrome.runtime.onMessage.addListener((message: unknown, sender: chrome.runtime.MessageSender) => {
  if (typeof message !== 'object' || message === null || (message as {type?: unknown}).type !== 'OPEN_PUBLISHER') return;
  void openPublisher(message as OpenPublisherMessage, sender).catch(console.warn);
});
