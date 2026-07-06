import { NAvatar, NBadge } from "najm-kit";
import { statusMap } from "./data";
import type { StudentPreviewRow } from "./types";

export function StudentPreviewCard({ data }: { data: StudentPreviewRow }) {
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <NAvatar title={data.name} subtitle={data.studentCode} size="sm" version={data.updatedAt} />
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <p className="text-muted-foreground">Class</p>
          <p className="truncate font-medium">{data.class?.name ?? "Not assigned"}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Section</p>
          <p className="truncate font-medium">{data.section?.name ?? "Not assigned"}</p>
        </div>
        <div className="col-span-2 flex items-center justify-between gap-2">
          <span className="text-muted-foreground">{data.gender === "M" ? "Male" : "Female"}</span>
          <NBadge status={data.status} statusMap={statusMap} look="soft" size="sm" />
        </div>
      </div>
    </div>
  );
}
