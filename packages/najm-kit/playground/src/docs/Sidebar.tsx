import { NButton } from 'najm-kit';
import React, { useState } from 'react';
import { Search, ChevronDown, ChevronRight } from 'lucide-react';
import { navGroups } from './navigation';

interface SidebarProps {
  activePage: string;
  onNavigate: (slug: string) => void;
}

export function Sidebar({ activePage, onNavigate }: SidebarProps) {
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const toggleGroup = (title: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  };

  const query = search.trim().toLowerCase();
  const filteredGroups = query
    ? navGroups
        .map((g) => ({
          ...g,
          items: g.items.filter((i) => i.label.toLowerCase().includes(query)),
        }))
        .filter((g) => g.items.length > 0)
    : navGroups;

  return (
    <aside className="w-60 shrink-0 h-full overflow-y-auto bg-[hsl(222,47%,8%)] border-r border-slate-800/60 flex flex-col">
      <div className="px-3 pt-4 pb-2">
        <div className="relative">
          <Search
            size={13}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search components..."
            className="w-full h-8 pl-7 pr-3 text-xs bg-slate-800/60 border border-slate-700/50 rounded-lg outline-none text-slate-200 placeholder:text-slate-500 focus:border-amber-500/40 focus:ring-1 focus:ring-amber-500/20 transition-all"
          />
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-6 pt-1 space-y-0.5">
        {filteredGroups.map((group, gi) => {
          const isCollapsed = collapsed.has(group.title);
          return (
            <div key={group.title}>
              {gi > 0 && <div className="my-1 border-t border-slate-800/60" />}
              <NButton
                variant="plain"
                onClick={() => toggleGroup(group.title)}
                className="flex w-full items-center justify-between px-2 py-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500 hover:text-slate-300 transition-colors rounded-md"
              >
                <span>{group.title}</span>
                {isCollapsed ? (
                  <ChevronRight size={11} />
                ) : (
                  <ChevronDown size={11} />
                )}
              </NButton>

              {!isCollapsed && (
                <div className="mb-1">
                  {group.items.map((item) => {
                    const isActive = activePage === item.slug;
                    return (
                      <NButton
                        key={item.slug}
                        variant="plain"
                        onClick={() => onNavigate(item.slug)}
                        className={[
                          'flex w-full items-center justify-between px-3 py-1.5 text-[13px] rounded-lg transition-colors',
                          isActive
                            ? 'text-amber-400 font-medium'
                            : 'text-slate-400 hover:text-slate-200',
                        ].join(' ')}
                      >
                        <span>{item.label}</span>
                        {item.badge && (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 leading-none">
                            {item.badge}
                          </span>
                        )}
                      </NButton>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
