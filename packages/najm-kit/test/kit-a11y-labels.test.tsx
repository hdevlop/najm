import { describe, expect, test } from "bun:test";
import React from "react";
import { fireEvent, render, within } from "@testing-library/react";
import type { ColumnDef } from "@tanstack/react-table";
import { FormProvider, useForm } from "react-hook-form";

import { NTable } from "../src/components/table/NTable";
import { DateInput } from "../src/components/inputs/DateInput";
import { ComboboxInput } from "../src/components/inputs/ComboboxInput";
import DynamicArray from "../src/components/form/DynamicArray";
import { NajmFormatProvider } from "../src/format/provider";

// Found by School's French browser run (PB1021-FIN, 2026-10-18): kit controls
// named in English whatever the language, a settings menu out of keyboard
// reach, an unnamed combobox filter, and a calendar left open after a day was
// chosen.

const inLocale = (locale: string, node: React.ReactNode) => (
  <NajmFormatProvider locale={locale} timeZone="UTC">{node}</NajmFormatProvider>
);

interface Row { id: string; name: string }
const rows: Row[] = [{ id: "1", name: "Alice" }, { id: "2", name: "Bob" }];
const columns: ColumnDef<Row, any>[] = [{ accessorKey: "name", header: "Name" }];
const table = (props: Record<string, unknown> = {}) => (
  <div style={{ height: 600 }}>
    <NTable data={rows} columns={columns} getRowId={(row) => row.id} dynamicHeight={false} showPagination={false} showAddButton={false} {...props} />
  </div>
);

describe("kit controls in the active language", () => {
  test("names the selection checkboxes in French, and keeps English without a provider", () => {
    const fr = render(inLocale("fr-MA", table({ showCheckbox: true })));
    expect(fr.container.querySelector('[aria-label="Sélectionner toutes les lignes"]')).toBeTruthy();
    expect(fr.container.querySelector('[aria-label="Sélectionner la ligne 1"]')).toBeTruthy();
    fr.unmount();
    const en = render(table({ showCheckbox: true }));
    expect(en.container.querySelector('[aria-label="Select all rows"]')).toBeTruthy();
    expect(en.container.querySelector('[aria-label="Select row 2"]')).toBeTruthy();
  });

  test("gives a date field without a placeholder the localized one", () => {
    const ar = render(inLocale("ar", <DateInput ariaLabel="d" value={undefined} onChange={() => {}} />));
    expect(ar.getByRole("button", { name: "d" }).textContent).toBe("اختر تاريخًا");
    ar.unmount();
    const en = render(<DateInput ariaLabel="d" value={undefined} onChange={() => {}} />);
    expect(en.getByRole("button", { name: "d" }).textContent).toBe("Pick a date");
    en.unmount();
    const own = render(inLocale("fr", <DateInput ariaLabel="d" placeholder="Échéance" value={undefined} onChange={() => {}} />));
    expect(own.getByRole("button", { name: "d" }).textContent).toBe("Échéance");
  });

  test("names a repeated item's delete button in the active language", () => {
    function Harness() {
      const form = useForm<any>({ defaultValues: { fees: [{ name: "Cantine" }] } });
      return (
        <FormProvider {...form}>
          <DynamicArray name="fees" title={(field: any) => field.name}><span /></DynamicArray>
        </FormProvider>
      );
    }
    const view = render(inLocale("fr", <Harness />));
    expect(view.getByRole("button", { name: "Retirer Cantine" })).toBeTruthy();
  });
});

describe("kit controls a keyboard and a screen reader can use", () => {
  test("the table settings trigger is a focusable button that Enter opens", () => {
    const view = render(table({ showViewToggle: true, renderCard: () => <div /> }));
    const trigger = view.container.querySelector<HTMLElement>('[aria-label="Table settings"]')!;
    expect(trigger.getAttribute("role")).toBe("button");
    expect(trigger.tabIndex).toBe(0);
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "Enter" });
    const menu = document.querySelector('[role="menu"]')!;
    expect(Array.from(menu.querySelectorAll('[role="menuitemradio"]')).map((item) => item.textContent?.trim())).toEqual(["Table", "Cards"]);
  });

  test("a combobox without an ariaLabel is named by its placeholder", () => {
    const view = render(<ComboboxInput value="" onChange={() => {}} items={[{ value: "cm2", label: "CM2" }]} placeholder="Classe" />);
    expect(view.getByRole("combobox", { name: "Classe" })).toBeTruthy();
  });

  test("choosing a day closes the calendar", () => {
    const chosen: Array<string | undefined> = [];
    const view = render(inLocale("fr", <DateInput ariaLabel="Date" value={new Date(2026, 5, 15)} onChange={(value) => chosen.push(value as string | undefined)} />));
    fireEvent.click(view.getByRole("button", { name: "Date" }));
    const calendar = within(view.getByRole("grid").closest("[data-radix-popper-content-wrapper]") as HTMLElement ?? document.body);
    fireEvent.click(calendar.getByRole("button", { name: /^\S+ 20 juin 2026/ }));
    expect(chosen).toEqual(["2026-06-20"]);
    expect(view.queryByRole("grid")).toBeNull();
  });
});
