export interface SettingsSidebarProps {
  saving: boolean;
  dirty: boolean;
  lastSavedAt?: Date;
  lastSavedKind: "style" | "draft";
  saveError?: string;
  onImport: () => void;
  onExport: () => void;
}
