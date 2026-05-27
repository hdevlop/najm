import { Inject, Injectable } from 'najm-core';
import bcrypt from 'bcryptjs'
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { AUTH_ENCRYPTION_KEY } from '../auth.tokens';

const REQUIRED_KEY_BYTES = 32;

function decodeKey(raw: string): Buffer {
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, 'hex');
  }
  if (/^[A-Za-z0-9+/]+=*$/.test(raw) || /^[A-Za-z0-9_-]+=*$/.test(raw)) {
    const decoded = Buffer.from(raw, raw.includes('-') || raw.includes('_') ? 'base64url' : 'base64');
    if (decoded.length === REQUIRED_KEY_BYTES) return decoded;
  }
  if (Buffer.byteLength(raw, 'utf8') === REQUIRED_KEY_BYTES) {
    return Buffer.from(raw, 'utf8');
  }
  throw new Error(
    `Encryption key must decode to ${REQUIRED_KEY_BYTES} bytes. Provide hex (64 chars) or base64 (32 bytes decoded).`,
  );
}

@Injectable()
export class EncryptionService {
  private encryptionKey: Buffer;

  constructor(
    @Inject(AUTH_ENCRYPTION_KEY) encryptionKey?: string | null,
  ) {
    const raw = encryptionKey ?? process.env.NAJM_ENCRYPTION_KEY ?? '';
    if (!raw) {
      throw new Error(
        'Encryption key missing. Set NAJM_ENCRYPTION_KEY (base64 or hex, 32 bytes) or pass auth({ encryptionKey })',
      );
    }
    this.encryptionKey = decodeKey(raw);
  }

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }

  async comparePassword(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, encrypted]).toString('base64url');
  }

  decrypt(ciphertext: string): string {
    const raw = Buffer.from(ciphertext, 'base64url');
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const encrypted = raw.subarray(28);
    const decipher = createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
    decipher.setAuthTag(tag);
    return decipher.update(encrypted) + decipher.final('utf8');
  }
}
