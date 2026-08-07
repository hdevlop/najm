'use client';

import Link from 'next/link';
import type { AuthUser } from 'najm-auth/client';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useDashboardSnapshotQuery } from '@/hooks/useDashboardSnapshotQuery';
import type { DashboardSnapshot } from '@/services/api/types';
import { ArrowRight, Package, ShoppingCart, CreditCard, Boxes } from 'lucide-react';

export function DashboardOverview({
  user,
  permissions = [],
}: {
  user: AuthUser | null;
  // Grants live on the session, not on session.user — read them from there or
  // every permission-gated view below computes against an empty list.
  permissions?: string[];
}) {
  const role = typeof user?.role === 'string' && user.role ? user.role : 'member';
  const dashboardQuery = useDashboardSnapshotQuery(user?.role, permissions);

  const stats = [
    { label: 'Email', value: user?.email ?? '-' },
    { label: 'Role', value: role },
    { label: 'Permissions', value: String(permissions.length) },
  ];

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Profile stats */}
      <div className="grid gap-3 sm:grid-cols-3">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-xl border border-border bg-card p-4 md:p-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{stat.label}</p>
            <p className="mt-2 text-base md:text-lg font-semibold text-foreground break-all">{stat.value}</p>
          </div>
        ))}
      </div>

      {dashboardQuery.isPending ? (
        <DashboardLiveDataSkeleton />
      ) : dashboardQuery.error ? (
        <DashboardQueryError onRetry={() => void dashboardQuery.refetch()} />
      ) : dashboardQuery.data ? (
        <DashboardLiveData snapshot={dashboardQuery.data} role={role} />
      ) : null}

      {/* Quick links + session info */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5 md:p-6">
          <h3 className="text-sm font-semibold text-foreground">Quick links</h3>
          <p className="mt-1 text-sm text-muted-foreground">Navigate the protected dashboard.</p>
          <div className="mt-4 space-y-2">
            {[
              { href: '/dashboard/account', label: 'Account', desc: 'Profile, security & permissions' },
              { href: '/dashboard/activity', label: 'Activity', desc: 'Recent auth events' },
              { href: '/', label: 'Home', desc: 'Back to landing page' },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center justify-between rounded-lg border border-border/60 px-4 py-3 transition-colors hover:border-border hover:bg-secondary"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">{link.label}</p>
                  <p className="text-xs text-muted-foreground">{link.desc}</p>
                </div>
                <ArrowRight size={14} className="text-muted-foreground" />
              </Link>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-primary p-5 md:p-6 text-primary-foreground">
          <h3 className="text-sm font-semibold">Session active</h3>
          <p className="mt-1 text-sm text-primary-foreground/70">
            You're authenticated. The dashboard shell stays mounted while child pages change.
          </p>
          <div className="mt-5 space-y-2">
            {[
              'Login redirects straight into a protected route',
              'The shell persists across nested navigation',
              'Sign out returns you to the auth screen',
            ].map((item) => (
              <div key={item} className="flex items-start gap-2 rounded-md bg-primary-foreground/10 px-3 py-2">
                <span className="mt-0.5 text-xs text-emerald-400">✓</span>
                <p className="text-sm text-primary-foreground/80">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function DashboardLiveData({ snapshot, role }: { snapshot: DashboardSnapshot; role: string }) {
  const cards = [
    { label: role === 'admin' ? 'Catalog Products' : 'My Products', value: String(snapshot.products.length), icon: Boxes },
    { label: 'My Orders', value: String(snapshot.orders.length), icon: Package },
    { label: 'Cart Quantity', value: String(snapshot.cart.quantity), icon: ShoppingCart },
    { label: 'Cart Total', value: `$${snapshot.cart.total.toFixed(2)}`, icon: CreditCard },
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
      <div className="rounded-xl border border-border bg-card p-5 md:p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Live dashboard data</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Powered by React Query and typed API services.
            </p>
          </div>
          <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">
            {snapshot.summary.app}
          </span>
        </div>

        <div className="mt-5 grid gap-3 grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => (
            <div key={card.label} className="rounded-xl border border-border/60 bg-secondary px-4 py-3">
              <div className="flex items-center gap-2 mb-2">
                <card.icon size={14} className="text-muted-foreground" />
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{card.label}</p>
              </div>
              <p className="text-xl font-semibold text-foreground">{card.value}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div>
            <h4 className="text-sm font-semibold text-foreground">Recent orders</h4>
            <div className="mt-3 space-y-2">
              {snapshot.capabilities.orders ? (
                snapshot.orders.length > 0 ? (
                  snapshot.orders.slice(0, 3).map((order) => (
                    <div key={order.id} className="rounded-xl border border-border/60 px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-foreground">{order.status}</p>
                        <span className="text-xs text-muted-foreground">${order.total.toFixed(2)}</span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {order.items.length} item{order.items.length === 1 ? '' : 's'}
                      </p>
                    </div>
                  ))
                ) : (
                  <EmptyState text="No orders yet. Checkout will populate this widget." />
                )
              ) : (
                <EmptyState text="This account does not currently have order access." />
              )}
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-foreground">
              {role === 'admin' ? 'Catalog snapshot' : 'My products'}
            </h4>
            <div className="mt-3 space-y-2">
              {snapshot.capabilities.products ? (
                snapshot.products.length > 0 ? (
                  snapshot.products.slice(0, 3).map((product) => (
                    <div key={product.id} className="rounded-xl border border-border/60 px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-foreground">{product.name}</p>
                        <span className="text-xs text-muted-foreground">${Number(product.price).toFixed(2)}</span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {product.category} • Stock {product.stock}
                      </p>
                    </div>
                  ))
                ) : (
                  <EmptyState text="No products yet. Create one to see it here." />
                )
              ) : (
                <EmptyState text="This account does not currently have product access." />
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 md:p-6">
        <h3 className="text-sm font-semibold text-foreground">Summary pulse</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Server totals from the health summary endpoint.
        </p>
        <div className="mt-5 space-y-3">
          <SummaryRow label="Total catalog products" value={String(snapshot.summary.totals.products)} />
          <SummaryRow label="Demo user orders" value={String(snapshot.summary.totals.demoUserOrders)} />
          <SummaryRow label="Demo user cart items" value={String(snapshot.summary.totals.demoUserCartItems)} />
          {snapshot.capabilities.users ? (
            <SummaryRow label="Admin user count" value={String(snapshot.users.length)} />
          ) : null}
        </div>
        <p className="mt-4 text-xs text-muted-foreground">Updated {formatRelativeTime(snapshot.summary.now)}</p>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-border/60 px-4 py-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold text-foreground">{value}</span>
    </div>
  );
}

function DashboardLiveDataSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
      <div className="rounded-xl border border-border bg-card p-5 md:p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Skeleton className="h-4 w-32" />
            <Skeleton className="mt-2 h-3 w-56" />
          </div>
          <Skeleton className="h-6 w-24 rounded-full" />
        </div>
        <div className="mt-5 grid gap-3 grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border/60 bg-secondary px-4 py-3">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="mt-3 h-6 w-14" />
            </div>
          ))}
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i}>
              <Skeleton className="h-4 w-28" />
              <div className="mt-3 space-y-2">
                {Array.from({ length: 3 }).map((__, row) => (
                  <div key={row} className="rounded-xl border border-border/60 px-4 py-3">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="mt-2 h-3 w-32" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 md:p-6">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="mt-2 h-3 w-40" />
        <div className="mt-5 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border/60 px-4 py-3">
              <div className="flex items-center justify-between gap-4">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-3 w-12" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DashboardQueryError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-5 text-destructive">
      <p className="text-sm font-semibold">Unable to load dashboard data.</p>
      <p className="mt-1 text-sm text-destructive/80">
        The route is protected, but the dashboard widgets could not fetch their API data.
      </p>
      <Button className="mt-4 bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
      {text}
    </div>
  );
}

function formatRelativeTime(value: string): string {
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return value;

  const diffMinutes = Math.max(0, Math.round((Date.now() - timestamp) / 60_000));
  if (diffMinutes < 1) return 'just now';
  if (diffMinutes === 1) return '1 minute ago';
  return `${diffMinutes} minutes ago`;
}
