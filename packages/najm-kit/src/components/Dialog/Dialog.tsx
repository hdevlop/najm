import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { XIcon } from "lucide-react";
import { cn } from "../../lib/cn";
import { useNPortalScope } from "./NSheet";
import { NajmThemeContainerCtx } from "../../theme/provider";

function Dialog({ ...props }: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

function DialogTrigger({ ...props }: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogPortal({ ...props }: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  const container = React.useContext(NajmThemeContainerCtx);
  return <DialogPrimitive.Portal data-slot="dialog-portal" container={container ?? undefined} {...props} />;
}

function DialogClose({ ...props }: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close cursor-pointer" {...props} />;
}

function DialogOverlay({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50 backdrop-blur-sm",
        className
      )}
      {...props}
    />
  );
}

export type DialogPadding = "none" | "sm" | "md" | "lg";

const dialogPaddingMap: Record<DialogPadding, string> = {
  none: "p-0 gap-0 overflow-hidden",
  sm: "p-3",
  md: "p-6",
  lg: "p-8",
};

const MOBILE_PADDING_QUERY = "(max-width: 639.98px)";

function getDefaultPadding(): DialogPadding {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return "md";
  return window.matchMedia(MOBILE_PADDING_QUERY).matches ? "sm" : "md";
}

function useResponsivePadding(value: DialogPadding | undefined): DialogPadding {
  const [resolved, setResolved] = React.useState<DialogPadding>(() => value ?? getDefaultPadding());
  React.useEffect(() => {
    if (value) {
      setResolved(value);
      return;
    }
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mql = window.matchMedia(MOBILE_PADDING_QUERY);
    const update = () => setResolved(mql.matches ? "sm" : "md");
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, [value]);
  return resolved;
}

export interface DialogContentProps extends React.ComponentProps<typeof DialogPrimitive.Content> {
  /** Controls the padding of the dialog surface. `none` also collapses the header/body/footer gap. Defaults to `sm` on mobile, `md` on desktop. */
  padding?: DialogPadding;
  /** Hides the built-in close (X) in the top inline-end corner. Use when the content provides its own close control (e.g. inside a page header). */
  hideClose?: boolean;
}

function DialogContent({
  className,
  children,
  padding,
  hideClose = false,
  onOpenAutoFocus,
  onCloseAutoFocus,
  ...props
}: DialogContentProps) {
  const resolvedPadding = useResponsivePadding(padding);
  const portalClassName = useNPortalScope();

  // The control that opened this dialog, so focus can be put back on it.
  //
  // Read in `onOpenAutoFocus`, which the primitive fires immediately before it
  // moves focus inside — the last moment the opener still holds it. Reading it
  // during render instead looks equivalent and is not: the render that mounts
  // the content can happen after a pointer interaction has already dropped
  // focus to <body>, and the captured "opener" is then the document itself.
  const openerRef = React.useRef<HTMLElement | null>(null);

  return (
    <DialogPortal data-slot="dialog-portal">
      <div className={portalClassName}>
        <DialogOverlay />
        <DialogPrimitive.Content
          data-slot="dialog-content"
          data-padding={resolvedPadding}
          // A repair, not a replacement. The primitive restores focus to the
          // opener on close, but it does so while the rest of the page is still
          // inside the subtree it made inert — and `focus()` on an inert
          // element is a no-op, so focus silently stayed on <body>. A keyboard
          // user who pressed Escape landed back at the top of the document.
          //
          // Deferred past that teardown, and only when focus was actually lost:
          // a dialog that deliberately sends focus somewhere else on close still
          // wins, because this does nothing unless <body> ended up holding it.
          onOpenAutoFocus={(event) => {
            const active = document.activeElement;
            openerRef.current =
              active instanceof HTMLElement && active !== document.body ? active : null;
            onOpenAutoFocus?.(event);
          }}
          onCloseAutoFocus={(event) => {
            onCloseAutoFocus?.(event);
            if (event.defaultPrevented) return;
            const opener = openerRef.current;
            setTimeout(() => {
              if (!opener?.isConnected) return;
              const active = document.activeElement;
              // "Focus was lost" in all the shapes it actually takes: nothing
              // focused, the document defaults, or an element that has since
              // been removed. Anything else is a deliberate destination and is
              // left alone.
              const lost =
                !active
                || active === document.body
                || active === document.documentElement
                || !active.isConnected;
              if (lost) opener.focus();
            }, 0);
          }}
          className={cn(
            "bg-card text-card-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-50 grid w-full max-w-sm translate-x-[-50%] translate-y-[-50%] gap-4 rounded-none lg:rounded-lg najm-border border-border shadow-lg duration-200",
            dialogPaddingMap[resolvedPadding],
            className
          )}
          {...props}
        >
          {children}
          {!hideClose && (
            <DialogPrimitive.Close className="ring-offset-background cursor-pointer focus:ring-ring absolute top-4 end-4 rounded-xs text-muted-foreground hover:text-foreground transition-colors focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4">
              <XIcon />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          )}
        </DialogPrimitive.Content>
      </div>
    </DialogPortal>
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="dialog-header" className={cn("flex flex-col gap-2 text-center sm:text-start", className)} {...props} />;
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="dialog-footer" className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)} {...props} />;
}

function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title data-slot="dialog-title" className={cn("text-lg leading-none font-semibold", className)} {...props} />;
}

function DialogDescription({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return <DialogPrimitive.Description data-slot="dialog-description" className={cn("text-muted-foreground text-sm", className)} {...props} />;
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
  useResponsivePadding,
};
