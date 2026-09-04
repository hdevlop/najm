// Compile-only. Proves the package's behavior for a program with no registry
// augmentation: `useTranslation()` stays `string`-keyed, exactly as 2.0.3.
import { useTranslation } from "najm-i18n/react";

export function unregisteredFallsBackToString() {
  const { t, language, changeLanguage } = useTranslation();

  t("anything.at.all");
  t("");

  const anyLanguage: string = language;
  void changeLanguage("whatever");

  return anyLanguage;
}

export function explicitGenericsStillWork() {
  const { t } = useTranslation<"a" | "b", "en" | "fr">();
  t("a");
  // @ts-expect-error still narrowed when the call site asks for it
  t("c");
}
