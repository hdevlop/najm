import React, { useMemo, useRef } from "react";
import { cn } from "../../lib/cn";
import type { OtpInputProps } from "./types";

function normalizeCode(value: string, numeric: boolean, length: number) {
  const normalized = numeric ? value.replace(/\D/g, "") : value.replace(/\s/g, "");
  return normalized.slice(0, length);
}

/** Accessible, controlled one-time-code input with keyboard and paste support. */
export const OtpInput = React.forwardRef<HTMLInputElement, OtpInputProps>(
  (
    {
      value,
      onChange,
      length = 6,
      numeric = true,
      ariaLabel = "One-time code",
      digitAriaLabel,
      autoFocus = false,
      autoComplete = "one-time-code",
      disabled = false,
      readOnly = false,
      status = "default",
      bordered = true,
      className,
      inputClassName,
      onComplete,
    },
    forwardedRef,
  ) => {
    const refs = useRef<Array<HTMLInputElement | null>>([]);
    const code = normalizeCode(value ?? "", numeric, length);
    const cells = useMemo(
      () => Array.from({ length }, (_, index) => code[index] ?? ""),
      [code, length],
    );

    const setRef = (index: number, node: HTMLInputElement | null) => {
      refs.current[index] = node;
      if (index !== 0 || !forwardedRef) return;
      if (typeof forwardedRef === "function") forwardedRef(node);
      else forwardedRef.current = node;
    };

    const commit = (next: string) => {
      const normalized = normalizeCode(next, numeric, length);
      onChange(normalized);
      if (normalized.length === length) onComplete?.(normalized);
      return normalized;
    };

    const focusCell = (index: number) => {
      const target = refs.current[Math.max(0, Math.min(index, length - 1))];
      target?.focus();
      target?.select();
    };

    const replaceAt = (index: number, rawValue: string) => {
      const incoming = normalizeCode(rawValue, numeric, length);
      if (!incoming) {
        const next = `${code.slice(0, index)}${code.slice(index + 1)}`;
        commit(next);
        return;
      }

      const next = `${code.slice(0, index)}${incoming}${code.slice(index + incoming.length)}`;
      const normalized = commit(next);
      focusCell(Math.min(index + incoming.length, Math.max(normalized.length, 1), length - 1));
    };

    return (
      <div
        role="group"
        aria-label={ariaLabel}
        aria-invalid={status === "error" || undefined}
        data-slot="otp-input"
        data-status={status}
        dir="ltr"
        className={cn("flex w-full items-center justify-center gap-1.5 sm:gap-2", className)}
        onPaste={(event) => {
          if (disabled || readOnly) return;
          const pasted = normalizeCode(event.clipboardData.getData("text"), numeric, length);
          if (!pasted) return;
          event.preventDefault();
          const normalized = commit(pasted);
          focusCell(Math.max(0, normalized.length - 1));
        }}
      >
        {cells.map((character, index) => (
          <input
            key={index}
            ref={(node) => setRef(index, node)}
            data-slot="otp-cell"
            type="text"
            inputMode={numeric ? "numeric" : "text"}
            pattern={numeric ? "[0-9]*" : undefined}
            autoComplete={index === 0 ? autoComplete : "off"}
            autoFocus={autoFocus && index === 0}
            maxLength={length}
            value={character}
            disabled={disabled}
            readOnly={readOnly}
            aria-label={digitAriaLabel?.(index + 1, length) ?? `${ariaLabel} ${index + 1} of ${length}`}
            className={cn(
              "h-11 min-w-0 flex-1 rounded-md bg-card text-center text-lg font-semibold tabular-nums text-foreground outline-none transition-colors sm:h-12 sm:max-w-12",
              bordered !== false && "border border-input focus:border-ring focus:ring-2 focus:ring-ring/20",
              status === "error" && "border-destructive focus:border-destructive focus:ring-destructive/20",
              disabled && "cursor-not-allowed opacity-50",
              inputClassName,
            )}
            onFocus={(event) => event.currentTarget.select()}
            onChange={(event) => {
              if (disabled || readOnly) return;
              const rawValue = event.currentTarget.value;
              if (numeric && rawValue && !/\d/.test(rawValue)) {
                event.currentTarget.value = character;
                return;
              }
              replaceAt(index, rawValue);
            }}
            onKeyDown={(event) => {
              if (disabled || readOnly) return;
              if (event.key === "ArrowLeft") {
                event.preventDefault();
                focusCell(index - 1);
              } else if (event.key === "ArrowRight") {
                event.preventDefault();
                focusCell(index + 1);
              } else if (event.key === "Home") {
                event.preventDefault();
                focusCell(0);
              } else if (event.key === "End") {
                event.preventDefault();
                focusCell(length - 1);
              } else if (event.key === "Backspace") {
                event.preventDefault();
                if (character) {
                  commit(`${code.slice(0, index)}${code.slice(index + 1)}`);
                  focusCell(index);
                } else if (index > 0) {
                  commit(`${code.slice(0, index - 1)}${code.slice(index)}`);
                  focusCell(index - 1);
                }
              } else if (event.key === "Delete" && character) {
                event.preventDefault();
                commit(`${code.slice(0, index)}${code.slice(index + 1)}`);
                focusCell(index);
              }
            }}
          />
        ))}
      </div>
    );
  },
);

OtpInput.displayName = "OtpInput";
