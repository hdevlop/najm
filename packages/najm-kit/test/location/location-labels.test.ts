import { describe, expect, test } from "bun:test";

import {
  DEFAULT_LOCATION_LABELS,
  NAJM_LOCATION_LABELS,
  getNajmLocationLabels,
} from "../../src/location";

describe("shared location labels", () => {
  test("ships complete en/fr/ar/es catalogs", () => {
    const expectedKeys = Object.keys(DEFAULT_LOCATION_LABELS).sort();
    expect(Object.keys(NAJM_LOCATION_LABELS).sort()).toEqual(["ar", "en", "es", "fr"]);
    for (const labels of Object.values(NAJM_LOCATION_LABELS)) {
      expect(Object.keys(labels).sort()).toEqual(expectedKeys);
      for (const [key, value] of Object.entries(labels)) {
        expect(typeof value, key).toBe(key === "resultsAnnouncement" ? "function" : "string");
      }
    }
  });

  test("resolves regional tags and falls back to English", () => {
    expect(getNajmLocationLabels("ar-MA")).toBe(NAJM_LOCATION_LABELS.ar);
    expect(getNajmLocationLabels("FR-fr")).toBe(NAJM_LOCATION_LABELS.fr);
    expect(getNajmLocationLabels("unknown")).toBe(DEFAULT_LOCATION_LABELS);
  });
});
