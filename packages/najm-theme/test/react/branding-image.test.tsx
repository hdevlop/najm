import { describe, expect, it } from "bun:test";
import * as React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

import { NThemeImage } from "../../src/react/components/NThemeImage";
import { NThemeBrandingProvider } from "../../src/react/providers/NThemeBrandingProvider";
import type { PublicBranding } from "../../src/contracts/branding";

// ============================================================================
// The slot renderer.
//
// Four slots, one component, and no path in the consumer's tree. The fallback
// chain is the interesting part: a managed asset that 404s must land on the
// factory file rather than on a broken-image glyph, because "the logo is gone"
// and "the logo is wrong" are different bugs and only one of them is urgent.
// ============================================================================

const FACTORY = {
  sidebarLogoExpanded: "/api/theme/branding/factory/sidebarLogoExpanded.1111111111111111.png",
  sidebarLogoCollapsed: "/api/theme/branding/factory/sidebarLogoCollapsed.2222222222222222.webp",
  authLogo: "/api/theme/branding/factory/authLogo.3333333333333333.webp",
  authHeroImage: "/api/theme/branding/factory/authHeroImage.4444444444444444.png",
};

const factoryBranding: PublicBranding = { slots: { ...FACTORY }, factory: { ...FACTORY }, revision: 1 };

function mount(branding: PublicBranding, children: React.ReactNode) {
  return render(
    <NThemeBrandingProvider branding={branding}>
      {children}
    </NThemeBrandingProvider>,
  );
}

describe("rendering", () => {
  it("renders every standard slot from the resolved branding", () => {
    mount(
      factoryBranding,
      <>
        <NThemeImage slot="sidebarLogoExpanded" alt="Acme" data-testid="expanded" />
        <NThemeImage slot="sidebarLogoCollapsed" alt="Acme" data-testid="collapsed" />
        <NThemeImage slot="authLogo" alt="Acme" data-testid="auth" />
        <NThemeImage slot="authHeroImage" alt="" data-testid="hero" />
      </>,
    );

    expect(screen.getByTestId("expanded").getAttribute("src")).toBe(FACTORY.sidebarLogoExpanded);
    expect(screen.getByTestId("collapsed").getAttribute("src")).toBe(FACTORY.sidebarLogoCollapsed);
    expect(screen.getByTestId("auth").getAttribute("src")).toBe(FACTORY.authLogo);
    expect(screen.getByTestId("hero").getAttribute("src")).toBe(FACTORY.authHeroImage);
  });

  it("prefers the managed asset the server resolved", () => {
    mount(
      { slots: { ...FACTORY, authLogo: "/api/theme/branding/assets/managed.png" }, revision: 5 },
      <NThemeImage slot="authLogo" alt="Acme" data-testid="auth" />,
    );

    expect(screen.getByTestId("auth").getAttribute("src")).toBe(
      "/api/theme/branding/assets/managed.png",
    );
  });

  it("keeps alt text, so a logo is named and a hero is skipped", () => {
    mount(
      factoryBranding,
      <>
        <NThemeImage slot="authLogo" alt="Acme" data-testid="auth" />
        <NThemeImage slot="authHeroImage" alt="" data-testid="hero" />
      </>,
    );

    expect(screen.getByTestId("auth").getAttribute("alt")).toBe("Acme");
    expect(screen.getByTestId("hero").getAttribute("alt")).toBe("");
  });

  it("fills its positioned parent when asked", () => {
    mount(factoryBranding, <NThemeImage slot="authHeroImage" alt="" fill data-testid="hero" />);

    const style = screen.getByTestId("hero").getAttribute("style") ?? "";
    expect(style).toContain("position: absolute");
    expect(style).toContain("object-fit: cover");
  });
});

describe("failure", () => {
  it("falls back to the factory file when a managed asset fails to load", () => {
    mount(
      {
        slots: { ...FACTORY, authLogo: "/api/theme/branding/assets/gone.png" },
        factory: FACTORY,
        revision: 5,
      },
      <NThemeImage slot="authLogo" alt="Acme" data-testid="auth" />,
    );

    const image = screen.getByTestId("auth");
    expect(image.getAttribute("src")).toBe("/api/theme/branding/assets/gone.png");

    fireEvent.error(image);
    expect(screen.getByTestId("auth").getAttribute("src")).toBe(FACTORY.authLogo);
  });

  it("falls back to the factory file when the asset already failed before hydration", () => {
    // The server-rendered case, and the one an `onError` handler cannot see: the
    // browser fetches the <img> while the HTML is still parsing, the managed
    // asset 404s, and React attaches its handler afterwards. React never
    // replays that error, so the only remaining evidence is the DOM — an image
    // that is `complete` with no intrinsic width.
    //
    // Simulated by making that pair true for the duration of this mount, which
    // is what a real browser reports for an asset that is already gone.
    const proto = (globalThis as unknown as { HTMLImageElement: typeof HTMLImageElement })
      .HTMLImageElement.prototype;
    const completeDescriptor = Object.getOwnPropertyDescriptor(proto, "complete");
    const widthDescriptor = Object.getOwnPropertyDescriptor(proto, "naturalWidth");

    // Every image has finished; only the missing managed one has no pixels. If
    // the factory file reported zero width too, the component would correctly
    // exhaust both candidates and render nothing, and this test would prove the
    // opposite of what it claims.
    Object.defineProperty(proto, "complete", { configurable: true, get: () => true });
    Object.defineProperty(proto, "naturalWidth", {
      configurable: true,
      get(this: HTMLImageElement) {
        return this.getAttribute("src")?.includes("/assets/gone.png") ? 0 : 32;
      },
    });

    try {
      mount(
        {
          slots: { ...FACTORY, authLogo: "/api/theme/branding/assets/gone.png" },
          factory: FACTORY,
          revision: 5,
        },
        <NThemeImage slot="authLogo" alt="Acme" data-testid="auth" />,
      );

      expect(screen.getByTestId("auth").getAttribute("src")).toBe(FACTORY.authLogo);
    } finally {
      if (completeDescriptor) Object.defineProperty(proto, "complete", completeDescriptor);
      if (widthDescriptor) Object.defineProperty(proto, "naturalWidth", widthDescriptor);
      else Reflect.deleteProperty(proto, "naturalWidth");
    }
  });

  it("renders nothing rather than a broken image when every candidate fails", () => {
    mount(
      {
        slots: { ...FACTORY, authLogo: "/api/theme/branding/assets/gone.png" },
        factory: FACTORY,
        revision: 5,
      },
      <NThemeImage slot="authLogo" alt="Acme" data-testid="auth" />,
    );

    fireEvent.error(screen.getByTestId("auth"));
    fireEvent.error(screen.getByTestId("auth"));

    expect(screen.queryByTestId("auth")).toBeNull();
  });

  it("shows a placeholder instead, when the application supplies one", () => {
    mount(
      { slots: { authLogo: null }, factory: FACTORY, revision: 1 },
      <NThemeImage
        slot="unregisteredSlot"
        alt="Acme"
        placeholder={<span data-testid="placeholder">Acme</span>}
      />,
    );

    expect(screen.getByTestId("placeholder")).toBeDefined();
  });

  it("still reports the error to an application that is watching", () => {
    let reported = 0;
    mount(
      {
        slots: { ...FACTORY, authLogo: "/api/theme/branding/assets/gone.png" },
        factory: FACTORY,
        revision: 5,
      },
      <NThemeImage
        slot="authLogo"
        alt="Acme"
        data-testid="auth"
        onError={() => void (reported += 1)}
      />,
    );

    fireEvent.error(screen.getByTestId("auth"));
    expect(reported).toBe(1);
  });

  it("retries a slot whose paths changed after a save", () => {
    const view = mount(
      { slots: { authLogo: "/api/theme/branding/assets/first.png" }, factory: FACTORY, revision: 5 },
      <NThemeImage slot="authLogo" alt="Acme" data-testid="auth" />,
    );

    fireEvent.error(screen.getByTestId("auth"));
    expect(screen.getByTestId("auth").getAttribute("src")).toBe(FACTORY.authLogo);

    view.rerender(
      <NThemeBrandingProvider
        branding={{ slots: { authLogo: "/api/theme/branding/assets/second.png" }, factory: FACTORY, revision: 6 }}
      >
        <NThemeImage slot="authLogo" alt="Acme" data-testid="auth" />
      </NThemeBrandingProvider>,
    );

    expect(screen.getByTestId("auth").getAttribute("src")).toBe(
      "/api/theme/branding/assets/second.png",
    );
  });

  it("refuses to render outside its provider, rather than looking like a missing logo", () => {
    expect(() => render(<NThemeImage slot="authLogo" alt="Acme" />)).toThrow(
      /requires <NThemeBrandingProvider/,
    );
  });
});
