import { NajmNextConfigError } from './errors';

export const DEV_ORIGINS_ENV = 'NAJM_NEXT_DEV_ORIGINS';

const HOST_PATTERN = /^[a-z0-9.*_\-[\]:]+$/;

function normalize(token: string): string {
  let value = token.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '').split('/')[0] ?? '';
  if (value.startsWith('[')) {
    const end = value.indexOf(']');
    if (end !== -1) value = value.slice(0, end + 1);
  } else {
    const colon = value.lastIndexOf(':');
    if (colon !== -1) value = value.slice(0, colon);
  }
  return value.toLowerCase();
}

/**
 * Empty by default. Next only guards dev-only assets and endpoints with this
 * list, but a LAN-wide default would hand every device on the network the dev
 * server's HMR and source payloads.
 */
export function parseDevOrigins(raw: string | undefined): string[] {
  if (!raw) return [];

  const origins: string[] = [];
  for (const token of raw.split(/[\s,]+/).filter(Boolean)) {
    const origin = normalize(token);
    if (!origin || !HOST_PATTERN.test(origin)) {
      throw new NajmNextConfigError(`${DEV_ORIGINS_ENV} contains an unusable origin: "${token}".`);
    }
    if (origin === '*') {
      throw new NajmNextConfigError(`${DEV_ORIGINS_ENV} may not be "*"; list the hosts that need dev access.`);
    }
    if (!origins.includes(origin)) origins.push(origin);
  }
  return origins;
}
