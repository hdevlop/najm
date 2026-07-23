import { describe, expect, mock, test } from "bun:test";
import { fireEvent, render } from "@testing-library/react";
import React from "react";
import {
  NPageHeader,
  NPageHeaderActions,
  NPageHeaderCompactActions,
} from "../src/components/layout/NPageHeader";

function TestIcon({ className }: { className?: string }) {
  return <svg className={className} data-testid="page-icon" />;
}

describe("NPageHeader responsive layout", () => {
  test.each([
    ["sm", "sm:flex", "sm:col-start-auto"],
    ["md", "md:flex", "md:col-start-auto"],
    ["lg", "lg:flex", "lg:col-start-auto"],
  ] as const)(
    "centers the identity below the %s breakpoint",
    (mobileBreakpoint, desktopLayoutClass, desktopIdentityClass) => {
      const { container } = render(
        <NPageHeader
          icon={TestIcon}
          title="Families"
          subtitle="Invite accounts and manage support"
          mobileBreakpoint={mobileBreakpoint}
        />
      );
      const main = container.querySelector("[data-slot='page-header-main']") as HTMLElement;
      const identity = container.querySelector("[data-slot='page-header-identity']") as HTMLElement;

      expect(main.className.split(" ")).toContain("grid");
      expect(main.className).toContain(desktopLayoutClass);
      expect(identity.className).toContain("col-start-2");
      expect(identity.className).toContain("justify-self-center");
      expect(identity.className).toContain(desktopIdentityClass);
    }
  );

  test("uses the full actions at every size when compactActions is omitted", () => {
    const { container } = render(
      <NPageHeader
        icon={TestIcon}
        title="Families"
        actions={<button type="button">Add family</button>}
      />
    );
    const fullActions = container.querySelector("[data-slot='page-header-full-actions']") as HTMLElement;

    expect(fullActions.className.split(" ")).toContain("flex");
    expect(fullActions.className.split(" ")).not.toContain("hidden");
    expect(container.querySelector("[data-slot='page-header-compact-actions']")).toBeNull();
  });

  test("renders the sidebar trigger inside the header and hides it at the matching breakpoint", () => {
    const onSidebarOpen = mock(() => {});
    const { container } = render(
      <NPageHeader
        icon={TestIcon}
        title="Families"
        mobileBreakpoint="lg"
        onSidebarOpen={onSidebarOpen}
      />
    );
    const main = container.querySelector("[data-slot='page-header-main']") as HTMLElement;
    const trigger = container.querySelector("[data-slot='page-header-sidebar-trigger']") as HTMLButtonElement;

    expect(main.contains(trigger)).toBe(true);
    expect(trigger.className).toContain("lg:hidden");
    fireEvent.click(trigger);
    expect(onSidebarOpen).toHaveBeenCalledTimes(1);
  });

  test("lets a compact control replace the full actions below the selected breakpoint", () => {
    const { container } = render(
      <NPageHeader
        icon={TestIcon}
        title="Families"
        mobileBreakpoint="lg"
        actions={<button type="button">Add family</button>}
        compactActions={<button type="button">More actions</button>}
      />
    );
    const fullActions = container.querySelector("[data-slot='page-header-full-actions']") as HTMLElement;
    const compactActions = container.querySelector("[data-slot='page-header-compact-actions']") as HTMLElement;

    expect(fullActions.className.split(" ")).toContain("hidden");
    expect(fullActions.className).toContain("lg:flex");
    expect(compactActions.className.split(" ")).toContain("flex");
    expect(compactActions.className).toContain("lg:hidden");
    expect(compactActions.textContent).toContain("More actions");
  });

  test("supports compound slots for both full and compact actions", () => {
    const { container } = render(
      <NPageHeader icon={TestIcon} title="Families">
        <NPageHeaderActions>
          <button type="button">Add family</button>
        </NPageHeaderActions>
        <NPageHeaderCompactActions>
          <button type="button">More actions</button>
        </NPageHeaderCompactActions>
      </NPageHeader>
    );

    expect(container.textContent).toContain("Add family");
    expect(container.textContent).toContain("More actions");
    expect(container.querySelector("[data-slot='page-header-full-actions']")?.className).toContain("md:flex");
    expect(container.querySelector("[data-slot='page-header-compact-actions']")?.className).toContain("md:hidden");
  });
});
