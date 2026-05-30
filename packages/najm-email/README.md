# najm-email

Email plugin for Najm API framework with multi-provider support.

## Features

- **Multi-Provider Support**: SMTP, Resend, SendGrid, Mailgun, SES, Postmark
- **Development Providers**: Console (logs to console), Memory (for testing)
- **Bulk Sending**: Send multiple emails efficiently
- **Retry Support**: Automatic retry on failures
- **Event System**: Hook into email lifecycle events
- **Type Safety**: Full TypeScript support
- **Attachments**: Support for file attachments
- **HTML & Text**: Send both HTML and plain text emails

## Installation

```bash
bun add najm-email
```

## Quick Start

### Basic Setup

```typescript
import { Server } from 'najm-core';
import { email } from 'najm-email';

const server = new Server()
  .use(email({
    provider: {
      provider: 'resend',
      apiKey: process.env.RESEND_API_KEY!,
    },
    defaultFrom: 'noreply@example.com',
  }))
  .listen(3000);
```

### Using in Services

```typescript
import { Service } from 'najm-core';
import { EmailService } from 'najm-email';

@Service()
export class NotificationService {
  constructor(private email: EmailService) {}

  async sendWelcomeEmail(user: { email: string; name: string }) {
    await this.email.send({
      to: user.email,
      subject: 'Welcome!',
      html: `<h1>Welcome, ${user.name}!</h1>`,
    });
  }
}
```

## Providers

### Resend

```typescript
email({
  provider: {
    provider: 'resend',
    apiKey: process.env.RESEND_API_KEY!,
  },
  defaultFrom: 'noreply@example.com',
})
```

### SMTP

```typescript
email({
  provider: {
    provider: 'smtp',
    host: 'smtp.gmail.com',
    port: 587,
    auth: {
      user: process.env.SMTP_USER!,
      pass: process.env.SMTP_PASS!,
    },
  },
  defaultFrom: 'noreply@example.com',
})
```

### SendGrid

```typescript
email({
  provider: {
    provider: 'sendgrid',
    apiKey: process.env.SENDGRID_API_KEY!,
    sandboxMode: false, // Set to true for testing
  },
  defaultFrom: 'noreply@example.com',
})
```

### Console (Development)

```typescript
email({
  provider: {
    provider: 'console',
    logLevel: 'debug', // 'info' | 'debug'
  },
  defaultFrom: 'dev@localhost',
})
```

### Memory (Testing)

```typescript
import { email, MemoryProvider } from 'najm-email';

const server = new Server()
  .use(email({
    provider: { provider: 'memory' },
  }));

// In tests
const emailService = container.get(EmailService);
const memoryProvider = emailService.getProvider<MemoryProvider>();

// Assert emails were sent
expect(memoryProvider.assertSentTo('user@example.com')).toBe(true);
expect(memoryProvider.getEmailCount()).toBe(1);
```

## API Reference

### EmailService Methods

#### `send(message: EmailMessage): Promise<SendResult>`

Send a single email.

```typescript
const result = await emailService.send({
  to: 'user@example.com',
  subject: 'Hello',
  text: 'Plain text content',
  html: '<p>HTML content</p>',
});

if (result.success) {
  console.log('Sent:', result.messageId);
} else {
  console.error('Failed:', result.error);
}
```

#### `sendBulk(messages: EmailMessage[]): Promise<BulkSendResult>`

Send multiple emails.

```typescript
const result = await emailService.sendBulk([
  { to: 'user1@example.com', subject: 'Hello 1', text: 'Hi!' },
  { to: 'user2@example.com', subject: 'Hello 2', text: 'Hi!' },
]);

console.log(`Sent: ${result.sent}, Failed: ${result.failed}`);
```

#### `sendText(to, subject, text, from?): Promise<SendResult>`

Convenience method for text emails.

```typescript
await emailService.sendText(
  'user@example.com',
  'Subject',
  'Plain text content'
);
```

#### `sendHtml(to, subject, html, from?): Promise<SendResult>`

Convenience method for HTML emails.

```typescript
await emailService.sendHtml(
  'user@example.com',
  'Subject',
  '<h1>HTML content</h1>'
);
```

### EmailMessage Interface

```typescript
interface EmailMessage {
  // Recipients
  to: string | EmailAddress | (string | EmailAddress)[];
  cc?: string | EmailAddress | (string | EmailAddress)[];
  bcc?: string | EmailAddress | (string | EmailAddress)[];
  
  // Sender
  from?: string | EmailAddress;
  replyTo?: string | EmailAddress;
  
  // Content
  subject: string;
  text?: string;
  html?: string;
  
  // Attachments
  attachments?: EmailAttachment[];
  
  // Metadata
  headers?: Record<string, string>;
  priority?: 1 | 3 | 5; // 1=high, 3=normal, 5=low
  tags?: string[];
  metadata?: Record<string, any>;
}

interface EmailAddress {
  email: string;
  name?: string;
}

interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType?: string;
  cid?: string; // For inline images
  disposition?: 'attachment' | 'inline';
}
```

## Events

Subscribe to email lifecycle events:

```typescript
@Service()
export class EmailLogger {
  constructor(private email: EmailService) {}

  onInit() {
    this.email.on('email:sending', ({ message }) => {
      console.log('Sending to:', message.to);
    });

    this.email.on('email:sent', ({ message, result }) => {
      console.log('Sent:', result.messageId);
    });

    this.email.on('email:failed', ({ message, error }) => {
      console.error('Failed:', error.message);
    });
  }
}
```

## Configuration

```typescript
interface EmailConfig {
  // Provider configuration (required)
  provider: ProviderConfig;
  
  // Default sender (optional)
  defaultFrom?: string | EmailAddress;
  
  // Default reply-to (optional)
  defaultReplyTo?: string | EmailAddress;
  
  // Enable debug logging (optional)
  debug?: boolean;
  
  // Retry configuration (optional)
  retry?: {
    attempts?: number; // Default: 1
    delay?: number;    // Default: 1000ms
  };
}
```

## Integration with Auth Plugin

Use email for password reset, verification, etc:

```typescript
import { Service } from 'najm-core';
import { EmailService } from 'najm-email';
import { TokenService } from 'najm-auth';

@Service()
export class PasswordResetService {
  constructor(
    private email: EmailService,
    private token: TokenService,
  ) {}

  async sendResetEmail(user: { id: string; email: string }) {
    // Generate reset token
    const resetToken = await this.token.generatePasswordResetToken(user.id);
    
    // Send email
    await this.email.send({
      to: user.email,
      subject: 'Reset Your Password',
      html: `
        <h1>Password Reset</h1>
        <p>Click the link below to reset your password:</p>
        <a href="https://example.com/reset?token=${resetToken}">
          Reset Password
        </a>
      `,
    });
  }
}
```

## Testing

Use the MemoryProvider for testing:

```typescript
import { describe, test, expect, beforeEach } from 'bun:test';
import { Server } from 'najm-core';
import { email, EmailService, MemoryProvider } from 'najm-email';

describe('Email Tests', () => {
  let server: Server;
  let emailService: EmailService;
  let memoryProvider: MemoryProvider;

  beforeEach(async () => {
    server = new Server({ isolated: true })
      .use(email({ provider: { provider: 'memory' } }));
    
    await server.listen(3100);
    
    emailService = server.container.get(EmailService);
    memoryProvider = emailService.getProvider<MemoryProvider>();
  });

  test('should send welcome email', async () => {
    await emailService.send({
      to: 'user@example.com',
      subject: 'Welcome',
      text: 'Welcome to our app!',
    });

    expect(memoryProvider.assertSentTo('user@example.com')).toBe(true);
    expect(memoryProvider.assertSentWithSubject('Welcome')).toBe(true);
  });
});
```

## Custom Providers

Create custom providers by extending `BaseProvider`:

```typescript
import { BaseProvider, EmailMessage, SendResult } from 'najm-email';

export class MyCustomProvider extends BaseProvider {
  readonly name = 'custom';

  async initialize(): Promise<void> {
    // Initialize your provider
  }

  async send(message: EmailMessage): Promise<SendResult> {
    // Implement sending logic
    return this.success('message-id-123');
  }
}
```

## License

MIT
