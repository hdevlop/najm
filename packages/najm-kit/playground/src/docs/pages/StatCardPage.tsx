import React from 'react';
import { NStatCard, NStatCardSkeleton } from 'najm-kit';
import {
  Award,
  BookOpen,
  CalendarClock,
  CalendarX,
  Clock3,
  DollarSign,
  FileText,
  GraduationCap,
  Percent,
  ShoppingCart,
  TrendingUp,
  UserRound,
  Users,
} from 'lucide-react';
import { ComponentPage } from '../ComponentPage';
import { Example } from '../Example';

export function StatCardPage() {
  return (
    <ComponentPage
      title="Stat Card"
      description="Metric cards for displaying key statistics, KPIs, and summary data with optional change badges and icons."
      category="Data Display"
    >
      <Example
        title="Stat cards with changes"
        center={false}
        code={`import { NStatCard } from 'najm-kit';
import { Users, ShoppingCart, TrendingUp, DollarSign } from 'lucide-react';

<NStatCard
  label="Total Users"
  value="12,430"
  icon={Users}
  change={{ value: '+12%', positive: true }}
  subtext="vs last month"
/>
<NStatCard
  label="Orders"
  value="1,284"
  icon={ShoppingCart}
  change={{ value: '-3%', positive: false }}
  subtext="vs last week"
/>
<NStatCard
  label="Revenue"
  value="$48,295"
  icon={DollarSign}
  change={{ value: '+8.5%', positive: true }}
  subtext="vs last month"
/>
<NStatCard
  label="Growth"
  value="24.5%"
  icon={TrendingUp}
/>`}
      >
        <div className="grid grid-cols-2 gap-4 w-full">
          <NStatCard
            label="Total Users"
            value="12,430"
            icon={Users}
            change={{ value: '+12%', positive: true }}
            subtext="vs last month"
          />
          <NStatCard
            label="Orders"
            value="1,284"
            icon={ShoppingCart}
            change={{ value: '-3%', positive: false }}
            subtext="vs last week"
          />
          <NStatCard
            label="Revenue"
            value="$48,295"
            icon={DollarSign}
            change={{ value: '+8.5%', positive: true }}
            subtext="vs last month"
          />
          <NStatCard
            label="Growth"
            value="24.5%"
            icon={TrendingUp}
          />
        </div>
      </Example>

      <Example
        title="Compact student profile stats"
        description="Compact keeps the default horizontal card structure with a smaller icon block and tighter text scale."
        center={false}
        previewHeight="h-[520px]"
        code={`import { NStatCard } from 'najm-kit';
import {
  Award,
  BookOpen,
  CalendarClock,
  CalendarX,
  Clock3,
  DollarSign,
  GraduationCap,
  Percent,
  UserRound,
} from 'lucide-react';

<div className="grid w-[360px] grid-cols-2 gap-3">
  <NStatCard variant="compact" icon={UserRound} label="Age" value="19 yrs" />
  <NStatCard variant="compact" icon={DollarSign} label="Fees" value={6} />
  <NStatCard variant="compact" icon={CalendarX} label="Absences" value={0} />
  <NStatCard variant="compact" icon={Clock3} label="Late" value={0} />
  <NStatCard variant="compact" icon={Award} label="Exams Avg" value="0%" />
  <NStatCard variant="compact" icon={BookOpen} label="Grades" value={0} />
  <NStatCard variant="compact" icon={GraduationCap} label="GPA" value="0.00" />
  <NStatCard variant="compact" icon={CalendarClock} label="Next Due" value="Sep 1" />
  <div className="col-span-2">
    <NStatCard variant="compact" icon={GraduationCap} label="Avg Grade" value="0%" />
  </div>
  <div className="col-span-2">
    <NStatCard variant="compact" icon={Percent} label="Due" value="8.2k DH" />
  </div>
</div>`}
      >
        <div className="grid w-[360px] grid-cols-2 gap-3">
          <NStatCard variant="compact" icon={UserRound} label="Age" value="19 yrs" />
          <NStatCard variant="compact" icon={DollarSign} label="Fees" value={6} />
          <NStatCard variant="compact" icon={CalendarX} label="Absences" value={0} />
          <NStatCard variant="compact" icon={Clock3} label="Late" value={0} />
          <NStatCard variant="compact" icon={Award} label="Exams Avg" value="0%" />
          <NStatCard variant="compact" icon={BookOpen} label="Grades" value={0} />
          <NStatCard variant="compact" icon={GraduationCap} label="GPA" value="0.00" />
          <NStatCard variant="compact" icon={CalendarClock} label="Next Due" value="Sep 1" />
          <div className="col-span-2">
            <NStatCard variant="compact" icon={GraduationCap} label="Avg Grade" value="0%" />
          </div>
          <div className="col-span-2">
            <NStatCard variant="compact" icon={Percent} label="Due" value="8.2k DH" />
          </div>
        </div>
      </Example>

      <Example
        title="Skeleton state"
        center={false}
        code={`import { NStatCardSkeleton } from 'najm-kit';

<NStatCardSkeleton />
<NStatCardSkeleton />`}
      >
        <div className="grid grid-cols-2 gap-4 w-full max-w-sm">
          <NStatCardSkeleton />
          <NStatCardSkeleton />
        </div>
      </Example>

      <Example
        title="Bordered stat cards"
        center={false}
        code={`<NStatCard bordered icon="trending-up" label="Conversion" value="3.2%" />
<NStatCard bordered variant="compact" icon="shopping-cart" label="Cart Items" value={42} unit="items" />`}
      >
        <div className="grid grid-cols-2 gap-4 w-full max-w-sm">
          <NStatCard bordered icon="trending-up" label="Conversion" value="3.2%" />
          <NStatCard bordered variant="compact" icon="shopping-cart" label="Cart Items" value={42} unit="items" />
        </div>
      </Example>

      <Example
        title="Compact and usage variants"
        center={false}
        code={`<NStatCard variant="compact" icon="trending-up" label="Conversion" value="3.2%" />
<NStatCard variant="usage" icon={FileText} label="Documents" count={128} used={536870912} total={1073741824} />`}
      >
        <div className="grid grid-cols-2 gap-4 w-full max-w-sm">
          <NStatCard variant="compact" icon="trending-up" label="Conversion" value="3.2%" />
          <NStatCard variant="usage" icon={FileText} label="Documents" count={128} used={536870912} total={1073741824} />
        </div>
      </Example>
    </ComponentPage>
  );
}
