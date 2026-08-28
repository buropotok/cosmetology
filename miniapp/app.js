const webApp = window.Telegram?.WebApp;
webApp?.ready();
webApp?.expand();

const form = document.querySelector('#publish-form');
const imageInput = document.querySelector('#image');
const previewWrap = document.querySelector('#preview-wrap');
const preview = document.querySelector('#preview');
const removeImage = document.querySelector('#remove-image');
const text = document.querySelector('#text');
const publish = document.querySelector('#publish');
const status = document.querySelector('#status');
const account = document.querySelector('#account');
const accountTitle = document.querySelector('#account-title');
const accountDetail = document.querySelector('#account-detail');
const onboarding = document.querySelector('#onboarding');
const createPairing = document.querySelector('#create-pairing');
const pairing = document.querySelector('#pairing');
const pairingCommand = document.querySelector('#pairing-command');
const pairingExpiry = document.querySelector('#pairing-expiry');
const recheck = document.querySelector('#recheck');
const createManagedBot = document.querySelector('#create-managed-bot');
const managedBotStatus = document.querySelector('#managed-bot-status');
let previewUrl;
let connectionReady = false;

const user = webApp?.initDataUnsafe?.user;
if (user?.first_name) document.querySelector('#greeting').textContent = `Здравствуйте, ${user.first_name}`;

function authHeaders() {
  return { Authorization: `tma ${webApp.initData}` };
}

function setStatus(message, kind = '') {
  status.textContent = message;
  status.className = kind;
}

function setAccount(title, detail, kind = '') {
  accountTitle.textContent = title;
  accountDetail.textContent = detail;
  account.className = `account ${kind}`.trim();
}

function clearImage() {
  imageInput.value = '';
  previewWrap.hidden = true;
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = undefined;
  preview.removeAttribute('src');
}

async function loadAccount() {
  connectionReady = false;
  publish.disabled = true;
  if (!webApp?.initData) {
    setAccount('Приложение открыто вне Telegram', 'Откройте его кнопкой в Telegram-боте', 'error');
    return;
  }
  setAccount('Проверяем подключение…', 'Подождите немного');
  try {
    const response = await fetch('/api/miniapp/me', { headers: authHeaders() });
    const result = await response.json().catch(() => null);
    if (!response.ok) throw new Error(result?.error?.message || 'Не удалось проверить подключение.');
    if (!result.connection?.connected) {
      onboarding.hidden = false;
      setAccount('Telegram-группа не подключена', 'Подключите группу прямо из Mini App', 'error');
      return;
    }
    connectionReady = true;
    publish.disabled = false;
    onboarding.hidden = true;
    pairing.hidden = true;
    setAccount(`Публикация в: ${result.connection.chatTitle}`, 'Группа подключена', 'connected');
  } catch (error) {
    setAccount('Не удалось проверить подключение', error instanceof Error ? error.message : 'Откройте приложение заново', 'error');
  }
}

createPairing.addEventListener('click', async () => {
  createPairing.disabled = true;
  createPairing.textContent = 'Создаём код…';
  try {
    const response = await fetch('/api/miniapp/telegram/pairing', { method: 'POST', headers: authHeaders() });
    const result = await response.json().catch(() => null);
    if (!response.ok) throw new Error(result?.error?.message || 'Не удалось создать код подключения.');
    pairingCommand.textContent = result.command;
    pairingExpiry.textContent = `Код действует до ${new Date(result.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    pairing.hidden = false;
    createPairing.textContent = 'Создать новый код';
  } catch (error) {
    setStatus(error instanceof Error ? error.message : 'Не удалось создать код.', 'error');
    createPairing.textContent = 'Подключить Telegram-группу';
  } finally {
    createPairing.disabled = false;
  }
});
recheck.addEventListener('click', loadAccount);

imageInput.addEventListener('change', () => {
  const file = imageInput.files?.[0];
  if (!file) return clearImage();
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = URL.createObjectURL(file);
  preview.src = previewUrl;
  previewWrap.hidden = false;
  setStatus('');
});
removeImage.addEventListener('click', clearImage);

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!connectionReady) return setStatus('Сначала подключите Telegram-группу.', 'error');
  if (!text.value.trim() && !imageInput.files?.[0]) return setStatus('Добавьте текст или изображение.', 'error');
  publish.disabled = true;
  publish.textContent = 'Публикуем…';
  setStatus('Публикуем…');
  const body = new FormData();
  body.set('text', text.value);
  if (imageInput.files?.[0]) body.set('image', imageInput.files[0]);
  try {
    const response = await fetch('/api/miniapp/publish', { method: 'POST', headers: authHeaders(), body });
    const result = await response.json().catch(() => null);
    if (!response.ok) throw new Error(result?.error?.message || 'Не удалось опубликовать. Попробуйте ещё раз.');
    text.value = '';
    clearImage();
    setStatus('Опубликовано. Можно создать следующий пост.', 'success');
    webApp.HapticFeedback?.notificationOccurred('success');
  } catch (error) {
    setStatus(error instanceof Error ? error.message : 'Не удалось опубликовать.', 'error');
    webApp.HapticFeedback?.notificationOccurred('error');
  } finally {
    publish.disabled = !connectionReady;
    publish.textContent = 'Опубликовать';
  }
});

createManagedBot.addEventListener('click', async () => {
  if (!webApp?.initData) {
    managedBotStatus.textContent = 'Откройте Mini App внутри Telegram.';
    return;
  }
  createManagedBot.disabled = true;
  managedBotStatus.textContent = 'Открываем Telegram…';
  try {
    const response = await fetch('/api/miniapp/debug/managed-bot/create-link', {
      method: 'POST',
      headers: authHeaders(),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) throw new Error(result?.error?.message || 'Не удалось создать ссылку.');
    managedBotStatus.textContent = `Предложенный username: @${result.suggestedUsername}`;
    if (webApp.openTelegramLink) webApp.openTelegramLink(result.url);
    else window.location.href = result.url;
  } catch (error) {
    managedBotStatus.textContent = error instanceof Error ? error.message : 'Не удалось открыть Telegram.';
  } finally {
    createManagedBot.disabled = false;
  }
});

loadAccount();
