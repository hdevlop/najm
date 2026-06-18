import { useMemo } from "react";
import { NajmDesignProvider, NajmScroll, NPageLayout } from "najm-kit";
import { useStudio, type PreviewId } from "../app/studio-store";
import { DashboardPreview } from "./preview/DashboardPreview";
import { ComponentGalleryPreview } from "./preview/ComponentGalleryPreview";
import { FormsPreview } from "./preview/FormsPreview";
import { DataPreview } from "./preview/DataPreview";
import { OverlayPreview } from "./preview/OverlayPreview";
import { ChartsPreview } from "./preview/ChartsPreview";

const TABS: { id: PreviewId; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "components", label: "Components" },
  { id: "forms", label: "Forms" },
  { id: "data", label: "Data" },
  { id: "overlays", label: "Overlays" },
  { id: "charts", label: "Charts" },
];

export function PreviewCanvas() {
  const { config, preview, previewLayout, setPreview } = useStudio();
  const previewConfig = useMemo(
    () => ({
      ...config,
      layout: {
        ...(config.layout ?? {}),
        pageGutter: `${previewLayout.gutter}px`,
        sectionGap: `${previewLayout.gap}px`,
      },
    }),
    [config, previewLayout.gap, previewLayout.gutter],
  );

  return (
    <div className="flex h-full flex-col">
      <div className="sticky top-0 z-10 flex flex-wrap gap-1 border-b border-border bg-card/95 px-4 py-2 backdrop-blur">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setPreview(t.id)}
            className={`cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              preview === t.id ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 p-6">
        <NajmDesignProvider
          config={previewConfig}
          className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-background text-foreground shadow-2xl"
        >
          <div className="min-h-0 flex-1 overflow-hidden">
            {preview === "dashboard" ? (
              // Full app shell — fills the frame edge-to-edge, like a real app.
              <DashboardPreview />
            ) : (
              // Overlay scrollbar reserves no layout space, so a 0 gutter is a
              // true 0 and left/right stay symmetric.
              <NajmScroll className="h-full">
                <NPageLayout>
                  {preview === "components" && <ComponentGalleryPreview />}
                  {preview === "forms" && <FormsPreview />}
                  {preview === "data" && <DataPreview />}
                  {preview === "overlays" && <OverlayPreview />}
                  {preview === "charts" && <ChartsPreview />}
                </NPageLayout>
              </NajmScroll>
            )}
          </div>
        </NajmDesignProvider>
      </div>
    </div>
  );
}
