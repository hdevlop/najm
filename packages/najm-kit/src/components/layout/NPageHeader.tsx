import React, { type ReactNode, type InputHTMLAttributes, type Ref, type ComponentType, useCallback, useState } from 'react';
import { Search } from 'lucide-react';
import { cn } from "../../lib/cn";
import { borderColorClassForDegree, useResolvedBorderDegree } from "../../theme/borders";
import type { NajmBorderDegree } from "../../theme/types";

interface PageHeaderSlotProps {
  children: ReactNode;
  className?: string;
}

export interface NPageHeaderProps {
  icon: ComponentType<{ className?: string }>;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  filters?: ReactNode;
  top?: ReactNode;
  search?: InputHTMLAttributes<HTMLInputElement> & {
    placeholder?: string;
    ref?: Ref<HTMLInputElement>;
  };
  children?: ReactNode;
  className?: string;
  headerClassName?: string;
  bordered?: boolean;
  borderDegree?: NajmBorderDegree;
}

export function NPageHeaderActions({ children, className }: PageHeaderSlotProps) {
  return <div className={cn("flex shrink-0 items-center gap-2 sm:gap-3", className)}>{children}</div>;
}
NPageHeaderActions.displayName = "NPageHeaderActions";

export function NPageHeaderFilters({ children, className }: PageHeaderSlotProps) {
  return <div className={cn("px-4 py-3 sm:px-5", className)}>{children}</div>;
}
NPageHeaderFilters.displayName = "NPageHeaderFilters";

export function NPageHeaderTop({ children, className }: PageHeaderSlotProps) {
  return <div className={className}>{children}</div>;
}
NPageHeaderTop.displayName = "NPageHeaderTop";

function isPageHeaderSlot(child: ReactNode, slot: React.ComponentType<PageHeaderSlotProps>) {
  return React.isValidElement(child) && child.type === slot;
}

function getSlotElements(children: ReactNode, slot: React.ComponentType<PageHeaderSlotProps>) {
  const matches = React.Children.toArray(children).filter((child) => isPageHeaderSlot(child, slot));
  return matches.length > 0 ? matches : undefined;
}

export function NPageHeader({ icon: Icon, title, subtitle, actions, filters, top, search, children, className, headerClassName, bordered, borderDegree }: NPageHeaderProps) {
  const [internalSearch, setInternalSearch] = useState('');
  const searchValue = search?.value ?? internalSearch;
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setInternalSearch(e.target.value);
    search?.onChange?.(e);
  }, [search?.onChange]);
  const slottedActions = getSlotElements(children, NPageHeaderActions);
  const slottedFilters = getSlotElements(children, NPageHeaderFilters);
  const slottedTop = getSlotElements(children, NPageHeaderTop);
  const resolvedActions = slottedActions ?? actions;
  const resolvedFilters = slottedFilters ?? filters;
  const resolvedTop = slottedTop ?? top;

  const resolvedBorderDegree = useResolvedBorderDegree({
    borderDegree,
    bordered,
    fallback: "default",
  });
  const hasBorderShell = bordered || Boolean(borderDegree) || resolvedBorderDegree !== "default";
  const isStrong = resolvedBorderDegree === "strong";

  return (
    <div
      data-slot="page-header"
      data-border-degree={hasBorderShell ? resolvedBorderDegree : undefined}
      className={cn(
        hasBorderShell
          ? cn("border rounded-xl bg-card shadow-none", borderColorClassForDegree(resolvedBorderDegree))
          : "border-b border-border",
        isStrong && "shadow-none",
        className
      )}
    >
      {resolvedTop}
      <div className={cn("flex min-h-14 flex-row items-center justify-between gap-2 px-4 pl-16 sm:px-5 md:pl-5", headerClassName)}>
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 rounded-lg bg-primary/10 items-center justify-center">
            <Icon className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-foreground">{title}</h2>
            {subtitle && <p className="truncate text-xs leading-relaxed text-muted-foreground sm:text-sm sm:leading-normal">{subtitle}</p>}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {search && (
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <input
                ref={search.ref}
                type="text"
                value={searchValue}
                placeholder={search.placeholder ?? "Search..."}
                className={cn(
                  "h-9 w-full max-w-[280px] rounded-lg bg-background pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground outline-none border border-border focus:border-primary focus:ring-1 focus:ring-primary/20 transition-colors",
                  search.className
                )}
                onChange={handleSearchChange}
              />
            </div>
          )}
          {resolvedActions && (slottedActions ? resolvedActions : <NPageHeaderActions>{resolvedActions}</NPageHeaderActions>)}
        </div>
      </div>
      {resolvedFilters && (slottedFilters ? resolvedFilters : <NPageHeaderFilters>{resolvedFilters}</NPageHeaderFilters>)}
    </div>
  );
}
