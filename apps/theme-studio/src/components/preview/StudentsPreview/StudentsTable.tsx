import { useState } from "react";
import { z } from "zod";
import {
  FormInput,
  NDialog,
  NForm,
  NFormSectionHeader as FormSectionHeader,
  NTable,
  type NTableProps,
} from "najm-kit";
import {
  Activity,
  Award,
  BookOpen,
  Building,
  Calendar,
  ClipboardList,
  Clock,
  DoorOpen,
  FileText,
  ListChecks,
  Tag,
  User,
} from "lucide-react";
import { SelectablePreviewElement } from "../../SelectablePreviewElement";
import { studentColumns } from "./columns";
import { smsStudents } from "./data";
import { studentFilters } from "./filters";
import { StudentPreviewCard } from "./StudentPreviewCard";
import { StudentDetailsDialog } from "./StudentDetailsDialog";
import type { StudentPreviewRow } from "./types";

type StudentsTableProps = {
  tableConfig?: {
    headerColor?: string;
    headerTextColor?: string;
    borderColor?: string;
  };
};

const noop = () => undefined;
const PREVIEW_FORM_ID = "theme-studio-create-assessment-preview-form";

const assessmentPreviewSchema = z.object({
  title: z.string().min(1, "Title is required"),
  type: z.string().min(1),
  description: z.string().optional(),
  instructions: z.string().optional(),
  classId: z.string().min(1),
  sectionId: z.string().min(1),
  subjectId: z.string().min(1),
  teacherId: z.string().min(1),
  date: z.string().min(1),
  duration: z.coerce.number().min(1),
  totalMarks: z.coerce.number().min(1),
  passingMarks: z.coerce.number().min(1),
  status: z.string().min(1),
});

const defaultValues = {
  title: "",
  type: "quiz",
  description: "",
  instructions: "",
  classId: "grade-8",
  sectionId: "a",
  subjectId: "math",
  teacherId: "teacher-1",
  date: "",
  duration: 60,
  totalMarks: 100,
  passingMarks: 50,
  status: "scheduled",
};

function AssessmentCreateFormPreview({ onSubmit }: { onSubmit: () => void }) {
  return (
    <div className="flex w-full flex-col items-center justify-center mt-4">
      <div className="flex h-full w-full flex-col gap-4">
        <NForm
          id={PREVIEW_FORM_ID}
          schema={assessmentPreviewSchema}
          defaultValues={defaultValues}
          onSubmit={onSubmit}
        >
          <div className="flex flex-col gap-4">
            <FormSectionHeader icon={ClipboardList} title="Assessment Details" />

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormInput
                name="title"
                type="text"
                formLabel="Title"
                placeholder="Enter assessment title"
                icon={ClipboardList}
                required
              />

              <FormInput
                name="type"
                type="select"
                formLabel="Type"
                placeholder="Select assessment type"
                icon={Tag}
                items={[
                  { value: "quiz", label: "Quiz" },
                  { value: "exam", label: "Exam" },
                  { value: "assignment", label: "Assignment" },
                ]}
                required
              />
            </div>

            <div className="grid grid-cols-1 gap-2">
              <FormInput
                name="description"
                type="textarea"
                formLabel="Description"
                placeholder="Add a description (optional)"
                icon={FileText}
              />

              <FormInput
                name="instructions"
                type="textarea"
                formLabel="Instructions"
                placeholder="Add instructions for students"
                icon={ListChecks}
              />
            </div>

            <FormSectionHeader icon={BookOpen} title="Academic Context" />

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormInput
                name="classId"
                type="select"
                formLabel="Class"
                placeholder="Select class"
                icon={Building}
                items={[
                  { value: "grade-8", label: "Grade 8" },
                  { value: "grade-9", label: "Grade 9" },
                ]}
                required
              />

              <FormInput
                name="sectionId"
                type="select"
                formLabel="Section"
                placeholder="Select section"
                icon={DoorOpen}
                items={[
                  { value: "a", label: "Section A" },
                  { value: "b", label: "Section B" },
                ]}
                required
              />

              <FormInput
                name="subjectId"
                type="select"
                formLabel="Subject"
                placeholder="Select subject"
                icon={BookOpen}
                items={[
                  { value: "math", label: "Mathematics" },
                  { value: "science", label: "Science" },
                ]}
                required
              />

              <FormInput
                name="teacherId"
                type="select"
                formLabel="Teacher"
                placeholder="Select teacher"
                icon={User}
                items={[
                  { value: "teacher-1", label: "Amina El Idrissi" },
                  { value: "teacher-2", label: "Youssef Bennani" },
                ]}
                required
              />
            </div>

            <FormSectionHeader icon={Calendar} title="Schedule & Grading" />

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormInput
                name="date"
                type="date"
                formLabel="Date"
                placeholder="Select assessment date"
                icon={Calendar}
                required
              />

              <FormInput
                name="duration"
                type="number"
                formLabel="Duration (minutes)"
                placeholder="60"
                icon={Clock}
                required
              />

              <FormInput
                name="totalMarks"
                type="number"
                formLabel="Total Marks"
                placeholder="100"
                icon={Award}
                required
              />

              <FormInput
                name="passingMarks"
                type="number"
                formLabel="Passing Marks"
                placeholder="50"
                icon={Award}
                required
              />

              <FormInput
                name="status"
                type="select"
                formLabel="Status"
                placeholder="Select status"
                icon={Activity}
                items={[
                  { value: "scheduled", label: "Scheduled" },
                  { value: "active", label: "Active" },
                  { value: "completed", label: "Completed" },
                ]}
                required
              />
            </div>
          </div>
        </NForm>
      </div>
    </div>
  );
}

export function StudentsTable({ tableConfig }: StudentsTableProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [viewStudent, setViewStudent] = useState<StudentPreviewRow | null>(null);

  return (
    <>
      <SelectablePreviewElement component="table" className="min-h-0 flex-1">
        <NTable<typeof smsStudents[number]>
          className="min-h-0 flex-1"
          data={smsStudents}
          columns={studentColumns as NTableProps<typeof smsStudents[number]>["columns"]}
          filters={studentFilters}
          onCreate={() => setCreateOpen(true)}
          onView={(student) => setViewStudent(student)}
          onEdit={noop}
          onDelete={noop}
          onBulkDelete={noop}
          renderCard={StudentPreviewCard}
          addButtonText="Create assessment"
          headerColor={tableConfig?.headerColor}
          headerTextColor={tableConfig?.headerTextColor}
          borderColor={tableConfig?.borderColor}
          bordered
          defaultMode="table"
          dynamicHeight
        />
      </SelectablePreviewElement>

      <StudentDetailsDialog
        student={viewStudent}
        open={viewStudent !== null}
        onOpenChange={(open) => {
          if (!open) setViewStudent(null);
        }}
      />

      <NDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Create Assessment"
        width="3xl"
        primaryButton={{ form: PREVIEW_FORM_ID, text: "Create" }}
        secondaryButton={{ text: "Cancel" }}
      >
        <AssessmentCreateFormPreview onSubmit={() => setCreateOpen(false)} />
      </NDialog>
    </>
  );
}
