# najm-whatsapp

WhatsApp plugin for Najm — supports WhatsApp Cloud API webhooks and the Baileys
runtime (local QR-paired WhatsApp). All runtime events flow through a single
typed pipeline; AI replies, auto-replies, and webhook fan-out all subscribe to
it.

## Install

```bash
bun add najm-whatsapp
```

Peer dependencies: `najm-auth`, `najm-rate`, `najm-validation`, `hono`,
`reflect-metadata`, `zod`.

## Quick start

### Cloud API (recommended for production)

```typescript
import { Server } from 'najm-core';
import { whatsapp } from 'najm-whatsapp';

await new Server()
  .use(whatsapp({
    mode: 'cloud',
    phoneNumberId: process.env.WA_PHONE_NUMBER_ID!,
    accessToken: process.env.WA_ACCESS_TOKEN!,
    verifyToken: process.env.WA_VERIFY_TOKEN!,
    webhookSecret: process.env.WA_WEBHOOK_SECRET!,
  }))
  .listen(3000);
```

### Baileys runtime (local QR pairing)

```typescript
import { Server } from 'najm-core';
import { database } from 'najm-database';
import { auth } from 'najm-auth';
import { events } from 'najm-event';
import { validation } from 'najm-validation';
import { cache } from 'najm-cache';
import { whatsapp } from 'najm-whatsapp';

await new Server()
  .use(events())
  .use(cache())
  .use(database({ default: db }))
  .use(auth({ /* … */ }))
  .use(validation())
  .use(whatsapp({
    mode: 'baileys',
    dialect: 'sqlite',                       // 'sqlite' | 'pg' | 'mysql'
    sessions: { driver: 'db' },              // or 'file' for local files
    webhooks: [
      { url: 'https://example.com/wh', events: ['message'] },
    ],
    webhookSigningSecret: process.env.WA_HOOK_SECRET,
    studioApi: true,
  }))
  .listen(3000);
```

The Baileys runtime requires a serverful deployment with persistent storage.
Session credentials are stored either in the database (`driver: 'db'`) or on
the local filesystem (`driver: 'file'`). On boot, all rows with
`autoConnect = true` are rehydrated and reconnected.

## Event pipeline

All runtime events are normalized into one payload shape and emitted on the
following names:

| Event                | Emitted on                |
|----------------------|---------------------------|
| `whatsapp.message`   | Inbound + persisted        |
| `whatsapp.status`    | Cloud delivery status      |
| `whatsapp.connection`| Baileys connection state  |
| `whatsapp.group`     | Baileys group updates      |
| `whatsapp.presence`  | Baileys presence changes   |

The message payload includes `instanceId`, `jid`, `from` (alias for incoming
messages), `fromMe`, `text`, `messageId`, `type`, `timestamp` (ISO), and
`raw`. Cloud mode sets `instanceId` to `phoneNumberId`; Baileys mode uses
the instance id from `InstanceManager`.

### Subscribing to events

```typescript
import { On } from 'najm-event';
import { OnWhatsApp } from 'najm-whatsapp';

@Service()
class OrderService {
  @OnWhatsApp('message')
  async onMessage(event: WhatsAppMessageEvent) {
    if (event.text?.startsWith('/order')) {
      await this.processOrder(event.instanceId, event.jid, event.text);
    }
  }
}
```

## Auto-reply

Auto-reply rules are stored per instance in `whatsapp_auto_reply_rules`.
Regex rules are compiled with [RE2](https://github.com/le0pard/re2js) (RE2JS)
so they cannot block the event loop on catastrophic backtracking. Text input
is capped to 4 KB before matching.

```typescript
const rule = await autoReplyService.createRule({
  instanceId: 'support-1',
  pattern: '^price',
  response: 'See https://example.com/pricing',
  matchType: 'prefix',
});
```

## AI responder

Configure per instance with `ai: { enabled, provider, model, limits }`. The
service enforces:

- per-minute and per-day request caps (default 20 / 500 per instance)
- fetch timeouts (`timeoutMs`, default 10 s)
- input truncation to `maxInputChars` (default 4 096)
- structured error logs that do not include API keys or message bodies

```typescript
await aiService.upsertConfig({
  instanceId: 'support-1',
  enabled: true,
  provider: 'openai',
  model: 'gpt-4o-mini',
  limits: { requestsPerMinute: 30, requestsPerDay: 1000 },
});
```

## Webhooks

Configure a signing secret and the forwarder will HMAC-SHA256 the body of
every outbound delivery. The signature lands on
`x-najm-signature-256: sha256=<hex>`. Receivers must use a constant-time
comparison and reject the request if the timestamp or delivery id is stale.

```typescript
import { verifyWebhookSignature } from 'najm-whatsapp';

const ok = verifyWebhookSignature(rawBody, request.headers['x-najm-signature-256'], secret);
if (!ok) return new Response('invalid signature', { status: 401 });
```

The forwarder rejects loopback, RFC1918, link-local, and multicast addresses
by default. Disable that policy with `webhookSecurity.allowPrivateNetworks`
or restrict to specific hosts with `webhookSecurity.allowedHosts`. User
headers cannot override the protected headers
(`content-type`, `x-najm-signature-256`, `x-najm-delivery-id`,
`x-najm-timestamp`).

## Studio

When `studioApi: true`, the plugin auto-registers the Studio controllers
under `/wa-studio/...`:

| Route                            | Purpose                          |
|----------------------------------|----------------------------------|
| `GET /wa-studio/instances`       | list instances with counts       |
| `POST /wa-studio/instances`      | create instance                  |
| `GET /wa-studio/instances/dashboard` | aggregate dashboard         |
| `GET /wa-studio/instances/:id/qr`| current pairing QR               |
| `GET /wa-studio/messages/:id/:jid` | message history               |
| `GET /wa-studio/settings`       | sessions + webhook count         |
| `GET /wa-studio/webhooks`        | list subscribers                 |
| `POST /wa-studio/webhooks/test`  | send a single test event         |
| `GET /wa-studio/auto-reply/:id`  | list auto-reply rules            |

The Studio dashboard reads real aggregates from the database — no fabricated
metrics. The settings page reports `staticWebhookCount + dynamic count`
so the displayed total matches the actual subscribers.

## Persistence

Schemas live in `najm-whatsapp/sqlite`, `najm-whatsapp/pg`, and
`najm-whatsapp/mysql`. Spread one into your application schema:

```typescript
import { waSchema } from 'najm-whatsapp/sqlite';

export const schema = {
  ...authSchema,
  ...waSchema,
  // your tables
};
```

The `whatsapp_instances` table now carries `auto_connect` and `last_error`
columns, and `whatsapp_ai_configs` carries a `limits` JSON column. Apply the
migration before booting the plugin; the existing `whatsapp_webhook_events`,
`whatsapp_sessions`, and `whatsapp_session_keys` tables are unchanged.

The `whatsapp_webhooks` table now carries an optional `signing_secret` column
for per-webhook HMAC-SHA256 overrides. If you already deployed an older
schema, add the column with a default of `NULL`.

## Production notes

- Cloud API mode is recommended for production. Baileys requires a serverful
  deployment with persistent storage.
- The Baileys runtime keeps WebSocket buffers in pure-JS mode (no
  `bufferutil`) to stay compatible with Next server bundles.
- The OTP verification in `PhoneLinkService` uses constant-time
  comparison.
- All Cloud API fetches are bounded by `AbortSignal.timeout`.
