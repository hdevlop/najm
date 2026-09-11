import { describe, expect, test } from "bun:test";
import { isCompleteCoordinatePair, normalizeLocationValue } from "../../src/location";

describe("location contracts", () => {
  test("accepts finite coordinate boundaries", () => {
    expect(isCompleteCoordinatePair({ latitude: -90, longitude: -180 })).toBe(true);
    expect(isCompleteCoordinatePair({ latitude: 90, longitude: 180 })).toBe(true);
  });

  test("rejects partial, out-of-range, NaN, and infinite pairs", () => {
    expect(isCompleteCoordinatePair({ latitude: 1, longitude: null })).toBe(false);
    expect(isCompleteCoordinatePair({ latitude: 91, longitude: 1 })).toBe(false);
    expect(isCompleteCoordinatePair({ latitude: 1, longitude: -181 })).toBe(false);
    expect(isCompleteCoordinatePair({ latitude: Number.NaN, longitude: 1 })).toBe(false);
    expect(isCompleteCoordinatePair({ latitude: 1, longitude: Number.POSITIVE_INFINITY })).toBe(false);
  });

  test("normalizes every invalid pair atomically while preserving address text", () => {
    expect(normalizeLocationValue({ address: "  test  ", latitude: 12, longitude: null })).toEqual({
      address: "  test  ",
      latitude: null,
      longitude: null,
    });
  });
});
