import { describe, test, expect, mock } from "bun:test";
import React from "react";
import { render, act, fireEvent, waitFor } from "@testing-library/react";
import { NSidebar } from "../src/components/sidebar/NSidebar";
import { NSidebarItem } from "../src/components/sidebar/NSidebarItem";
import type { NavItem } from "../src/components/sidebar/types";

function FakeIcon({ className }: { className?: string }) {
  return <svg className={className} data-testid="fake-icon" />;
}

const FakeForwardRefIcon = React.forwardRef<SVGSVGElement, { className?: string }>(
  function FakeForwardRefIcon({ className }, ref) {
    return <svg ref={ref} className={className} data-testid="fake-forward-ref-icon" />;
  }
);

function FakeLink({ href, className, children, onClick }: any) {
  return (
    <a href={href} className={className} onClick={onClick} data-testid="fake-link">
      {children}
    </a>
  );
}

describe("SidebarItem", () => {
  test("renders label and icon", () => {
    const item: NavItem = { id: "home", label: "Home", href: "/home" };
    const { container } = render(<NSidebarItem item={item} activePath="/home" />);
    expect(container.textContent).toContain("Home");
  });

  test("applies active class when activePath matches href", () => {
    const item: NavItem = { id: "home", label: "Home", href: "/home" };
    const { container } = render(<NSidebarItem item={item} activePath="/home" />);
    const btn = container.querySelector("button");
    expect(btn?.className).toContain("bg-sidebar-primary");
  });

  test("renders LinkComponent when href + linkComponent provided", () => {
    const item: NavItem = { id: "home", label: "Home", href: "/home" };
    const { container } = render(
      <NSidebarItem item={item} activePath="/home" linkComponent={FakeLink} />
    );
    const link = container.querySelector("[data-testid='fake-link']");
    expect(link).toBeTruthy();
    expect(link?.getAttribute("href")).toBe("/home");
  });

  test("calls onNavigate when LinkComponent is clicked", () => {
    const item: NavItem = { id: "home", label: "Home", href: "/home" };
    const onNavigate = mock(() => {});
    const { container } = render(
      <NSidebarItem item={item} activePath="" onNavigate={onNavigate} linkComponent={FakeLink} />
    );
    const link = container.querySelector("[data-testid='fake-link']") as HTMLAnchorElement;
    link.click();
    expect(onNavigate).toHaveBeenCalledWith("/home");
  });

  test("does not call onNavigate when disabled LinkComponent is clicked", () => {
    const item: NavItem = { id: "home", label: "Home", href: "/home", disabled: true };
    const onNavigate = mock(() => {});
    const { container } = render(
      <NSidebarItem item={item} activePath="" onNavigate={onNavigate} linkComponent={FakeLink} />
    );
    const link = container.querySelector("[data-testid='fake-link']") as HTMLAnchorElement;
    link.click();
    expect(onNavigate).not.toHaveBeenCalled();
  });

  test("prevents default navigation when disabled LinkComponent is clicked", () => {
    const item: NavItem = { id: "home", label: "Home", href: "/home", disabled: true };
    const { container } = render(
      <NSidebarItem item={item} activePath="" linkComponent={FakeLink} />
    );
    const link = container.querySelector("[data-testid='fake-link']") as HTMLAnchorElement;
    expect(fireEvent.click(link)).toBe(false);
  });

  test("calls onNavigate when button (no LinkComponent) is clicked", () => {
    const item: NavItem = { id: "home", label: "Home", href: "/home" };
    const onNavigate = mock(() => {});
    const { container } = render(
      <NSidebarItem item={item} activePath="" onNavigate={onNavigate} />
    );
    const btn = container.querySelector("button") as HTMLButtonElement;
    btn.click();
    expect(onNavigate).toHaveBeenCalledWith("/home");
  });

  test("renders nested children when clicked", () => {
    const item: NavItem = {
      id: "analytics",
      label: "Analytics",
      children: [
        { id: "overview", label: "Overview", href: "/analytics/overview" },
      ],
    };
    const { container } = render(<NSidebarItem item={item} activePath="" />);
    expect(container.textContent).not.toContain("Overview");
    const btn = container.querySelector("button") as HTMLButtonElement;
    act(() => btn.click());
    expect(container.textContent).toContain("Overview");
  });
});

describe("Sidebar", () => {
  const navItems: NavItem[] = [
    { id: "dashboard", label: "Dashboard", sectionLabel: "Main", sectionIcon: FakeIcon },
    { id: "tools", label: "Tools" },
  ];

  test("root <aside> uses sidebar surface tokens", () => {
    const { container } = render(<NSidebar navItems={navItems} mobileOpen />);
    const asides = Array.from(container.querySelectorAll("aside"));
    const desktop = asides.find((a) => a.className.includes("md:flex")) as HTMLElement;
    const mobile = asides.find((a) => a.className.includes("md:hidden")) as HTMLElement;

    expect(desktop.className).toContain("bg-sidebar");
    expect(desktop.className).toContain("text-sidebar-foreground");
    expect(mobile.className).toContain("bg-sidebar");
    expect(mobile.className).toContain("text-sidebar-foreground");
  });

  test.each([
    ["sm", "sm:flex", "sm:hidden"],
    ["md", "md:flex", "md:hidden"],
    ["lg", "lg:flex", "lg:hidden"],
  ] as const)(
    "keeps the desktop sidebar hidden below the %s breakpoint",
    (mobileBreakpoint, desktopVisibleClass, mobileHiddenClass) => {
      const { container } = render(
        <NSidebar
          navItems={navItems}
          mobileBreakpoint={mobileBreakpoint}
          mobileOpen
        />
      );
      const asides = Array.from(container.querySelectorAll("aside"));
      const desktop = asides.find((aside) => aside.className.includes(desktopVisibleClass)) as HTMLElement;
      const mobile = asides.find((aside) => aside.className.includes(mobileHiddenClass)) as HTMLElement;

      expect(desktop.className.split(" ")).toContain("hidden");
      expect(desktop.className).toContain(desktopVisibleClass);
      expect(mobile.className).toContain(mobileHiddenClass);
    }
  );

  test("hamburger trigger uses sidebar surface tokens", () => {
    const { container } = render(<NSidebar navItems={navItems} mobileOpen showHamburgerButton />);
    const hamburger = container.querySelector("button[aria-label='Open sidebar']") as HTMLButtonElement;
    expect(hamburger).toBeTruthy();
    expect(hamburger.className).toContain("bg-sidebar");
    expect(hamburger.className).toContain("border-sidebar-border");
  });

  test("does not render the legacy floating hamburger by default", () => {
    const { container } = render(<NSidebar navItems={navItems} />);
    expect(container.querySelector("button[aria-label='Open sidebar']")).toBeNull();
  });

  test("active item uses sidebar-primary background", () => {
    const { container } = render(
      <NSidebar navItems={navItems} activePath="dashboard" />
    );
    const active = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Dashboard")
    ) as HTMLElement;
    expect(active).toBeTruthy();
    expect(active.className).toContain("bg-sidebar-primary");
    expect(active.className).toContain("text-sidebar-primary-foreground");
  });

  test("can hide section labels", () => {
    const { container } = render(<NSidebar navItems={navItems} showSectionLabels={false} />);
    expect(container.textContent).not.toContain("Main");
    expect(container.textContent).toContain("Dashboard");
  });

  test("can hide section icons", () => {
    const { container } = render(<NSidebar navItems={navItems} showSectionIcons={false} />);
    expect(container.textContent).toContain("Main");
    expect(container.querySelector("[data-testid='fake-icon']")).toBeNull();
  });

  test("can show section separators", () => {
    const separatedItems: NavItem[] = [
      { id: "dashboard", label: "Dashboard", sectionLabel: "Main", sectionIcon: FakeIcon },
      { id: "tools", label: "Tools", sectionLabel: "Tools" },
    ];
    const { container } = render(<NSidebar navItems={separatedItems} showSectionSeparators />);
    const sections = Array.from(container.querySelectorAll("[data-sidebar-section]"));
    expect(sections[0]?.className).not.toContain("border-t");
    expect(sections[1]?.className).toContain("border-t");
  });

  test("keeps unlabeled items in the previous section group", () => {
    const { container } = render(<NSidebar navItems={navItems} showSectionSeparators />);
    expect(container.querySelectorAll("[data-sidebar-section]").length).toBe(2);
  });

  test("renders forwardRef logo icons as components", () => {
    const { container } = render(
      <NSidebar logo={{ variant: "chip", expanded: <FakeForwardRefIcon />, title: "Studio" }} />
    );
    expect(container.querySelector("[data-testid='fake-forward-ref-icon']")).toBeTruthy();
    expect(container.textContent).toContain("Studio");
  });

  test("centers logo and nav icons in collapsed rail with spacing-aware offsets", () => {
    const { container } = render(
      <NSidebar
        navItems={navItems}
        logo={{ variant: "chip", expanded: <FakeIcon />, title: "Studio" }}
        collapsed
      />
    );
    const desktopSidebar = Array.from(container.querySelectorAll("aside")).find((aside) =>
      aside.className.includes("md:flex")
    ) as HTMLElement;
    const header = desktopSidebar.querySelector("div") as HTMLElement;
    const navItem = Array.from(desktopSidebar.querySelectorAll("button")).find((button) =>
      button.className.includes("bg-sidebar-primary") || button.className.includes("text-sidebar-foreground")
    ) as HTMLElement;
    const logoBox = header.querySelector(".size-8") as HTMLElement;

    expect(header.className).toContain("justify-start");
    expect(desktopSidebar.getAttribute("style") ?? "").toContain("--sidebar-edge-width");
    // The collapsed box is 32px, so it centres inside the rail's px-4 header on
    // its own rather than needing the margin offset the old chip required.
    expect(logoBox).toBeTruthy();
    expect(logoBox.className).not.toContain("ml-[calc(");
    expect(navItem.className).toContain("var(--spacing");
    expect(navItem.className).not.toContain("justify-center");
  });

  test("centers built-in footer actions with the same collapsed rail inset", () => {
    const { container } = render(
      <NSidebar navItems={navItems} collapsed collapseButtonPosition="footer" onSettings={() => {}} />
    );
    const desktopSidebar = Array.from(container.querySelectorAll("aside")).find((aside) =>
      aside.className.includes("md:flex")
    ) as HTMLElement;
    const settingsButton = desktopSidebar.querySelector("button[aria-label='Settings']") as HTMLButtonElement;
    const collapseButton = desktopSidebar.querySelector("button[aria-label='Expand']") as HTMLButtonElement;
    const navItem = desktopSidebar.querySelector("nav button") as HTMLButtonElement;

    expect(settingsButton.className).toContain("var(--rail,4rem)");
    expect(settingsButton.className).toContain("var(--sidebar-edge-width,0px)");
    expect(collapseButton.className).toContain("var(--rail,4rem)");
    expect(navItem.className).toContain("var(--rail,4rem)");
  });

  test("passes the resolved desktop and mobile state to a custom footer", () => {
    const { container } = render(
      <NSidebar
        navItems={navItems}
        collapsed
        mobileOpen
        footer={({ collapsed, isMobile }) => (
          <span data-testid={isMobile ? "mobile-footer-state" : "desktop-footer-state"}>
            {collapsed ? "collapsed" : "expanded"}
          </span>
        )}
      />
    );

    expect(container.querySelector("[data-testid='desktop-footer-state']")?.textContent).toBe("collapsed");
    expect(container.querySelector("[data-testid='mobile-footer-state']")?.textContent).toBe("expanded");
  });

  test("collapses from the sidebar header button", () => {
    const { container } = render(<NSidebar navItems={navItems} logo={{ title: "Studio" }} />);
    const desktopSidebar = Array.from(container.querySelectorAll("aside")).find((aside) =>
      aside.className.includes("md:flex")
    ) as HTMLElement;
    expect(desktopSidebar.style.width).toBe("240px");

    const button = container.querySelector("button[aria-label='Collapse']") as HTMLButtonElement;
    fireEvent.click(button);

    expect(desktopSidebar.style.width).toBe("64px");
  });

  test("notifies controlled collapsed changes from the sidebar header button", () => {
    const onCollapsedChange = mock(() => {});
    const { container } = render(
      <NSidebar
        navItems={navItems}
        collapsed={false}
        onCollapsedChange={onCollapsedChange}
      />
    );

    const button = container.querySelector("button[aria-label='Collapse']") as HTMLButtonElement;
    fireEvent.click(button);

    expect(onCollapsedChange).toHaveBeenCalledWith(true);
  });

  test("applies custom expanded, collapsed, and mobile widths", () => {
    const { container } = render(
      <NSidebar
        navItems={navItems}
        widths={{ expanded: 280, collapsed: 72, mobile: 320 }}
        mobileOpen
      />
    );
    const asides = Array.from(container.querySelectorAll("aside"));
    const desktop = asides.find((a) => a.className.includes("md:flex")) as HTMLElement;
    const mobile = asides.find((a) => a.className.includes("md:hidden")) as HTMLElement;
    expect(desktop.style.width).toBe("280px");
    expect(mobile.style.width).toBe("320px");
  });

  test("applies bordered styling to desktop and mobile sidebars", () => {
    const { container } = render(
      <NSidebar navItems={navItems} bordered mobileOpen />
    );
    const asides = Array.from(container.querySelectorAll("aside"));
    const desktop = asides.find((a) => a.className.includes("md:flex")) as HTMLElement;
    const mobile = asides.find((a) => a.className.includes("md:hidden")) as HTMLElement;

    expect(desktop.className).toContain("najm-border-e");
    expect(desktop.className).toContain("border-sidebar-border");
    expect(mobile.className).toContain("najm-border-e");
    expect(mobile.className).toContain("border-sidebar-border");
  });

  test("mobile width falls back to expanded width when not provided", () => {
    const { container } = render(
      <NSidebar
        navItems={navItems}
        widths={{ expanded: 300 }}
        mobileOpen
      />
    );
    const asides = Array.from(container.querySelectorAll("aside"));
    const mobile = asides.find((a) => a.className.includes("md:hidden")) as HTMLElement;
    expect(mobile.style.width).toBe("300px");
  });

  test("resolves responsive widths at the active breakpoint", async () => {
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: query === "(min-width: 1024px)",
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => true,
    })) as typeof window.matchMedia;

    try {
      const { container } = render(
        <NSidebar
          navItems={navItems}
          widths={{
            expanded: { base: 164, lg: 200 },
            collapsed: { base: 64, lg: 72 },
            mobile: { base: 288, lg: 320 },
          }}
          mobileOpen
        />,
      );
      const asides = Array.from(container.querySelectorAll("aside"));
      const desktop = asides.find((aside) => aside.className.includes("md:flex")) as HTMLElement;
      const mobile = asides.find((aside) => aside.className.includes("md:hidden")) as HTMLElement;

      await waitFor(() => expect(desktop.style.width).toBe("200px"));
      expect(mobile.style.width).toBe("320px");
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });

  test("automatically uses the collapsed rail in the selected breakpoint band", async () => {
    const originalMatchMedia = window.matchMedia;
    const queries: string[] = [];
    window.matchMedia = ((query: string) => {
      queries.push(query);
      return {
        matches: true,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => true,
      };
    }) as typeof window.matchMedia;

    try {
      const { container } = render(
        <NSidebar
          navItems={navItems}
          mobileBreakpoint="lg"
          autoCollapseAt="lg"
          widths={{ expanded: 280, collapsed: 72 }}
        />
      );
      const asides = Array.from(container.querySelectorAll("aside"));
      const desktop = asides.find((aside) => aside.className.includes("lg:flex")) as HTMLElement;
      const mobile = asides.find((aside) => aside.className.includes("lg:hidden")) as HTMLElement;

      await waitFor(() => expect(desktop.getAttribute("data-auto-collapsed")).toBe("true"));
      expect(queries).toContain("(min-width: 1024px) and (max-width: 1279.98px)");
      expect(desktop.style.width).toBe("72px");
      expect(mobile.style.width).toBe("280px");
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });

  test("passes automatic collapse to the desktop footer render prop", async () => {
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: query === "(min-width: 1024px) and (max-width: 1279.98px)",
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => true,
    })) as typeof window.matchMedia;

    try {
      const { container } = render(
        <NSidebar
          navItems={navItems}
          autoCollapseAt="lg"
          footer={({ collapsed, isMobile }) => (
            <span data-testid={isMobile ? "mobile-auto-footer" : "desktop-auto-footer"}>
              {collapsed ? "collapsed" : "expanded"}
            </span>
          )}
        />
      );

      await waitFor(() => {
        expect(container.querySelector("[data-testid='desktop-auto-footer']")?.textContent).toBe("collapsed");
      });
      expect(container.querySelector("[data-testid='mobile-auto-footer']")?.textContent).toBe("expanded");
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });
});
