/**
 * Locale-aware labels for calendar dates.
 *
 * A calendar date ("2026-10-01") has no time zone. The picker holds it as a
 * local-midnight `Date`; reading its local parts and formatting them as UTC
 * gives the same day on the server and in every browser zone.
 */
export function formatCalendarDate(date: Date, locale: string): string {
  const utc = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" }).format(utc);
}

/**
 * `react-day-picker` formatters for `locale`. Its own defaults go through
 * date-fns, which is English unless a date-fns locale object is bundled.
 * The dates it hands over are local, so they are formatted in the host zone.
 */
/**
 * The calendar's screen-reader names in the active locale. DayPicker's own
 * labels format with its English date library, so a French page announced
 * "Monday, September 1st, 2025" under a "septembre 2025" caption.
 */
export function calendarLabels(locale: string, words: { today: string; selected: string }) {
  const full = new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const caption = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" });
  const weekday = new Intl.DateTimeFormat(locale, { weekday: "long" });

  return {
    labelDayButton: (date: Date, modifiers: { today?: boolean; selected?: boolean }) => {
      let label = full.format(date);
      if (modifiers.today) label = `${words.today}, ${label}`;
      if (modifiers.selected) label = `${label}, ${words.selected}`;
      return label;
    },
    labelGrid: (date: Date) => caption.format(date),
    labelWeekday: (date: Date) => weekday.format(date),
  };
}

export function calendarFormatters(locale: string) {
  const caption = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" });
  const month = new Intl.DateTimeFormat(locale, { month: "long" });
  const year = new Intl.DateTimeFormat(locale, { year: "numeric" });
  const day = new Intl.DateTimeFormat(locale, { day: "numeric" });
  const shortWeekday = new Intl.DateTimeFormat(locale, { weekday: "short" });
  const narrowWeekday = new Intl.DateTimeFormat(locale, { weekday: "narrow" });

  return {
    formatCaption: (date: Date) => caption.format(date),
    formatMonthDropdown: (date: Date) => month.format(date),
    formatYearDropdown: (date: Date) => year.format(date),
    formatDay: (date: Date) => day.format(date),
    // A weekday column is 2rem wide. Some locales have no short form that fits
    // (Arabic "short" is the full name), so fall back to the narrow letter.
    formatWeekdayName: (date: Date) => {
      const label = shortWeekday.format(date);
      return label.length <= 4 ? label : narrowWeekday.format(date);
    },
  };
}
