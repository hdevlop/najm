import type { NavItem } from "./types";

/** A nav item that carries an app's own fields, such as the rule that shows it. */
export type GatedNavItem<Extra extends object = object> = Omit<NavItem, "children"> & Extra & {
  children?: GatedNavItem<Extra>[];
};

/**
 * The entries a viewer may open. `canSee` decides each entry and each group;
 * a group with no visible entry left is dropped rather than shown empty.
 * The app's own fields are removed with `strip`, so only `NavItem` fields
 * reach the sidebar.
 *
 * Hiding an entry is not authorization: the route behind it must still refuse
 * a viewer who opens it directly.
 */
export function filterNavItems<Extra extends object = object>(
  items: readonly GatedNavItem<Extra>[],
  canSee: (item: GatedNavItem<Extra>) => boolean,
  strip: readonly (keyof Extra)[] = [],
): NavItem[] {
  return items.flatMap((entry) => {
    if (!canSee(entry)) return [];
    const { children, ...rest } = entry;
    const item = { ...rest } as Record<string, unknown>;
    for (const key of strip) delete item[key as string];
    if (!children) return [item as unknown as NavItem];
    const visible = filterNavItems(children, canSee, strip);
    return visible.length ? [{ ...item, children: visible } as unknown as NavItem] : [];
  });
}

/**
 * An `isActive` for `NSidebar` that keeps an entry active on the pages under
 * it: `/students` stays active on `/students/42`. `/` matches only itself,
 * so a home entry is not active everywhere.
 */
export function isNavItemActiveOrNested(item: NavItem, activePath: string): boolean {
  if (!item.href) return false;
  if (item.href === "/") return activePath === "/";
  return activePath === item.href || activePath.startsWith(`${item.href}/`);
}
