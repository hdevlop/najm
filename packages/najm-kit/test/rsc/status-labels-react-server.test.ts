import { describe, expect, test } from "bun:test";

import {
  findStatusLabel,
  formatStatusLabel,
  resolveStatusLabelLanguage,
} from "../../src/format";

/**
 * The plain-text resolver has to work in a server component, which is the whole
 * reason it lives on the `najm-kit/format` leaf rather than beside the badge
 * component. Importing it here proves that: under `react-server` there is no
 * `createContext`, so an entry that reached a provider would fail to evaluate
 * before a single assertion ran.
 */
describe("status labels under the react-server condition", () => {
  test("import and resolve without touching React context", () => {
    expect(formatStatusLabel("out_for_delivery", { language: "fr" })).toBe(
      "En cours de livraison",
    );
    expect(formatStatusLabel("nebulous_state")).toBe("Nebulous State");
    expect(findStatusLabel("nebulous_state")).toBeUndefined();
    expect(resolveStatusLabelLanguage("ar-MA")).toBe("ar");
  });

  test("an application catalog still wins, with no provider in reach", () => {
    const t = (key: string) =>
      key === "status.in_preparation" ? "Achat et préparation" : key;

    expect(formatStatusLabel("in_preparation", { language: "fr", t })).toBe(
      "Achat et préparation",
    );
  });
});
