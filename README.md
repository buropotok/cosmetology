# ChatGPT Social Publisher — MVP

Персональное Chrome-расширение добавляет к обычному интерфейсу ChatGPT пресеты, быстрые действия и кнопку **«Опубликовать»**. Выбранный ответ проходит ручную редактуру в Side Panel и отправляется через Cloudflare Worker в сообщество VK и Telegram-канал/группу. Worker сохраняет один логический пост, независимые результаты площадок в D1 и изображение в R2.

## Архитектура и приватность

```text
ChatGPT web UI → MV3 content script/Side Panel → HTTPS Worker
                                                ├─ VK API
                                                ├─ Telegram Bot API
                                                ├─ D1 (посты/доставки)
                                                └─ R2 (изображения)
```

ChatGPT остаётся чатом, средой исследования и контекстом. Расширение не использует LLM API, не собирает аналитику и не отправляет разговор: только явно выбранный ответ и выбранное изображение уходят на Worker после нажатия публикации. `/history.txt` публичен и содержит только дату, тип, тему и краткое описание. API-запросы принадлежат пользователю, которого Worker определяет по проверенному Google credential; стабильным ключом служит Google `sub`, а не email или installation ID. Telegram Bot Token существует только в Worker secrets. Подробная настройка account pairing описана в `docs/telegram-account-setup.md`.

## Структура

- `extension/` — Manifest V3, изолированный адаптер DOM ChatGPT, парсер ответа, пресеты, Side Panel, API-клиент и тесты.
- `worker/` — маршруты Worker, D1/R2, VK и Telegram адаптеры, миграция и тесты.
- `miniapp/` — статический Telegram Mini App MVP, размещаемый через Worker Static Assets.
- `shared/contracts.ts` — минимальные общие API-типы.

Хрупкие селекторы ChatGPT собраны только в `extension/src/content/chatgpt-adapter.ts`. При изменении сайта сначала исправляйте этот файл. Неудача распознавания ответа или изображения не блокирует ChatGPT или текстовую публикацию.

## Требования

Node.js 20+, npm, Chrome, Cloudflare account с D1/R2, VK community token с правом публикации, Telegram bot с правом администратора целевого канала/группы.

## Первая настройка Cloudflare

```bash
cd worker
npm install
npx wrangler login
npx wrangler d1 create cosmetology-publisher
npx wrangler r2 bucket create cosmetology-publisher-images
```

1. Скопируйте реальный `database_id` из вывода D1 вместо `REPLACE_WITH_D1_DATABASE_ID` в `worker/wrangler.jsonc`. ID нельзя узнать заранее.
2. Если выбрали другое имя R2, замените `bucket_name`; binding должен остаться `IMAGES`.
3. После первой локальной загрузки расширения скопируйте его ID со страницы `chrome://extensions` и замените `chrome-extension://REPLACE_WITH_EXTENSION_ID` в `ALLOWED_EXTENSION_ORIGIN`. Это узкий CORS origin расширения.
4. Задайте secrets:

```bash
npx wrangler secret put VK_ACCESS_TOKEN
npx wrangler secret put VK_GROUP_ID
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_WEBHOOK_SECRET
npx wrangler secret put PAIRING_CODE_SECRET
npm run db:migrate
npm run deploy
```

Wrangler напечатает адрес вида `https://cosmetology-social-publisher.<subdomain>.workers.dev`. Код разворачивается только из Git/локального репозитория, не копируется в редактор Dashboard.

## Сборка и установка расширения

Из корня:

```bash
npm install
GOOGLE_OAUTH_CLIENT_ID="123.apps.googleusercontent.com" WORKER_BASE_URL="https://your-worker.workers.dev" npm run build -w extension
```

Откройте `chrome://extensions`, включите Developer mode, нажмите **Load unpacked** и выберите `extension/dist`. Публичный manifest key фиксирует ID unpacked-расширения. Откройте **Настройки → Telegram**; Worker URL и пользовательский API token в интерфейсе отсутствуют. Настройте Google OAuth, CORS и Telegram webhook по `docs/telegram-account-setup.md`.

Расширение работает на `https://chatgpt.com/*`. Пресет вставляется в нативный composer без отправки. Кнопки выбора/переписывания отправляют короткий follow-up в существующий разговор. У каждой найденной реплики ассистента своя кнопка публикации. Side Panel позволяет редактировать текст, выбрать найденную картинку или локальный файл, убрать картинку, выбрать площадки и повторить только неуспешную площадку.

## API и надёжность

- `GET /api/miniapp/me` и `POST /api/miniapp/publish` — автономный same-origin Mini App flow: Telegram `initData` создаёт/разрешает internal account и active connection без Google OAuth; настройка описана в `docs/telegram-miniapp-setup.md`.
- `POST /api/publish` — авторизованный multipart (`payload` JSON + необязательный `image`). `idempotency_key` создаёт один post; уникальность `(post_id, platform)` и проверка `published` предотвращают повторную отправку.
- `GET /api/posts?page=1&page_size=20&search=...` и `GET /api/posts/:id` — история для человека.
- `GET /api/images/:key` — чтение конкретного R2-изображения без открытия bucket listing.
- `GET /history.txt` — компактная динамическая память для ChatGPT.

Частичный успех сохраняется отдельно. Повтор из Side Panel исключает успешные targets; Worker также не отправит уже успешную пару post/platform. Отключение кнопки защищает от double-click.

Telegram: текст до 4096 символов отправляется `sendMessage`. С изображением текст до 1024 символов служит caption; более длинный текст отправляется отдельным `sendMessage` после `sendPhoto`, сохраняя весь текст. VK использует `photos.getWallUploadServer` → upload → `photos.saveWallPhoto` → `wall.post`. Версия VK API централизована в `worker/src/services/vk.ts`.

## Локальная разработка и проверки

Каждый PR, изменяющий Chrome-расширение, должен увеличивать версию в `extension/manifest.json` согласно SemVer. Для обычных исправлений и небольших функций увеличивайте PATCH; manifest является единственным источником версии.

```bash
npm install
npm run typecheck
npm test
npm run build
cd worker
cp .dev.vars.example .dev.vars  # заполнить только локально
npm run db:migrate:local
npm run dev
```

Wrangler создаёт локальное состояние D1/R2 в `.wrangler/`. Реальные публикации локально требуют настоящих provider credentials в игнорируемом `.dev.vars`. Без них проверяются сборка, validation/parser/history tests, но не реальные соцсети. DOM ChatGPT и получение generated image нужно проверить вручную в текущем Chrome; защищённые/blob URL могут не читаться, поэтому всегда доступна ручная загрузка.

## Обычное обновление

```bash
git pull
cd worker
npm install
npm run db:migrate   # только если появились миграции
npm run deploy
```

Без миграций пропустите соответствующую строку. Для изменений расширения выполните `npm install && npm run build -w extension`, затем нажмите Reload у unpacked extension.

## Troubleshooting

- **Worker error:** смотрите `npx wrangler tail`, проверьте bindings `DB`/`IMAGES`, миграции и secrets; клиент показывает безопасное структурированное сообщение.
- **Контролы ChatGPT не появились:** перезагрузите вкладку/расширение; проверьте console. Если DOM изменился, актуализируйте только `chatgpt-adapter.ts`.
- **VK отказал:** проверьте community token, scope публикации, положительный `VK_GROUP_ID` и код VK в сообщении/Worker logs.
- **Telegram отказал:** добавьте бота администратором, проверьте подключение группы, права бота и лимит 4096 для текста без картинки.
- **Изображение ChatGPT недоступно:** это ограничение URL/CORS текущего DOM; скачайте его и выберите через file input. Текст остаётся доступен.
- **Extension не достигает Worker:** проверьте build-time Worker URL, Google OAuth client, host permissions, extension ID в `ALLOWED_EXTENSION_ORIGIN`, deploy и DevTools Network.
- **CORS после перезагрузки extension ID:** unpacked ID обычно стабилен при том же каталоге; если изменился, обновите Worker var и deploy.

## Что требует ручной проверки

Реальные D1/R2 создаются в вашем Cloudflare account. Реальные VK/TG вызовы требуют указанных credentials и тестовых площадок. Перед боевой публикацией проверьте отдельно текст, картинку, длинную Telegram-подпись, частичный отказ/retry, карточку History и публичный Worker URL `/history.txt`.
