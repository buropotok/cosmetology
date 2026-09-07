# Cosmo Sofa — Telegram Mini App

Cosmo Sofa — Telegram Mini App для подготовки и публикации контента косметологического кабинета. Приложение работает непосредственно внутри Telegram: пользователь открывает Mini App, создаёт или редактирует публикацию, добавляет изображения, использует AI-сценарии подготовки контента и отправляет готовый материал в подключённую Telegram-группу. В проекте также поддерживается публикация во ВКонтакте.

Главный пользовательский продукт этого репозитория — `miniapp/`. Chrome Extension, сохранившийся в `extension/`, является отдельным legacy/companion flow и не требуется для работы Telegram Mini App.

## Что умеет Mini App

- запускается из Telegram через Telegram Web Apps;
- идентифицирует пользователя по проверенному `Telegram.WebApp.initData` без Google OAuth;
- автоматически создаёт внутренний аккаунт при первом входе;
- позволяет создавать и редактировать посты и работать с черновиками;
- поддерживает изображения и сценарий «до/после»;
- содержит AI-flow для подготовки и редактирования публикаций;
- подключает персонального Telegram-бота и группу для публикаций;
- публикует текст и изображения в Telegram;
- поддерживает VK как дополнительный канал публикации;
- хранит состояние, подключения и историю на backend.

## Архитектура

```text
Telegram
  │
  │ Telegram.WebApp.initData
  ▼
miniapp/                         Telegram Mini App UI
  │
  │ HTTPS /api/miniapp/*
  ▼
Cloudflare Worker
  ├─ Telegram auth / initData validation
  ├─ account + onboarding
  ├─ drafts / publishing API
  ├─ Telegram Bot API
  ├─ Managed Bots
  ├─ VK integration
  ├─ D1 — users, identities, connections, posts, drafts
  └─ R2 — images
```

`miniapp/` публикуется как Cloudflare Worker Static Assets. API и статика работают на одном origin. Production Mini App URL задаётся переменной `MINIAPP_URL` в `worker/wrangler.jsonc`.

## Telegram authentication

Mini App не использует собственную форму входа. Источником identity служит Telegram:

```text
Telegram.WebApp.initData
  → server-side HMAC validation
  → verified Telegram user.id
  → telegram_identities
  → users.id
```

Клиент передаёт initData в Mini App API:

```http
Authorization: tma <Telegram.WebApp.initData>
```

Worker проверяет подпись server-side. Новый Telegram user получает внутренний `users.id` автоматически. Клиенту не выдаются внутренний user id, Google subject, Telegram `chat_id`, bot credentials или webhook secrets.

## Telegram publishing flow

Базовый flow подключения группы:

```text
Mini App
  → создать pairing code
  → добавить бота в Telegram-группу
  → /connect XXXXXX
  → Worker проверяет пользователя и права
  → telegram_connections
  → публикация из Mini App
```

Pairing code одноразовый и имеет TTL. Destination публикации определяется только server-side по verified Telegram identity.

Проект также содержит Managed Bot flow: пользователь может подключить персонального Telegram-бота, а затем выбрать группу через `startgroup` deep link. Credentials managed bot хранятся в D1 только в зашифрованном виде AES-256-GCM; plaintext token не сохраняется.

Подробный Telegram setup и security model находятся в `docs/telegram-miniapp-setup.md`.

## Mini App frontend

`miniapp/` — самостоятельный frontend без обязательной сборки framework bundle. Точка входа:

```text
miniapp/index.html
  → telegram-web-app.js
  → bootstrap.js
  → app/router/onboarding/composer modules
```

Основные зоны frontend:

- `bootstrap.js` — последовательная загрузка runtime;
- `app.js`, `app-router.js`, `navigation.js` — shell и навигация;
- `onboarding-*` — первый вход и подключение сервисов;
- `composer-*` — редактор публикации, изображения и действия;
- `draft-*` — сохранение и восстановление черновиков;
- `ai-*` / `publish-ai-*` — AI generation/editing flow;
- `before-after-*` — работа с контентом «до/после»;
- `settings.js` — состояние подключений Telegram/VK;
- `assets/` — изображения и SVG-иконки Mini App.

Telegram Web App SDK подключается непосредственно в `miniapp/index.html`.

## Backend

Backend находится в `worker/` и разворачивается как Cloudflare Worker.

Основные инфраструктурные компоненты:

- **Cloudflare Workers** — HTTP API и server-side business logic;
- **Static Assets** — раздача `miniapp/`;
- **D1** — аккаунты, Telegram identities, connections, managed bots, destinations, posts и drafts;
- **R2** — изображения;
- **Telegram Bot API** — onboarding и публикация;
- **VK API** — дополнительный publishing channel.

Ключевые Mini App endpoints включают:

```text
GET  /api/miniapp/me
POST /api/miniapp/telegram/pairing
POST /api/miniapp/publish
POST /api/miniapp/telegram/managed-bot/group-link
```

В репозитории также есть диагностические и onboarding endpoints для Managed Bots. Их контракт и security requirements описаны в `docs/telegram-miniapp-setup.md`.

## Структура репозитория

```text
miniapp/       Telegram Mini App frontend
worker/        Cloudflare Worker, API, D1/R2, Telegram/VK integrations
shared/        общие контракты
scripts/       operational/setup scripts
docs/          документация по Telegram и инфраструктуре
extension/     отдельный Chrome Extension flow
site/          вспомогательные web assets
```

Mini App и Worker являются основной runtime-парой проекта:

```text
miniapp/ ↔ worker/
```

## Требования

Для разработки и deployment нужны:

- Node.js 20+;
- npm;
- Cloudflare account;
- Wrangler;
- D1 database;
- R2 bucket;
- Telegram bot token;
- Telegram webhook secret;
- encryption key для Managed Bots;
- при использовании VK — соответствующие VK credentials/integration.

## Cloudflare setup

```bash
cd worker
npm install
npx wrangler login
npx wrangler d1 create cosmetology-publisher
npx wrangler r2 bucket create cosmetology-publisher-images
```

Bindings D1/R2 и `MINIAPP_URL` настраиваются в `worker/wrangler.jsonc`. Секреты не должны попадать в Git.

Минимальный набор Telegram secrets:

```bash
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_WEBHOOK_SECRET
npx wrangler secret put PAIRING_CODE_SECRET
```

Для Managed Bots необходим отдельный 32-byte AES key:

```bash
openssl rand -base64 32 | npx wrangler secret put MANAGED_BOT_ENCRYPTION_KEY
```

После настройки:

```bash
npm run db:migrate
npm run deploy
```

## Настройка Telegram Mini App

Production URL Mini App должен быть HTTPS URL Worker, например:

```text
https://<worker>.<subdomain>.workers.dev/
```

Он задаётся как `MINIAPP_URL` и используется для `/start` и Telegram menu button.

Menu button можно установить скриптом из корня репозитория:

```bash
TELEGRAM_BOT_TOKEN='…' \
MINIAPP_URL='https://<worker>.<subdomain>.workers.dev/' \
node scripts/set-telegram-menu-button.mjs
```

Полная процедура первого входа, подключения группы, webhook и Managed Bot onboarding: `docs/telegram-miniapp-setup.md`.

## Локальная разработка

Установить зависимости:

```bash
npm install
```

Для Worker:

```bash
cd worker
cp .dev.vars.example .dev.vars
npm run db:migrate:local
npm run dev
```

Wrangler создаёт локальное состояние D1/R2 в `.wrangler/`.

Mini App использует Telegram `initData`, поэтому полноценную authentication/publishing проверку следует выполнять из реального Telegram WebView или с контролируемым тестовым окружением. Не подменяйте production authentication доверенными client-side user identifiers.

## Проверки

Перед merge рекомендуется выполнять:

```bash
npm install
npm run typecheck
npm test
npm run build
```

В `miniapp/` и `worker/src/` есть отдельные тесты для bootstrap, routing, onboarding, composer, drafts, AI flows и Telegram-related backend behavior.

Для Telegram flow дополнительно вручную проверяются:

1. первый вход новым Telegram account;
2. создание internal account;
3. подключение группы;
4. публикация текста;
5. публикация изображений;
6. сохранение/возврат в draft flow;
7. удаление или отключение бота от группы;
8. невозможность использовать чужой/просроченный pairing payload.

## Deployment

Обычный deployment Worker:

```bash
cd worker
npm install
npm run db:migrate
npm run deploy
```

`worker/wrangler.jsonc` указывает `../miniapp` как Static Assets directory, поэтому frontend Mini App и backend Worker разворачиваются как единое приложение.

Если миграций нет, `db:migrate` можно пропустить.

## Security

Критические правила проекта:

- Telegram identity доверяется только после server-side проверки `initData`;
- destination определяется на сервере, а не принимается как доверенный `chat_id` от клиента;
- pairing codes одноразовые и ограничены по времени;
- webhook проверяется secret token;
- bot tokens и encryption keys хранятся только в secrets/encrypted storage;
- Managed Bot token шифруется AES-256-GCM перед записью в D1;
- raw credentials, webhook secrets и pairing nonce не должны логироваться;
- R2 bucket не используется как публичный directory listing.

## Дополнительные компоненты

`extension/` содержит более ранний/параллельный Chrome Extension workflow для работы с ChatGPT и публикации через тот же backend. Он остаётся частью репозитория, но **не является обязательной частью Telegram Mini App** и не участвует в Telegram-native authentication flow.

При разработке нового пользовательского функционала основным контекстом проекта следует считать:

```text
Telegram → Mini App → Cloudflare Worker → Telegram/VK
```

а не Chrome Extension workflow.
