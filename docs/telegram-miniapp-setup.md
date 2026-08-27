# Telegram Mini App MVP: настройка

Это изолированный экспериментальный flow. Он не использует Google OAuth, D1/R2, Chrome account, `PostDocument`, историю или VK. Страница из `miniapp/` публикуется как Worker Static Assets на том же origin, что и API; поэтому Mini App не требует отдельного CORS origin.

## Переменные Worker

| Binding | Тип | Назначение |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | существующий secret | Проверка `initData` и вызов Bot API |
| `TELEGRAM_WEBHOOK_SECRET` | существующий secret | Проверка webhook |
| `MINIAPP_TEST_CHAT_ID` | новый secret (string) | Единственная тестовая группа/канал; клиент его не получает |
| `MINIAPP_URL` | новая variable/secret | Публичный HTTPS URL статического Mini App, используемый `/start` и setup script |

Не добавляйте реальные значения в Git. Для текущего Worker выполните из `worker/`:

```bash
npx wrangler secret put MINIAPP_TEST_CHAT_ID
npx wrangler secret put MINIAPP_URL
npm run deploy
```

В `MINIAPP_TEST_CHAT_ID` укажите строковый ID тестовой группы, обычно вида `-100…`. В `MINIAPP_URL` укажите итоговый URL с HTTPS, например `https://cosmetology-social-publisher.example.workers.dev/`. Бот должен быть добавлен в destination и иметь право публиковать сообщения и фотографии.

Для локальной разработки скопируйте `worker/.dev.vars.example` в игнорируемый `worker/.dev.vars`. Реальный Telegram не запускает HTTP Mini App URL: для ручного теста нужен публичный HTTPS deploy или tunnel.

## Webhook и кнопка `/start`

Существующий webhook менять не требуется. После deploy команда `/start` отправляет inline-кнопку **«Открыть приложение»** с URL только из `MINIAPP_URL`. Убедитесь, что webhook уже направлен на `POST /api/telegram/webhook`; при необходимости его можно зарегистрировать существующими credentials:

```bash
curl --fail-with-body --request POST \
  "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  --data-urlencode "url=${WORKER_URL}/api/telegram/webhook" \
  --data-urlencode "secret_token=${TELEGRAM_WEBHOOK_SECRET}"
```

## Menu button (ручная одноразовая настройка)

Публичного административного endpoint нет. Запустите script локально из корня репозитория; token передаётся только через environment и не печатается:

```bash
TELEGRAM_BOT_TOKEN='…' \
MINIAPP_URL='https://cosmetology-social-publisher.example.workers.dev/' \
node scripts/set-telegram-menu-button.mjs
```

Script вызывает `setChatMenuButton` и задаёт default menu button. Для URL Mini App также настройте домен бота в BotFather, если Telegram/BotFather запрашивает это для вашего способа запуска.

## Проверка безопасности и публикации

Frontend отправляет исходную строку `Telegram.WebApp.initData` как `Authorization: tma <initData>`. Это отдельная auth scheme, чтобы не смешивать Mini App credential с существующим Google `Bearer`; header автоматически остаётся same-origin. `initDataUnsafe.user` используется только для приветствия.

Worker реализует официальный алгоритм [Validating data received via the Mini App](https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app): HMAC-SHA-256 secret key с `WebAppData`, проверку hash с постоянным временем сравнения и срок `auth_date` 10 минут. Затем endpoint принимает plain text до 4096 символов и одно `image/*` до 10 МБ. Существующий Telegram adapter отправляет caption до 1024 символов, а более длинный текст — отдельным `sendMessage` после фотографии.

Ручной acceptance test:

1. Откройте чат с ботом и отправьте `/start`.
2. Нажмите **«Открыть приложение»**.
3. Выберите фотографию, убедитесь, что появился preview.
4. Введите `Тестовая публикация из Mini App` и нажмите **«Опубликовать»**.
5. Проверьте состояния «Публикуем…» и «Опубликовано», затем наличие фотографии и текста в `MINIAPP_TEST_CHAT_ID`.
6. После успеха форма очищается и готова к следующему посту.
