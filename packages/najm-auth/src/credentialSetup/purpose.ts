import { Err } from 'najm-core';

const PURPOSE_PATTERN = /^[a-z0-9](?:[a-z0-9:_-]{0,62}[a-z0-9])?$/;

/** Purposes are server-owned identifiers, never user input. */
export function normalizeSetupPurpose(purpose: string): string {
  const normalized = purpose?.trim().toLowerCase();
  if (!normalized || !PURPOSE_PATTERN.test(normalized)) {
    Err('Credential setup purpose must be 1-64 lowercase letters, numbers, colon, underscore, or hyphen', 500);
  }
  return normalized;
}
