import { describe, expect, test } from "bun:test";
import React from "react";
import { cleanup, fireEvent, render, within } from "@testing-library/react";
import { TimeRangeInput, formatTimeRangeDuration } from "../../src/components/inputs/TimeRangeInput";
import { NajmFormatProvider } from "../../src/format/provider";
import type { TimeRangeValue } from "../../src/components/inputs/types";

const inFrench = (node: React.ReactNode) => <NajmFormatProvider locale="fr" timeZone="UTC">{node}</NajmFormatProvider>;

function open(value: TimeRangeValue | null) {
  // One field at a time: the popover renders into the page, outside the view.
  cleanup();
  const chosen: TimeRangeValue[] = [];
  const view = render(inFrench(<TimeRangeInput ariaLabel="Horaire" value={value} onChange={(range) => chosen.push(range)} />));
  fireEvent.click(view.getByRole("button", { name: "Horaire" }));
  const list = (name: string) => within(view.getByRole("group", { name }));
  return { view, chosen, starts: list("De"), ends: list("À") };
}

describe("TimeRangeInput", () => {
  test("reads the stored range with its length, and a database time as its minutes", () => {
    const view = render(inFrench(<TimeRangeInput ariaLabel="Horaire" value={{ from: "08:30:00", to: "10:00" }} onChange={() => {}} />));
    expect(view.getByRole("button", { name: "Horaire" }).textContent).toBe("08:30 – 10:001h30");
    cleanup();
    const empty = render(inFrench(<TimeRangeInput ariaLabel="Vide" value="" onChange={() => {}} />));
    expect(empty.getByRole("button", { name: "Vide" }).textContent).toBe("Choisir un horaire");
  });

  test("a new start keeps a later end, or sets the end the default length after it", () => {
    const kept = open({ from: "08:30", to: "10:00" });
    fireEvent.click(kept.starts.getByRole("button", { name: "09:00" }));
    expect(kept.chosen).toEqual([{ from: "09:00", to: "10:00" }]);
    const moved = open({ from: "08:30", to: "10:00" });
    fireEvent.click(moved.starts.getByRole("button", { name: "11:00" }));
    expect(moved.chosen).toEqual([{ from: "11:00", to: "12:00" }]);
  });

  test("offers only ends after the start, and an end closes the field", () => {
    const { view, chosen, ends } = open({ from: "08:30", to: "09:30" });
    expect((ends.getByRole("button", { name: "08:30" }) as HTMLButtonElement).disabled).toBe(true);
    expect((ends.getByRole("button", { name: "08:45" }) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(ends.getByRole("button", { name: "11:00" }));
    expect(chosen).toEqual([{ from: "08:30", to: "11:00" }]);
    expect(view.queryByRole("group", { name: "De" })).toBeNull();
  });

  test("a length sets the end from the start, and clearing empties both", () => {
    const length = open({ from: "08:30", to: "09:30" });
    expect(length.view.getByRole("button", { name: "1h", pressed: true })).toBeTruthy();
    fireEvent.click(length.view.getByRole("button", { name: "1h30" }));
    expect(length.chosen).toEqual([{ from: "08:30", to: "10:00" }]);
    const cleared = open({ from: "08:30", to: "09:30" });
    fireEvent.click(cleared.view.getByRole("button", { name: "Sans heure" }));
    expect(cleared.chosen).toEqual([{}]);
  });

  test("without a start, ends and lengths wait for one", () => {
    const { view, ends } = open(null);
    expect((ends.getByRole("button", { name: "09:00" }) as HTMLButtonElement).disabled).toBe(true);
    expect((view.getByRole("button", { name: "1h" }) as HTMLButtonElement).disabled).toBe(true);
  });

  test("writes lengths as hours and minutes", () => {
    const units = { hourShort: "h", minuteShort: "min" };
    expect([45, 60, 90, 120].map(minutes => formatTimeRangeDuration(minutes, units))).toEqual(["45 min", "1h", "1h30", "2h"]);
  });
});
