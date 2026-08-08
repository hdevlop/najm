'use client';

import Link from 'next/link';
import { IfAuth, UserName, LoginButton } from 'najm-auth/client/react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Najm</p>
          <h1 className="mt-2 text-2xl font-semibold text-foreground">Playground</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Auth UI powered by najm-auth with a protected dashboard flow.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-6">
          <div className="mb-5 grid gap-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <span className="text-emerald-500">→</span> Login lands on a protected dashboard
            </div>
            <div className="flex items-center gap-2">
              <span className="text-emerald-500">→</span> Shared layout with nested navigation
            </div>
            <div className="flex items-center gap-2">
              <span className="text-emerald-500">→</span> Sign out tests the full auth loop
            </div>
          </div>

          <IfAuth
            loading={() => (
              <div className="flex gap-3">
                <Skeleton className="h-10 w-24" />
                <Skeleton className="h-10 w-24" />
              </div>
            )}
            authenticated={() => (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Welcome back, <span className="font-medium text-foreground"><UserName /></span>
                </p>
                <div className="flex gap-2">
                  <Button asChild className="bg-primary text-primary-foreground hover:bg-primary/90">
                    <Link href="/dashboard">Dashboard</Link>
                  </Button>
                  <Button variant="outline" asChild>
                    <Link href="/dashboard/activity">Activity</Link>
                  </Button>
                </div>
              </div>
            )}
            unauthenticated={() => (
              <div className="flex gap-2">
                <LoginButton href="/login">
                  <Button className="bg-primary text-primary-foreground hover:bg-primary/90">Login</Button>
                </LoginButton>
                <Button variant="outline" asChild>
                  <Link href="/register">Register</Link>
                </Button>
              </div>
            )}
          />

          <div className="mt-4 border-t border-border pt-4">
            <Button variant="outline" className="w-full" asChild>
              <Link href="/format-pagination">Formatting &amp; pagination example</Link>
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}
