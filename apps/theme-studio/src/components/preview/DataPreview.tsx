import { useState } from "react";
import {
  NCard,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  NBadge,
  NButton,
  Checkbox,
  SegmentedControl,
  NEmptyState,
} from "najm-kit";
import { SelectablePreviewElement } from "../SelectablePreviewElement";

const rows = [
  { id: 1, name: "Algebra 101", students: 32, status: "Open" },
  { id: 2, name: "World History", students: 28, status: "Open" },
  { id: 3, name: "Biology", students: 0, status: "Draft" },
  { id: 4, name: "Computer Science", students: 41, status: "Open" },
];

export function DataPreview() {
  const [view, setView] = useState("table");
  const [selected, setSelected] = useState<number[]>([1]);

  const toggle = (id: number) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <div className="flex flex-col" style={{ gap: "var(--section-gap)" }}>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Courses</h2>
        <SegmentedControl
          value={view}
          onChange={setView}
          options={[
            { value: "table", label: "Table" },
            { value: "cards", label: "Cards" },
          ]}
        />
      </div>

      {selected.length > 0 && (
        <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
          <span>{selected.length} selected</span>
          <NButton size="xs" variant="destructive">Delete</NButton>
        </div>
      )}

      {view === "table" ? (
        <SelectablePreviewElement component="table">
          <NCard noPadding>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10" />
                  <TableHead>Course</TableHead>
                  <TableHead>Students</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id} data-state={selected.includes(r.id) ? "selected" : undefined}>
                    <TableCell>
                      <Checkbox checked={selected.includes(r.id)} onCheckedChange={() => toggle(r.id)} />
                    </TableCell>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell>{r.students}</TableCell>
                    <TableCell>
                      <NBadge variant={r.status === "Open" ? "success" : "secondary"}>{r.status}</NBadge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </NCard>
        </SelectablePreviewElement>
      ) : (
        <div className="grid grid-cols-1 gap-[var(--section-gap)] sm:grid-cols-2">
          {rows.map((r) => (
            <SelectablePreviewElement key={r.id} component="card">
              <NCard noPadding className="p-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{r.name}</span>
                  <NBadge variant={r.status === "Open" ? "success" : "secondary"}>{r.status}</NBadge>
                </div>
                <p className="text-sm text-muted-foreground">{r.students} students</p>
              </NCard>
            </SelectablePreviewElement>
          ))}
        </div>
      )}

      <NCard title="Empty result set">
        <NEmptyState title="No archived courses" description="Archived courses will appear here." />
      </NCard>
    </div>
  );
}
