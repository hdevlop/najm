import type { ReactNode } from 'react';
import { DashboardShell } from '@/components/auth/dashboardShell';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>;
}
