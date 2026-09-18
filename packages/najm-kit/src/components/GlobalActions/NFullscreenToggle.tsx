import * as React from "react";
import { Maximize, Minimize } from "lucide-react";
import screenfull from "screenfull";
import { cn } from "../../lib/cn";
import { NButton } from "../Button";
import { globalActionButtonClass } from "../Notify/NNotifyTrigger";

export interface NFullscreenToggleProps {
  label: string;
  exitLabel?: string;
  /** Hidden below this breakpoint. `null` keeps it visible everywhere. */
  hiddenBelow?: "sm" | "md" | "lg" | null;
  onError?: (error: unknown) => void;
  className?: string;
}

const HIDDEN_BELOW: Record<"sm" | "md" | "lg", string> = {
  sm: "hidden sm:inline-flex",
  md: "hidden md:inline-flex",
  lg: "hidden lg:inline-flex",
};

/**
 * Fullscreen toggle.
 *
 * `screenfull` reports `isEnabled: false` rather than throwing where the API
 * is missing, and touches no browser global at import time, so this is safe to
 * render during SSR and hydration. An unsupported environment renders a
 * disabled control instead of a button that does nothing.
 */
export function NFullscreenToggle({
  label,
  exitLabel,
  hiddenBelow = "sm",
  onError,
  className,
}: NFullscreenToggleProps) {
  const [active, setActive] = React.useState(false);
  // Starts enabled so the server and first client render agree; an
  // unsupported environment disables it after mount instead of flashing.
  const [unsupported, setUnsupported] = React.useState(false);

  React.useEffect(() => {
    if (!screenfull.isEnabled) {
      setUnsupported(true);
      return;
    }
    setActive(screenfull.isFullscreen);
    const onChange = () => setActive(screenfull.isFullscreen);
    screenfull.on("change", onChange);
    return () => screenfull.off("change", onChange);
  }, []);

  async function handleToggle() {
    if (!screenfull.isEnabled) return;
    try {
      await screenfull.toggle();
    } catch (error) {
      onError?.(error);
    }
  }

  const Icon = active ? Minimize : Maximize;
  const accessibleLabel = active ? exitLabel ?? label : label;

  return (
    <NButton
      aria-label={accessibleLabel}
      autoLoading={false}
      className={cn(
        hiddenBelow ? HIDDEN_BELOW[hiddenBelow] : undefined,
        globalActionButtonClass,
        className,
      )}
      data-slot="fullscreen-toggle"
      disabled={unsupported}
      onClick={() => void handleToggle()}
      size="icon"
      type="button"
      variant="ghost"
    >
      <Icon size={18} />
    </NButton>
  );
}
NFullscreenToggle.displayName = "NFullscreenToggle";
