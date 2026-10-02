import React, { useMemo } from 'react';
import {
  BookOpen, Blocks, ScrollText, FileText, Layers,
  MessageSquare, Wrench, Tag, FlaskConical, TestTube,
  Inbox, LayoutDashboard,
} from 'lucide-react';
import { Badge } from 'najm-kit';
import type { NavItem } from 'najm-kit';

export function useNavItems(opts: { enableKnowledge: boolean; unmatchedCount: number }) {
  const { enableKnowledge, unmatchedCount } = opts;

  return useMemo<NavItem[]>(() => {
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
    return items;
  }, [enableKnowledge, unmatchedCount]);
}
