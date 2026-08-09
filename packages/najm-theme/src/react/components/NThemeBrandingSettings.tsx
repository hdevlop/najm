// ============================================================================
// najm-theme/react — the Branding section
// ============================================================================

import * as React from "react";
import { ImageInput, NSpinner } from "najm-kit";

import { useNThemeSettingsOptional } from "../providers/NThemeSettingsProvider";
import type { BrandingSlotView } from "../types";

export interface NThemeBrandingSettingsProps {
  className?: string;
  disabled?: boolean;
  /** Render only these slots, in this order. Defaults to every registered one. */
  slotKeys?: readonly string[];
}

/** The preview box shape per slot kind. Presentation only. */
const ASPECT_CLASS: Record<BrandingSlotView["previewAspect"], string> = {
  square: "aspect-square w-24",
  wide: "aspect-[3/1] w-48",
  panel: "aspect-[4/3] w-48",
  natural: "w-48",
};

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${Math.round(bytes / (1024 * 1024))} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

function formatTypes(mimeTypes: readonly string[]): string {
  return mimeTypes.map((mime) => mime.replace("image/", "").toUpperCase()).join(", ");
}

/**
 * One control per registered branding slot.
 *
 * The slots come from the server, not from a list in this file. That is what
 * makes a consumer's own slot — a favicon, an email header — render here
 * without a change to the package: its key, label, accepted types, and size
 * ceiling all arrive in the branding config response.
 *
 * Picking a file uploads it immediately as a *candidate* and shows a local
 * preview. Nothing is applied until Save: an upload that is never saved is an
 * orphan the server collects, and an administrator who changes their mind has
 * changed nothing.
 */
export function NThemeBrandingSettings({
  className,
  disabled,
  slotKeys,
}: NThemeBrandingSettingsProps) {
  const settings = useNThemeSettingsOptional();

  if (!settings || !settings.features.branding) return null;

  const { brandingSlots, uploadBrandingAsset, clearBrandingSlot, capabilities, loading, t } =
    settings;

  if (loading) {
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

  const slots = slotKeys
    ? (slotKeys
        .map((key) => brandingSlots.find((slot) => slot.key === key))
        .filter(Boolean) as BrandingSlotView[])
    : brandingSlots;

  const readOnly = disabled || !capabilities.manageBranding || !capabilities.uploadBrandingAssets;

  return (
    <div
      className={`najm-theme-branding-grid ${className ?? ""}`.trim()}
      data-najm-theme-section="branding"
    >
      {slots.map((slot) => {
        const label = t(slot.labelKey);
        const provenance = slot.pendingPreviewUrl
          ? t("theme.status.uploaded")
          : slot.isCustom
            ? t("theme.branding_ui.custom")
            : slot.inheritedFrom && slot.inheritedFrom !== "factory"
              ? t("theme.branding_ui.inheritedFrom", {
                  slot: t(
                    brandingSlots.find((other) => other.key === slot.inheritedFrom)?.labelKey
                      ?? slot.inheritedFrom,
                  ),
                })
              : slot.displayPath
                ? t("theme.branding_ui.usingFactory")
                : t("theme.branding_ui.noImage");

        return (
          <div
            key={slot.key}
            className="najm-theme-branding-slot"
            data-slot={slot.key}
            // A group rather than a `<label>`: the control is a preview box
            // wrapping a hidden file input the kit owns, so there is no single
            // form element for a `for` attribute to name. The group's
            // accessible name is what a screen reader announces on entering it.
            role="group"
            aria-label={label}
          >
            <p className="najm-theme-branding-label">{label}</p>
            <ImageInput
              title={label}
              // The local object URL while a candidate is pending, otherwise
              // whatever the server resolved — including an inherited mark, so
              // the box never looks empty when the page will show something.
              value={slot.displayPath}
              onChange={(file) => {
                if (file) void uploadBrandingAsset(slot.key, file);
                else clearBrandingSlot(slot.key);
              }}
              accept={slot.acceptedMimeTypes.join(",")}
              allowClear={slot.isCustom || slot.pendingFileName !== null}
              disabled={readOnly || slot.uploading}
              previewClassName={ASPECT_CLASS[slot.previewAspect]}
              previewAlt={label}
              subtitle={t("theme.branding_ui.accepts", {
                types: formatTypes(slot.acceptedMimeTypes),
                size: formatBytes(slot.maxBytes),
              })}
              buttonLabel={slot.displayPath ? t("theme.actions.replace") : t("theme.actions.upload")}
              clearAriaLabel={`${t("theme.actions.clear")} — ${label}`}
              replaceAriaLabel={`${t("theme.actions.replace")} — ${label}`}
            />
            {/* Announced rather than merely coloured: "inherited from the
                sidebar mark" is the difference between a slot that is empty and
                one that is deliberately reusing another. */}
            <p className="najm-theme-branding-provenance" aria-live="polite">
              {slot.uploading ? t("theme.status.uploading") : provenance}
            </p>
          </div>
        );
      })}
    </div>
  );
}
