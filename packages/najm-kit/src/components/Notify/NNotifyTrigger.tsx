import * as React from "react";
import { Bell } from "lucide-react";
import { cn } from "../../lib/cn";
import { NButton, type NButtonProps } from "../Button";
import { NIndicator } from "../Indicator";
import type { BadgeColor } from "../Badge";
import { PopoverTrigger } from "../ui/popover";
import { useNNotifyContext } from "./NNotifyContext";

/** Shared icon-button treatment for header actions: visible in both themes. */
export const globalActionButtonClass =
  "text-foreground hover:text-foreground [&_svg]:text-foreground [&_svg]:opacity-100";

/** Hidden at zero, localized 1-99, `99+` above 99. */
export function formatNotifyCount(count: number, locale?: string): string {
  if (!Number.isFinite(count) || count <= 0) return "";
  if (count > 99) return "99+";
  try {
    return new Intl.NumberFormat(locale).format(Math.floor(count));
  } catch {
    return String(Math.floor(count));
  }
}

function documentLocale(): string | undefined {
  if (typeof document === "undefined") return undefined;
  return document.documentElement.lang || undefined;
}

export interface NNotifyTriggerProps
  extends Omit<NButtonProps, "children" | "type" | "asChild"> {
  unreadCount?: number;
  /** Accessible name of the button. */
  label: string;
  /** Politely announced whenever the count changes. */
  unreadLabel?: (count: number) => string;
  /** Overrides the default count formatting. An empty string hides the badge. */
  formatCount?: (count: number) => string;
  /** Number locale for the badge. Defaults to the document language. */
  locale?: string;
  icon?: React.ReactNode;
  indicatorColor?: BadgeColor;
}

/**
 * The button itself, separated from the popover trigger on purpose: Radix
 * `asChild` clones the element it is given, so the popover's props have to
 * reach a component that forwards them to the `<button>`. Cloning the
 * indicator wrapper instead would put `onClick` and `aria-expanded` on a div.
 */
const NotifyBell = React.forwardRef<HTMLButtonElement, NNotifyTriggerProps>(
  function NotifyBell(
    {
      unreadCount = 0,
      label,
      unreadLabel,
      formatCount,
      locale,
      icon,
      indicatorColor = "destructive",
      className,
      size = "icon",
      variant = "ghost",
      ...buttonProps
    },
    ref,
  ) {
    const badge = formatCount
      ? formatCount(unreadCount)
      : formatNotifyCount(unreadCount, locale ?? documentLocale());
    const announcement = unreadCount > 0 ? unreadLabel?.(unreadCount) ?? "" : "";

    const button = (
      <NButton
        {...buttonProps}
        aria-label={label}
        className={cn(globalActionButtonClass, className)}
        data-slot="notify-trigger"
        ref={ref}
        size={size}
        type="button"
        variant={variant}
      >
        {icon ?? <Bell size={18} />}
        <span aria-live="polite" className="sr-only">
          {announcement}
        </span>
      </NButton>
    );

    // Hidden at zero: the indicator overlay is a persistent dot, so it is only
    // mounted once there is a count to show.
    if (!badge) return button;

    return (
      <NIndicator color={indicatorColor} content={badge} overlay="badge">
        {button}
      </NIndicator>
    );
  },
);

/** The bell that opens the menu. */
export const NNotifyTrigger = React.forwardRef<HTMLButtonElement, NNotifyTriggerProps>(
  function NNotifyTrigger(props, ref) {
    useNNotifyContext("NNotifyTrigger");
    return (
      <PopoverTrigger asChild>
        <NotifyBell {...props} ref={ref} />
      </PopoverTrigger>
    );
  },
);
