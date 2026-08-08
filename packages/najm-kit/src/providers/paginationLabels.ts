import type { NTablePaginationLabels } from "../components/table/paginationContract";

/**
 * The translator shape `NajmUIProvider` accepts.
 *
 * Deliberately structural rather than an import from `najm-i18n`: the kit
 * depends on no `najm-*` package, and this signature is satisfied by every
 * mainstream i18n library. The application keeps its catalog and its own
 * language provider.
 *
 * `Key` narrows the accepted keys. It exists for the application that types its
 * translator to a generated union of its catalog — such a `t` is *not*
 * assignable to `NajmTranslate<string>`, since a parameter position accepting
 * fewer values is the wrong way round. Builders below name the exact keys they
 * pass, so a narrow translator satisfies them without a cast and the keys stay
 * checked against the catalog.
 */
export type NajmTranslate<Key extends string = string> = (
  key: Key,
  params?: Record<string, string | number>,
) => string;

export const DEFAULT_PAGINATION_KEY_PREFIX = "common.pagination";

/**
 * Projects a translator onto the ten pagination labels.
 *
 * Keys are `<prefix>.<field>`, matching the `NTablePaginationLabels` field
 * names one-for-one, so a catalog is readable next to the type. Interpolation
 * params are named for what they are: `page`, `pageCount`, `selected`, `total`.
 *
 * No result is inspected or second-guessed. A translator that echoes missing
 * keys will render those keys — that is the translator's contract to define,
 * and quietly swapping in English would hide the missing entry rather than
 * surface it. Applications that want the packaged English for a given label
 * should omit the key from the prefix and override it via `tableDefaults`.
 */
export function buildPaginationLabels(
  t: NajmTranslate,
  prefix: string = DEFAULT_PAGINATION_KEY_PREFIX,
): NTablePaginationLabels {
  const key = (field: string) => `${prefix}.${field}`;

  return {
    rowsPerPage: t(key("rowsPerPage")),
    pagination: t(key("pagination")),
    firstPage: t(key("firstPage")),
    previousPage: t(key("previousPage")),
    nextPage: t(key("nextPage")),
    lastPage: t(key("lastPage")),
    goToPage: (page) => t(key("goToPage"), { page }),
    currentPage: (page) => t(key("currentPage"), { page }),
    pageOf: (page, pageCount) => t(key("pageOf"), { page, pageCount }),
    pageOfUnknown: (page) => t(key("pageOfUnknown"), { page }),
    rowsSelected: (selected, total) =>
      t(key("rowsSelected"), { selected, total }),
  };
}
