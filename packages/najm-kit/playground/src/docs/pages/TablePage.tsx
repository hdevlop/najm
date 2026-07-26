import React, { useState, useMemo } from 'react';
import type { ColumnDef, Row, RowSelectionState } from '@tanstack/react-table';
import { NTable, NPageHeader, NPageHeaderActions, NButton, Badge, Switch, type TableHeaderColor, type NTableColumnDef } from 'najm-kit';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuLabel, DropdownMenuSeparator,
  DropdownMenuCheckboxItem, DropdownMenuRadioGroup, DropdownMenuRadioItem,
} from 'najm-kit';
import { User, Users, Shield, Calendar, Settings2, Palette, SlidersHorizontal, MousePointerClick, Plus } from 'lucide-react';
import { ComponentPage } from '../ComponentPage';
import { Example } from '../Example';

// ── Data ──────────────────────────────────────────────────────────────────────

type Member = {
  id: string;
  name: string;
  email: string;
  role: 'Admin' | 'Member' | 'Viewer';
  status: 'Active' | 'Inactive' | 'Pending';
  joined: string;
  department: string;
};

const MEMBERS: Member[] = [
  { id: '1',  name: 'Alice Martin',  email: 'alice@example.com',  role: 'Admin',  status: 'Active',   joined: 'Jan 12, 2024', department: 'Engineering' },
  { id: '2',  name: 'Bob Chen',      email: 'bob@example.com',    role: 'Member', status: 'Active',   joined: 'Feb 3, 2024',  department: 'Design' },
  { id: '3',  name: 'Carol White',   email: 'carol@example.com',  role: 'Viewer', status: 'Inactive', joined: 'Mar 22, 2024', department: 'Marketing' },
  { id: '4',  name: 'David Kim',     email: 'david@example.com',  role: 'Member', status: 'Pending',  joined: 'Apr 15, 2024', department: 'Engineering' },
  { id: '5',  name: 'Eve Johnson',   email: 'eve@example.com',    role: 'Member', status: 'Active',   joined: 'May 1, 2024',  department: 'Sales' },
  { id: '6',  name: 'Frank Lee',     email: 'frank@example.com',  role: 'Admin',  status: 'Active',   joined: 'Jun 2, 2024',  department: 'Engineering' },
  { id: '7',  name: 'Grace Park',    email: 'grace@example.com',  role: 'Member', status: 'Pending',  joined: 'Jun 8, 2024',  department: 'Design' },
  { id: '8',  name: 'Henry Adams',   email: 'henry@example.com',  role: 'Viewer', status: 'Active',   joined: 'Jun 14, 2024', department: 'Marketing' },
  { id: '9',  name: 'Iris Scott',    email: 'iris@example.com',   role: 'Member', status: 'Inactive', joined: 'Jun 20, 2024', department: 'HR' },
  { id: '10', name: 'Jake Rivera',   email: 'jake@example.com',   role: 'Member', status: 'Active',   joined: 'Jun 28, 2024', department: 'Engineering' },
  { id: '11', name: 'Karen Wu',      email: 'karen@example.com',  role: 'Viewer', status: 'Active',   joined: 'Jul 5, 2024',  department: 'Sales' },
  { id: '12', name: 'Leo Morgan',    email: 'leo@example.com',    role: 'Member', status: 'Pending',  joined: 'Jul 12, 2024', department: 'Design' },
  { id: '13', name: 'Mia Thompson',  email: 'mia@example.com',    role: 'Admin',  status: 'Active',   joined: 'Jul 19, 2024', department: 'HR' },
  { id: '14', name: 'Noah Garcia',   email: 'noah@example.com',   role: 'Member', status: 'Inactive', joined: 'Jul 25, 2024', department: 'Engineering' },
  { id: '15', name: 'Olivia Brown',  email: 'olivia@example.com', role: 'Viewer', status: 'Active',   joined: 'Aug 1, 2024',  department: 'Marketing' },
  { id: '16', name: 'Peter Wilson',  email: 'peter@example.com',  role: 'Member', status: 'Active',   joined: 'Aug 8, 2024',  department: 'Engineering' },
  { id: '17', name: 'Quinn Davis',   email: 'quinn@example.com',  role: 'Admin',  status: 'Active',   joined: 'Aug 15, 2024', department: 'HR' },
  { id: '18', name: 'Rachel Miller', email: 'rachel@example.com', role: 'Member', status: 'Pending',  joined: 'Aug 22, 2024', department: 'Design' },
  { id: '19', name: 'Sam Patel',     email: 'sam@example.com',    role: 'Viewer', status: 'Active',   joined: 'Aug 29, 2024', department: 'Sales' },
  { id: '20', name: 'Tina Roberts',  email: 'tina@example.com',   role: 'Member', status: 'Inactive', joined: 'Sep 3, 2024',  department: 'Marketing' },
  { id: '21', name: 'Umar Hassan',   email: 'umar@example.com',   role: 'Admin',  status: 'Active',   joined: 'Sep 10, 2024', department: 'Engineering' },
  { id: '22', name: 'Vera Ivanov',   email: 'vera@example.com',   role: 'Member', status: 'Active',   joined: 'Sep 17, 2024', department: 'Design' },
  { id: '23', name: 'Will Carter',   email: 'will@example.com',   role: 'Viewer', status: 'Pending',  joined: 'Sep 24, 2024', department: 'HR' },
  { id: '24', name: 'Xenia Lopez',   email: 'xenia@example.com',  role: 'Member', status: 'Active',   joined: 'Oct 1, 2024',  department: 'Sales' },
  { id: '25', name: 'Yusuf Ahmed',   email: 'yusuf@example.com',  role: 'Member', status: 'Active',   joined: 'Oct 8, 2024',  department: 'Engineering' },
  { id: '26', name: 'Zoe Foster',    email: 'zoe@example.com',    role: 'Admin',  status: 'Inactive', joined: 'Oct 15, 2024', department: 'Marketing' },
  { id: '27', name: 'Adam Novak',    email: 'adam@example.com',   role: 'Viewer', status: 'Active',   joined: 'Oct 22, 2024', department: 'HR' },
  { id: '28', name: 'Bethany Cole',  email: 'bethany@example.com',role: 'Member', status: 'Active',   joined: 'Oct 29, 2024', department: 'Design' },
  { id: '29', name: 'Carlos Reyes',  email: 'carlos@example.com', role: 'Member', status: 'Pending',  joined: 'Nov 5, 2024',  department: 'Engineering' },
  { id: '30', name: 'Diana Singh',   email: 'diana@example.com',  role: 'Viewer', status: 'Active',   joined: 'Nov 12, 2024', department: 'Sales' },
];

// ── Columns ───────────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, 'success' | 'warning' | 'destructive'> = {
  Active: 'success', Pending: 'warning', Inactive: 'destructive',
};
const ROLE_COLOR: Record<string, 'success' | 'warning' | 'neutral'> = {
  Admin: 'success', Member: 'neutral', Viewer: 'warning',
};

const BASE_COLUMNS: ColumnDef<Member>[] = [
  {
    accessorKey: 'name',
    header: 'Name',
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary text-xs font-semibold">
          {row.original.name.charAt(0)}
        </div>
        <span className="font-medium">{row.original.name}</span>
      </div>
    ),
  },
  {
    accessorKey: 'email',
    header: 'Email',
    cell: ({ getValue }) => <span className="text-muted-foreground text-sm">{getValue() as string}</span>,
  },
  {
    accessorKey: 'role',
    header: 'Role',
    cell: ({ getValue }) => {
      const v = getValue() as string;
      return <Badge color={ROLE_COLOR[v]} look="soft" className="text-xs">{v}</Badge>;
    },
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ getValue }) => {
      const v = getValue() as string;
      return <Badge color={STATUS_COLOR[v]} look="soft" className="text-xs">{v}</Badge>;
    },
  },
  {
    accessorKey: 'department',
    header: 'Department',
    cell: ({ getValue }) => <span className="text-sm text-muted-foreground">{getValue() as string}</span>,
  },
  {
    accessorKey: 'joined',
    header: 'Joined',
    cell: ({ getValue }) => <span className="text-xs text-muted-foreground">{getValue() as string}</span>,
  },
];

// ── Responsive columns ────────────────────────────────────────────────────────

function RESPONSIVE_COLUMNS(canReadEmail: boolean): NTableColumnDef<Member>[] {
  return [
    { accessorKey: 'name', header: 'Name' },
    {
      accessorKey: 'email',
      header: 'Email',
      meta: {
        visible: canReadEmail,
        hiddenBelow: 'lg',
      },
    },
    { accessorKey: 'role', header: 'Role' },
    { accessorKey: 'status', header: 'Status' },
    {
      accessorKey: 'department',
      header: 'Department',
      meta: { hiddenBelow: 'lg' },
    },
    { accessorKey: 'joined', header: 'Joined' },
  ];
}

// ── Card renderer ─────────────────────────────────────────────────────────────

function MemberCard({ data }: { data: Member; row: Row<Member> }) {
  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary font-bold text-sm">
          {data.name.charAt(0)}
        </div>
        <div className="min-w-0">
          <p className="font-semibold truncate">{data.name}</p>
          <p className="text-xs text-muted-foreground truncate">{data.email}</p>
        </div>
        <Badge color={STATUS_COLOR[data.status]} look="soft" className="ml-auto text-xs shrink-0">
          {data.status}
        </Badge>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5"><Shield size={11} />{data.role}</div>
        <div className="flex items-center gap-1.5"><User size={11} />{data.department}</div>
        <div className="flex items-center gap-1.5 col-span-2"><Calendar size={11} />Joined {data.joined}</div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

type TableState = 'normal' | 'loading' | 'error' | 'empty';
type Density = 'compact' | 'comfortable' | 'spacious';

const COLOR_SWATCHES: Record<TableHeaderColor | 'default', string> = {
  default: 'bg-slate-600 border border-slate-500',
  primary: 'bg-primary',
  violet:  'bg-violet-600',
  blue:    'bg-blue-600',
  emerald: 'bg-emerald-600',
  amber:   'bg-amber-500',
  rose:    'bg-rose-600',
  slate:   'bg-slate-600',
};

const buildOptions = (key: 'role' | 'status' | 'department') => {
  const counts = MEMBERS.reduce<Record<string, number>>((acc, m) => {
    const v = m[key];
    acc[v] = (acc[v] ?? 0) + 1;
    return acc;
  }, {});
  return Object.entries(counts).map(([v, n]) => ({ value: v, label: `${v} (${n})` }));
};

export function TablePage() {
  const [tableState, setTableState]                     = useState<TableState>('normal');
  const [density, setDensity]                           = useState<Density>('comfortable');
  const [showPagination, setShowPagination]             = useState(true);
  const [showSorting, setShowSorting]                   = useState(true);
  const [showColumnVisibility, setShowColumnVisibility] = useState(true);
  const [showCheckbox, setShowCheckbox]                 = useState(true);
  const [showAddButton, setShowAddButton]               = useState(false);
  const [showViewToggle, setShowViewToggle]             = useState(true);
  const [enableCards, setEnableCards]                   = useState(true);
  const [enableEdit, setEnableEdit]                     = useState(true);
  const [enableDelete, setEnableDelete]                 = useState(true);
  const [enableView, setEnableView]                     = useState(false);
  const [useMenuButton, setUseMenuButton]               = useState(true);
  const [toolbarLabels, setToolbarLabels]               = useState(true);
  const [bordered, setBordered]                         = useState(false);
  const [colorThemeKey, setColorThemeKey]               = useState<TableHeaderColor | 'default'>('default');
  const [rowSelection, setRowSelection]                 = useState<RowSelectionState>({});
  const [canReadEmail, setCanReadEmail]                 = useState(true);

  const baseData = tableState === 'empty' ? [] : MEMBERS;
  const selectedCount = Object.values(rowSelection).filter(Boolean).length;

  const codeString = useMemo(() => {
    const lines: string[] = [];

    // Imports
    const imports = ["NTable", "Badge"];
    if (enableCards) imports.push("type { NTableProps }");
    lines.push(`import { useState } from 'react';`);
    lines.push(`import { ${imports.filter(s => !s.startsWith('type')).join(', ')} } from 'najm-kit';`);
    lines.push(`import type { ColumnDef } from '@tanstack/react-table';`);
    lines.push('');

    // Type
    lines.push(`type Member = {`);
    lines.push(`  id: string;`);
    lines.push(`  name: string;`);
    lines.push(`  email: string;`);
    lines.push(`  role: 'Admin' | 'Member' | 'Viewer';`);
    lines.push(`  status: 'Active' | 'Inactive' | 'Pending';`);
    lines.push(`  department: string;`);
    lines.push(`  joined: string;`);
    lines.push(`};`);
    lines.push('');

    // Columns
    lines.push(`const columns: ColumnDef<Member>[] = [`);
    lines.push(`  { accessorKey: 'name',       header: 'Name' },`);
    lines.push(`  { accessorKey: 'email',      header: 'Email' },`);
    lines.push(`  { accessorKey: 'role',       header: 'Role' },`);
    lines.push(`  { accessorKey: 'status',     header: 'Status' },`);
    lines.push(`  { accessorKey: 'department', header: 'Department' },`);
    lines.push(`  { accessorKey: 'joined',     header: 'Joined' },`);
    lines.push(`];`);
    lines.push('');

    // Card component (if enabled)
    if (enableCards) {
      lines.push(`function MemberCard({ data }: { data: Member }) {`);
      lines.push(`  return (`);
      lines.push(`    <div className="p-4">`);
      lines.push(`      <p className="font-semibold">{data.name}</p>`);
      lines.push(`      <p className="text-sm text-muted-foreground">{data.email}</p>`);
      lines.push(`      <Badge color="success" look="soft">{data.status}</Badge>`);
      lines.push(`    </div>`);
      lines.push(`  );`);
      lines.push(`}`);
      lines.push('');
    }

    // Component
    lines.push(`export function MembersTable() {`);
    lines.push(`  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});`);
    lines.push('');
    lines.push(`  return (`);

    // NTable props
    const p: string[] = [];
    p.push(`      data={members}`);
    p.push(`      columns={columns}`);
    p.push(`      getRowId={(row) => row.id}`);
    if (tableState === 'loading') p.push(`      loading`);
    if (tableState === 'error')   p.push(`      error="Failed to load data."`);
    if (density !== 'comfortable') p.push(`      density="${density}"`);
    if (bordered)             p.push(`      bordered`);
    if (!showPagination)      p.push(`      showPagination={false}`);
    if (!showSorting)         p.push(`      showSorting={false}`);
    if (showColumnVisibility) p.push(`      showColumnVisibility`);
    if (!showCheckbox)        p.push(`      showCheckbox={false}`);
    p.push(`      rowSelection={rowSelection}`);
    p.push(`      onRowSelectionChange={setRowSelection}`);
    if (showAddButton)        p.push(`      showAddButton\n      onCreate={() => setDialogOpen(true)}`);
    if (!showViewToggle)      p.push(`      showViewToggle={false}`);
    if (!toolbarLabels)       p.push(`      toolbarLabels={false}`);
    const modes = enableCards ? `{['table', 'cards', 'json']}` : `{['table', 'json']}`;
    p.push(`      availableModes=${modes}`);
    if (enableCards) p.push(`      renderCard={MemberCard}`);
    p.push(`      jsonValue={members}`);
    if (enableView)   p.push(`      onView={(row) => openView(row)}`);
    if (enableEdit)   p.push(`      onEdit={(row) => openEdit(row)}`);
    if (enableDelete) p.push(`      onDelete={(row) => confirmDelete(row)}`);
    if (!useMenuButton) p.push(`      menuButton={false}`);
    p.push(`      menu={{
        background: () => [
          { label: 'Select all', onSelect: () => setRowSelection(Object.fromEntries(members.map((row) => [row.id, true]))) },
          { label: 'Clear selection', onSelect: () => setRowSelection({}) },
          { label: 'Create new member', separatorBefore: true, onSelect: () => openCreate() },
        ],
      }}`);
    if (colorThemeKey !== 'default') p.push(`      headerColor="${colorThemeKey}"`);

    lines.push(`    <NTable<Member>`);
    lines.push(p.join('\n'));
    lines.push(`    />`);
    lines.push(`  );`);
    lines.push(`}`);

    return lines.join('\n');
  }, [tableState, density, bordered, showPagination, showSorting, showColumnVisibility, showCheckbox, showAddButton, showViewToggle, toolbarLabels, enableCards, enableView, enableEdit, enableDelete, useMenuButton, colorThemeKey]);

  const roleOptions   = useMemo(() => buildOptions('role'),       []);
  const statusOptions = useMemo(() => buildOptions('status'),     []);
  const deptOptions   = useMemo(() => buildOptions('department'), []);

  const tableMenu = useMemo(() => ({
    background: () => [
      {
        label: 'Select all',
        disabled: baseData.length === 0,
        onSelect: () => {
          setRowSelection(Object.fromEntries(baseData.map((row) => [row.id, true])));
        },
      },
      {
        label: 'Clear selection',
        disabled: selectedCount === 0,
        onSelect: () => setRowSelection({}),
      },
      {
        label: 'Create new member',
        separatorBefore: true,
        onSelect: () => console.log('create'),
      },
    ],
  }), [baseData, selectedCount]);

  return (
    <ComponentPage
      title="Table"
      description="Feature-rich data table with sorting, pagination, row selection, view modes, and inline actions."
      category="Data Display"
    >
      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex items-center gap-2 h-9 px-3 rounded-lg border border-border bg-card text-sm hover:bg-accent transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
            <Settings2 className="h-4 w-4" />
            <span>Settings</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-72 bg-card">
            <DropdownMenuLabel className="flex items-center gap-2"><SlidersHorizontal className="h-3.5 w-3.5" />State</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={tableState} onValueChange={(v) => setTableState(v as TableState)}>
              {(['normal', 'loading', 'error', 'empty'] as TableState[]).map((s) => (
                <DropdownMenuRadioItem key={s} value={s} onSelect={(e) => e.preventDefault()}>{s.charAt(0).toUpperCase() + s.slice(1)}</DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>

            <DropdownMenuSeparator />
            <DropdownMenuLabel className="flex items-center gap-2"><MousePointerClick className="h-3.5 w-3.5" />Features</DropdownMenuLabel>
            <DropdownMenuCheckboxItem checked={showPagination} onCheckedChange={setShowPagination} onSelect={(e) => e.preventDefault()}>Pagination</DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked={showSorting} onCheckedChange={setShowSorting} onSelect={(e) => e.preventDefault()}>Sorting</DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked={showColumnVisibility} onCheckedChange={setShowColumnVisibility} onSelect={(e) => e.preventDefault()}>Columns</DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked={showCheckbox} onCheckedChange={setShowCheckbox} onSelect={(e) => e.preventDefault()}>Checkboxes</DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked={showAddButton} onCheckedChange={setShowAddButton} onSelect={(e) => e.preventDefault()}>Add Button</DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked={showViewToggle} onCheckedChange={setShowViewToggle} onSelect={(e) => e.preventDefault()}>View Toggle</DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked={enableCards} onCheckedChange={setEnableCards} onSelect={(e) => e.preventDefault()}>Cards Mode</DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked={bordered} onCheckedChange={setBordered} onSelect={(e) => e.preventDefault()}>Bordered</DropdownMenuCheckboxItem>

            <DropdownMenuSeparator />
            <DropdownMenuLabel className="flex items-center gap-2"><MousePointerClick className="h-3.5 w-3.5" />Actions</DropdownMenuLabel>
            <DropdownMenuCheckboxItem checked={useMenuButton} onCheckedChange={setUseMenuButton} onSelect={(e) => e.preventDefault()}>Action menu</DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked={enableEdit} onCheckedChange={setEnableEdit} onSelect={(e) => e.preventDefault()}>Edit</DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked={enableDelete} onCheckedChange={setEnableDelete} onSelect={(e) => e.preventDefault()}>Delete</DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked={enableView} onCheckedChange={setEnableView} onSelect={(e) => e.preventDefault()}>View</DropdownMenuCheckboxItem>

            <DropdownMenuSeparator />
            <DropdownMenuLabel className="flex items-center gap-2"><Palette className="h-3.5 w-3.5" />Header Color</DropdownMenuLabel>
            <div className="flex flex-wrap gap-2 px-2 py-1.5">
              {Object.entries(COLOR_SWATCHES).map(([key, swatch]) => (
                <button
                  key={key}
                  type="button"
                  title={key.charAt(0).toUpperCase() + key.slice(1)}
                  onClick={() => setColorThemeKey(key as TableHeaderColor | 'default')}
                  className={[
                    'flex h-6 w-6 rounded-full transition-all cursor-pointer',
                    swatch,
                    colorThemeKey === key
                      ? 'ring-2 ring-offset-2 ring-offset-card ring-white scale-110'
                      : 'opacity-70 hover:opacity-100 hover:scale-105',
                  ].join(' ')}
                />
              ))}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Example code={codeString} lang="tsx" previewHeight="h-[800px]" center={false} noPad>
        <NTable<Member>
          data={baseData}
          columns={BASE_COLUMNS}
          getRowId={(row) => row.id}
          loading={tableState === 'loading'}
          error={tableState === 'error' ? 'Failed to load team members.' : undefined}
          density={density}
          bordered={bordered}
          showPagination={showPagination}
          showSorting={showSorting}
          showColumnVisibility={showColumnVisibility}
          showCheckbox={showCheckbox}
          showAddButton={showAddButton}
          showViewToggle={showViewToggle}
          availableModes={enableCards ? ['table', 'cards', 'json'] : ['table', 'json']}
          renderCard={enableCards ? MemberCard : undefined}
          rowSelection={rowSelection}
          onRowSelectionChange={setRowSelection}
          onView={enableView ? (row) => console.log('view', row) : undefined}
          onEdit={enableEdit ? (row) => console.log('edit', row) : undefined}
          onDelete={enableDelete ? (row) => console.log('delete', row) : undefined}
          menu={tableMenu}
          menuButton={useMenuButton}
          onCreate={showAddButton ? () => console.log('create') : undefined}
          toolbarLabels={toolbarLabels}
          headerColor={colorThemeKey === 'default' ? undefined : colorThemeKey}
          jsonValue={baseData}
          pageSizeOptions={[5, 10, 15]}
          defaultPagination={{ pageIndex: 0, pageSize: 10 }}
          dynamicHeight={false}
          filters={[
            { name: 'search',     type: 'search',   placeholder: 'Search members…' },
            { name: 'role',       type: 'combobox', placeholder: 'All roles',       options: roleOptions },
            { name: 'status',     type: 'combobox', placeholder: 'All statuses',    options: statusOptions },
            { name: 'department', type: 'combobox', placeholder: 'All departments', options: deptOptions },
          ]}
        />
      </Example>

      <Example
        title="Full-page layout (dynamicHeight)"
        description="NTable inside a flex column with a page header above it. The pagination footer stays visible and the table body scrolls internally when rows overflow."
        previewHeight="h-[560px]"
        center={false}
        noPad
        code={`<div className="flex h-full flex-col overflow-hidden">
  <NPageHeader icon={Users} title="Team" subtitle="30 members">
    <NPageHeaderActions>
      <NButton><Plus size={16} /> Invite</NButton>
    </NPageHeaderActions>
  </NPageHeader>
  <NTable
    dynamicHeight
    data={members}
    columns={columns}
    getRowId={(row) => row.id}
    showPagination
    showSorting
    showAddButton={false}
    showViewToggle={false}
    showColumnVisibility={false}
  />
</div>`}
      >
        <div className="flex h-full flex-col overflow-hidden">
          <NPageHeader icon={Users} title="Team" subtitle="30 members">
            <NPageHeaderActions>
              <NButton bordered><Plus size={16} /> Invite</NButton>
            </NPageHeaderActions>
          </NPageHeader>
          <NTable<Member>
            data={MEMBERS}
            columns={BASE_COLUMNS}
            getRowId={(row) => row.id}
            dynamicHeight
            showPagination
            showSorting
            showAddButton={false}
            showViewToggle={false}
            showColumnVisibility={false}
            density="compact"
            pageSizeOptions={[5, 10, 15, 20]}
            defaultPagination={{ pageIndex: 0, pageSize: 10 }}
            filters={[
              { name: 'search', type: 'search', placeholder: 'Search members…' },
            ]}
          />
        </div>
      </Example>

      <Example
        title="Responsive columns"
        description='Each column can carry meta.visible (app-owned eligibility) and meta.hiddenBelow (Tailwind breakpoint). Toggle the capability below, then switch the viewport with the toolbar above (mobile / tablet / desktop) to see hiddenBelow hide the Department and Joined columns below the lg breakpoint.'
        previewHeight="h-[560px]"
        center={false}
        noPad
        code={`const canReadEmail = /* from your app's role/capability check */ true;

const columns: NTableColumnDef<Member>[] = [
  { accessorKey: 'name', header: 'Name' },
  {
    accessorKey: 'email',
    header: 'Email',
    meta: {
      visible: canReadEmail,
      hiddenBelow: 'lg',
    },
  },
  { accessorKey: 'role', header: 'Role' },
  { accessorKey: 'status', header: 'Status' },
  {
    accessorKey: 'department',
    header: 'Department',
    meta: { hiddenBelow: 'lg' },
  },
  { accessorKey: 'joined', header: 'Joined' },
];

<NTable
  data={members}
  columns={columns}
  getRowId={(row) => row.id}
  showPagination={false}
  showSorting={false}
  showAddButton={false}
  showCheckbox={false}
  showColumnVisibility={false}
/>`}
      >
        <div className="flex h-full flex-col gap-3 p-4">
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card/40 px-3 py-2">
            <div className="flex flex-col">
              <span className="text-sm font-medium">can(&quot;members.email.read&quot;)</span>
              <span className="text-xs text-muted-foreground">
                App-owned capability gate. Toggle off to remove the Email column everywhere (table, loading skeleton, settings menu).
              </span>
            </div>
            <Switch checked={canReadEmail} onCheckedChange={setCanReadEmail} />
          </div>
          <NTable<Member>
            data={MEMBERS}
            columns={RESPONSIVE_COLUMNS(canReadEmail)}
            getRowId={(row) => row.id}
            showPagination={false}
            showSorting={false}
            showAddButton={false}
            showCheckbox={false}
            showColumnVisibility={false}
            defaultPagination={{ pageIndex: 0, pageSize: 8 }}
            pageSizeOptions={[5, 8, 10]}
            density="comfortable"
          />
        </div>
      </Example>
    </ComponentPage>
  );
}
