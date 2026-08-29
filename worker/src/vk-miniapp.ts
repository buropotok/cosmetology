export const vkMiniAppHtml = `<!doctype html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>VK Wall Test</title>
  <script src="https://unpkg.com/@vkontakte/vk-bridge/dist/browser.min.js"></script>
  <style>
    body { font-family: sans-serif; padding: 24px; }
    button { width: 100%; padding: 16px; font-size: 18px; }
    pre { margin-top: 20px; white-space: pre-wrap; word-break: break-word; }
  </style>
</head>
<body>
  <h2>VK Wall Post Test</h2>
  <button id="post">Открыть composer группы</button>
  <pre id="status">Starting...</pre>

  <script>
    const status = document.getElementById('status');
    const button = document.getElementById('post');

    async function init() {
      try {
        await vkBridge.send('VKWebAppInit');
        status.textContent = 'VK Bridge initialized';
      } catch (error) {
        status.textContent = 'VKWebAppInit ERROR:\\n' + JSON.stringify(error, null, 2);
      }
    }

    button.addEventListener('click', async () => {
      status.textContent = 'Opening composer...';
      try {
        const result = await vkBridge.send('VKWebAppShowWallPostBox', {
          owner_id: -240907364,
          message: 'TEST123 — текст автоматически передан из VK Mini App'
        });
        status.textContent = 'RESULT:\\n' + JSON.stringify(result, null, 2);
      } catch (error) {
        status.textContent = 'ERROR:\\n' + JSON.stringify(error, null, 2);
      }
    });

    init();
  </script>
</body>
</html>`;
