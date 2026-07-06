import React, { type ReactNode, type InputHTMLAttributes, type Ref, type ComponentType, useCallback, useState } from 'react';
import { Search } from 'lucide-react';
import { cn } from "../../lib/cn";
import { surfaceBorderClasses } from "../../theme/borders";
import { useNajmComponentStyle } from "../../theme/design-provider";
import { resolveRadiusValue } from "../../theme/design-types";

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
  /** Renders the header as a card-like surface. `bordered` is kept as an alias. */
  card?: boolean;
  bordered?: boolean;
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

export function NPageHeader({ icon: Icon, title, subtitle, actions, filters, top, search, children, className, headerClassName, card, bordered }: NPageHeaderProps) {
  const [internalSearch, setInternalSearch] = useState('');
  const recipe = useNajmComponentStyle("pageHeader");
  const searchValue = search?.value ?? internalSearch;
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setInternalSearch(e.currentTarget.value);
    search?.onChange?.(e);
  }, [search?.onChange]);
  const slottedActions = getSlotElements(children, NPageHeaderActions);
  const slottedFilters = getSlotElements(children, NPageHeaderFilters);
  const slottedTop = getSlotElements(children, NPageHeaderTop);
  const resolvedActions = slottedActions ?? actions;
  const resolvedFilters = slottedFilters ?? filters;
  const resolvedTop = slottedTop ?? top;

  const isCard = card ?? recipe?.card ?? (bordered === true);
  const recipeRadius = resolveRadiusValue(recipe?.radius);
  const recipeStyle: React.CSSProperties | undefined =
    recipeRadius || recipe?.borderWidth
      ? {
          ...(recipeRadius ? { borderRadius: recipeRadius } : {}),
          ...(recipe?.borderWidth ? { borderWidth: recipe.borderWidth } : {}),
        }
      : undefined;

  return (
    <div
      data-slot="page-header"
      data-card={isCard ? "true" : undefined}
      data-bordered={bordered === false ? "false" : bordered ? "true" : undefined}
      style={recipeStyle}
      className={cn(
        isCard
          ? cn("rounded-xl bg-card text-card-foreground shadow-none", surfaceBorderClasses(true))
          : cn("border-b bg-background text-foreground", surfaceBorderClasses(true, 'bottom').replace('najm-border-b', 'najm-border-b')),
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
