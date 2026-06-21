import { NTabs } from "najm-kit";
import { useStudio, type SettingsTab } from "../../app/studio-store";
import { ColorsTab } from "./ColorsTab";
import { LayoutTab } from "./LayoutTab";
import { SidebarActions } from "./SidebarActions";
import { TypographyTab } from "./TypographyTab";
import type { SettingsSidebarProps } from "./types";

const TABS: { id: SettingsTab; label: string }[] = [
  { id: "colors", label: "Colors" },
  { id: "typography", label: "Typography" },
  { id: "layout", label: "Layout" },
];

export function SettingsSidebar(props: SettingsSidebarProps) {
  const { activeSettingsTab, setTab } = useStudio();

  return (
    <div className="flex flex-col">
      <SidebarActions onImport={props.onImport} onExport={props.onExport} />
      <NTabs
        value={activeSettingsTab}
        onValueChange={(v) => setTab(v as SettingsTab)}
        variant="pills"
        items={TABS.map((t) => ({
          value: t.id,
          label: t.label,
          content: null,
        }))}

      />
      <div className="p-2 w-full">
        {activeSettingsTab === "colors" && <ColorsTab />}
        {activeSettingsTab === "typography" && <TypographyTab />}
        {activeSettingsTab === "layout" && <LayoutTab />}
      </div>
    </div>
  );
}
