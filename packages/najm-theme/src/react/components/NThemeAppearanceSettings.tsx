// ============================================================================
// najm-theme/react — the Appearance section
// ============================================================================

import * as React from "react";
import { NThemeCustomizer, NSpinner } from "najm-kit";
import type { NThemeCustomizerProps } from "najm-kit";

import { useNThemeSettingsOptional } from "../providers/NThemeSettingsProvider";

export interface NThemeAppearanceSettingsProps {
  className?: string;
  /** Forces the section read-only regardless of what the server allows. */
  disabled?: boolean;
  /** Whether to render the customizer's own Theme/Typography tabs. */
  showTabs?: boolean;
  /**
   * Render Import/Export inside the customizer. Disable this when a shared
   * `NThemeSettingsActions` bar owns those file actions.
   */
  showFileActions?: boolean;
  /** Render the customizer's local section reset. Disable it for a shared footer. */
  showResetAction?: boolean;
  tabs?: NThemeCustomizerProps["tabs"];
  fontOptions?: NThemeCustomizerProps["fontOptions"];
  /** Passed through to the kit's customizer for per-control wording. */
  customizerLabels?: NThemeCustomizerProps["labels"];
}

/**
 * The design editor, bound to the provider's draft.
 *
 * The customizer itself is Najm Kit's and stays presentational: it takes a
 * value and reports a change. Everything this file adds is the binding —
 * which value, where the change goes, and what the factory design is for the
 * per-field reset control.
 *
 * Mountable alone. It does not assume a Branding or Presets sibling, and it
 * renders no Save button of its own: `NThemeSettingsActions` owns that, so a
 * consumer can put one action bar under three sections instead of three.
 */
export function NThemeAppearanceSettings({
  className,
  disabled,
  showTabs,
  showFileActions = true,
  showResetAction = true,
  tabs,
  fontOptions,
  customizerLabels,
}: NThemeAppearanceSettingsProps) {
  const settings = useNThemeSettingsOptional();

  // Renders nothing outside a provider, and nothing when the backend did not
  // register the feature. Both are ordinary configurations, not errors.
  if (!settings || !settings.features.appearance) return null;

  const { design, appearance, setDesignDraft, capabilities, loading, t } = settings;

  if (loading || !design || !appearance) {
    return (
      <div
        className={className}
        role="status"
        aria-busy="true"
        aria-label={t("theme.status.loading")}
      >
        <NSpinner />
      </div>
    );
  }

  const readOnly = disabled || !capabilities.manageAppearance;

  return (
    <div className={className} data-najm-theme-section="appearance">
      <NThemeCustomizer
        value={design}
        // The design a per-field reset returns to. `isFactory` means nothing is
        // stored, so the committed design *is* the factory one; otherwise the
        // server has not sent the factory values and the current design is the
        // honest baseline for the control.
        factoryValue={appearance.designConfig}
        savedDesign={appearance.designConfig}
        onChange={setDesignDraft}
        showTabs={showTabs}
        tabs={tabs}
        fontOptions={fontOptions}
        labels={customizerLabels}
        // Hiding the control is a courtesy; the guard on PUT is the boundary.
        disabled={readOnly}
        // Presets have their own section with its own server-backed lifecycle,
        // so the customizer's built-in picker stays off. Rendering both would
        // give a page two preset selectors that disagree.
        showFileActions={showFileActions}
        showResetAction={showResetAction}
      />
    </div>
  );
}
