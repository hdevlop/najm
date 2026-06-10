import { describe, test, expect } from "bun:test";
import React from "react";
import { render } from "@testing-library/react";

import { NajmThemeProvider } from "../src/theme/provider";
import { NCard } from "../src/components/Card/Card";
import { TextInput } from "../src/components/inputs/TextInput";
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

describe("appearance.borderDegree", () => {
  test("NCard inside strong provider uses border-border-strong", () => {
    const { container } = render(
      <NajmThemeProvider appearance={{ borderDegree: "strong" }}>
        <NCard title="x" />
      </NajmThemeProvider>
    );
    const card = container.querySelector("[data-slot=card]") as HTMLElement;
    expect(card).toBeTruthy();
    expect(card.getAttribute("data-border-degree")).toBe("strong");
    expect(card.className).toContain("border-border-strong");
  });

  test("NCard borderDegree subtle overrides global strong", () => {
    const { container } = render(
      <NajmThemeProvider appearance={{ borderDegree: "strong" }}>
        <NCard title="x" borderDegree="subtle" />
      </NajmThemeProvider>
    );
    const card = container.querySelector("[data-slot=card]") as HTMLElement;
    expect(card.getAttribute("data-border-degree")).toBe("subtle");
    expect(card.className).toContain("border-border-subtle");
    expect(card.className).not.toContain("border-border-strong");
  });

  test("NCard bordered still maps to strong", () => {
    const { container } = render(
      <NCard title="x" bordered />
    );
    const card = container.querySelector("[data-slot=card]") as HTMLElement;
    expect(card.getAttribute("data-border-degree")).toBe("strong");
  });

  test("NCard bordered={false} bypasses global strong", () => {
    const { container } = render(
      <NajmThemeProvider appearance={{ borderDegree: "strong" }}>
        <NCard title="x" bordered={false} />
      </NajmThemeProvider>
    );
    const card = container.querySelector("[data-slot=card]") as HTMLElement;
    expect(card.getAttribute("data-border-degree")).toBe("default");
    expect(card.className).toContain("border-border");
    expect(card.className).not.toContain("border-border-strong");
  });

  test("BaseInput inherits global strong", () => {
    const { container } = render(
      <NajmThemeProvider appearance={{ borderDegree: "strong" }}>
        <BaseInput>x</BaseInput>
      </NajmThemeProvider>
    );
    const wrapper = container.querySelector("[data-border-degree]") as HTMLElement;
    expect(wrapper.getAttribute("data-border-degree")).toBe("strong");
    expect(wrapper.className).toContain("border-border-strong");
  });

  test("BaseInput borderColor wins over global strong", () => {
    const { container } = render(
      <NajmThemeProvider appearance={{ borderDegree: "strong" }}>
        <BaseInput borderColor="primary">x</BaseInput>
      </NajmThemeProvider>
    );
    const wrapper = container.querySelector("[data-border-degree]") as HTMLElement;
    expect(wrapper.getAttribute("data-border-degree")).toBe("strong");
    expect(wrapper.className).toContain("border-primary");
    expect(wrapper.className).not.toContain("border-border-strong");
  });

  test("BaseInput status=error wins over degree", () => {
    const { container } = render(
      <NajmThemeProvider appearance={{ borderDegree: "strong" }}>
        <BaseInput status="error">x</BaseInput>
      </NajmThemeProvider>
    );
    const wrapper = container.querySelector("[data-border-degree]") as HTMLElement;
    expect(wrapper.className).toContain("border-red-600");
  });

  test("TextInput inherits global strong", () => {
    const { container } = render(
      <NajmThemeProvider appearance={{ borderDegree: "strong" }}>
        <TextInput value="" onChange={() => {}} />
      </NajmThemeProvider>
    );
    const wrapper = container.querySelector("[data-border-degree]") as HTMLElement;
    expect(wrapper.getAttribute("data-border-degree")).toBe("strong");
    expect(wrapper.className).toContain("border-border-strong");
  });

  test("TextInput borderDegree=default overrides global strong", () => {
    const { container } = render(
      <NajmThemeProvider appearance={{ borderDegree: "strong" }}>
        <TextInput value="" onChange={() => {}} borderDegree="default" />
      </NajmThemeProvider>
    );
    const wrapper = container.querySelector("[data-border-degree]") as HTMLElement;
    expect(wrapper.getAttribute("data-border-degree")).toBe("default");
    expect(wrapper.className).toContain("border-input");
    expect(wrapper.className).not.toContain("border-border-strong");
  });

  test("NSidebar desktop and mobile inherit global strong", () => {
    const { container } = render(
      <NajmThemeProvider appearance={{ borderDegree: "strong" }}>
        <NSidebar navItems={navItems} mobileOpen />
      </NajmThemeProvider>
    );
    const asides = Array.from(container.querySelectorAll("aside"));
    const desktop = asides.find((a) => a.className.includes("md:flex")) as HTMLElement;
    const mobile = asides.find((a) => a.className.includes("md:hidden")) as HTMLElement;
    expect(desktop.getAttribute("data-border-degree")).toBe("strong");
    expect(desktop.className).toContain("border-r");
    expect(desktop.className).toContain("border-border-strong");
    expect(mobile.getAttribute("data-border-degree")).toBe("strong");
    expect(mobile.className).toContain("border-border-strong");
  });

  test("NSidebar borderDegree=none uses border-transparent", () => {
    const { container } = render(
      <NSidebar navItems={navItems} borderDegree="none" />
    );
    const asides = Array.from(container.querySelectorAll("aside"));
    const desktop = asides.find((a) => a.className.includes("md:flex")) as HTMLElement;
    expect(desktop.getAttribute("data-border-degree")).toBe("none");
    expect(desktop.className).toContain("border-transparent");
  });

  test("Nested providers merge appearance", () => {
    const { container } = render(
      <NajmThemeProvider appearance={{ borderDegree: "strong" }}>
        <NajmThemeProvider appearance={{ borderDegree: "subtle" }}>
          <NCard title="x" />
        </NajmThemeProvider>
      </NajmThemeProvider>
    );
    const card = container.querySelector("[data-slot=card]") as HTMLElement;
    expect(card.getAttribute("data-border-degree")).toBe("subtle");
  });

  test("Nested appearance-only provider does not reset theme tokens", () => {
    const { container } = render(
      <NajmThemeProvider mode="dark">
        <NajmThemeProvider appearance={{ borderDegree: "strong" }}>
          <NCard title="x" />
        </NajmThemeProvider>
      </NajmThemeProvider>
    );

    const providers = container.querySelectorAll("[data-najm-theme]");
    const innerProvider = providers[1] as HTMLElement;
    expect(innerProvider.getAttribute("style") ?? "").not.toContain("--najm-background");

    const card = container.querySelector("[data-slot=card]") as HTMLElement;
    expect(card.getAttribute("data-border-degree")).toBe("strong");
  });

  test("NForm fields inherit global strong", () => {
    const { container } = render(
      <NajmThemeProvider appearance={{ borderDegree: "strong" }}>
        <NForm onSubmit={() => {}} as="div">
          <FormInput name="name" type="text" />
        </NForm>
      </NajmThemeProvider>
    );

    const input = container.querySelector("[data-border-degree]") as HTMLElement;
    expect(input.getAttribute("data-border-degree")).toBe("strong");
    expect(input.className).toContain("border-border-strong");
  });

  test("NTable shell inherits global strong", () => {
    const { container } = render(
      <NajmThemeProvider appearance={{ borderDegree: "strong" }}>
        <div style={{ height: 400 }}>
          <NTable
            data={[{ id: "1", name: "Alice" }]}
            columns={[{ accessorKey: "name", header: "Name" }]}
            showPagination={false}
            showViewToggle={false}
            showAddButton={false}
            showCheckbox={false}
            dynamicHeight={false}
          />
        </div>
      </NajmThemeProvider>
    );

    const shell = container.querySelector("[data-ntable-body] [data-border-degree]") as HTMLElement;
    expect(shell.getAttribute("data-border-degree")).toBe("strong");
    expect(shell.className).toContain("border-border-strong");
  });

  test("outline Button inherits global strong", () => {
    const { container } = render(
      <NajmThemeProvider appearance={{ borderDegree: "strong" }}>
        <Button variant="outline">Save</Button>
      </NajmThemeProvider>
    );

    const button = container.querySelector("button") as HTMLElement;
    expect(button.getAttribute("data-border-degree")).toBe("strong");
    expect(button.className).toContain("border-border-strong");
  });

  test("NPageHeader bordered uses a full strong border", () => {
    const { container } = render(
      <NPageHeader bordered borderDegree="strong" icon={TestIcon} title="Dashboard" />
    );

    const header = container.querySelector("[data-slot=page-header]") as HTMLElement;
    expect(header.getAttribute("data-border-degree")).toBe("strong");
    expect(header.classList.contains("border")).toBe(true);
    expect(header.className).toContain("border-border-strong");
  });

  test("NPageHeader inherits global strong as a full border", () => {
    const { container } = render(
      <NajmThemeProvider appearance={{ borderDegree: "strong" }}>
        <NPageHeader icon={TestIcon} title="Dashboard" />
      </NajmThemeProvider>
    );

    const header = container.querySelector("[data-slot=page-header]") as HTMLElement;
    expect(header.getAttribute("data-border-degree")).toBe("strong");
    expect(header.classList.contains("border")).toBe(true);
    expect(header.className).toContain("border-border-strong");
  });

  test("filled Button with explicit borderDegree shows a degree border", () => {
    const { container } = render(<Button borderDegree="strong">Save</Button>);
    const button = container.querySelector("button") as HTMLElement;
    expect(button.getAttribute("data-border-degree")).toBe("strong");
    expect(button.className).toContain("border");
    expect(button.className).toContain("border-border-strong");
  });

  test("Dialog content inherits global strong", () => {
    render(
      <NajmThemeProvider appearance={{ borderDegree: "strong" }}>
        <Dialog open>
          <DialogContent aria-describedby={undefined}>
            <DialogTitle>Border dialog</DialogTitle>
            Dialog body
          </DialogContent>
        </Dialog>
      </NajmThemeProvider>
    );

    const content = document.body.querySelector("[data-slot=dialog-content]") as HTMLElement;
    expect(content.className).toContain("border-border-strong");
  });
});
