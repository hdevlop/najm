import { NAvatar, NBadge, type NTableProps } from "najm-kit";
import { statusMap } from "./data";
import type { StudentPreviewRow } from "./types";

export const studentColumns: NTableProps<StudentPreviewRow>["columns"] = [
  {
    accessorKey: "studentCode",
    header: "Student number",
    enableSorting: true,
    cell: ({ getValue }) => <div className="text-sm font-medium">{getValue<string>()}</div>,
  },
  {
    accessorKey: "name",
    header: "Name",
    enableSorting: true,
    filterFn: (row, _id, value) => {
      const needle = String(value ?? "").toLowerCase().trim();
      if (!needle) return true;
      const name = String(row.original.name ?? "").toLowerCase();
      const code = String(row.original.studentCode ?? "").toLowerCase();
      return name.includes(needle) || code.includes(needle);
    },
    cell: ({ row }) => (
      <NAvatar
        title={row.original.name}
        subtitle={row.original.studentCode}
        size="sm"
        version={row.original.updatedAt}
      />
    ),
  },
  {
    accessorKey: "email",
    header: "Email",
    enableSorting: false,
    cell: ({ getValue }) => getValue<string | null>() || <span className="text-muted-foreground">Not available</span>,
  },
  {
    accessorKey: "phone",
    header: "Phone",
    enableSorting: false,
    cell: ({ getValue }) => getValue<string | null>() || <span className="text-muted-foreground">Not available</span>,
  },
  {
    accessorKey: "class",
    accessorFn: (row) => row.class?.name || "",
    header: "Class",
    enableColumnFilter: true,
    cell: ({ row }) => row.original.class?.name || <span className="text-muted-foreground">Not assigned</span>,
  },
  {
    accessorKey: "section",
    accessorFn: (row) => row.section?.name || "",
    header: "Section",
    enableColumnFilter: true,
    cell: ({ row }) => row.original.section?.name || <span className="text-muted-foreground">Not assigned</span>,
  },
  {
    accessorKey: "gender",
    header: "Gender",
    enableSorting: true,
    cell: ({ getValue }) => (getValue<string>() === "M" ? "Male" : "Female"),
  },
  {
    accessorKey: "status",
    header: "Status",
    enableSorting: true,
    enableColumnFilter: true,
    size: 120,
    cell: ({ getValue }) => {
      const status = getValue<StudentPreviewRow["status"]>();
      return <NBadge  status={status} statusMap={statusMap} look="dash" />;
    },
  },
];
