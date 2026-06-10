import { cn } from "../../lib/cn";
import { NSidebarItem } from "./NSidebarItem";
import type { NSidebarSectionProps } from "./types";

export function NSidebarSection({
  group,
  activePath,
  isActive,
  onNavigate,
  linkComponent,
  collapsed,
  showSectionLabels,
  showSectionIcons,
  showSectionSeparators,
  isFirst,
  classNames,
}: NSidebarSectionProps) {
  return (
    <div
      data-sidebar-section
      className={cn(
        "flex flex-col gap-1",
        showSectionSeparators && !isFirst && "border-t border-border/70 pt-3"
      )}
    >
      {showSectionLabels && group.sectionLabel && (
        collapsed ? (
          <div className="h-5" />
        ) : (
          <div className="flex items-center gap-2 h-5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {showSectionIcons && group.sectionIcon && <group.sectionIcon className="h-3.5 w-3.5 shrink-0" />}
            <span>{group.sectionLabel}</span>
          </div>
        )
      )}
      {group.items.map((item) => (
        <NSidebarItem
          key={item.id}
          item={item}
          activePath={activePath}
          isActive={isActive}
          onNavigate={onNavigate}
          linkComponent={linkComponent}
          collapsed={collapsed}
          classNames={classNames}
        />
      ))}
    </div>
  );
}
