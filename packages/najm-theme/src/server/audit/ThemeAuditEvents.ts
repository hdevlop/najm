// ============================================================================
// najm-theme/server — audit events
// ============================================================================
//
// Structured records of what changed, with no application-private payload in
// them. An audit event says "the sidebar logo was replaced in scope `platform`
// by actor `u_42`, taking branding from revision 7 to 8". It does not say what
// the image was, what the design tokens are, or who else can see them.
//
// That restraint is the point. An audit log is read by more people than the
// settings screen is, is retained longer than the data it describes, and is
// frequently shipped to a third-party sink. A design config in there is a
// copy of production configuration in a place nobody threat-modelled.
// ============================================================================

import type { AppearanceGroup } from "../../contracts/appearance";

export type ThemeAuditAction =
  | "theme.appearance.saved"
  | "theme.appearance.preset-applied"
  | "theme.appearance.reset"
  | "theme.preset.created"
  | "theme.preset.deleted"
  | "theme.branding.saved"
  | "theme.branding.reset"
  | "theme.branding.asset.uploaded"
  | "theme.branding.asset.deleted"
  | "theme.branding.assets.reconciled";

/**
 * What every event carries.
 *
 * `metadata` is a closed union per action rather than a free `Record<string,
 * unknown>`: an open bag is how a design config eventually ends up in an audit
 * row, because at some point somebody debugging a conflict will put it there.
 */
export interface ThemeAuditEvent {
  action: ThemeAuditAction;
  scopeId: string;
  /** `null` when the mutation ran without an authenticated actor. */
  actorId: string | null;
  /** ISO 8601, set by the package at commit time. */
  at: string;
  fromRevision: number;
  toRevision: number;
  metadata: ThemeAuditMetadata;
}

export type ThemeAuditMetadata =
  /** Which root groups the save actually changed. Names only, no values. */
  | { kind: "appearance-save"; changedGroups: AppearanceGroup[] }
  | { kind: "appearance-preset"; presetId: string; presetSlug: string }
  | { kind: "appearance-reset" }
  | { kind: "preset-created"; presetId: string; presetSlug: string }
  | { kind: "preset-deleted"; presetId: string; presetSlug: string; wasBuiltIn: boolean }
  /** Slot keys, and whether each was set or cleared. Never a file name. */
  | { kind: "branding-save"; changedSlots: string[]; clearedSlots: string[] }
  | { kind: "branding-reset"; clearedSlots: string[] }
  | { kind: "branding-asset"; slot: string; mimeType: string; bytes: number }
  | { kind: "branding-reconcile"; deletedCount: number };

export function themeAuditEvent(
  action: ThemeAuditAction,
  input: Omit<ThemeAuditEvent, "action" | "at"> & { at?: string },
): ThemeAuditEvent {
  return {
    action,
    scopeId: input.scopeId,
    actorId: input.actorId,
    at: input.at ?? new Date().toISOString(),
    fromRevision: input.fromRevision,
    toRevision: input.toRevision,
    metadata: input.metadata,
  };
}
