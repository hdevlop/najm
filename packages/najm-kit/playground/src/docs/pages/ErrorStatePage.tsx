import React from 'react';
import { NErrorState, NButton } from 'najm-kit';
import { AlertTriangle, Wifi, CloudOff, Server, Shield, Search } from 'lucide-react';
import { ComponentPage } from '../ComponentPage';
import { Example } from '../Example';

export function ErrorStatePage() {
  return (
    <ComponentPage
      title="Error State"
      description="Display error feedback with a custom icon, message, and optional retry button. Works for network failures, server errors, permission issues, and more."
      category="Feedback"
    >
      <Example
        title="Basic error state"
        description="Default error state with a generic error icon and retry button."
        center={false}
        code={`import { NErrorState } from 'najm-kit';

<NErrorState
  message="Something went wrong"
  onRetry={() => refetch()}
/>`}
      >
        <div className="w-full border rounded-xl overflow-hidden">
          <NErrorState message="Something went wrong" onRetry={() => alert('retry')} />
        </div>
      </Example>

      <Example
        title="With title and message"
        description="Provide both a title and message for detailed error context."
        center={false}
        code={`<NErrorState
  title="Failed to load dashboard"
  message="The server did not respond in time. Please try again."
  onRetry={() => refetch()}
/>`}
      >
        <div className="w-full border rounded-xl overflow-hidden">
          <NErrorState
            title="Failed to load dashboard"
            message="The server did not respond in time. Please try again."
            onRetry={() => alert('retry')}
          />
        </div>
      </Example>

      <Example
        title="Custom retry label"
        description="Change the retry button text to match the action."
        center={false}
        code={`<NErrorState
  title="Sync failed"
  message="Cloud sync encountered an error."
  retryLabel="Retry sync"
  onRetry={() => sync()}
/>`}
      >
        <div className="w-full border rounded-xl overflow-hidden">
          <NErrorState
            title="Sync failed"
            message="Cloud sync encountered an error."
            retryLabel="Retry sync"
            onRetry={() => alert('sync')}
          />
        </div>
      </Example>

      <Example
        title="Without retry button"
        description="Omit onRetry to show an error message only — useful for non-recoverable errors."
        center={false}
        code={`<NErrorState
  title="Session expired"
  message="Please sign in again to continue."
/>`}
      >
        <div className="w-full border rounded-xl overflow-hidden">
          <NErrorState
            title="Session expired"
            message="Please sign in again to continue."
          />
        </div>
      </Example>

      <Example
        title="Custom icons"
        description="Pass a custom icon for domain-specific errors like network, server, or permission issues."
        center={false}
        previewHeight="h-[340px]"
        code={`import { Wifi, CloudOff, Server, Shield } from 'lucide-react';

<NErrorState
  title="No internet connection"
  message="Check your network and try again."
  icon={<Wifi className="h-10 w-10" />}
  onRetry={() => reconnect()}
/>

<NErrorState
  title="Server error"
  message="Our servers are having issues. Please try again later."
  icon={<Server className="h-10 w-10" />}
  onRetry={() => refetch()}
/>

<NErrorState
  title="Access denied"
  message="You don't have permission to view this resource."
  icon={<Shield className="h-10 w-10" />}
/>`}
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full">
          <div className="border rounded-xl overflow-hidden">
            <NErrorState
              title="No internet"
              message="Check your network and try again."
              icon={<Wifi className="h-10 w-10" />}
              onRetry={() => alert('reconnect')}
            />
          </div>
          <div className="border rounded-xl overflow-hidden">
            <NErrorState
              title="Server error"
              message="Our servers are having issues."
              icon={<Server className="h-10 w-10" />}
              onRetry={() => alert('refetch')}
            />
          </div>
          <div className="border rounded-xl overflow-hidden">
            <NErrorState
              title="Access denied"
              message="You don't have permission."
              icon={<Shield className="h-10 w-10" />}
            />
          </div>
        </div>
      </Example>

      <Example
        title="Inside a card"
        description="Use error state as the content of a card when a section fails to load."
        center={false}
        code={`<Card>
  <CardHeader>
    <CardTitle>Analytics</CardTitle>
  </CardHeader>
  <CardContent>
    <NErrorState
      message="Failed to load analytics data"
      onRetry={() => refetch()}
    />
  </CardContent>
</Card>`}
      >
        <div className="w-full max-w-sm mx-auto">
          <div className="rounded-xl border border-border overflow-hidden">
            <div className="px-6 py-4 border-b border-border">
              <h3 className="font-semibold text-sm">Analytics</h3>
            </div>
            <NErrorState
              message="Failed to load analytics data"
              onRetry={() => alert('retry')}
            />
          </div>
        </div>
      </Example>

      <Example
        title="TanStack Query pattern"
        description="Integrate with TanStack Query isError state for automatic error display."
        center={false}
        code={`import { useQuery } from '@tanstack/react-query';
import { NErrorState } from 'najm-kit';

function ProductList() {
  const { data, isError, error, refetch } = useQuery({
    queryKey: ['products'],
    queryFn: fetchProducts,
  });

  if (isError) {
    return (
      <NErrorState
        title="Failed to load products"
        message={error.message}
        onRetry={() => refetch()}
      />
    );
  }

  return <ProductTable data={data} />;
}`}
      >
        <div className="w-full border rounded-xl overflow-hidden">
          <NErrorState
            title="Failed to load products"
            message="Network request failed with status 500."
            icon={<CloudOff className="h-10 w-10" />}
            retryLabel="Reload"
            onRetry={() => alert('refetch')}
          />
        </div>
      </Example>

      <Example
        title="Surface: panel (inside a card or dialog)"
        description={`Use surface="panel" for errors inside a card body, dialog, or sheet. No page gutter, no landmark.`}
        center={false}
        code={`<NErrorState
  surface="panel"
  title="Failed to load orders"
  message="The server did not respond in time."
  onRetry={() => refetch()}
/>`}
      >
        <div className="w-full border rounded-xl overflow-hidden h-64">
          <NErrorState
            surface="panel"
            title="Failed to load orders"
            message="The server did not respond in time."
            onRetry={() => alert('refetch')}
          />
        </div>
      </Example>

      <Example
        title="Surface: page (route-level error)"
        description={`Use surface="page" for a route-level error state. Renders through a non-<main> root.`}
        center={false}
        code={`<NErrorState
  surface="page"
  title="Dashboard unavailable"
  message="We are working on it."
  onRetry={() => refetch()}
/>`}
      >
        <div className="w-full border rounded-xl overflow-hidden">
          <NErrorState
            surface="page"
            title="Dashboard unavailable"
            message="We are working on it."
            onRetry={() => alert('refetch')}
          />
        </div>
      </Example>
    </ComponentPage>
  );
}
