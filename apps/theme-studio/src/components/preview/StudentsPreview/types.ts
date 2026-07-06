export type StudentPreviewRow = {
  id: string;
  studentCode: string;
  name: string;
  email: string | null;
  phone: string | null;
  class: { name: string } | null;
  section: { name: string } | null;
  gender: "M" | "F";
  status: "active" | "inactive" | "graduated";
  updatedAt: string;
};
