"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export interface SidebarItem {
  title: string;
  href?: string;
  items?: SidebarItem[];
}

export interface SidebarSection {
  title: string;
  items: SidebarItem[];
}

interface SidebarProps {
  sections: SidebarSection[];
}

export function Sidebar({ sections }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="fixed top-14 z-30 -ml-2 hidden h-[calc(100vh-3.5rem)] w-full shrink-0 md:sticky md:block md:border-r">
      <ScrollArea className="h-full py-6 pr-6 lg:py-8">
        <div className="w-full">
          {sections.map((section, index) => (
            <div key={index} className="pb-4">
              <h4 className="mb-1 rounded-md px-2 py-1 text-sm font-semibold">
                {section.title}
              </h4>
              {section.items?.length && (
                <SidebarItems items={section.items} pathname={pathname} />
              )}
            </div>
          ))}
        </div>
      </ScrollArea>
    </aside>
  );
}

interface SidebarItemsProps {
  items: SidebarItem[];
  pathname: string | null;
  level?: number;
}

function SidebarItems({ items, pathname, level = 0 }: SidebarItemsProps) {
  return (
    <div className="grid grid-flow-row auto-rows-max text-sm">
      {items.map((item, index) =>
        item.href ? (
          <Link
            key={index}
            href={item.href}
            className={cn(
              "group flex w-full items-center rounded-md border border-transparent px-2 py-1 hover:underline",
              pathname === item.href
                ? "font-medium text-primary bg-primary/10"
                : "text-muted-foreground",
              level > 0 && "pl-4"
            )}
          >
            {item.title}
          </Link>
        ) : (
          <div key={index}>
            <span
              className={cn(
                "flex w-full items-center rounded-md px-2 py-1 font-medium",
                level > 0 && "pl-4"
              )}
            >
              {item.title}
            </span>
            {item.items?.length && (
              <SidebarItems
                items={item.items}
                pathname={pathname}
                level={level + 1}
              />
            )}
          </div>
        )
      )}
    </div>
  );
}
