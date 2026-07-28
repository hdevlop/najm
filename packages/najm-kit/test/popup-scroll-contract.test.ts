import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

function source(relativePath: string) {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
}

describe("popup smart-scroll contract", () => {
  test("cmdk lists enhance their real option viewport", () => {
    const command = source("../src/components/ui/command.tsx");

    expect(command).toContain("useNajmScrollViewport<HTMLDivElement>()");
    expect(command).toContain('data-slot="command-list-viewport"');
    expect(command).not.toContain("najm-overlay-scroll-y");
  });

  test("selects preserve the Radix viewport and enhance it with NajmScroll", () => {
    const select = source("../src/components/ui/select.tsx");

    expect(select).toContain("useNajmScrollViewport<HTMLDivElement>()");
    expect(select).toContain("ref={viewportRef}");
  });

  test("dropdown menus and submenus use smart-scroll viewports", () => {
    const dropdown = source("../src/components/ui/dropdown-menu.tsx");

    expect(dropdown.match(/useNajmScrollViewport<HTMLDivElement>\(\)/g)).toHaveLength(2);
    expect(dropdown.match(/ref=\{viewportRef\}/g)).toHaveLength(2);
  });

  test("both combobox implementations and multi-select avoid hidden native scrollbars", () => {
    const combobox = source("../src/components/ui/combobox.tsx");
    const comboboxInput = source("../src/components/inputs/ComboboxInput.tsx");
    const multiSelect = source("../src/components/inputs/MultiSelectInput.tsx");

    expect(combobox).toContain('<NajmScroll className="max-h-64">');
    expect(comboboxInput).toContain("<CommandList>");
    expect(multiSelect).toContain("<CommandList>");
    expect(`${combobox}\n${comboboxInput}\n${multiSelect}`).not.toContain("najm-overlay-scroll-y");
  });
});
