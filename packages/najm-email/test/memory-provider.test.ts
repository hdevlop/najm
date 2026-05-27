import { describe, test, expect, beforeEach } from 'bun:test';
import { MemoryProvider } from '../src/providers/MemoryProvider';

describe('MemoryProvider', () => {
  let provider: MemoryProvider;

  beforeEach(async () => {
    provider = new MemoryProvider({ provider: 'memory' });
    await provider.initialize();
  });

  test('should send email and store it', async () => {
    const result = await provider.send({
      to: 'user@example.com',
      subject: 'Test Subject',
      text: 'Hello, World!',
    });

    expect(result.success).toBe(true);
    expect(result.messageId).toBeDefined();
    expect(provider.getEmailCount()).toBe(1);
  });

  test('should retrieve last sent email', async () => {
    await provider.send({
      to: 'user@example.com',
      subject: 'Test 1',
      text: 'First email',
    });

    await provider.send({
      to: 'another@example.com',
      subject: 'Test 2',
      text: 'Second email',
    });

    const lastEmail = provider.getLastEmail();
    expect(lastEmail?.message.subject).toBe('Test 2');
  });

  test('should find emails by recipient', async () => {
    await provider.send({
      to: 'user1@example.com',
      subject: 'To User 1',
      text: 'Hello User 1',
    });

    await provider.send({
      to: 'user2@example.com',
      subject: 'To User 2',
      text: 'Hello User 2',
    });

    await provider.send({
      to: 'user1@example.com',
      subject: 'Another to User 1',
      text: 'Hello again',
    });

    const user1Emails = provider.getEmailsTo('user1@example.com');
    expect(user1Emails.length).toBe(2);
  });

  test('should find emails by subject', async () => {
    await provider.send({
      to: 'user@example.com',
      subject: 'Welcome',
      text: 'Welcome!',
    });

    await provider.send({
      to: 'user@example.com',
      subject: 'Password Reset',
      text: 'Reset your password',
    });

    const resetEmails = provider.getEmailsBySubject('Password Reset');
    expect(resetEmails.length).toBe(1);
  });

  test('should search emails by content', async () => {
    await provider.send({
      to: 'user@example.com',
      subject: 'Order Confirmation',
      text: 'Your order #12345 has been confirmed.',
    });

    await provider.send({
      to: 'user@example.com',
      subject: 'Newsletter',
      text: 'Check out our latest news!',
    });

    const orderEmails = provider.searchEmails('12345');
    expect(orderEmails.length).toBe(1);
    expect(orderEmails[0].message.subject).toBe('Order Confirmation');
  });

  test('should clear all emails', async () => {
    await provider.send({
      to: 'user@example.com',
      subject: 'Test',
      text: 'Test',
    });

    expect(provider.getEmailCount()).toBe(1);

    provider.clear();

    expect(provider.getEmailCount()).toBe(0);
  });

  test('should handle multiple recipients', async () => {
    await provider.send({
      to: ['user1@example.com', 'user2@example.com'],
      subject: 'Group Email',
      text: 'Hello everyone!',
    });

    expect(provider.assertSentTo('user1@example.com')).toBe(true);
    expect(provider.assertSentTo('user2@example.com')).toBe(true);
    expect(provider.assertSentTo('user3@example.com')).toBe(false);
  });

  test('should verify connection', async () => {
    const verified = await provider.verify();
    expect(verified).toBe(true);
  });
});
