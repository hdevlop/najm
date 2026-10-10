import { afterEach, describe, expect, test } from 'bun:test';
import { ResendProvider } from '../src/providers/ResendProvider';

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

function captureRequests() {
  const bodies: any[] = [];
  globalThis.fetch = (async (_url: string, init: RequestInit) => {
    bodies.push(JSON.parse(String(init.body)));
    return new Response(JSON.stringify({ id: 'email-1' }), { status: 200 });
  }) as typeof fetch;
  return bodies;
}

describe('ResendProvider attachments', () => {
  test('an inline image keeps its content id and disposition, so cid: references resolve', async () => {
    const bodies = captureRequests();
    const provider = new ResendProvider({ provider: 'resend', apiKey: 're_test' });
    await provider.initialize();

    await provider.send({
      to: 'family@example.invalid',
      subject: 'Invitation',
      html: '<img src="cid:brand-logo">',
      attachments: [
        { filename: 'logo.png', content: Buffer.from('png'), contentType: 'image/png', cid: 'brand-logo', disposition: 'inline' },
        { filename: 'terms.pdf', content: 'cGRm', contentType: 'application/pdf' },
      ],
    });

    expect(bodies[0].attachments).toEqual([
      { filename: 'logo.png', content: Buffer.from('png').toString('base64'), content_type: 'image/png', content_disposition: 'inline', content_id: 'brand-logo' },
      { filename: 'terms.pdf', content: 'cGRm', content_type: 'application/pdf' },
    ]);
  });
});
