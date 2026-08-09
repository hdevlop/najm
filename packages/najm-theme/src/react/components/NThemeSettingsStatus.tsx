// ============================================================================
// najm-theme/react — status and conflict feedback
// ============================================================================

import * as React from "react";
import { NAlert, NButton } from "najm-kit";

import { useNThemeSettingsOptional } from "../providers/NThemeSettingsProvider";

export interface NThemeSettingsStatusProps {
  className?: string;
  /** Hide the "you have unsaved changes" line and report failures only. */
  errorsOnly?: boolean;
}

/**
 * What just happened, said once and announced.
 *
 * A conflict is separated from every other failure because the action is
 * different and specific: reload, look at what changed, decide again. Folding
 * it into "Save failed" would leave an administrator retrying a save that will
 * keep failing for a reason nothing on screen explains.
 *
 * The live region is polite and the text is not the only signal — the buttons
 * disable, the alert has a tone — so the section still reads correctly with
 * animation off and with a screen reader on.
 */
export function NThemeSettingsStatus({ className, errorsOnly }: NThemeSettingsStatusProps) {
  const settings = useNThemeSettingsOptional();
  if (!settings) return null;

  const { status, dirty, reload, t } = settings;

  if (status.conflict) {
    return (
      <div className={className} role="alert">
        <NAlert
          variant="destructive"
          title={t("theme.errors.conflict")}
          description={t(
            status.conflict === "appearance"
              ? "theme.errors.appearanceConflict"
              : "theme.errors.brandingConflict",
          )}
          actions={
            <NButton variant="outline" onClick={() => reload()}>
              {t("theme.actions.reload")}
            </NButton>
          }
        />
      </div>
    );
  }

  if (status.error) {
    return (
      <div className={className} role="alert">
        <NAlert
          variant="destructive"
          title={t(
            status.phase === "resetting" ? "theme.errors.resetFailed" : "theme.errors.saveFailed",
          )}
          // The transport's normalized message. It is a package or server
          // string — a validation path, a status — never a response body.
          description={status.error.message}
          actions={
            <NButton variant="outline" onClick={() => reload()}>
              {t("theme.actions.retry")}
            </NButton>
          }
        />
      </div>
    );
  }

  if (errorsOnly) return null;

  const message =
    status.phase === "saving"
      ? t("theme.actions.saving")
      : status.phase === "resetting"
        ? t("theme.actions.resetting")
        : status.lastAction === "appearance-saved"
          ? t("theme.status.appearanceSaved")
          : status.lastAction === "branding-saved"
            ? t("theme.status.brandingSaved")
            : status.lastAction === "reset"
              ? t("theme.status.resetDone")
              : status.lastAction === "preset-applied"
                ? t("theme.status.saved")
                : dirty.any
                  ? t("theme.status.dirty")
                  : t("theme.status.clean");

  return (
    <p
      className={`najm-theme-status ${className ?? ""}`.trim()}
      role="status"
      aria-live="polite"
      data-dirty={dirty.any ? "true" : "false"}
    >
      {message}
    </p>
  );
}
