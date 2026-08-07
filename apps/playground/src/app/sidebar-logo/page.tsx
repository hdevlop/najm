"use client";

import { Baby, HandCoins, LayoutDashboard, ShoppingBag, UsersRound } from "lucide-react";
import { NPageHeader, NSidebar, NSidebarProvider, useNSidebar, type NavItem, type SidebarLogo } from "najm-kit";
import { useState } from "react";

const navItems: NavItem[] = [
  { id: "overview", href: "#overview", label: "Overview", icon: LayoutDashboard },
  { id: "families", href: "#families", label: "Families", icon: UsersRound },
  { id: "children", href: "#children", label: "Children", icon: Baby },
  { id: "contributions", href: "#contributions", label: "Contributions", icon: HandCoins },
  { id: "products", href: "#products", label: "Products", icon: ShoppingBag },
];

const svg = (body: string, w: number, h: number) =>
  `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">${body}</svg>`)}`;

// 2.6:1 wordmark and a square mark — the same ratios as real branding assets,
// so the fixed boxes get exercised with letterboxing in both directions.
const WORDMARK = svg(
  `<rect width="260" height="100" rx="12" fill="#4f46e5"/><text x="130" y="62" font-family="system-ui" font-size="34" font-weight="700" fill="#fff" text-anchor="middle">NAJM KIT</text>`,
  260,
  100,
);
const MARK = svg(
  `<rect width="100" height="100" rx="20" fill="#4f46e5"/><text x="50" y="68" font-family="system-ui" font-size="56" font-weight="700" fill="#fff" text-anchor="middle">N</text>`,
  100,
  100,
);
const TALL = svg(
  `<rect width="100" height="260" rx="12" fill="#0d9488"/><text x="50" y="140" font-family="system-ui" font-size="40" font-weight="700" fill="#fff" text-anchor="middle">T</text>`,
  100,
  260,
);

const CASES: Record<string, { label: string; note: string; logo: SidebarLogo }> = {
  strings: {
    label: "src strings",
    note: "Both slots are plain strings. The kit renders them through NImage and owns the box, the fit and the collapsed switch.",
    logo: { expanded: WORDMARK, collapsed: MARK, alt: "Najm Kit" },
  },
  fallbackOnly: {
    label: "expanded only",
    note: "No collapsed slot. The expanded asset is reused inside the collapsed box — object-contain letterboxes it rather than cropping.",
    logo: { expanded: WORDMARK, alt: "Najm Kit" },
  },
  broken: {
    label: "broken src → fallback",
    note: "expanded points at a 404. NImage's onError swaps in `fallback`, which is the behaviour worth keeping from an app-level branding wrapper.",
    logo: { expanded: "/does-not-exist.webp", collapsed: MARK, fallback: WORDMARK, alt: "Najm Kit" },
  },
  text: {
    label: "mark + title",
    note: "title/subtitle alongside the mark. Text suppresses the auto-centring and hides itself when collapsed.",
    logo: { expanded: MARK, collapsed: MARK, title: "Najm Kit", subtitle: "Design system", alt: "Najm Kit" },
  },
  tall: {
    label: "portrait asset",
    note: "A 1:2.6 asset in the same fixed boxes — proves the box never distorts to the source ratio.",
    logo: { expanded: TALL, collapsed: TALL, alt: "Tall" },
  },
  linked: {
    label: "href",
    note: "An href wraps the whole mark in the sidebar's linkComponent (or a plain anchor when none is given).",
    logo: { expanded: WORDMARK, collapsed: MARK, href: "#overview", alt: "Najm Kit" },
  },
  node: {
    label: "ReactNode slots",
    note: "Escape hatch: pass elements instead of strings. They land in the same boxes, so a framework <Image> still gets kit sizing.",
    logo: {
      expanded: <span className="grid h-full w-full place-items-center rounded-lg bg-emerald-600 text-sm font-bold text-white">NODE</span>,
      collapsed: <span className="grid h-full w-full place-items-center rounded-lg bg-emerald-600 text-sm font-bold text-white">N</span>,
    },
  },
};

type CaseKey = keyof typeof CASES;

function Readout({ activeCase }: { activeCase: CaseKey }) {
  const sidebar = useNSidebar();
  const entry = CASES[activeCase];

  return (
    <div className="flex flex-col gap-4">
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 rounded-lg border border-border bg-card p-4 text-sm">
        <dt className="text-muted-foreground">case</dt>
        <dd className="font-mono">{entry.label}</dd>
        <dt className="text-muted-foreground">collapsed</dt>
        <dd className="font-mono">{String(sidebar?.collapsed)}</dd>
        <dt className="text-muted-foreground">mobileOpen</dt>
        <dd className="font-mono">{String(sidebar?.mobileOpen)}</dd>
      </dl>
      <p className="text-sm text-muted-foreground">{entry.note}</p>
      <pre className="overflow-x-auto rounded-lg border border-border bg-muted/40 p-4 text-xs">
        {`logo={${JSON.stringify(
          Object.fromEntries(
            Object.entries(entry.logo).map(([k, v]) => [
              k,
              typeof v === "string" ? (v.startsWith("data:") ? `<${k} asset>` : v) : "<ReactNode>",
            ]),
          ),
          null,
          2,
        )}}`}
      </pre>
    </div>
  );
}

export default function SidebarLogoPage() {
  const [activeCase, setActiveCase] = useState<CaseKey>("strings");

  return (
    <NSidebarProvider mobileBreakpoint="lg">
      <div className="flex h-screen w-full overflow-hidden bg-background">
        <NSidebar
          navItems={navItems}
          activePath="#overview"
          mobileBreakpoint="lg"
          autoCollapseAt="lg"
          showHamburgerButton={false}
          logo={CASES[activeCase].logo}
        />

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="flex flex-col gap-6 p-6">
            <NPageHeader
              icon={LayoutDashboard}
              title="Sidebar logo object"
              subtitle="The kit owns the box; the app only says which asset"
              card
            />

            <div className="flex flex-wrap gap-2">
              {(Object.keys(CASES) as CaseKey[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveCase(key)}
                  className={`rounded-md border px-3 py-1.5 text-xs transition-colors ${
                    key === activeCase
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border hover:bg-accent"
                  }`}
                >
                  {CASES[key].label}
                </button>
              ))}
            </div>

            <Readout activeCase={activeCase} />

            <section className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">What to check</h2>
              <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
                <li>Every case keeps the mark at 40×128 expanded and 32×32 collapsed. No case passes a width, a height or a class.</li>
                <li>Drag the right-hand rail. The slot swaps on the sidebar&apos;s own resolved state — no consumer ternary, no responsive classes.</li>
                <li>Resize to 1024–1279px. <code>autoCollapseAt=&quot;lg&quot;</code> collapses the rail and the mark follows.</li>
                <li>Resize below 1024px and open the drawer. Mobile always renders the expanded slot.</li>
                <li>On <em>broken src → fallback</em> the wordmark still paints, from <code>fallback</code>, after the 404.</li>
              </ol>
            </section>

            <div className="h-[40vh] rounded-lg border border-dashed border-border" />
          </div>
        </div>
      </div>
    </NSidebarProvider>
  );
}
