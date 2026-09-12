import { createCspReportHandler } from 'najm-next/security/reports';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Thin route adapter: the handler needs no backend, so reports stay directly
 * reachable beside the auth catch-all shape used by real apps.
 */
export const POST = createCspReportHandler();
