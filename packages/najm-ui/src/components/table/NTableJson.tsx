import React from "react";
import { useTableStore } from "./TableContext";
import { JsonViewer } from "../../json/JsonViewer";

export function NTableJson() {
  const viewMode = useTableStore.use.viewMode();
  const renderJson = useTableStore.use.renderJson();
  const jsonValue = useTableStore.use.jsonValue();
  const jsonColors = useTableStore.use.jsonColors();

  if (viewMode !== "json") return null;

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {renderJson?.() ?? <JsonViewer value={jsonValue} className="h-full max-h-none" maxHeight="none" />}
    </div>
  );
}