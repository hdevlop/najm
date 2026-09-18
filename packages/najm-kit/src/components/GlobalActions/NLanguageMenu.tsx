import * as React from "react";
import { Languages, Loader2 } from "lucide-react";
import { cn } from "../../lib/cn";
import { NButton } from "../Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { globalActionButtonClass } from "../Notify/NNotifyTrigger";

export interface NLanguageOption<T extends string = string> {
  value: T;
  label: string;
  /** Optional injected node — a flag element, an emoji, nothing at all. */
  icon?: React.ReactNode;
  iconLabel?: string;
}

export interface NLanguageMenuProps<T extends string = string> {
  value: T;
  options: readonly NLanguageOption<T>[];
  /** Accessible name of the trigger. */
  label: string;
  pendingLabel?: string;
  pending?: boolean;
  onChange: (value: T) => void | Promise<void>;
  onError?: (error: unknown) => void;
  align?: "start" | "center" | "end";
  className?: string;
  contentClassName?: string;
}

/**
 * Language presentation only. The catalog, the endpoint, the persistence and
 * every secondary effect of switching language stay in the application's own
 * change command, which this awaits.
 */
export function NLanguageMenu<T extends string = string>({
  value,
  options,
  label,
  pendingLabel,
  pending = false,
  onChange,
  onError,
  align = "end",
  className,
  contentClassName,
}: NLanguageMenuProps<T>) {
  const [busy, setBusy] = React.useState(false);
  const isPending = busy || pending;

  async function handleChange(next: T) {
    if (isPending) return;
    setBusy(true);
    try {
      await onChange(next);
    } catch (error) {
      onError?.(error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <NButton
          aria-label={isPending ? pendingLabel ?? label : label}
          className={cn(globalActionButtonClass, className)}
          data-slot="language-menu-trigger"
          disabled={isPending}
          size="icon"
          type="button"
          variant="ghost"
        >
          {isPending ? (
            <Loader2 className="animate-spin" size={18} />
          ) : (
            <Languages size={18} />
          )}
        </NButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className={cn("w-44", contentClassName)}>
        {options.map((option) => (
          <DropdownMenuItem
            className={cn(
              "cursor-pointer",
              option.value === value && "bg-primary text-primary-foreground",
            )}
            data-selected={option.value === value || undefined}
            key={option.value}
            onSelect={() => void handleChange(option.value)}
          >
            {option.icon ? (
              <span aria-hidden="true" className="me-2 inline-flex items-center">
                {option.icon}
              </span>
            ) : null}
            {option.iconLabel ? (
              <span className="sr-only">{option.iconLabel}</span>
            ) : null}
            {option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
NLanguageMenu.displayName = "NLanguageMenu";
