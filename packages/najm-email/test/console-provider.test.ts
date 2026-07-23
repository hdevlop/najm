import { describe, test, expect, beforeEach } from 'bun:test';
import { ConsoleProvider } from '../src/providers/ConsoleProvider';

describe('ConsoleProvider', () => {
  let provider: ConsoleProvider;

  beforeEach(async () => {
    provider = new ConsoleProvider({ provider: 'console', logLevel: 'info' });
    await provider.initialize();
  });

  test('should send email and return success', async () => {
    const result = await provider.send({
      to: 'user@example.com',
      subject: 'Test Subject',
      text: 'Hello, World!',
    });

    expect(result.success).toBe(true);
    expect(result.messageId).toBeDefined();
  });

  test('should handle HTML content', async () => {
    const result = await provider.send({
      to: 'user@example.com',
      subject: 'HTML Email',
      html: '<h1>Hello</h1><p>This is HTML content</p>',
    });

    expect(result.success).toBe(true);
  });

  test('should handle attachments', async () => {
    const result = await provider.send({
      to: 'user@example.com',
      subject: 'With Attachment',
      text: 'See attached file',
      attachments: [
        {
          filename: 'test.txt',
          content: 'Hello from attachment',
          contentType: 'text/plain',
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  test('should handle multiple recipients', async () => {
    const result = await provider.send({
      to: ['user1@example.com', 'user2@example.com'],
      cc: 'cc@example.com',
      bcc: 'bcc@example.com',
      subject: 'Multiple Recipients',
      text: 'Hello everyone!',
    });

    expect(result.success).toBe(true);
  });

  test('should handle email address objects', async () => {
    const result = await provider.send({
      to: { email: 'user@example.com', name: 'Test User' },
      from: { email: 'sender@example.com', name: 'Sender' },
      subject: 'Named Recipients',
      text: 'Hello!',
    });

    expect(result.success).toBe(true);
  });

  test('should verify connection', async () => {
    const verified = await provider.verify();
    expect(verified).toBe(true);
  });
});
