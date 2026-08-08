import { describe, expect, test } from "bun:test";

import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatNumber,
  formatRelativeTime,
  humanizeToken,
  localDateInput,
  slugify,
} from "../src/format/format";
import type { NajmFormatConfig } from "../src/format/format";

const maroc: NajmFormatConfig = {
  locale: "fr-MA",
  timeZone: "Africa/Casablanca",
  currency: "MAD",
};

/**
 * The major-unit amount an input *should* render as, formatted by Intl itself.
 *
 * Comparing against this rather than a literal keeps these assertions about the
 * minor-unit scale — the thing under test — rather than about which separator a
 * given locale happens to group with.
 */
const asMajor = (locale: string, currency: string, major: number) =>
  new Intl.NumberFormat(locale, { style: "currency", currency }).format(major);

describe("formatCurrency", () => {
  test("reads minor units against the currency's own exponent", () => {
    // Two digits: 125 000 centimes is 1 250 dirhams.
    expect(formatCurrency(125_000, maroc)).toBe(asMajor("fr-MA", "MAD", 1250));

    // Zero digits: JPY has no minor unit, so dividing by 100 would render a
    // hundredth of the real amount.
    expect(formatCurrency(1250, { locale: "ja-JP", currency: "JPY" })).toBe(
      asMajor("ja-JP", "JPY", 1250),
    );

    // Three digits: the same integer is a tenth of the two-digit reading.
    expect(formatCurrency(1250, { locale: "en-US", currency: "KWD" })).toBe(
      asMajor("en-US", "KWD", 1.25),
    );
  });

  test("refuses values that have already lost precision", () => {
    expect(formatCurrency(12.5, maroc)).toBe("—");
    expect(formatCurrency(Number.MAX_SAFE_INTEGER + 2, maroc)).toBe("—");
  });

  test("renders the placeholder for absent values", () => {
    expect(formatCurrency(null, maroc)).toBe("—");
    expect(formatCurrency(undefined, maroc)).toBe("—");
    expect(formatCurrency(null, { ...maroc, placeholder: "n/a" })).toBe("n/a");
  });

  test("zero is an amount, not an absent value", () => {
    expect(formatCurrency(0, maroc)).toBe(asMajor("fr-MA", "MAD", 0));
  });

  test("throws when no currency is configured", () => {
    expect(() => formatCurrency(100, { locale: "fr-MA" })).toThrow(/currency/);
  });
});

describe("formatNumber", () => {
  test("formats finite values and rejects the rest", () => {
    expect(formatNumber(1234.5, maroc)).toBe(
      new Intl.NumberFormat("fr-MA").format(1234.5),
    );
    expect(formatNumber(Number.NaN, maroc)).toBe("—");
    expect(formatNumber(Number.POSITIVE_INFINITY, maroc)).toBe("—");
    expect(formatNumber(0, maroc)).toBe("0");
  });
});

describe("date formatting", () => {
  // 21:00 in Casablanca (UTC+1 in August), already 05:00 the next day in Tokyo.
  const instant = "2026-08-08T20:00:00.000Z";

  test("renders in the configured zone, not the host zone", () => {
    expect(formatDate(instant, maroc)).toContain("8");
    expect(formatDate(instant, { ...maroc, timeZone: "Asia/Tokyo" })).toContain(
      "9",
    );
    expect(formatDateTime(instant, maroc)).not.toBe(
      formatDateTime(instant, { ...maroc, timeZone: "Asia/Tokyo" }),
    );
  });

  test("accepts Date, epoch millis, and ISO strings alike", () => {
    const fromDate = formatDate(new Date(instant), maroc);
    expect(formatDate(Date.parse(instant), maroc)).toBe(fromDate);
    expect(formatDate(instant, maroc)).toBe(fromDate);
  });

  test("renders the placeholder for absent or unparseable values", () => {
    expect(formatDate(null, maroc)).toBe("—");
    expect(formatDate("", maroc)).toBe("—");
    expect(formatDate("not a date", maroc)).toBe("—");
  });
});

describe("formatRelativeTime", () => {
  const now = Date.parse("2026-08-08T12:00:00.000Z");

  test("picks the largest unit that fits, in both directions", () => {
    expect(formatRelativeTime("2026-08-05T12:00:00.000Z", maroc, now)).toBe(
      new Intl.RelativeTimeFormat("fr-MA", { numeric: "auto" }).format(
        -3,
        "day",
      ),
    );
    expect(formatRelativeTime("2026-08-08T14:00:00.000Z", maroc, now)).toBe(
      new Intl.RelativeTimeFormat("fr-MA", { numeric: "auto" }).format(
        2,
        "hour",
      ),
    );
  });

  test("renders the placeholder for absent values", () => {
    expect(formatRelativeTime(null, maroc, now)).toBe("—");
    expect(formatRelativeTime("not a date", maroc, now)).toBe("—");
  });
});

describe("humanizeToken", () => {
  test("turns machine tokens into readable text", () => {
    expect(humanizeToken("out_for_delivery")).toBe("Out For Delivery");
    expect(humanizeToken("pending-funding")).toBe("Pending Funding");
    expect(humanizeToken("  active  ")).toBe("Active");
  });
});

describe("localDateInput", () => {
  test("formats a date as YYYY-MM-DD with padded parts", () => {
    expect(localDateInput(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(localDateInput(new Date(2026, 11, 31))).toBe("2026-12-31");
  });

  // The bug this exists to avoid: `toISOString().slice(0, 10)` converts to UTC
  // first, so any local time before the UTC offset rolls the date backwards.
  test("reads the local calendar, not the UTC one", () => {
    const justAfterMidnight = new Date(2026, 5, 15, 0, 30);
    expect(localDateInput(justAfterMidnight)).toBe("2026-06-15");
  });

  test("defaults to today", () => {
    expect(localDateInput()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("slugify", () => {
  test("lowercases and joins words with hyphens", () => {
    expect(slugify("Fresh Produce")).toBe("fresh-produce");
    expect(slugify("  Rice  &  Pasta  ")).toBe("rice-pasta");
  });

  test("folds accents instead of dropping the letter", () => {
    expect(slugify("Épicerie Fine")).toBe("epicerie-fine");
    expect(slugify("Crème Brûlée")).toBe("creme-brulee");
  });

  test("uppercases on request, for identifiers read in caps", () => {
    expect(slugify("Olive Oil", { upperCase: true })).toBe("OLIVE-OIL");
  });

  test("truncates to maxLength", () => {
    expect(slugify("a".repeat(200))).toHaveLength(160);
    expect(slugify("abcdefgh", { maxLength: 3 })).toBe("abc");
  });

  test("never returns an empty slug", () => {
    for (const input of ["", "   ", "!!!", "مواد غذائية"]) {
      expect(slugify(input)).toMatch(/^[a-z0-9]{8}$/);
    }
    expect(slugify("!!!", { upperCase: true })).toMatch(/^[A-Z0-9]{8}$/);
  });
});
