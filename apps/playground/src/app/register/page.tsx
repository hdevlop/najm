import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { RegisterForm } from '@/components/auth/registerForm';

export default async function RegisterPage() {
  const session = await auth.getSession();
  if (session) redirect('/dashboard');

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Najm</p>
          <h1 className="mt-2 text-xl font-semibold text-foreground">Create account</h1>
        </div>
        <RegisterForm />
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Already registered?{' '}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
