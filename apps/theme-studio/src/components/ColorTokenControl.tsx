import { useState } from "react";
import { ColorPickerInput, NButton } from "najm-kit";
import { Check, Copy } from "lucide-react";
import { useStudio } from "../app/studio-store";
import { CHART_TOKEN_DEFAULTS, tokenLabel, type TokenKey } from "../theme/token-meta";

export function ColorTokenControl({ tokenKey }: { tokenKey: TokenKey }) {
  const { config, setToken } = useStudio();
  const tokens = config.theme.tokens as Record<string, string> | undefined;
  const value = tokens?.[tokenKey] ?? "";
  const defaultToken = CHART_TOKEN_DEFAULTS[tokenKey];
  const inheritedValue = defaultToken ? tokens?.[defaultToken] : undefined;
  const inheritedLabel = defaultToken ? tokenLabel(defaultToken) : undefined;
  const effectiveValue = value || inheritedValue || "";
  const [copied, setCopied] = useState(false);

  async function copyValue() {
    if (!effectiveValue) return;
    try {
      await navigator.clipboard.writeText(effectiveValue);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div className="flex h-9 items-center gap-2 py-0.5">
      <ColorPickerInput
        mode="popover"
        output="oklch"
        hideSwatches
        value={effectiveValue || "oklch(0.5 0 0)"}
        onChange={(c) => setToken(tokenKey, c)}
        className="h-7 w-7 shrink-0 gap-0 overflow-hidden p-1 [&>span:first-child]:size-5 [&>span:last-child]:sr-only"
      />
      <span className="min-w-0 flex-1 truncate text-xs font-medium">{tokenLabel(tokenKey)}</span>
      <input
        type="text"
        value={value}
        placeholder={inheritedValue || effectiveValue}
        spellCheck={false}
        onChange={(e) => setToken(tokenKey, e.target.value)}
        className="h-7 w-28 shrink-0 rounded-md border border-border bg-transparent px-2 font-mono text-[11px] text-muted-foreground outline-none transition-colors focus:border-ring focus:text-foreground"
      />
      <NButton
        variant="ghost"
        size="icon-xs"
        aria-label="Copy color"
        title="Click to copy"
        onClick={copyValue}
      >
        {copied ? <Check className="size-3 text-primary" /> : <Copy className="size-3" />}
      </NButton>
    </div>
  );
}
