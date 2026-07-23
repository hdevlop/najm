import { useRouter } from "next/navigation";
import { ArrowLeft, Download, Moon, Sun, Upload } from "lucide-react";
import { NButton } from "najm-kit";
import { useStudio } from "../../app/studio-store";

interface SidebarActionsProps {
  onImport: () => void;
  onExport: () => void;
}

export function SidebarActions({ onImport, onExport }: SidebarActionsProps) {
  const router = useRouter();
  const { activeProject, config, setMode } = useStudio();
  const mode = config.theme.mode ?? "light";

  return (
    <div className="flex items-center gap-1 border-b border-border p-2">
      <NButton
        variant="ghost"
        size="icon-sm"
        aria-label="Back to projects"
        title="Back to projects"
        onClick={() => router.push('/')}
      >
        <ArrowLeft className="size-4" />
      </NButton>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold tracking-tight">
          {activeProject?.name ?? "Najm Theme Studio"}
        </p>
      </div>
      <NButton
        variant="ghost"
        size="icon-sm"
        aria-label="Import theme"
        title="Import"
        onClick={onImport}
      >
        <Upload className="size-4" />
      </NButton>
      <NButton
        variant="ghost"
        size="icon-sm"
        aria-label="Export theme"
        title="Export"
        onClick={onExport}
      >
        <Download className="size-4" />
      </NButton>
      <NButton
        variant="ghost"
        size="icon-sm"
        aria-label={mode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        title={mode === "dark" ? "Light mode" : "Dark mode"}
        onClick={() => setMode(mode === "dark" ? "light" : "dark")}
      >
        {mode === "dark" ? <Moon className="size-4" /> : <Sun className="size-4" />}
      </NButton>
    </div>
  );
}
