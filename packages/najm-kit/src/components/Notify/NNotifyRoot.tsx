import * as React from "react";
import { Popover } from "../ui/popover";
import { NNotifyProvider } from "./NNotifyContext";

export interface NNotifyRootProps {
  children: React.ReactNode;
  /** Controlled open state. When passed, no competing internal state is kept. */
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  modal?: boolean;
}

export function NNotifyRoot({
  children,
  open,
  defaultOpen = false,
  onOpenChange,
  modal,
}: NNotifyRootProps) {
  const controlled = open !== undefined;
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);
  const isOpen = controlled ? open : uncontrolledOpen;

  const setOpen = React.useCallback(
    (next: boolean) => {
      if (!controlled) setUncontrolledOpen(next);
      onOpenChange?.(next);
    },
    [controlled, onOpenChange],
  );

  const close = React.useCallback(() => setOpen(false), [setOpen]);

  const value = React.useMemo(
    () => ({ open: isOpen, setOpen, close }),
    [isOpen, setOpen, close],
  );

  return (
    <NNotifyProvider value={value}>
      <Popover open={isOpen} onOpenChange={setOpen} modal={modal}>
        {children}
      </Popover>
    </NNotifyProvider>
  );
}
NNotifyRoot.displayName = "NNotifyRoot";
