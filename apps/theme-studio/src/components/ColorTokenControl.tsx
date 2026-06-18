import { ColorPickerInput, Button } from "najm-kit";
import { RotateCcw } from "lucide-react";
import { useStudio } from "../app/studio-store";
import { tokenLabel, type TokenKey } from "../theme/token-meta";

export function ColorTokenControl({ tokenKey }: { tokenKey: TokenKey }) {
  const { config, setToken, resetToken } = useStudio();
  const value = (config.theme.tokens as Record<string, string> | undefined)?.[tokenKey] ?? "";
  const displayValue = value || "oklch(0.5 0 0)";

  return (
    <div className="flex h-9 items-center justify-between gap-2 py-0.5">
      <div className="flex min-w-0 items-center gap-1.5">
        <span className="truncate text-xs font-medium">{tokenLabel(tokenKey)}</span>
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        <span title={displayValue}>
          <ColorPickerInput
            mode="popover"
            output="oklch"
            hideSwatches
            value={displayValue}
            onChange={(c) => setToken(tokenKey, c)}
            className="h-7 w-9 gap-0 overflow-hidden p-1 [&>span:first-child]:size-5 [&>span:last-child]:sr-only"
          />
        </span>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="Reset token"
          onClick={() => resetToken(tokenKey)}
        >
          <RotateCcw className="size-3" />
        </Button>
      </div>
    </div>
  );
}
