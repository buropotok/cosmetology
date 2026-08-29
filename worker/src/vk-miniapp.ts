export const vkMiniAppHtml = `<!doctype html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Публикация VK</title>
  <script src="https://unpkg.com/@vkontakte/vk-bridge/dist/browser.min.js"></script>
  <style>
    body { font-family: sans-serif; padding: 24px; }
    button { width: 100%; padding: 16px; font-size: 18px; }
    pre { margin-top: 20px; white-space: pre-wrap; word-break: break-word; }
  </style>
</head>
<body>
  <h2>Публикация в VK</h2>
  <button id="post" disabled>Открыть публикацию</button>
  <pre id="status">Загружаем публикацию…</pre>

  <script>
    const status = document.getElementById('status');
    const button = document.getElementById('post');
    let handoff = null;

    function handoffToken() {
      const query = new URLSearchParams(location.search).get('handoff');
      if (query) return query;
      const hash = new URLSearchParams(location.hash.replace(/^#/, '')).get('handoff');
      if (hash) return hash;
      const launch = new URLSearchParams(location.search).get('vk_ref') || '';
      const match = launch.match(/(?:^|[?&#])handoff=([A-Za-z0-9_-]+)/);
      return match ? match[1] : '';
    }

    async function init() {
      try {
        await vkBridge.send('VKWebAppInit');
        const token = handoffToken();
        if (!token) throw new Error('Не получен handoff token. Вернитесь в Telegram и откройте VK снова.');
        const response = await fetch('/api/vk-handoff/' + encodeURIComponent(token), { cache: 'no-store' });
        const result = await response.json().catch(() => null);
        if (!response.ok) throw new Error(result?.error?.message || 'Не удалось загрузить публикацию.');
        handoff = result;
        button.disabled = false;
        status.textContent = 'Публикация готова. Нажмите кнопку, чтобы открыть редактор VK.';
      } catch (error) {
        status.textContent = error instanceof Error ? error.message : String(error);
      }
    }

    button.addEventListener('click', async () => {
      if (!handoff) return;
      button.disabled = true;
      status.textContent = 'Открываем редактор VK…';
      try {
        const params = { owner_id: -handoff.groupId, message: handoff.text };
        if (handoff.imageUrl) params.upload_attachments = [{ type: 'photo', link: handoff.imageUrl }];
        const result = await vkBridge.send('VKWebAppShowWallPostBox', params);
        status.textContent = 'VK завершил действие: ' + JSON.stringify(result);
      } catch (error) {
        status.textContent = 'Ошибка VK: ' + JSON.stringify(error, null, 2);
      } finally {
        button.disabled = false;
      }
    });

    init();
  </script>
</body>
</html>`;
