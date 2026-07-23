import { parseNajmDesignConfig, type NajmDesignConfig } from "najm-kit";

export interface ImportResult {
  ok: boolean;
  config?: NajmDesignConfig;
  error?: string;
}

/**
 * Imports a design config from raw text. Accepts:
 * - NajmDesignConfig JSON
 * - bare NajmThemeConfig JSON (auto-wrapped by parseNajmDesignConfig)
 * - JS/TS object text (strips `export const x =` prefix and trailing `;`)
 */
export function importDesign(raw: string): ImportResult {
  const text = raw.trim();
  if (!text) return { ok: false, error: "Nothing to import." };

  let candidate = text;
  // Strip a TypeScript export wrapper if present.
  const assignMatch = candidate.match(/=\s*({[\s\S]*})\s*;?\s*$/);
  if (assignMatch) candidate = assignMatch[1];

  try {
    const parsed = parseNajmDesignConfig(candidate);
    return { ok: true, config: parsed };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}
