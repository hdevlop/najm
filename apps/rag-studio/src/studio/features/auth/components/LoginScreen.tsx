import React, { useState } from 'react';
import { Loader2, ShieldCheck } from 'lucide-react';
import { useStudioAuth } from '@/lib/useStudioAuth';

/**
 * Standalone-mode login gate. Authenticates against the target app's najm-auth
 * (`/auth/login`) and stores a Bearer token. Rendered by `RagStudioApp` when
 * `auth === 'standalone'` and no token is present.
 */
export function LoginScreen() {
  const { login } = useStudioAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError(null);
    setLoading(true);
    try {
      await login({ email: email.trim(), password });
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

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-txt-secondary">Email</span>
            <input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-txt-primary outline-none focus:border-brand"
              placeholder="admin@example.com"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-txt-secondary">Password</span>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-txt-primary outline-none focus:border-brand"
              placeholder="••••••••"
            />
          </label>

          {error && (
            <p className="rounded-lg border border-status-red/40 bg-status-red/10 px-3 py-2 text-xs text-status-red">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-1 flex items-center justify-center gap-2 rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-hover disabled:opacity-60"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
