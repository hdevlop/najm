import { useState } from "react";
import {
  Button,
  NAlert,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "najm-kit";
import { toast } from "sonner";
import { useStudio } from "../app/studio-store";
import { importDesign } from "../theme/import-theme";

export function ImportDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { importConfig } = useStudio();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleImport = () => {
    const result = importDesign(text);
    if (result.ok && result.config) {
      importConfig(result.config);
      toast.success("Imported design config");
      setError(null);
      setText("");
      onOpenChange(false);
    } else {
      setError(result.error ?? "Invalid config");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Import Design Config</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          {error && <NAlert variant="destructive">{error}</NAlert>}
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder='Paste NajmDesignConfig or NajmThemeConfig JSON…'
            spellCheck={false}
            className="h-64 w-full rounded-md border border-border bg-background p-3 font-mono text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleImport}>Import</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
