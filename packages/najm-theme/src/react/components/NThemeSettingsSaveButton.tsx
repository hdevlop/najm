// ============================================================================
// najm-theme/react — save
// ============================================================================

import * as React from "react";
import { NButton } from "najm-kit";
import type { NButtonProps } from "najm-kit";

import { useNThemeSettingsOptional } from "../providers/NThemeSettingsProvider";

export interface NThemeSettingsSaveButtonProps
  extends Omit<NButtonProps, "onClick" | "loading" | "children"> {
  /**
   * Which resources this button commits. Defaults to every dirty one.
   *
   * Naming a single resource is how a consumer puts a Save under the Branding
   * section alone.
   */
  resources?: readonly ("appearance" | "branding")[];
  children?: React.ReactNode;
}

/**
 * Saves appearance and branding as **independent** requests.
 *
 * Deliberately not one atomic call. They are separate rows with separate
 * revisions, and pretending otherwise would mean reporting a branding failure
 * as though the appearance save had rolled back — when it committed and is
 * live. So each is attempted, and the first failure is what the status region
 * reports; a partial success stays a partial success.
 *
 * Appearance goes first because it is the change most likely to be mid-edit,
 * and a conflict there should surface before an image upload is committed
 * against a design the user is about to lose.
 */
export function NThemeSettingsSaveButton({
  resources,
  children,
  disabled,
  ...buttonProps
}: NThemeSettingsSaveButtonProps) {
  const settings = useNThemeSettingsOptional();
  if (!settings) return null;

  const { dirty, status, saveAppearance, saveBranding, capabilities, features, t } = settings;

  const wants = (resource: "appearance" | "branding") =>
    resources === undefined || resources.includes(resource);

  const savesAppearance = wants("appearance") && features.appearance && dirty.appearance;
  const savesBranding = wants("branding") && features.branding && dirty.branding;

  const allowed =
    (!savesAppearance || capabilities.manageAppearance)
    && (!savesBranding || capabilities.manageBranding);

  const handleSave = async () => {
    if (savesAppearance) await saveAppearance();
    if (savesBranding) await saveBranding();
  };

  return (
    <NButton
      {...buttonProps}
      onClick={handleSave}
      loading={status.phase === "saving"}
      disabled={disabled || !allowed || (!savesAppearance && !savesBranding)}
    >
      {children ?? t("theme.actions.save")}
    </NButton>
  );
}
