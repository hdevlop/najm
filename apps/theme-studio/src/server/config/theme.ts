import {
  BRANDING_RASTER_MIME_TYPES,
  STANDARD_BRANDING_SLOTS,
  type BrandingSlotDefinition,
  type FactoryBranding,
  type NajmDesignConfig,
} from 'najm-theme';

/**
 * What the application ships in its build — the appearance a fresh install has
 * before anyone opens the settings page, and the design a reset returns to.
 *
 * Deliberately not one of the Studio's saved styles. Factory values come from
 * the *build*; styles come from a database a developer can empty. Wiring the
 * factory to a stored row would make "reset" mean "go back to whatever is in
 * the table", which is the one thing it must never mean.
 */
export const factoryDesign: NajmDesignConfig = {
  version: 1,
  theme: {
    preset: 'light',
    tokens: {
      primary: 'oklch(0.55 0.18 265)',
      background: 'oklch(1 0 0)',
      foreground: 'oklch(0.21 0.03 265)',
      muted: 'oklch(0.97 0.01 265)',
    },
    radius: '0.625rem',
  },
  typography: {
    fontSans: 'Geist, Inter, sans-serif',
    fontMono: 'JetBrains Mono, monospace',
  },
};

export const factoryBranding = (): FactoryBranding => ({
  sidebarLogoExpanded: '/brand/studio-logo.svg',
  // Declared with no factory value: the settings page shows an empty slot
  // rather than a broken image, and `resolveBrandingSlots` answers null.
  authHeroImage: null,
});

/**
 * Two slots this application invented, registered beside the four the package
 * ships.
 *
 * They exist to prove the registry is genuinely open — a consumer adds a slot
 * without the package knowing the name, and gets validation, upload limits,
 * inheritance, and a rendered control for it. `labelKey` falls outside the
 * package catalogs on purpose; the provider's label overrides supply the text,
 * which is the documented path for a slot the package has never heard of.
 */
export const studioBrandingSlots: readonly BrandingSlotDefinition[] = [
  ...STANDARD_BRANDING_SLOTS,
  {
    key: 'reportHeaderMark',
    kind: 'image',
    labelKey: 'studio.branding.slots.reportHeaderMark',
    maxBytes: 512 * 1024,
    acceptedMimeTypes: [...BRANDING_RASTER_MIME_TYPES],
    previewAspect: 'wide',
    // No upload, no factory value — falls back to the sidebar mark, so a single
    // logo upload reaches the exported reports too.
    fallback: { inheritFrom: 'sidebarLogoExpanded' },
  },
  {
    key: 'emailFooterIcon',
    kind: 'icon',
    labelKey: 'studio.branding.slots.emailFooterIcon',
    maxBytes: 128 * 1024,
    acceptedMimeTypes: ['image/png'],
    previewAspect: 'square',
    fallback: '/brand/studio-icon.png',
  },
];
