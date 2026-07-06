import { useState } from "react";
import { Check, ChevronDown, Copy } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger, ColorPickerInput, NButton } from "najm-kit";
import { useStudio } from "../../app/studio-store";
import { TOKEN_CATEGORIES } from "../../theme/token-meta";
import { ColorTokenControl } from "../ColorTokenControl";

const LEGACY_TABLE_COLORS: Record<string, string> = {
  primary: "var(--primary)",
  violet: "#7c3aed",
  blue: "#2563eb",
  emerald: "#059669",
  amber: "#f59e0b",
  rose: "#e11d48",
  slate: "#475569",
};

const TABLE_COLOR_FIELDS = [
  {
    key: "headerColor",
    label: "Header",
    token: "primary",
    fallback: "oklch(0.5227 0.1920 9.5005)",
  },
  {
    key: "headerTextColor",
    label: "Text",
    token: "primary-foreground",
    fallback: "oklch(1 0 0)",
  },
  {
    key: "borderColor",
    label: "Border",
    token: "border",
    fallback: "oklch(0.9219 0 0)",
  },
] as const;

function resolveTableInputValue(
  value: string,
  tokens: Record<string, string> | undefined,
  fallback: string,
) {
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  if (tokens?.[trimmed]) return tokens[trimmed];
  if (LEGACY_TABLE_COLORS[trimmed]) {
    const legacy = LEGACY_TABLE_COLORS[trimmed];
    return tokens?.primary && legacy === "var(--primary)" ? tokens.primary : legacy;
  }
  return trimmed;
}

function TableColorRow({
  label,
  value,
  placeholder,
  effectiveValue,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  effectiveValue: string;
  onChange: (value: string) => void;
}) {
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
        onChange={onChange}
        className="h-7 w-7 shrink-0 gap-0 overflow-hidden p-1 [&>span:first-child]:size-5 [&>span:last-child]:sr-only"
      />
      <span className="min-w-0 flex-1 truncate text-xs font-medium">{label}</span>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        spellCheck={false}
        onChange={(event) => onChange(event.target.value)}
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

function TableColorControl() {
  const { config, setComponentConfig } = useStudio();
  const tokens = config.theme.tokens as Record<string, string> | undefined;
  const tableConfig = config.components?.table ?? {};

  return (
    <div className="flex flex-col">
      {TABLE_COLOR_FIELDS.map((field) => {
        const value = tableConfig[field.key] ?? "";
        const inheritedValue = tokens?.[field.token] ?? field.fallback;
        return (
          <TableColorRow
            key={field.key}
            label={field.label}
            value={value}
            placeholder={inheritedValue}
            effectiveValue={resolveTableInputValue(value, tokens, inheritedValue)}
            onChange={(nextValue) => setComponentConfig("table", { [field.key]: nextValue })}
          />
        );
      })}
    </div>
  );
}

export function ColorsTab() {
  const { activeTokenCategory, setTokenCategory } = useStudio();
  const [openSections, setOpenSections] = useState<string[]>([activeTokenCategory]);

  function toggleSection(id: string) {
    setTokenCategory(id as typeof activeTokenCategory);
    setOpenSections((current) =>
      current.includes(id)
        ? current.filter((section) => section !== id)
        : [...current, id],
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {TOKEN_CATEGORIES.map((category) => (
        <Collapsible
          key={category.id}
          open={openSections.includes(category.id)}
          onOpenChange={() => toggleSection(category.id)}
        >
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className={
                activeTokenCategory === category.id
                  ? "inline-flex h-7 w-fit items-center gap-1 rounded-md bg-muted px-2 text-xs font-semibold uppercase tracking-wide text-foreground"
                  : "inline-flex h-7 w-fit items-center gap-1 rounded-md bg-muted/60 px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground"
              }
            >
              <ChevronDown
                className={
                  openSections.includes(category.id)
                    ? "size-3 rotate-180 transition-transform"
                    : "size-3 transition-transform"
                }
              />
              {category.label}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent
            forceMount
            className="overflow-hidden data-[state=closed]:max-h-0 data-[state=open]:max-h-[1200px] data-[state=closed]:opacity-0 data-[state=open]:opacity-100 transition-all"
          >
            <div
              className="pl-2 pt-2"
              onFocusCapture={() => setTokenCategory(category.id)}
            >
              {category.id === "table" ? (
                <TableColorControl />
              ) : (
                <div className="flex flex-col">
                  {category.tokens.map((key) => (
                    <ColorTokenControl key={key} tokenKey={key} />
                  ))}
                </div>
              )}
              {category.advancedTokens && category.advancedTokens.length > 0 && (
                <details className="group mt-1 border-t border-border pt-1">
                  <summary className="flex cursor-pointer list-none items-center justify-between py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">
                    <span>Advanced colors</span>
                    <span className="text-[10px] uppercase tracking-normal group-open:hidden">Show</span>
                    <span className="hidden text-[10px] uppercase tracking-normal group-open:inline">Hide</span>
                  </summary>
                  <div className="flex flex-col">
                    {category.advancedTokens.map((key) => (
                      <ColorTokenControl key={key} tokenKey={key} />
                    ))}
                  </div>
                </details>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      ))}
    </div>
  );
}
