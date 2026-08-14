import { describe, expect, test } from "bun:test";
import React from "react";
import { act, render } from "@testing-library/react";
import { Inbox } from "lucide-react";

import { NLoadingState } from "../../src/components/feedback/NLoadingState";
import { NErrorState } from "../../src/components/feedback/NErrorState";
import { NEmptyState } from "../../src/components/feedback/NEmptyState";
import { NForbiddenState } from "../../src/components/feedback/NForbiddenState";
import { NNotFoundState } from "../../src/components/feedback/NNotFoundState";
import { NajmUIProvider } from "../../src/providers";
import type { NajmUIProviderProps } from "../../src/providers";
import { useNajmPreferencesContext } from "../../src/providers/preferences";
import type { NajmTranslate } from "../../src/providers/paginationLabels";

/**
 * Move 1 — shared feedback surfaces.
 *
 * The bar is: every existing inline consumer keeps rendering the same DOM as it
 * did at 2.10.0, and every new `surface` produces the documented layout
 * without leaking a `<main>` landmark.
 */

function Probe({ children }: { children: React.ReactNode }) {
  // Reading the preferences context keeps the tree mounted under a real
  // NajmUIProvider without forcing a theme cookie write. The components under
  // test read feedback defaults through their own provider, not this one.
  useNajmPreferencesContext();
  return <>{children}</>;
}

function mount(
  ui: React.ReactNode,
  feedbackDefaults?: NajmUIProviderProps["feedbackDefaults"],
  t?: NajmTranslate,
) {
  return render(
    <NajmUIProvider feedbackDefaults={feedbackDefaults} t={t}>
      <Probe>{ui}</Probe>
    </NajmUIProvider>,
  );
}

function countMain(container: HTMLElement): number {
  return container.querySelectorAll("main").length;
}

describe("Move 1 — NLoadingState inline backward compatibility", () => {
  test("renders the default English label and a spinner", () => {
    const { container } = render(<NLoadingState />);
    expect(container.textContent).toBe("Loading...");
    expect(container.querySelector("svg")).toBeTruthy();
  });

  test("preserves py-8 spacing and gap-3 for the inline surface", () => {
    const { container } = render(<NLoadingState />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain("py-8");
    expect(root.className).toContain("gap-3");
  });

  test("an explicit className overrides the inline frame", () => {
    const { container } = render(<NLoadingState className="my-loading" />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain("my-loading");
  });

  test("fullScreen wins over surface", () => {
    const { container } = render(<NLoadingState fullScreen surface="panel" />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain("fixed");
    expect(root.className).toContain("inset-0");
  });

  test("uses role=status and aria-live=polite for inline loading", () => {
    const { container } = render(<NLoadingState />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.getAttribute("role")).toBe("status");
    expect(root.getAttribute("aria-live")).toBe("polite");
    expect(root.getAttribute("aria-busy")).toBe("true");
  });

  test("an explicit empty label still hides the text", () => {
    const { container } = render(<NLoadingState label="" />);
    expect(container.querySelector("p")).toBeNull();
  });
});

describe("Move 1 — NErrorState inline backward compatibility", () => {
  test("renders the default English title and an alert icon", () => {
    const { container } = render(<NErrorState />);
    expect(container.textContent).toContain("Something went wrong");
    expect(container.querySelector("svg")).toBeTruthy();
  });

  test("uses an alert role", () => {
    const { container } = render(<NErrorState title="Boom" />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.getAttribute("role")).toBe("alert");
  });

  test("renders a real heading when a title is present", () => {
    const { container } = render(<NErrorState title="Boom" />);
    expect(container.querySelector("h3")).not.toBeNull();
    expect(container.querySelector("h3")?.textContent).toBe("Boom");
  });

  test("hides the retry button when onRetry is absent", () => {
    const { container } = render(<NErrorState title="Boom" />);
    expect(container.querySelector("button")).toBeNull();
  });

  test("renders a localized retry button and fires onRetry on click", () => {
    let clicked = 0;
    const { getByRole } = render(
      <NErrorState title="Boom" retryLabel="Retry sync" onRetry={() => { clicked++; }} />,
    );
    const button = getByRole("button", { name: "Retry sync" });
    button.click();
    expect(clicked).toBe(1);
  });

  test("renders no body paragraph when message is omitted", () => {
    const { container } = render(<NErrorState title="Boom" />);
    expect(container.querySelectorAll("p").length).toBe(0);
  });
});

describe("Move 1 — NEmptyState inline backward compatibility", () => {
  test("renders the default English title", () => {
    const { container } = render(<NEmptyState />);
    expect(container.textContent).toContain("No data");
  });

  test("renders no icon by default and no description paragraph", () => {
    const { container } = render(<NEmptyState title="Empty" />);
    expect(container.querySelector("svg")).toBeNull();
    expect(container.querySelectorAll("p").length).toBe(0);
  });

  test("renders a heading only when a title is present", () => {
    const { container } = render(<NEmptyState title="Items" />);
    expect(container.querySelector("h3")?.textContent).toBe("Items");
  });

  test("accepts a Lucide icon component", () => {
    const { container } = render(<NEmptyState title="Empty" icon={Inbox} />);
    expect(container.querySelector("svg")).not.toBeNull();
  });

  test("accepts a React element icon without dropping its className", () => {
    const { container, getByTestId } = render(
      <NEmptyState
        title="Empty"
        icon={<span data-testid="custom-icon" className="text-primary" />}
      />,
    );
    const icon = getByTestId("custom-icon");
    expect(icon).not.toBeNull();
    expect(icon.className).toContain("text-primary");
    // No double-render: the icon should be exactly one element, not the
    // default plus the override stacked.
    expect(container.querySelectorAll("[data-testid=custom-icon]").length).toBe(1);
  });

  test("renders the action slot when provided", () => {
    const { getByRole } = render(
      <NEmptyState title="Empty" action={<button type="button">Add</button>} />,
    );
    expect(getByRole("button", { name: "Add" })).not.toBeNull();
  });
});

describe("Move 1 — surface contract", () => {
  test("panel renders no <main>, no page gutter, and centers content", () => {
    const { container } = render(<NLoadingState surface="panel" />);
    expect(countMain(container)).toBe(0);
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.paddingInline || "").toBe("");
    expect(root.className).toContain("flex-col");
    expect(root.className).toContain("items-center");
    expect(root.className).toContain("justify-center");
    expect(root.className).toContain("gap-3");
    expect(root.className).not.toContain("grid");
    expect(root.className).toContain("min-h-64");
  });

  test("page uses NPageLayout as='div' and never introduces a <main>", () => {
    const { container } = render(<NLoadingState surface="page" />);
    expect(countMain(container)).toBe(0);
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.getPropertyValue("--najm-page-gutter")).not.toBe("");
    expect(root.style.getPropertyValue("--najm-section-gap")).not.toBe("");
  });

  test("page surface on NErrorState still renders no nested <main>", () => {
    const { container } = render(<NErrorState surface="page" title="Boom" />);
    expect(countMain(container)).toBe(0);
  });

  test("page surface on NEmptyState still renders no nested <main>", () => {
    const { container } = render(<NEmptyState surface="page" title="Empty" />);
    expect(countMain(container)).toBe(0);
  });

  test("explicit className is preserved on every surface", () => {
    const { container } = render(<NLoadingState surface="panel" className="custom" />);
    expect(container.firstElementChild?.className).toContain("custom");
  });

  test("loading surface=page still respects fullScreen", () => {
    const { container } = render(<NLoadingState surface="page" fullScreen />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain("fixed");
    expect(root.className).toContain("inset-0");
  });
});

describe("Move 2 — provider-driven feedback labels", () => {
  test("a literal default replaces the English fallback", () => {
    const { getByText } = mount(<NEmptyState />, {
      labels: { emptyTitle: "Aucune donnée" },
    });
    expect(getByText("Aucune donnée")).not.toBeNull();
  });

  test("a translated key resolves through the provider t", () => {
    const t = ((key: string) =>
      ({ "common.feedback.emptyTitle": "Sin datos" } as Record<string, string>)[key] ??
      key) as NajmTranslate;
    const { getByText } = mount(
      <NEmptyState />,
      { labelKeys: { emptyTitle: "common.feedback.emptyTitle" } },
      t,
    );
    expect(getByText("Sin datos")).not.toBeNull();
  });

  test("explicit prop beats literal default beats key beats English", () => {
    const t = ((key: string) =>
      ({ "common.feedback.emptyTitle": "Sin datos" } as Record<string, string>)[key] ??
      key) as NajmTranslate;
    const { getByText, queryByText } = mount(
      <NEmptyState title="Custom" />,
      {
        labels: { emptyTitle: "literal" },
        labelKeys: { emptyTitle: "common.feedback.emptyTitle" },
      },
      t,
    );
    expect(getByText("Custom")).not.toBeNull();
    expect(queryByText("literal")).toBeNull();
    expect(queryByText("Sin datos")).toBeNull();
  });

  test("a language change rerenders translated feedback labels", () => {
    function Switcher({ lang }: { lang: "en" | "fr" }) {
      const dict: Record<string, string> =
        lang === "fr"
          ? { "common.feedback.emptyTitle": "Vide" }
          : { "common.feedback.emptyTitle": "No data" };
      const t = (k: string) => dict[k] ?? k;
      return (
        <NajmUIProvider
          t={t}
          feedbackDefaults={{
            labelKeys: { emptyTitle: "common.feedback.emptyTitle" },
          }}
        >
          <Probe>
            <NEmptyState />
          </Probe>
        </NajmUIProvider>
      );
    }
    const { rerender, getByText, queryByText } = render(<Switcher lang="en" />);
    expect(getByText("No data")).not.toBeNull();
    act(() => rerender(<Switcher lang="fr" />));
    expect(getByText("Vide")).not.toBeNull();
    expect(queryByText("No data")).toBeNull();
  });

  test("a configured errorMessage renders when message is omitted", () => {
    const { getByText } = mount(<NErrorState />, {
      labels: { errorMessage: "Échec de la requête" },
    });
    expect(getByText("Échec de la requête")).not.toBeNull();
  });

  test("NErrorState without provider still renders no body when message is omitted", () => {
    const { container } = render(<NErrorState title="Boom" />);
    expect(container.querySelectorAll("p").length).toBe(0);
  });

  test("NEmptyState description never receives a packaged default", () => {
    const { container } = render(<NEmptyState title="Empty" />);
    expect(container.querySelectorAll("p").length).toBe(0);
  });

  test("retry label resolves through provider literal default", () => {
    const { getByRole } = mount(<NErrorState title="Boom" onRetry={() => {}} />, {
      labels: { retryLabel: "Réessayer" },
    });
    expect(getByRole("button", { name: "Réessayer" })).not.toBeNull();
  });
});

describe("Move 3 — NForbiddenState and NNotFoundState", () => {
  test("NForbiddenState defaults to surface=page and ShieldOff icon", () => {
    const { container } = render(<NForbiddenState />);
    expect(countMain(container)).toBe(0);
    expect(container.querySelector("svg")).not.toBeNull();
  });

  test("NNotFoundState defaults to surface=page and Compass icon", () => {
    const { container } = render(<NNotFoundState />);
    expect(countMain(container)).toBe(0);
    expect(container.querySelector("svg")).not.toBeNull();
  });

  test("NForbiddenState uses provider forbidden copy", () => {
    const { getByText } = mount(<NForbiddenState />, {
      labels: {
        forbiddenTitle: "Accès refusé",
        forbiddenDescription: "Vous n'avez pas la permission.",
      },
    });
    expect(getByText("Accès refusé")).not.toBeNull();
    expect(getByText("Vous n'avez pas la permission.")).not.toBeNull();
  });

  test("NNotFoundState uses provider not-found copy", () => {
    const { getByText } = mount(<NNotFoundState />, {
      labels: {
        notFoundTitle: "Page introuvable",
        notFoundDescription: "La page demandée n'existe pas.",
      },
    });
    expect(getByText("Page introuvable")).not.toBeNull();
    expect(getByText("La page demandée n'existe pas.")).not.toBeNull();
  });

  test("explicit title and description win on NForbiddenState", () => {
    const { getByText, queryByText } = mount(
      <NForbiddenState
        title="Custom forbidden"
        description="Custom description"
      />,
      {
        labels: {
          forbiddenTitle: "Provider forbidden",
          forbiddenDescription: "Provider description",
        },
      },
    );
    expect(getByText("Custom forbidden")).not.toBeNull();
    expect(getByText("Custom description")).not.toBeNull();
    expect(queryByText("Provider forbidden")).toBeNull();
    expect(queryByText("Provider description")).toBeNull();
  });

  test("consumer-provided icon override wins on NForbiddenState", () => {
    const { container, getByTestId } = render(
      <NForbiddenState icon={<span data-testid="custom-forbidden-icon" />} />,
    );
    expect(getByTestId("custom-forbidden-icon")).not.toBeNull();
    // No fallback ShieldOff should be rendered alongside the override.
    expect(container.querySelectorAll("svg").length).toBe(0);
  });

  test("NForbiddenState and NNotFoundState accept the action slot", () => {
    const r1 = render(
      <NForbiddenState action={<button type="button">Go home</button>} />,
    );
    expect(r1.getByRole("button", { name: "Go home" })).not.toBeNull();
    r1.unmount();
    const r2 = render(
      <NNotFoundState action={<button type="button">Back</button>} />,
    );
    expect(r2.getByRole("button", { name: "Back" })).not.toBeNull();
    r2.unmount();
  });
});

describe("Move 4 — accessibility contract", () => {
  test("loading inline is announced as a polite status", () => {
    const { container } = render(<NLoadingState label="Fetching" />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.getAttribute("role")).toBe("status");
    expect(root.getAttribute("aria-live")).toBe("polite");
  });

  test("error inline is announced as an alert", () => {
    const { container } = render(<NErrorState title="Boom" />);
    expect(container.firstElementChild?.getAttribute("role")).toBe("alert");
  });

  test("retry button is reachable and keyboard-operable", () => {
    let fired = 0;
    const { getByRole } = render(
      <NErrorState title="Boom" onRetry={() => { fired++; }} />,
    );
    const button = getByRole("button");
    button.focus();
    expect(document.activeElement).toBe(button);
    button.click();
    expect(fired).toBe(1);
  });

  test("default error icon is aria-hidden", () => {
    const { container } = render(<NErrorState title="Boom" />);
    const icon = container.querySelector("svg");
    expect(icon?.getAttribute("aria-hidden")).toBe("true");
  });

  test("decorative Lucide default icon on NEmptyState is aria-hidden", () => {
    const { container } = render(<NEmptyState title="Empty" icon={Inbox} />);
    const icon = container.querySelector("svg");
    expect(icon?.getAttribute("aria-hidden")).toBe("true");
  });
});
