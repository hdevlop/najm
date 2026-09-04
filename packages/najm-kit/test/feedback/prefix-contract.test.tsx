import { describe, expect, test } from "bun:test";
import React from "react";
import { act, render } from "@testing-library/react";

import { NEmptyState } from "../../src/components/feedback/NEmptyState";
import { NErrorState } from "../../src/components/feedback/NErrorState";
import { NLoadingState } from "../../src/components/feedback/NLoadingState";
import {
  DEFAULT_FEEDBACK_KEY_PREFIX,
  ENGLISH_FEEDBACK_LABELS,
} from "../../src/components/feedback/feedbackDefaults";
import { NajmUIProvider } from "../../src/providers";
import type { NajmUIProviderProps } from "../../src/providers";
import { useNajmPreferencesContext } from "../../src/providers/preferences";
import type { NajmTranslate } from "../../src/providers/paginationLabels";

/**
 * The `<prefix>.<field>` convention the kit documented but did not read.
 *
 * The point of the contract is that an application whose catalog already uses
 * these keys mounts the provider with a translator and *no* `feedbackDefaults`
 * at all — the nine-field mapping every consumer was hand-writing goes away.
 */

function Probe({ children }: { children: React.ReactNode }) {
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

/** A catalog-shaped translator that echoes anything it does not know. */
function translator(dictionary: Record<string, string>): NajmTranslate {
  return ((key: string) => dictionary[key] ?? key) as NajmTranslate;
}

describe("feedback prefix contract", () => {
  test("the default prefix resolves with no feedbackDefaults at all", () => {
    const t = translator({
      [`${DEFAULT_FEEDBACK_KEY_PREFIX}.emptyTitle`]: "Aucune donnée",
      [`${DEFAULT_FEEDBACK_KEY_PREFIX}.loadingLabel`]: "Chargement…",
    });

    const empty = mount(<NEmptyState />, undefined, t);
    expect(empty.getByText("Aucune donnée")).not.toBeNull();

    const loading = mount(<NLoadingState />, undefined, t);
    expect(loading.getByText("Chargement…")).not.toBeNull();
  });

  test("a custom prefix is read instead of the default", () => {
    const t = translator({ "app.states.emptyTitle": "Rien ici" });
    const { getByText } = mount(
      <NEmptyState />,
      { prefix: "app.states" },
      t,
    );
    expect(getByText("Rien ici")).not.toBeNull();
  });

  test("an explicit labelKey wins over the prefix key", () => {
    const t = translator({
      "custom.empty": "Explicit",
      [`${DEFAULT_FEEDBACK_KEY_PREFIX}.emptyTitle`]: "By prefix",
    });
    const { getByText, queryByText } = mount(
      <NEmptyState />,
      { labelKeys: { emptyTitle: "custom.empty" } },
      t,
    );
    expect(getByText("Explicit")).not.toBeNull();
    expect(queryByText("By prefix")).toBeNull();
  });

  test("a literal label wins over both", () => {
    const t = translator({
      "custom.empty": "Explicit",
      [`${DEFAULT_FEEDBACK_KEY_PREFIX}.emptyTitle`]: "By prefix",
    });
    const { getByText, queryByText } = mount(
      <NEmptyState />,
      {
        labels: { emptyTitle: "Literal" },
        labelKeys: { emptyTitle: "custom.empty" },
      },
      t,
    );
    expect(getByText("Literal")).not.toBeNull();
    expect(queryByText("Explicit")).toBeNull();
    expect(queryByText("By prefix")).toBeNull();
  });

  test("an unanswered prefix key renders packaged English, never the key", () => {
    // The application never adopted the convention: its translator echoes.
    const { getByText, queryByText } = mount(<NEmptyState />, undefined, translator({}));
    expect(getByText(ENGLISH_FEEDBACK_LABELS.emptyTitle)).not.toBeNull();
    expect(queryByText(`${DEFAULT_FEEDBACK_KEY_PREFIX}.emptyTitle`)).toBeNull();
  });

  test("an unanswered explicit labelKey also falls through to English", () => {
    const { getByText, queryByText } = mount(
      <NEmptyState />,
      { labelKeys: { emptyTitle: "typo.in.the.key" } },
      translator({}),
    );
    expect(getByText(ENGLISH_FEEDBACK_LABELS.emptyTitle)).not.toBeNull();
    expect(queryByText("typo.in.the.key")).toBeNull();
  });

  test("errorMessage has no packaged fallback, so an unanswered key renders no body", () => {
    const { container } = mount(<NErrorState title="Boom" />, undefined, translator({}));
    expect(container.querySelectorAll("p").length).toBe(0);
  });

  test("errorMessage resolves from the prefix when the catalog answers", () => {
    const t = translator({
      [`${DEFAULT_FEEDBACK_KEY_PREFIX}.errorMessage`]: "Réessayez plus tard.",
    });
    const { getByText } = mount(<NErrorState title="Boom" />, undefined, t);
    expect(getByText("Réessayez plus tard.")).not.toBeNull();
  });

  test("no translator at all still renders packaged English", () => {
    const { getByText } = mount(<NEmptyState />);
    expect(getByText(ENGLISH_FEEDBACK_LABELS.emptyTitle)).not.toBeNull();
  });

  test("a language change rerenders prefix-resolved labels", () => {
    function Switcher({ lang }: { lang: "en" | "fr" }) {
      const t = translator(
        lang === "fr"
          ? { [`${DEFAULT_FEEDBACK_KEY_PREFIX}.emptyTitle`]: "Vide" }
          : { [`${DEFAULT_FEEDBACK_KEY_PREFIX}.emptyTitle`]: "No data" },
      );
      return (
        <NajmUIProvider t={t}>
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

  test("an explicit component prop still beats every resolved source", () => {
    const t = translator({
      [`${DEFAULT_FEEDBACK_KEY_PREFIX}.emptyTitle`]: "By prefix",
    });
    const { getByText, queryByText } = mount(
      <NEmptyState title="Prop" />,
      undefined,
      t,
    );
    expect(getByText("Prop")).not.toBeNull();
    expect(queryByText("By prefix")).toBeNull();
  });
});
