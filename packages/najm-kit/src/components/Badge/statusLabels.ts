import { humanizeToken } from "../../format/format";
import type { NajmTranslate } from "../../providers/paginationLabels";
import { normalizeStatusToken } from "./status";

/**
 * Catalog prefix the conventional lookup uses: `status.<token>`.
 *
 * The same shape as `common.pagination` and `common.table` — a prefix rather
 * than a per-token map, because the map is the boilerplate this replaces.
 */
export const DEFAULT_STATUS_KEY_PREFIX = "status";

/** English, because a label nobody can read is worse than an English one. */
export const DEFAULT_STATUS_LABEL_LANGUAGE = "en";

/**
 * Packaged labels for the vocabulary in `NAJM_STATUS_COLORS`, in the four
 * languages the Najm applications ship.
 *
 * Language-major so adding a language is one block rather than a line inside
 * fifty entries. Deliberately generic: `in_preparation` is "In preparation",
 * not one application's "Purchasing and preparation" — an application whose
 * wording is its own keeps it in its own catalog, which wins over this table.
 *
 * Tokens with no entry here are not errors. They humanize, exactly as an
 * unknown token always has.
 */
export const NAJM_STATUS_LABELS: Record<string, Record<string, string>> = {
  en: {
    absent: "Absent",
    active: "Active",
    approved: "Approved",
    archived: "Archived",
    blocked: "Blocked",
    canceled: "Canceled",
    cancelled: "Cancelled",
    closed: "Closed",
    completed: "Completed",
    confirmed: "Confirmed",
    delivered: "Delivered",
    draft: "Draft",
    ended: "Ended",
    error: "Error",
    expired: "Expired",
    failed: "Failed",
    in_preparation: "In preparation",
    in_progress: "In progress",
    inactive: "Inactive",
    info: "Info",
    late: "Late",
    out_for_delivery: "Out for delivery",
    overdue: "Overdue",
    paid: "Paid",
    partial: "Partial",
    partially_paid: "Partially paid",
    paused: "Paused",
    pending: "Pending",
    pending_email_verification: "Pending email verification",
    pending_funding: "Pending funding",
    pending_review: "Pending review",
    present: "Present",
    processing: "Processing",
    published: "Published",
    purchased: "Purchased",
    refunded: "Refunded",
    rejected: "Rejected",
    scheduled: "Scheduled",
    stopped: "Stopped",
    submitted: "Submitted",
    succeeded: "Succeeded",
    success: "Success",
    suspended: "Suspended",
    unknown: "Unknown",
    unpaid: "Unpaid",
    validated: "Validated",
    verified: "Verified",
    warning: "Warning",
    planned: "Planned",
    deleted: "Deleted",
    revoked: "Revoked",
    graduated: "Graduated",
    transferred: "Transferred",
    on_leave: "On leave",
    rescheduled: "Rescheduled",
    reviewed: "Reviewed",
    graded: "Graded",
    missed: "Missed",
    maintenance: "Maintenance",
    retired: "Retired",
  },
  fr: {
    absent: "Absent",
    active: "Actif",
    approved: "Approuvé",
    archived: "Archivé",
    blocked: "Bloqué",
    canceled: "Annulé",
    cancelled: "Annulé",
    closed: "Fermé",
    completed: "Terminé",
    confirmed: "Confirmé",
    delivered: "Livré",
    draft: "Brouillon",
    ended: "Terminé",
    error: "Erreur",
    expired: "Expiré",
    failed: "Échoué",
    in_preparation: "En préparation",
    in_progress: "En cours",
    inactive: "Inactif",
    info: "Info",
    late: "En retard",
    out_for_delivery: "En cours de livraison",
    overdue: "En souffrance",
    paid: "Payé",
    partial: "Partiel",
    partially_paid: "Partiellement payé",
    paused: "En pause",
    pending: "En attente",
    pending_email_verification: "Vérification de l’e-mail en attente",
    pending_funding: "Financement en attente",
    pending_review: "En attente de révision",
    present: "Présent",
    processing: "En traitement",
    published: "Publié",
    purchased: "Acheté",
    refunded: "Remboursé",
    rejected: "Rejeté",
    scheduled: "Planifié",
    stopped: "Arrêté",
    submitted: "Soumis",
    succeeded: "Réussi",
    success: "Succès",
    suspended: "Suspendu",
    unknown: "Inconnu",
    unpaid: "Impayé",
    validated: "Validé",
    verified: "Vérifié",
    warning: "Avertissement",
    planned: "Planifié",
    deleted: "Supprimé",
    revoked: "Révoqué",
    graduated: "Diplômé",
    transferred: "Transféré",
    on_leave: "En congé",
    rescheduled: "Reprogrammé",
    reviewed: "Examiné",
    graded: "Noté",
    missed: "Manqué",
    maintenance: "Maintenance",
    retired: "Retiré",
  },
  ar: {
    absent: "غائب",
    active: "نشط",
    approved: "معتمد",
    archived: "مؤرشف",
    blocked: "محظور",
    canceled: "ملغى",
    cancelled: "ملغى",
    closed: "مغلق",
    completed: "مكتمل",
    confirmed: "مؤكد",
    delivered: "تم التسليم",
    draft: "مسودة",
    ended: "منتهٍ",
    error: "خطأ",
    expired: "منتهي الصلاحية",
    failed: "فشل",
    in_preparation: "قيد التحضير",
    in_progress: "قيد التنفيذ",
    inactive: "غير نشط",
    info: "معلومة",
    late: "متأخر",
    out_for_delivery: "قيد التوصيل",
    overdue: "متأخر السداد",
    paid: "مدفوع",
    partial: "جزئي",
    partially_paid: "مدفوع جزئيًا",
    paused: "متوقف مؤقتًا",
    pending: "قيد الانتظار",
    pending_email_verification: "بانتظار تأكيد البريد الإلكتروني",
    pending_funding: "بانتظار التمويل",
    pending_review: "بانتظار المراجعة",
    present: "حاضر",
    processing: "قيد المعالجة",
    published: "منشور",
    purchased: "تم الشراء",
    refunded: "مسترد",
    rejected: "مرفوض",
    scheduled: "مجدول",
    stopped: "متوقف",
    submitted: "تم الإرسال",
    succeeded: "نجح",
    success: "نجاح",
    suspended: "موقوف",
    unknown: "غير معروف",
    unpaid: "غير مدفوع",
    validated: "مُصادق عليه",
    verified: "مُتحقق منه",
    warning: "تحذير",
    planned: "مخطط",
    deleted: "محذوف",
    revoked: "ملغى",
    graduated: "متخرج",
    transferred: "منقول",
    on_leave: "في إجازة",
    rescheduled: "أعيد جدولته",
    reviewed: "تمت المراجعة",
    graded: "مصحح",
    missed: "فائت",
    maintenance: "صيانة",
    retired: "متقاعد",
  },
  es: {
    absent: "Ausente",
    active: "Activo",
    approved: "Aprobado",
    archived: "Archivado",
    blocked: "Bloqueado",
    canceled: "Cancelado",
    cancelled: "Cancelado",
    closed: "Cerrado",
    completed: "Completado",
    confirmed: "Confirmado",
    delivered: "Entregado",
    draft: "Borrador",
    ended: "Finalizado",
    error: "Error",
    expired: "Caducado",
    failed: "Fallido",
    in_preparation: "En preparación",
    in_progress: "En curso",
    inactive: "Inactivo",
    info: "Información",
    late: "Con retraso",
    out_for_delivery: "En reparto",
    overdue: "Vencido",
    paid: "Pagado",
    partial: "Parcial",
    partially_paid: "Pagado parcialmente",
    paused: "En pausa",
    pending: "Pendiente",
    pending_email_verification: "Pendiente de verificar el correo",
    pending_funding: "Pendiente de financiación",
    pending_review: "Pendiente de revisión",
    present: "Presente",
    processing: "En proceso",
    published: "Publicado",
    purchased: "Comprado",
    refunded: "Reembolsado",
    rejected: "Rechazado",
    scheduled: "Programado",
    stopped: "Detenido",
    submitted: "Enviado",
    succeeded: "Exitoso",
    success: "Éxito",
    suspended: "Suspendido",
    unknown: "Desconocido",
    unpaid: "Sin pagar",
    validated: "Validado",
    verified: "Verificado",
    warning: "Advertencia",
    planned: "Planificado",
    deleted: "Eliminado",
    revoked: "Revocado",
    graduated: "Graduado",
    transferred: "Transferido",
    on_leave: "De permiso",
    rescheduled: "Reprogramado",
    reviewed: "Revisado",
    graded: "Calificado",
    missed: "Perdido",
    maintenance: "Mantenimiento",
    retired: "Retirado",
  },
};

/**
 * The packaged language a tag resolves to: `fr-MA` and `FR` both reach `fr`.
 *
 * Base-language resolution rather than exact matching, because the language an
 * application holds is whatever it declared — some ship `ar`, some ship `ar-MA`
 * — and the label is the same either way. An unpackaged language falls back to
 * English rather than to the raw tag.
 */
export function resolveStatusLabelLanguage(language?: string): string {
  if (!language) return DEFAULT_STATUS_LABEL_LANGUAGE;
  const lower = language.trim().toLowerCase();
  if (NAJM_STATUS_LABELS[lower]) return lower;
  const base = lower.split(/[-_]/)[0] ?? lower;
  if (NAJM_STATUS_LABELS[base]) return base;
  return DEFAULT_STATUS_LABEL_LANGUAGE;
}

/** The packaged label for a token, or `undefined` when it is not packaged. */
export function findPackagedStatusLabel(
  status: string,
  language?: string,
): string | undefined {
  const normalized = normalizeStatusToken(status);
  const resolved = resolveStatusLabelLanguage(language);
  return (
    NAJM_STATUS_LABELS[resolved]?.[normalized] ??
    NAJM_STATUS_LABELS[DEFAULT_STATUS_LABEL_LANGUAGE]?.[normalized]
  );
}

/**
 * The application's side of status labelling: its catalog, its overrides, and
 * the language it is currently rendering in.
 *
 * Every field is optional. A caller with none of them still gets the packaged
 * English, which is what makes a standalone `<NBadge status="paid" />` — no
 * auth, no Query, no app-wide i18n — render real text.
 */
export interface NajmStatusLabelOptions {
  /** Active language. A regional tag resolves to its base language. */
  language?: string;
  /** Token to finished label text. Wins over every other source. */
  labels?: Record<string, string>;
  /** Token to catalog key, resolved through `t`. Wins over the convention. */
  labelKeys?: Record<string, string>;
  /** The application's translator. */
  t?: NajmTranslate;
  /** Catalog prefix for the conventional lookup. Defaults to `"status"`. */
  keyPrefix?: string;
}

/**
 * A translated string, or `undefined` when the catalog has no such key.
 *
 * `najm-i18n` and every translator shaped like it return the key itself for a
 * missing entry, so that is the signal read here. It is not a swallowed error:
 * a translator that throws still throws, which is the application's contract to
 * define. What this prevents is `status.in_preparation` reaching a badge.
 */
function translated(t: NajmTranslate | undefined, key: string): string | undefined {
  if (!t) return undefined;
  const value = t(key);
  if (typeof value !== "string") return undefined;
  if (value === key || value.trim() === "") return undefined;
  return value;
}

function lookup(
  map: Record<string, string> | undefined,
  status: string,
  normalized: string,
): string | undefined {
  if (!map) return undefined;
  return map[status] ?? map[normalized];
}

/**
 * The label for a status, or `undefined` when nothing claims it.
 *
 * Most specific first, and the order is the contract:
 *
 * 1. an application literal in `labels`,
 * 2. an application catalog key in `labelKeys`,
 * 3. the conventional `status.<token>` entry, including a camelCase catalog
 *    key for a snake_case status, when the catalog has one,
 * 4. the packaged label for the active language.
 *
 * Steps 2 and 3 are what let an application delete its token-to-key table: a
 * catalog already keyed `status.delivered` is found without being described.
 * An application whose keys use another prefix or naming rule can keep
 * `labelKeys`, which still wins over the conventional lookup.
 */
export function findStatusLabel(
  status: string,
  options: NajmStatusLabelOptions = {},
): string | undefined {
  const normalized = normalizeStatusToken(status);
  const { labels, labelKeys, t, keyPrefix = DEFAULT_STATUS_KEY_PREFIX } = options;

  const literal = lookup(labels, status, normalized);
  if (literal !== undefined) return literal;

  const key = lookup(labelKeys, status, normalized);
  const mapped = key !== undefined ? translated(t, key) : undefined;
  if (mapped !== undefined) return mapped;

  const camelCase = normalized.replace(/_([a-z])/g, (_, letter: string) =>
    letter.toUpperCase(),
  );
  const conventional = keyPrefix
    ? translated(t, `${keyPrefix}.${normalized}`) ??
      (camelCase !== normalized
        ? translated(t, `${keyPrefix}.${camelCase}`)
        : undefined)
    : undefined;
  if (conventional !== undefined) return conventional;

  return findPackagedStatusLabel(normalized, options.language);
}

/**
 * The displayed text for a status, for plain text rather than a badge.
 *
 * The same vocabulary, normalization, precedence and locale fallback `NBadge`
 * uses, so a status named in a sentence and the badge beside it cannot drift.
 * Server-safe: exported from `najm-kit/format`, pure, and it reads no context.
 */
export function formatStatusLabel(
  status: string,
  options: NajmStatusLabelOptions = {},
): string {
  return findStatusLabel(status, options) ?? humanizeToken(status);
}
