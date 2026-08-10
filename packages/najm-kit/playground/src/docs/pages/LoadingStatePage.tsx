import React from 'react';
import { NLoadingState, NButton, NSpinner } from 'najm-kit';
import { ComponentPage } from '../ComponentPage';
import { Example } from '../Example';

export function LoadingStatePage() {
  return (
    <ComponentPage
      title="Loading State"
      description="A centered loading indicator with optional label, spinner variant selection, and full-screen overlay mode."
      category="Feedback"
    >
      <Example
        title="Basic loading state"
        description="Default loading state with a circle spinner and a label."
        center={false}
        code={`import { NLoadingState } from 'najm-kit';

<NLoadingState label="Loading data..." />`}
      >
        <div className="w-full border rounded-xl overflow-hidden">
          <NLoadingState label="Loading data..." />
        </div>
      </Example>

      <Example
        title="Spinner variants"
        description="Choose any spinner variant to match your visual style."
        center={false}
        previewHeight="h-[340px]"
        code={`<NLoadingState label="Loading..." spinnerVariant="default" />
<NLoadingState label="Fetching..." spinnerVariant="circle" />
<NLoadingState label="Syncing..." spinnerVariant="pinwheel" />
<NLoadingState label="Processing..." spinnerVariant="ellipsis" />
<NLoadingState label="Almost there..." spinnerVariant="ring" />
<NLoadingState label="Working..." spinnerVariant="bars" />`}
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full">
          <div className="border rounded-xl overflow-hidden">
            <NLoadingState label="Loading..." spinnerVariant="default" />
          </div>
          <div className="border rounded-xl overflow-hidden">
            <NLoadingState label="Fetching..." spinnerVariant="circle" />
          </div>
          <div className="border rounded-xl overflow-hidden">
            <NLoadingState label="Syncing..." spinnerVariant="pinwheel" />
          </div>
        </div>
      </Example>

      <Example
        title="Without label"
        description="Omit the label prop for a minimal spinner-only state."
        center={false}
        code={`<NLoadingState />`}
      >
        <div className="w-full border rounded-xl overflow-hidden">
          <NLoadingState />
        </div>
      </Example>

      <Example
        title="Custom label"
        description="Provide a descriptive label that explains what is loading."
        center={false}
        previewHeight="h-[280px]"
        code={`<NLoadingState label="Fetching users..." />
<NLoadingState label="Generating report..." spinnerVariant="ellipsis" />
<NLoadingState label="Uploading files..." spinnerVariant="bars" />`}
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full">
          <div className="border rounded-xl overflow-hidden">
            <NLoadingState label="Fetching users..." />
          </div>
          <div className="border rounded-xl overflow-hidden">
            <NLoadingState label="Generating report..." spinnerVariant="ellipsis" />
          </div>
          <div className="border rounded-xl overflow-hidden">
            <NLoadingState label="Uploading files..." spinnerVariant="bars" />
          </div>
        </div>
      </Example>

      <Example
        title="Full-screen loading"
        description="Set fullScreen to overlay the entire viewport. Useful during app initialization or route transitions."
        center={false}
        code={`<NLoadingState label="Loading app..." fullScreen />`}
      >
        <div className="w-full flex justify-center">
          <div className="relative border rounded-xl overflow-hidden h-48 w-full">
            <div className="absolute inset-0 bg-background/50 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
              <NSpinner variant="circle" size={32} />
              <p className="text-muted-foreground text-sm">Loading app... (fullScreen preview)</p>
            </div>
            <div className="p-4 space-y-2 opacity-30">
              <div className="h-3 w-3/4 rounded bg-muted" />
              <div className="h-3 w-1/2 rounded bg-muted" />
              <div className="h-3 w-2/3 rounded bg-muted" />
            </div>
          </div>
        </div>
      </Example>

      <Example
        title="Inside a card"
        description="Use loading state as the content of a card while data is being fetched."
        center={false}
        code={`<Card>
  <CardHeader>
    <CardTitle>Recent orders</CardTitle>
  </CardHeader>
  <CardContent>
    <NLoadingState label="Loading orders..." />
  </CardContent>
</Card>`}
      >
        <div className="w-full max-w-sm mx-auto">
          <div className="rounded-xl border border-border overflow-hidden">
            <div className="px-6 py-4 border-b border-border">
              <h3 className="font-semibold text-sm">Recent orders</h3>
            </div>
            <NLoadingState label="Loading orders..." />
          </div>
        </div>
      </Example>

      <Example
        title="TanStack Query pattern"
        description="Combine with useDelayedLoading to avoid flash-of-spinner on fast networks."
        center={false}
        code={`import { useQuery } from '@tanstack/react-query';
import { useDelayedLoading } from 'najm-kit';
import { NLoadingState, NTableSkeleton } from 'najm-kit';

function ProductList() {
  const { data, isLoading } = useQuery({
    queryKey: ['products'],
    queryFn: fetchProducts,
  });

  const showSpinner = useDelayedLoading(300);

  if (isLoading && showSpinner) {
    return <NLoadingState label="Loading products..." />;
  }

  if (isLoading) {
    return <NTableSkeleton rows={5} columns={4} />;
  }

  return <ProductTable data={data} />;
}`}
      >
        <div className="w-full border rounded-xl overflow-hidden">
          <NLoadingState label="Loading products..." spinnerVariant="ring" />
        </div>
      </Example>

      <Example
        title="Surface: panel (table body, dialog, sheet)"
        description={`Use surface="panel" when the loading state lives inside a card, dialog, sheet, or table body. No page gutter, no landmark.`}
        center={false}
        code={`<NLoadingState surface="panel" label="Loading orders..." />`}
      >
        <div className="w-full border rounded-xl overflow-hidden h-64">
          <NLoadingState surface="panel" label="Loading orders..." />
        </div>
      </Example>

      <Example
        title="Surface: page (full route state)"
        description={`Use surface="page" for actual route-level states. Uses page spacing from the design config, but renders through a non-<main> root so it never nests another landmark.`}
        center={false}
        code={`<NLoadingState surface="page" label="Loading dashboard..." />`}
      >
        <div className="w-full border rounded-xl overflow-hidden">
          <NLoadingState surface="page" label="Loading dashboard..." />
        </div>
      </Example>
    </ComponentPage>
  );
}
