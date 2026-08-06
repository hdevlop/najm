import React, { type ReactNode, type InputHTMLAttributes, type Ref, type ComponentType, useCallback, useState } from 'react';
import { Menu, Search } from 'lucide-react';
import { cn } from "../../lib/cn";
import { Button } from "../Button";
import { surfaceBorderClasses } from "../../theme/borders";
import { useNajmComponentStyle } from "../../theme/design-provider";
import { resolveRadiusValue } from "../../theme/design-types";
import { useNSidebar } from "../sidebar/NSidebarContext";

interface PageHeaderSlotProps {
  children: ReactNode;
  className?: string;
}

export type NPageHeaderBreakpoint = 'sm' | 'md' | 'lg';

export interface NPageHeaderProps {
  icon: ComponentType<{ className?: string }>;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  /**
   * Optional consumer-owned replacement for `actions` on smaller screens.
   * Pass an icon button, dropdown, or any other compact control. When omitted,
   * the regular actions keep rendering at every viewport size.
   */
  compactActions?: ReactNode;
  filters?: ReactNode;
  top?: ReactNode;
  /** Must match the paired NSidebar breakpoint so its hamburger has reserved space. */
  mobileBreakpoint?: NPageHeaderBreakpoint;
  /** Renders the mobile sidebar trigger inside the header's leading column. */
  onSidebarOpen?: () => void;
  sidebarTriggerLabel?: string;
  sidebarTriggerClassName?: string;
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
  return <div className={cn("flex shrink-0 items-center gap-0 lg:gap-1 xl:gap-2 2xl:gap-2", className)}>{children}</div>;
}
NPageHeaderActions.displayName = "NPageHeaderActions";

export function NPageHeaderCompactActions({ children, className }: PageHeaderSlotProps) {
  return <div className={cn("flex shrink-0 items-center", className)}>{children}</div>;
}
NPageHeaderCompactActions.displayName = "NPageHeaderCompactActions";

export function NPageHeaderFilters({ children, className }: PageHeaderSlotProps) {
  return <div className={cn("py-3 lg:px-3 xl:px-4 2xl:px-5", className)}>{children}</div>;
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

const responsiveClasses = {
  sm: {
    main: "sm:flex sm:justify-between",
    identity: "sm:col-start-auto sm:row-start-auto sm:justify-self-auto",
    controls: "sm:col-start-auto sm:row-start-auto sm:justify-self-auto",
    fullActions: "sm:flex",
    compactActions: "sm:hidden",
    sidebarTrigger: "sm:hidden",
    icon: "sm:flex",
    subtitle: "sm:block",
    minH: "sm:min-h-14",
  },
  md: {
    main: "md:flex md:justify-between",
    identity: "md:col-start-auto md:row-start-auto md:justify-self-auto",
    controls: "md:col-start-auto md:row-start-auto md:justify-self-auto",
    fullActions: "md:flex",
    compactActions: "md:hidden",
    sidebarTrigger: "md:hidden",
    icon: "md:flex",
    subtitle: "md:block",
    minH: "md:min-h-14",
  },
  lg: {
    main: "lg:flex lg:justify-between lg:px-3 2xl:px-4",
    identity: "lg:col-start-auto lg:row-start-auto lg:justify-self-auto",
    controls: "lg:col-start-auto lg:row-start-auto lg:justify-self-auto",
    fullActions: "lg:flex",
    compactActions: "lg:hidden",
    sidebarTrigger: "lg:hidden",
    icon: "lg:flex",
    subtitle: "lg:block",
    minH: "lg:min-h-14",
  },
} as const;

export function NPageHeader({
  icon: Icon,
  title,
  subtitle,
  actions,
  compactActions,
  filters,
  top,
  mobileBreakpoint: mobileBreakpointProp,
  onSidebarOpen,
  sidebarTriggerLabel = "Open sidebar",
  sidebarTriggerClassName,
  search,
  children,
  className,
  headerClassName,
  card,
  bordered,
}: NPageHeaderProps) {
  const [internalSearch, setInternalSearch] = useState('');
  const recipe = useNajmComponentStyle("pageHeader");
  /**
   * Inside an `NSidebarProvider` the trigger and the breakpoint wire themselves
   * up, so a header nested anywhere in the page no longer has to be handed the
   * sidebar's opener. Explicit props still win.
   */
  const sidebar = useNSidebar();
  const resolvedOnSidebarOpen = onSidebarOpen ?? sidebar?.openMobile;
  const mobileBreakpoint = mobileBreakpointProp ?? sidebar?.mobileBreakpoint ?? 'md';
  const searchValue = search?.value ?? internalSearch;
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setInternalSearch(e.currentTarget.value);
    search?.onChange?.(e);
  }, [search?.onChange]);
  const slottedActions = getSlotElements(children, NPageHeaderActions);
  const slottedCompactActions = getSlotElements(children, NPageHeaderCompactActions);
  const slottedFilters = getSlotElements(children, NPageHeaderFilters);
  const slottedTop = getSlotElements(children, NPageHeaderTop);
  const resolvedActions = slottedActions ?? actions;
  const resolvedCompactActions = slottedCompactActions ?? compactActions;
  const resolvedFilters = slottedFilters ?? filters;
  const resolvedTop = slottedTop ?? top;
  const hasCompactActions = resolvedCompactActions !== undefined
    && resolvedCompactActions !== null
    && resolvedCompactActions !== false;
  const breakpointClasses = responsiveClasses[mobileBreakpoint];

  const isCard = card ?? recipe?.card ?? (bordered === true);
  const recipeRadius = resolveRadiusValue(recipe?.radius);
  /**
   * A non-card header is a full-bleed top bar, so it cancels the page padding
   * NPageLayout published. Without this it floats below and inside that
   * padding, and its bottom rule never meets the sidebar header's.
   *
   * These are inline rather than Tailwind utilities on purpose: a published
   * component cannot rely on the consumer's Tailwind build generating an
   * arbitrary class that only ever appears inside this package's bundle. The
   * `0px` fallbacks keep the header inert outside NPageLayout.
   */
  const bleedStyle: React.CSSProperties | undefined = isCard
    ? undefined
    : {
        marginTop: "calc(var(--najm-section-gap, 0px) * -1)",
        marginInline: "calc(var(--najm-page-gutter, 0px) * -1)",
      };

  const recipeStyle: React.CSSProperties | undefined =
    recipeRadius || recipe?.borderWidth || bleedStyle
      ? {
          ...bleedStyle,
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
          : cn(
              "border-b bg-background text-foreground",
              surfaceBorderClasses(true, 'bottom').replace('najm-border-b', 'najm-border-b'),
            ),
        className
      )}
    >
      {resolvedTop}
      <div
        data-slot="page-header-main"
        className={cn(
          // min-h-14 matches NSidebarHeader so the two bottom rules line up.
          "relative grid min-h-14 grid-cols-[minmax(2.75rem,1fr)_minmax(0,auto)_minmax(2.75rem,1fr)] items-center gap-2 px-2 lg:px-3 2xl:px-4",
          breakpointClasses.main,
          breakpointClasses.minH,
          headerClassName
        )}
      >
        {resolvedOnSidebarOpen && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={resolvedOnSidebarOpen}
            aria-label={sidebarTriggerLabel}
            data-slot="page-header-sidebar-trigger"
            className={cn(
              "col-start-1 row-start-1 justify-self-start",
              breakpointClasses.sidebarTrigger,
              sidebarTriggerClassName
            )}
          >
            <Menu className="h-5 w-5" />
          </Button>
        )}
        <div
          data-slot="page-header-identity"
          className={cn(
            "col-start-2 row-start-1 flex min-w-0 max-w-full items-center justify-self-center gap-2 lg:gap-3 xl:gap-3 2xl:gap-4",
            breakpointClasses.identity
          )}
        >
          <div className={cn("hidden h-8 w-8 shrink-0 rounded-lg bg-primary/10 items-center justify-center", breakpointClasses.icon)}>
            <Icon className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-foreground">{title}</h2>
            {subtitle && <p className={cn("hidden truncate text-xs leading-relaxed text-muted-foreground sm:text-sm sm:leading-normal", breakpointClasses.subtitle)}>{subtitle}</p>}
          </div>
        </div>
        <div
          data-slot="page-header-controls"
          className={cn(
            "col-start-3 row-start-1 flex min-w-0 shrink-0 items-center justify-self-end gap-3",
            breakpointClasses.controls
          )}
        >
          {hasCompactActions && (
            <div
              data-slot="page-header-compact-actions"
              className={cn("flex items-center", breakpointClasses.compactActions)}
            >
              {slottedCompactActions
                ? resolvedCompactActions
                : <NPageHeaderCompactActions>{resolvedCompactActions}</NPageHeaderCompactActions>}
            </div>
          )}
          <div
            data-slot="page-header-full-actions"
            className={cn(
              "shrink-0 items-center gap-3",
              hasCompactActions ? "hidden" : "flex",
              hasCompactActions && breakpointClasses.fullActions
            )}
          >
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
      </div>
      {resolvedFilters && (slottedFilters ? resolvedFilters : <NPageHeaderFilters>{resolvedFilters}</NPageHeaderFilters>)}
    </div>
  );
}
