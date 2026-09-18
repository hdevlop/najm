import * as React from "react";
import { cn } from "../../lib/cn";
import { PopoverContent } from "../ui/popover";
import { useNNotifyContext } from "./NNotifyContext";

export interface NNotifyContentProps
  extends Omit<React.ComponentProps<typeof PopoverContent>, "children"> {
  children: React.ReactNode;
}

/**
 * The popover surface: end-aligned, safe at 320px, and a scrolling boundary
 * for the list.
 *
 * Children are not rendered while the menu is closed. A connected child may
 * therefore mount its own query on open and refetch on every entry, which is
 * the whole reason the compound form exists.
 */
export function NNotifyContent({
  children,
  className,
  align = "end",
  sideOffset = 8,
  ...contentProps
}: NNotifyContentProps) {
  const { open } = useNNotifyContext("NNotifyContent");

  return (
    <PopoverContent
      {...contentProps}
      align={align}
      className={cn(
        "flex max-h-[70vh] w-[min(24rem,calc(100vw-2rem))] flex-col gap-2 p-2",
        className,
      )}
      data-slot="notify-content"
      sideOffset={sideOffset}
    >
      {open ? children : null}
    </PopoverContent>
  );
}
NNotifyContent.displayName = "NNotifyContent";
