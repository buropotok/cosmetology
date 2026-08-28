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
let previewUrl;
let accountReady = false;

const user = webApp?.initDataUnsafe?.user;
if (user?.first_name) document.querySelector('#greeting').textContent = `Здравствуйте, ${user.first_name}`;

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
  if (!webApp?.initData) {
    setAccount('Приложение открыто вне Telegram', 'Откройте его кнопкой в Telegram-боте', 'error');
    return;
  }
  try {
    const response = await fetch('/api/miniapp/me', { headers: { Authorization: `tma ${webApp.initData}` } });
    const result = await response.json().catch(() => null);
    if (!response.ok) throw new Error(result?.error?.message || 'Не удалось проверить подключение.');
    if (!result.linked) {
      setAccount('Аккаунт ещё не связан', 'Создайте код подключения в расширении и отправьте /connect в группе', 'error');
      return;
    }
    if (!result.connection?.connected) {
      setAccount('Telegram-группа не подключена', 'Подключите группу через расширение', 'error');
      return;
    }
    accountReady = true;
    publish.disabled = false;
    setAccount(`Публикация в: ${result.connection.chatTitle}`, 'Группа подключена', 'connected');
  } catch (error) {
    setAccount('Не удалось проверить подключение', error instanceof Error ? error.message : 'Откройте приложение заново', 'error');
  }
}

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
  if (!accountReady) return setStatus('Сначала свяжите аккаунт и подключите группу.', 'error');
  if (!text.value.trim() && !imageInput.files?.[0]) return setStatus('Добавьте текст или изображение.', 'error');
  publish.disabled = true;
  publish.textContent = 'Публикуем…';
  setStatus('Публикуем…');
  const body = new FormData();
  body.set('text', text.value);
  if (imageInput.files?.[0]) body.set('image', imageInput.files[0]);
  try {
    const response = await fetch('/api/miniapp/publish', { method: 'POST', headers: { Authorization: `tma ${webApp.initData}` }, body });
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
    publish.disabled = !accountReady;
    publish.textContent = 'Опубликовать';
  }
});

loadAccount();
