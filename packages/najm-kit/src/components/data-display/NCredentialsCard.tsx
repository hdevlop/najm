import * as React from "react";
import { Check, Copy, X } from "lucide-react";
import { cn } from "../../lib/cn";
import { NIcon, type NIconSource } from "../Icon";
import { Button } from "../Button";

export interface NCredentialField {
  label: string;
  value: string;
  icon?: NIconSource;
  mono?: boolean;
  breakAll?: boolean;
}

export interface NCredentialsCardClassNames {
  root?: string;
  header?: string;
  list?: string;
  field?: string;
  actions?: string;
}

export interface NCredentialsCardProps {
  fields: NCredentialField[];
  title?: string;
  description?: string;
  icon?: NIconSource;
  copyLabel?: string;
  copiedLabel?: string;
  copyErrorLabel?: string;
  copyText?: (fields: NCredentialField[]) => string;
  hideCopyAction?: boolean;
  onCopy?: () => void;
  onCopyError?: (error: unknown) => void;
  actions?: React.ReactNode;
  className?: string;
  classNames?: NCredentialsCardClassNames;
}

const DEFAULT_COPY_LABEL = "Copy details";
const DEFAULT_COPIED_LABEL = "Copied";
const DEFAULT_COPY_ERROR_LABEL = "Copy failed";
const DEFAULT_HEADER_ICON: NIconSource = "circle-check";

type CopyStatus = "idle" | "pending" | "success" | "error";

const REVERT_MS = 2000;

function defaultCopyText(fields: NCredentialField[]): string {
  return fields.map((f) => `${f.label}: ${f.value}`).join("\n");
}

function resolveClipboard(): {
  writeText: (text: string) => Promise<void>;
} | null {
  if (typeof navigator === "undefined") return null;
  const clipboard = navigator.clipboard;
  if (!clipboard || typeof clipboard.writeText !== "function") return null;
  return { writeText: clipboard.writeText.bind(clipboard) };
}

export function NCredentialsCard({
  fields,
  title,
  description,
  icon,
  copyLabel = DEFAULT_COPY_LABEL,
  copiedLabel = DEFAULT_COPIED_LABEL,
  copyErrorLabel = DEFAULT_COPY_ERROR_LABEL,
  copyText,
  hideCopyAction = false,
  onCopy,
  onCopyError,
  actions,
  className,
  classNames,
}: NCredentialsCardProps) {
  const [status, setStatus] = React.useState<CopyStatus>("idle");
  const revertTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = React.useRef(true);
  const requestTokenRef = React.useRef(0);

  React.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (revertTimer.current) clearTimeout(revertTimer.current);
      revertTimer.current = null;
    };
  }, []);

  const scheduleRevert = React.useCallback(() => {
    if (revertTimer.current) clearTimeout(revertTimer.current);
    revertTimer.current = setTimeout(() => {
      revertTimer.current = null;
      if (mountedRef.current) setStatus("idle");
    }, REVERT_MS);
  }, []);

  const handleCopy = React.useCallback(() => {
    if (status === "pending") return;

    if (revertTimer.current) {
      clearTimeout(revertTimer.current);
      revertTimer.current = null;
    }

    const token = ++requestTokenRef.current;
    const isStale = () =>
      !mountedRef.current || token !== requestTokenRef.current;

    let text: string;
    try {
      text = (copyText ?? defaultCopyText)(fields);
    } catch (error) {
      if (isStale()) return;
      setStatus("error");
      onCopyError?.(error);
      scheduleRevert();
      return;
    }

    const clipboard = resolveClipboard();
    if (!clipboard) {
      if (isStale()) return;
      setStatus("error");
      onCopyError?.(new Error("Clipboard is not available in this context."));
      scheduleRevert();
      return;
    }

    setStatus("pending");

    let promise: Promise<void>;
    try {
      promise = clipboard.writeText(text);
    } catch (error) {
      if (isStale()) return;
      setStatus("error");
      onCopyError?.(error);
      scheduleRevert();
      return;
    }

    promise.then(
      () => {
        if (isStale()) return;
        setStatus("success");
        onCopy?.();
        scheduleRevert();
      },
      (error: unknown) => {
        if (isStale()) return;
        setStatus("error");
        onCopyError?.(error);
        scheduleRevert();
      },
    );
  }, [copyText, fields, onCopy, onCopyError, scheduleRevert, status]);

  const showHeader = Boolean(title || description);
  const showFields = fields.length > 0;
  const showActions = !hideCopyAction || Boolean(actions);

  const buttonLabel =
    status === "success" ? copiedLabel : status === "error" ? copyErrorLabel : copyLabel;
  const headerIcon: NIconSource = icon ?? DEFAULT_HEADER_ICON;

  return (
    <div
      className={cn(
        "flex flex-col rounded-lg border bg-card p-5 shadow-sm",
        classNames?.root,
        className,
      )}
      data-testid="credentials-card"
    >
      {showHeader && (
        <div className={cn("flex items-start gap-3 mb-4", classNames?.header)}>
          <div
            className="flex items-center justify-center w-10 h-10 rounded-full bg-muted shrink-0"
            data-testid="credentials-card-header-icon"
          >
            <NIcon
              aria-hidden="true"
              icon={headerIcon}
              className="w-5 h-5 text-muted-foreground"
            />
          </div>
          <div className="min-w-0">
            {title && <h3 className="text-lg font-semibold text-foreground">{title}</h3>}
            {description && (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}
          </div>
        </div>
      )}

      {showFields && (
        <dl className={cn("space-y-3", classNames?.list)} data-testid="credentials-card-list">
          {fields.map((field, index) => {
            const useMono = field.mono ?? true;
            const breakAll = field.breakAll ?? true;
            return (
              <div
                key={`${field.label}-${index}`}
                className={cn(
                  "flex items-center gap-3 rounded-xl bg-background px-4 py-3",
                  classNames?.field,
                )}
                data-testid="credentials-card-field"
              >
                {field.icon && (
                  <NIcon
                    aria-hidden="true"
                    icon={field.icon}
                    className="w-4 h-4 text-muted-foreground shrink-0"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <dt className="text-xs text-muted-foreground">{field.label}</dt>
                  <dd
                    // `dir="auto"` isolates the value from the surrounding
                    // paragraph direction and resolves its own from the first
                    // strong character. Under an inherited `rtl`, the weak
                    // characters in a credential get reordered: `+1 555 0100`
                    // paints as `0100 555 1+`, `p@ssw0rd!` as `!p@ssw0rd`. The
                    // copied text is unaffected, but an operator reading the
                    // value aloud — the entire purpose of this surface — reads
                    // it wrong. A genuinely Arabic value still resolves to RTL,
                    // because that is what its first strong character says.
                    dir="auto"
                    className={cn(
                      "text-sm text-foreground font-semibold",
                      useMono && "font-mono",
                      breakAll && "break-all",
                    )}
                  >
                    {field.value}
                  </dd>
                </div>
              </div>
            );
          })}
        </dl>
      )}

      {showActions && (
        <div
          className={cn(
            "mt-5 flex justify-end gap-3 flex-wrap",
            classNames?.actions,
          )}
          data-testid="credentials-card-actions"
        >
          {!hideCopyAction && (
            <Button
              type="button"
              variant="outline"
              leftIcon={status === "success" ? Check : status === "error" ? X : Copy}
              onClick={handleCopy}
              loading={status === "pending"}
              disabledWhileLoading
              data-testid="credentials-card-copy"
            >
              {buttonLabel}
            </Button>
          )}
          {actions}
        </div>
      )}

      <span
        aria-live="polite"
        role="status"
        className="sr-only"
        data-testid="credentials-card-status"
      >
        {status === "success" ? copiedLabel : status === "error" ? copyErrorLabel : ""}
      </span>
    </div>
  );
}

NCredentialsCard.displayName = "NCredentialsCard";
