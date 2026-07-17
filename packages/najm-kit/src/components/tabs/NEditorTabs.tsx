import React, { useLayoutEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { cn } from "../../lib/cn";
import { SimpleTooltip } from "../ui/simple-tooltip";
import { NIcon, type NIconSource } from "../Icon";
import { NTabs, type NTabsClassNames, type NTabsStyles } from "./NTabs";

export type NEditorTab<V extends string = string> = {
  value: V;
  name: string;
  icon?: NIconSource;
  dirty?: boolean;
  closable?: boolean;
  disabled?: boolean;
  content?: React.ReactNode;
};

export interface NEditorTabsProps<V extends string = string> {
  items: NEditorTab<V>[];
  value?: V;
  defaultValue?: V;
  onValueChange?: (value: V) => void;
  onClose?: (value: V) => void;
  className?: string;
  classNames?: NTabsClassNames;
  styles?: NTabsStyles;
}

/**
 * Given the tab list before a close, returns the value that should become
 * active after `closedValue` is removed: the previous tab, else the first
 * remaining one, else undefined when the list becomes empty.
 */
export function getNextEditorTabValue<V extends string = string>(
  items: NEditorTab<V>[],
  closedValue: V,
): V | undefined {
  const next = items.filter((item) => item.value !== closedValue);
  const closedIndex = items.findIndex((item) => item.value === closedValue);
  return (next[closedIndex - 1] ?? next[0])?.value;
}

type NEditorTabLabelProps<V extends string> = {
  tab: NEditorTab<V>;
  onClose?: (value: V) => void;
};

function NEditorTabLabel<V extends string>({ tab, onClose }: NEditorTabLabelProps<V>) {
  const nameRef = useRef<HTMLDivElement>(null);
  const [isNameTruncated, setIsNameTruncated] = useState(false);

  useLayoutEffect(() => {
    const name = nameRef.current;
    if (!name || typeof ResizeObserver === "undefined") return;

    const updateTruncation = () => {
      setIsNameTruncated(name.scrollWidth > name.clientWidth);
    };

    updateTruncation();
    const observer = new ResizeObserver(updateTruncation);
    observer.observe(name);

    return () => observer.disconnect();
  }, [tab.name]);

  return (
    <div className="flex w-full min-w-0 items-center gap-1.5 leading-none">
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        {tab.icon != null && <NIcon icon={tab.icon} size={14} className="shrink-0" />}
        <SimpleTooltip
          content={tab.name}
          side="bottom"
          delayDuration={300}
          disabled={!isNameTruncated}
        >
          <div ref={nameRef} className="min-w-0 flex-1 truncate text-left leading-none">
            {tab.name}
          </div>
        </SimpleTooltip>
      </div>

      {tab.closable !== false ? (
        <div
          role="button"
          tabIndex={-1}
          aria-label={`Close ${tab.name}`}
          className="flex size-4 shrink-0 items-center justify-center rounded-sm hover:bg-foreground/10"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onClose?.(tab.value);
          }}
        >
          {tab.dirty ? (
            <>
              <span className="size-2 rounded-full bg-amber-500 group-hover/tab:hidden" aria-hidden />
              <X className="hidden size-3 group-hover/tab:block" aria-hidden />
            </>
          ) : (
            <X className="size-3" aria-hidden />
          )}
        </div>
      ) : null}
    </div>
  );
}

export function NEditorTabs<V extends string = string>({
  items,
  value,
  defaultValue,
  onValueChange,
  onClose,
  className,
  classNames,
  styles,
}: NEditorTabsProps<V>) {
  return (
    <NTabs<V>
      value={value}
      defaultValue={defaultValue}
      onValueChange={onValueChange}
      variant="bordered"
      items={items.map((tab) => ({
        value: tab.value,
        disabled: tab.disabled,
        content: tab.content ?? null,
        label: <NEditorTabLabel tab={tab} onClose={onClose} />,
      }))}
      className={className}
      classNames={{
        ...classNames,
        root: cn("w-full gap-0", classNames?.root),
        list: cn("w-full justify-start gap-px border-b border-border px-2", classNames?.list),
        trigger: cn(
          "group/tab h-8 w-40 min-w-40 items-center rounded-t-xl px-3 py-0 text-xs font-normal leading-none border-border/40 bg-secondary/40 text-muted-foreground hover:text-foreground data-[state=active]:border-border data-[state=active]:bg-card data-[state=active]:text-card-foreground",
          classNames?.trigger,
        ),
      }}
      styles={styles}
    />
  );
}
