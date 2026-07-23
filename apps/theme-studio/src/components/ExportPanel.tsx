import { useState } from "react";
import {
  NButton,
  NDialog,
  SegmentedControl,
  toast,
} from "najm-kit";
import { Copy, Download } from "lucide-react";
import { useStudio } from "../app/studio-store";
import { exportAs, downloadText, type ExportFormat } from "../theme/export-theme";

const FORMATS: { id: ExportFormat; label: string }[] = [
  { id: "json", label: "JSON" },
  { id: "typescript", label: "TypeScript" },
  { id: "css", label: "CSS" },
  { id: "usage", label: "Usage" },
];

const EXT: Record<ExportFormat, string> = {
  json: "json",
  typescript: "ts",
  css: "css",
  usage: "tsx",
};

export function ExportPanel() {
  const { config, previewLayout } = useStudio();
  const [format, setFormat] = useState<ExportFormat>("json");
  const text = exportAs(config, format, previewLayout);

  return (
    <div className="flex flex-col gap-3">
      <SegmentedControl
        value={format}
        onChange={(v) => setFormat(v as ExportFormat)}
        options={FORMATS.map((f) => ({ value: f.id, label: f.label }))}
        size="sm"
      />
      <pre className="max-h-[60vh] min-h-80 overflow-auto rounded-md border border-border bg-muted p-3 font-mono text-xs leading-relaxed text-foreground">
        <code>{text}</code>
      </pre>
      <div className="flex gap-2">
        <NButton
          size="sm"
          variant="outline"
          leftIcon={<Copy className="size-4" />}
          onClick={async () => {
            await navigator.clipboard.writeText(text);
            toast.success("Copied to clipboard");
          }}
        >
          Copy
        </NButton>
        {format !== "usage" && (
          <NButton
            size="sm"
            leftIcon={<Download className="size-4" />}
            onClick={() => {
              downloadText(`najm-theme.${EXT[format]}`, text);
              toast.success("Downloaded");
            }}
          >
            Download
          </NButton>
        )}
      </div>
    </div>
  );
}

export function ExportDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  return (
    <NDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Export Theme"
      width="lg"
      showButtons={false}
    >
      <ExportPanel />
    </NDialog>
  );
}
