import { expect, test } from 'bun:test';
import { createServer } from 'node:net';
import type { Socket } from 'node:net';
import { SmtpProvider } from '../src/providers/SmtpProvider';

test('SMTP provider verifies and delivers through Nodemailer with recipients and attachments', async () => {
  const messages: string[] = [];
  const envelopes: string[] = [];
  const sockets = new Set<Socket>();
  const smtp = createServer((socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    socket.setEncoding('utf8');
    socket.write('220 localhost SMTP fixture\r\n');
    let pending = '';
    let data = false;
    let message = '';
    socket.on('data', (chunk) => {
      pending += chunk;
      let end: number;
      while ((end = pending.indexOf('\r\n')) !== -1) {
        const line = pending.slice(0, end);
        pending = pending.slice(end + 2);
        if (data) {
          if (line === '.') {
            messages.push(message);
            message = '';
            data = false;
            socket.write('250 queued\r\n');
          } else message += line + '\r\n';
        } else if (/^(EHLO|HELO) /.test(line)) socket.write('250 localhost\r\n');
        else if (/^(MAIL FROM|RCPT TO):/.test(line)) {
          envelopes.push(line);
          socket.write('250 accepted\r\n');
        } else if (line === 'DATA') {
          data = true;
          socket.write('354 send message\r\n');
        } else if (line === 'QUIT') socket.end('221 goodbye\r\n');
        else socket.write('250 ok\r\n');
      }
    });
  });
  await new Promise<void>((resolve, reject) => {
    smtp.once('error', reject);
    smtp.listen(0, '127.0.0.1', resolve);
  });
  const address = smtp.address();
  if (!address || typeof address === 'string') throw new Error('SMTP fixture did not bind');
  const provider = new SmtpProvider({ provider: 'smtp', host: '127.0.0.1', port: address.port, secure: false });
  try {
    await provider.initialize();
    expect(await provider.verify()).toBe(true);
    const result = await provider.send({
      from: 'sender@example.test', to: 'recipient@example.test',
      subject: 'SMTP security upgrade', text: 'Delivery fixture',
      attachments: [{ filename: 'fixture.txt', content: Buffer.from('fixture-content'), contentType: 'text/plain' }],
    });
    expect(result.success).toBe(true);
    expect(result.messageId).toBeTruthy();
    expect(envelopes).toContain('MAIL FROM:<sender@example.test>');
    expect(envelopes).toContain('RCPT TO:<recipient@example.test>');
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain('Subject: SMTP security upgrade');
    expect(messages[0]).toContain('Delivery fixture');
    expect(messages[0]).toContain('filename=fixture.txt');
    expect(messages[0]).toContain(Buffer.from('fixture-content').toString('base64'));
  } finally {
    await provider.close();
    for (const socket of sockets) socket.destroy();
    await new Promise<void>((resolve, reject) => smtp.close((error) => error ? reject(error) : resolve()));
  }
});
