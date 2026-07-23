import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { ResetPasswordForm } from '@/components/auth/resetPasswordForm';

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const session = await auth.getSession();
  if (session) redirect('/dashboard');

  const { token } = await searchParams;

  if (!token) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <p className="text-sm text-muted-foreground">
            Invalid or missing reset token.{' '}
            <Link href="/forgot-password" className="font-medium text-primary hover:underline">
              Request a new one
            </Link>
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Najm</p>
          <h1 className="mt-2 text-xl font-semibold text-foreground">Set new password</h1>
        </div>
        <ResetPasswordForm token={token} />
      </div>
    </main>
  );
}
