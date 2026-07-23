'use client';

import { OAuthCallback } from 'najm-auth/client/react';

export default function OAuthCallbackPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <OAuthCallback
        fallback={<p className="text-sm text-muted-foreground">Finishing Google sign-in...</p>}
        errorFallback={({ error }) => (
          <p className="text-sm text-destructive">{error.message}</p>
        )}
      />
    </main>
  );
}
