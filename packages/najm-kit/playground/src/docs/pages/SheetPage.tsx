import React, { useState } from 'react';
import {
  NButton,
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetClose,
} from 'najm-kit';
import { ComponentPage } from '../ComponentPage';
import { Example } from '../Example';
import { Bell, Filter, LayoutDashboard, Settings, ShoppingCart, SlidersHorizontal } from 'lucide-react';

export function SheetPage() {
  const [cartOpen, setCartOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);

  return (
    <ComponentPage
      title="Sheet"
      description="A panel that slides in from the edge of the screen. Ideal for settings, filters, navigation, and detail views without leaving the page."
      category="Overlays"
    >
      <Example
        title="Basic sheet"
        description="Slides in from the right by default."
        code={`<Sheet>
  <SheetTrigger asChild>
    <NButton variant="outline"><Settings size={16} /> Open settings</NButton>
  </SheetTrigger>
  <SheetContent>
    <SheetHeader>
      <SheetTitle>Settings</SheetTitle>
      <SheetDescription>Manage your account preferences.</SheetDescription>
    </SheetHeader>
    <div className="py-6 text-sm text-muted-foreground">
      Settings content here.
    </div>
  </SheetContent>
</Sheet>`}
      >
        <Sheet>
          <SheetTrigger asChild>
            <NButton variant="outline"><Settings size={16} /> Open settings</NButton>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Settings</SheetTitle>
              <SheetDescription>Manage your account preferences.</SheetDescription>
            </SheetHeader>
            <div className="py-6 text-sm text-muted-foreground">
              Settings content goes here.
            </div>
          </SheetContent>
        </Sheet>
      </Example>

      <Example
        title="All sides"
        description="Use the side prop to control which edge the sheet enters from."
        code={`<Sheet>
  <SheetTrigger asChild>
    <NButton variant="outline">Right</NButton>
  </SheetTrigger>
  <SheetContent side="right">...</SheetContent>
</Sheet>

<Sheet>
  <SheetTrigger asChild>
    <NButton variant="outline">Left</NButton>
  </SheetTrigger>
  <SheetContent side="left">...</SheetContent>
</Sheet>

<Sheet>
  <SheetTrigger asChild>
    <NButton variant="outline">Top</NButton>
  </SheetTrigger>
  <SheetContent side="top">...</SheetContent>
</Sheet>

<Sheet>
  <SheetTrigger asChild>
    <NButton variant="outline">Bottom</NButton>
  </SheetTrigger>
  <SheetContent side="bottom">...</SheetContent>
</Sheet>`}
      >
        {(['right', 'left', 'top', 'bottom'] as const).map((side) => (
          <Sheet key={side}>
            <SheetTrigger asChild>
              <NButton variant="outline" size="sm">
                {side.charAt(0).toUpperCase() + side.slice(1)}
              </NButton>
            </SheetTrigger>
            <SheetContent side={side}>
              <SheetHeader>
                <SheetTitle>Sheet from {side}</SheetTitle>
                <SheetDescription>This panel slides in from the {side} edge.</SheetDescription>
              </SheetHeader>
            </SheetContent>
          </Sheet>
        ))}
      </Example>

      <Example
        title="Settings panel"
        description="A realistic settings sheet with sections and a save footer."
        code={`<Sheet>
  <SheetTrigger asChild>
    <NButton variant="outline"><SlidersHorizontal size={16} /> Preferences</NButton>
  </SheetTrigger>
  <SheetContent className="flex flex-col">
    <SheetHeader>
      <SheetTitle>Preferences</SheetTitle>
      <SheetDescription>Customize how the app works for you.</SheetDescription>
    </SheetHeader>
    <div className="flex-1 overflow-y-auto py-6 space-y-6">
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Appearance</p>
        {/* settings items */}
      </div>
    </div>
    <SheetFooter>
      <SheetClose asChild><NButton variant="outline">Discard</NButton></SheetClose>
      <NButton>Save changes</NButton>
    </SheetFooter>
  </SheetContent>
</Sheet>`}
      >
        <Sheet>
          <SheetTrigger asChild>
            <NButton variant="outline"><SlidersHorizontal size={16} /> Preferences</NButton>
          </SheetTrigger>
          <SheetContent className="flex flex-col">
            <SheetHeader>
              <SheetTitle>Preferences</SheetTitle>
              <SheetDescription>Customize how the app works for you.</SheetDescription>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto py-6 space-y-6">
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Appearance</p>
                {['Dark mode', 'Compact sidebar', 'Show avatars'].map((item) => (
                  <div key={item} className="flex items-center justify-between py-1">
                    <span className="text-sm">{item}</span>
                    <div className="h-5 w-9 rounded-full bg-primary/30 relative cursor-pointer">
                      <div className="absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-primary" />
                    </div>
                  </div>
                ))}
              </div>
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Notifications</p>
                {['Email updates', 'Push notifications', 'Weekly digest'].map((item) => (
                  <div key={item} className="flex items-center justify-between py-1">
                    <span className="text-sm">{item}</span>
                    <div className="h-5 w-9 rounded-full bg-secondary relative cursor-pointer">
                      <div className="absolute top-0.5 right-0.5 h-4 w-4 rounded-full bg-muted-foreground/50" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <SheetFooter>
              <SheetClose asChild>
                <NButton variant="outline">Discard</NButton>
              </SheetClose>
              <NButton>Save changes</NButton>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </Example>

      <Example
        title="Filter panel"
        description="A controlled sheet for filtering search results, keeping the trigger in sync with applied filter state."
        code={`const [open, setOpen] = useState(false);

<NButton variant="outline" onClick={() => setOpen(true)}>
  <Filter size={16} /> Filters
</NButton>

<Sheet open={open} onOpenChange={setOpen}>
  <SheetContent side="left">
    <SheetHeader>
      <SheetTitle>Filter results</SheetTitle>
      <SheetDescription>Narrow down results by category, date, or status.</SheetDescription>
    </SheetHeader>
    <div className="py-6 space-y-4">
      {/* filter controls */}
    </div>
    <SheetFooter>
      <NButton variant="outline" onClick={() => setOpen(false)}>Clear all</NButton>
      <NButton onClick={() => setOpen(false)}>Apply filters</NButton>
    </SheetFooter>
  </SheetContent>
</Sheet>`}
      >
        <NButton variant="outline" onClick={() => setFilterOpen(true)}>
          <Filter size={16} /> Filters
        </NButton>
        <Sheet open={filterOpen} onOpenChange={setFilterOpen}>
          <SheetContent side="left" className="flex flex-col">
            <SheetHeader>
              <SheetTitle>Filter results</SheetTitle>
              <SheetDescription>Narrow down results by category, date, or status.</SheetDescription>
            </SheetHeader>
            <div className="flex-1 py-6 space-y-5">
              <div className="space-y-2">
                <p className="text-sm font-medium">Category</p>
                {['Electronics', 'Clothing', 'Books', 'Home & Garden'].map((c) => (
                  <label key={c} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" className="rounded" />
                    {c}
                  </label>
                ))}
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Status</p>
                {['In stock', 'Out of stock', 'Pre-order'].map((s) => (
                  <label key={s} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="radio" name="status" className="rounded-full" />
                    {s}
                  </label>
                ))}
              </div>
            </div>
            <SheetFooter>
              <NButton variant="outline" onClick={() => setFilterOpen(false)}>Clear all</NButton>
              <NButton onClick={() => setFilterOpen(false)}>Apply</NButton>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </Example>

      <Example
        title="Shopping cart"
        description="A right-side cart panel with item list and checkout footer."
        code={`<Sheet>
  <SheetTrigger asChild>
    <NButton><ShoppingCart size={16} /> Cart (3)</NButton>
  </SheetTrigger>
  <SheetContent className="flex flex-col">
    <SheetHeader>
      <SheetTitle>Your cart</SheetTitle>
      <SheetDescription>3 items · $149.00 total</SheetDescription>
    </SheetHeader>
    <div className="flex-1 overflow-y-auto py-4 divide-y divide-border">
      {/* cart items */}
    </div>
    <SheetFooter className="flex-col gap-2">
      <div className="flex justify-between text-sm font-medium">
        <span>Total</span><span>$149.00</span>
      </div>
      <NButton className="w-full">Checkout</NButton>
    </SheetFooter>
  </SheetContent>
</Sheet>`}
      >
        <NButton onClick={() => setCartOpen(true)}>
          <ShoppingCart size={16} /> Cart (3)
        </NButton>
        <Sheet open={cartOpen} onOpenChange={setCartOpen}>
          <SheetContent className="flex flex-col">
            <SheetHeader>
              <SheetTitle>Your cart</SheetTitle>
              <SheetDescription>3 items · $149.00 total</SheetDescription>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto py-4 divide-y divide-border">
              {[
                { name: 'Wireless Headphones', price: '$79.00', qty: 1 },
                { name: 'USB-C Hub', price: '$49.00', qty: 2 },
                { name: 'Screen Cleaner', price: '$12.00', qty: 1 },
              ].map((item) => (
                <div key={item.name} className="flex items-center justify-between py-3 gap-3">
                  <div className="size-10 rounded-md bg-secondary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.name}</p>
                    <p className="text-xs text-muted-foreground">Qty: {item.qty}</p>
                  </div>
                  <span className="text-sm font-medium">{item.price}</span>
                </div>
              ))}
            </div>
            <SheetFooter className="flex-col gap-2 border-t border-border pt-4">
              <div className="flex justify-between text-sm font-semibold">
                <span>Total</span>
                <span>$149.00</span>
              </div>
              <NButton className="w-full" onClick={() => setCartOpen(false)}>Checkout</NButton>
              <NButton variant="outline" className="w-full" onClick={() => setCartOpen(false)}>Continue shopping</NButton>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </Example>

      <Example
        title="Navigation drawer"
        description="A left-side drawer used for mobile navigation or secondary menus."
        code={`<Sheet>
  <SheetTrigger asChild>
    <NButton variant="outline"><LayoutDashboard size={16} /> Navigation</NButton>
  </SheetTrigger>
  <SheetContent side="left">
    <SheetHeader>
      <SheetTitle>Menu</SheetTitle>
    </SheetHeader>
    <nav className="mt-4 space-y-1">
      {navItems.map(item => (
        <NButton key={item} className="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-secondary">
          {item}
        </NButton>
      ))}
    </nav>
  </SheetContent>
</Sheet>`}
      >
        <Sheet>
          <SheetTrigger asChild>
            <NButton variant="outline"><LayoutDashboard size={16} /> Navigation</NButton>
          </SheetTrigger>
          <SheetContent side="left">
            <SheetHeader>
              <SheetTitle>Menu</SheetTitle>
            </SheetHeader>
            <nav className="mt-4 space-y-1">
              {['Dashboard', 'Products', 'Orders', 'Customers', 'Analytics', 'Settings'].map((item) => (
                <NButton
                  key={item}
                  className="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-secondary transition-colors"
                >
                  {item}
                </NButton>
              ))}
            </nav>
          </SheetContent>
        </Sheet>
      </Example>

      <Example
        title="Notification panel"
        description="A top sheet for displaying recent notifications."
        code={`<Sheet>
  <SheetTrigger asChild>
    <NButton variant="outline"><Bell size={16} /> Notifications</NButton>
  </SheetTrigger>
  <SheetContent side="top" className="max-h-96">
    <SheetHeader>
      <SheetTitle>Notifications</SheetTitle>
      <SheetDescription>You have 3 unread notifications.</SheetDescription>
    </SheetHeader>
    <div className="divide-y divide-border mt-2">
      {notifications.map(n => (
        <div key={n.id} className="py-3">...</div>
      ))}
    </div>
  </SheetContent>
</Sheet>`}
      >
        <Sheet>
          <SheetTrigger asChild>
            <NButton variant="outline"><Bell size={16} /> Notifications</NButton>
          </SheetTrigger>
          <SheetContent side="top" className="max-h-96">
            <SheetHeader>
              <SheetTitle>Notifications</SheetTitle>
              <SheetDescription>You have 3 unread notifications.</SheetDescription>
            </SheetHeader>
            <div className="divide-y divide-border mt-2">
              {[
                { title: 'New order received', time: '2 min ago', unread: true },
                { title: 'Server backup completed', time: '1 hr ago', unread: true },
                { title: 'Alice left a comment', time: '3 hr ago', unread: true },
                { title: 'Weekly report ready', time: 'Yesterday', unread: false },
              ].map((n) => (
                <div key={n.title} className="flex items-start gap-3 py-3">
                  {n.unread && <div className="mt-1.5 size-2 rounded-full bg-primary shrink-0" />}
                  {!n.unread && <div className="mt-1.5 size-2 shrink-0" />}
                  <div>
                    <p className="text-sm font-medium">{n.title}</p>
                    <p className="text-xs text-muted-foreground">{n.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </SheetContent>
        </Sheet>
      </Example>
    </ComponentPage>
  );
}
