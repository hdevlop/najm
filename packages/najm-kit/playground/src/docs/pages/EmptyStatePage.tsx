import React from 'react';
import { NEmptyState, NButton } from 'najm-kit';
import { Inbox, FileX, Search, Package, Users, ShoppingCart, FolderOpen, Plus, Download, Upload } from 'lucide-react';
import { ComponentPage } from '../ComponentPage';
import { Example } from '../Example';

export function EmptyStatePage() {
  return (
    <ComponentPage
      title="Empty State"
      description="Friendly placeholders when there is no data to display. Guide the user with an icon, message, and optional action button."
      category="Feedback"
    >
      <Example
        title="Basic empty state"
        description="Default empty state with a title and description."
        center={false}
        code={`import { NEmptyState } from 'najm-kit';

<NEmptyState
  title="No items"
  description="Add your first item to get started."
/>`}
      >
        <div className="w-full border rounded-xl overflow-hidden">
          <NEmptyState
            title="No items"
            description="Add your first item to get started."
          />
        </div>
      </Example>

      <Example
        title="With icon"
        description="Pass a Lucide icon component for visual context."
        center={false}
        previewHeight="h-[380px]"
        code={`import { Inbox, FileX, Search, FolderOpen } from 'lucide-react';

<NEmptyState
  title="No messages"
  description="Your inbox is empty."
  icon={Inbox}
/>

<NEmptyState
  title="No files found"
  description="Upload a file to get started."
  icon={FileX}
/>

<NEmptyState
  title="No results"
  description="Try adjusting your search."
  icon={Search}
/>`}
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full">
          <div className="border rounded-xl overflow-hidden">
            <NEmptyState
              title="No messages"
              description="Your inbox is empty."
              icon={Inbox}
            />
          </div>
          <div className="border rounded-xl overflow-hidden">
            <NEmptyState
              title="No files found"
              description="Upload a file to get started."
              icon={FileX}
            />
          </div>
          <div className="border rounded-xl overflow-hidden">
            <NEmptyState
              title="No results"
              description="Try adjusting your search."
              icon={Search}
            />
          </div>
        </div>
      </Example>

      <Example
        title="With action button"
        description="Add an action button to guide the user toward their next step."
        center={false}
        previewHeight="h-[380px]"
        code={`import { NEmptyState, NButton } from 'najm-kit';
import { Inbox, Package, Users, Plus } from 'lucide-react';

<NEmptyState
  title="No items"
  description="Add your first item to get started."
  icon={Inbox}
  action={<NButton size="sm"><Plus /> Add item</NButton>}
/>

<NEmptyState
  title="No products"
  description="Create your first product listing."
  icon={Package}
  action={<NButton size="sm">New product</NButton>}
/>

<NEmptyState
  title="No team members"
  description="Invite people to collaborate."
  icon={Users}
  action={<NButton size="sm" variant="outline">Invite member</NButton>}
/>`}
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full">
          <div className="border rounded-xl overflow-hidden">
            <NEmptyState
              title="No items"
              description="Add your first item to get started."
              icon={Inbox}
              action={
                <NButton size="sm">
                  <Plus /> Add item
                </NButton>
              }
            />
          </div>
          <div className="border rounded-xl overflow-hidden">
            <NEmptyState
              title="No products"
              description="Create your first product listing."
              icon={Package}
              action={<NButton size="sm">New product</NButton>}
            />
          </div>
          <div className="border rounded-xl overflow-hidden">
            <NEmptyState
              title="No team members"
              description="Invite people to collaborate."
              icon={Users}
              action={<NButton size="sm" variant="outline">Invite member</NButton>}
            />
          </div>
        </div>
      </Example>

      <Example
        title="Custom icon element"
        description="Pass any React element as the icon for full customization."
        center={false}
        previewHeight="h-[380px]"
        code={`<NEmptyState
  title="Cart is empty"
  description="Browse products and add items to your cart."
  icon={<ShoppingCart className="h-8 w-8" />}
  action={<NButton size="sm">Browse products</NButton>}
/>`}
      >
        <div className="w-full border rounded-xl overflow-hidden">
          <NEmptyState
            title="Cart is empty"
            description="Browse products and add items to your cart."
            icon={<ShoppingCart className="h-8 w-8" />}
            action={<NButton size="sm">Browse products</NButton>}
          />
        </div>
      </Example>

      <Example
        title="Inside a card"
        description="Use empty state as the content of a card when a section has no data."
        center={false}
        previewHeight="h-[380px]"
        code={`<Card>
  <CardHeader>
    <CardTitle>Documents</CardTitle>
  </CardHeader>
  <CardContent>
    <NEmptyState
      title="No documents"
      description="Upload your first document."
      icon={FolderOpen}
      action={<NButton size="sm"><Upload /> Upload</NButton>}
    />
  </CardContent>
</Card>`}
      >
        <div className="w-full max-w-sm mx-auto">
          <div className="rounded-xl border border-border overflow-hidden">
            <div className="px-6 py-4 border-b border-border">
              <h3 className="font-semibold text-sm">Documents</h3>
            </div>
            <NEmptyState
              title="No documents"
              description="Upload your first document."
              icon={FolderOpen}
              action={
                <NButton size="sm" variant="outline">
                  <Upload /> Upload
                </NButton>
              }
            />
          </div>
        </div>
      </Example>

      <Example
        title="TanStack Query pattern"
        description="Handle the empty data case in your query results."
        center={false}
        previewHeight="h-[380px]"
        code={`import { useQuery } from '@tanstack/react-query';
import { NEmptyState, NButton } from 'najm-kit';
import { Inbox, Plus } from 'lucide-react';

function ProductList() {
  const { data } = useQuery({
    queryKey: ['products'],
    queryFn: fetchProducts,
  });

  if (!data?.length) {
    return (
      <NEmptyState
        title="No products"
        description="Add your first product to get started."
        icon={Inbox}
        action={<NButton size="sm"><Plus /> Add product</NButton>}
      />
    );
  }

  return <ProductTable data={data} />;
}`}
      >
        <div className="w-full border rounded-xl overflow-hidden">
          <NEmptyState
            title="No products"
            description="Add your first product to get started."
            icon={Package}
            action={
              <NButton size="sm">
                <Plus /> Add product
              </NButton>
            }
          />
        </div>
      </Example>

      <Example
        title="Surface: panel (table body, card, dialog)"
        description={`Use surface="panel" for empty bodies inside cards, dialogs, or sheets.`}
        center={false}
        previewHeight="h-[380px]"
        code={`<NEmptyState
  surface="panel"
  title="No orders yet"
  description="Place your first order."
  icon={Inbox}
  action={<NButton size="sm">New order</NButton>}
/>`}
      >
        <div className="w-full border rounded-xl overflow-hidden h-64">
          <NEmptyState
            surface="panel"
            title="No orders yet"
            description="Place your first order."
            icon={Inbox}
            action={<NButton size="sm">New order</NButton>}
          />
        </div>
      </Example>

      <Example
        title="Surface: page (route-level empty state)"
        description={`Use surface="page" for route-level empty states. Renders through a non-<main> root.`}
        center={false}
        previewHeight="h-[380px]"
        code={`<NEmptyState
  surface="page"
  title="No notifications"
          description="You're all caught up."
  icon={Inbox}
/>`}
      >
        <div className="w-full border rounded-xl overflow-hidden">
          <NEmptyState
            surface="page"
            title="No notifications"
            description="You're all caught up."
            icon={Inbox}
          />
        </div>
      </Example>
    </ComponentPage>
  );
}
