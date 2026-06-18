import { useState } from "react";
import { Button, Toaster } from "najm-kit";
import { Download, Upload, Save, PanelLeft, Sun, Moon } from "lucide-react";
import { toast } from "sonner";
import { useStudio } from "../app/studio-store";
import { SettingsSidebar } from "./SettingsSidebar";
import { PreviewCanvas } from "./PreviewCanvas";
import { ComponentStyleFlyout } from "./ComponentStyleFlyout";
import { ImportDialog } from "./ImportPanel";
import { ExportDialog } from "./ExportPanel";

export function StudioShell() {
  const { dirty, saveTheme, config, setMode } = useStudio();
  const mode = config.theme.mode ?? "light";
  const [importOpen, setImportOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      {/* Header */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card/95 px-4">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setSidebarOpen((v) => !v)}
            aria-label="Toggle settings"
          >
            <PanelLeft className="size-4" />
          </Button>
          <span className="text-sm font-semibold tracking-tight">Najm Theme Studio</span>
          {dirty && <span className="text-xs text-muted-foreground">• unsaved</span>}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={mode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            title={mode === "dark" ? "Light mode" : "Dark mode"}
            onClick={() => setMode(mode === "dark" ? "light" : "dark")}
          >
            {mode === "dark" ? <Moon className="size-4" /> : <Sun className="size-4" />}
          </Button>
          <Button variant="outline" size="sm" leftIcon={<Upload className="size-4" />} onClick={() => setImportOpen(true)}>
            Import
          </Button>
          <Button
            variant="outline"
            size="sm"
            leftIcon={<Save className="size-4" />}
            onClick={() => {
              const name = prompt("Theme name?");
              if (name) {
                saveTheme(name);
                toast.success(`Saved "${name}"`);
              }
            }}
          >
            Save
          </Button>
          <Button variant="default" size="sm" leftIcon={<Download className="size-4" />} onClick={() => setExportOpen(true)}>
            Export
          </Button>
        </div>
      </header>

      {/* Body */}
      <div className="flex min-h-0 flex-1">
        {sidebarOpen && (
          <aside className="w-80 shrink-0 overflow-y-auto border-r border-border bg-card">
            <SettingsSidebar />
          </aside>
        )}
        <main className="min-w-0 flex-1 overflow-y-auto bg-background">
          <PreviewCanvas />
        </main>
      </div>

      <ComponentStyleFlyout />
      <ImportDialog open={importOpen} onOpenChange={setImportOpen} />
      <ExportDialog open={exportOpen} onOpenChange={setExportOpen} />
      <Toaster richColors position="bottom-right" />
    </div>
  );
}
