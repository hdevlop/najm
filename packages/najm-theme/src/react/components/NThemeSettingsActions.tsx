// ============================================================================
// najm-theme/react — the action bar
// ============================================================================

import * as React from "react";
import { NButton } from "najm-kit";

import { useNThemeSettingsOptional } from "../providers/NThemeSettingsProvider";
import { NThemeSettingsResetButton } from "./NThemeSettingsResetButton";
import { NThemeSettingsSaveButton } from "./NThemeSettingsSaveButton";
import { NThemeSettingsStatus } from "./NThemeSettingsStatus";

export interface NThemeSettingsActionsProps {
  className?: string;
  /** Limit the bar to these resources. Defaults to every enabled one. */
  resources?: readonly ("appearance" | "branding")[];
  showStatus?: boolean;
  showReset?: boolean;
  showDiscard?: boolean;
}

/**
 * Save, discard, and reset for whichever sections are mounted above it.
 *
 * It coordinates only *enabled and dirty* resources. A page showing the
 * Branding section alone gets a bar that saves branding — not one that also
 * fires an appearance request for a draft that does not exist.
 *
 * It is a sibling of the sections, never their parent. That is what lets the
 * same three sections live in tabs, in a sheet, or on a page with the bar
 * pinned somewhere else entirely.
 */
export function NThemeSettingsActions({
  className,
  resources,
  showStatus = true,
  showReset = true,
  showDiscard = true,
}: NThemeSettingsActionsProps) {
  const settings = useNThemeSettingsOptional();
  if (!settings) return null;

  const { dirty, discardDrafts, features, status, t } = settings;

  const shows = (resource: "appearance" | "branding") =>
    (resources === undefined || resources.includes(resource)) && features[resource];

  return (
    <div className={`najm-theme-actions ${className ?? ""}`.trim()} data-najm-theme-actions="">
      {showStatus ? <NThemeSettingsStatus /> : null}

      <div className="najm-theme-actions-buttons">
        {showDiscard ? (
          <NButton
            variant="ghost"
            onClick={() => discardDrafts()}
            disabled={!dirty.any || status.phase === "saving"}
          >
            {t("theme.actions.discard")}
          </NButton>
        ) : null}

        {showReset && shows("appearance") ? (
          <NThemeSettingsResetButton resource="appearance" />
        ) : null}
        {showReset && shows("branding") ? (
          <NThemeSettingsResetButton resource="branding">
            {t("theme.actions.reset")}
          </NThemeSettingsResetButton>
        ) : null}

        <NThemeSettingsSaveButton resources={resources} />
      </div>
    </div>
  );
}
