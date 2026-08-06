'use client';

import { useMemo, useState } from 'react';
import {
  NPageHeader,
  NPageLayout,
  NThemeCustomizer,
  NajmDesignProvider,
  SelectInput,
  defineNajmDesignConfig,
  type NThemePreset,
  type NajmDesignConfig,
} from 'najm-kit';
import { Layers, Palette } from 'lucide-react';

/**
 * The three theme-customizer fixes, in one place to look at.
 *
 * What to check:
 *
 * - **Saved themes picker.** Open the dropdown: every row carries a colour
 *   strip, the check sits on the left in the success colour, and the delete
 *   button sits hard right. Deleting is mouse-only by design — Radix owns
 *   focus inside the listbox. Picking a row only calls back; nothing here
 *   persists, which is the point of the component being presentational.
 * - **Page header alignment.** Toggle "Page header as card" below. With the
 *   card off the header must sit flush against the top of the panel with no
 *   gap above it, its bottom rule spanning the full width. Before the fix it
 *   floated inside NPageLayout's padding. Change the gutter/gap and it should
 *   stay flush at every value.
 * - **SelectInput icons.** The plain SelectInput at the bottom is passed
 *   `icon` per item. Those icons used to be dropped on the floor.
 */

const BASE = defineNajmDesignConfig({
  version: 1,
  theme: {
    mode: 'light',
    accent: 'emerald',
    radius: '10px',
  },
  layout: { pageGutter: '16px', sectionGap: '16px' },
  components: { pageHeader: { card: true } },
});

function withTokens(tokens: Record<string, string>): NajmDesignConfig {
  return {
    ...BASE,
    theme: { ...BASE.theme, tokens: { ...BASE.theme.tokens, ...tokens } },
  };
}

const SEED_PRESETS: NThemePreset[] = [
  {
    id: 'sable',
    name: 'Sable',
    isBuiltIn: true,
    design: withTokens({
      sidebar: 'oklch(0.955 0.016 80)',
      primary: 'oklch(0.55 0.13 45)',
      secondary: 'oklch(0.88 0.05 80)',
      accent: 'oklch(0.93 0.035 70)',
      background: 'oklch(0.985 0.008 85)',
    }),
  },
  {
    id: 'nuit',
    name: 'Nuit',
    isBuiltIn: true,
    design: withTokens({
      sidebar: 'oklch(0.24 0.06 268)',
      primary: 'oklch(0.48 0.16 268)',
      secondary: 'oklch(0.82 0.15 78)',
      accent: 'oklch(0.93 0.03 268)',
      background: 'oklch(0.985 0.004 265)',
    }),
  },
  {
    id: 'ciel',
    name: 'Ciel',
    design: withTokens({
      sidebar: 'oklch(0.28 0.05 205)',
      primary: 'oklch(0.55 0.105 197)',
      secondary: 'oklch(0.85 0.09 185)',
      accent: 'oklch(0.92 0.045 195)',
      background: 'oklch(0.978 0.01 210)',
    }),
  },
];

export default function ThemePresetsPage() {
  const [design, setDesign] = useState<NajmDesignConfig>(BASE);
  const [presets, setPresets] = useState<NThemePreset[]>(SEED_PRESETS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);

  const note = (line: string) =>
    setLog((previous) => [line, ...previous].slice(0, 6));

  const isCard = Boolean(design.components?.pageHeader?.card);

  const iconItems = useMemo(
    () => [
      { value: 'layers', label: 'With a component icon', icon: Layers },
      { value: 'palette', label: 'Another component icon', icon: Palette },
      { value: 'plain', label: 'No icon at all' },
    ],
    [],
  );
  const [iconValue, setIconValue] = useState('layers');

  return (
    <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
      <div className="flex flex-col gap-4">
        <h1 className="text-lg font-semibold">Theme presets & page header</h1>

        <NThemeCustomizer
          value={design}
          factoryValue={BASE}
          savedDesign={BASE}
          onChange={setDesign}
          presets={presets}
          selectedPresetId={selectedId}
          onPresetSelect={(preset) => {
            setSelectedId(preset?.id ?? null);
            setDesign(preset?.design ?? BASE);
            note(preset ? `selected ${preset.name}` : 'back to saved design');
          }}
          onPresetSave={async (name) => {
            const created: NThemePreset = {
              id: `local-${Date.now()}`,
              name,
              design,
            };
            setPresets((current) => [...current, created]);
            setSelectedId(created.id);
            note(`saved "${name}"`);
          }}
          onPresetDelete={async (preset) => {
            setPresets((current) =>
              current.filter((item) => item.id !== preset.id),
            );
            if (selectedId === preset.id) setSelectedId(null);
            note(`deleted "${preset.name}"`);
          }}
          showFileActions={false}
        />

        <div className="flex flex-col gap-2 rounded-md border border-border p-3">
          <span className="text-xs font-medium text-muted-foreground">
            SelectInput with per-item icons
          </span>
          <SelectInput
            value={iconValue}
            onChange={setIconValue}
            items={iconItems}
            ariaLabel="Icon items"
          />
        </div>

        {log.length > 0 ? (
          <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
            {log.map((line, index) => (
              <li key={`${line}-${index}`}>{line}</li>
            ))}
          </ul>
        ) : null}
      </div>

      <NajmDesignProvider config={design}>
        <div className="overflow-hidden rounded-lg border border-border bg-background">
          <div className="flex">
            {/* Stand-in for NSidebarHeader: the h-14 the page header must meet. */}
            <div className="w-44 shrink-0 border-r border-sidebar-border bg-sidebar">
              <div className="flex h-14 min-h-14 items-center gap-2 border-b border-sidebar-border/70 px-4 text-sidebar-foreground">
                <Palette className="size-5 text-sidebar-primary" />
                <span className="text-sm font-semibold">Playground</span>
              </div>
              <div className="p-3 text-xs text-sidebar-foreground/70">
                Sidebar body
              </div>
            </div>

            <NPageLayout className="min-w-0 flex-1">
              <NPageHeader
                icon={Layers}
                title="Page header"
                subtitle={
                  isCard
                    ? 'Card mode — inset inside the page gutter, as intended.'
                    : 'Bar mode — must be flush with the top and meet the sidebar rule.'
                }
              />
              <div className="rounded-md border border-border bg-card p-4 text-sm text-card-foreground">
                Page content sits below the header at one section gap.
              </div>
            </NPageLayout>
          </div>
        </div>
      </NajmDesignProvider>
    </div>
  );
}
