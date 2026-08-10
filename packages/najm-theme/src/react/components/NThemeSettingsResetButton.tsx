// ============================================================================
// najm-theme/react — reset
// ============================================================================

import * as React from "react";
import { NButton, NConfirmDialog } from "najm-kit";
import type { NButtonProps } from "najm-kit";

import { useNThemeSettingsOptional } from "../providers/NThemeSettingsProvider";

export interface NThemeSettingsResetButtonProps
  extends Omit<NButtonProps, "onClick" | "loading" | "children"> {
  /** Which resource to restore. Defaults to `"appearance"`. */
  resource?: "appearance" | "branding";
  children?: React.ReactNode;
}

/**
 * Restores the factory design or the factory images, behind a confirmation.
 *
 * Confirmed because it is destructive and not undoable from this screen: it
 * discards every stored customization for the scope, and on the branding side
 * it also removes the uploaded files. One resource per button rather than a
 * combined "reset everything", so an administrator restoring the logos is never
 * one mis-click from also losing the palette.
 *
 * Each button names its own resource — "Reset appearance to factory", not
 * "Reset to factory". Two buttons sharing one name is a bar with two identical
 * destructive controls on it: a screen reader reads the same words twice, and
 * the only thing separating them is the order they happen to render in. The
 * confirmation inside says which resource it is; the trigger has to as well,
 * because that is where the decision to press is made.
 */
export function NThemeSettingsResetButton({
  resource = "appearance",
  children,
  disabled,
  variant = "outline",
  ...buttonProps
}: NThemeSettingsResetButtonProps) {
  const settings = useNThemeSettingsOptional();
  const [confirming, setConfirming] = React.useState(false);

  if (!settings) return null;

  const { resetAppearance, resetBranding, status, capabilities, features, appearance, t } =
    settings;

  const enabled =
    resource === "appearance"
      ? features.appearance && capabilities.manageAppearance
      : features.branding && capabilities.manageBranding;

  if (!enabled) return null;

  // Nothing to restore when nothing is stored. Kept rendered but disabled
  // rather than removed, so the action bar does not reflow as an administrator
  // saves and resets.
  const alreadyFactory = resource === "appearance" && appearance?.isFactory === true;

  return (
    <>
      <NButton
        {...buttonProps}
        variant={variant}
        onClick={() => setConfirming(true)}
        loading={status.phase === "resetting"}
        disabled={disabled || alreadyFactory}
      >
        {children ??
          t(
            resource === "appearance"
              ? "theme.actions.resetAppearance"
              : "theme.actions.resetBranding",
          )}
      </NButton>

      <NConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        variant="destructive"
        title={t(
          resource === "appearance"
            ? "theme.confirm.resetAppearanceTitle"
            : "theme.confirm.resetBrandingTitle",
        )}
        description={t(
          resource === "appearance"
            ? "theme.confirm.resetAppearanceBody"
            : "theme.confirm.resetBrandingBody",
        )}
        confirmLabel={t("theme.actions.reset")}
        cancelLabel={t("theme.actions.cancel")}
        loading={status.phase === "resetting"}
        onConfirm={() => {
          setConfirming(false);
          void (resource === "appearance" ? resetAppearance() : resetBranding());
        }}
      />
    </>
  );
}
