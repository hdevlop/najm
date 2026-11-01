import React, { useEffect, useState } from 'react';
import { NTable, Switch, type NTableColumnDef, type NTableExportFormat } from 'najm-kit';
import { Example } from '../Example';

type Status = 'active' | 'pending' | 'inactive';
interface Member { name: string; email: string; status: Status; joined: Date; fee: number; photo: string }
const members: Member[] = [
  { name: 'Alice Martin', email: 'alice@example.com', status: 'active', joined: new Date('2024-09-02T00:00:00Z'), fee: 1250.5, photo: 'alice.png' },
  { name: 'Bob Chen', email: 'bob@example.com', status: 'pending', joined: new Date('2025-01-15T00:00:00Z'), fee: 980, photo: 'bob.png' },
  { name: 'Carol White', email: 'carol@example.com', status: 'inactive', joined: new Date('2023-03-20T00:00:00Z'), fee: 0, photo: 'carol.png' },
];
const arabicMembers: Member[] = [
  { name: 'أحمد بنعلي', email: 'ahmed@example.com', status: 'active', joined: new Date('2024-09-02T00:00:00Z'), fee: 1250.5, photo: 'ahmed.png' },
  { name: 'سارة العلوي', email: 'sara@example.com', status: 'pending', joined: new Date('2025-01-15T00:00:00Z'), fee: 980, photo: 'sara.png' },
];
const empty: Member[] = [];
const statusLabels = {
  en: { active: 'Active', pending: 'Pending', inactive: 'Inactive' },
  ar: { active: 'نشط', pending: 'قيد الانتظار', inactive: 'غير نشط' },
} as const;
const headers = {
  en: { name: 'Name', email: 'Email', status: 'Status', joined: 'Joined', fee: 'Fee', photo: 'Photo' },
  ar: { name: 'الاسم', email: 'البريد الإلكتروني', status: 'الحالة', joined: 'تاريخ الانضمام', fee: 'الرسوم', photo: 'الصورة' },
} as const;

function memberColumns(lang: 'en' | 'ar'): NTableColumnDef<Member>[] {
  const h = headers[lang];
  return [
    { accessorKey: 'name', header: h.name },
    { accessorKey: 'email', header: h.email },
    // The cell shows a label and the file gets the same label, not the stored code.
    { accessorKey: 'status', header: h.status, cell: ({ getValue }) => statusLabels[lang][getValue() as Status], meta: { exportValue: (value: Status) => statusLabels[lang][value] } },
    // A Date stays a date cell in Excel, so it sorts.
    { accessorKey: 'joined', header: h.joined, cell: ({ getValue }) => (getValue() as Date).toLocaleDateString(lang) },
    { accessorKey: 'fee', header: h.fee, cell: ({ getValue }) => (getValue() as number).toFixed(2) },
    // Shown on screen, left out of every export and print.
    { accessorKey: 'photo', header: h.photo, meta: { export: false } },
  ];
}

function MemberCard({ data }: { data: Member }) {
  return <div className="space-y-1 p-3"><p className="font-medium">{data.name}</p><p className="text-sm text-muted-foreground">{data.email}</p><p className="text-sm">{data.status}</p></div>;
}

const FORMAT_CHOICES: Record<string, readonly NTableExportFormat[]> = { all: ['xlsx', 'csv', 'json'], xlsx: ['xlsx'], csv: ['csv'], json: ['json'] };

export function TableDataActionsExample() {
  const [showExport, setShowExport] = useState(true);
  const [showImport, setShowImport] = useState(true);
  const [showPrint, setShowPrint] = useState(true);
  const [isEmpty, setIsEmpty] = useState(false);
  const [loading, setLoading] = useState(false);
  const [arabic, setArabic] = useState(false);
  const [formats, setFormats] = useState<keyof typeof FORMAT_CHOICES>('all');
  const [display, setDisplay] = useState<'buttons' | 'menu' | 'both' | 'settings'>('both');
  const lang = arabic ? 'ar' : 'en';
  const exportTitle = arabic ? 'قائمة الأعضاء' : 'Members 2026';

  // Exports and print follow the page's dir and lang, so the demo sets them on the page.
  useEffect(() => {
    if (!arabic) return;
    const root = document.documentElement;
    const previous = { dir: root.getAttribute('dir'), lang: root.lang };
    root.setAttribute('dir', 'rtl');
    root.lang = 'ar';
    return () => {
      if (previous.dir === null) root.removeAttribute('dir'); else root.setAttribute('dir', previous.dir);
      root.lang = previous.lang;
    };
  }, [arabic]);

  const formatList = FORMAT_CHOICES[formats].map(format => `"${format}"`).join(', ');
  const code = `<NTable\n  data={members}\n  columns={columns}\n  dataActions\n  exportTitle="${exportTitle}"\n  exportFormats={[${formatList}]}\n  showExportButton={${showExport}}\n  showImportButton={${showImport}}\n  showPrintButton={${showPrint}}\n  toolbarActionDisplay="${display}"\n/>\n\n// Columns choose what they export\n{ accessorKey: 'status', meta: { exportValue: value => labels[value] } }\n{ accessorKey: 'photo', meta: { export: false } }`;
  return (
    <Example title="Export, import, and print" description="Export to Excel, CSV or JSON, import XLSX/CSV/JSON, or print. Excel and print use the column titles, keep dates and numbers typed, and follow the page's direction; CSV and JSON keep field names so Import reads them back. Imports replace displayed rows after confirmation." code={code} lang="tsx" previewHeight="h-[600px]" center={false} noPad>
      <div data-testid="ntable-data-actions-demo" className="flex h-full min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <label className="flex items-center gap-2"><Switch aria-label="Show Export" checked={showExport} onCheckedChange={setShowExport} />Export</label>
          <label className="flex items-center gap-2"><Switch aria-label="Show Import" checked={showImport} onCheckedChange={setShowImport} />Import</label>
          <label className="flex items-center gap-2"><Switch aria-label="Show Print" checked={showPrint} onCheckedChange={setShowPrint} />Print</label>
          <label className="flex items-center gap-2"><Switch aria-label="Empty table" checked={isEmpty} onCheckedChange={setIsEmpty} />Empty</label>
          <label className="flex items-center gap-2"><Switch aria-label="Loading table" checked={loading} onCheckedChange={setLoading} />Loading</label>
          <label className="flex items-center gap-2"><Switch aria-label="Arabic, right to left" checked={arabic} onCheckedChange={setArabic} />Arabic (RTL)</label>
          <select aria-label="Export formats" value={formats} onChange={event => setFormats(event.target.value as keyof typeof FORMAT_CHOICES)} className="rounded-md border border-input bg-card px-2 py-1 text-foreground">
            <option value="all">Excel, CSV and JSON</option><option value="xlsx">Excel only</option><option value="csv">CSV only</option><option value="json">JSON only</option>
          </select>
          <select aria-label="Action presentation" value={display} onChange={event => setDisplay(event.target.value as typeof display)} className="rounded-md border border-input bg-card px-2 py-1 text-foreground">
            <option value="both">Buttons and menu</option><option value="buttons">Buttons only</option><option value="menu">Menu only</option><option value="settings">Settings menu</option>
          </select>
        </div>
        <NTable data={isEmpty ? empty : arabic ? arabicMembers : members} columns={memberColumns(lang)} dataActions exportTitle={exportTitle} exportFormats={FORMAT_CHOICES[formats]} importColumns={['name', 'email', 'status']} showExportButton={showExport} showImportButton={showImport} showPrintButton={showPrint} toolbarActionDisplay={display} loading={loading} renderCard={MemberCard} showCheckbox={false} showPagination={false} showViewToggle={display === 'settings'} dynamicHeight={false} filters={[{ name: 'search', type: 'search', placeholder: arabic ? 'ابحث عن عضو' : 'Search members' }]} />
      </div>
    </Example>
  );
}
