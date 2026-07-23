import { describe, test, expect } from "bun:test";
import React from "react";
import { render } from "@testing-library/react";

import { NajmThemeProvider } from "../src/theme/provider";
import { NajmDesignProvider } from "../src/theme/design-provider";
import { NCard } from "../src/components/Card/Card";
import { TextInput } from "../src/components/inputs/TextInput";
import { TextAreaInput } from "../src/components/inputs/TextAreaInput";
import { NSidebar } from "../src/components/sidebar/NSidebar";
import { BaseInput } from "../src/components/inputs/BaseInput";
import { Button } from "../src/components/Button/Button";
import { Dialog, DialogContent, DialogTitle } from "../src/components/Dialog/Dialog";
import { NForm } from "../src/components/form/NForm";
import { FormInput } from "../src/components/form/FormInput";
import { NTable } from "../src/components/table/NTable";
import { NPageHeader } from "../src/components/layout/NPageHeader";
import type { NavItem } from "../src/components/sidebar/types";

const navItems: NavItem[] = [
  { id: "dashboard", label: "Dashboard" },
];

function TestIcon({ className }: { className?: string }) {
  return <svg className={className} />;
}

describe("appearance.borderWidth", () => {
  test("NCard inside provider with borderWidth='2px' uses najm-border class", () => {
    const { container } = render(
      <NajmThemeProvider appearance={{ borderWidth: "2px" }}>
        <NCard title="x" />
      </NajmThemeProvider>
    );
    const card = container.querySelector("[data-slot=card]") as HTMLElement;
    expect(card).toBeTruthy();
    expect(card.className).toContain("najm-border");
    expect(card.className).toContain("border-border");
  });

  test("NCard bordered={false} removes the border", () => {
    const { container } = render(
      <NajmThemeProvider appearance={{ borderWidth: "2px" }}>
        <NCard title="x" bordered={false} />
      </NajmThemeProvider>
    );
    const card = container.querySelector("[data-slot=card]") as HTMLElement;
    expect(card.getAttribute("data-bordered")).toBe("false");
    expect(card.className).toContain("border-0");
  });

  test("BaseInput status=error wins over degree", () => {
    const { container } = render(
      <NajmThemeProvider appearance={{ borderWidth: "2px" }}>
        <BaseInput status="error">x</BaseInput>
      </NajmThemeProvider>
    );
    const wrapper = container.querySelector("[data-bordered]") as HTMLElement;
    expect(wrapper.className).toContain("border-red-600");
  });

  test("TextInput bordered={false} drops the input border utility", () => {
    const { container } = render(
      <TextInput value="" onChange={() => {}} bordered={false} />
    );
    const wrapper = container.querySelector("[data-bordered]") as HTMLElement;
    expect(wrapper.getAttribute("data-bordered")).toBe("false");
    expect(wrapper.className).toContain("border-0");
  });

  test("TextAreaInput gives the textarea its own row-based minimum height", () => {
    const { container } = render(
      <TextAreaInput value="First line\nSecond line" onChange={() => {}} rows={3} />
    );

    const wrapper = container.querySelector("[data-bordered]") as HTMLElement;
    const textarea = container.querySelector("textarea") as HTMLTextAreaElement;

    expect(wrapper.style.minHeight).toBe("");
    expect(textarea.getAttribute("rows")).toBe("3");
    expect(textarea.style.minHeight).toBe("4.5rem");
    expect(textarea.className).not.toContain("h-full");
  });

  test("NSidebar desktop uses najm-border-r with border-sidebar-border", () => {
    const { container } = render(
      <NSidebar navItems={navItems} mobileOpen />
    );
    const asides = Array.from(container.querySelectorAll("aside"));
    const desktop = asides.find((a) => a.className.includes("md:flex")) as HTMLElement;
    const mobile = asides.find((a) => a.className.includes("md:hidden")) as HTMLElement;
    expect(desktop.className).toContain("najm-border-r");
    expect(desktop.className).toContain("border-sidebar-border");
    expect(mobile.className).toContain("najm-border-r");
    expect(mobile.className).toContain("border-sidebar-border");
  });

  test("Nested providers merge appearance", () => {
    const { container } = render(
      <NajmThemeProvider appearance={{ borderWidth: "3px" }}>
        <NajmThemeProvider appearance={{ borderWidth: "0" }}>
          <NCard title="x" />
        </NajmThemeProvider>
      </NajmThemeProvider>
    );
    const providers = container.querySelectorAll("[data-najm-theme]");
    const innerProvider = providers[1] as HTMLElement;
    expect(innerProvider.getAttribute("style") ?? "").toContain("--border-width: 0");
  });

  test("NForm fields inherit global border width", () => {
    const { container } = render(
      <NajmThemeProvider appearance={{ borderWidth: "2px" }}>
        <NForm onSubmit={() => {}} as="div">
          <FormInput name="name" type="text" />
        </NForm>
      </NajmThemeProvider>
    );

    const input = container.querySelector("[data-bordered]") as HTMLElement;
    expect(input.getAttribute("data-bordered")).toBe("true");
    expect(input.className).toContain("najm-border");
  });

  test("FormInput applies its semantic background prop", () => {
    const { container } = render(
      <NForm onSubmit={() => {}} as="div">
        <FormInput name="name" type="text" background="muted" />
      </NForm>
    );

    const input = container.querySelector("[data-bordered]") as HTMLElement;
    expect(input.className).toContain("!bg-muted");
  });

  test("NTable shell draws a border when bordered", () => {
    const { container } = render(
      <NajmThemeProvider appearance={{ borderWidth: "2px" }}>
        <div style={{ height: 400 }}>
          <NTable
            data={[{ id: "1", name: "Alice" }]}
            columns={[{ accessorKey: "name", header: "Name" }]}
            showPagination={false}
            showViewToggle={false}
            showAddButton={false}
            showCheckbox={false}
            dynamicHeight={false}
            bordered
          />
        </div>
      </NajmThemeProvider>
    );

    const shell = container.querySelector("[data-ntable-body] [data-bordered]") as HTMLElement;
    expect(shell.getAttribute("data-bordered")).toBe("true");
    expect(shell.className).toContain("najm-border");
  });

  test("outline Button keeps an input-style border", () => {
    const { container } = render(
      <Button variant="outline">Save</Button>
    );
    const button = container.querySelector("button") as HTMLElement;
    expect(button.className).toContain("najm-border");
    expect(button.className).toContain("border-input");
  });

  test("NPageHeader card uses a full card border", () => {
    const { container } = render(
      <NPageHeader card icon={TestIcon} title="Dashboard" />
    );
    const header = container.querySelector("[data-slot=page-header]") as HTMLElement;
    expect(header.getAttribute("data-card")).toBe("true");
    expect(header.className).toContain("rounded-xl");
    expect(header.className).toContain("bg-card");
    expect(header.className).toContain("najm-border");
    expect(header.className).toContain("border-border");
  });

  test("NPageHeader bordered remains an alias for card mode", () => {
    const { container } = render(
      <NPageHeader bordered icon={TestIcon} title="Dashboard" />
    );
    const header = container.querySelector("[data-slot=page-header]") as HTMLElement;
    expect(header.getAttribute("data-card")).toBe("true");
    expect(header.getAttribute("data-bordered")).toBe("true");
    expect(header.className).toContain("najm-border");
    expect(header.className).toContain("border-border");
  });

  test("NPageHeader reads card mode from design recipe", () => {
    const { container } = render(
      <NajmDesignProvider
        config={{
          version: 1,
          theme: {},
          components: { pageHeader: { card: true } },
        }}
      >
        <NPageHeader icon={TestIcon} title="Dashboard" />
      </NajmDesignProvider>
    );
    const header = container.querySelector("[data-slot=page-header]") as HTMLElement;
    expect(header.getAttribute("data-card")).toBe("true");
    expect(header.className).toContain("rounded-xl");
    expect(header.className).toContain("bg-card");
  });

  test("filled Button with bordered opt-in shows a muted border", () => {
    const { container } = render(<Button bordered>Save</Button>);
    const button = container.querySelector("button") as HTMLElement;
    expect(button.getAttribute("data-bordered")).toBe("true");
    expect(button.className).toContain("border-muted-foreground");
  });

  test("Dialog content has a default border", () => {
    render(
      <Dialog open>
        <DialogContent aria-describedby={undefined}>
          <DialogTitle>Border dialog</DialogTitle>
          Dialog body
        </DialogContent>
      </Dialog>
    );
    const content = document.body.querySelector("[data-slot=dialog-content]") as HTMLElement;
    expect(content.className).toContain("najm-border");
    expect(content.className).toContain("border-border");
  });
});
