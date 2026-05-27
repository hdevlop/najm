import { auth } from '@/lib/auth';
import { AdminPanel } from '@/components/auth/adminPanel';

export const dynamic = 'force-dynamic';

export default auth.protect(
  async ({ session }) => {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-4">
        <AdminPanel />
      </main>
    );
  },
  { role: 'admin' },
);
