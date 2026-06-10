import { describe, test, expect, mock } from "bun:test";
import React from "react";
import { render, act, fireEvent } from "@testing-library/react";
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
    expect(btn?.className).toContain("bg-primary");
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
    const { container } = render(<NSidebar logoIcon={FakeForwardRefIcon} logoTitle="Studio" />);
    expect(container.querySelector("[data-testid='fake-forward-ref-icon']")).toBeTruthy();
    expect(container.textContent).toContain("Studio");
  });

  test("collapses from the sidebar header button", () => {
    const { container } = render(<NSidebar navItems={navItems} logoTitle="Studio" />);
    const desktopSidebar = Array.from(container.querySelectorAll("aside")).find((aside) =>
      aside.className.includes("md:flex")
    ) as HTMLElement;
    expect(desktopSidebar.style.width).toBe("240px");

    const button = container.querySelector("button[aria-label='Collapse sidebar']") as HTMLButtonElement;
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

    const button = container.querySelector("button[aria-label='Collapse sidebar']") as HTMLButtonElement;
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

    expect(desktop.className).toContain("border");
    expect(desktop.className).toContain("border-border-strong");
    expect(mobile.className).toContain("border");
    expect(mobile.className).toContain("border-border-strong");
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
});
