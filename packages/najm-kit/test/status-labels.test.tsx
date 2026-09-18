import { describe, expect, test } from "bun:test";
import React from "react";
import { fireEvent, render } from "@testing-library/react";

import { NBadge, resolveStatusColor } from "../src/components/Badge";
import type { NBadgeDefaults } from "../src/components/Badge";
import {
  NAJM_STATUS_LABELS,
  findStatusLabel,
  formatStatusLabel,
  resolveStatusLabelLanguage,
} from "../src/format";
import { NajmUIProvider } from "../src/providers";

const badge = (container: HTMLElement) =>
  container.querySelector("[data-slot=badge]")!;

function mount(
  ui: React.ReactNode,
  badgeDefaults?: NBadgeDefaults,
  options: { t?: (key: string) => string; language?: string } = {},
) {
  return render(
    <NajmUIProvider
      badgeDefaults={badgeDefaults}
      t={options.t}
      language={options.language}
    >
      {ui}
    </NajmUIProvider>,
  );
}

/**
 * A catalog keyed by the convention, with the application's own wording for one
 * status. This is the shape that lets an application delete its token-to-key
 * table: nothing below registers `in_preparation` anywhere.
 */
const CONVENTIONAL: Record<string, Record<string, string>> = {
  en: {
    "status.in_preparation": "Purchasing and preparation",
    "status.delivered": "Handed over",
  },
  fr: {
    "status.in_preparation": "Achat et préparation",
    "status.delivered": "Remise effectuée",
  },
};

const conventionalT = (language: string) => (key: string) =>
  CONVENTIONAL[language]?.[key] ?? key;

describe("shared status colors", () => {
  test("cover the lifecycle, payment and attendance tokens both apps render", () => {
    const expected: Record<string, string> = {
      active: "success",
      paid: "success",
      present: "success",
      pending: "warning",
      pending_funding: "warning",
      partially_paid: "warning",
      late: "warning",
      purchased: "info",
      scheduled: "info",
      absent: "neutral",
      ended: "neutral",
      archived: "neutral",
      overdue: "destructive",
      unpaid: "destructive",
      expired: "destructive",
    };

    for (const [status, color] of Object.entries(expected)) {
      expect(resolveStatusColor(status)).toBe(color as never);
    }
  });

  test("an application override replaces one key and leaves the rest packaged", () => {
    const statusMap = { draft: "info" } as const;

    expect(resolveStatusColor("draft", statusMap)).toBe("info");
    // The packaged neighbours survived the override.
    expect(resolveStatusColor("archived", statusMap)).toBe("neutral");
    expect(resolveStatusColor("paid", statusMap)).toBe("success");
  });

  test("an unknown token stays neutral", () => {
    expect(resolveStatusColor("nebulous_state")).toBe("neutral");
  });
});

describe("packaged labels", () => {
  test("answer in each shipped language", () => {
    expect(formatStatusLabel("out_for_delivery", { language: "en" })).toBe(
      "Out for delivery",
    );
    expect(formatStatusLabel("out_for_delivery", { language: "fr" })).toBe(
      "En cours de livraison",
    );
    expect(formatStatusLabel("out_for_delivery", { language: "ar" })).toBe(
      "قيد التوصيل",
    );
    expect(formatStatusLabel("out_for_delivery", { language: "es" })).toBe(
      "En reparto",
    );
  });

  test("cover every packaged status in every packaged language", () => {
    const english = Object.keys(NAJM_STATUS_LABELS.en!);

    for (const [language, table] of Object.entries(NAJM_STATUS_LABELS)) {
      expect(Object.keys(table).sort()).toEqual(english.sort());
      for (const token of english) {
        expect(table[token]!.length).toBeGreaterThan(0);
      }
      expect(language.length).toBeGreaterThan(0);
    }
  });

  test("a regional tag resolves to its base language", () => {
    expect(resolveStatusLabelLanguage("fr-MA")).toBe("fr");
    expect(resolveStatusLabelLanguage("AR_ma")).toBe("ar");
    expect(formatStatusLabel("paid", { language: "es-MA" })).toBe("Pagado");
  });

  test("an unpackaged language falls back to English rather than the tag", () => {
    expect(resolveStatusLabelLanguage("de")).toBe("en");
    expect(formatStatusLabel("paid", { language: "de" })).toBe("Paid");
  });

  test("normalize the token the same way the color lookup does", () => {
    for (const status of [" Out-For-Delivery ", "out for delivery", "OUT_FOR_DELIVERY"]) {
      expect(formatStatusLabel(status, { language: "fr" })).toBe(
        "En cours de livraison",
      );
    }
  });

  test("an unknown token humanizes and claims nothing", () => {
    expect(findStatusLabel("nebulous_state")).toBeUndefined();
    expect(formatStatusLabel("nebulous_state")).toBe("Nebulous State");
    expect(formatStatusLabel("nebulous_state", { language: "fr" })).toBe(
      "Nebulous State",
    );
  });
});

describe("label precedence", () => {
  const options = {
    language: "fr",
    labels: { delivered: "Chez le client" },
    labelKeys: { purchased: "status.in_preparation" },
    t: conventionalT("fr"),
  };

  test("an application literal wins over everything behind it", () => {
    expect(formatStatusLabel("delivered", options)).toBe("Chez le client");
  });

  test("a mapped catalog key wins over the convention and the package", () => {
    expect(formatStatusLabel("purchased", options)).toBe("Achat et préparation");
  });

  test("the conventional catalog entry wins over the packaged label", () => {
    expect(
      formatStatusLabel("in_preparation", { language: "fr", t: conventionalT("fr") }),
    ).toBe("Achat et préparation");
  });

  test("the packaged label fills in where the catalog is silent", () => {
    expect(
      formatStatusLabel("refunded", { language: "fr", t: conventionalT("fr") }),
    ).toBe("Remboursé");
  });

  test("a catalog key that resolves to nothing never renders as itself", () => {
    const resolved = formatStatusLabel("refunded", {
      language: "es",
      labelKeys: { refunded: "status.missingEntirely" },
      t: conventionalT("en"),
    });

    expect(resolved).not.toContain("status.");
    expect(resolved).toBe("Reembolsado");
  });

  test("an empty prefix switches the convention off", () => {
    expect(
      formatStatusLabel("delivered", {
        language: "en",
        keyPrefix: "",
        t: conventionalT("en"),
      }),
    ).toBe("Delivered");
  });

  test("a custom prefix is honoured", () => {
    const t = (key: string) =>
      key === "orderState.delivered" ? "Dropped off" : key;

    expect(
      formatStatusLabel("delivered", { keyPrefix: "orderState", t }),
    ).toBe("Dropped off");
  });
});

describe("NBadge and the plain-text resolver agree", () => {
  test("on the same inputs, with no application label map", () => {
    const cases = ["in_preparation", "refunded", "delivered", "nebulous_state"];

    for (const status of cases) {
      const { container } = mount(<NBadge status={status} />, undefined, {
        t: conventionalT("fr"),
        language: "fr",
      });

      expect(container.textContent).toBe(
        formatStatusLabel(status, { language: "fr", t: conventionalT("fr") }),
      );
    }
  });

  test("an explicit label still wins on the badge", () => {
    const { container } = mount(<NBadge status="delivered" label="Signed for" />);

    expect(container.textContent).toBe("Signed for");
  });

  test("string children still win on the badge", () => {
    const { container } = mount(<NBadge status="delivered">At the door</NBadge>);

    expect(container.textContent).toBe("At the door");
  });
});

describe("live language change", () => {
  test("relabels packaged statuses without remounting or an app map", () => {
    function App() {
      const [language, setLanguage] = React.useState("en");

      return (
        <NajmUIProvider language={language}>
          <button type="button" onClick={() => setLanguage("ar")}>
            switch
          </button>
          <NBadge status="pending_funding" />
        </NajmUIProvider>
      );
    }

    const { container, getByRole } = render(<App />);
    const before = badge(container);
    expect(container.textContent).toContain("Pending funding");

    fireEvent.click(getByRole("button"));

    expect(container.textContent).toContain("بانتظار التمويل");
    expect(badge(container)).toBe(before);
  });
});

describe("status appearance defaults", () => {
  test("a status badge is soft and pill-shaped", () => {
    const { container } = mount(<NBadge status="pending" />);

    const className = badge(container).className;
    expect(className).toContain("bg-warning/10");
    expect(className).toContain("rounded-full");
  });

  test("a content badge keeps the solid primary it has always had", () => {
    const { container } = mount(<NBadge>Beta</NBadge>);

    const className = badge(container).className;
    expect(className).toContain("bg-primary");
    expect(className).not.toContain("bg-primary/10");
    expect(className).not.toContain("rounded-full");
  });

  test("an explicit look or shape wins over the packaged default", () => {
    const { container } = mount(<NBadge status="pending" look="solid" shape="square" />);

    const className = badge(container).className;
    expect(className).toContain("bg-warning");
    expect(className).not.toContain("bg-warning/10");
    expect(className).toContain("rounded-none");
  });

  test("a provider look wins over the packaged default", () => {
    const { container } = mount(<NBadge status="pending" />, { look: "outline" });

    const className = badge(container).className;
    expect(className).toContain("bg-transparent");
    expect(className).toContain("border-warning/60");
  });

  test("icons still come from the provider map only when asked", () => {
    const { container } = mount(<NBadge status="active" />, {
      showIcon: true,
      iconMap: { success: "circle-check" },
    });

    expect(container.querySelector("svg")?.getAttribute("class")).toContain(
      "lucide-circle-check",
    );
  });
});

describe("separate provider trees", () => {
  test("keep their own policies and languages", () => {
    const { container } = render(
      <div>
        <NajmUIProvider language="fr">
          <div data-testid="left">
            <NBadge status="refunded" />
          </div>
        </NajmUIProvider>
        <NajmUIProvider
          language="es"
          badgeDefaults={{ statusLabels: { refunded: "Devuelto a mano" } }}
        >
          <div data-testid="right">
            <NBadge status="refunded" />
          </div>
        </NajmUIProvider>
      </div>,
    );

    expect(container.querySelector("[data-testid=left]")!.textContent).toBe(
      "Remboursé",
    );
    expect(container.querySelector("[data-testid=right]")!.textContent).toBe(
      "Devuelto a mano",
    );
  });
});
