const token = process.env.TELEGRAM_BOT_TOKEN;
const url = process.env.MINIAPP_URL;
if (!token || !url) {
  console.error('Set TELEGRAM_BOT_TOKEN and MINIAPP_URL environment variables.');
  process.exit(1);
}
const response = await fetch(`https://api.telegram.org/bot${token}/setChatMenuButton`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ menu_button: { type: 'web_app', text: 'Открыть приложение', web_app: { url } } }),
});
const result = await response.json();
if (!response.ok || !result.ok) { console.error('Telegram rejected setChatMenuButton:', result.description ?? response.status); process.exit(1); }
console.log('Telegram Mini App menu button configured.');
