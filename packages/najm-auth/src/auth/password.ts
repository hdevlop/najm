import bcrypt from 'bcryptjs';

type BunPassword = {
  hash(password: string, options: { algorithm: 'bcrypt'; cost: number }): Promise<string>;
  verify(password: string, hash: string): Promise<boolean>;
};

const getBunPassword = (): BunPassword | undefined =>
  (globalThis as typeof globalThis & { Bun?: { password?: BunPassword } }).Bun?.password;

export async function hashPassword(password: string, rounds: number): Promise<string> {
  if (!Number.isInteger(rounds) || rounds < 4 || rounds > 31) {
    throw new Error('bcrypt rounds must be an integer between 4 and 31');
  }
  const bunPassword = getBunPassword();
  if (bunPassword) {
    return bunPassword.hash(password, { algorithm: 'bcrypt', cost: rounds });
  }
  return bcrypt.hash(password, rounds);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const bunPassword = getBunPassword();
  if (bunPassword) {
    return bunPassword.verify(password, hash);
  }
  return bcrypt.compare(password, hash);
}
