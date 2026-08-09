'use client';

import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Palette, SlidersHorizontal } from 'lucide-react';
import { NButton, NDialog, NSheet, NajmUIProvider, useNajmDesignEditor } from 'najm-kit';
import type { NajmDesignConfig } from 'najm-kit';
import {
  NThemeAppearanceSettings,
  NThemeBrandingSettings,
  NThemePresetSettings,
  NThemeSettings,
  NThemeSettingsActions,
  NThemeSettingsProvider,
  NThemeSettingsStatus,
  useNThemeSettings,
} from 'najm-theme/react';
import 'najm-theme/styles.css';

// ============================================================================
// Every composition on this page mounts the same provider and the same
// components. Nothing below reimplements a hook, a fetch, a draft, a revision,
// or a feature flag — which is the claim the managed mode exists to make
// checkable by eye.
// ============================================================================

/** Slots this application invented; the package has no label for them. */
const STUDIO_LABELS = {
  'studio.branding.slots.reportHeaderMark': 'Report header mark',
  'studio.branding.slots.emailFooterIcon': 'Email footer icon',
};

const CLIENT = { baseUrl: '/api/theme' };

export interface ManagedModeProps {
  initialDesign: NajmDesignConfig;
  initialRevision: number;
  initialSlots: Record<string, string | null>;
}

export function ManagedMode({ initialDesign, initialRevision, initialSlots }: ManagedModeProps) {
  // One client for the page. Every provider below shares it, so a save in the
  // sheet is visible to the panel behind it without any coordination.
  const [queryClient] = React.useState(
    () => new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false } } }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      {/*
        `initialDesign` seeds the design editor from the server snapshot, so the
        first paint is already the managed appearance rather than a default that
        flashes. `NThemeSettingsProvider` pushes its draft into this same editor,
        which is what makes editing repaint the page live.
      */}
      <NajmUIProvider initialDesign={initialDesign}>
        <NThemeSettingsProvider client={CLIENT} labels={STUDIO_LABELS}>
          <Workbench initialRevision={initialRevision} initialSlots={initialSlots} />
        </NThemeSettingsProvider>
      </NajmUIProvider>
    </QueryClientProvider>
  );
}

function Workbench({
  initialRevision,
  initialSlots,
}: {
  initialRevision: number;
  initialSlots: Record<string, string | null>;
}) {
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [dialogOpen, setDialogOpen] = React.useState(false);

  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-6 py-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
      <div className="space-y-6">
        <LivePreview initialRevision={initialRevision} initialSlots={initialSlots} />
        <CompositionNotes />
      </div>

      <div className="space-y-6">
        <Panel
          title="In a page"
          note="The whole surface, tabbed. One component, no local state."
        >
          <NThemeSettings />
        </Panel>

        <Panel title="In an overlay" note="The same provider, opened from anywhere.">
          <div className="flex flex-wrap gap-2">
            <NButton onClick={() => setSheetOpen(true)}>Open sheet</NButton>
            <NButton variant="outline" onClick={() => setDialogOpen(true)}>
              Open dialog
            </NButton>
          </div>

          <NSheet
            open={sheetOpen}
            onOpenChange={setSheetOpen}
            icon={Palette}
            title="Appearance"
            description="Stacked layout, actions rendered in the sheet footer."
            width={520}
            footer={<NThemeSettingsActions />}
          >
            <NThemeSettings layout="stacked" showActions={false} />
          </NSheet>

          <NDialog
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            title="Presets"
            description="One section on its own, composed directly."
            showButtons={false}
          >
            <div className="space-y-4 py-2">
              <NThemePresetSettings />
              <NThemeSettingsActions />
            </div>
          </NDialog>
        </Panel>

        {/*
          Feature narrowing is a provider prop, not a fork of the components.
          These can only ever narrow what the server enabled — a page cannot
          turn on a feature the backend refused.
        */}
        <Panel
          title="Appearance only"
          note="features={{ appearance: true }} — branding and presets never mount."
        >
          <NThemeSettingsProvider client={CLIENT} features={{ appearance: true }}>
            <NThemeAppearanceSettings />
            <NThemeSettingsActions />
          </NThemeSettingsProvider>
        </Panel>

        <Panel
          title="Branding only, custom slots"
          note="Two slots this app registered; the package supplied their controls, this page supplied their labels."
        >
          <NThemeSettingsProvider
            client={CLIENT}
            features={{ branding: true }}
            labels={STUDIO_LABELS}
          >
            <NThemeSettingsStatus />
            <NThemeBrandingSettings />
            <NThemeSettingsActions />
          </NThemeSettingsProvider>
        </Panel>
      </div>
    </div>
  );
}

/**
 * Reads the *design editor*, not the settings provider.
 *
 * That is the integration worth showing: the settings UI pushes its draft into
 * `najm-kit`'s editor, and anything in the tree — including code that has never
 * heard of `najm-theme` — repaints from it.
 */
function LivePreview({
  initialRevision,
  initialSlots,
}: {
  initialRevision: number;
  initialSlots: Record<string, string | null>;
}) {
  const editor = useNajmDesignEditor();
  const settings = useNThemeSettings();
  const design = editor?.design;

  return (
    <section className="rounded-xl border border-border p-5">
      <div className="mb-4 flex items-center gap-2">
        <SlidersHorizontal className="size-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">Live preview</h2>
        {editor?.hasDraft ? (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
            unsaved draft
          </span>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <NButton>Primary</NButton>
        <NButton variant="outline">Outline</NButton>
        <NButton variant="ghost">Ghost</NButton>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-3 text-xs">
        <Fact label="Server revision at render" value={String(initialRevision)} />
        <Fact label="Client revision" value={String(settings.appearance?.revision ?? '—')} />
        <Fact label="Primary token" value={design?.theme?.tokens?.primary ?? '—'} />
        <Fact label="Radius" value={design?.theme?.radius ?? '—'} />
      </dl>

      <div className="mt-5">
        <p className="mb-2 text-xs font-medium text-muted-foreground">
          Branding slots resolved on the server
        </p>
        <ul className="space-y-1 text-xs text-muted-foreground">
          {Object.entries(initialSlots).map(([slot, value]) => (
            <li key={slot} className="flex justify-between gap-4">
              <span>{slot}</span>
              <code className="truncate">{value ?? 'null'}</code>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/50 p-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="mt-1 truncate font-mono">{value}</dd>
    </div>
  );
}

function Panel({
  title,
  note,
  children,
}: {
  title: string;
  note: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border p-5">
      <h2 className="text-sm font-semibold">{title}</h2>
      <p className="mb-4 mt-1 text-xs text-muted-foreground">{note}</p>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function CompositionNotes() {
  return (
    <section className="rounded-xl border border-border p-5 text-sm">
      <h2 className="mb-3 text-sm font-semibold">What this page is not</h2>
      <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
        <li>
          It is not the Studio&apos;s project/style editor. That edits a design
          <em> document</em> and stores it in <code>theme-studio.db</code>. This edits a
          <em> running application</em> and stores it in <code>theme-studio-managed.db</code>,
          through the package&apos;s own tables. Neither can overwrite the other.
        </li>
        <li>
          It does not import <code>najm-theme</code> from source. There is no tsconfig path and no
          bundler alias for it, so everything here runs the published build.
        </li>
        <li>
          It contains no controller, service, hook, DTO, or API client of its own — the whole
          reason the package exists.
        </li>
      </ul>
    </section>
  );
}
