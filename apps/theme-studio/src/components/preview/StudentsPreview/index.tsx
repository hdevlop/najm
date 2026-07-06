import { useStudio } from "../../../app/studio-store";
import { smsStudents } from "./data";
import { StudentsPreviewHeader } from "./StudentsPreviewHeader";
import { StudentsTable } from "./StudentsTable";

export function StudentsPreview() {
  const { config } = useStudio();
  const tableConfig = config.components?.table;

  return (
    <div className="flex min-h-full flex-col" style={{ gap: "var(--section-gap)" }}>
      <StudentsPreviewHeader studentCount={smsStudents.length} />
      <StudentsTable tableConfig={tableConfig} />
    </div>
  );
}
