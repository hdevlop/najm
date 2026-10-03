import React, { useState } from 'react';
import { NTable, Switch, type NTableColumnDef } from 'najm-kit';
import { Example } from '../Example';

interface Member { name: string; email: string; status: string }
const members: Member[] = [
  { name: 'Alice Martin', email: 'alice@example.com', status: 'Active' },
  { name: 'Bob Chen', email: 'bob@example.com', status: 'Pending' },
  { name: 'Carol White', email: 'carol@example.com', status: 'Inactive' },
];
const empty: Member[] = [];
const columns: NTableColumnDef<Member>[] = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'email', header: 'Email' },
  { accessorKey: 'status', header: 'Status' },
];

function MemberCard({ data }: { data: Member }) {
  return <div className="space-y-1 p-3"><p className="font-medium">{data.name}</p><p className="text-sm text-muted-foreground">{data.email}</p><p className="text-sm">{data.status}</p></div>;
}

export function TableDataActionsExample() {
  const [showExport, setShowExport] = useState(true);
  const [showImport, setShowImport] = useState(true);
  const [showPrint, setShowPrint] = useState(true);
  const [isEmpty, setIsEmpty] = useState(false);
  const [loading, setLoading] = useState(false);
  const [display, setDisplay] = useState<'buttons' | 'menu' | 'both'>('both');
  const code = `<NTable\n  data={members}\n  columns={columns}\n  dataActions\n  showExportButton={${showExport}}\n  showImportButton={${showImport}}\n  showPrintButton={${showPrint}}\n  toolbarActionDisplay="${display}"\n/>`;
  return (
    <Example title="Export, import, and print" description="Choose which actions appear, then try a CSV download, CSV/JSON import, or printing. Imports replace displayed rows after confirmation." code={code} lang="tsx" previewHeight="h-[600px]" center={false} noPad>
      <div data-testid="ntable-data-actions-demo" className="flex h-full min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <label className="flex items-center gap-2"><Switch aria-label="Show Export" checked={showExport} onCheckedChange={setShowExport} />Export</label>
          <label className="flex items-center gap-2"><Switch aria-label="Show Import" checked={showImport} onCheckedChange={setShowImport} />Import</label>
          <label className="flex items-center gap-2"><Switch aria-label="Show Print" checked={showPrint} onCheckedChange={setShowPrint} />Print</label>
          <label className="flex items-center gap-2"><Switch aria-label="Empty table" checked={isEmpty} onCheckedChange={setIsEmpty} />Empty</label>
          <label className="flex items-center gap-2"><Switch aria-label="Loading table" checked={loading} onCheckedChange={setLoading} />Loading</label>
          <select aria-label="Action presentation" value={display} onChange={event => setDisplay(event.target.value as typeof display)} className="rounded-md border border-input bg-card px-2 py-1 text-foreground">
            <option value="both">Buttons and menu</option><option value="buttons">Buttons only</option><option value="menu">Menu only</option>
          </select>
        </div>
        <NTable data={isEmpty ? empty : members} columns={columns} dataActions showExportButton={showExport} showImportButton={showImport} showPrintButton={showPrint} toolbarActionDisplay={display} loading={loading} renderCard={MemberCard} showCheckbox={false} showPagination={false} showViewToggle={false} dynamicHeight={false} filters={[{ name: 'search', type: 'search', placeholder: 'Search members' }]} />
      </div>
    </Example>
  );
}
