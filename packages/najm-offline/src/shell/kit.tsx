'use client';
/**
 * Stands in for `najm-kit` in an offline shell build. Inside a
 * `ReadCoverageContext`, a tab panel that was not downloaded never mounts and
 * a statistic that was not downloaded shows a dash, never a made-up zero.
 * Every other Kit export forwards unchanged.
 */
import { createContext, useContext, type ComponentProps } from 'react';
import { TabsContent as OriginalTabsContent, NStatCard as OriginalStatCard } from 'najm-kit';
export * from 'najm-kit';

/** What the current offline view downloaded: tab panels by value, statistics by their displayed label. */
export const ReadCoverageContext = createContext<{
  panels: ReadonlySet<string>;
  unavailableStatisticLabels: ReadonlySet<string>;
  unavailableText: string;
} | null>(null);

export function TabsContent(props: ComponentProps<typeof OriginalTabsContent>) {
  const coverage = useContext(ReadCoverageContext);
  if (!coverage || coverage.panels.has(props.value)) return <OriginalTabsContent {...props} />;
  return <OriginalTabsContent {...props}><p role="status" className="rounded-lg border bg-card p-6">{coverage.unavailableText}</p></OriginalTabsContent>;
}

export function NStatCard(props: ComponentProps<typeof OriginalStatCard>) {
  const coverage = useContext(ReadCoverageContext);
  if (!coverage?.unavailableStatisticLabels.has(String(props.label)) || props.variant === 'usage') return <OriginalStatCard {...props} />;
  return <OriginalStatCard {...props} value="—" />;
}
