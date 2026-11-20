import React from "react";
import { describe, expect, test } from "bun:test";
import { fireEvent, render } from "@testing-library/react";
import { Settings } from "lucide-react";

import { NSheet } from "../src/components/Dialog";

describe("NSheet responsive spacing", () => {
  test("uses one responsive padding rhythm for header, body, and footer", () => {
    const { getByRole } = render(
      <NSheet
        footer={<button type="button">Save</button>}
        icon={Settings}
        onOpenChange={() => undefined}
        open
        title="Settings"
      >
        <p>Sheet body</p>
      </NSheet>,
    );

    const sheet = getByRole("dialog");
    expect(sheet.className).toContain("gap-0");
    expect(sheet.className).toContain("bg-background");
    expect(sheet.className).not.toContain("bg-sidebar");
    expect(sheet.querySelector('[data-slot="sheet-header"] svg')).toBeDefined();
    const sections = [
      sheet.querySelector('[data-slot="sheet-header"]'),
      sheet.querySelector('[data-slot="sheet-body"]'),
      sheet.querySelector('[data-slot="sheet-footer"]'),
    ];

    for (const section of sections) {
      expect(section?.className).toContain("px-3");
      expect(section?.className).toContain("py-3");
      expect(section?.className).toContain("xl:px-4");
      expect(section?.className).toContain("2xl:px-4");
    }
  });

  test("exposes typed content, header, body, and footer class slots", () => {
    const { getByRole } = render(
      <NSheet
        classNames={{
          content: "custom-content",
          header: "custom-header",
          body: "custom-body",
          footer: "custom-footer",
        }}
        footer={<button type="button">Save</button>}
        icon={Settings}
        onOpenChange={() => undefined}
        open
        title="Settings"
      >
        <p>Sheet body</p>
      </NSheet>,
    );

    const sheet = getByRole("dialog");
    expect(sheet.className).toContain("custom-content");
    expect(sheet.querySelector('[data-slot="sheet-header"]')?.className).toContain("custom-header");
    expect(sheet.querySelector('[data-slot="sheet-body"]')?.className).toContain("custom-body");
    expect(sheet.querySelector('[data-slot="sheet-footer"]')?.className).toContain("custom-footer");
  });

  test("closes from one header button in the title row, never the bare corner icon", () => {
    let open = true;
    const { getByRole } = render(
      <NSheet icon={Settings} onOpenChange={(next) => { open = next; }} open title="Settings">
        <p>Sheet body</p>
      </NSheet>,
    );

    const sheet = getByRole("dialog");
    const header = sheet.querySelector('[data-slot="sheet-header"]');
    const closes = Array.from(sheet.querySelectorAll("button")).filter((button) => button.getAttribute("aria-label") === "Close");
    expect(closes).toHaveLength(1);
    expect(header?.contains(closes[0])).toBe(true);
    expect(closes[0].className).toContain("text-destructive");
    expect(closes[0].className).toContain("size-9");
    fireEvent.click(closes[0]);
    expect(open).toBe(false);
  });
});
