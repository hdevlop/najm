// ============================================================================
// najm-theme/react — the ready-made composite
// ============================================================================

import * as React from "react";
import { NTabs } from "najm-kit";
import type { NTabsItem } from "najm-kit";

import { useNThemeSettingsOptional } from "../providers/NThemeSettingsProvider";
import { NThemeAppearanceSettings } from "./NThemeAppearanceSettings";
import { NThemeBrandingSettings } from "./NThemeBrandingSettings";
import { NThemePresetSettings } from "./NThemePresetSettings";
import { NThemeSettingsActions } from "./NThemeSettingsActions";

export interface NThemeSettingsProps {
  className?: string;
  disabled?: boolean;
  /** Hide the built-in action bar to place one somewhere else. */
  showActions?: boolean;
  /** Render the sections stacked instead of in tabs. */
  layout?: "tabs" | "stacked";
}

/**
 * Every enabled section under one provider, with an action bar.
 *
 * The default for a consumer that has no opinion about layout — and only that.
 * It is built from the same exported sections a custom surface uses, holds no
 * state of its own, and is never the supported way: a page, a sheet, a dialog,
 * or a tab strip the consumer owns are all equally first-class, which is why
 * none of the sections below know which one they are in.
 *
 * With one section enabled the tab strip collapses to that section rendered
 * directly. A single tab is chrome nobody can act on.
 */
export function NThemeSettings({
  className,
  disabled,
  showActions = true,
  layout = "tabs",
}: NThemeSettingsProps) {
  const settings = useNThemeSettingsOptional();
  if (!settings) return null;

  const { features, t } = settings;

  const sections: { key: string; label: string; node: React.ReactNode }[] = [];
  if (features.appearance) {
    sections.push({
      key: "appearance",
      label: t("theme.settings.appearanceTab"),
      node: (
        <NThemeAppearanceSettings
          disabled={disabled}
          showFileActions={false}
          showResetAction={false}
        />
      ),
    });
  }
  if (features.branding) {
    sections.push({
      key: "branding",
      label: t("theme.settings.brandingTab"),
      node: <NThemeBrandingSettings disabled={disabled} />,
    });
  }
  if (features.presets) {
    sections.push({
      key: "presets",
      label: t("theme.settings.presetsTab"),
      node: <NThemePresetSettings disabled={disabled} showApplyAction={false} />,
    });
  }

  if (sections.length === 0) return null;

  const body =
    layout === "stacked" || sections.length === 1 ? (
      <div className="najm-theme-stack">
        {sections.map((section) => (
          <section key={section.key} aria-label={section.label}>
            {section.node}
          </section>
        ))}
      </div>
    ) : (
      <NTabs
        items={sections.map<NTabsItem>((section) => ({
          value: section.key,
          label: section.label,
          content: section.node,
        }))}
        defaultValue={sections[0].key}
      />
    );

  return (
    <div className={`najm-theme-settings ${className ?? ""}`.trim()}>
      {body}
      {showActions ? (
        <NThemeSettingsActions
          display="compact"
          showFileActions
          showDiscard={false}
        />
      ) : null}
    </div>
  );
}
