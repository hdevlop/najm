import type { BadgeColor } from "./Badge";

/**
 * The status vocabulary every dashboard ends up retyping: lifecycle, review,
 * fulfilment and money states mapped onto the semantic badge colors.
 *
 * Shipped as a default so `<NBadge status="approved" />` is already correct
 * without a per-app table. A consumer's own `statusMap` is consulted first and
 * merges rather than replaces, so overriding one key costs only that key.
 */
export const NAJM_STATUS_COLORS: Record<string, BadgeColor> = {
  active: "success",
  approved: "success",
  completed: "success",
  confirmed: "success",
  delivered: "success",
  paid: "success",
  published: "success",
  succeeded: "success",
  validated: "success",
  verified: "success",

  in_preparation: "warning",
  in_progress: "warning",
  out_for_delivery: "warning",
  pending: "warning",
  pending_email_verification: "warning",
  pending_review: "warning",
  processing: "warning",
  submitted: "warning",

  paused: "info",
  purchased: "info",
  scheduled: "info",

  archived: "neutral",
  cancelled: "neutral",
  canceled: "neutral",
  closed: "neutral",
  draft: "neutral",
  inactive: "neutral",
  stopped: "neutral",
  unknown: "neutral",

  blocked: "destructive",
  expired: "destructive",
  failed: "destructive",
  refunded: "destructive",
  rejected: "destructive",
  suspended: "destructive",
};

/**
 * Text-only colors per badge color, for the `text`/`minimal` looks and for
 * plain text that has to agree with a nearby badge — an amount rendered in the
 * color of the payment it belongs to, say.
 *
 * `neutral` is `text-muted-foreground`, not `text-neutral-foreground`: the
 * `-foreground` token is the contrast color *on* a solid neutral fill, so it
 * reads as near-white in light mode and near-black in dark, and is unreadable
 * anywhere else.
 */
export const NAJM_COLOR_TEXT_CLASSES: Record<BadgeColor, string> = {
  primary: "text-primary",
  secondary: "text-secondary-foreground",
  accent: "text-accent-foreground",
  neutral: "text-muted-foreground",
  info: "text-info",
  success: "text-success",
  warning: "text-warning",
  destructive: "text-destructive",
};

/**
 * `Out_For_Delivery `, `out-for-delivery` and `out for delivery` are the same
 * status key.
 *
 * Exported because it is the *one* rule: colors, icons, and labels all key off
 * a status the same way, and an application whose own status handling has to
 * agree with a badge should not have to guess it.
 */
export function normalizeStatusToken(status: string): string {
  return status.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function lookup(
  map: Record<string, BadgeColor> | undefined,
  status: string,
  normalized: string,
): BadgeColor | undefined {
  if (!map) return undefined;
  return map[status] ?? map[normalized];
}

/** The looked-up color, or `undefined` when nothing claims this status. */
export function findStatusColor(
  status: string | undefined,
  statusMap?: Record<string, BadgeColor>,
): BadgeColor | undefined {
  if (!status) return undefined;
  const normalized = normalizeStatusToken(status);
  return (
    lookup(statusMap, status, normalized) ??
    lookup(NAJM_STATUS_COLORS, status, normalized)
  );
}

/**
 * Resolves a status token to a badge color: the consumer's map first, then the
 * built-in vocabulary, then `fallback`.
 *
 * The fallback is `neutral` rather than `primary` because an unrecognized
 * status is exactly the thing that must not shout.
 */
export function resolveStatusColor(
  status: string | undefined,
  statusMap?: Record<string, BadgeColor>,
  fallback: BadgeColor = "neutral",
): BadgeColor {
  return findStatusColor(status, statusMap) ?? fallback;
}

/** The text-only class for a badge color. */
export function colorTextClass(color: BadgeColor): string {
  return NAJM_COLOR_TEXT_CLASSES[color] ?? "text-foreground";
}

/**
 * The text-only class for a status token, for text that is *not* a badge — an
 * amount that should carry the color of the payment beside it.
 *
 * An unmapped status returns `""` so the text keeps the surrounding color;
 * pass `fallback` to color it anyway.
 */
export function statusTextClass(
  status: string | undefined,
  statusMap?: Record<string, BadgeColor>,
  fallback?: BadgeColor,
): string {
  const color = findStatusColor(status, statusMap) ?? fallback;
  return color ? colorTextClass(color) : "";
}
