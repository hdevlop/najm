import Link from 'next/link';
import { auth } from '@/lib/auth';
import { Button } from '@/components/ui/button';

export const dynamic = 'force-dynamic';

export default async function DashboardActivityPage() {
  const session = await auth.requireSession();
  const email = session.user.email ?? 'demo@playground.local';

  const timeline = [
    {
      time: 'Just now',
      title: 'Dashboard mounted',
      detail: `${email} landed inside a protected nested route.`,
    },
    {
      time: '1 min ago',
      title: 'Middleware accepted request',
      detail: 'Route guard resolved the session before handing control to the app router.',
    },
    {
      time: '3 min ago',
      title: 'Redirect target preserved',
      detail: 'Login page sent the user back to the dashboard.',
    },
    {
      time: '5 min ago',
      title: 'Auth provider hydrated',
      detail: 'Client state is now available across the playground.',
    },
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="rounded-lg border border-border bg-card">
        <div className="border-b border-border px-6 py-4">
          <h2 className="text-sm font-semibold text-foreground">Activity</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Recent auth events in the playground.</p>
        </div>
        <div className="divide-y divide-border">
          {timeline.map((event, i) => (
            <div key={i} className="flex items-start gap-4 px-6 py-4">
              <div className="mt-1 flex h-2 w-2 flex-none rounded-full bg-emerald-500" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">{event.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{event.detail}</p>
              </div>
              <span className="flex-none text-xs text-muted-foreground">{event.time}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-5">
        <h3 className="text-sm font-semibold text-foreground">Validation checklist</h3>
        <div className="mt-4 space-y-3">
          {[
            'Visit /dashboard directly while signed out and confirm redirect to /login.',
            'Sign in and verify the shell persists when moving to nested routes.',
            'Use sign-out and confirm the next protected request is blocked.',
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="mt-0.5 flex h-4 w-4 flex-none items-center justify-center rounded border border-border text-[10px] text-muted-foreground">
                {i + 1}
              </span>
              <p className="text-xs leading-relaxed text-muted-foreground">{item}</p>
            </div>
          ))}
        </div>
        <div className="mt-5 flex gap-2">
          <Button asChild size="sm">
            <Link href="/dashboard">Overview</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/login">Login</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
