# Cosmo Sofa — Telegram Mini App

Cosmo Sofa — Telegram Mini App для подготовки и публикации контента косметологического кабинета. Основной интерфейс работает внутри Telegram: пользователь создаёт и редактирует публикации, добавляет изображения, использует AI-сценарии и публикует материалы в Telegram. Для подключения и публикации во ВКонтакте проект использует отдельный VK Mini App, размещённый в Yandex Cloud.

Главный пользовательский продукт — `miniapp/`. Chrome Extension в `extension/` является отдельным legacy/companion flow и не требуется для работы Telegram Mini App.

## Что умеет Mini App

- запускается из Telegram через Telegram Web Apps;
- идентифицирует пользователя по проверенному `Telegram.WebApp.initData` без Google OAuth;
- автоматически создаёт внутренний аккаунт при первом входе;
- позволяет создавать и редактировать посты и работать с черновиками;
- поддерживает изображения и сценарий «до/после»;
- содержит AI-flow для подготовки и редактирования публикаций;
- подключает персонального Telegram-бота и группу для публикаций;
- публикует текст и изображения в Telegram;
- подключает VK-группу через отдельный VK Mini App;
- передаёт публикацию из Cloudflare-контура в Yandex Cloud для VK-flow;
- хранит основное состояние пользователя, подключения и историю в Cloudflare backend.

## Архитектура

Проект использует два связанных инфраструктурных контура: Cloudflare для основного Telegram Mini App и состояния приложения, и Yandex Cloud для VK Mini App и VK-specific операций.

```text
Telegram
  │
  │ Telegram.WebApp.initData
  ▼
miniapp/ — Telegram Mini App UI
  │
  │ HTTPS /api/miniapp/*
  ▼
Cloudflare Worker
  ├─ Telegram auth / initData validation
  ├─ account + onboarding
  ├─ drafts / publishing API
  ├─ Telegram Bot API / Managed Bots
  ├─ D1 — users, identities, connections, posts, drafts
  ├─ R2 — source images
  │
  │ user context / VK onboarding / publication handoff
  ▼
Yandex Cloud
  ├─ API Gateway
  ├─ serverless VK backend
  ├─ Yandex Object Storage — replicated publication artifacts/images
  └─ VK Mini App
        │
        ├─ VK Bridge authentication
        ├─ groups.get — группы, которыми управляет пользователь
        ├─ выбор VK-группы → callback в Cloudflare
        └─ VK publishing flow
```

`miniapp/` публикуется как Cloudflare Worker Static Assets. Telegram Mini App API и статика работают на одном origin. Production URL задаётся через `MINIAPP_URL` в `worker/wrangler.jsonc`.

Cloudflare Worker знает адрес Yandex VK-контура через `YANDEX_VK_BASE_URL`. Это не просто внешний VK API: Yandex Cloud является отдельной частью runtime-архитектуры проекта.

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

```text
Mini App
  → создать pairing code
  → добавить бота в Telegram-группу
  → /connect XXXXXX
  → Worker проверяет пользователя и права
  → telegram_connections
  → публикация из Mini App
```

Pairing code одноразовый и имеет TTL. Destination определяется server-side по verified Telegram identity.

Проект также содержит Managed Bot flow: пользователь может подключить персонального Telegram-бота, а затем выбрать группу через `startgroup` deep link. Credentials managed bot хранятся в D1 только в зашифрованном виде AES-256-GCM; plaintext token не сохраняется.

Подробный Telegram setup и security model: `docs/telegram-miniapp-setup.md`.

## VK Mini App и Yandex Cloud

VK-интеграция построена как отдельный Mini App flow, а не как прямой вызов VK API из Cloudflare Worker.

Код контура находится в `yandex/vk/`:

```text
yandex/vk/
  ├─ miniapp/    VK Mini App frontend
  ├─ function/   serverless backend для VK/artifact flow
  └─ gateway/    конфигурация Yandex API Gateway
```

### Подключение VK-группы

Telegram Mini App инициирует VK onboarding и передаёт одноразовый handoff/connect context. Пользователь открывает VK Mini App, размещённый в Yandex Cloud. VK Mini App выполняет `VKWebAppInit`, получает VK authorization через VK Bridge и запрашивает `groups.get` с `filter=admin`, то есть показывает группы, которыми пользователь может управлять.

После выбора группы VK Mini App передаёт в callback Cloudflare-контура VK user context и выбранную группу (`vkUserId`, `groupId`, `groupName`, `screenName`). Таким образом, VK identity/group selection связываются с уже существующим пользователем Cosmo Sofa в основном Cloudflare backend.

```text
Telegram user / Cosmo Sofa account
        │
        ▼
Cloudflare Worker
        │ one-time connect context
        ▼
VK Mini App @ Yandex Cloud
        │ VK Bridge + groups.get
        ▼
VK user выбирает группу
        │ callback: VK user + selected group
        ▼
Cloudflare Worker
        │
        └─ сохраняет связь пользователя с VK destination
```

### Публикация в VK

Cloudflare остаётся source of truth для публикации и исходных изображений. Для VK-публикации формируется временный artifact/handoff. Yandex backend получает metadata публикации и забирает изображения из Cloudflare R2, после чего хранит реплику в Yandex Object Storage.

```text
Cloudflare D1/R2
  │ publication artifact + temporary handoff
  ▼
Yandex Cloud Function
  │ replicate images
  ▼
Yandex Object Storage
  │
  ▼
VK Mini App
  ├─ получает artifact
  ├─ получает VK access token через VK Bridge
  ├─ загружает изображения через VK wall upload flow
  └─ открывает/выполняет публикацию в выбранную VK-группу
```

Yandex backend валидирует handoff, ограничивает типы/размер изображений и разрешённые VK upload URL. Handoff является временным транспортным механизмом; постоянная пользовательская модель остаётся в Cloudflare-контуре.

## Mini App frontend

`miniapp/` — основной Telegram frontend без обязательной сборки framework bundle:

```text
miniapp/index.html
  → telegram-web-app.js
  → bootstrap.js
  → app/router/onboarding/composer modules
```

Основные зоны frontend:

- `bootstrap.js` — загрузка runtime;
- `app.js`, `app-router.js`, `navigation.js` — shell и навигация;
- `onboarding-*` — первый вход и подключения;
- `composer-*` — редактор публикации и изображения;
- `draft-*` — черновики;
- `ai-*` / `publish-ai-*` — AI generation/editing flow;
- `before-after-*` — контент «до/после»;
- `settings.js` — состояние Telegram/VK подключений;
- `assets/` — изображения и SVG-иконки.

VK Mini App имеет отдельный frontend в `yandex/vk/miniapp/` и использует VK Bridge.

## Backend и инфраструктура

### Cloudflare

- **Cloudflare Workers** — основной HTTP API и business logic;
- **Static Assets** — Telegram Mini App `miniapp/`;
- **D1** — аккаунты, identities, connections, managed bots, destinations, posts и drafts;
- **R2** — исходные изображения и handoff source для VK;
- **Telegram Bot API** — onboarding и публикация.

Ключевые Mini App endpoints:

```text
GET  /api/miniapp/me
POST /api/miniapp/telegram/pairing
POST /api/miniapp/publish
POST /api/miniapp/telegram/managed-bot/group-link
```

### Yandex Cloud

Yandex-контур обслуживает VK-specific часть системы:

- hosting/runtime VK Mini App;
- API Gateway;
- serverless function для artifact replication и VK upload/publishing helpers;
- Object Storage для временной российской реплики изображений публикации;
- обмен onboarding/publishing context с Cloudflare Worker.

Cloudflare и Yandex — части одной системы, а не независимые приложения.

## Структура репозитория

```text
miniapp/       Telegram Mini App frontend
worker/        Cloudflare Worker, D1/R2, Telegram и cross-cloud orchestration
yandex/vk/     VK Mini App + Yandex Cloud Function/API Gateway
shared/        общие контракты
scripts/       operational/setup scripts
docs/          документация
extension/     отдельный Chrome Extension flow
site/          вспомогательные web assets
```

Основной runtime:

```text
Telegram → Telegram Mini App → Cloudflare
                               ↕
                         Yandex Cloud → VK Mini App → VK
```

## Требования

Для разработки и deployment нужны Node.js 20+, npm, Cloudflare account/Wrangler, D1, R2, Telegram bot credentials, encryption key для Managed Bots, а для VK-контура — VK Mini App configuration и Yandex Cloud resources (Function, API Gateway и Object Storage).

## Cloudflare setup

```bash
cd worker
npm install
npx wrangler login
npx wrangler d1 create cosmetology-publisher
npx wrangler r2 bucket create cosmetology-publisher-images
```

Bindings D1/R2, `MINIAPP_URL` и `YANDEX_VK_BASE_URL` настраиваются в `worker/wrangler.jsonc`. Секреты не должны попадать в Git.

Минимальный набор Telegram secrets:

```bash
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_WEBHOOK_SECRET
npx wrangler secret put PAIRING_CODE_SECRET
openssl rand -base64 32 | npx wrangler secret put MANAGED_BOT_ENCRYPTION_KEY
```

## Настройка Telegram Mini App

Production URL Mini App — HTTPS URL Worker. Он задаётся как `MINIAPP_URL` и используется для `/start` и Telegram menu button.

```bash
TELEGRAM_BOT_TOKEN='…' \
MINIAPP_URL='https://<worker>.<subdomain>.workers.dev/' \
node scripts/set-telegram-menu-button.mjs
```

## Локальная разработка

```bash
npm install
cd worker
cp .dev.vars.example .dev.vars
npm run db:migrate:local
npm run dev
```

Полноценные Telegram и VK authentication/publishing flows следует проверять внутри соответствующих Telegram/VK WebView, поскольку identity и authorization поступают от платформенных SDK.

## Проверки

Перед merge:

```bash
npm install
npm run typecheck
npm test
npm run build
```

Кроме автоматических тестов вручную проверяются Telegram onboarding/publishing, VK onboarding через `groups.get`, корректная привязка выбранной VK-группы к пользователю Cloudflare, handoff Cloudflare → Yandex, репликация изображений и публикация через VK Mini App.

## Deployment

Cloudflare Worker:

```bash
cd worker
npm install
npm run db:migrate
npm run deploy
```

`worker/wrangler.jsonc` указывает `../miniapp` как Static Assets directory, поэтому Telegram frontend и основной backend разворачиваются вместе.

VK-контур разворачивается отдельно в Yandex Cloud из компонентов `yandex/vk/`; его публичный API base URL передаётся Cloudflare через `YANDEX_VK_BASE_URL`.

## Security

- Telegram identity доверяется только после server-side проверки `initData`;
- Telegram destination определяется server-side;
- pairing codes и cross-cloud handoff tokens одноразовые/временные;
- webhook проверяется secret token;
- bot tokens и encryption keys не хранятся в Git;
- Managed Bot token шифруется AES-256-GCM перед записью в D1;
- VK access token получается внутри VK Mini App через VK Bridge и не является постоянной Cloudflare identity;
- Cloudflare ↔ Yandex служебный обмен защищается отдельной server-to-server авторизацией;
- Yandex принимает R2 source URL только из разрешённого Cloudflare R2 домена и VK upload URL только с разрешённых VK hosts;
- raw credentials и handoff secrets не должны логироваться.

## Дополнительные компоненты

`extension/` содержит более ранний/параллельный Chrome Extension workflow. Он остаётся частью репозитория, но не является обязательной частью Telegram-native flow.

При разработке нового функционала основной контекст проекта:

```text
Telegram → Mini App → Cloudflare ↔ Yandex Cloud → VK Mini App → VK
```
