import {
  NButton,
  NPageHeader,
  NPageHeaderActions,
} from "najm-kit";
import { Download, GraduationCap, Maximize, Moon, Upload } from "lucide-react";
import { SelectablePreviewElement } from "../../SelectablePreviewElement";

type StudentsPreviewHeaderProps = {
  studentCount: number;
};

export function StudentsPreviewHeader({ studentCount }: StudentsPreviewHeaderProps) {
  return (
    <SelectablePreviewElement component="pageHeader" className="shrink-0">
      <NPageHeader icon={GraduationCap} title="Students" subtitle={`${studentCount} students`}>
        <NPageHeaderActions>
          <SelectablePreviewElement component="button">
            <NButton type="button" variant="ghost" size="icon" aria-label="Import students">
              <Upload size={18} />
            </NButton>
          </SelectablePreviewElement>
          <SelectablePreviewElement component="button">
            <NButton type="button" variant="ghost" size="icon" aria-label="Export students">
              <Download size={18} />
            </NButton>
          </SelectablePreviewElement>
          <SelectablePreviewElement component="button">
            <NButton type="button" variant="ghost" size="icon" aria-label="Toggle theme">
              <Moon size={18} />
            </NButton>
          </SelectablePreviewElement>
          <SelectablePreviewElement component="button" className="hidden sm:block">
            <NButton type="button" variant="ghost" size="icon" aria-label="Toggle fullscreen">
              <Maximize size={18} />
            </NButton>
          </SelectablePreviewElement>
        </NPageHeaderActions>
      </NPageHeader>
    </SelectablePreviewElement>
  );
}
