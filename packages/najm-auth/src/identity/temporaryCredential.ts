/**
 * A temporary credential is the value a provisioned user signs in with exactly
 * once, before Najm forces them to replace it. It is hashed like any password;
 * the only difference is that its *kind* decides how the submitted value is
 * canonicalized before comparison.
 */
export interface TemporaryCredential {
  kind: string;
  value: string;
}

export type TemporaryCredentialInput = string | TemporaryCredential;

export interface TemporaryCredentialKind {
  name: string;
  /** Canonical form hashed at provisioning and compared at login. */
  normalize(value: string): string;
  /**
   * True when a proposed replacement password still has the temporary shape.
   * Used to refuse "replacing" a CIN with another CIN.
   */
  isTemporaryShape?(value: string): boolean;
}

/** Default kind: byte-for-byte, case-sensitive, no transformation. */
export const EXACT_TEMPORARY_CREDENTIAL_KIND = 'exact';

const exactKind: TemporaryCredentialKind = {
  name: EXACT_TEMPORARY_CREDENTIAL_KIND,
  normalize: (value) => value,
};

export const MOROCCAN_CIN_TEMPORARY_CREDENTIAL_KIND = 'ma-cin';

const MOROCCAN_CIN = /^[a-z]{1,3}\d{5,17}$/i;

/** A Moroccan CIN is 1–3 letters followed by digits, 8–20 characters overall. */
export function isMoroccanCin(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length >= 8 && trimmed.length <= 20 && MOROCCAN_CIN.test(trimmed);
}

/**
 * People type their CIN in either case. Anything that is not a CIN is left
 * exactly as submitted, so a user-chosen password is never lowercased.
 */
export function normalizeMoroccanCin(value: string): string {
  return isMoroccanCin(value) ? value.trim().toLowerCase() : value;
}

const moroccanCinKind: TemporaryCredentialKind = {
  name: MOROCCAN_CIN_TEMPORARY_CREDENTIAL_KIND,
  normalize: normalizeMoroccanCin,
  isTemporaryShape: isMoroccanCin,
};

const KINDS = new Map<string, TemporaryCredentialKind>([
  [exactKind.name, exactKind],
  [moroccanCinKind.name, moroccanCinKind],
]);

/**
 * Resolve a stored kind. Fails closed: an unknown kind never falls back to a
 * different normalizer, because that would silently widen what the stored hash
 * accepts.
 */
export function resolveTemporaryCredentialKind(name?: string | null): TemporaryCredentialKind {
  const kind = KINDS.get(name?.trim() || EXACT_TEMPORARY_CREDENTIAL_KIND);
  if (!kind) {
    throw new Error(`Unknown temporary credential kind '${name}'`);
  }
  return kind;
}

export function isTemporaryCredentialKind(name: string): boolean {
  return KINDS.has(name);
}

/** Normalize provisioning input into `{ kind, value }`; strings mean `exact`. */
export function toTemporaryCredential(input: TemporaryCredentialInput): TemporaryCredential {
  if (typeof input === 'string') {
    return { kind: EXACT_TEMPORARY_CREDENTIAL_KIND, value: input };
  }
  if (!input || typeof input.value !== 'string') {
    throw new Error('temporaryCredential must be a string or { kind, value }');
  }
  return { kind: input.kind || EXACT_TEMPORARY_CREDENTIAL_KIND, value: input.value };
}

/** The structured `ma-cin` temporary credential used by provisioning. */
export function moroccanCinTemporaryCredential(value: string): TemporaryCredential {
  if (!isMoroccanCin(value)) {
    throw new Error('moroccanCinTemporaryCredential requires a valid Moroccan CIN');
  }
  return { kind: MOROCCAN_CIN_TEMPORARY_CREDENTIAL_KIND, value };
}
