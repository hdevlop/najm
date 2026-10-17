import { describe, expect, test } from "bun:test";
import React from "react";
import { fireEvent, render, within } from "@testing-library/react";
import { DateInput } from "../../src/components/inputs/DateInput";
import { NajmFormatProvider } from "../../src/format/provider";

// A fee form offered days before the student's enrollment, which the server
// then refused; the calendar now keeps to the days the form accepts.
const open = (node: React.ReactNode) => {
  const view = render(<NajmFormatProvider locale="fr" timeZone="UTC">{node}</NajmFormatProvider>);
  fireEvent.click(view.getByRole("button", { name: "Date" }));
  return within(view.getByRole("grid").closest("[data-radix-popper-content-wrapper]") as HTMLElement ?? document.body);
};

describe("DateInput bounds", () => {
  test("disables days outside min and max and opens on the first allowed month", () => {
    const calendar = open(<DateInput ariaLabel="Date" value={undefined} onChange={() => {}} min="2030-06-10" max="2030-06-20" />);
    expect(calendar.getByRole("grid", { name: "juin 2030" })).toBeTruthy();
    const day = (n: number) => calendar.getByRole("button", { name: new RegExp("^[^ ]+ " + n + " juin 2030") }) as HTMLButtonElement;
    expect(day(9).disabled).toBe(true);
    expect(day(10).disabled).toBe(false);
    expect(day(20).disabled).toBe(false);
    expect(day(21).disabled).toBe(true);
  });

  test("leaves every day open without bounds", () => {
    const calendar = open(<DateInput ariaLabel="Date" value={new Date(2026, 5, 15)} onChange={() => {}} />);
    expect((calendar.getByRole("button", { name: /^\S+ 1 juin 2026/ }) as HTMLButtonElement).disabled).toBe(false);
  });
});
