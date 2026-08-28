# Telegram Mini App: настройка identity и публикации

Mini App использует существующего Google-backed пользователя и его Telegram connection, но не выполняет Google OAuth внутри Telegram. Страница из `miniapp/` публикуется как Worker Static Assets на том же origin, что и API; отдельный CORS origin не требуется.

Identity flow:

```text
Google OAuth в расширении → users.id
  → одноразовый pairing code
  → /connect в Telegram-группе
  → verified message.from.id → telegram_identities.user_id

Telegram Mini App initData.user.id
  → telegram_identities.user_id
  → active telegram_connections.chat_id
  → Telegram Bot API
```

`chat_id`, internal `user_id` и Google identity никогда не передаются в Mini App.

## Cloudflare bindings

| Binding | Тип | Назначение |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | существующий secret | Проверка `initData` и вызов Bot API |
| `TELEGRAM_WEBHOOK_SECRET` | существующий secret | Проверка webhook |
| `PAIRING_CODE_SECRET` | существующий secret | HMAC одноразовых pairing codes |
| `MINIAPP_URL` | variable/secret | Публичный HTTPS URL Mini App для `/start` и menu button |

`MINIAPP_TEST_CHAT_ID` больше не используется: destination всегда определяется из D1 по verified Telegram identity.

Если `MINIAPP_URL` ещё не настроен, выполните из `worker/`:

```bash
npx wrangler secret put MINIAPP_URL
```

## Deployment и migration

После merge из `worker/`:

```bash
npm install
npm run db:migrate
npm run deploy
```

`db:migrate` применит `0003_telegram_identities.sql`. Миграция только добавляет таблицу и не изменяет `users`, существующие `telegram_connections` или Chrome Extension flow.

Старые connections не содержат Telegram user ID и не могут быть надёжно backfill-нуты. Старая connection остаётся active, пока пользователь выполняет безопасный re-link:

1. Авторизоваться в Chrome Extension через Google как раньше.
2. Создать новый pairing code в настройках Telegram.
3. Отправить `/connect XXXXXX` в уже подключённой группе от Telegram administrator/creator.
4. Worker свяжет `message.from.id` с существующим `users.id` и подтвердит connection.

Связь строгая one-to-one. Telegram identity, уже связанная с другим internal user, и internal user, уже связанный с другим Telegram account, не переназначаются автоматически.

## Webhook и кнопки

Существующий webhook остаётся `POST /api/telegram/webhook`. После deploy `/start` возвращает кнопку **«Открыть приложение»** из `MINIAPP_URL`.

При необходимости зарегистрировать webhook:

```bash
curl --fail-with-body --request POST \
  "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  --data-urlencode "url=${WORKER_URL}/api/telegram/webhook" \
  --data-urlencode "secret_token=${TELEGRAM_WEBHOOK_SECRET}"
```

Default menu button устанавливается вручную из корня репозитория, без публичного admin endpoint:

```bash
TELEGRAM_BOT_TOKEN='…' \
MINIAPP_URL='https://cosmetology-social-publisher.buropotok.workers.dev/' \
node scripts/set-telegram-menu-button.mjs
```

## Mini App API

Оба endpoint принимают исходный `Telegram.WebApp.initData`:

```http
Authorization: tma <initData>
```

- `GET /api/miniapp/me` возвращает verified Telegram profile, `linked` и безопасное состояние connection с названием группы. `chat_id`, `users.id` и `google_sub` не возвращаются.
- `POST /api/miniapp/publish` принимает `multipart/form-data` с `text` и необязательным `image`. Destination разрешается только server-side.

Если identity не linked, publish возвращает `403 MINIAPP_IDENTITY_NOT_LINKED`. Если identity linked, но active group отсутствует, возвращается `409 TELEGRAM_NOT_CONNECTED`.

Worker проверяет Telegram initData по официальному алгоритму [Validating data received via the Mini App](https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app), включая HMAC-SHA-256, constant-time hash comparison и TTL `auth_date` 10 минут.

## End-to-end проверка

1. Применить D1 migration и развернуть Worker.
2. В Extension создать новый pairing code для существующего Google account.
3. В целевой группе отправить `/connect XXXXXX` от administrator/creator и получить подтверждение.
4. Открыть бота в личном чате, отправить `/start` и нажать **«Открыть приложение»**.
5. Убедиться, что Mini App показывает `Публикация в: <название группы>`.
6. Выбрать фотографию, проверить preview и ввести `Тестовая публикация из Mini App`.
7. Нажать **«Опубликовать»** и проверить состояния «Публикуем…» и «Опубликовано».
8. Убедиться, что пост появился именно в группе, повторно подключённой на шаге 3.
9. Для negative check открыть Mini App из Telegram account без linking: UI должен показать `Аккаунт ещё не связан`, а публикация должна быть недоступна.
