import { NextResponse } from 'next/server';
import { recoveryCount } from '../../../../recoveryCount';

export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json({ count: recoveryCount() });
}
