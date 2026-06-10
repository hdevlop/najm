import React from 'react';
import { NCard, NCardAction, NCardFooter, NStatCard, NButton, Badge, NLoadingState, NEmptyState, NErrorState } from 'najm-kit';
import { ComponentPage } from '../ComponentPage';
import { Example } from '../Example';
import { CheckCircle2, Star, Users, FileText } from 'lucide-react';

const planFeatures = [
  { label: '2 team members', included: true },
  { label: '20GB Cloud storage', included: true },
  { label: 'Integration help', included: true },
  { label: 'Sketch Files', included: false },
  { label: 'API Access', included: false },
  { label: 'Complete documentation', included: false },
  { label: '24x7 phone & email support', included: false },
];

const customers = [
  { name: 'Neil Sims', email: 'neil@windster.com', amount: '$320', avatar: 'NS' },
  { name: 'Bonnie Green', email: 'bonnie@windster.com', amount: '$3467', avatar: 'BG' },
  { name: 'Michael Gough', email: 'michael@windster.com', amount: '$67', avatar: 'MG' },
  { name: 'Lana Byrd', email: 'lana@windster.com', amount: '$367', avatar: 'LB' },
  { name: 'Thomas Lean', email: 'thomas@windster.com', amount: '$2367', avatar: 'TL' },
];

export function CardPage() {
  return (
    <ComponentPage
      title="NCard"
      description="A smart card with built-in header props, async states, and compound NCardAction / NCardFooter slots."
      category="Card"
    >
      <Example
        title="Basic"
        description="title and description as props — no sub-components needed."
        code={`import { NCard } from 'najm-kit';

<NCard title="Card title" description="A brief description goes here.">
  <p className="text-sm text-muted-foreground">Card content area.</p>
</NCard>`}
      >
        <NCard title="Card title" description="A brief description goes here." className="w-[360px]">
          <p className="text-sm text-muted-foreground">Card content area.</p>
        </NCard>
      </Example>

      <Example
        title="With icon"
        description="icon accepts a string name or a component — same as Button's leftIcon."
        code={`// string name
<NCard title="Monthly Revenue" description="Last 30 days" icon="bar-chart-3">
  <p className="text-2xl font-bold">$12,430</p>
</NCard>

// component
<NCard title="Active Users" description="This week" icon={Users}>
  <p className="text-2xl font-bold">1,240</p>
</NCard>`}
      >
        <div className="flex flex-row gap-4 w-full">
          <NCard title="Monthly Revenue" description="Last 30 days" icon="bar-chart-3" className="flex-1">
            <p className="text-2xl font-bold">$12,430</p>
          </NCard>
          <NCard title="Active Users" description="This week" icon={Users} className="flex-1">
            <p className="text-2xl font-bold">1,240</p>
          </NCard>
        </div>
      </Example>

      <Example
        title="Separator"
        description="Add separator to draw a line between the header and content."
        code={`<NCard title="Team members" description="Manage access" separator>
  <p className="text-sm text-muted-foreground">Content below the line.</p>
</NCard>`}
      >
        <NCard title="Team members" description="Manage access" separator className="w-[360px]">
          <p className="text-sm text-muted-foreground">Content below the line.</p>
        </NCard>
      </Example>

      <Example
        title="Bordered"
        description="Use bordered to make the card border more visible."
        code={`<NCard bordered title="Monthly Revenue" description="Last 30 days" icon="bar-chart-3">
  <p className="text-2xl font-bold">$12,430</p>
</NCard>`}
      >
        <NCard bordered title="Monthly Revenue" description="Last 30 days" icon="bar-chart-3" className="w-[360px]">
          <p className="text-2xl font-bold">$12,430</p>
        </NCard>
      </Example>

      <Example
        title="NCardAction"
        description="Place NCardAction inside children — extracted and rendered in the header."
        code={`import { NCard, NCardAction } from 'najm-kit';

<NCard title="Team members" description="Invite and manage your team.">
  <NCardAction>
    <NButton variant="outline" size="sm">Invite</NButton>
  </NCardAction>

  {['Alice', 'Bob', 'Charlie'].map((name) => (
    <div key={name} className="flex items-center justify-between py-1">
      <span className="text-sm font-medium">{name}</span>
      <Badge variant="secondary">Member</Badge>
    </div>
  ))}
</NCard>`}
      >
        <NCard title="Team members" description="Invite and manage your team." className="w-[360px]">
          <NCardAction>
            <NButton variant="outline" size="sm">Invite</NButton>
          </NCardAction>
          {['Alice', 'Bob', 'Charlie'].map((name) => (
            <div key={name} className="flex items-center justify-between py-1">
              <span className="text-sm font-medium">{name}</span>
              <Badge variant="secondary">Member</Badge>
            </div>
          ))}
        </NCard>
      </Example>

      <Example
        title="NCardFooter"
        description="Place NCardFooter inside children — extracted and rendered below a border."
        code={`import { NCard, NCardFooter } from 'najm-kit';

<NCard title="Subscription plan" description="You are on the Free plan.">
  <p className="text-sm text-muted-foreground">
    Upgrade to unlock unlimited projects and priority support.
  </p>
  <NCardFooter>
    <div className="flex justify-between w-full">
      <NButton variant="outline">Cancel</NButton>
      <NButton>Upgrade plan</NButton>
    </div>
  </NCardFooter>
</NCard>`}
      >
        <NCard title="Subscription plan" description="You are on the Free plan." className="w-[360px]">
          <p className="text-sm text-muted-foreground">
            Upgrade to unlock unlimited projects and priority support.
          </p>
          <NCardFooter>
            <div className="flex justify-between w-full">
              <NButton variant="outline">Cancel</NButton>
              <NButton>Upgrade plan</NButton>
            </div>
          </NCardFooter>
        </NCard>
      </Example>

      <Example
        title="Action + Footer"
        previewHeight="h-[500px]"
        code={`<NCard title="Latest Customers" icon={Users}>
  <NCardAction>
    <NButton variant="link" size="sm" className="px-0">View all</NButton>
  </NCardAction>

  <div className="divide-y divide-border">
    {customers.map((c) => (
      <div key={c.name} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
          {c.avatar}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-sm">{c.name}</div>
          <div className="truncate text-xs text-muted-foreground">{c.email}</div>
        </div>
        <div className="text-sm font-semibold">{c.amount}</div>
      </div>
    ))}
  </div>

  <NCardFooter>
    <NButton variant="outline" className="w-full" size="sm">Export</NButton>
  </NCardFooter>
</NCard>`}
      >
        <NCard title="Latest Customers" icon={Users} className="w-full max-w-sm">
          <NCardAction>
            <NButton variant="link" size="sm" className="px-0">View all</NButton>
          </NCardAction>
          <div className="divide-y divide-border">
            {customers.map((c) => (
              <div key={c.name} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                  {c.avatar}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm">{c.name}</div>
                  <div className="truncate text-xs text-muted-foreground">{c.email}</div>
                </div>
                <div className="text-sm font-semibold">{c.amount}</div>
              </div>
            ))}
          </div>
          <NCardFooter>
            <NButton variant="outline" className="w-full" size="sm">Export</NButton>
          </NCardFooter>
        </NCard>
      </Example>

      <Example
        title="Loading / Error / Empty"
        description="Use NLoadingState, NErrorState, and NEmptyState as children for full control."
        previewHeight="h-[360px]"
        code={`import { NCard, NLoadingState, NErrorState, NEmptyState } from 'najm-kit';

<NCard title="Revenue">
  <NLoadingState label="Fetching data..." />
</NCard>

<NCard title="Transactions">
  <NErrorState message="Could not connect." onRetry={() => refetch()} />
</NCard>

<NCard title="Invoices" icon="file-text">
  <NEmptyState title="No invoices yet" description="Create your first to get started." icon={FileText} />
</NCard>`}
      >
        <div className="flex flex-row gap-4 w-full">
          <NCard title="Revenue" className="flex-1">
            <NLoadingState label="Fetching data..." />
          </NCard>
          <NCard title="Transactions" className="flex-1">
            <NErrorState message="Could not connect." onRetry={() => {}} />
          </NCard>
          <NCard title="Invoices" icon="file-text" className="flex-1">
            <NEmptyState title="No invoices yet" description="Create your first to get started." icon={FileText} />
          </NCard>
        </div>
      </Example>

      <Example
        title="NStatCard — default"
        description="Stat card with value, label, icon, and optional trend badge."
        code={`import { NStatCard } from 'najm-kit';

<NStatCard icon="dollar-sign" label="Total Revenue" value="$45,231" change={{ value: "+20.1%", positive: true }} subtext="vs last month" />
<NStatCard icon="users" label="Active Users" value="2,350" change={{ value: "+5.2%", positive: true }} />
<NStatCard icon="shopping-cart" label="Orders" value="1,234" change={{ value: "-3.1%", positive: false }} />
<NStatCard icon="trending-up" label="Conversion" value="3.2%" />`}
      >
        <div className="grid grid-cols-2 gap-4 w-full">
          <NStatCard icon="dollar-sign" label="Total Revenue" value="$45,231" change={{ value: "+20.1%", positive: true }} subtext="vs last month" />
          <NStatCard icon="users" label="Active Users" value="2,350" change={{ value: "+5.2%", positive: true }} />
          <NStatCard icon="shopping-cart" label="Orders" value="1,234" change={{ value: "-3.1%", positive: false }} />
          <NStatCard icon="trending-up" label="Conversion" value="3.2%" />
        </div>
      </Example>

      <Example
        title="NStatCard — compact"
        description="Smaller inline stat for dense dashboards."
        code={`<NStatCard variant="compact" icon="dollar-sign" label="Revenue" value="$12,430" />
<NStatCard variant="compact" icon="user-check" label="Users" value="840" iconColor="text-emerald-500" />
<NStatCard variant="compact" icon="shopping-cart" label="Orders" value="312" iconColor="text-amber-500" />
<NStatCard variant="compact" icon="trending-up" label="Growth" value="14%" unit="MoM" iconColor="text-blue-500" />`}
      >
        <div className="grid grid-cols-2 gap-3 w-full">
          <NStatCard variant="compact" icon="dollar-sign" label="Revenue" value="$12,430" />
          <NStatCard variant="compact" icon="user-check" label="Users" value="840" iconColor="text-emerald-500" />
          <NStatCard variant="compact" icon="shopping-cart" label="Orders" value="312" iconColor="text-amber-500" />
          <NStatCard variant="compact" icon="trending-up" label="Growth" value="14%" unit="MoM" iconColor="text-blue-500" />
        </div>
      </Example>

      <Example
        title="NStatCard — usage"
        description="Usage variant with progress bar for storage or quota tracking."
        code={`<NStatCard
  variant="usage"
  icon={FileText}
  label="Documents"
  count={128}
  used={536870912}
  total={1073741824}
  iconColor="text-blue-400"
  accentColor="#3b82f6"
/>`}
      >
        <div className="grid grid-cols-2 gap-4 w-full">
          <NStatCard variant="usage" icon="file-text" label="Documents" count={128} used={536870912} total={1073741824} iconColor="text-blue-400" accentColor="#3b82f6" />
          <NStatCard variant="usage" icon="shopping-cart" label="Orders" count={312} used={734003200} total={2147483648} iconColor="text-amber-400" accentColor="#f59e0b" />
        </div>
      </Example>

      <Example
        title="Pricing card"
        previewHeight="h-[560px]"
        code={`<NCard title="Standard plan" className="w-full max-w-sm">
  <div className="flex items-end gap-2 my-2">
    <span className="text-5xl font-bold">$49</span>
    <span className="pb-1 text-muted-foreground">/month</span>
  </div>
  <div className="space-y-3">
    {features.map((f) => (
      <div key={f.label} className="flex items-center gap-3 text-sm">
        <CheckCircle2 className="size-4 shrink-0 text-blue-500" />
        <span className={f.included ? '' : 'text-muted-foreground line-through'}>{f.label}</span>
      </div>
    ))}
  </div>
  <NCardFooter>
    <NButton className="w-full">Choose plan</NButton>
  </NCardFooter>
</NCard>`}
      >
        <NCard title="Standard plan" className="w-full max-w-sm">
          <div className="flex items-end gap-2 my-2">
            <span className="text-5xl font-bold tracking-tight">$49</span>
            <span className="pb-1 text-muted-foreground">/month</span>
          </div>
          <div className="space-y-3">
            {planFeatures.map((f) => (
              <div key={f.label} className="flex items-center gap-3 text-sm">
                <CheckCircle2 className="size-4 shrink-0 text-blue-500" />
                <span className={f.included ? '' : 'text-muted-foreground line-through'}>{f.label}</span>
              </div>
            ))}
          </div>
          <NCardFooter>
            <NButton className="w-full">Choose plan</NButton>
          </NCardFooter>
        </NCard>
      </Example>

      <Example
        title="Product card"
        previewHeight="h-[560px]"
        code={`<NCard className="w-full max-w-sm">
  <div className="aspect-[4/3] rounded-lg bg-gradient-to-br from-slate-800 to-blue-950" />
  <div className="flex items-center gap-1 mt-1">
    {Array.from({ length: 5 }).map((_, i) => (
      <Star key={i} className="size-4 fill-amber-400 text-amber-400" />
    ))}
    <Badge className="ml-3">4.8 out of 5</Badge>
  </div>
  <h3 className="text-xl font-bold leading-tight">
    Apple Watch Series 7 GPS, Aluminium Case
  </h3>
  <NCardFooter>
    <div className="flex w-full items-center justify-between">
      <span className="text-3xl font-bold">$599</span>
      <NButton leftIcon="shopping-cart">Add to cart</NButton>
    </div>
  </NCardFooter>
</NCard>`}
      >
        <NCard className="w-full max-w-sm">
          <div className="flex aspect-[4/3] items-center justify-center rounded-lg bg-gradient-to-br from-slate-800 via-slate-900 to-blue-950 p-6">
            <div className="relative flex items-end justify-center -space-x-4">
              <div className="h-28 w-20 -rotate-12 rounded-[1.6rem] border border-slate-500 bg-slate-950 shadow-2xl" />
              <div className="z-10 flex h-36 w-28 items-center justify-center rounded-[2rem] border border-amber-200/40 bg-black shadow-2xl">
                <div className="size-20 rounded-full border-4 border-blue-500/80 bg-[radial-gradient(circle_at_center,_#f59e0b_0_10%,_#22c55e_11%_18%,_#0f172a_19%_100%)]" />
              </div>
              <div className="h-28 w-20 rotate-12 rounded-[1.6rem] border border-slate-600 bg-slate-950 shadow-2xl" />
            </div>
          </div>
          <div className="flex items-center gap-1 mt-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} className="size-4 fill-amber-400 text-amber-400" />
            ))}
            <Badge className="ml-3">4.8 out of 5</Badge>
          </div>
          <h3 className="text-xl font-bold leading-tight">
            Apple Watch Series 7 GPS, Aluminium Case, Starlight
          </h3>
          <NCardFooter>
            <div className="flex w-full items-center justify-between">
              <span className="text-3xl font-bold">$599</span>
              <NButton leftIcon="shopping-cart">Add to cart</NButton>
            </div>
          </NCardFooter>
        </NCard>
      </Example>
    </ComponentPage>
  );
}
