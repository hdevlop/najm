import React from "react";
import { ChartNoAxesCombined, CircleGauge, ListChecks } from "lucide-react";
import { NBarChart, NLineChart, NPieChart, NStatusBreakdown } from "najm-kit";

import { ComponentPage } from "../ComponentPage";
import { Example } from "../Example";

const data = [
  { id: "jan", label: "Jan", values: { income: 12, refunds: 2 } },
  { id: "feb", label: "Feb", values: { income: 19, refunds: 4 } },
  { id: "mar", label: "Mar", values: { income: 16, refunds: 1 } },
  { id: "apr", label: "Apr", values: { income: 24, refunds: 3 } },
];
const series = [
  { id: "income", label: "Income" },
  { id: "refunds", label: "Refunds" },
];
const items = [
  { id: "active", label: "Active", value: 64 },
  { id: "pending", label: "Pending", value: 23 },
  { id: "closed", label: "Closed", value: 13 },
];

export function ChartPage() {
  return (
    <ComponentPage title="Charts" description="Accessible, theme-backed bar, line, pie, and status charts with shape-matched loading states." category="Data Display">
      <Example title="Cartesian charts" description="Caller-formatted labels and values use chart-1 through chart-5 unless a series overrides its color." center={false} previewHeight="h-[520px]" code={`<NBarChart title="Monthly activity" data={data} series={series} valueFormatter={(v) => String(v)} />\n<NLineChart title="Monthly trend" data={data} series={series} valueFormatter={(v) => String(v)} />`}>
        <div className="grid w-full grid-cols-1 gap-4 lg:grid-cols-2">
          <NBarChart data={data} icon={ChartNoAxesCombined} series={series} title="Monthly activity" />
          <NLineChart data={data} icon={ChartNoAxesCombined} series={series} title="Monthly trend" />
        </div>
      </Example>
      <Example title="Pie and status" description="Preset or numeric pie sizes stay independent from the legend; status rows may carry responsive classes." center={false} previewHeight="h-[420px]" code={`<NPieChart title="Cases" items={items} size={132} />\n<NStatusBreakdown title="Pipeline" items={items} />`}>
        <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-2" dir="rtl">
          <NPieChart icon={CircleGauge} items={items} percentageFormatter={(ratio) => `${Math.round(ratio * 100)}%`} size={132} title="Cases" />
          <NStatusBreakdown icon={ListChecks} items={items} title="Pipeline" />
        </div>
      </Example>
      <Example title="Loading" description="Every public chart owns a matching accessible skeleton." center={false} previewHeight="h-[320px]" code={`<NLineChart loading loadingLabel="Loading trend" title="Trend" data={[]} series={[]} />`}>
        <NLineChart data={[]} icon={ChartNoAxesCombined} loading loadingLabel="Loading trend" series={[]} title="Trend" />
      </Example>
    </ComponentPage>
  );
}
