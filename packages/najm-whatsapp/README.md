# najm-whatsapp

WhatsApp plugin for Najm — supports WhatsApp Cloud API webhooks and Baileys engine (local/legacy WhatsApp).

## Install

```bash
bun add najm-whatsapp
```

Peer dependencies: `najm-auth`, `najm-rate`, `najm-validation`, `hono`, `reflect-metadata`, `zod`.

## Usage

### WhatsApp Cloud API (recommended for production)

```typescript
import { Server } from 'najm-core';
import { whatsapp } from 'najm-whatsapp';

await new Server()
  .use(whatsapp({
    mode: 'cloud',
    cloud: {
      phoneNumberId: process.env.WA_PHONE_NUMBER_ID!,
      accessToken: process.env.WA_ACCESS_TOKEN!,
      verifyToken: process.env.WA_VERIFY_TOKEN!,
      webhookUrl: 'https://your-domain.com/whatsapp/webhook',
    },
  }))
  .listen(3000);
```

### Baileys Engine (local/legacy WhatsApp)

```typescript
await new Server()
  .use(whatsapp({
    mode: 'baileys',
    baileys: {
      sessionId: 'my-whatsapp-session',
    },
  }))
  .listen(3000);
```

## Decorators

### `@OnWhatsApp(event)`

```typescript
import { OnWhatsApp } from 'najm-whatsapp';

@Service()
class OrderService {
  @OnWhatsApp('message')
  async handleMessage(message: WhatsAppIncomingMessage) {
    const { from, body } = message;
    if (body.startsWith('/order')) {
      await this.processOrder(from, body);
    }
  }

  @OnWhatsApp('status')
  async handleStatus(status: WhatsAppStatusEvent) {
    console.log('Message status:', status);
  }
}
```

## Auto-Registered Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/whatsapp/webhook` | GET | Webhook verification (Cloud API) |
| `/whatsapp/webhook` | POST | Incoming messages |
| `/whatsapp/link` | GET | QR code for Baileys pairing |
| `/whatsapp/link/status` | GET | Pairing status |

## Production Notes

- Cloud API mode is recommended — Baileys requires persistent session storage and is not suitable for serverless
- `najm-auth` is required for phone link/unlink flows
- Set `webhookUrl` in cloud config for proper webhook verification
- Phone linking uses `najm-cache` for temporary state — configure Redis for multi-instance deployments