# Telegram account connection: development setup

The extension identifies a person through Chrome Identity and sends the short-lived Google OAuth access token to the Worker. The Worker verifies it with Google's `tokeninfo` endpoint, validates `aud`, `sub`, and expiry, and maps `sub` to an opaque D1 user. Tokens are never stored in D1. The committed manifest `key` is a **public** extension key, not a private key or credential; it keeps the unpacked extension ID stable.

## 1. Google Cloud

1. Create a Google Cloud project and configure the OAuth consent screen. Keep the app in testing and add the Google accounts used for development when Google requires test users.
2. Create an OAuth client of type **Chrome Extension**. Load `extension/dist` once and copy the stable ID from `chrome://extensions`; the committed public manifest key makes that ID repeatable.
3. Use only the `openid` scope. Gmail, Drive, Contacts, and other product scopes are not required.
4. Build with the public client ID and Worker URL:
   ```bash
   GOOGLE_OAUTH_CLIENT_ID='123.apps.googleusercontent.com' \
   WORKER_BASE_URL='https://your-worker.workers.dev' npm run build -w extension
   ```
5. Load `extension/dist` with **Load unpacked**. Never commit OAuth client secrets. A Chrome Extension OAuth client does not require a client secret in this extension.
6. Put the resulting `chrome-extension://<stable-id>` into `ALLOWED_EXTENSION_ORIGIN` in Worker configuration.

The source manifest contains a non-working development client ID placeholder; every real build must supply `GOOGLE_OAUTH_CLIENT_ID`.

## 2. Cloudflare and D1

Apply migrations and configure environment values:

```bash
npm run db:migrate -w worker
wrangler secret put TELEGRAM_BOT_TOKEN
wrangler secret put TELEGRAM_WEBHOOK_SECRET
wrangler secret put PAIRING_CODE_SECRET
```

Set `GOOGLE_OAUTH_CLIENT_ID` and `ALLOWED_EXTENSION_ORIGIN` as Worker vars (use separate values/configurations for development and production). `PAIRING_CODE_SECRET` should be a random high-entropy value. `TELEGRAM_BOT_TOKEN` and webhook/pairing secrets exist only in Worker secrets. The old `PUBLISH_API_TOKEN` and `TELEGRAM_CHAT_ID` are no longer product inputs.

For local Worker development, apply `npm run db:migrate:local -w worker` and put non-production values in `worker/.dev.vars` (never commit that file). Because Google calls the Worker over HTTPS in normal testing, `wrangler dev --remote` or a deployed development Worker is usually simplest.

## 3. Telegram bot and webhook

Create the bot in BotFather. Privacy Mode may remain enabled: Telegram delivers explicit bot commands in groups. Register the single Worker webhook with a secret token:

```bash
curl -X POST "https://api.telegram.org/bot$TG_BOT_TOKEN/setWebhook" \
  -d "url=https://your-worker.workers.dev/api/telegram/webhook" \
  -d "secret_token=$TELEGRAM_WEBHOOK_SECRET" \
  -d 'allowed_updates=["message"]'
```

The Worker checks `X-Telegram-Bot-Api-Secret-Token`. Do not place either secret in the extension, browser storage, logs, or documentation.

## 4. End-to-end check

1. Deploy/start the Worker and load the built unpacked extension.
2. Open **Settings → Telegram → Connect Telegram** and accept Google consent if Chrome requests it.
3. On a phone, add the bot to the target group and send the displayed `/connect 123456` command as a group administrator/creator.
4. The extension polls for up to the ten-minute code lifetime and automatically shows the group title.
5. Publish a Telegram post. The request contains no `chat_id`; the Worker resolves the active destination for the authenticated D1 user.
6. Load the same build in another Chrome profile/computer signed into the same Google account to verify that the same connection appears. A different Google account maps to a different internal user.

Changing a group creates a new pending code without disabling the old group. The old destination is replaced only after a valid administrator command. Disconnect marks the server connection inactive; it does not remove the bot from Telegram.

## Current history limitation

New API history reads are scoped to authenticated users, and new posts store `user_id`. The legacy `/history.txt` prompt feed remains public/global for compatibility with ChatGPT's unauthenticated URL retrieval. Moving that feed to a user-authorized retrieval mechanism is a separate migration and should happen before treating it as private account history.
