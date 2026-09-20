/** Reusable currency choices for applications that allow institution selection. */
export const NAJM_CURRENCY_OPTIONS = [
  { value: "MAD", label: "MAD - Moroccan Dirham (د.م.)" },
  { value: "USD", label: "USD - US Dollar ($)" },
  { value: "EUR", label: "EUR - Euro (€)" },
  { value: "GBP", label: "GBP - British Pound (£)" },
  { value: "CAD", label: "CAD - Canadian Dollar (C$)" },
  { value: "AUD", label: "AUD - Australian Dollar (A$)" },
  { value: "JPY", label: "JPY - Japanese Yen (¥)" },
  { value: "CNY", label: "CNY - Chinese Yuan (¥)" },
  { value: "INR", label: "INR - Indian Rupee (₹)" },
  { value: "AED", label: "AED - UAE Dirham (د.إ)" },
  { value: "SAR", label: "SAR - Saudi Riyal (﷼)" },
  { value: "EGP", label: "EGP - Egyptian Pound (E£)" },
] as const;

export const NAJM_CURRENCIES = NAJM_CURRENCY_OPTIONS.map(({ value }) => value);
export type NajmCurrency = (typeof NAJM_CURRENCY_OPTIONS)[number]["value"];
