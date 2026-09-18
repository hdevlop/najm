import * as React from "react";
import { cn } from "../../lib/cn";
import { NBadge } from "../Badge";
import { NButton } from "../Button";
import { Card, CardContent } from "../ui/card";
import type {
  NNotifyErrorHandler,
  NNotifyItemData,
  NNotifyLabels,
  NNotifyTone,
} from "./types";
import { useNNotifyClose } from "./NNotifyContext";

const TONE_CLASS: Record<NNotifyTone, string> = {
  default: "text-muted-foreground",
  success: "text-success",
  warning: "text-warning",
  destructive: "text-destructive",
};

function renderIcon(icon: NNotifyItemData["icon"], tone: NNotifyTone) {
  if (!icon) return null;
  const className = cn("mt-0.5 size-[18px] shrink-0", TONE_CLASS[tone]);
  // An already-built element is rendered as given; a component type is called.
  // Lucide icons are forwardRef objects, not functions, so a `typeof` check
  // alone renders the component object as a child and React throws.
  if (React.isValidElement(icon)) {
    return (
      <span aria-hidden="true" className={className}>
        {icon}
      </span>
    );
  }
  if (typeof icon === "function" || (typeof icon === "object" && "$$typeof" in icon)) {
    const Icon = icon as React.ElementType;
    return <Icon aria-hidden="true" className={className} />;
  }
  return null;
}

/** Absolute time, or the just-now label under a minute and for junk input. */
export function formatNotifyTime(
  value: string | Date | undefined,
  justNow: string | undefined,
  locale?: string,
): string {
  if (value === undefined) return "";
  const then = value instanceof Date ? value.getTime() : Date.parse(value);
  if (!Number.isFinite(then)) return justNow ?? "";
  if (Date.now() - then < 60_000) return justNow ?? "";
  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(then));
  } catch {
    return justNow ?? "";
  }
}

export interface NNotifyItemProps {
  item: NNotifyItemData;
  labels: Pick<NNotifyLabels, "view" | "markRead"> &
    Partial<Pick<NNotifyLabels, "markingRead" | "unreadState" | "justNow">>;
  /** Application-owned pending state for this row. */
  pending?: boolean;
  onMarkRead?: (id: string) => void | Promise<void>;
  onOpenItem?: (item: NNotifyItemData) => void | Promise<void>;
  /** Runs after a successful standalone mark-read. */
  onMarkedRead?: (item: NNotifyItemData) => void;
  onError?: NNotifyErrorHandler;
  /** Mark an unread item read before opening it. Default `true`. */
  markReadOnOpen?: boolean;
  /** Close the menu after a successful open. Default `true`. */
  closeOnOpen?: boolean;
  locale?: string;
  className?: string;
}

/**
 * One notification row.
 *
 * Opening awaits the read command first: a rejected read never navigates,
 * never closes the menu, and never reports success. Buttons stay flat — no
 * interactive element is nested inside another.
 */
export function NNotifyItem({
  item,
  labels,
  pending = false,
  onMarkRead,
  onOpenItem,
  onMarkedRead,
  onError,
  markReadOnOpen = true,
  closeOnOpen = true,
  locale,
  className,
}: NNotifyItemProps) {
  const close = useNNotifyClose();
  const [busy, setBusy] = React.useState(false);
  const isPending = busy || pending;
  const unread = !item.read;
  const tone = item.tone ?? "default";
  const time = formatNotifyTime(item.createdAt, labels.justNow, locale);

  async function handleOpen() {
    if (isPending) return;
    setBusy(true);
    try {
      if (unread && markReadOnOpen && onMarkRead) {
        try {
          await onMarkRead(item.id);
        } catch (error) {
          onError?.(error, "markRead");
          return;
        }
      }
      try {
        await onOpenItem?.(item);
      } catch (error) {
        onError?.(error, "open");
        return;
      }
      if (closeOnOpen) close?.();
    } finally {
      setBusy(false);
    }
  }

  async function handleMarkRead() {
    if (isPending || !onMarkRead) return;
    setBusy(true);
    try {
      await onMarkRead(item.id);
      onMarkedRead?.(item);
    } catch (error) {
      onError?.(error, "markRead");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card
      className={cn(unread && "border-primary/40", className)}
      data-notify-item-id={item.id}
      data-slot="notify-item"
    >
      <CardContent className="flex items-start gap-3 p-4">
        {renderIcon(item.icon, tone)}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold">{item.title}</p>
            {unread && labels.unreadState ? (
              <NBadge status="pending">{labels.unreadState}</NBadge>
            ) : null}
          </div>
          {item.body ? (
            <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">
              {item.body}
            </p>
          ) : null}
          {time ? (
            <p className="mt-1 text-xs text-muted-foreground">{time}</p>
          ) : null}
          {onOpenItem || (unread && onMarkRead) ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {onOpenItem ? (
                <NButton
                  autoLoading={false}
                  disabled={isPending}
                  onClick={() => void handleOpen()}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  {labels.view}
                </NButton>
              ) : null}
              {unread && onMarkRead ? (
                <NButton
                  autoLoading={false}
                  disabled={isPending}
                  onClick={() => void handleMarkRead()}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  {isPending ? labels.markingRead ?? labels.markRead : labels.markRead}
                </NButton>
              ) : null}
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
NNotifyItem.displayName = "NNotifyItem";
