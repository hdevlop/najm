import React from "react";
import {
  NDonutCard,
} from "najm-kit";
import type { NDonutCardItem } from "najm-kit";
import { Bus, House, PieChart, Plane, ShoppingCart, Utensils, Wallet } from "lucide-react";
import { ComponentPage } from "../ComponentPage";
import { Example } from "../Example";

const currencyItems: NDonutCardItem[] = [
  { id: "available", label: "Available", value: 5000, color: "#22c55e" },
  { id: "reserved", label: "Reserved", value: 3000, color: "#3b82f6" },
  { id: "spent", label: "Spent", value: 2000, color: "#ef4444" },
];

const foodItems: NDonutCardItem[] = [
  { id: "food", label: "Food & Dining", value: 4200, color: "#22c55e", icon: Utensils },
  { id: "rent", label: "Rent & Utilities", value: 8500, color: "#3b82f6", icon: House },
  { id: "transport", label: "Transportation", value: 2300, color: "#ef4444", icon: Bus },
];

const markerItems: NDonutCardItem[] = [
  { id: "food", label: "Food", value: 420, color: "#f97316", icon: Utensils },
  { id: "shopping", label: "Shopping", value: 310, color: "#8b5cf6", icon: ShoppingCart },
  { id: "travel", label: "Travel", value: 250, color: "#06b6d4", icon: Plane },
];

const pct = (r: number) =>
  new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 1 }).format(r);

const mad = (v: number) => `${v.toLocaleString()} MAD`;
const amount = (v: number) => v.toLocaleString();

export function DonutCardPage() {
  return (
    <ComponentPage
      title="Donut Card"
      description="A card with a donut chart for displaying proportional data with legends, totals, and optional percentage breakdowns."
      category="Data Display"
    >
      <Example
        title="Size and layout combinations"
        description="Compact and default sizes with vertical and horizontal layouts."
        center={false}
        previewHeight="h-[500px]"
        code={`import { NDonutCard } from 'najm-kit';
import { Wallet, PieChart } from 'lucide-react';

const items = [
  { id: "available", label: "Available", value: 5000, color: "#22c55e" },
  { id: "reserved", label: "Reserved", value: 3000,  color: "#3b82f6" },
  { id: "spent",     label: "Spent",     value: 2000,  color: "#ef4444" },
];

const pct = (r) => new Intl.NumberFormat("en-US", { style:"percent", maximumFractionDigits: 1 }).format(r);

<div className="grid grid-cols-3 gap-4">
  <NDonutCard title="Compact" variant="compact" icon={Wallet}
    items={items} valueFormatter={(v) => \`\${v} MAD\`}
    centerValueFormatter={(v) => v.toLocaleString()} centerUnit="MAD"
    totalLabel="Total" centerOrientation="column" />
  <NDonutCard title="Default" variant="default" icon={Wallet}
    items={items} valueFormatter={(v) => \`\${v} MAD\`}
    centerValueFormatter={(v) => v.toLocaleString()} centerUnit="MAD"
    totalLabel="Total" centerOrientation="column" />
  <NDonutCard title="Horizontal" variant="default" layout="horizontal" icon={PieChart}
    items={items} valueFormatter={(v) => \`\${v} MAD\`}
    centerValueFormatter={(v) => v.toLocaleString()} centerUnit="MAD"
    totalLabel="Total" legendMarker="icon" percentageFormatter={pct}
    centerOrientation="column" />
</div>`}
      >
        <div className="grid w-full grid-cols-1 items-start gap-4 md:grid-cols-3">
          <NDonutCard
            title="Compact"
            icon={Wallet}
            items={currencyItems}
            valueFormatter={mad}
            centerValueFormatter={amount}
            centerUnit="MAD"
            totalLabel="Total"
            variant="compact"
            centerOrientation="column"
          />
          <NDonutCard
            title="Default"
            icon={Wallet}
            items={currencyItems}
            valueFormatter={mad}
            centerValueFormatter={amount}
            centerUnit="MAD"
            totalLabel="Total"
            variant="default"
            centerOrientation="column"
          />
          <NDonutCard
            title="Horizontal"
            icon={PieChart}
            items={foodItems}
            valueFormatter={mad}
            centerValueFormatter={amount}
            centerUnit="MAD"
            totalLabel="Monthly Total"
            variant="default"
            layout="horizontal"
            legendMarker="icon"
            percentageFormatter={pct}
            centerOrientation="column"
          />
        </div>
      </Example>

      <Example
        title="Legend marker choices"
        description='Choose item icons, colored dots, or no marker with legendMarker="icon", "dot", or "none".'
        center={false}
        previewHeight="h-[360px]"
        code={`import { NDonutCard } from 'najm-kit';
import { Utensils, ShoppingCart, Plane } from 'lucide-react';

const items = [
  { id: "food",   label: "Food",    value: 420, color: "#f97316", icon: Utensils },
  { id: "shop",   label: "Shopping", value: 310, color: "#8b5cf6", icon: ShoppingCart },
  { id: "travel", label: "Travel",   value: 250, color: "#06b6d4", icon: Plane },
];

<div className="grid grid-cols-3 gap-4">
  <NDonutCard title="Icons" variant="default" layout="horizontal" items={items}
    valueFormatter={(v) => \`$\${v}\`} legendMarker="icon" />
  <NDonutCard title="Dots" variant="default" layout="horizontal" items={items}
    valueFormatter={(v) => \`$\${v}\`} legendMarker="dot" />
  <NDonutCard title="No markers" variant="default" layout="horizontal" items={items}
    valueFormatter={(v) => \`$\${v}\`} legendMarker="none" />
</div>`}
      >
        <div className="grid w-full grid-cols-1 items-start gap-4 lg:grid-cols-3">
          <NDonutCard
            title="Icons"
            variant="default"
            layout="horizontal"
            items={markerItems}
            valueFormatter={(v) => `$${v}`}
            totalLabel="Total"
            legendMarker="icon"
            percentageFormatter={(r) => `${Math.round(r * 100)}%`}
          />
          <NDonutCard
            title="Dots"
            variant="default"
            layout="horizontal"
            items={markerItems}
            valueFormatter={(v) => `$${v}`}
            totalLabel="Total"
            legendMarker="dot"
            percentageFormatter={(r) => `${Math.round(r * 100)}%`}
          />
          <NDonutCard
            title="No markers"
            variant="default"
            layout="horizontal"
            items={markerItems}
            valueFormatter={(v) => `$${v}`}
            totalLabel="Total"
            legendMarker="none"
            percentageFormatter={(r) => `${Math.round(r * 100)}%`}
          />
        </div>
      </Example>


    </ComponentPage>
  );
}
