import { useMemo } from "react";
import { NajmDesignProvider } from "najm-kit";
import { useStudio } from "../app/studio-store";
import { DashboardPreview } from "./preview/DashboardPreview";

export function PreviewCanvas() {
  const { config, previewLayout } = useStudio();
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
      <div className="min-h-0 flex-1 p-6">
        <NajmDesignProvider
          config={previewConfig}
          className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-background text-foreground shadow-2xl"
        >
          <div className="theme-preview min-h-0 flex-1 overflow-hidden">
            <DashboardPreview />
          </div>
        </NajmDesignProvider>
      </div>
    </div>
  );
}
