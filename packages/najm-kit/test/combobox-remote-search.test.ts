import { describe, expect, test } from "bun:test";

describe("ComboboxInput remote search contract", () => {
  test("exposes opt-in server filtering and loading without changing the default", async () => {
    const source = await Bun.file(
      new URL("../src/components/inputs/ComboboxInput.tsx", import.meta.url),
    ).text();
    const types = await Bun.file(
      new URL("../src/components/inputs/types.ts", import.meta.url),
    ).text();

    expect(types).toContain("onSearchChange?: (query: string) => void");
    expect(types).toContain("shouldFilter?: boolean");
    expect(types).toContain("loadingMessage?: string");
    expect(source).toContain("shouldFilter = true");
    expect(source).toContain("<Command shouldFilter={shouldFilter}>");
    expect(source).toContain("onSearchChange?.(next)");
    expect(source).toContain("loading ? loadingMessage : emptyMessage");
  });
});
