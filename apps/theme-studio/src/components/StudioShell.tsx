import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { NButton, Toaster, type NajmTypographyConfig } from "najm-kit";
import { useStudio } from "../app/studio-store";
import { SettingsSidebar } from "./settings-sidebar";
import { PreviewCanvas } from "./PreviewCanvas";
import { ComponentStyleFlyout } from "./ComponentStyleFlyout";
import { ImportDialog } from "./ImportPanel";
import { ExportDialog } from "./ExportPanel";

const AUTOSAVE_DELAY_MS = 3000;
const TYPOGRAPHY_SCALE_FACTOR: Record<NonNullable<NajmTypographyConfig["scale"]>, string> = {
  compact: "0.95",
  default: "1",
  comfortable: "1.05",
};

function typographyStyle(typography: NajmTypographyConfig | undefined): CSSProperties | undefined {
  if (!typography) return undefined;

  const style: Record<string, string> = {
    fontFamily: "var(--font-sans, ui-sans-serif, system-ui, sans-serif)",
    fontSize: "var(--font-size-base, 14px)",
    lineHeight: "var(--line-height-base, 1.5)",
    letterSpacing: "var(--letter-spacing-base, 0)",
  };
  if (typography.fontSans) style["--font-sans"] = typography.fontSans;
  if (typography.fontHeading) style["--font-heading"] = typography.fontHeading;
  if (typography.fontMono) style["--font-mono"] = typography.fontMono;
  if (typography.baseSize) style["--font-size-base"] = typography.baseSize;
  if (typography.lineHeight) style["--line-height-base"] = typography.lineHeight;
  if (typography.letterSpacing) style["--letter-spacing-base"] = typography.letterSpacing;
  if (typography.scale) style["--font-scale"] = TYPOGRAPHY_SCALE_FACTOR[typography.scale];
  return style as CSSProperties;
}

export function StudioShell() {
  const router = useRouter();
  const {
    dirty,
    activeProjectId,
    activeStyleId,
    notFound,
    config,
    saveProjectDraft,
    saveCurrentStyle,
  } = useStudio();
  const [importOpen, setImportOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | undefined>();
  const [lastSavedKind, setLastSavedKind] = useState<"style" | "draft">("style");
  const [saveError, setSaveError] = useState<string | undefined>();
  const savingRef = useRef(false);
  const shellTypographyStyle = useMemo(
    () => typographyStyle(config.typography),
    [config.typography],
  );

  const saveSelectedStyle = useCallback(async () => {
    if (!activeProjectId || !activeStyleId || savingRef.current) return undefined;
    savingRef.current = true;
    setSaving(true);
    setSaveError(undefined);
    try {
      const saved = await saveCurrentStyle();
      if (!saved) {
        setSaveError("Save failed");
        return undefined;
      }
      setLastSavedAt(new Date());
      setLastSavedKind("style");
      return saved;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [activeProjectId, activeStyleId, saveCurrentStyle]);

  const saveLocalDraft = useCallback(() => {
    if (!activeProjectId || savingRef.current) return undefined;
    savingRef.current = true;
    setSaving(true);
    setSaveError(undefined);
    try {
      const savedAt = saveProjectDraft();
      if (!savedAt) {
        setSaveError("Draft save failed");
        return undefined;
      }
      setLastSavedAt(savedAt);
      setLastSavedKind("draft");
      return savedAt;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [activeProjectId, saveProjectDraft]);

  useEffect(() => {
    if (!dirty || !activeProjectId || saving) return;
    const timer = window.setTimeout(() => {
      if (activeStyleId) {
        void saveSelectedStyle();
      } else {
        saveLocalDraft();
      }
    }, AUTOSAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [activeProjectId, activeStyleId, config, dirty, saveLocalDraft, saveSelectedStyle, saving]);

  if (notFound) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-background text-foreground">
        <p className="text-sm text-muted-foreground">Project not found.</p>
        <NButton size="sm" onClick={() => router.push('/')}>Back to projects</NButton>
      </div>
    );
  }

  return (
    <div
      data-najm-design-vars=""
      className="flex h-screen flex-col overflow-hidden bg-background text-foreground md:flex-row"
      style={shellTypographyStyle}
    >
      <aside className="h-80 shrink-0 overflow-y-auto border-b border-border bg-card md:h-auto md:w-64 md:border-b-0 md:border-r">
        <SettingsSidebar
          saving={saving}
          dirty={dirty}
          lastSavedAt={lastSavedAt}
          lastSavedKind={lastSavedKind}
          saveError={saveError}
          onImport={() => setImportOpen(true)}
          onExport={() => setExportOpen(true)}
        />
      </aside>
      <main className="min-w-0 flex-1 overflow-y-auto bg-background">
        <PreviewCanvas />
      </main>

      <ComponentStyleFlyout />
      <ImportDialog open={importOpen} onOpenChange={setImportOpen} />
      <ExportDialog open={exportOpen} onOpenChange={setExportOpen} />
      <Toaster richColors position="bottom-right" />
    </div>
  );
}
