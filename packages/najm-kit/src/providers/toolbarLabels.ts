import type { NTableToolbarLabels } from "../components/table/toolbarContract";
import type { NajmTranslate } from "./paginationLabels";

export const DEFAULT_TOOLBAR_KEY_PREFIX = "common.table";

type DefaultToolbarPrefix = typeof DEFAULT_TOOLBAR_KEY_PREFIX;

/** The twelve catalog keys `buildToolbarLabels` reads under `Prefix`. */
export type ToolbarKey<Prefix extends string = DefaultToolbarPrefix> =
  | `${Prefix}.settings`
  | `${Prefix}.view`
  | `${Prefix}.columns`
  | `${Prefix}.modeTable`
  | `${Prefix}.modeCards`
  | `${Prefix}.modeJson`
  | `${Prefix}.modeFiles`
  | `${Prefix}.modeOption`
  | `${Prefix}.filters`
  | `${Prefix}.filterRegion`
  | `${Prefix}.allOption`
  | `${Prefix}.create`;

/**
 * Projects a translator onto the toolbar labels, matching
 * `buildPaginationLabels` — same prefix convention, same key-per-field naming.
 *
 * `modeOption` interpolates `mode` with the already-translated visible name, so
 * a catalog writes one template rather than four accessible names.
 *
 * No result is inspected or second-guessed, for the reason given on
 * `buildPaginationLabels`: a translator that echoes a missing key renders that
 * key, which is the signal the entry is missing.
 */
export function buildToolbarLabels<
  Prefix extends string = DefaultToolbarPrefix,
>(
  t: NajmTranslate<ToolbarKey<Prefix>>,
  prefix?: Prefix,
): NTableToolbarLabels {
  const scope = (prefix ?? DEFAULT_TOOLBAR_KEY_PREFIX) as Prefix;

  return {
    settings: t(`${scope}.settings`),
    view: t(`${scope}.view`),
    columns: t(`${scope}.columns`),
    modeTable: t(`${scope}.modeTable`),
    modeCards: t(`${scope}.modeCards`),
    modeJson: t(`${scope}.modeJson`),
    modeFiles: t(`${scope}.modeFiles`),
    modeOption: (mode) => t(`${scope}.modeOption`, { mode }),
    filters: t(`${scope}.filters`),
    filterRegion: t(`${scope}.filterRegion`),
    allOption: t(`${scope}.allOption`),
    create: t(`${scope}.create`),
  };
}
