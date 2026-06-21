import { NSidebarSection } from "./NSidebarSection";
import { NajmScroll } from "../ui/scroll";
import type { NSidebarContentProps } from "./types";

export function NSidebarContent({
  groups,
  activePath,
  isActive,
  onNavigate,
  linkComponent,
  collapsed,
  showSectionLabels,
  showSectionIcons,
  showSectionSeparators,
  contentStyle,
  classNames,
}: NSidebarContentProps) {
  return (
    <NajmScroll axis="y" className="flex-1">
    <nav className="flex flex-col gap-3 px-4 py-2" style={contentStyle}>
      {groups.map((group, gi) => (
        <NSidebarSection
          key={gi}
          group={group}
          activePath={activePath}
          isActive={isActive}
          onNavigate={onNavigate}
          linkComponent={linkComponent}
          collapsed={collapsed}
          showSectionLabels={showSectionLabels}
          showSectionIcons={showSectionIcons}
          showSectionSeparators={showSectionSeparators}
          isFirst={gi === 0}
          classNames={classNames}
        />
      ))}
    </nav>
    </NajmScroll>
  );
}
