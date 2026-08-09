import { Ctx, Service } from 'najm-core';
import { createGuard } from 'najm-guard';

/**
 * Theme Studio has no accounts, and `najm-theme` refuses to register without an
 * explicit guard on every mutation — deliberately, so that "who may repaint the
 * platform" is never answered by omission.
 *
 * A local design tool's honest answer is "whoever is at this machine". This
 * guard says exactly that and nothing more: the request must have arrived over
 * the loopback interface the dev server binds. It is not an authentication
 * scheme and is not offered as one — a real application substitutes `isAdmin()`
 * or its own equivalent here, which is the whole point of the config being a
 * list of guards rather than a boolean.
 */
const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

@Service()
export class LocalStudioGuard {
  canActivate(@Ctx() context: any): boolean {
    // The request URL, not the `Host` header. `host` is a forbidden header name
    // in the Fetch spec, so `new Request(url)` never carries one and a header
    // read returns undefined for every caller — which reads as a working guard
    // that refuses everything. The URL is always populated, and for a real
    // request over the wire its authority *is* the Host header.
    const url = context?.req?.url ?? context?.req?.raw?.url ?? '';

    let hostname: string;
    try {
      hostname = new URL(String(url)).hostname.toLowerCase();
    } catch {
      return false;
    }

    return LOOPBACK.has(hostname);
  }
}

export const isLocalStudio = createGuard(LocalStudioGuard);
