import { useNajmFormatContext } from "../format/provider";

/**
 * Accessible names najm-kit's own controls carry when the app passes none:
 * icon-only buttons whose only text is a screen reader's. They follow the
 * active format locale, as the calendar's month names already do; without a
 * format provider they stay English.
 */
export interface NajmKitLabels {
  close: string;
  openSidebar: string;
  closeSidebar: string;
  collapseSidebar: string;
  expandSidebar: string;
  previousMonth: string;
  nextMonth: string;
  select: string;
  countrySelector: string;
}

export type NajmKitLabelLocale = "en" | "fr" | "ar" | "es";

export const NAJM_KIT_LABELS: Readonly<Record<NajmKitLabelLocale, NajmKitLabels>> = Object.freeze({
  en: Object.freeze({
    close: "Close",
    openSidebar: "Open sidebar",
    closeSidebar: "Close sidebar",
    collapseSidebar: "Collapse",
    expandSidebar: "Expand",
    previousMonth: "Go to the previous month",
    nextMonth: "Go to the next month",
    select: "Select",
    countrySelector: "Country",
  }),
  fr: Object.freeze({
    close: "Fermer",
    openSidebar: "Ouvrir le menu",
    closeSidebar: "Fermer le menu",
    collapseSidebar: "Réduire",
    expandSidebar: "Développer",
    previousMonth: "Mois précédent",
    nextMonth: "Mois suivant",
    select: "Choisir",
    countrySelector: "Pays",
  }),
  ar: Object.freeze({
    close: "إغلاق",
    openSidebar: "فتح القائمة",
    closeSidebar: "إغلاق القائمة",
    collapseSidebar: "طي",
    expandSidebar: "توسيع",
    previousMonth: "الشهر السابق",
    nextMonth: "الشهر التالي",
    select: "اختيار",
    countrySelector: "البلد",
  }),
  es: Object.freeze({
    close: "Cerrar",
    openSidebar: "Abrir el menú",
    closeSidebar: "Cerrar el menú",
    collapseSidebar: "Contraer",
    expandSidebar: "Expandir",
    previousMonth: "Mes anterior",
    nextMonth: "Mes siguiente",
    select: "Seleccionar",
    countrySelector: "País",
  }),
});

/** Labels for a locale such as `fr-MA`; an unsupported one reads English. */
export function getNajmKitLabels(locale?: string | null): NajmKitLabels {
  const base = (locale ?? "").trim().toLowerCase().split("-")[0] as NajmKitLabelLocale;
  return NAJM_KIT_LABELS[base] ?? NAJM_KIT_LABELS.en;
}

export function useNajmKitLabels(): NajmKitLabels {
  return getNajmKitLabels(useNajmFormatContext()?.locale);
}
