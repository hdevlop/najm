import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "../../lib/cn";
import { NButton } from "../Button";
import { useNajmTheme } from "../../providers/preferences";
import { globalActionButtonClass } from "../Notify/NNotifyTrigger";

export interface NThemeToggleProps {
  label: string;
  pendingLabel?: string;
  pending?: boolean;
  onError?: (error: unknown) => void;
  className?: string;
}

/**
 * Light/dark toggle over the existing `useNajmTheme` contract. Persistence
 * failure is reported through `onError` — the package emits no copy of its
 * own — and the pending state is always released.
 */
export function NThemeToggle({
  label,
  pendingLabel,
  pending = false,
  onError,
  className,
}: NThemeToggleProps) {
  const { theme, setTheme } = useNajmTheme();
  const [busy, setBusy] = React.useState(false);
  const isPending = busy || pending;
  const isDark = theme === "dark";
  const ThemeIcon = isDark ? Sun : Moon;

  async function handleToggle() {
    if (isPending) return;
    setBusy(true);
    try {
      await setTheme(isDark ? "light" : "dark");
    } catch (error) {
      onError?.(error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <NButton
      aria-label={isPending ? pendingLabel ?? label : label}
      autoLoading={false}
      className={cn(globalActionButtonClass, className)}
      data-slot="theme-toggle"
      disabled={isPending}
      onClick={() => void handleToggle()}
      size="icon"
      type="button"
      variant="ghost"
    >
      <ThemeIcon size={18} />
    </NButton>
  );
}
NThemeToggle.displayName = "NThemeToggle";
