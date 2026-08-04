export type ImageInputPreviewSource = "value" | "fallback" | "default";

export interface ImageInputPreviewError {
  source: ImageInputPreviewSource;
  src: string;
}

export interface ImageInputPreviewCandidate {
  src: string;
  source: ImageInputPreviewSource;
}

export interface BuildPreviewCandidatesOptions {
  value?: string | null;
  fallback?: string | null;
  defaultImage?: string | null;
  imageVersion?: string | number | null;
}

const NON_APPENDABLE_PREFIXES = ["data:", "blob:", "javascript:", "file:"];

function isNonAppendable(src: string): boolean {
  const lower = src.toLowerCase();
  return NON_APPENDABLE_PREFIXES.some((prefix) => lower.startsWith(prefix));
}

function isMeaningful(src: string | null | undefined): src is string {
  return typeof src === "string" && src.length > 0;
}

/**
 * Append a cache-busting version to a URL while preserving an existing
 * query string and/or fragment.
 *
 * - `null` / `undefined` versions return the source unchanged.
 * - `data:`, `blob:`, `javascript:`, and `file:` URLs are returned unchanged.
 * - An existing query string switches the separator to `&`.
 * - A fragment is preserved and inserted after the version.
 */
export function appendImageVersion(
  src: string,
  version: string | number | null | undefined,
): string {
  if (!isMeaningful(src)) return src;
  if (version == null || version === "") return src;
  if (isNonAppendable(src)) return src;

  const fragmentIndex = src.indexOf("#");
  const beforeFragment =
    fragmentIndex === -1 ? src : src.slice(0, fragmentIndex);
  const fragment =
    fragmentIndex === -1 ? "" : src.slice(fragmentIndex);

  const queryIndex = beforeFragment.indexOf("?");
  const base = queryIndex === -1 ? beforeFragment : beforeFragment.slice(0, queryIndex);
  const existingQuery = queryIndex === -1 ? "" : beforeFragment.slice(queryIndex);
  const separator = existingQuery ? "&" : "?";
  const versionString = `${separator}v=${encodeURIComponent(String(version))}`;

  if (!existingQuery && !fragment) {
    return `${base}${versionString}`;
  }
  if (!existingQuery) {
    return `${base}${versionString}${fragment}`;
  }
  if (!fragment) {
    return `${base}${existingQuery}${versionString}`;
  }
  return `${base}${existingQuery}${versionString}${fragment}`;
}

function appendVersionToCandidate(
  src: string,
  version: string | number | null | undefined,
): string {
  if (version == null || version === "") return src;
  if (isNonAppendable(src)) return src;
  return appendImageVersion(src, version);
}

/**
 * Build the deduplicated list of preview candidates, in priority order.
 *
 * Order:
 *  1. `value` (primary) when provided.
 *  2. `fallback` when supplied and distinct from the primary source.
 *  3. `defaultImage` when supplied and distinct from the previous sources.
 *
 * The same source URL is never repeated, so a falling primary URL does not
 * silently retry the same failing asset through the fallback/default stage.
 */
export function buildPreviewCandidates(
  options: BuildPreviewCandidatesOptions,
): ImageInputPreviewCandidate[] {
  const seen = new Set<string>();
  const result: ImageInputPreviewCandidate[] = [];

  const push = (
    src: string | null | undefined,
    source: ImageInputPreviewSource,
  ) => {
    if (!isMeaningful(src)) return;
    if (seen.has(src)) return;
    seen.add(src);
    result.push({ src, source });
  };

  push(options.value ?? null, "value");
  push(options.fallback ?? null, "fallback");
  push(options.defaultImage ?? null, "default");

  const version = options.imageVersion;
  if (version == null || version === "") return result;

  return result.map((candidate) => ({
    src: appendVersionToCandidate(candidate.src, version),
    source: candidate.source,
  }));
}

/**
 * Stable identifier derived from a list of preview candidates.
 *
 * Used by `ImageInput` to detect when the candidate set has changed and the
 * previous failure tracking must be reset without firing a synchronous
 * setState inside an effect.
 */
export function candidatesKey(
  candidates: ImageInputPreviewCandidate[],
): string {
  return candidates.map((candidate) => `${candidate.source}:${candidate.src}`).join("|");
}