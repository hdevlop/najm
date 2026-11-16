import React, { useMemo } from 'react';
import {
  BookOpen, Blocks, ScrollText, FileText, Layers,
  MessageSquare, Wrench, Tag, FlaskConical, TestTube,
  Inbox, LayoutDashboard, Bot,
} from 'lucide-react';
import { Badge } from 'najm-kit';
import type { NavItem } from 'najm-kit';

/** Nav id of the item that opens the Studio Assistant panel (not a route). */
export const ASSISTANT_NAV_ID = 'assistant';

export interface NavItemOptions { enableKnowledge: boolean; unmatchedCount: number; assistant?: boolean }

export function useNavItems(opts: NavItemOptions) {
  const { enableKnowledge, unmatchedCount, assistant = false } = opts;
  return useMemo(() => buildNavItems({ enableKnowledge, unmatchedCount, assistant }), [enableKnowledge, unmatchedCount, assistant]);
}

export function buildNavItems({ enableKnowledge, unmatchedCount, assistant = false }: NavItemOptions): NavItem[] {
  {
    const items: NavItem[] = [];
    if (enableKnowledge) {
      items.push(
        { id: 'knowledge-documents', label: 'Documents', icon: FileText, sectionLabel: 'Knowledge', sectionIcon: BookOpen },
        { id: 'knowledge-chunks', label: 'Chunks', icon: Layers },
        { id: 'knowledge-chat', label: 'Knowledge Chat', icon: MessageSquare },
      );
    }
    items.push(
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, sectionLabel: 'Tool Routing', sectionIcon: Blocks },
      { id: 'routing-tools', label: 'MCP Tools', icon: Wrench },
      { id: 'routing-semantics', label: 'Semantics', icon: Tag },
      { id: 'routing-lab', label: 'Routing Lab', icon: FlaskConical },
      { id: 'routing-tests', label: 'Test Runner', icon: TestTube },
      { id: 'chat', label: 'Chat Debug', icon: MessageSquare },
    );
    items.push(
      {
        id: 'logs-unmatched',
        label: 'Unmatched Inbox',
        icon: Inbox,
        sectionLabel: 'Logs',
        sectionIcon: ScrollText,
        badge: unmatchedCount > 0
          ? <Badge variant="destructive">{unmatchedCount > 99 ? '99+' : unmatchedCount}</Badge>
          : undefined,
      },
      { id: 'logs', label: 'View Logs', icon: ScrollText },
    );
    if (assistant) {
      items.push({ id: ASSISTANT_NAV_ID, label: 'Assistant', icon: Bot, sectionLabel: 'Help', sectionIcon: Bot });
    }
    return items;
  }
}
