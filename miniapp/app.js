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
let previewUrl;
const user = webApp?.initDataUnsafe?.user;
if (user?.first_name) document.querySelector('#greeting').textContent = `Здравствуйте, ${user.first_name}`;
function setStatus(message, kind = '') { status.textContent = message; status.className = kind; }
function clearImage() { imageInput.value = ''; previewWrap.hidden = true; if (previewUrl) URL.revokeObjectURL(previewUrl); previewUrl = undefined; preview.removeAttribute('src'); }
imageInput.addEventListener('change', () => { const file = imageInput.files?.[0]; if (!file) return clearImage(); if (previewUrl) URL.revokeObjectURL(previewUrl); previewUrl = URL.createObjectURL(file); preview.src = previewUrl; previewWrap.hidden = false; setStatus(''); });
removeImage.addEventListener('click', clearImage);
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!text.value.trim() && !imageInput.files?.[0]) return setStatus('Добавьте текст или изображение.', 'error');
  if (!webApp?.initData) return setStatus('Откройте приложение из Telegram-бота.', 'error');
  publish.disabled = true; publish.textContent = 'Публикуем…'; setStatus('Публикуем…');
  const body = new FormData(); body.set('text', text.value); if (imageInput.files?.[0]) body.set('image', imageInput.files[0]);
  try {
    const response = await fetch('/api/miniapp/publish', { method: 'POST', headers: { Authorization: `tma ${webApp.initData}` }, body });
    const result = await response.json().catch(() => null);
    if (!response.ok) throw new Error(result?.error?.message || 'Не удалось опубликовать. Попробуйте ещё раз.');
    text.value = ''; clearImage(); setStatus('Опубликовано. Можно создать следующий пост.', 'success'); webApp.HapticFeedback?.notificationOccurred('success');
  } catch (error) { setStatus(error instanceof Error ? error.message : 'Не удалось опубликовать.', 'error'); webApp.HapticFeedback?.notificationOccurred('error'); }
  finally { publish.disabled = false; publish.textContent = 'Опубликовать'; }
});
