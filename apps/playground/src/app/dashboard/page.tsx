import { auth } from '@/lib/auth';
import { DashboardOverview } from '@/components/auth/dashboardOverview';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const session = await auth.requireSession();
  return <DashboardOverview user={session.user} />;
}
