import { auth } from '@/lib/auth';
import { AccountDashboard } from '@/components/auth/accountDashboard';

export const dynamic = 'force-dynamic';

export default async function DashboardAccountPage() {
  await auth.requireSession();
  return <AccountDashboard />;
}
