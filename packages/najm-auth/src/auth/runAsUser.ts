import type { Container } from 'najm-core';
import { randomUUID } from 'crypto';

export interface RunAsUser {
  id: string;
  role?: string | null;
  permissions?: string[];
}

export function runAsUser<T>(
  container: Container,
  user: RunAsUser,
  fn: () => Promise<T> | T,
): Promise<T> {
  const requestId = `runAs:${randomUUID()}`;
  const role = user.role ?? 'user';
  const store: Record<string, unknown> = {
    requestId,
    user,
    role,
  };

  if (user.permissions !== undefined) {
    store.permissions = user.permissions;
  }

  return container.run(store, async () => {
    try {
      return await fn();
    } finally {
      await container.cleanupReq(requestId);
    }
  });
}
