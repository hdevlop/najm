import React, { type ReactNode, type InputHTMLAttributes, type Ref, useCallback, useState } from 'react';
import { type LucideIcon } from 'lucide-react';
import { Search } from 'lucide-react';
import { cn } from "../../lib/cn";

interface PageHeaderProps {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  filters?: ReactNode;
  top?: ReactNode;
  footer?: ReactNode;
  search?: InputHTMLAttributes<HTMLInputElement> & {
    placeholder?: string;
    ref?: Ref<HTMLInputElement>;
  };
  children: ReactNode;
  contentClassName?: string;
  contentRef?: React.Ref<HTMLDivElement>;
}

export function NPageHeader({ icon: Icon, title, subtitle, actions, filters, top, footer, search, children, contentClassName, contentRef }: PageHeaderProps) {
  const [internalSearch, setInternalSearch] = useState('');
  const searchValue = search?.value ?? internalSearch;
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setInternalSearch(e.target.value);
    search?.onChange?.(e);
  }, [search?.onChange]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex min-h-14 flex-row items-center justify-between gap-2 border-b border-border px-4 pl-16 sm:px-5 md:pl-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="hidden h-8 w-8 shrink-0 rounded-lg bg-primary/10 sm:flex items-center justify-center">
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
          {actions && <div className="flex shrink-0 items-center gap-2 sm:gap-3">{actions}</div>}
        </div>
      </div>
      {top}
      <div ref={contentRef} className={contentClassName ?? 'flex-1 overflow-auto'}>
        {filters && (
          <div className="sticky top-0 z-20 bg-background/95 backdrop-blur">
            <div className="px-4 py-3 sm:px-5">{filters}</div>
          </div>
        )}
        {children}
      </div>
      {footer}
    </div>
  );
}
