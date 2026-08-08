export async function signedSession(
  role: 'admin' | 'sponsor' = 'admin',
  issuedAt = Date.now(),
) {
  const sessionSecret = process.env.RUNTIME_SESSION_SECRET!;
  const payload = JSON.stringify({
    user: {
      id: `integration-${role}`,
      email: `${role}@example.test`,
      role,
    },
    roles: [role],
    permissions: [`${role}:read`],
    sessionVersion: 0,
    iat: issuedAt,
  });
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(sessionSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign('HMAC', key, encoder.encode(payload)),
  );
  return `${payload}.${base64Url(signature)}`;
}

function base64Url(bytes: Uint8Array) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let result = '';
  for (let offset = 0; offset < bytes.length; offset += 3) {
    const first = bytes[offset]!;
    const second = bytes[offset + 1];
    const third = bytes[offset + 2];
    const chunk = (first << 16) | ((second ?? 0) << 8) | (third ?? 0);
    result += alphabet[(chunk >> 18) & 63];
    result += alphabet[(chunk >> 12) & 63];
    if (second !== undefined) result += alphabet[(chunk >> 6) & 63];
    if (third !== undefined) result += alphabet[chunk & 63];
  }
  return result;
}
