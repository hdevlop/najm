import { describe, expect, mock, test } from "bun:test";
import React from "react";
import { render } from "@testing-library/react";
import { Calendar } from "../src/components/ui/calendar";
import { Dialog, DialogContent, DialogTitle } from "../src/components/Dialog/Dialog";
import { NPageHeader } from "../src/components/layout/NPageHeader";
import { NSidebarMobile } from "../src/components/sidebar/NSidebarMobile";
import { FormInput, NForm } from "../src/components/form";
import { PhoneInput } from "../src/components/inputs/PhoneInput";
import { SelectInput } from "../src/components/inputs/SelectInput";
import { NajmFormatProvider } from "../src/format/provider";
import { getNajmKitLabels } from "../src/lib/kitLabels";
import { getNajmLocationLabels } from "../src/location/labels";

const TestIcon = ({ className }: { className?: string }) => <svg className={className} />;

const inLocale = (locale: string, node: React.ReactNode) => (
  <NajmFormatProvider locale={locale} timeZone="UTC">{node}</NajmFormatProvider>
);

describe("najm-kit built-in labels", () => {
  test("resolve a regional locale and fall back to English", () => {
    expect(getNajmKitLabels("fr-MA").close).toBe("Fermer");
    expect(getNajmKitLabels("ar").openSidebar).toBe("فتح القائمة");
    expect(getNajmKitLabels("de").close).toBe("Close");
    expect(getNajmKitLabels(undefined).close).toBe("Close");
  });

  // Icon-only buttons were named in English whatever the interface language.
  test("name the dialog close button in the active locale", () => {
    const { getByRole } = render(inLocale("fr-MA", (
      <Dialog open><DialogContent><DialogTitle>Titre</DialogTitle></DialogContent></Dialog>
    )));
    expect(getByRole("button", { name: "Fermer" })).toBeTruthy();
  });

  test("keep English without a format provider", () => {
    const { getByRole } = render(
      <Dialog open><DialogContent><DialogTitle>Title</DialogTitle></DialogContent></Dialog>,
    );
    expect(getByRole("button", { name: "Close" })).toBeTruthy();
  });

  test("name the page header menu button, and let a passed label win", () => {
    const { getByRole, rerender } = render(inLocale("es", <NPageHeader icon={TestIcon} title="Alumnos" onSidebarOpen={() => {}} />));
    expect(getByRole("button", { name: "Abrir el menú" })).toBeTruthy();
    rerender(inLocale("es", <NPageHeader icon={TestIcon} title="Alumnos" onSidebarOpen={() => {}} sidebarTriggerLabel="Menú" />));
    expect(getByRole("button", { name: "Menú" })).toBeTruthy();
  });

  test("name the calendar's month buttons in the active locale", () => {
    const { getByRole } = render(inLocale("fr", <Calendar defaultMonth={new Date(2026, 5, 1)} />));
    expect(getByRole("button", { name: "Mois précédent" })).toBeTruthy();
    expect(getByRole("button", { name: "Mois suivant" })).toBeTruthy();
  });

  // Day buttons were announced in English ("Monday, June 1st, 2026") under a
  // French caption: DayPicker formats its labels with its own English library.
  test("name the calendar's days and grid in the active locale", () => {
    const { getByRole, queryByRole } = render(inLocale("fr", <Calendar defaultMonth={new Date(2026, 5, 1)} />));
    expect(getByRole("button", { name: "lundi 1 juin 2026" })).toBeTruthy();
    expect(getByRole("grid", { name: "juin 2026" })).toBeTruthy();
    expect(queryByRole("button", { name: /June/ })).toBeNull();
  });

  test("spell the French and Spanish location labels with their accents", () => {
    expect(getNajmLocationLabels("fr").openMap).toBe("Sélectionner sur la carte");
    expect(getNajmLocationLabels("es").openMap).toBe("Seleccionar ubicación en el mapa");
  });
});

describe("select and phone controls", () => {
  const receiptItems = [{ value: "fr", label: "Français" }, { value: "ar", label: "العربية" }];

  // A select with a form label but no placeholder was announced as "Select",
  // and its transparent trigger held no text, so no value was announced either.
  test("name a placeholder-free select from its form label and expose its value", () => {
    const { getByRole } = render(
      <NForm defaultValues={{ receiptLanguage: "fr" }} onSubmit={mock()}>
        <FormInput name="receiptLanguage" type="select" formLabel="Langue des reçus" items={receiptItems} required />
      </NForm>,
    );
    const select = getByRole("combobox", { name: "Langue des reçus" });
    expect(select.textContent).toContain("Français");
  });

  test("keep a placeholder as the name when one is given", () => {
    const { getByRole } = render(
      <NForm defaultValues={{ receiptLanguage: "" }} onSubmit={mock()}>
        <FormInput name="receiptLanguage" type="select" formLabel="Langue" placeholder="Choisir une langue" items={receiptItems} />
      </NForm>,
    );
    expect(getByRole("combobox", { name: "Choisir une langue" })).toBeTruthy();
  });

  test("fall back to a localized generic name for a bare select", () => {
    const { getByRole } = render(inLocale("fr", <SelectInput value="" onChange={() => {}} items={receiptItems} />));
    expect(getByRole("combobox", { name: "Choisir" })).toBeTruthy();
  });

  test("name the phone country button in the active locale", () => {
    const { getByRole } = render(inLocale("fr", <PhoneInput value="" onChange={() => {}} />));
    expect(getByRole("combobox", { name: "Pays" })).toBeTruthy();
  });
});

describe("NSidebarMobile", () => {
  // The closed drawer is only translated off-screen; its links stayed in the
  // tab order and the accessibility tree.
  test("is inert while closed and reachable once open", () => {
    const drawer = (open: boolean) => (
      <NSidebarMobile open={open} mobileBreakpoint="md" onOpen={() => {}} onClose={() => {}}><a href="/home">Home</a></NSidebarMobile>
    );
    const { container, rerender } = render(drawer(false));
    const aside = container.querySelector("aside") as HTMLElement & { inert: boolean };
    expect(aside.inert).toBe(true);
    rerender(drawer(true));
    expect(aside.inert).toBe(false);
  });
});
