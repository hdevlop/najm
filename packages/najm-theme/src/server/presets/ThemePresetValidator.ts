// ============================================================================
// najm-theme/server — theme preset validation
// ============================================================================

import { Inject, Service } from "najm-core";
import type { NajmDesignConfig } from "najm-kit/server";

import { assertThemePresetName, themePresetSlug, uniqueThemePresetSlug } from "../../contracts/presets";
import type { ResolvedThemeConfig } from "../config";
import { THEME_CONFIG } from "../tokens";

@Service()
export class ThemePresetValidator {
  @Inject(THEME_CONFIG) private config!: ResolvedThemeConfig;

  name(value: unknown): string {
    return assertThemePresetName(value, "name");
  }

  slugFor(name: string, taken: ReadonlySet<string>): string {
    return uniqueThemePresetSlug(themePresetSlug(name), taken);
  }

  /**
   * Enforced against the count read inside the same transaction, so two
   * concurrent creates cannot both see "one slot left".
   */
  assertUnderLimit(count: number): void {
    if (count >= this.config.limits.maxPresets) {
      throw new RangeError(
        `this scope already holds the maximum of ${this.config.limits.maxPresets} theme presets`,
      );
    }
  }

  /**
   * A preset is a stored design and is validated by the same policy as
   * appearance — not a looser one.
   *
   * Presets are the second write path into the design store, and applying one
   * writes it straight into appearance. A preset that skipped the CSS-safety
   * check would be a way to store an unsafe design and then install it.
   */
  design(input: unknown, parse: (value: unknown) => NajmDesignConfig): NajmDesignConfig {
    return parse(input);
  }

  get allowsBuiltInDeletion(): boolean {
    return this.config.limits.allowBuiltInPresetDeletion;
  }
}
