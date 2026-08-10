import Link from 'next/link';
import { redirect } from 'next/navigation';
import { NThemeImage } from 'najm-theme/react';
import { auth } from '@/lib/auth';
import { LoginForm } from '@/components/auth/loginForm';

export default async function LoginPage() {
  const session = await auth.getSession();
  if (session) redirect('/dashboard');

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      {/* The hero: decoration, so `alt=""`, and `fill` against a positioned
          parent exactly as a Next <Image fill /> would be. Hidden on small
          screens, where a full-bleed photograph is a scroll and not a brand. */}
      <div className="relative hidden overflow-hidden bg-muted lg:block">
        <NThemeImage slot="authHeroImage" alt="" fill />
      </div>

      <div className="flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-6 text-center">
            <NThemeImage
              slot="authLogo"
              alt="Najm Playground"
              className="mx-auto h-10 w-auto"
            />
            <h1 className="mt-4 text-xl font-semibold text-foreground">Sign in</h1>
          </div>
          <LoginForm googleEnabled={Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)} />
          <p className="mt-4 text-center text-sm text-muted-foreground">
            No account?{' '}
            <Link href="/register" className="font-medium text-primary hover:underline">
              Register
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
