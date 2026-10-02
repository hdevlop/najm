import React, { useState } from 'react';
import { Loader2, ShieldCheck } from 'lucide-react';
import { Button, FormInput, NAlert, NForm } from 'najm-kit';
import { z } from 'zod';
import { useStudioAuth } from '@/lib/useStudioAuth';

const schema = z.object({
  email: z.string().trim().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

/**
 * Standalone-mode login gate. Authenticates against the target app's najm-auth
 * (`/auth/login`) and stores a Bearer token. Rendered by `RagStudioApp` when
 * `auth === 'standalone'` and no token is present.
 */
export function LoginScreen() {
  const { login } = useStudioAuth();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(values: z.infer<typeof schema>) {
    if (loading) return;
    setError(null);
    setLoading(true);
    try {
      await login({ email: values.email.trim(), password: values.password });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-full w-full items-center justify-center bg-bg p-6">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-8 shadow-card">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-glow text-brand">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-txt-primary">RAG Studio</h1>
            <p className="text-sm text-txt-secondary">Sign in as super-admin to continue</p>
          </div>
        </div>

        <NForm
          schema={schema}
          defaultValues={{ email: '', password: '' }}
          variant="studio"
          className="flex flex-col gap-4"
          onSubmit={handleSubmit}
        >
          <FormInput
            name="email"
            type="text"
            formLabel="Email"
            placeholder="admin@example.com"
            autoComplete="username"
            inputMode="email"
          />
          <FormInput
            name="password"
            type="password"
            formLabel="Password"
            placeholder="••••••••"
            autoComplete="current-password"
          />

          {error && <NAlert tone="destructive" description={error} />}

          <Button type="submit" disabled={loading} className="mt-1 gap-2">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>
        </NForm>
      </div>
    </div>
  );
}
