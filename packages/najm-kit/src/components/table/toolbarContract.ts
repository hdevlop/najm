/**
 * Accessible names and visible copy for the toolbar above the rows.
 *
 * Every field is optional and falls back to English, matching
 * `NTablePaginationLabels`. The settings menu is the motivating case: its
 * headings and view-mode options are the only chrome in a localized table that
 * a catalog could not previously reach, because they are built inside the kit
 * rather than supplied per column.
 */
export interface NTableToolbarLabels {
  /** Accessible name of the settings trigger. Defaults to `"Table settings"`. */
  settings?: string;
  /** Heading above the view-mode group. Defaults to `"View"`. */
  view?: string;
  /** Heading above the column-visibility list. Defaults to `"Columns"`. */
  columns?: string;
  /** Visible name of the table view mode. Defaults to `"Table"`. */
  modeTable?: string;
  /** Visible name of the cards view mode. Defaults to `"Cards"`. */
  modeCards?: string;
  /** Visible name of the JSON view mode. Defaults to `"JSON"`. */
  modeJson?: string;
  /** Visible name of the files view mode. Defaults to `"Files"`. */
  modeFiles?: string;
  /**
   * Accessible name of one view-mode option, given its visible name. Defaults
   * to `` `${mode} view` ``.
   *
   * It must contain the visible name — voice control matches on what is on
   * screen — so a translation reorders around the mode rather than replacing it.
   */
  modeOption?: (mode: string) => string;
  /** Accessible name and tooltip of the mobile filters trigger. Defaults to `"Filters"`. */
  filters?: string;
  /** Accessible name of the filter row. Defaults to `"Table filters"`. */
  filterRegion?: string;
  /** The option that clears a select filter. Defaults to `"All"`. */
  allOption?: string;
  /** Accessible name of the add control when `addButtonText` is empty. Defaults to `"Create"`. */
  create?: string;
}
