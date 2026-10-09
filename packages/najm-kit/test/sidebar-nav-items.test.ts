import { describe, expect, test } from "bun:test";

import { filterNavItems, isNavItemActiveOrNested, type GatedNavItem } from "../src/components/sidebar/filterNavItems";

type Access = { access?: "fees" | "payroll" | "staff" };

const items: GatedNavItem<Access>[] = [
  { id: "/", label: "Home", href: "/" },
  { id: "/staff", label: "Staff", href: "/staff", access: "staff" },
  {
    id: "financial",
    label: "Financial",
    children: [
      { id: "/fees", label: "Fees", href: "/fees", access: "fees" },
      { id: "/payroll", label: "Payroll", href: "/payroll", access: "payroll" },
    ],
  },
];

const allowed = (granted: string[]) => (item: GatedNavItem<Access>) => !item.access || granted.includes(item.access);

describe("filterNavItems", () => {
  test("keeps the entries the viewer may open and strips the app's fields", () => {
    const visible = filterNavItems(items, allowed(["fees"]), ["access"]);
    expect(visible.map((item) => item.id)).toEqual(["/", "financial"]);
    expect(visible[1].children?.map((item) => item.id)).toEqual(["/fees"]);
    expect("access" in visible[1].children![0]).toBe(false);
  });

  test("drops a group with nothing left in it", () => {
    const visible = filterNavItems(items, allowed([]), ["access"]);
    expect(visible.map((item) => item.id)).toEqual(["/"]);
  });
});

describe("isNavItemActiveOrNested", () => {
  test("an entry stays active on the pages under it", () => {
    expect(isNavItemActiveOrNested({ id: "s", label: "S", href: "/students" }, "/students/42")).toBe(true);
    expect(isNavItemActiveOrNested({ id: "s", label: "S", href: "/students" }, "/students-archive")).toBe(false);
  });

  test("home matches only itself, and a group without a link never matches", () => {
    expect(isNavItemActiveOrNested({ id: "/", label: "Home", href: "/" }, "/fees")).toBe(false);
    expect(isNavItemActiveOrNested({ id: "/", label: "Home", href: "/" }, "/")).toBe(true);
    expect(isNavItemActiveOrNested({ id: "g", label: "Group" }, "/g")).toBe(false);
  });
});
