# Telegram Mini App: автономная настройка

Telegram Mini App — самостоятельный продукт. Для первого входа, создания internal account, подключения группы и публикации не требуются Chrome Extension или Google OAuth.

```text
Telegram.WebApp.initData
  → server-side HMAC validation
  → verified Telegram user.id
  → telegram_identities
  → users.id (создаётся автоматически при первом входе)
  → active telegram_connections.chat_id
  → Telegram Bot API
```

Chrome Extension продолжает независимо использовать Google OAuth и те же core `users.id`.

## Cloudflare bindings

| Binding | Тип | Назначение |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | существующий secret | Проверка initData и вызов Bot API |
| `TELEGRAM_WEBHOOK_SECRET` | существующий secret | Проверка webhook |
| `PAIRING_CODE_SECRET` | существующий secret | HMAC одноразовых pairing codes |
| `MINIAPP_URL` | variable/secret | Публичный HTTPS URL Mini App для `/start` и menu button |

Если `MINIAPP_URL` ещё не настроен:

```bash
cd worker
npx wrangler secret put MINIAPP_URL
```

## Migration и deployment

После merge Cloudflare применяет migrations перед deploy. Для ручного запуска из `worker/`:

```bash
npm install
npm run db:migrate
npm run deploy
```

Новая `0004_telegram_native_users.sql`:

- сохраняет существующих Google users и связанные connections/pairings/identities;
- делает `users.google_sub` nullable, не создавая synthetic Google subjects;
- добавляет nullable `telegram_pairings.telegram_user_id` для ownership Mini App codes;
- оставляет старый Extension pairing совместимым.

## Первый вход и подключение группы

1. Пользователь открывает Mini App из Telegram.
2. `GET /api/miniapp/me` проверяет initData.
3. Если Telegram identity новая, Worker атомарно создаёт `users(id, google_sub=NULL)` и `telegram_identities`.
4. Если active group отсутствует, Mini App показывает onboarding без скрытия editor shell.
5. Пользователь нажимает **«Подключить Telegram-группу»**.
6. `POST /api/miniapp/telegram/pairing` создаёт одноразовый code с TTL 10 минут, принадлежащий verified Telegram user.
7. Пользователь добавляет бота в группу, выдаёт необходимые права и отправляет `/connect XXXXXX`.
8. Webhook проверяет secret, pending/non-expired code, совпадение sender с владельцем code и роль administrator/creator.
9. После успеха пользователь нажимает **«Проверить подключение»** и видит `Публикация в: <chatTitle>`.

Pairing code одноразовый. Создание нового code отменяет предыдущий pending code этого account.

## API

Все Mini App endpoint принимают только:

```http
Authorization: tma <Telegram.WebApp.initData>
```

- `GET /api/miniapp/me` — автоматически resolve/create account и возвращает Telegram profile, `accountReady` и безопасное состояние connection.
- `POST /api/miniapp/telegram/pairing` — создаёт Telegram-owned pairing code без Google auth.
- `POST /api/miniapp/publish` — принимает `multipart/form-data` (`text`, необязательный `image`).

Mini App API не принимает и не возвращает internal `users.id`, `google_sub` или `chat_id`. Destination публикации разрешается только server-side через verified Telegram identity и active D1 connection.

## Существующий Extension flow

Без изменений остаются:

```text
Google Bearer token → google_sub → users.id
POST /api/telegram/pairing
/connect → telegram_connections
POST /api/publish
```

Legacy Extension pairing имеет `telegram_user_id=NULL`: во время `/connect` он может, как раньше, впервые связать verified sender с Google-backed internal user. Mini App pairing всегда имеет owner и не может быть использован другим Telegram user.

## Webhook и menu button

Webhook остаётся `POST /api/telegram/webhook`. `/start` возвращает кнопку из `MINIAPP_URL`.

Default menu button устанавливается вручную из корня репозитория:

```bash
TELEGRAM_BOT_TOKEN='…' \
MINIAPP_URL='https://cosmetology-social-publisher.buropotok.workers.dev/' \
node scripts/set-telegram-menu-button.mjs
```

## End-to-end проверка с новым Telegram account

1. Применить migration и развернуть Worker.
2. Открыть бота новым Telegram account и отправить `/start`.
3. Открыть Mini App; editor должен отобразиться сразу, а account создаться автоматически.
4. Нажать **«Подключить Telegram-группу»** и получить `/connect XXXXXX`.
5. Добавить бота в тестовую группу и выдать права отправлять сообщения и фотографии.
6. От того же Telegram account отправить команду в группе.
7. Проверить сообщение `Группа подключена`.
8. В Mini App нажать **«Проверить подключение»** и увидеть название группы.
9. Выбрать фотографию, ввести `Тестовая публикация из Mini App` и опубликовать.
10. Убедиться, что пост появился именно в подключённой группе.
11. Negative check: отправить свежий code от другого Telegram user — Worker должен отказать до admin check.
