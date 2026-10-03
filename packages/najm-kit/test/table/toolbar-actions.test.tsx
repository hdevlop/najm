import { describe, expect, mock, test } from "bun:test";
import React from "react";
import { fireEvent, render } from "@testing-library/react";
import { NTable } from "../../src/components/table/NTable";
import { NTableDefaultsProvider } from "../../src/components/table/TableDefaults";

const data = [{ id: "1", name: "Alice" }];
const columns = [{ accessorKey: "name", header: "Name" }];
const base = { data, columns, dynamicHeight: false, showPagination: false, showViewToggle: false, showCheckbox: false };
const menuLabels = (container: HTMLElement) => Array.from(container.querySelectorAll('[data-context-menu] [role="menuitem"]')).map(item => item.textContent?.trim());

describe("NTable toolbar actions", () => {
  test("individual flags enable default actions without callbacks or dataActions", () => {
    const { container, rerender, getByRole } = render(<NTable {...base} showImportButton />);
    expect(container.querySelector('[aria-label="Export"]')).toBeNull();
    expect(container.querySelector('[aria-label="Print"]')).toBeNull();
    expect(container.querySelectorAll('[aria-label="Import"]')).toHaveLength(2);
    fireEvent.contextMenu(container.querySelector('thead th')!);
    expect(menuLabels(container)).toEqual(["Import"]);
    fireEvent.click(container.querySelector('[role="menuitem"]')!);
    expect(getByRole("dialog").textContent).toContain("CSV or JSON");
    fireEvent.click(getByRole("button", { name: "Cancel" }));
    rerender(<NTable {...base} showExportButton />);
    fireEvent.contextMenu(container.querySelector('thead th')!);
    expect(menuLabels(container)).toEqual(["Export"]);
    rerender(<NTable {...base} showPrintButton />);
    fireEvent.contextMenu(container.querySelector('thead th')!);
    expect(menuLabels(container)).toEqual(["Print"]);
  });

  test("false hides an action enabled by defaults or a custom callback on all surfaces", () => {
    const { container } = render(<NTableDefaultsProvider value={{ dataActions: true }}><NTable {...base} onImport={mock()} showImportButton={false} /></NTableDefaultsProvider>);
    expect(container.querySelector('[aria-label="Import"]')).toBeNull();
    expect(container.querySelectorAll('[aria-label="Export"]')).toHaveLength(2);
    expect(container.querySelectorAll('[aria-label="Print"]')).toHaveLength(2);
    fireEvent.contextMenu(container.querySelector('thead th')!);
    expect(menuLabels(container)).toEqual(["Export", "Print"]);
  });

  test("hiding all actions removes their buttons and default header menu", () => {
    const { container } = render(<NTable {...base} dataActions onExport={mock()} onImport={mock()} onPrint={mock()} showExportButton={false} showImportButton={false} showPrintButton={false} />);
    expect(container.querySelector('[aria-label="Table actions"]')).toBeNull();
    expect(container.querySelector('[data-ntable-header]')).toBeNull();
    expect(fireEvent.contextMenu(container.querySelector('thead th')!)).toBe(true);
    expect(menuLabels(container)).toEqual([]);
  });

  test("changing visibility closes stale menus and uses the latest set of actions", () => {
    const { container, rerender } = render(<NTable {...base} dataActions />);
    fireEvent.contextMenu(container.querySelector('thead th')!);
    expect(menuLabels(container)).toEqual(["Export", "Import", "Print"]);
    rerender(<NTable {...base} dataActions showExportButton={false} showPrintButton={false} />);
    expect(menuLabels(container)).toEqual([]);
    fireEvent.contextMenu(container.querySelector('thead th')!);
    expect(menuLabels(container)).toEqual(["Import"]);
  });

  test("renders only supplied actions and dispatches desktop and mobile buttons", () => {
    const onExport = mock();
    const onImport = mock();
    const onPrint = mock();
    const { container } = render(<NTable {...base} onExport={onExport} onImport={onImport} onPrint={onPrint} />);
    for (const [label, handler] of [["Export", onExport], ["Import", onImport], ["Print", onPrint]] as const) {
      const buttons = container.querySelectorAll<HTMLButtonElement>(`button[aria-label="${label}"]`);
      expect(buttons.length).toBe(2);
      expect(buttons[0].title).toBe(label);
      buttons.forEach(button => fireEvent.click(button));
      expect(handler).toHaveBeenCalledTimes(2);
    }
  });

  test("uses the same default actions for toolbar and column-header right clicks", () => {
    const onExport = mock();
    const onBackground = mock();
    const { container } = render(<NTable {...base} onExport={onExport} onImport={mock()} onPrint={mock()} menu={{ background: onBackground }} />);
    for (const selector of ["[data-ntable-header]", "thead th"]) {
      fireEvent.contextMenu(container.querySelector(selector)!, { clientX: 20, clientY: 30 });
      expect(menuLabels(container)).toEqual(["Export", "Import", "Print"]);
      fireEvent.click(container.querySelector('[data-context-menu] [role="menuitem"]')!);
    }
    expect(onExport).toHaveBeenCalledTimes(2);
    expect(onBackground).not.toHaveBeenCalled();
  });

  test("menu-only trigger opens custom header actions with keyboard navigation", () => {
    const onDownload = mock();
    const { container } = render(<NTable {...base} toolbarActionDisplay="menu" onExport={mock()} menu={{ header: () => [{ label: "Download PDF", onSelect: onDownload }] }} />);
    expect(container.querySelector('button[aria-label="Export"]')).toBeNull();
    const trigger = container.querySelector<HTMLButtonElement>('button[aria-label="Table actions"]')!;
    expect(trigger.getAttribute("aria-haspopup")).toBe("menu");
    trigger.focus();
    fireEvent.click(trigger);
    expect(menuLabels(container)).toEqual(["Download PDF"]);
    expect(document.activeElement?.getAttribute("role")).toBe("menuitem");
    fireEvent.click(container.querySelector('[role="menuitem"]')!);
    expect(onDownload).toHaveBeenCalledTimes(1);
  });

  test("buttons-only preserves native header right click", () => {
    const { container } = render(<NTable {...base} toolbarActionDisplay="buttons" onExport={mock()} />);
    expect(container.querySelector('button[aria-label="Table actions"]')).toBeNull();
    expect(fireEvent.contextMenu(container.querySelector("[data-ntable-header]")!)).toBe(true);
    expect(menuLabels(container)).toEqual([]);
  });

  test("does not intercept right clicks without header actions or inside text inputs", () => {
    const { container, rerender } = render(<NTable {...base} />);
    expect(container.querySelector('[aria-label="Export"]')).toBeNull();
    expect(fireEvent.contextMenu(container.querySelector("thead th")!)).toBe(true);
    rerender(<NTable {...base} onExport={mock()} filters={[{ name: "name", type: "text", placeholder: "Search names" }]} />);
    expect(fireEvent.contextMenu(container.querySelector("input")!)).toBe(true);
    expect(menuLabels(container)).toEqual([]);
  });

  test("import remains usable on empty tables and reflects callback changes", () => {
    const before = mock();
    const after = mock();
    const { container, rerender } = render(<NTable {...base} data={[]} onImport={before} />);
    fireEvent.click(container.querySelector('[aria-label="Import"]')!);
    expect(before).toHaveBeenCalledTimes(1);
    rerender(<NTable {...base} data={[]} onImport={after} />);
    fireEvent.contextMenu(container.querySelector('[data-ntable-header]')!);
    expect(menuLabels(container)).toEqual(["Import"]);
    fireEvent.click(container.querySelector('[role="menuitem"]')!);
    expect(after).toHaveBeenCalledTimes(1);
    rerender(<NTable {...base} data={[]} />);
    expect(container.querySelector('[aria-label="Import"]')).toBeNull();
  });

  test("disables actions during first load and keeps them usable during a refresh", () => {
    const onImport = mock();
    const { container, rerender } = render(<NTable {...base} data={[]} loading onImport={onImport} />);
    const button = container.querySelector<HTMLButtonElement>('[aria-label="Import"]')!;
    expect(button.disabled).toBe(true);
    fireEvent.click(button);
    fireEvent.contextMenu(container.querySelector('[data-ntable-header]')!);
    expect(onImport).not.toHaveBeenCalled();
    expect(menuLabels(container)).toEqual([]);
    rerender(<NTable {...base} loading onImport={onImport} />);
    expect(container.querySelector<HTMLButtonElement>('[aria-label="Import"]')!.disabled).toBe(false);
    fireEvent.click(container.querySelector('[aria-label="Import"]')!);
    expect(onImport).toHaveBeenCalledTimes(1);
  });

  test("inherits action labels and allows individual overrides", () => {
    const { container } = render(<NTableDefaultsProvider value={{ toolbarLabels: { export: "Exporter", import: "Importer", print: "Imprimer", tableActions: "Actions du tableau" } }}><NTable {...base} onExport={mock()} onImport={mock()} onPrint={mock()} toolbarLabels={{ export: "Download" }} /></NTableDefaultsProvider>);
    expect(container.querySelector('[aria-label="Download"]')).toBeTruthy();
    fireEvent.click(container.querySelector('[aria-label="Actions du tableau"]')!);
    expect(menuLabels(container)).toEqual(["Download", "Importer", "Imprimer"]);
  });

  test("custom modes expose toolbar actions too", () => {
    const onImport = mock();
    const { container } = render(<NTable {...base} mode="files" availableModes={["files"]} renderCustomMode={{ files: () => <div>Files</div> }} onImport={onImport} />);
    fireEvent.click(container.querySelector('[aria-label="Import"]')!);
    expect(onImport).toHaveBeenCalledTimes(1);
  });
});
