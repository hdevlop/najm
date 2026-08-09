import { describe, expect, test } from "bun:test";
import React from "react";
import { fireEvent, render } from "@testing-library/react";

import { NBadge } from "../src/components/Badge";
import type { NBadgeDefaults } from "../src/components/Badge";
import { NajmUIProvider } from "../src/providers";

/** The application's catalog keys and the application's status vocabulary. */
const LABEL_KEYS: Record<string, string> = {
  active: "status.active",
  out_for_delivery: "status.outForDelivery",
  pending_funding: "status.pendingFunding",
};

const CATALOGS: Record<string, Record<string, string>> = {
  en: {
    "status.active": "Active",
    "status.outForDelivery": "Out for delivery",
    "status.pendingFunding": "Awaiting funding",
  },
  fr: {
    "status.active": "Actif",
    "status.outForDelivery": "En cours de livraison",
    "status.pendingFunding": "En attente de financement",
  },
};

function mount(
  ui: React.ReactNode,
  badgeDefaults?: NBadgeDefaults,
  language = "en",
) {
  return render(
    <NajmUIProvider
      badgeDefaults={badgeDefaults}
      t={(key) => CATALOGS[language]![key] ?? key}
    >
      {ui}
    </NajmUIProvider>,
  );
}

const badge = (container: HTMLElement) =>
  container.querySelector("[data-slot=badge]")!;

describe("NBadge without a provider", () => {
  test("behaves exactly as before", () => {
    const { container } = render(<NBadge status="out-for-delivery" look="soft" />);

    expect(container.textContent).toContain("Out For Delivery");
    expect(badge(container).className).toContain("bg-warning/10");
  });

  test("a content badge keeps its own defaults", () => {
    const { container } = render(<NBadge>Beta</NBadge>);

    expect(container.textContent).toContain("Beta");
    expect(badge(container).className).toContain("bg-primary");
  });
});

describe("NBadge provider visual defaults", () => {
  test("applies look, shape and size to a status badge", () => {
    const { container } = mount(<NBadge status="active" />, {
      look: "soft",
      shape: "pill",
      size: "lg",
    });

    const className = badge(container).className;
    expect(className).toContain("bg-success/10");
    expect(className).toContain("rounded-full");
    expect(className).toContain("text-sm");
  });

  test("leaves a non-status badge untouched", () => {
    const { container } = mount(<NBadge>Beta</NBadge>, {
      look: "soft",
      shape: "pill",
    });

    // Provider policy is status policy: a content badge is not a lifecycle
    // state and must not be restyled by one.
    const className = badge(container).className;
    expect(className).toContain("bg-primary");
    expect(className).not.toContain("rounded-full");
  });

  test("an explicit prop wins over every provider default", () => {
    const { container } = mount(<NBadge status="active" look="solid" shape="square" />, {
      look: "soft",
      shape: "pill",
    });

    const className = badge(container).className;
    expect(className).toContain("bg-success");
    expect(className).not.toContain("bg-success/10");
    expect(className).toContain("rounded-none");
  });
});

describe("NBadge provider labels", () => {
  test("translates a mapped status through the provider's t", () => {
    const { container } = mount(<NBadge status="out_for_delivery" />, {
      statusLabelKeys: LABEL_KEYS,
    });

    expect(container.textContent).toContain("Out for delivery");
  });

  test("normalizes the status the same way the color lookup does", () => {
    const { container } = mount(<NBadge status=" Out-For-Delivery " />, {
      statusLabelKeys: LABEL_KEYS,
    });

    expect(container.textContent).toContain("Out for delivery");
    expect(badge(container).className).toContain("warning");
  });

  test("humanizes a status the application does not map", () => {
    const { container } = mount(<NBadge status="nebulous_state" />, {
      statusLabelKeys: LABEL_KEYS,
    });

    expect(container.textContent).toContain("Nebulous State");
    expect(badge(container).className).toContain("neutral");
  });

  test("a literal statusLabel wins over a catalog key", () => {
    const { container } = mount(<NBadge status="active" />, {
      statusLabelKeys: LABEL_KEYS,
      statusLabels: { active: "Live" },
    });

    expect(container.textContent).toContain("Live");
  });

  test("an explicit label wins over the provider's label", () => {
    const { container } = mount(<NBadge status="active" label="Enrolled" />, {
      statusLabelKeys: LABEL_KEYS,
    });

    expect(container.textContent).toContain("Enrolled");
  });

  test("string children win over the provider's label", () => {
    const { container } = mount(
      <NBadge status="active">Currently active</NBadge>,
      { statusLabelKeys: LABEL_KEYS },
    );

    expect(container.textContent).toContain("Currently active");
  });

  test("a mapped key with no translator falls through to the humanized token", () => {
    const { container } = render(
      <NajmUIProvider badgeDefaults={{ statusLabelKeys: LABEL_KEYS }}>
        <NBadge status="out_for_delivery" />
      </NajmUIProvider>,
    );

    // Rendering the raw catalog key would put debug text in the interface.
    expect(container.textContent).toContain("Out For Delivery");
    expect(container.textContent).not.toContain("status.outForDelivery");
  });
});

describe("NBadge provider maps", () => {
  test("colors a status the packaged vocabulary does not know", () => {
    const { container } = mount(<NBadge status="pending_funding" look="soft" />, {
      statusMap: { pending_funding: "info" },
    });

    expect(badge(container).className).toContain("bg-info/10");
  });

  test("a per-instance statusMap merges over the provider's rather than replacing it", () => {
    const defaults: NBadgeDefaults = {
      statusMap: { pending_funding: "info", bespoke: "warning" },
    };

    const { container: overridden } = mount(
      <NBadge status="pending_funding" look="soft" statusMap={{ pending_funding: "destructive" }} />,
      defaults,
    );
    expect(badge(overridden).className).toContain("bg-destructive/10");

    const { container: untouched } = mount(
      <NBadge status="bespoke" look="soft" statusMap={{ pending_funding: "destructive" }} />,
      defaults,
    );
    // The unrelated provider entry survived the local override.
    expect(badge(untouched).className).toContain("bg-warning/10");
  });

  test("provider iconMap and showIcon reach a status badge", () => {
    const { container } = mount(<NBadge status="active" />, {
      showIcon: true,
      iconMap: { success: "circle-check" },
    });

    expect(container.querySelector("svg")?.getAttribute("class")).toContain(
      "lucide-circle-check",
    );
  });

  test("a per-instance icon wins over the mapped one", () => {
    const { container } = mount(<NBadge status="active" icon="info" />, {
      showIcon: true,
      iconMap: { success: "circle-check" },
    });

    expect(container.querySelector("svg")?.getAttribute("class")).toContain(
      "lucide-info",
    );
  });

  test("no icon without showIcon, from either source", () => {
    const { container } = mount(<NBadge status="active" />, {
      iconMap: { success: "circle-check" },
    });

    expect(container.querySelector("svg")).toBeNull();
  });
});

describe("NBadge live language change", () => {
  test("recomputes translated labels without remounting", () => {
    function App() {
      const [language, setLanguage] = React.useState("en");
      const t = React.useCallback(
        (key: string) => CATALOGS[language]![key] ?? key,
        [language],
      );

      return (
        <NajmUIProvider t={t} badgeDefaults={{ statusLabelKeys: LABEL_KEYS }}>
          <button type="button" onClick={() => setLanguage("fr")}>
            switch
          </button>
          <NBadge status="pending_funding" />
        </NajmUIProvider>
      );
    }

    const { container, getByRole } = render(<App />);
    const before = badge(container);
    expect(container.textContent).toContain("Awaiting funding");

    fireEvent.click(getByRole("button"));

    expect(container.textContent).toContain("En attente de financement");
    // The same element: a language switch is a re-render, not a remount, so
    // nothing below it loses state.
    expect(badge(container)).toBe(before);
  });
});
