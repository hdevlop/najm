import { describe, test, expect } from "bun:test";
import React from "react";
import { render, fireEvent } from "@testing-library/react";

import {
  NBrandingStateProvider,
  normalizeBranding,
  useNBranding,
  useNBrandingEditor,
} from "../src/index";

/**
 * Reads the marks through `useNBranding` — the hook `NSidebar` uses — so the
 * assertions cover what the chrome actually sees, not the editor's own copy.
 */
function Probe() {
  const branding = useNBranding();
  const editor = useNBrandingEditor();

  return (
    <div>
      <span data-testid="name">{branding?.appName ?? "—"}</span>
      <span data-testid="logo">{String(branding?.logoExpanded ?? "—")}</span>
      <button
        type="button"
        data-testid="swap"
        onClick={() => editor?.setBranding({ logoExpanded: "/uploads/new.png" })}
      >
        swap
      </button>
    </div>
  );
}

describe("NBrandingStateProvider", () => {
  test("seeds from initialBranding and swaps a mark without a remount", () => {
    const { getByTestId } = render(
      <NBrandingStateProvider
        initialBranding={{ appName: "Kafil", logoExpanded: "/factory.png" }}
      >
        <Probe />
      </NBrandingStateProvider>,
    );

    expect(getByTestId("logo").textContent).toBe("/factory.png");

    fireEvent.click(getByTestId("swap"));

    expect(getByTestId("logo").textContent).toBe("/uploads/new.png");
    // A patch, not a replacement: a branding editor writes one slot at a time.
    expect(getByTestId("name").textContent).toBe("Kafil");
  });

  test("a controlled `branding` wins and leaves setBranding inert", () => {
    const { getByTestId } = render(
      <NBrandingStateProvider branding={{ appName: "Kafil", logoExpanded: "/held.png" }}>
        <Probe />
      </NBrandingStateProvider>,
    );

    fireEvent.click(getByTestId("swap"));

    expect(getByTestId("logo").textContent).toBe("/held.png");
  });

  test("useNBrandingEditor returns null outside the state provider", () => {
    const { getByTestId } = render(<Probe />);

    fireEvent.click(getByTestId("swap"));

    expect(getByTestId("name").textContent).toBe("—");
  });
});

/** Reads both logos, since the payload carries a distinct value for each. */
function PathProbe() {
  const branding = useNBranding();
  const editor = useNBrandingEditor();

  return (
    <div>
      <span data-testid="expanded">{String(branding?.logoExpanded ?? "—")}</span>
      <span data-testid="collapsed">
        {String(branding?.logoCollapsed ?? "—")}
      </span>
      <button
        type="button"
        data-testid="save"
        onClick={() =>
          editor?.setBranding({
            sidebarLogoExpandedPath: "/uploads/wide.png",
            sidebarLogoCollapsedPath: "/uploads/mark.png",
          })
        }
      >
        save
      </button>
    </div>
  );
}

/**
 * The shape a branding endpoint actually returns, as an application would
 * declare it. Wider than the kit needs on purpose — the auth slots and the
 * revision are what makes this a payload rather than a set of marks.
 */
interface BrandingResponse {
  sidebarLogoExpandedPath: string;
  sidebarLogoCollapsedPath: string;
  authLogoPath: string;
  authHeroImagePath: string;
  revision: number;
}

describe("branding payload input", () => {
  test("resolves the endpoint's path fields onto the marks", () => {
    const { getByTestId } = render(
      <NBrandingStateProvider
        initialBranding={{
          sidebarLogoExpandedPath: "/factory-wide.png",
          sidebarLogoCollapsedPath: "/factory-mark.png",
        }}
      >
        <PathProbe />
      </NBrandingStateProvider>,
    );

    expect(getByTestId("expanded").textContent).toBe("/factory-wide.png");
    expect(getByTestId("collapsed").textContent).toBe("/factory-mark.png");
  });

  test("an explicit mark beats the payload field", () => {
    const { getByTestId } = render(
      <NBrandingStateProvider
        initialBranding={{
          logoExpanded: "/explicit.png",
          sidebarLogoExpandedPath: "/payload.png",
        }}
      >
        <PathProbe />
      </NBrandingStateProvider>,
    );

    expect(getByTestId("expanded").textContent).toBe("/explicit.png");
  });

  test("setBranding takes the payload, so an editor forwards its response", () => {
    const { getByTestId } = render(
      <NBrandingStateProvider initialBranding={{ logoExpanded: "/old.png" }}>
        <PathProbe />
      </NBrandingStateProvider>,
    );

    fireEvent.click(getByTestId("save"));

    expect(getByTestId("expanded").textContent).toBe("/uploads/wide.png");
    expect(getByTestId("collapsed").textContent).toBe("/uploads/mark.png");
  });

  test("a wider response passes through with its extra fields ignored", () => {
    // Assigned to a variable rather than inlined: excess-property checks only
    // fire on object literals, and tolerating the wider object is the whole
    // point of accepting a payload.
    const response: BrandingResponse = {
      sidebarLogoExpandedPath: "/served/wide.png",
      sidebarLogoCollapsedPath: "/served/mark.png",
      authLogoPath: "/served/auth.png",
      authHeroImagePath: "/served/hero.png",
      revision: 7,
    };

    const { getByTestId } = render(
      <NBrandingStateProvider initialBranding={response}>
        <PathProbe />
      </NBrandingStateProvider>,
    );

    expect(getByTestId("expanded").textContent).toBe("/served/wide.png");
    expect(normalizeBranding(response)).toEqual({
      logoExpanded: "/served/wide.png",
      logoCollapsed: "/served/mark.png",
    });
  });

  test("a patch naming no logo leaves the current ones alone", () => {
    // The regression this guards: projecting a patch must not write
    // `logoExpanded: undefined`, which would clear a mark on merge.
    expect(normalizeBranding({ appName: "Kafil" })).toEqual({
      appName: "Kafil",
    });
  });
});

/**
 * What `najm-theme`'s `loadServerBranding()` returns. A slot registry, not a
 * set of columns — the keys past the two sidebar marks are the reason the kit
 * projects instead of spreading.
 */
interface ThemeBranding {
  slots: Record<string, string | null>;
  factory: Record<string, string | null>;
  revision: number;
}

describe("branding slot registry input", () => {
  const themeBranding: ThemeBranding = {
    slots: {
      sidebarLogoExpanded: "/api/branding/wide.webp",
      sidebarLogoCollapsed: "/api/branding/mark.webp",
      authLogo: "/api/branding/auth.webp",
      authHeroImage: "/api/branding/hero.webp",
    },
    factory: { sidebarLogoExpanded: "/api/branding/factory/wide-abc.webp" },
    revision: 4,
  };

  test("a themed payload passes through unchanged", () => {
    const { getByTestId } = render(
      <NBrandingStateProvider initialBranding={themeBranding}>
        <PathProbe />
      </NBrandingStateProvider>,
    );

    expect(getByTestId("expanded").textContent).toBe("/api/branding/wide.webp");
    expect(getByTestId("collapsed").textContent).toBe("/api/branding/mark.webp");
  });

  test("only the two sidebar slots reach the context", () => {
    // The regression this guards: an auth hero or a consumer's own slot
    // reaching the marks the sidebar reads.
    expect(normalizeBranding(themeBranding)).toEqual({
      logoExpanded: "/api/branding/wide.webp",
      logoCollapsed: "/api/branding/mark.webp",
    });
  });

  test("a flat payload field beats the slot of the same name", () => {
    expect(
      normalizeBranding({ sidebarLogoExpandedPath: "/flat.png", slots: themeBranding.slots }),
    ).toEqual({
      logoExpanded: "/flat.png",
      logoCollapsed: "/api/branding/mark.webp",
    });
  });

  test("a slot resolving to nothing clears the mark, like a null path", () => {
    // `null` is the registry saying the slot has no image, so it clears on
    // merge exactly as `sidebarLogoExpandedPath: null` does. A slot the
    // payload never mentions is the case that must leave a mark alone.
    expect(normalizeBranding({ slots: { sidebarLogoExpanded: null } })).toEqual({
      logoExpanded: null,
    });
    expect(normalizeBranding({ slots: { authLogo: "/auth.png" } })).toEqual({});
  });
});
