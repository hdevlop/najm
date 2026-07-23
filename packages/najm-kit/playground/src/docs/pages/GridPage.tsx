import React from 'react';
import { NGrid, NGridItem } from 'najm-kit';
import { ComponentPage } from '../ComponentPage';
import { Example } from '../Example';

function Box({ label, color = 'bg-primary/15 text-primary' }: { label: string; color?: string }) {
  return (
    <div className={`flex h-full min-h-20 items-center justify-center rounded-lg p-3 text-sm font-medium ${color}`}>
      {label}
    </div>
  );
}

export function GridPage() {
  return (
    <ComponentPage
      title="Grid"
      description="A responsive CSS grid that follows the theme's sectionGap token by default. Pass a column count per breakpoint. Wrap children in NGridItem to control how many columns each child spans, per breakpoint."
      category="Layout"
    >
      <Example
        title="Uniform grid — single column on mobile, 6 on desktop"
        description="cols=1 (mobile) → smCols=2 → lgCols=3 → xlCols=6. Gap inherits the theme sectionGap token automatically. No NGridItem wrappers needed — direct children flow evenly."
        center={false}
        code={`<NGrid cols={1} smCols={2} lgCols={3} xlCols={6}>
  <div>A</div>
  <div>B</div>
  <div>C</div>
  <div>D</div>
  <div>E</div>
  <div>F</div>
</NGrid>`}
      >
        <NGrid cols={1} smCols={2} lgCols={3} xlCols={6}>
          <Box label="A" color="bg-rose-500/15 text-rose-400" />
          <Box label="B" color="bg-amber-500/15 text-amber-400" />
          <Box label="C" color="bg-emerald-500/15 text-emerald-400" />
          <Box label="D" color="bg-sky-500/15 text-sky-400" />
          <Box label="E" color="bg-violet-500/15 text-violet-400" />
          <Box label="F" color="bg-fuchsia-500/15 text-fuchsia-400" />
        </NGrid>
      </Example>

      <Example
        title="Uneven rows with NGridItem — dashboard layout"
        description="A 12-column grid with NGridItem spans: row 1 = six cells (span 2 each), row 2 = wide (span 8) + narrow (span 4), row 3 = two equal (span 6 each)."
        center={false}
        code={`<NGrid cols={12}>
  <NGridItem span={2}><div>A</div></NGridItem>
  <NGridItem span={2}><div>B</div></NGridItem>
  <NGridItem span={2}><div>C</div></NGridItem>
  <NGridItem span={2}><div>D</div></NGridItem>
  <NGridItem span={2}><div>E</div></NGridItem>
  <NGridItem span={2}><div>F</div></NGridItem>

  <NGridItem span={12} mdSpan={8}><div>Chart</div></NGridItem>
  <NGridItem span={12} mdSpan={4}><div>Donut</div></NGridItem>

  <NGridItem span={12} mdSpan={6}><div>Panel A</div></NGridItem>
  <NGridItem span={12} mdSpan={6}><div>Panel B</div></NGridItem>
</NGrid>`}
      >
        <NGrid cols={12}>
          <NGridItem span={6} mdSpan={2}><Box label="A" color="bg-rose-500/15 text-rose-400" /></NGridItem>
          <NGridItem span={6} mdSpan={2}><Box label="B" color="bg-amber-500/15 text-amber-400" /></NGridItem>
          <NGridItem span={6} mdSpan={2}><Box label="C" color="bg-emerald-500/15 text-emerald-400" /></NGridItem>
          <NGridItem span={6} mdSpan={2}><Box label="D" color="bg-sky-500/15 text-sky-400" /></NGridItem>
          <NGridItem span={6} mdSpan={2}><Box label="E" color="bg-violet-500/15 text-violet-400" /></NGridItem>
          <NGridItem span={6} mdSpan={2}><Box label="F" color="bg-fuchsia-500/15 text-fuchsia-400" /></NGridItem>

          <NGridItem span={12} mdSpan={8}><Box label="Chart" color="bg-primary/15 text-primary" /></NGridItem>
          <NGridItem span={12} mdSpan={4}><Box label="Donut" color="bg-emerald-500/15 text-emerald-400" /></NGridItem>

          <NGridItem span={12} mdSpan={6}><Box label="Panel A" color="bg-sky-500/15 text-sky-400" /></NGridItem>
          <NGridItem span={12} mdSpan={6}><Box label="Panel B" color="bg-violet-500/15 text-violet-400" /></NGridItem>
        </NGrid>
      </Example>

      <Example
        title="Sidebar + main content (3/9 split)"
        description="A narrow sidebar (span 3) next to a wide main area (span 9). On mobile both stack full-width."
        center={false}
        code={`<NGrid cols={1} mdCols={12}>
  <NGridItem span={1} mdSpan={3}><div>Sidebar</div></NGridItem>
  <NGridItem span={1} mdSpan={9}><div>Main</div></NGridItem>
</NGrid>`}
      >
        <NGrid cols={1} mdCols={12}>
          <NGridItem span={1} mdSpan={3}><Box label="Sidebar" color="bg-amber-500/15 text-amber-400" /></NGridItem>
          <NGridItem span={1} mdSpan={9}><Box label="Main" color="bg-primary/15 text-primary" /></NGridItem>
        </NGrid>
      </Example>

      <Example
        title="Featured item — one large + small grid"
        description="A hero spans 8 columns, with a 2×2 mini grid in the remaining 4 columns."
        center={false}
        code={`<NGrid cols={1} mdCols={12}>
  <NGridItem span={1} mdSpan={8}><div>Hero</div></NGridItem>
  <NGridItem span={1} mdSpan={4}>
    <NGrid cols={2} gap="8px">
      <div>1</div>
      <div>2</div>
      <div>3</div>
      <div>4</div>
    </NGrid>
  </NGridItem>
</NGrid>`}
      >
        <NGrid cols={1} mdCols={12}>
          <NGridItem span={1} mdSpan={8}><Box label="Hero" color="bg-primary/15 text-primary" /></NGridItem>
          <NGridItem span={1} mdSpan={4}>
            <NGrid cols={2} gap="8px">
              <Box label="1" color="bg-rose-500/15 text-rose-400" />
              <Box label="2" color="bg-amber-500/15 text-amber-400" />
              <Box label="3" color="bg-emerald-500/15 text-emerald-400" />
              <Box label="4" color="bg-sky-500/15 text-sky-400" />
            </NGrid>
          </NGridItem>
        </NGrid>
      </Example>

      <Example
        title="Nested grid — grid inside a grid item"
        description="An outer 2-col grid holds two panels, each containing its own 2-col grid."
        center={false}
        code={`<NGrid cols={1} mdCols={2}>
  <NGridItem span={1}>
    <NGrid cols={2} gap="8px">
      <div>A1</div>
      <div>A2</div>
      <div>A3</div>
      <div>A4</div>
    </NGrid>
  </NGridItem>
  <NGridItem span={1}>
    <NGrid cols={2} gap="8px">
      <div>B1</div>
      <div>B2</div>
      <div>B3</div>
      <div>B4</div>
    </NGrid>
  </NGridItem>
</NGrid>`}
      >
        <NGrid cols={1} mdCols={2}>
          <NGridItem span={1}>
            <NGrid cols={2} gap="8px">
              <Box label="A1" color="bg-rose-500/15 text-rose-400" />
              <Box label="A2" color="bg-amber-500/15 text-amber-400" />
              <Box label="A3" color="bg-emerald-500/15 text-emerald-400" />
              <Box label="A4" color="bg-sky-500/15 text-sky-400" />
            </NGrid>
          </NGridItem>
          <NGridItem span={1}>
            <NGrid cols={2} gap="8px">
              <Box label="B1" color="bg-violet-500/15 text-violet-400" />
              <Box label="B2" color="bg-fuchsia-500/15 text-fuchsia-400" />
              <Box label="B3" color="bg-teal-500/15 text-teal-400" />
              <Box label="B4" color="bg-indigo-500/15 text-indigo-400" />
            </NGrid>
          </NGridItem>
        </NGrid>
      </Example>

      <Example
        title="Responsive reflow — different spans at every breakpoint"
        description="Each item shifts span as the viewport grows: 12 on mobile → 6 at sm → 3 at md → 2 at lg → 1 at xl."
        center={false}
        code={`<NGrid cols={12}>
  <NGridItem span={12} smSpan={6} mdSpan={3} lgSpan={2} xlSpan={1}><div>1</div></NGridItem>
  <NGridItem span={12} smSpan={6} mdSpan={3} lgSpan={2} xlSpan={1}><div>2</div></NGridItem>
  <NGridItem span={12} smSpan={6} mdSpan={3} lgSpan={2} xlSpan={1}><div>3</div></NGridItem>
  <NGridItem span={12} smSpan={6} mdSpan={3} lgSpan={2} xlSpan={1}><div>4</div></NGridItem>
  <NGridItem span={12} smSpan={6} mdSpan={3} lgSpan={2} xlSpan={1}><div>5</div></NGridItem>
  <NGridItem span={12} smSpan={6} mdSpan={3} lgSpan={2} xlSpan={1}><div>6</div></NGridItem>
</NGrid>`}
      >
        <NGrid cols={12}>
          <NGridItem span={12} smSpan={6} mdSpan={3} lgSpan={2} xlSpan={1}><Box label="1" color="bg-rose-500/15 text-rose-400" /></NGridItem>
          <NGridItem span={12} smSpan={6} mdSpan={3} lgSpan={2} xlSpan={1}><Box label="2" color="bg-amber-500/15 text-amber-400" /></NGridItem>
          <NGridItem span={12} smSpan={6} mdSpan={3} lgSpan={2} xlSpan={1}><Box label="3" color="bg-emerald-500/15 text-emerald-400" /></NGridItem>
          <NGridItem span={12} smSpan={6} mdSpan={3} lgSpan={2} xlSpan={1}><Box label="4" color="bg-sky-500/15 text-sky-400" /></NGridItem>
          <NGridItem span={12} smSpan={6} mdSpan={3} lgSpan={2} xlSpan={1}><Box label="5" color="bg-violet-500/15 text-violet-400" /></NGridItem>
          <NGridItem span={12} smSpan={6} mdSpan={3} lgSpan={2} xlSpan={1}><Box label="6" color="bg-fuchsia-500/15 text-fuchsia-400" /></NGridItem>
        </NGrid>
      </Example>

      <Example
        title="Asymmetric stack — wide top + trio below"
        description="A wide banner (span 12) followed by three equal cells (span 4 each)."
        center={false}
        code={`<NGrid cols={1} mdCols={12}>
  <NGridItem span={1} mdSpan={12}><div>Banner</div></NGridItem>
  <NGridItem span={1} mdSpan={4}><div>One</div></NGridItem>
  <NGridItem span={1} mdSpan={4}><div>Two</div></NGridItem>
  <NGridItem span={1} mdSpan={4}><div>Three</div></NGridItem>
</NGrid>`}
      >
        <NGrid cols={1} mdCols={12}>
          <NGridItem span={1} mdSpan={12}><Box label="Banner" color="bg-primary/15 text-primary" /></NGridItem>
          <NGridItem span={1} mdSpan={4}><Box label="One" color="bg-rose-500/15 text-rose-400" /></NGridItem>
          <NGridItem span={1} mdSpan={4}><Box label="Two" color="bg-amber-500/15 text-amber-400" /></NGridItem>
          <NGridItem span={1} mdSpan={4}><Box label="Three" color="bg-emerald-500/15 text-emerald-400" /></NGridItem>
        </NGrid>
      </Example>

      <Example
        title="Custom gap override"
        description="Pass a gap string to override the theme sectionGap. Here gap='4px' tightens the spacing."
        center={false}
        code={`<NGrid cols={3} gap="4px">
  <div>A</div>
  <div>B</div>
  <div>C</div>
</NGrid>`}
      >
        <NGrid cols={3} gap="4px">
          <Box label="A" color="bg-rose-500/15 text-rose-400" />
          <Box label="B" color="bg-amber-500/15 text-amber-400" />
          <Box label="C" color="bg-emerald-500/15 text-emerald-400" />
        </NGrid>
      </Example>

      <Example
        title="As section element"
        description="Use the as prop to render as a semantic <section> or <ul> instead of a div."
        center={false}
        code={`<NGrid as="section" cols={2} lgCols={3}>
  <div>A</div>
  <div>B</div>
  <div>C</div>
</NGrid>`}
      >
        <NGrid as="section" cols={2} lgCols={3}>
          <Box label="A" color="bg-sky-500/15 text-sky-400" />
          <Box label="B" color="bg-violet-500/15 text-violet-400" />
          <Box label="C" color="bg-fuchsia-500/15 text-fuchsia-400" />
        </NGrid>
      </Example>
    </ComponentPage>
  );
}
