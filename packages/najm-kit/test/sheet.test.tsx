import React from "react";
import { describe, expect, test } from "bun:test";
import { render } from "@testing-library/react";
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
      expect(section?.className).toContain("2xl:px-5");
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
});
