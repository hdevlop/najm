import { describe, expect, test } from "bun:test";
import React from "react";
import { render } from "@testing-library/react";
import { Calendar } from "../src/components/ui/calendar";
import { Dialog, DialogContent, DialogTitle } from "../src/components/Dialog/Dialog";
import { NPageHeader } from "../src/components/layout/NPageHeader";
import { NSidebarMobile } from "../src/components/sidebar/NSidebarMobile";
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

  test("spell the French and Spanish location labels with their accents", () => {
    expect(getNajmLocationLabels("fr").openMap).toBe("Sélectionner sur la carte");
    expect(getNajmLocationLabels("es").openMap).toBe("Seleccionar ubicación en el mapa");
  });
});

describe("NSidebarMobile", () => {
  // The closed drawer is only translated off-screen; its links stayed in the
  // tab order and the accessibility tree.
  test("is inert while closed and reachable once open", () => {
    const drawer = (open: boolean) => (
      <NSidebarMobile open={open} onOpen={() => {}} onClose={() => {}}><a href="/home">Home</a></NSidebarMobile>
    );
    const { container, rerender } = render(drawer(false));
    const aside = container.querySelector("aside") as HTMLElement & { inert: boolean };
    expect(aside.inert).toBe(true);
    rerender(drawer(true));
    expect(aside.inert).toBe(false);
  });
});
