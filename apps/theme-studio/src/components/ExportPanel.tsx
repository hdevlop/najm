import { useState } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "najm-kit";
import { Copy, Download } from "lucide-react";
import { toast } from "sonner";
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
      <div className="flex flex-wrap gap-1">
        {FORMATS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFormat(f.id)}
            className={`cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              format === f.id ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>
      <pre className="max-h-72 overflow-auto rounded-md border border-border bg-muted/40 p-3 text-xs">
        <code>{text}</code>
      </pre>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          leftIcon={<Copy className="size-4" />}
          onClick={async () => {
            await navigator.clipboard.writeText(text);
            toast.success("Copied to clipboard");
          }}
        >
          Copy
        </Button>
        {format !== "usage" && (
          <Button
            size="sm"
            leftIcon={<Download className="size-4" />}
            onClick={() => {
              downloadText(`najm-theme.${EXT[format]}`, text);
              toast.success("Downloaded");
            }}
          >
            Download
          </Button>
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Export Theme</DialogTitle>
        </DialogHeader>
        <ExportPanel />
      </DialogContent>
    </Dialog>
  );
}
