import React, { useState } from "react";
import type { ColumnDef, Row } from "@tanstack/react-table";
import { NTable, Badge, NButton } from "najm-kit";
import { User, Mail, Shield, Calendar } from "lucide-react";

// ── Data ──────────────────────────────────────────────────────────────────────

type Member = {
  id: string;
  name: string;
  email: string;
  role: "Admin" | "Member" | "Viewer";
  status: "Active" | "Inactive" | "Pending";
  joined: string;
  department: string;
};

const MEMBERS: Member[] = [
  { id: "1",  name: "Alice Martin",    email: "alice@example.com",   role: "Admin",  status: "Active",   joined: "Jan 12, 2024", department: "Engineering" },
  { id: "2",  name: "Bob Chen",        email: "bob@example.com",     role: "Member", status: "Active",   joined: "Feb 3, 2024",  department: "Design" },
  { id: "3",  name: "Carol White",     email: "carol@example.com",   role: "Viewer", status: "Inactive", joined: "Mar 22, 2024", department: "Marketing" },
  { id: "4",  name: "David Kim",       email: "david@example.com",   role: "Member", status: "Pending",  joined: "Apr 15, 2024", department: "Engineering" },
  { id: "5",  name: "Eve Johnson",     email: "eve@example.com",     role: "Member", status: "Active",   joined: "May 1, 2024",  department: "Sales" },
  { id: "6",  name: "Frank Lee",       email: "frank@example.com",   role: "Admin",  status: "Active",   joined: "Jun 2, 2024",  department: "Engineering" },
  { id: "7",  name: "Grace Park",      email: "grace@example.com",   role: "Member", status: "Pending",  joined: "Jun 8, 2024",  department: "Design" },
  { id: "8",  name: "Henry Adams",     email: "henry@example.com",   role: "Viewer", status: "Active",   joined: "Jun 14, 2024", department: "Marketing" },
  { id: "9",  name: "Iris Scott",      email: "iris@example.com",    role: "Member", status: "Inactive", joined: "Jun 20, 2024", department: "HR" },
  { id: "10", name: "Jake Rivera",     email: "jake@example.com",    role: "Member", status: "Active",   joined: "Jun 28, 2024", department: "Engineering" },
  { id: "11", name: "Karen Wu",        email: "karen@example.com",   role: "Viewer", status: "Active",   joined: "Jul 5, 2024",  department: "Sales" },
  { id: "12", name: "Leo Morgan",      email: "leo@example.com",     role: "Member", status: "Pending",  joined: "Jul 12, 2024", department: "Design" },
  { id: "13", name: "Mia Thompson",    email: "mia@example.com",     role: "Admin",  status: "Active",   joined: "Jul 19, 2024", department: "HR" },
  { id: "14", name: "Noah Garcia",     email: "noah@example.com",    role: "Member", status: "Inactive", joined: "Jul 25, 2024", department: "Engineering" },
  { id: "15", name: "Olivia Brown",    email: "olivia@example.com",  role: "Viewer", status: "Active",   joined: "Aug 1, 2024",  department: "Marketing" },
];

// ── Columns ───────────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, "success" | "warning" | "destructive"> = {
  Active: "success",
  Pending: "warning",
  Inactive: "destructive",
};

const ROLE_COLOR: Record<string, "success" | "warning" | "default"> = {
  Admin: "success",
  Member: "default",
  Viewer: "warning",
};

const columns: ColumnDef<Member>[] = [
  {
    accessorKey: "name",
    header: "Name",
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
    accessorKey: "email",
    header: "Email",
    cell: ({ getValue }) => (
      <span className="text-muted-foreground text-sm">{getValue() as string}</span>
    ),
  },
  {
    accessorKey: "role",
    header: "Role",
    cell: ({ getValue }) => {
      const role = getValue() as string;
      return <Badge color={ROLE_COLOR[role]} look="soft" className="text-xs">{role}</Badge>;
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ getValue }) => {
      const status = getValue() as string;
      return <Badge color={STATUS_COLOR[status]} look="soft" className="text-xs">{status}</Badge>;
    },
  },
  {
    accessorKey: "department",
    header: "Department",
    cell: ({ getValue }) => (
      <span className="text-sm text-muted-foreground">{getValue() as string}</span>
    ),
  },
  {
    accessorKey: "joined",
    header: "Joined",
    cell: ({ getValue }) => (
      <span className="text-xs text-muted-foreground">{getValue() as string}</span>
    ),
  },
];

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
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Shield size={11} />
          <span>{data.role}</span>
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <User size={11} />
          <span>{data.department}</span>
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground col-span-2">
          <Calendar size={11} />
          <span>Joined {data.joined}</span>
        </div>
      </div>
    </div>
  );
}

// ── Setting toggle helper ─────────────────────────────────────────────────────

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={[
        "flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
        value
          ? "border-primary/40 bg-primary/10 text-primary"
          : "border-border bg-card text-muted-foreground hover:border-border/80 hover:text-foreground",
      ].join(" ")}
    >
      <span
        className={[
          "size-1.5 rounded-full transition-colors",
          value ? "bg-primary" : "bg-muted-foreground/40",
        ].join(" ")}
      />
      {label}
    </button>
  );
}

function RadioGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: T[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-muted-foreground mr-1">{label}:</span>
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={[
            "rounded-md border px-2.5 py-1 text-xs font-medium capitalize transition-colors",
            value === opt
              ? "border-primary/40 bg-primary/10 text-primary"
              : "border-border bg-card text-muted-foreground hover:text-foreground",
          ].join(" ")}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

// ── Main Preview ──────────────────────────────────────────────────────────────

type TableState = "normal" | "loading" | "error" | "empty";
type Density = "compact" | "comfortable" | "spacious";

export default function TablePreview() {
  // State controls
  const [tableState, setTableState] = useState<TableState>("normal");
  const [density, setDensity] = useState<Density>("comfortable");

  // UI feature toggles
  const [showPagination, setShowPagination] = useState(true);
  const [showSorting, setShowSorting] = useState(true);
  const [showColumnVisibility, setShowColumnVisibility] = useState(true);
  const [showCheckbox, setShowCheckbox] = useState(true);
  const [showAddButton, setShowAddButton] = useState(false);
  const [showViewToggle, setShowViewToggle] = useState(true);

  // Action toggles
  const [enableEdit, setEnableEdit] = useState(true);
  const [enableDelete, setEnableDelete] = useState(true);
  const [enableView, setEnableView] = useState(false);
  const [enableCards, setEnableCards] = useState(true);

  const data = tableState === "empty" ? [] : MEMBERS;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">NTable</h2>

      {/* Settings Panel */}
      <div className="rounded-lg border border-border bg-card/50 p-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Settings</p>

        <div className="flex flex-wrap gap-4">
          {/* State */}
          <RadioGroup
            label="State"
            options={["normal", "loading", "error", "empty"] as TableState[]}
            value={tableState}
            onChange={setTableState}
          />

          {/* Density */}
          <RadioGroup
            label="Density"
            options={["compact", "comfortable", "spacious"] as Density[]}
            value={density}
            onChange={setDensity}
          />
        </div>

        <div className="h-px bg-border" />

        <div className="flex flex-wrap gap-2">
          <Toggle label="Pagination"        value={showPagination}       onChange={setShowPagination} />
          <Toggle label="Sorting"           value={showSorting}          onChange={setShowSorting} />
          <Toggle label="Column Visibility" value={showColumnVisibility} onChange={setShowColumnVisibility} />
          <Toggle label="Checkboxes"        value={showCheckbox}         onChange={setShowCheckbox} />
          <Toggle label="Add Button"        value={showAddButton}        onChange={setShowAddButton} />
          <Toggle label="View Toggle"       value={showViewToggle}       onChange={setShowViewToggle} />
          <Toggle label="Cards Mode"        value={enableCards}          onChange={setEnableCards} />
        </div>

        <div className="h-px bg-border" />

        <div className="flex flex-wrap gap-2">
          <Toggle label="Edit Action"   value={enableEdit}   onChange={setEnableEdit} />
          <Toggle label="Delete Action" value={enableDelete} onChange={setEnableDelete} />
          <Toggle label="View Action"   value={enableView}   onChange={setEnableView} />
        </div>
      </div>

      {/* NTable Preview */}
      <div className="rounded-lg border border-border overflow-hidden" style={{ height: 480 }}>
        <NTable<Member>
          data={data}
          columns={columns}
          getRowId={(row) => row.id}
          loading={tableState === "loading"}
          error={tableState === "error" ? "Failed to load team members." : undefined}
          density={density}
          showPagination={showPagination}
          showSorting={showSorting}
          showColumnVisibility={showColumnVisibility}
          showCheckbox={showCheckbox}
          showAddButton={showAddButton}
          showViewToggle={showViewToggle}
          availableModes={enableCards ? ["table", "cards", "json"] : ["table", "json"]}
          renderCard={enableCards ? MemberCard : undefined}
          onEdit={enableEdit ? (row) => console.log("edit", row) : undefined}
          onDelete={enableDelete ? (row) => console.log("delete", row) : undefined}
          onView={enableView ? (row) => console.log("view", row) : undefined}
          onCreate={showAddButton ? () => console.log("create") : undefined}
          pageSizeOptions={[5, 10, 15]}
          defaultPagination={{ pageIndex: 0, pageSize: 10 }}
          dynamicHeight={false}
        />
      </div>
    </div>
  );
}
