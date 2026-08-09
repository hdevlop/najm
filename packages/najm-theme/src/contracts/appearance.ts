// ============================================================================
// najm-theme/contracts — appearance
// ============================================================================
//
// The design an application renders itself with, plus the policy that decides
// whether a candidate design is allowed to be stored.
//
// `najm-kit`'s `parseNajmDesignConfig` already answers "is this the right
// shape?" — unknown keys, wrong types, an unsupported version. It deliberately
// does not answer "is this safe to serve?", because the kit's parser also runs
// over designs an application authored in its own repository, where the answer
// is trivially yes.
//
// Here the answer is not trivial. A stored design arrives over HTTP from an
// administrator, is written into a `<style>` element on every page, and its
// class names land in `class` attributes. So this module adds the second
// question on top of the kit's first, and both must pass before a design is
// persisted or served.
// ============================================================================

import { parseNajmDesignConfig } from "najm-kit/server";
import type { NajmDesignConfig } from "najm-kit/server";

import { isThemeRevision } from "./revisions";

/** What a public appearance read returns. Complete, validated, never partial. */
export interface PublicAppearance {
  designConfig: NajmDesignConfig;
  revision: number;
}

/** What an administrative read adds on top. Never reaches a public route. */
export interface AdminAppearance extends PublicAppearance {
  /** True when nothing is stored and the factory design is being served. */
  isFactory: boolean;
  updatedAt: string | null;
  updatedByActorId: string | null;
}

/**
 * The root groups a save is allowed to touch.
 *
 * `version` is absent on purpose: it is the parser's contract, not a field an
 * editor gets to move. A design arriving with a different version is rejected
 * by the kit's parser long before this list is consulted.
 */
export const APPEARANCE_EDITABLE_GROUPS = [
  "theme",
  "typography",
  "components",
  "layout",
] as const;

export type AppearanceGroup = (typeof APPEARANCE_EDITABLE_GROUPS)[number];

export interface ThemeAppearanceLimits {
  /** Serialized size ceiling for one stored design, in UTF-8 bytes. */
  maxDesignBytes: number;
  /** Ceiling for any single string inside a design — a token, a class list. */
  maxStringLength: number;
}

/**
 * Comfortable for a hand-authored design and a fraction of what an abusive one
 * would need. A full four-mode token set with component recipes lands under
 * 20 KB; the default leaves an order of magnitude of headroom.
 */
export const DEFAULT_APPEARANCE_LIMITS: ThemeAppearanceLimits = Object.freeze({
  maxDesignBytes: 256 * 1024,
  maxStringLength: 2_048,
});

/**
 * The ceiling an application may raise its own limits to.
 *
 * Configuration widens a limit within this; it cannot remove it. A design is
 * parsed on every server render that misses cache, so an unbounded one is a
 * denial-of-service vector against the application itself, not just a large row.
 */
export const MAX_APPEARANCE_LIMITS: ThemeAppearanceLimits = Object.freeze({
  maxDesignBytes: 2 * 1024 * 1024,
  maxStringLength: 16_384,
});

export function resolveAppearanceLimits(
  overrides?: Partial<ThemeAppearanceLimits>,
): ThemeAppearanceLimits {
  const resolved: ThemeAppearanceLimits = {
    maxDesignBytes: overrides?.maxDesignBytes ?? DEFAULT_APPEARANCE_LIMITS.maxDesignBytes,
    maxStringLength: overrides?.maxStringLength ?? DEFAULT_APPEARANCE_LIMITS.maxStringLength,
  };

  for (const key of Object.keys(resolved) as (keyof ThemeAppearanceLimits)[]) {
    const value = resolved[key];
    if (!Number.isSafeInteger(value) || value < 1) {
      throw new TypeError(`limits.${key} must be a positive integer`);
    }
    if (value > MAX_APPEARANCE_LIMITS[key]) {
      throw new TypeError(
        `limits.${key} must not exceed the package maximum of ${MAX_APPEARANCE_LIMITS[key]}`,
      );
    }
  }

  return resolved;
}

// ---------------------------------------------------------------------------
// CSS safety
// ---------------------------------------------------------------------------

/**
 * Every value here is emitted as a CSS custom property inside a `<style>`
 * element the application renders on each page. The patterns below are the ways
 * a string in that position stops being a value:
 *
 * - `<` and `>` can close the style element and open a script tag.
 * - `{`, `}`, and `;` end the declaration and start authoring rules.
 * - `/*` starts a comment that swallows the rest of the block.
 * - `url()` and `image-set()` make the browser fetch — an exfiltration channel
 *   that needs no script, since the request itself carries the signal.
 * - `expression()` and `-moz-binding` are legacy script-in-CSS.
 * - `@import` pulls in a whole external stylesheet.
 * - `\` is CSS's escape character, and every pattern above can be written
 *   through it. Rejecting the backslash outright is what makes the rest hold.
 */
const UNSAFE_CSS_PATTERNS: readonly { pattern: RegExp; label: string }[] = [
  { pattern: /[<>{};\\]/, label: "must not contain < > { } ; or \\" },
  { pattern: /\/\*|\*\//, label: "must not contain CSS comments" },
  { pattern: /url\s*\(/i, label: "must not contain url()" },
  { pattern: /image-set\s*\(/i, label: "must not contain image-set()" },
  { pattern: /expression\s*\(/i, label: "must not contain expression()" },
  { pattern: /-moz-binding/i, label: "must not contain -moz-binding" },
  { pattern: /@import/i, label: "must not contain @import" },
  { pattern: /javascript\s*:/i, label: "must not contain a javascript: URL" },
];

/**
 * Class names are a different shape from CSS values, so they get their own
 * rule rather than a loosened version of the one above.
 *
 * Tailwind's arbitrary-value syntax is genuinely busy — `md:w-[calc(100%-1rem)]`,
 * `bg-primary/50`, `data-[state=open]:flex` — so this is an allow-list of the
 * characters that syntax actually uses. Quotes, angle brackets, and backslashes
 * are not among them.
 */
const CLASS_NAME_PATTERN = /^[A-Za-z0-9_\-:./[\]()%#,!*+&$@=\s]*$/;

function assertSafeCssValue(value: string, path: string, maxLength: number): void {
  if (value.length > maxLength) {
    throw new TypeError(`${path} must be at most ${maxLength} characters`);
  }
  for (const { pattern, label } of UNSAFE_CSS_PATTERNS) {
    if (pattern.test(value)) throw new TypeError(`${path} ${label}`);
  }
}

function assertSafeClassName(value: string, path: string, maxLength: number): void {
  if (value.length > maxLength) {
    throw new TypeError(`${path} must be at most ${maxLength} characters`);
  }
  if (!CLASS_NAME_PATTERN.test(value)) {
    throw new TypeError(`${path} contains characters that are not valid in a class name`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Walks the parsed design and applies the safety rules by position.
 *
 * Runs over the *parsed* config, not the raw input, so the shape is already
 * known — every string reached here is one the kit's parser accepted, and the
 * only remaining question is what it contains.
 */
function assertSafeDesignStrings(
  design: NajmDesignConfig,
  limits: ThemeAppearanceLimits,
): void {
  const { maxStringLength } = limits;

  const walkCssRecord = (record: unknown, path: string) => {
    if (!isRecord(record)) return;
    for (const [key, value] of Object.entries(record)) {
      if (typeof value === "string") assertSafeCssValue(value, `${path}.${key}`, maxStringLength);
    }
  };

  // `preset`, `mode`, `accent`, and `accentOnly` are closed enums and a
  // boolean, already settled by the kit's parser. Only the free-text fields —
  // the ones an editor lets someone type a colour into — reach a stylesheet.
  const theme = design.theme ?? {};
  walkCssRecord(theme.tokens, "design.theme.tokens");
  walkCssRecord(theme.overrides?.light, "design.theme.overrides.light");
  walkCssRecord(theme.overrides?.dark, "design.theme.overrides.dark");
  if (typeof theme.radius === "string") {
    assertSafeCssValue(theme.radius, "design.theme.radius", maxStringLength);
  }
  if (typeof theme.appearance?.borderWidth === "string") {
    assertSafeCssValue(
      theme.appearance.borderWidth,
      "design.theme.appearance.borderWidth",
      maxStringLength,
    );
  }

  walkCssRecord(design.typography, "design.typography");
  walkCssRecord(design.layout, "design.layout");

  for (const [name, component] of Object.entries(design.components ?? {})) {
    if (!isRecord(component)) continue;
    const base = `design.components.${name}`;

    for (const key of ["radius", "borderWidth", "headerColor", "headerTextColor", "borderColor"]) {
      const value = component[key];
      if (typeof value === "string") assertSafeCssValue(value, `${base}.${key}`, maxStringLength);
    }
    for (const key of ["defaultVariant", "defaultSize"]) {
      const value = component[key];
      if (typeof value === "string") assertSafeClassName(value, `${base}.${key}`, maxStringLength);
    }

    for (const [slotName, slot] of Object.entries(
      (component.slots as Record<string, unknown>) ?? {},
    )) {
      if (!isRecord(slot)) continue;
      const slotPath = `${base}.slots.${slotName}`;
      if (typeof slot.className === "string") {
        assertSafeClassName(slot.className, `${slotPath}.className`, maxStringLength);
      }
      for (const key of ["radius", "borderWidth", "padding", "paddingTop"]) {
        const value = slot[key];
        if (typeof value === "string") assertSafeCssValue(value, `${slotPath}.${key}`, maxStringLength);
      }
    }

    for (const [variantName, variant] of Object.entries(
      (component.variants as Record<string, unknown>) ?? {},
    )) {
      if (!isRecord(variant)) continue;
      const variantPath = `${base}.variants.${variantName}`;
      if (typeof variant.use === "string") {
        assertSafeClassName(variant.use, `${variantPath}.use`, maxStringLength);
      }
      if (typeof variant.className === "string") {
        assertSafeClassName(variant.className, `${variantPath}.className`, maxStringLength);
      }
      walkCssRecord(variant.tokens, `${variantPath}.tokens`);
    }
  }
}

/** UTF-8 byte length without allocating a `Buffer` — this runs in browsers too. */
function utf8Length(value: string): number {
  let bytes = 0;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff) {
      bytes += 4;
      index += 1;
    } else bytes += 3;
  }
  return bytes;
}

/**
 * The one gate every stored, applied, or served design passes.
 *
 * Shape first (the kit's parser), then size, then safety — in that order,
 * because the safety walk assumes a known shape and the size check is cheapest
 * on something already normalized.
 *
 * Throws `TypeError` with a path. Callers on a read path catch it, serve the
 * factory design, and emit a sanitized diagnostic; callers on a write path let
 * it become a 400.
 */
export function parseSafeDesignConfig(
  input: unknown,
  limits: ThemeAppearanceLimits = DEFAULT_APPEARANCE_LIMITS,
): NajmDesignConfig {
  const design = parseNajmDesignConfig(input);

  const serialized = JSON.stringify(design);
  const bytes = utf8Length(serialized);
  if (bytes > limits.maxDesignBytes) {
    throw new TypeError(
      `design must serialize to at most ${limits.maxDesignBytes} bytes (received ${bytes})`,
    );
  }

  assertSafeDesignStrings(design, limits);
  return design;
}

/**
 * Layers an edit over the stored design, one root group at a time.
 *
 * Group-level replacement, not a deep merge. A deep merge cannot express
 * *removing* a token: the editor sends the group without it and a deep merge
 * carefully puts it back. Whole-group replacement makes "what I see is what is
 * stored" true, which is the only rule an editor UI can hold to.
 *
 * Groups the patch does not mention are kept — that is what lets a Typography
 * tab save without shipping the entire theme back.
 */
export function mergeAppearance(
  base: NajmDesignConfig,
  patch: Partial<Pick<NajmDesignConfig, AppearanceGroup>>,
): NajmDesignConfig {
  const merged: NajmDesignConfig = { ...base, version: 1 };

  for (const group of APPEARANCE_EDITABLE_GROUPS) {
    if (!Object.prototype.hasOwnProperty.call(patch, group)) continue;
    const value = patch[group];
    if (value === undefined) {
      if (group === "theme") throw new TypeError("design.theme cannot be removed");
      delete merged[group];
      continue;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (merged as any)[group] = value;
  }

  return merged;
}

/**
 * Narrows a client payload to the editable surface, refusing anything else.
 *
 * The lenient alternative — take the groups you recognize, ignore the rest — is
 * what makes an editor that sends `version: 2` appear to save successfully and
 * store something else. A key this package will not honour is a request it
 * cannot fulfil, so it is a 400.
 *
 * `version` is the single exception: every editor round-trips it, and a value
 * of 1 is the only one the parser accepts anyway.
 */
export function pickAppearancePatch(
  input: unknown,
): Partial<Pick<NajmDesignConfig, AppearanceGroup>> {
  if (!isRecord(input)) {
    throw new TypeError("designConfig must be an object");
  }

  const patch: Partial<Pick<NajmDesignConfig, AppearanceGroup>> = {};

  for (const key of Object.keys(input)) {
    if (key === "version") {
      if (input.version !== undefined && input.version !== 1) {
        throw new TypeError("designConfig.version must be 1");
      }
      continue;
    }
    if (!(APPEARANCE_EDITABLE_GROUPS as readonly string[]).includes(key)) {
      throw new TypeError(`designConfig.${key} is not an editable appearance group`);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (patch as any)[key] = (input as any)[key];
  }

  return patch;
}

/**
 * Which groups differ, for an audit record and for the UI's dirty state.
 *
 * Structural comparison over `JSON.stringify` of each group. Key order is
 * stable because both sides came through the kit's parser, which builds its
 * output in a fixed order.
 */
export function changedAppearanceGroups(
  before: NajmDesignConfig,
  after: NajmDesignConfig,
): AppearanceGroup[] {
  return APPEARANCE_EDITABLE_GROUPS.filter(
    (group) => JSON.stringify(before[group]) !== JSON.stringify(after[group]),
  );
}

/**
 * Narrows a public appearance response for the server-render bootstrap.
 *
 * Returns `undefined` rather than throwing on a malformed payload: the
 * bootstrap loader treats both the same way, and the caller here is a fallback
 * path where the factory design is the right answer.
 */
export function parsePublicAppearance(input: unknown): PublicAppearance | undefined {
  if (!isRecord(input)) return undefined;
  if (!isThemeRevision(input.revision)) return undefined;

  try {
    return {
      designConfig: parseSafeDesignConfig(input.designConfig),
      revision: input.revision,
    };
  } catch {
    return undefined;
  }
}
