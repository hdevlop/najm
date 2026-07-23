import React from 'react';
import {
  Badge,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  NButton,
  NPageHeader,
  NPageHeaderActions,
  NPageHeaderCompactActions,
  NPageHeaderFilters,
  SelectInput,
  TextInput,
} from 'najm-kit';
import { BarChart3, CalendarDays, Download, Filter, LayoutDashboard, MoreHorizontal, Plus, Settings, Users } from 'lucide-react';
import { ComponentPage } from '../ComponentPage';
import { Example } from '../Example';

const rows = [
  { name: 'Admissions', owner: 'Mina Chen', status: 'Live', metric: '1,284' },
  { name: 'Attendance', owner: 'Omar Diallo', status: 'Review', metric: '94.2%' },
  { name: 'Fee collection', owner: 'Lina Saleh', status: 'Live', metric: '$48.2k' },
  { name: 'Teacher payroll', owner: 'Nora Park', status: 'Draft', metric: '$22.8k' },
  { name: 'Transport routes', owner: 'Yassine Amrani', status: 'Live', metric: '18' },
  { name: 'Exam schedule', owner: 'Priya Raman', status: 'Review', metric: '42' },
];

function MetricsGrid() {
  return (
    <div className="grid gap-3 p-4 sm:grid-cols-3">
      {[
        ['Active students', '2,418', '+12%'],
        ['Open invoices', '$18.4k', '-8%'],
        ['Today attendance', '94.2%', '+2.1%'],
      ].map(([label, value, delta]) => (
        <div key={label} className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <div className="mt-2 flex items-end justify-between gap-3">
            <p className="text-2xl font-semibold text-foreground">{value}</p>
            <Badge color={delta.startsWith('+') ? 'success' : 'warning'} look="soft">{delta}</Badge>
          </div>
        </div>
      ))}
    </div>
  );
}

function ReportRows() {
  return (
    <div className="divide-y divide-border px-4">
      {rows.map((row) => (
        <div key={row.name} className="grid grid-cols-[1fr_auto] gap-4 py-4 sm:grid-cols-[1.2fr_1fr_auto_auto] sm:items-center">
          <div>
            <p className="text-sm font-semibold text-foreground">{row.name}</p>
            <p className="text-xs text-muted-foreground sm:hidden">{row.owner}</p>
          </div>
          <p className="hidden text-sm text-muted-foreground sm:block">{row.owner}</p>
          <Badge color={row.status === 'Live' ? 'success' : row.status === 'Review' ? 'warning' : 'neutral'} look="outline">
            {row.status}
          </Badge>
          <p className="text-right text-sm font-semibold text-foreground">{row.metric}</p>
        </div>
      ))}
    </div>
  );
}

export function PageHeaderPage() {
  const [query, setQuery] = React.useState('');
  const [status, setStatus] = React.useState('all');

  return (
    <ComponentPage
      title="Page Header"
      description="A page-level top bar for title, subtitle, actions, search, and optional filter controls."
      category="Layout"
    >
      <Example
        title="Basic Header"
        description="Use NPageHeader as the top section, then render page content below it."
        previewHeight="h-[420px]"
        noPad
        center={false}
        code={`<NPageHeader
  icon={LayoutDashboard}
  title="Dashboard"
  subtitle="Operational overview"
>
  <NPageHeaderActions>
    <NButton><Plus size={16} /> New report</NButton>
  </NPageHeaderActions>
</NPageHeader>`}
      >
        <div className="flex h-full flex-col ">
          <NPageHeader
            icon={LayoutDashboard}
            title="Dashboard"
            subtitle="Operational overview"
          >
            <NPageHeaderActions>
              <NButton><Plus size={16} /> New report</NButton>
            </NPageHeaderActions>
          </NPageHeader>
          <div className="min-h-0 flex-1 overflow-auto">
            <MetricsGrid />
            <ReportRows />
          </div>
        </div>
      </Example>

      <Example
        title="Search And Actions"
        description="Pages can replace wide desktop actions with their own compact dropdown below the matching sidebar breakpoint. Omit NPageHeaderCompactActions to keep the normal actions at every size."
        previewHeight="h-[420px]"
        noPad
        center={false}
        code={`<NPageHeader
  icon={Users}
  title="Students"
  subtitle="2,418 records"
  mobileBreakpoint="lg"
  search={{ placeholder: 'Search students...' }}
>
  <NPageHeaderActions>
    <NButton variant="outline"><Download size={16} /> Export</NButton>
    <NButton><Plus size={16} /> Add</NButton>
  </NPageHeaderActions>
  <NPageHeaderCompactActions>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <NButton variant="ghost" size="icon" aria-label="Student actions">
          <MoreHorizontal size={18} />
        </NButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem><Download size={16} /> Export</DropdownMenuItem>
        <DropdownMenuItem><Plus size={16} /> Add student</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </NPageHeaderCompactActions>
</NPageHeader>`}
      >
        <div className="flex h-full flex-col">
          <NPageHeader
            icon={Users}
            title="Students"
            subtitle="2,418 records"
            mobileBreakpoint="lg"
            search={{ placeholder: 'Search students...', value: query, onChange: (event) => setQuery(event.target.value) }}
          >
            <NPageHeaderActions>
              <NButton variant="outline"><Download size={16} /> Export</NButton>
              <NButton><Plus size={16} /> Add</NButton>
            </NPageHeaderActions>
            <NPageHeaderCompactActions>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <NButton variant="ghost" size="icon" aria-label="Student actions">
                    <MoreHorizontal size={18} />
                  </NButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem><Download size={16} /> Export</DropdownMenuItem>
                  <DropdownMenuItem><Plus size={16} /> Add student</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </NPageHeaderCompactActions>
          </NPageHeader>
          <div className="border-b border-border px-4 py-2 text-xs text-muted-foreground">
            {query ? `Filtered by "${query}"` : 'Showing all student workspaces'}
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            <ReportRows />
          </div>
        </div>
      </Example>

      <Example
        title="Filters"
        description="Place filter controls in the header area and keep the page body separate."
        previewHeight="h-[460px]"
        noPad
        center={false}
        code={`<NPageHeader
  icon={CalendarDays}
  title="Calendar"
  subtitle="Events and reminders"
>
  <NPageHeaderFilters>
    <FilterBar />
  </NPageHeaderFilters>
</NPageHeader>`}
      >
        <div className="flex h-full flex-col">
          <NPageHeader
            icon={CalendarDays}
            title="Calendar"
            subtitle="Events and reminders"
          >
            <NPageHeaderActions>
              <NButton variant="outline"><Settings size={16} /> Settings</NButton>
            </NPageHeaderActions>

            <NPageHeaderFilters>
              <div className="flex flex-col gap-2 sm:flex-row">
                <TextInput icon={Filter} value={query} onChange={setQuery} placeholder="Filter reports" className="sm:max-w-xs" />
                <SelectInput
                  value={status}
                  onChange={setStatus}
                  items={[
                    { value: 'all', label: 'All statuses' },
                    { value: 'live', label: 'Live' },
                    { value: 'review', label: 'Review' },
                    { value: 'draft', label: 'Draft' },
                  ]}
                  className="sm:max-w-44"
                />
              </div>
            </NPageHeaderFilters>
          </NPageHeader>

          <div className="min-h-0 flex-1 overflow-auto">
            <MetricsGrid />
            <ReportRows />
            <ReportRows />
          </div>

          <div className="flex items-center justify-between border-t border-border bg-card px-4 py-3 text-sm">
            <span className="text-muted-foreground">Status: {status}</span>
            <NButton size="sm" variant="outline"><BarChart3 size={14} /> View report</NButton>
          </div>
        </div>
      </Example>
    </ComponentPage>
  );
}
