import React from "react";
import { useTableStore } from "./TableContext";
import { NajmScroll } from "../ui/scroll";

function formatJsonValue(value: unknown) {
  if (typeof value === "string") return value;

  try {
    return JSON.stringify(value ?? null, null, 2) ?? String(value);
  } catch {
    return String(value);
  }
}

export function NTableJson() {
  const viewMode = useTableStore.use.viewMode();
  const renderJson = useTableStore.use.renderJson();
  const jsonValue = useTableStore.use.jsonValue();

  if (viewMode !== "json") return null;

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {renderJson?.() ?? (
        <NajmScroll axis="both" className="h-full min-h-0 rounded-md border border-border bg-muted/40">
          <pre className="p-4 font-mono text-xs leading-relaxed text-foreground">
            {formatJsonValue(jsonValue)}
          </pre>
        </NajmScroll>
      )}
    </div>
  );
}
