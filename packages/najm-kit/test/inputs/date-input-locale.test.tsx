import { describe, expect, test } from "bun:test";
import React from "react";
import { render } from "@testing-library/react";
import { DateInput } from "../../src/components/inputs/DateInput";
import { Calendar } from "../../src/components/ui/calendar";
import { NajmFormatProvider } from "../../src/format/provider";
import { calendarFormatters, formatCalendarDate } from "../../src/lib/localeDates";

const inLocale = (locale: string, node: React.ReactNode) => (
  <NajmFormatProvider locale={locale} timeZone="UTC">{node}</NajmFormatProvider>
);

describe("DateInput locale", () => {
  test("keeps the English label outside a format provider", () => {
    const { container } = render(<DateInput value={new Date(2026, 9, 1)} onChange={() => {}} />);
    expect(container.textContent).toContain("October 1st, 2026");
  });

  test.each([
    ["fr", "1 octobre 2026"],
    ["es", "1 de octubre de 2026"],
    ["en", "October 1, 2026"],
  ])("labels the date in %s", (locale, expected) => {
    const { container } = render(inLocale(locale, <DateInput value={new Date(2026, 9, 1)} onChange={() => {}} />));
    expect(container.textContent).toContain(expected);
  });

  test("labels the same calendar day whatever the time zone", () => {
    // Local midnight on the first: formatting it as an instant in a zone west
    // of the host would read 30 September.
    expect(formatCalendarDate(new Date(2026, 9, 1), "fr")).toBe("1 octobre 2026");
    expect(formatCalendarDate(new Date(2026, 9, 1, 23, 59), "fr")).toBe("1 octobre 2026");
  });
});

describe("Calendar locale", () => {
  test("names the month and weekdays in the active locale", () => {
    const { container, getAllByRole } = render(
      inLocale("fr", <Calendar captionLayout="dropdown" defaultMonth={new Date(2026, 9, 1)} />),
    );
    const options = getAllByRole("option").map((option) => option.textContent);
    expect(options).toContain("octobre");
    expect(container.textContent).toContain("lun.");
  });

  test("an explicit formatter still wins", () => {
    const { container } = render(
      inLocale("fr", <Calendar defaultMonth={new Date(2026, 9, 1)} formatters={{ formatCaption: () => "custom" }} />),
    );
    expect(container.textContent).toContain("custom");
  });

  test("uses a narrow weekday where the short one is too wide", () => {
    const { formatWeekdayName } = calendarFormatters("ar");
    expect(formatWeekdayName(new Date(2026, 9, 6)).length).toBeLessThanOrEqual(2);
    expect(calendarFormatters("en").formatWeekdayName(new Date(2026, 9, 5))).toBe("Mon");
  });
});
