const aiResultTitle = document.querySelector('#ai-screen .cosmo-ai-copy h3');

if (aiResultTitle) {
  aiResultTitle.hidden = true;
  aiResultTitle.setAttribute('aria-hidden', 'true');
}

const responseBody = document.querySelector('[data-ai-response]');

function publishPostDocument(doc) {
  window.CosmoAiPostDocument = doc || null;
  window.dispatchEvent(new CustomEvent('cosmo-ai-post-document', { detail: { document: doc || null } }));
}

function appendRuns(parent, runs) {
  for (const run of Array.isArray(runs) ? runs : []) {
    let node = document.createTextNode(typeof run?.text === 'string' ? run.text : '');
    for (const mark of Array.isArray(run?.marks) ? run.marks : []) {
      let wrapper = null;
      if (mark?.type === 'bold') wrapper = document.createElement('strong');
      else if (mark?.type === 'italic') wrapper = document.createElement('em');
      else if (mark?.type === 'underline') wrapper = document.createElement('u');
      else if (mark?.type === 'strikethrough') wrapper = document.createElement('s');
      else if (mark?.type === 'spoiler') { wrapper = document.createElement('span'); wrapper.className = 'publish-ai-wizard__spoiler'; }
      else if (mark?.type === 'link' && typeof mark.href === 'string' && /^https?:\/\//i.test(mark.href)) {
        wrapper = document.createElement('a'); wrapper.href = mark.href; wrapper.target = '_blank'; wrapper.rel = 'noopener noreferrer';
      }
      if (wrapper) { wrapper.append(node); node = wrapper; }
    }
    parent.append(node);
  }
}

function appendList(parent, block) {
  const list = document.createElement(block.type === 'ordered_list' ? 'ol' : 'ul');
  for (const raw of Array.isArray(block.items) ? block.items : []) {
    const item = Array.isArray(raw) ? { content: raw } : raw;
    const li = document.createElement('li');
    appendRuns(li, item?.content);
    if (Array.isArray(item?.children) && item.children.length) appendList(li, { type: block.type, items: item.children });
    list.append(li);
  }
  parent.append(list);
}

function appendBlock(parent, block) {
  if (block.type === 'bullet_list' || block.type === 'ordered_list') { appendList(parent, block); return; }
  const element = document.createElement(block.type === 'heading' ? 'h3' : block.type === 'quote' ? 'blockquote' : 'p');
  appendRuns(element, block.content);
  parent.append(element);
}

function renderPostDocument(doc) {
  const fragment = document.createDocumentFragment();
  for (const block of doc.blocks) {
    if (block.type === 'details') {
      const details = document.createElement('details');
      const summary = document.createElement('summary');
      appendRuns(summary, block.title?.length ? block.title : [{ text: 'Подробнее' }]);
      const content = document.createElement('div');
      for (const child of Array.isArray(block.blocks) ? block.blocks : []) appendBlock(content, child);
      details.append(summary, content); fragment.append(details); continue;
    }
    appendBlock(fragment, block);
  }
  for (const button of Array.isArray(doc.buttons) ? doc.buttons : []) {
    if (typeof button?.url !== 'string' || !/^https?:\/\//i.test(button.url)) continue;
    const link = document.createElement('a'); link.className = 'publish-ai-wizard__post-button'; link.href = button.url; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = button.text || button.url; fragment.append(link);
  }
  return fragment;
}

function renderStructuredResponse() {
  if (!responseBody || responseBody.dataset.postDocumentRendered === responseBody.textContent) return;
  const raw = responseBody.textContent?.trim() || '';
  if (!raw.startsWith('{')) { publishPostDocument(null); return; }
  try {
    const doc = JSON.parse(raw);
    if (doc?.schemaVersion !== 2 || !Array.isArray(doc.blocks)) { publishPostDocument(null); return; }
    responseBody.replaceChildren(renderPostDocument(doc));
    responseBody.dataset.postDocumentRendered = responseBody.textContent || 'rendered';
    publishPostDocument(doc);
  } catch { publishPostDocument(null); }
}

if (responseBody) {
  const observer = new MutationObserver(() => queueMicrotask(renderStructuredResponse));
  observer.observe(responseBody, { childList: true, subtree: true, characterData: true });
  renderStructuredResponse();
}
