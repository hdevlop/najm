import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import { cn } from "../../lib/cn";
import { NButton } from "../Button";
import { NConfirmDialog } from "../Dialog";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { TextInput } from "../inputs";
import type { NajmDesignConfig } from "../../theme/design-types";
import type { NThemePreset, NThemePresetsProps } from "./types";

/** Sentinel row that drops the preview and shows the host's saved design. */
export const NAJM_SAVED_THEME_VALUE = "__najm_saved_theme__";

/** Tokens drawn in each row, in the order that reads best as a strip. */
const SWATCH_TOKENS = [
  "sidebar",
  "primary",
  "secondary",
  "accent",
  "background",
] as const;

function ThemeSwatch({ design }: { design: NajmDesignConfig }) {
  const tokens = design.theme.tokens ?? {};

  return (
    <span
      aria-hidden="true"
      className="flex shrink-0 overflow-hidden rounded-sm border border-border"
    >
      {SWATCH_TOKENS.map((token) => (
        <span
          key={token}
          className="size-3.5"
          // A swatch must render the design's literal token value.
          style={{ backgroundColor: tokens[token] ?? "transparent" }}
        />
      ))}
    </span>
  );
}

/**
 * Saved-theme picker for `NThemeCustomizer`. Presentational only: the host owns
 * where presets live and what saving one means. Selecting a row hands the
 * design back through `onSelect` so the host can preview it before persisting.
 */
export function NThemePresets({
  presets,
  selectedPresetId = null,
  savedDesign,
  status = "idle",
  onSelect,
  onSave,
  onDelete,
  labels,
  disabled = false,
  className,
}: NThemePresetsProps) {
  const [saveOpen, setSaveOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [pendingDelete, setPendingDelete] = React.useState<NThemePreset | null>(
    null,
  );
  const [busy, setBusy] = React.useState(false);

  const rows = React.useMemo(
    () => [
      ...(savedDesign
        ? [
            {
              value: NAJM_SAVED_THEME_VALUE,
              label: labels.savedOption,
              design: savedDesign,
              preset: null as NThemePreset | null,
            },
          ]
        : []),
      ...presets.map((preset) => ({
        value: preset.id,
        label: preset.name,
        design: preset.design,
        preset,
      })),
    ],
    [labels.savedOption, presets, savedDesign],
  );

  const pending = disabled || busy || status === "loading";

  function handleValueChange(next: string) {
    if (next === NAJM_SAVED_THEME_VALUE) {
      onSelect(null);
      return;
    }
    const preset = presets.find((item) => item.id === next);
    if (preset) onSelect(preset);
  }

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed || !onSave) return;

    setBusy(true);
    try {
      await onSave(trimmed);
      setSaveOpen(false);
      setName("");
    } catch {
      // The host surfaces its own failure feedback.
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!pendingDelete || !onDelete) return;

    setBusy(true);
    try {
      await onDelete(pendingDelete);
      setPendingDelete(null);
    } catch {
      // The host surfaces its own failure feedback.
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      data-slot="theme-presets"
      className={cn(
        "flex flex-col gap-2 rounded-md border border-border bg-card p-3",
        className,
      )}
    >
      <Label className="text-sm font-semibold text-foreground">
        {labels.title}
      </Label>

      <div className="flex items-center gap-1.5">
        <span className="min-w-0 flex-1">
          <Select
            value={selectedPresetId ?? NAJM_SAVED_THEME_VALUE}
            onValueChange={handleValueChange}
            disabled={pending}
          >
            <SelectTrigger
              className="w-full"
              aria-label={
                typeof labels.select === "string" ? labels.select : undefined
              }
            >
              {/* SelectValue replays the row's own children, swatch included. */}
              <SelectValue placeholder={labels.selectPlaceholder} />
            </SelectTrigger>
            <SelectContent>
              {rows.map((row) => (
                <SelectItem
                  key={row.value}
                  value={row.value}
                  /**
                   * The check indicator ships anchored at the inline end. Flip
                   * the row padding, move it to the inline start, and let the
                   * text span stretch so the delete control can sit at the far
                   * inline end.
                   */
                  className="pe-2 ps-8 [&>span:first-child]:end-auto [&>span:first-child]:start-2 [&>span:first-child]:text-success [&>span:last-child]:min-w-0 [&>span:last-child]:flex-1"
                >
                  <span className="flex w-full min-w-0 items-center gap-2">
                    <ThemeSwatch design={row.design} />
                    <span className="flex-1 truncate">{row.label}</span>
                    {row.preset && onDelete ? (
                      <button
                        type="button"
                        /**
                         * Radix replays this markup inside the trigger, so the
                         * delete control hides itself when it lands there.
                         */
                        className="shrink-0 rounded-sm p-1 hover:bg-destructive/10 focus-visible:outline-2 focus-visible:outline-ring [[data-slot=select-trigger]_&]:hidden"
                        aria-label={
                          typeof labels.delete === "string"
                            ? `${labels.delete}: ${row.preset.name}`
                            : undefined
                        }
                        // Keep the row's own click from selecting the theme.
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          setPendingDelete(row.preset);
                        }}
                      >
                        <Trash2 className="size-3.5 text-destructive" />
                      </button>
                    ) : null}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </span>

        {onSave ? (
          <NButton
            type="button"
            variant="outline"
            size="icon-sm"
            disabled={pending}
            aria-label={
              typeof labels.saveCurrent === "string"
                ? labels.saveCurrent
                : undefined
            }
            onClick={() => {
              setName("");
              setSaveOpen(true);
            }}
          >
            <Plus />
          </NButton>
        ) : null}
      </div>

      {status === "error" ? (
        <p role="alert" className="text-xs text-destructive">
          {labels.loadError}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          {presets.length === 0 && status === "idle"
            ? labels.empty
            : labels.description}
        </p>
      )}

      {onSave ? (
        <NConfirmDialog
          open={saveOpen}
          onOpenChange={(next) => {
            setSaveOpen(next);
            if (!next) setName("");
          }}
          title={
            typeof labels.saveTitle === "string" ? labels.saveTitle : undefined
          }
          description={
            typeof labels.saveDescription === "string"
              ? labels.saveDescription
              : undefined
          }
          confirmLabel={
            typeof labels.saveAction === "string" ? labels.saveAction : undefined
          }
          cancelLabel={
            typeof labels.cancel === "string" ? labels.cancel : undefined
          }
          loading={busy}
          onConfirm={() => void handleSave()}
        >
          {/* TextInput exposes no id/label prop, so the label wraps it. */}
          <Label className="flex flex-col items-start gap-1.5">
            <span>{labels.nameLabel}</span>
            <TextInput
              className="w-full"
              placeholder={
                typeof labels.namePlaceholder === "string"
                  ? labels.namePlaceholder
                  : undefined
              }
              value={name}
              onChange={setName}
              disabled={busy}
            />
          </Label>
        </NConfirmDialog>
      ) : null}

      {onDelete ? (
        <NConfirmDialog
          open={pendingDelete !== null}
          onOpenChange={(next) => {
            if (!next) setPendingDelete(null);
          }}
          title={
            typeof labels.deleteTitle === "string"
              ? labels.deleteTitle
              : undefined
          }
          description={
            typeof labels.deleteDescription === "string"
              ? labels.deleteDescription.replace(
                  "{name}",
                  pendingDelete?.name ?? "",
                )
              : undefined
          }
          confirmLabel={
            typeof labels.delete === "string" ? labels.delete : undefined
          }
          cancelLabel={
            typeof labels.cancel === "string" ? labels.cancel : undefined
          }
          variant="destructive"
          loading={busy}
          onConfirm={() => void handleDelete()}
        />
      ) : null}
    </section>
  );
}
