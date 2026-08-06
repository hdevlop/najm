"use client";

import {
  Baby,
  ClipboardCheck,
  HandCoins,
  HeartHandshake,
  LayoutDashboard,
  PackageSearch,
  ShoppingBag,
  Tags,
  UsersRound,
} from "lucide-react";
import {
  NajmScroll,
  NPageHeader,
  NSidebar,
  NSidebarProvider,
  useNSidebar,
  type NavItem,
} from "najm-kit";
import { useState } from "react";

const navItems: NavItem[] = [
  { id: "overview", href: "#overview", label: "Overview", icon: LayoutDashboard },
  {
    id: "families",
    href: "#families",
    label: "Families",
    icon: UsersRound,
    sectionLabel: "People",
    sectionIcon: HeartHandshake,
  },
  { id: "children", href: "#children", label: "Children", icon: Baby },
  {
    id: "contributions",
    href: "#contributions",
    label: "Contributions",
    icon: HandCoins,
    sectionLabel: "Finance",
    sectionIcon: HandCoins,
  },
  {
    id: "categories",
    href: "#categories",
    label: "Categories",
    icon: Tags,
    sectionLabel: "Catalog",
    sectionIcon: PackageSearch,
  },
  { id: "products", href: "#products", label: "Products", icon: ShoppingBag },
  { id: "orders", href: "#orders", label: "Orders", icon: ClipboardCheck },
];

/**
 * Reads the sidebar from a distance — nothing is threaded down as a prop. This
 * is the position a real page's header sits in, several levels below the shell.
 */
function StateReadout() {
  const sidebar = useNSidebar();

  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-2 rounded-lg border border-border bg-card p-4 text-sm">
      <dt className="text-muted-foreground">collapsed</dt>
      <dd className="font-mono">{String(sidebar?.collapsed)}</dd>
      <dt className="text-muted-foreground">mobileOpen</dt>
      <dd className="font-mono">{String(sidebar?.mobileOpen)}</dd>
      <dt className="text-muted-foreground">mobileBreakpoint</dt>
      <dd className="font-mono">{sidebar?.mobileBreakpoint}</dd>
      <dt className="text-muted-foreground">context found</dt>
      <dd className="font-mono">{String(sidebar !== null)}</dd>
    </dl>
  );
}

function DemoBody() {
  return (
    <div className="flex flex-col gap-6 p-6">
      {/*
        No onSidebarOpen and no mobileBreakpoint are passed. Both come from the
        surrounding NSidebarProvider, which is the whole point of the change:
        below `lg` the hamburger appears here and opens the drawer.
      */}
      <NPageHeader
        icon={LayoutDashboard}
        title="Sidebar context"
        subtitle="The header wires its own mobile trigger from context"
        card
      />

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Context state
        </h2>
        <StateReadout />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          What to check
        </h2>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
          <li>
            Drag or click the right-hand rail. <code>collapsed</code> flips above
            and the logo swaps to its compact mark — the render prop is driven by
            the sidebar&apos;s own resolved state, not by CSS breakpoints.
          </li>
          <li>
            Resize to 1024–1279px. <code>autoCollapseAt=&quot;lg&quot;</code>{" "}
            collapses the rail and the logo follows, which the old
            class-arithmetic approach could only approximate.
          </li>
          <li>
            Resize below 1024px. The header grows a hamburger with no{" "}
            <code>onSidebarOpen</code> prop anywhere; opening the drawer shows the
            full logo, because the mobile drawer always renders expanded.
          </li>
        </ol>
      </section>

      <div className="h-[60vh] rounded-lg border border-dashed border-border" />
    </div>
  );
}

export default function SidebarContextPage() {
  const [strictLogo, setStrictLogo] = useState(true);

  return (
    <NSidebarProvider mobileBreakpoint="lg">
      <div className="flex h-screen w-full overflow-hidden bg-background">
        <NSidebar
          navItems={navItems}
          activePath="#overview"
          mobileBreakpoint="lg"
          autoCollapseAt="lg"
          showHamburgerButton={false}
          logo={
            strictLogo
              ? ({ collapsed, isMobile }) =>
                collapsed && !isMobile ? (
                  <span className="grid size-8 place-items-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
                    N
                  </span>
                ) : (
                  <span className="mx-auto flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground">
                    NAJM KIT
                  </span>
                )
              : undefined
          }
          footer={
            <button
              type="button"
              onClick={() => setStrictLogo((prev) => !prev)}
              className="w-full rounded-md px-2 py-1.5 text-left text-xs text-sidebar-foreground/70 hover:bg-sidebar-accent"
            >
              logo: {strictLogo ? "render prop" : "none"}
            </button>
          }
        />

        <div className="flex h-full min-h-0 w-full flex-col">
          <NajmScroll axis="y" className="min-h-0 flex-1">
            <DemoBody />
          </NajmScroll>
        </div>
      </div>
    </NSidebarProvider>
  );
}
