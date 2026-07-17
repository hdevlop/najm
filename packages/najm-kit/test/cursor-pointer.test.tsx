import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const selectSource = readFileSync(
  fileURLToPath(new URL("../src/components/ui/select.tsx", import.meta.url)),
  "utf8",
);
const dropdownSource = readFileSync(
  fileURLToPath(new URL("../src/components/ui/dropdown-menu.tsx", import.meta.url)),
  "utf8",
);
const commandSource = readFileSync(
  fileURLToPath(new URL("../src/components/ui/command.tsx", import.meta.url)),
  "utf8",
);
const tabsSource = readFileSync(
  fileURLToPath(new URL("../src/components/ui/tabs.tsx", import.meta.url)),
  "utf8",
);

function blockAfter(source: string, marker: RegExp, end: RegExp): string {
  const m = source.match(marker);
  if (!m || m.index === undefined) return "";
  const start = m.index;
  const rest = source.slice(start);
  const endMatch = rest.match(end);
  return endMatch && endMatch.index !== undefined ? rest.slice(0, endMatch.index) : rest;
}

describe("dropdown option cursor classes", () => {
  test("DropdownMenuItem uses cursor-pointer, not cursor-default", () => {
    const block = blockAfter(
      dropdownSource,
      /function DropdownMenuItem\b/,
      /function DropdownMenuCheckboxItem\b/,
    );
    expect(block).toContain("cursor-pointer");
    expect(block).not.toContain("cursor-default");
  });

  test("DropdownMenuItem is non-interactive when disabled", () => {
    const block = blockAfter(
      dropdownSource,
      /function DropdownMenuItem\b/,
      /function DropdownMenuCheckboxItem\b/,
    );
    expect(block).toContain("cursor-not-allowed");
    expect(block).toContain("data-[disabled]:pointer-events-none");
  });

  test("DropdownMenuCheckboxItem uses cursor-pointer", () => {
    const block = blockAfter(
      dropdownSource,
      /function DropdownMenuCheckboxItem\b/,
      /function DropdownMenuRadioItem\b/,
    );
    expect(block).toContain("cursor-pointer");
    expect(block).toContain("cursor-not-allowed");
    expect(block).not.toContain("cursor-default");
  });

  test("DropdownMenuRadioItem uses cursor-pointer", () => {
    const block = blockAfter(
      dropdownSource,
      /function DropdownMenuRadioItem\b/,
      /function DropdownMenuLabel\b/,
    );
    expect(block).toContain("cursor-pointer");
    expect(block).toContain("cursor-not-allowed");
    expect(block).not.toContain("cursor-default");
  });

  test("DropdownMenuSubTrigger uses cursor-pointer", () => {
    const block = blockAfter(
      dropdownSource,
      /function DropdownMenuSubTrigger\b/,
      /function DropdownMenuSubContent\b/,
    );
    expect(block).toContain("cursor-pointer");
    expect(block).not.toContain("cursor-default");
  });
});

describe("select option cursor classes", () => {
  test("SelectContent uses the popover surface by default", () => {
    const block = blockAfter(
      selectSource,
      /function SelectContent\b/,
      /function SelectLabel\b/,
    );
    expect(block).toContain("bg-popover");
    expect(block).toContain("text-popover-foreground");
    expect(block).not.toMatch(/\brounded-md border\b/);
  });

  test("SelectItem uses cursor-pointer, not cursor-default", () => {
    const block = blockAfter(
      selectSource,
      /function SelectItem\b/,
      /function SelectSeparator\b/,
    );
    expect(block).toContain("cursor-pointer");
    expect(block).not.toContain("cursor-default");
  });

  test("SelectItem is non-interactive when disabled", () => {
    const block = blockAfter(
      selectSource,
      /function SelectItem\b/,
      /function SelectSeparator\b/,
    );
    expect(block).toContain("cursor-not-allowed");
    expect(block).toContain("data-[disabled]:pointer-events-none");
  });

  test("Select scroll buttons remain cursor-default (not interactive)", () => {
    const upBlock = blockAfter(
      selectSource,
      /function SelectScrollUpButton\b/,
      /function SelectScrollDownButton\b/,
    );
    expect(upBlock).toContain("cursor-default");
  });
});

describe("tabs trigger cursor classes", () => {
  test("TabsTrigger uses cursor-pointer, not cursor-default", () => {
    const block = blockAfter(tabsSource, /function TabsTrigger\b/, /function TabsContent\b/);
    expect(block).toContain("cursor-pointer");
    expect(block).not.toContain("cursor-default");
  });

  test("TabsTrigger is non-interactive when disabled", () => {
    const block = blockAfter(tabsSource, /function TabsTrigger\b/, /function TabsContent\b/);
    expect(block).toContain("disabled:pointer-events-none");
  });
});

describe("command option cursor classes", () => {
  test("CommandItem uses cursor-pointer, not cursor-default", () => {
    const block = blockAfter(
      commandSource,
      /function CommandItem\b/,
      /function CommandShortcut\b/,
    );
    expect(block).toContain("cursor-pointer");
    expect(block).not.toContain("cursor-default");
  });

  test("CommandItem is non-interactive when disabled", () => {
    const block = blockAfter(
      commandSource,
      /function CommandItem\b/,
      /function CommandShortcut\b/,
    );
    expect(block).toContain("cursor-not-allowed");
    expect(block).toContain("data-[disabled=true]:pointer-events-none");
  });
});
