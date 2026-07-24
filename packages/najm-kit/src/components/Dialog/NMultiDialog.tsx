import React from "react";
import { X } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  useResponsivePadding,
  type DialogPadding,
} from "./Dialog";
import { Button } from "../Button";
import { IconButton } from "../ui/icon-button";
import { NajmScroll } from "../ui/scroll";
import { NPageHeader, type NPageHeaderProps } from "../layout/NPageHeader";
import { cn } from "../../lib/cn";
import { cva } from "class-variance-authority";
import type { DialogStore } from "./store";
import { useDialogStore } from "./store";
import type { ButtonConfig, DialogActionMode, DialogConfig, DialogVariant, PushDialogOptions } from "./types";

export interface NDialogHeaderProps {
  label?: string;
  children?: string;
  className?: string;
  titleClassName?: string;
}

export interface NDialogDescriptionProps {
  label?: string;
  children?: string;
  className?: string;
}

export interface NDialogActionProps extends Omit<Partial<ButtonConfig>, "text"> {
  label?: string;
  children?: string;
}

/** Declarative title slot for direct NDialog usage. Rendered by NDialog, not by itself. */
export function NDialogHeader(_props: NDialogHeaderProps) {
  return null;
}

/** Declarative description slot for direct NDialog usage. Rendered by NDialog, not by itself. */
export function NDialogDescription(_props: NDialogDescriptionProps) {
  return null;
}

/** Declarative primary-action slot for direct NDialog usage. */
export function NDialogPrimaryButton(_props: NDialogActionProps) {
  return null;
}

/** Declarative secondary-action slot for direct NDialog usage. */
export function NDialogSecondaryButton(_props: NDialogActionProps) {
  return null;
}

interface ParsedDirectDialogSlots {
  body: React.ReactNode;
  header?: NDialogHeaderProps;
  description?: NDialogDescriptionProps;
  primaryButton?: Partial<ButtonConfig>;
  secondaryButton?: Partial<ButtonConfig>;
}

function parseDirectDialogSlots(children: React.ReactNode): ParsedDirectDialogSlots {
  const body: React.ReactNode[] = [];
  const parsed: Omit<ParsedDirectDialogSlots, "body"> = {};

  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) {
      body.push(child);
      return;
    }

    if (child.type === NDialogHeader) {
      parsed.header = child.props as NDialogHeaderProps;
      return;
    }
    if (child.type === NDialogDescription) {
      parsed.description = child.props as NDialogDescriptionProps;
      return;
    }
    if (child.type === NDialogPrimaryButton || child.type === NDialogSecondaryButton) {
      const { children: text, label, ...config } = child.props as NDialogActionProps;
      const button = { ...config, text: label ?? text ?? (child.type === NDialogPrimaryButton ? "Confirm" : "Cancel") };
      if (child.type === NDialogPrimaryButton) parsed.primaryButton = button;
      else parsed.secondaryButton = button;
      return;
    }

    body.push(child);
  });

  return { ...parsed, body };
}

export const dialogVariants = cva(
  "flex flex-col w-full max-w-full h-full max-h-screen",
  {
    variants: {
      variant: {
        default: "",
        window: "rounded-none lg:rounded-sm",
      },
      size: {
        sm: "lg:max-w-md",
        md: "lg:max-w-lg",
        lg: "lg:max-w-xl",
        xl: "lg:max-w-2xl",
        xxl: "lg:max-w-3xl",
        full: "lg:max-w-4xl",
      },
      width: {
        sm: "lg:max-w-sm",
        md: "lg:max-w-md",
        lg: "lg:max-w-lg",
        xl: "lg:max-w-xl",
        xxl: "lg:max-w-2xl",
        "3xl": "lg:max-w-3xl",
        "4xl": "lg:max-w-4xl",
        "5xl": "lg:max-w-5xl",
        "6xl": "lg:max-w-6xl",
        "7xl": "lg:max-w-7xl",
        full: "lg:max-w-5/6",
        auto: "lg:w-auto",
      },
      height: {
        auto: "lg:h-auto lg:max-h-[95vh]",
        sm: "lg:h-[40vh]",
        md: "lg:h-[60vh]",
        lg: "lg:h-[70vh]",
        xl: "lg:h-[80vh]",
        xxl: "lg:h-[95vh]",
        full: "lg:h-[95vh]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "xl",
      width: "3xl",
      height: "auto",
    },
  }
);

const CONTENT_ACTIONS_SELECTOR = '[data-najm-dialog-actions="content"], [data-najm-wizard-form="true"]';

function useContentOwnsActions() {
  const [contentElement, setContentElement] = React.useState<HTMLElement | null>(null);
  const [contentOwnsActions, setContentOwnsActions] = React.useState(false);
  const contentElementRef = React.useRef<HTMLElement | null>(null);
  const handleContentElementRef = React.useCallback((node: HTMLElement | null) => {
    if (contentElementRef.current === node) return;
    contentElementRef.current = node;
    setContentElement(node);
  }, []);

  React.useLayoutEffect(() => {
    if (!contentElement) {
      setContentOwnsActions((current) => (current ? false : current));
      return;
    }

    const update = () => {
      const next = !!contentElement.querySelector(CONTENT_ACTIONS_SELECTOR);
      setContentOwnsActions((current) => (current === next ? current : next));
    };

    update();

    const observer = new MutationObserver(update);
    observer.observe(contentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-najm-dialog-actions", "data-najm-wizard-form"],
    });

    return () => observer.disconnect();
  }, [contentElement]);

  return { contentOwnsActions, setContentElement: handleContentElementRef };
}

function shouldRenderDialogButtons(showButtons: boolean, actionMode: DialogActionMode = "auto", contentOwnsActions: boolean) {
  if (!showButtons || actionMode === "content") return false;
  if (actionMode === "auto" && contentOwnsActions) return false;
  return true;
}

interface DialogChromeProps {
  pageHeader?: NPageHeaderProps;
  title?: string;
  description?: string;
  padding?: DialogPadding;
  variant?: DialogVariant;
  headerClassName?: string;
  titleClassName?: string;
  descriptionClassName?: string;
  closeButtonClassName?: string;
  contentRef: (node: HTMLElement | null) => void;
  children: React.ReactNode;
}

/**
 * Shared header + scrollable body for both the imperative (store) and direct
 * dialog renderers. When `pageHeader` is provided it renders an NPageHeader as
 * the dialog header (with a visually-hidden DialogTitle for accessibility);
 * otherwise it falls back to the plain title/description header.
 */
const windowHeaderSpacing: Record<DialogPadding, string> = {
  none: "px-3 py-2",
  sm: "-mx-3 -mt-3 px-3 py-2",
  md: "-mx-6 -mt-6 px-3 py-2",
  lg: "-mx-8 -mt-8 px-3 py-2",
};

function DialogChrome({
  pageHeader,
  title,
  description,
  padding,
  variant = "default",
  headerClassName,
  titleClassName,
  descriptionClassName,
  closeButtonClassName,
  contentRef,
  children,
}: DialogChromeProps) {
  const resolvedPadding = useResponsivePadding(padding);
  const noTitle = !title || title.trim() === "";
  const noDescription = !description || description.trim() === "";
  const noHeader = noTitle && noDescription;
  const flush = resolvedPadding === "none";

  return (
    <>
      {pageHeader ? (
        <>
          <DialogTitle className={cn("sr-only", titleClassName)}>{pageHeader.title || title || "Dialog"}</DialogTitle>
          {(pageHeader.subtitle || description) && (
            <DialogDescription className={cn("sr-only", descriptionClassName)}>{pageHeader.subtitle || description}</DialogDescription>
          )}
          <div className={cn("shrink-0", headerClassName)}>
            {/* Force a flush, edge-to-edge header (no card rounding). The dialog's default
                close (X) is hidden (see hideClose) and replaced by a close icon button that
                sits inline with the header actions. */}
            <NPageHeader
              {...pageHeader}
              card={false}
              actions={
                <>
                  {pageHeader.actions}
                  <DialogClose asChild>
                    <IconButton aria-label="Close" variant="ghost" className={closeButtonClassName}>
                      <X className="h-4 w-4" />
                    </IconButton>
                  </DialogClose>
                </>
              }
            />
          </div>
        </>
      ) : variant === "window" ? (
        <DialogHeader
          className={cn(
            "flex-row items-center justify-between gap-3 border-b border-border bg-secondary text-left text-secondary-foreground",
            windowHeaderSpacing[resolvedPadding],
            headerClassName
          )}
        >
          <div className="min-w-0 space-y-1">
            <DialogTitle className={cn("truncate text-sm", noTitle && "sr-only", titleClassName)}>{title || "Dialog"}</DialogTitle>
            <DialogDescription className={cn("text-xs", noDescription && "sr-only", descriptionClassName)}>{description}</DialogDescription>
          </div>
          <DialogClose asChild>
            <IconButton
              aria-label="Close"
              variant="ghost"
              size="sm"
              className={cn("border border-border bg-background text-foreground hover:bg-accent", closeButtonClassName)}
            >
              <X className="h-3.5 w-3.5" />
            </IconButton>
          </DialogClose>
        </DialogHeader>
      ) : (
        <DialogHeader className={cn(noHeader && "sr-only", headerClassName)}>
          <DialogTitle className={cn(noTitle && "sr-only", titleClassName)}>{title}</DialogTitle>
          <DialogDescription className={cn(noDescription && "sr-only", descriptionClassName)}>{description}</DialogDescription>
        </DialogHeader>
      )}

      {flush ? (
        // Full-bleed content owns its own layout/scrolling; no outer scroll wrapper.
        <div ref={contentRef} className="flex min-h-0 flex-1 flex-col">
          {children}
        </div>
      ) : (
        <NajmScroll axis="y" className="flex-1 px-1 -mx-1">
          <div ref={contentRef} style={{ display: "contents" }}>
            {children}
          </div>
        </NajmScroll>
      )}
    </>
  );
}

interface DialogItemProps {
  dialog: DialogConfig;
  index: number;
  store: DialogStore;
}

function DialogItem({ dialog, index, store }: DialogItemProps) {
  if (dialog.render) {
    return (
      <>
        {dialog.render({
          dialog,
          index,
          zIndex: 9990 + index,
          close: (result) => store.getState().closeDialog(dialog.id, result),
          confirm: (data) => store.getState().handlePrimaryClick(dialog.id, data),
          cancel: (data) => store.getState().handleSecondaryClick(dialog.id, data),
          onOpenChange: (open) => store.getState().handleOpenChange(dialog.id, open),
        })}
      </>
    );
  }

  const {
    id,
    title,
    description,
    pageHeader,
    padding,
    children,
    primaryButton,
    secondaryButton,
    showButtons,
    size,
    width,
    height,
    className,
    headerClassName,
    titleClassName,
    descriptionClassName,
    closeButtonClassName,
    variant = "default",
    actionMode = "auto",
  } = dialog;
  const { contentOwnsActions, setContentElement } = useContentOwnsActions();
  const renderDialogButtons = shouldRenderDialogButtons(showButtons, actionMode, contentOwnsActions);

  const handlePrimary = async (e?: React.FormEvent) => {
    const hasForm = !!primaryButton?.form;
    if (!hasForm && e) e.preventDefault();
    await store.getState().handlePrimaryClick(id);
  };

  const handleSecondary = async (e?: React.FormEvent) => {
    const hasForm = !!secondaryButton?.form;
    if (!hasForm && e) e.preventDefault();
    await store.getState().handleSecondaryClick(id);
  };

  return (
    <Dialog key={id} open={true} onOpenChange={(open) => store.getState().handleOpenChange(id, open)}>
      <DialogContent
        data-dialog-id={id}
        data-variant={variant}
        padding={padding}
        hideClose={!!pageHeader || variant === "window"}
        className={cn(dialogVariants({ variant, size, width, height }), className)}
        style={{ zIndex: 9990 + index }}
      >
        <DialogChrome
          pageHeader={pageHeader}
          title={title}
          description={description}
          padding={padding}
          variant={variant}
          headerClassName={headerClassName}
          titleClassName={titleClassName}
          descriptionClassName={descriptionClassName}
          closeButtonClassName={closeButtonClassName}
          contentRef={setContentElement}
        >
          {children}
        </DialogChrome>

        <DialogFooter className={cn(!renderDialogButtons && "sr-only")}>
          {renderDialogButtons && secondaryButton && (
            <Button
              type={secondaryButton.form ? "submit" : "button"}
              data-button-type="secondary"
              onClick={secondaryButton.form ? undefined : handleSecondary}
              disabled={secondaryButton.disabled || secondaryButton.loading || false}
              variant={secondaryButton.variant || "outline"}
              leftIcon={secondaryButton.icon}
              loading={secondaryButton.loading}
              loadingText={secondaryButton.loadingText}
              form={secondaryButton.form}
              className={cn("w-auto", secondaryButton.className)}
            >
              {secondaryButton.text}
            </Button>
          )}
          {renderDialogButtons && primaryButton && (
            <Button
              type={primaryButton.form ? "submit" : "button"}
              data-button-type="primary"
              onClick={primaryButton.form ? undefined : handlePrimary}
              disabled={primaryButton.disabled || primaryButton.loading || false}
              variant={primaryButton.variant || "default"}
              leftIcon={primaryButton.icon}
              loading={primaryButton.loading}
              loadingText={primaryButton.loadingText}
              form={primaryButton.form}
              className={cn("w-auto", primaryButton.className)}
            >
              {primaryButton.text}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export interface NMultiDialogProps {
  store?: DialogStore;
}

export function NMultiDialog({ store: storeProp }: NMultiDialogProps) {
  const defaultStore = useDialogStore();
  const store = storeProp ?? defaultStore;
  const dialogs = store((s) => s.dialogs);

  return (
    <>
      {dialogs.map((dialog, index) => (
        <DialogItem key={dialog.id} dialog={dialog} index={index} store={store} />
      ))}
    </>
  );
}

export interface NDialogDirectProps extends Omit<PushDialogOptions, "render"> {
  trigger?: React.ReactElement;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  closeOnPrimary?: boolean;
  closeOnSecondary?: boolean;
}

export type NDialogProps = NMultiDialogProps | NDialogDirectProps;

const buildButtonConfig = (partial: Partial<ButtonConfig> | undefined, defaults: ButtonConfig): ButtonConfig => {
  return { ...defaults, ...partial };
};

const isDirectDialogProps = (props: NDialogProps): props is NDialogDirectProps => {
  return (
    "trigger" in props ||
    "open" in props ||
    "defaultOpen" in props ||
    "onOpenChange" in props ||
    "title" in props ||
    "description" in props ||
    "children" in props ||
    "primaryButton" in props ||
    "secondaryButton" in props ||
    "showButtons" in props ||
    "size" in props ||
    "width" in props ||
    "height" in props ||
    "className" in props ||
    "headerClassName" in props ||
    "titleClassName" in props ||
    "descriptionClassName" in props ||
    "closeButtonClassName" in props ||
    "variant" in props ||
    "pageHeader" in props ||
    "padding" in props
  );
};

function NDirectDialog({
  trigger,
  open,
  defaultOpen = false,
  onOpenChange,
  title,
  description,
  pageHeader,
  padding,
  children,
  primaryButton,
  secondaryButton,
  showButtons = true,
  size,
  width,
  height,
  className,
  headerClassName,
  titleClassName,
  descriptionClassName,
  closeButtonClassName,
  variant = "default",
  actionMode = "auto",
  closeOnPrimary = true,
  closeOnSecondary = true,
}: NDialogDirectProps) {
  const slots = parseDirectDialogSlots(children);
  const resolvedTitle = title ?? slots.header?.label ?? slots.header?.children;
  const resolvedDescription = description ?? slots.description?.label ?? slots.description?.children;
  const resolvedHeaderClassName = cn(slots.header?.className, headerClassName);
  const resolvedTitleClassName = cn(slots.header?.titleClassName, titleClassName);
  const resolvedDescriptionClassName = cn(slots.description?.className, descriptionClassName);
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen);
  const [primaryLoading, setPrimaryLoading] = React.useState(false);
  const isControlled = open !== undefined;
  const currentOpen = isControlled ? open : internalOpen;

  const setOpen = (nextOpen: boolean) => {
    if (!isControlled) {
      setInternalOpen(nextOpen);
    }
    onOpenChange?.(nextOpen);
  };

  const resolvedPrimaryButton = buildButtonConfig(primaryButton ?? slots.primaryButton, {
    text: "Confirm",
    variant: "default",
    loading: false,
    disabled: false,
    loadingText: "Processing...",
  });

  const resolvedSecondaryButton = buildButtonConfig(secondaryButton ?? slots.secondaryButton, {
    text: "Cancel",
    variant: "outline",
    loading: false,
    disabled: false,
    loadingText: "Processing...",
  });

  const isPrimaryLoading = primaryLoading || !!resolvedPrimaryButton.loading;
  const { contentOwnsActions, setContentElement } = useContentOwnsActions();
  const renderDialogButtons = shouldRenderDialogButtons(showButtons, actionMode, contentOwnsActions);

  const handlePrimary = async (e?: React.FormEvent) => {
    const hasForm = !!resolvedPrimaryButton.form;
    if (!hasForm && e) e.preventDefault();

    if (resolvedPrimaryButton.onClick) {
      setPrimaryLoading(true);
      try {
        await resolvedPrimaryButton.onClick();
      } finally {
        setPrimaryLoading(false);
      }
    }

    if (closeOnPrimary) {
      setOpen(false);
    }
  };

  const handleSecondary = async (e?: React.FormEvent) => {
    const hasForm = !!resolvedSecondaryButton.form;
    if (!hasForm && e) e.preventDefault();

    if (resolvedSecondaryButton.onClick) {
      await resolvedSecondaryButton.onClick();
    }

    if (closeOnSecondary) {
      setOpen(false);
    }
  };

  return (
    <Dialog open={currentOpen} onOpenChange={setOpen}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent
        data-variant={variant}
        padding={padding}
        hideClose={!!pageHeader || variant === "window"}
        className={cn(dialogVariants({ variant, size, width, height }), className)}
      >
        <DialogChrome
          pageHeader={pageHeader}
          title={resolvedTitle}
          description={resolvedDescription}
          padding={padding}
          variant={variant}
          headerClassName={resolvedHeaderClassName}
          titleClassName={resolvedTitleClassName}
          descriptionClassName={resolvedDescriptionClassName}
          closeButtonClassName={closeButtonClassName}
          contentRef={setContentElement}
        >
          {slots.body}
        </DialogChrome>

        <DialogFooter className={cn(!renderDialogButtons && "sr-only")}>
          {renderDialogButtons && (
            <>
              <Button
                type={resolvedSecondaryButton.form ? "submit" : "button"}
                data-button-type="secondary"
                onClick={resolvedSecondaryButton.form ? undefined : handleSecondary}
                disabled={resolvedSecondaryButton.disabled || resolvedSecondaryButton.loading || false}
                variant={resolvedSecondaryButton.variant || "outline"}
                leftIcon={resolvedSecondaryButton.icon}
                loading={resolvedSecondaryButton.loading}
                loadingText={resolvedSecondaryButton.loadingText}
                form={resolvedSecondaryButton.form}
                className={cn("w-auto", resolvedSecondaryButton.className)}
              >
                {resolvedSecondaryButton.text}
              </Button>
              <Button
                type={resolvedPrimaryButton.form ? "submit" : "button"}
                data-button-type="primary"
                onClick={resolvedPrimaryButton.form ? undefined : handlePrimary}
                disabled={resolvedPrimaryButton.disabled || isPrimaryLoading || false}
                variant={resolvedPrimaryButton.variant || "default"}
                leftIcon={resolvedPrimaryButton.icon}
                loading={isPrimaryLoading}
                loadingText={resolvedPrimaryButton.loadingText}
                form={resolvedPrimaryButton.form}
                className={cn("w-auto", resolvedPrimaryButton.className)}
              >
                {resolvedPrimaryButton.text}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function NDialog(props: NDialogProps) {
  if (isDirectDialogProps(props)) {
    return <NDirectDialog {...props} />;
  }

  return <NMultiDialog {...props} />;
}
