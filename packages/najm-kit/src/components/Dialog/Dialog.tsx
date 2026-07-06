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

export interface DialogContentProps extends React.ComponentProps<typeof DialogPrimitive.Content> {
  /** Controls the padding of the dialog surface. `none` also collapses the header/body/footer gap. Defaults to `md` (p-6). */
  padding?: DialogPadding;
  /** Hides the built-in top-right close (X). Use when the content provides its own close control (e.g. inside a page header). */
  hideClose?: boolean;
}

function DialogContent({ className, children, padding = "md", hideClose = false, ...props }: DialogContentProps) {
  const portalClassName = useNPortalScope();
  return (
    <DialogPortal data-slot="dialog-portal">
      <div className={portalClassName}>
        <DialogOverlay />
        <DialogPrimitive.Content
          data-slot="dialog-content"
          data-padding={padding}
          className={cn(
            "bg-card text-card-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-50 grid w-full max-w-sm translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg najm-border border-border shadow-lg duration-200",
            dialogPaddingMap[padding],
            className
          )}
          {...props}
        >
          {children}
          {!hideClose && (
            <DialogPrimitive.Close className="ring-offset-background cursor-pointer focus:ring-ring absolute top-4 right-4 rounded-xs text-muted-foreground hover:text-foreground transition-colors focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4">
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
  return <div data-slot="dialog-header" className={cn("flex flex-col gap-2 text-center sm:text-left", className)} {...props} />;
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
};
