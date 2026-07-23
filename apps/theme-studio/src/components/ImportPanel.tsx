import { useState } from "react";
import {
  NAlert,
  NDialog,
  Textarea,
  toast,
} from "najm-kit";
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

  const handleImport = async () => {
    const result = importDesign(text);
    if (result.ok && result.config) {
      try {
        const saved = await importConfig(result.config);
        toast.success(saved ? `Imported and saved as "${saved.name}"` : "Imported design config");
        setError(null);
        setText("");
        onOpenChange(false);
      } catch (err) {
        setError((err as Error).message ?? "Failed to import config");
      }
    } else {
      setError(result.error ?? "Invalid config");
    }
  };

  return (
    <NDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Import Design Config"
      width="lg"
      closeOnPrimary={false}
      secondaryButton={{ text: "Cancel", onClick: () => onOpenChange(false) }}
      primaryButton={{ text: "Import", onClick: handleImport }}
    >
      <div className="flex flex-col gap-3">
        {error && <NAlert variant="destructive">{error}</NAlert>}
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder='Paste NajmDesignConfig or NajmThemeConfig JSON…'
          spellCheck={false}
          className="h-64 resize-none font-mono text-xs"
        />
      </div>
    </NDialog>
  );
}
