import React from 'react';
import { CheckCircle2, HandCoins, Truck } from 'lucide-react';
import {
  NButton,
  NFullscreenToggle,
  NGlobalActions,
  NLanguageMenu,
  NNotifyContent,
  NNotifyFooter,
  NNotifyHeader,
  NNotifyList,
  NNotifyMenu,
  NNotifyRoot,
  NNotifyTrigger,
  NThemeToggle,
  NajmPreferencesProvider,
} from 'najm-kit';
import type { NNotifyItemData, NNotifyLabels } from 'najm-kit';
import { ComponentPage } from '../ComponentPage';
import { Example } from '../Example';

const labels: NNotifyLabels = {
  open: 'Open notifications',
  unread: (count) => `${count} unread notifications`,
  title: 'Notifications',
  loading: 'Loading notifications',
  emptyTitle: 'Nothing new',
  emptyDescription: 'New notifications appear here.',
  errorTitle: 'Could not load notifications',
  retry: 'Try again',
  markRead: 'Mark read',
  markingRead: 'Marking…',
  markAllRead: 'Mark all read',
  markingAll: 'Marking all…',
  view: 'View',
  viewAll: 'View all',
  unreadState: 'Unread',
  justNow: 'Just now',
};

const arabicLabels: NNotifyLabels = {
  ...labels,
  open: 'فتح الإشعارات',
  unread: (count) => `${count} إشعارات غير مقروءة`,
  title: 'الإشعارات',
  emptyTitle: 'لا جديد',
  markRead: 'تحديد كمقروء',
  markAllRead: 'تحديد الكل كمقروء',
  view: 'عرض',
  viewAll: 'عرض الكل',
  unreadState: 'غير مقروء',
  justNow: 'الآن',
};

const hourAgo = new Date(Date.now() - 3_600_000).toISOString();

const sample: NNotifyItemData[] = [
  {
    id: 'a',
    title: 'Contribution validated',
    body: 'A contribution was validated and credited to the budget.',
    href: '/contribution',
    read: false,
    createdAt: hourAgo,
    icon: HandCoins,
    tone: 'success',
  },
  {
    id: 'b',
    title: 'Delivery started',
    body: 'The order is out for delivery.',
    href: '/orders',
    read: false,
    createdAt: hourAgo,
    icon: Truck,
    tone: 'warning',
  },
  {
    id: 'c',
    title: 'Order delivered',
    body: 'The order was delivered and signed for.',
    href: '/orders',
    read: true,
    createdAt: hourAgo,
    icon: CheckCircle2,
  },
];

const longCopy: NNotifyItemData[] = [
  {
    id: 'long',
    title: 'A notification title long enough to prove the row truncates instead of widening the popover',
    body: 'And a body long enough to reach the third line, past which it is clamped rather than turning the preview into a page of its own. It keeps going for a while.',
    read: false,
    createdAt: hourAgo,
    icon: HandCoins,
  },
  ...sample,
];

const arabicItems: NNotifyItemData[] = [
  {
    id: 'ar-a',
    title: 'تم التحقق من المساهمة',
    body: 'تم التحقق من مساهمة وإضافتها إلى الميزانية.',
    read: false,
    createdAt: hourAgo,
    icon: HandCoins,
    tone: 'success',
  },
  {
    id: 'ar-b',
    title: 'تم توصيل الطلب',
    body: 'تم توصيل الطلب والتوقيع عليه.',
    read: true,
    createdAt: hourAgo,
    icon: CheckCircle2,
  },
];

const languages = [
  { value: 'en', label: 'English', icon: <span>🇺🇸</span>, iconLabel: 'United States' },
  { value: 'fr', label: 'Français', icon: <span>🇫🇷</span>, iconLabel: 'France' },
  { value: 'ar', label: 'العربية', icon: <span>🇲🇦</span>, iconLabel: 'Morocco' },
  { value: 'es', label: 'Español', icon: <span>🇪🇸</span>, iconLabel: 'Spain' },
] as const;

type Language = (typeof languages)[number]['value'];

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function LiveMenu() {
  const [items, setItems] = React.useState(sample);
  const [markReadPendingId, setMarkReadPendingId] = React.useState<string | null>(null);
  const [markAllPending, setMarkAllPending] = React.useState(false);
  const [log, setLog] = React.useState<string>('');

  const unreadCount = items.filter((item) => !item.read).length;

  return (
    <div className="flex items-center gap-3">
      <NNotifyMenu
        items={items}
        labels={labels}
        markAllPending={markAllPending}
        markReadPendingId={markReadPendingId}
        onError={(error, action) => setLog(`${action} failed: ${String(error)}`)}
        onMarkAllRead={async () => {
          setMarkAllPending(true);
          await wait(600);
          setItems((rows) => rows.map((row) => ({ ...row, read: true })));
          setMarkAllPending(false);
        }}
        onMarkRead={async (id) => {
          setMarkReadPendingId(id);
          await wait(600);
          setItems((rows) => rows.map((row) => (row.id === id ? { ...row, read: true } : row)));
          setMarkReadPendingId(null);
        }}
        onOpenItem={(item) => setLog(`opened ${item.id} → ${item.href}`)}
        onViewAll={() => setLog('view all')}
        unreadCount={unreadCount}
      />
      <NButton onClick={() => setItems(sample)} size="sm" variant="outline">
        Reset
      </NButton>
      <span className="text-sm text-muted-foreground">{log}</span>
    </div>
  );
}

function FailingMenu() {
  const [log, setLog] = React.useState('');
  return (
    <div className="flex items-center gap-3">
      <NNotifyMenu
        items={sample}
        labels={labels}
        onError={(error, action) =>
          setLog(`${action}: ${error instanceof Error ? error.message : String(error)}`)
        }
        onMarkAllRead={async () => {
          await wait(500);
          throw new Error('Network unavailable');
        }}
        onMarkRead={async () => {
          await wait(500);
          throw new Error('Network unavailable');
        }}
        onOpenItem={() => setLog('this should never run after a failed read')}
        unreadCount={2}
      />
      <span className="text-sm text-destructive">{log}</span>
    </div>
  );
}

/**
 * Defined at module scope on purpose. A component declared inside `LazyMenu`
 * would get a new identity on every render, so the mount counter below would
 * remount it forever instead of counting real opens.
 */
function ConnectedPreview({ onMount }: { onMount: () => void }) {
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    onMount();
    const timer = setTimeout(() => setLoading(false), 700);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount only
  }, []);

  return (
    <>
      <NNotifyHeader
        markAllLabel={labels.markAllRead}
        markingAllLabel={labels.markingAll}
        onMarkAllRead={() => wait(400)}
        title={labels.title}
      />
      <NNotifyList
        items={loading ? [] : sample}
        labels={labels}
        loading={loading}
        onMarkRead={() => wait(400)}
        onOpenItem={() => {}}
      />
      <NNotifyFooter asChild>
        <a href="#notifications">{labels.viewAll}</a>
      </NNotifyFooter>
    </>
  );
}

function LazyMenu() {
  const [open, setOpen] = React.useState(false);
  const [mounts, setMounts] = React.useState(0);
  const handleMount = React.useCallback(() => setMounts((count) => count + 1), []);

  return (
    <div className="flex items-center gap-3">
      <NNotifyRoot onOpenChange={setOpen} open={open}>
        <NNotifyTrigger label={labels.open} unreadCount={2} unreadLabel={labels.unread} />
        <NNotifyContent>
          <ConnectedPreview onMount={handleMount} />
        </NNotifyContent>
      </NNotifyRoot>
      <span className="text-sm text-muted-foreground">
        connected child mounted {mounts} time(s) — it only runs while the menu is open
      </span>
    </div>
  );
}

function ActionRow() {
  const [language, setLanguage] = React.useState<Language>('en');
  const [log, setLog] = React.useState('');

  return (
    <NajmPreferencesProvider initialTheme="light">
      <div className="flex items-center gap-3">
        <NGlobalActions>
          <NNotifyMenu
            items={sample}
            labels={labels}
            onMarkRead={() => wait(300)}
            onOpenItem={(item) => setLog(`open ${item.id}`)}
            onViewAll={() => setLog('view all')}
            unreadCount={2}
          />
          <NLanguageMenu
            label="Language"
            onChange={async (next) => {
              await wait(600);
              setLanguage(next);
              setLog(`language → ${next}`);
            }}
            onError={(error) => setLog(String(error))}
            options={languages}
            pendingLabel="Changing language"
            value={language}
          />
          <NThemeToggle label="Toggle color theme" onError={(error) => setLog(String(error))} />
          <NFullscreenToggle label="Toggle fullscreen" />
        </NGlobalActions>
        <span className="text-sm text-muted-foreground">{log}</span>
      </div>
    </NajmPreferencesProvider>
  );
}

export function GlobalActionsPage() {
  return (
    <ComponentPage
      category="Layout"
      description="The page-header action row every Najm dashboard grows: a notification bell with an unread badge and a preview list, a language menu, a theme toggle and a fullscreen toggle. Data, queries, routing, topics and persistence stay in the application."
      title="Global Actions & Notifications"
    >
      <Example
        previewHeight="h-[32rem]"
        code={`<NGlobalActions>
  <NNotifyMenu {...notifications} />
  <NLanguageMenu label="Language" onChange={changeLanguage} options={languages} value={language} />
  <NThemeToggle label="Toggle color theme" onError={showError} />
  <NFullscreenToggle label="Toggle fullscreen" />
</NGlobalActions>`}
        description="One container, four controls. The language change and the theme write are awaited, and both release their pending state on failure."
        title="The whole action row"
      >
        <ActionRow />
      </Example>

      <Example
        previewHeight="h-[32rem]"
        code={`<NNotifyMenu
  items={items}
  labels={labels}
  markAllPending={markAll.isPending}
  markReadPendingId={markRead.isPending ? markRead.variables : null}
  onMarkAllRead={() => markAll.mutateAsync()}
  onMarkRead={(id) => markRead.mutateAsync(id)}
  onOpenItem={(item) => router.push(item.href)}
  unreadCount={unreadCount}
/>`}
        description="Mark one row read, mark them all read, open a row. Each command is awaited and the badge follows the data."
        title="The preset, wired to state"
      >
        <LiveMenu />
      </Example>

      <Example
        previewHeight="h-[32rem]"
        code={`<NNotifyRoot open={open} onOpenChange={setOpen}>
  <NNotifyTrigger label={labels.open} unreadCount={2} unreadLabel={labels.unread} />
  <NNotifyContent>
    <ConnectedNotificationPreview />
  </NNotifyContent>
</NNotifyRoot>`}
        description="NNotifyContent does not render its children while the menu is closed, so a connected child can own the query and refetch on every open."
        title="Compound form with lazily mounted content"
      >
        <LazyMenu />
      </Example>

      <Example
        previewHeight="h-[32rem]"
        code={`<NNotifyMenu
  onError={(error, action) => report(action, error)}
  onMarkRead={async () => { throw new Error("Network unavailable"); }}
/>`}
        description="A rejected read never navigates, never closes the menu and leaves the row enabled. The failure is reported to the application, which owns the copy."
        title="Command failure"
      >
        <FailingMenu />
      </Example>

      <Example
        previewHeight="h-[32rem]"
        code={`<NNotifyMenu items={[]} labels={labels} loading unreadCount={0} />
<NNotifyMenu items={[]} labels={labels} error onRetry={refetch} unreadCount={0} />
<NNotifyMenu items={[]} labels={labels} unreadCount={0} />`}
        description="Loading, error with retry, and empty — all from the packaged feedback states."
        title="List states"
      >
        <div className="flex items-center gap-6">
          <NNotifyMenu defaultOpen={false} items={[]} labels={labels} loading unreadCount={0} />
          <NNotifyMenu
            error
            items={[]}
            labels={labels}
            onRetry={() => {}}
            unreadCount={0}
          />
          <NNotifyMenu items={[]} labels={labels} unreadCount={0} />
        </div>
      </Example>

      <Example
        previewHeight="h-[32rem]"
        code={`<NNotifyMenu unreadCount={0} />   {/* no badge */}
<NNotifyMenu unreadCount={5} />   {/* 5 */}
<NNotifyMenu unreadCount={99} />  {/* 99 */}
<NNotifyMenu unreadCount={132} /> {/* 99+ */}`}
        description="The badge hides at zero, shows a localized number to 99, and caps at 99+."
        title="Unread counts"
      >
        <div className="flex items-center gap-6">
          {[0, 5, 99, 132].map((count) => (
            <NNotifyMenu
              items={sample}
              key={count}
              labels={labels}
              locale="en"
              onOpenItem={() => {}}
              unreadCount={count}
            />
          ))}
        </div>
      </Example>

      <Example
        previewHeight="h-[32rem]"
        code={`<div dir="rtl">
  <NNotifyMenu items={arabicItems} labels={arabicLabels} unreadCount={1} />
</div>`}
        description="Arabic labels in an RTL container, with badge digits and timestamps in the Arabic locale. Long titles truncate and long bodies clamp instead of widening the popover."
        title="RTL and long copy"
      >
        <div className="flex items-center gap-6">
          <div dir="rtl">
            <NNotifyMenu
              items={arabicItems}
              labels={arabicLabels}
              locale="ar"
              onMarkRead={() => wait(300)}
              onOpenItem={() => {}}
              onViewAll={() => {}}
              unreadCount={7}
            />
          </div>
          <NNotifyMenu
            items={longCopy}
            labels={labels}
            onMarkRead={() => wait(300)}
            onOpenItem={() => {}}
            onViewAll={() => {}}
            unreadCount={3}
          />
        </div>
      </Example>
    </ComponentPage>
  );
}
