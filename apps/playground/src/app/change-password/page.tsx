import { CredentialSetupForm } from '@/components/auth/credentialSetupForm';

export const dynamic = 'force-dynamic';

export default function ChangePasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Najm</p>
          <h1 className="mt-2 text-xl font-semibold text-foreground">Set your password</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your account was created with a temporary credential. Replace it to continue.
          </p>
        </div>
        <CredentialSetupForm />
      </div>
    </main>
  );
}
