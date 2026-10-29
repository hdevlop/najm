import { describe, expect, mock, test } from "bun:test";
import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { DateRangeInput } from "../../src/components/inputs/DateRangeInput";
import { FormInput, NForm } from "../../src/components/form";
import { NajmFormatProvider } from "../../src/format/provider";
import type { DateRangeValue } from "../../src/components/inputs/types";

const inFrench = (node: React.ReactNode) => <NajmFormatProvider locale="fr" timeZone="UTC">{node}</NajmFormatProvider>;
const day = (view: ReturnType<typeof render>, n: number, month: string) =>
  view.getByRole("button", { name: new RegExp(`^\\S+ ${n} ${month} 2026`) }) as HTMLButtonElement;

describe("DateRangeInput", () => {
  test("shows two months and commits the range only once both ends are chosen, earlier day first", () => {
    const chosen: DateRangeValue[] = [];
    const view = render(inFrench(<DateRangeInput ariaLabel="Période" value={{ from: "2026-06-01", to: "2026-06-03" }} onChange={(range) => chosen.push(range)} />));
    fireEvent.click(view.getByRole("button", { name: "Période" }));
    expect(view.getByRole("grid", { name: "juin 2026" })).toBeTruthy();
    expect(view.getByRole("grid", { name: "juillet 2026" })).toBeTruthy();

    fireEvent.click(day(view, 21, "juin"));
    expect(chosen).toEqual([]);
    expect(view.getByRole("button", { name: "Période" }).textContent).toBe("21 juin 2026 – …");

    fireEvent.click(day(view, 14, "juin"));
    expect(chosen).toEqual([{ from: "2026-06-14", to: "2026-06-21" }]);
    expect(view.queryByRole("grid")).toBeNull();
  });

  test("marks every day of the stored range selected", () => {
    const view = render(inFrench(<DateRangeInput ariaLabel="Période" value={{ from: "2026-06-14", to: "2026-06-16" }} onChange={() => {}} />));
    const trigger = view.getByRole("button", { name: "Période" });
    expect(trigger.textContent).toBe("14 juin 2026 – 16 juin 2026");
    fireEvent.click(trigger);
    for (const n of [14, 15, 16]) expect(day(view, n, "juin").getAttribute("aria-label")).toMatch(/sélectionné$/);
    expect(day(view, 17, "juin").getAttribute("aria-label")).not.toMatch(/sélectionné$/);
  });

  test("clicking one day twice chooses that single day", () => {
    const onChange = mock();
    const view = render(inFrench(<DateRangeInput ariaLabel="Période" value={undefined} onChange={onChange} min="2026-06-01" max="2026-07-31" />));
    fireEvent.click(view.getByRole("button", { name: "Période" }));
    fireEvent.click(day(view, 10, "juin"));
    fireEvent.click(day(view, 10, "juin"));
    expect(onChange).toHaveBeenCalledWith({ from: "2026-06-10", to: "2026-06-10" });
  });

  test("closing after one click keeps the stored range", () => {
    const onChange = mock();
    const view = render(inFrench(<DateRangeInput ariaLabel="Période" value={{ from: "2026-06-01", to: "2026-06-03" }} onChange={onChange} />));
    fireEvent.click(view.getByRole("button", { name: "Période" }));
    fireEvent.click(day(view, 21, "juin"));
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    expect(onChange).not.toHaveBeenCalled();
    expect(view.getByRole("button", { name: "Période" }).textContent).toBe("1 juin 2026 – 3 juin 2026");
  });

  test("disables days outside min and max", () => {
    const view = render(inFrench(<DateRangeInput ariaLabel="Période" value="" onChange={() => {}} min="2026-06-10" max="2026-07-20" />));
    fireEvent.click(view.getByRole("button", { name: "Période" }));
    expect(day(view, 9, "juin").disabled).toBe(true);
    expect(day(view, 10, "juin").disabled).toBe(false);
    expect(day(view, 20, "juillet").disabled).toBe(false);
    expect(day(view, 21, "juillet").disabled).toBe(true);
  });

  test("an empty value shows the localized placeholder", () => {
    for (const value of ["", null, { from: "", to: "" }] as const) {
      const view = render(inFrench(<DateRangeInput ariaLabel="Vide" value={value} onChange={() => {}} />));
      expect(view.getByRole("button", { name: "Vide" }).textContent).toBe("Choisir une période");
      view.unmount();
    }
  });
});

describe("FormInput dateRange", () => {
  test("is named by its label and submits the chosen range", async () => {
    const onSubmit = mock();
    const view = render(inFrench(
      <NForm defaultValues={{ period: { from: "2026-06-01", to: "2026-06-02" } }} onSubmit={onSubmit}>
        <FormInput name="period" type="dateRange" formLabel="Période" />
        <button type="submit">Envoyer</button>
      </NForm>,
    ));
    fireEvent.click(view.getByRole("button", { name: "Période" }));
    fireEvent.click(day(view, 14, "juin"));
    fireEvent.click(day(view, 21, "juin"));
    fireEvent.click(view.getByRole("button", { name: "Envoyer" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0]).toEqual({ period: { from: "2026-06-14", to: "2026-06-21" } });
  });
});
