'use client';

import Link from 'next/link';
import { type ReactNode, useCallback, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAuthEvent, useLogout, useSession } from 'najm-auth/client/react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import {
  LayoutDashboard,
  UserCircle,
  Activity,
  MessageSquare,
  Database,
  Settings,
  LogOut,
  Menu,
  X,
  MessageSquareText,
  HardDrive,
  PanelLeft,
  Palette,
} from 'lucide-react';
import { NThemeImage } from 'najm-theme/react';

type DashboardShellProps = {
  children: ReactNode;
};

const navigation = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/dashboard/account', label: 'Account', icon: UserCircle },
  { href: '/dashboard/theme', label: 'Theme', icon: Palette },
  { href: '/dashboard/activity', label: 'Activity', icon: Activity },
  { href: '/dashboard/chatbot', label: 'AI Chat', icon: MessageSquare },
];

const studios = [
  { href: '/wa-studio', label: 'WA Studio', icon: MessageSquareText },
  { href: '/rag-studio', label: 'RAG Studio', icon: Database },
  { href: '/storage-studio', label: 'Storage Studio', icon: HardDrive },
];

function isActiveRoute(pathname: string, href: string) {
  if (href === '/dashboard') return pathname === '/dashboard';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DashboardShell({ children }: DashboardShellProps) {
  const pathname = usePathname();
  const { user, roles, permissions } = useSession();
  const { logout, isLoading } = useLogout({ redirectTo: '/login' });
  const logoutRequestedRef = useRef(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  // Both sidebar marks are real product positions, so both need to be
  // reachable in one visual pass.
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useAuthEvent('logout', () => {
    if (logoutRequestedRef.current || typeof window === 'undefined') return;
    window.location.href = '/login';
  });

  useAuthEvent('sessionExpired', () => {
    if (typeof window === 'undefined') return;
    window.location.href = '/login';
  });

  const handleLogout = useCallback(async () => {
    logoutRequestedRef.current = true;
    try {
      await logout();
    } finally {
      logoutRequestedRef.current = false;
    }
  }, [logout]);

  const displayName =
    user && typeof user.name === 'string' && user.name.trim().length > 0
      ? user.name
      : user?.email ?? '';
  const initial = displayName ? displayName.charAt(0).toUpperCase() : '?';

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
            onClick={() => setMobileOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 z-50 w-64 bg-card border-r border-border md:hidden">
            <MobileNav
              pathname={pathname}
              user={user}
              displayName={displayName}
              initial={initial}
              roles={roles}
              onClose={() => setMobileOpen(false)}
              onLogout={handleLogout}
              isLoading={isLoading}
            />
          </div>
        </>
      )}

      <div className="flex w-full min-h-screen">
        {/* Desktop sidebar */}
        <aside
          className={cn(
            'hidden flex-none border-r border-border bg-card transition-[width] md:flex',
            sidebarCollapsed ? 'w-16' : 'w-60',
          )}
        >
          <div className="flex h-full w-full flex-col">
            {/* Both sidebar marks in their real positions. Which file each one
                resolves to — a managed upload or the `theme/` file — is the
                package's decision, not this component's. */}
            <div
              className={cn(
                'flex gap-2 border-b border-border py-5',
                sidebarCollapsed
                  ? 'flex-col items-center px-2'
                  : 'flex-row items-center px-5',
              )}
            >
              {sidebarCollapsed ? (
                <NThemeImage
                  slot="sidebarLogoCollapsed"
                  alt="Najm Playground"
                  className="h-8 w-8 rounded"
                />
              ) : (
                <NThemeImage
                  slot="sidebarLogoExpanded"
                  alt="Najm Playground"
                  className="h-8 w-auto"
                />
              )}
              <button
                type="button"
                aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                aria-expanded={!sidebarCollapsed}
                onClick={() => setSidebarCollapsed((value) => !value)}
                className={cn(
                  'rounded p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground',
                  sidebarCollapsed ? '' : 'ms-auto',
                )}
              >
                <PanelLeft size={16} />
              </button>
            </div>

            <div className="border-b border-border px-4 py-4">
              {user ? (
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground">
                    {initial}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{displayName}</p>
                    <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <Skeleton className="h-9 w-9 rounded-lg" />
                  <div className="min-w-0">
                    <Skeleton className="mb-1.5 h-3.5 w-20" />
                    <Skeleton className="h-3 w-28" />
                  </div>
                </div>
              )}
            </div>

            <nav className="flex-1 space-y-0.5 px-3 py-3">
              {!sidebarCollapsed && (
                <span className="px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Dashboard</span>
              )}
              {navigation.map((item) => {
                const active = isActiveRoute(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={sidebarCollapsed ? item.label : undefined}
                    className={cn(
                      'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      sidebarCollapsed && 'justify-center px-2',
                      active
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
                    )}
                  >
                    <item.icon size={16} />
                    {sidebarCollapsed ? <span className="sr-only">{item.label}</span> : item.label}
                  </Link>
                );
              })}

              {!sidebarCollapsed && (
                <span className="mt-4 block px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Studios</span>
              )}
              {studios.map((item) => {
                const active = isActiveRoute(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={sidebarCollapsed ? item.label : undefined}
                    className={cn(
                      'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      sidebarCollapsed && 'justify-center px-2',
                      active
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
                    )}
                  >
                    <item.icon size={16} />
                    {sidebarCollapsed ? <span className="sr-only">{item.label}</span> : item.label}
                  </Link>
                );
              })}
            </nav>

            <div className="border-t border-border px-4 py-4">
              {user ? (
                <>
                  <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Active session
                    {roles.length > 0 && (
                      <span className="rounded bg-secondary px-1.5 py-0.5 font-medium text-secondary-foreground">
                        {roles[0]}
                      </span>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    className="w-full justify-center gap-2 text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      void handleLogout();
                    }}
                    disabled={isLoading}
                  >
                    <LogOut size={14} />
                    {isLoading ? 'Signing out...' : 'Sign out'}
                  </Button>
                </>
              ) : (
                <div className="space-y-2">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-9 w-full rounded-lg" />
                </div>
              )}
            </div>
          </div>
        </aside>

        <main className="flex-1 min-w-0 bg-background">
          <header className="sticky top-0 z-10 border-b border-border bg-card/80 backdrop-blur-sm">
            <div className="flex h-14 items-center justify-between px-4 md:px-5">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setMobileOpen(true)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background text-foreground md:hidden"
                >
                  <Menu size={16} />
                </button>
                {user ? (
                  <h2 className="text-sm font-medium text-foreground">
                    Welcome, {displayName.split(' ')[0]}
                  </h2>
                ) : (
                  <Skeleton className="h-4 w-28" />
                )}
              </div>
              <div className="flex items-center gap-2">
                {user ? (
                  <>
                    {roles.length > 0 ? (
                      roles.map((role) => (
                        <span key={role} className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">
                          {role}
                        </span>
                      ))
                    ) : (
                      <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">
                        member
                      </span>
                    )}
                    <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                      {permissions.length} perms
                    </span>
                  </>
                ) : (
                  <>
                    <Skeleton className="h-5 w-14 rounded-full" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </>
                )}
              </div>
            </div>
          </header>

          <div className="p-4 md:p-5">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

function MobileNav({
  pathname,
  user,
  displayName,
  initial,
  roles,
  onClose,
  onLogout,
  isLoading,
}: {
  pathname: string;
  user: any;
  displayName: string;
  initial: string;
  roles: string[];
  onClose: () => void;
  onLogout: () => void;
  isLoading: boolean;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-4">
        <p className="text-sm font-semibold text-foreground">Menu</p>
        <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground">
          <X size={16} />
        </button>
      </div>

      <div className="border-b border-border px-4 py-4">
        {user ? (
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground">
              {initial}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{displayName}</p>
              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            </div>
          </div>
        ) : null}
      </div>

      <nav className="flex-1 space-y-0.5 px-3 py-3">
        <span className="px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Dashboard</span>
        {navigation.map((item) => {
          const active = isActiveRoute(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={cn(
                'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
              )}
            >
              <item.icon size={16} />
              {item.label}
            </Link>
          );
        })}

        <span className="mt-4 block px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Studios</span>
        {studios.map((item) => {
          const active = isActiveRoute(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={cn(
                'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
              )}
            >
              <item.icon size={16} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border px-4 py-4">
        <Button
          variant="ghost"
          className="w-full justify-center gap-2 text-muted-foreground hover:text-foreground"
          onClick={onLogout}
          disabled={isLoading}
        >
          <LogOut size={14} />
          {isLoading ? 'Signing out...' : 'Sign out'}
        </Button>
      </div>
    </div>
  );
}
