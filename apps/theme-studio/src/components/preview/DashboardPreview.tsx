import { useState } from "react";
import {
  Calendar,
  NajmScroll,
  NButton,
  NCard,
  NPageHeader,
  NPageHeaderActions,
  NSidebar,
  NStatCard,
  useNajmComponentStyle,
  type NavItem,
} from "najm-kit";
import {
  Banknote,
  Bell,
  BookOpen,
  Bus,
  CalendarDays,
  CalendarIcon,
  ClipboardCheck,
  Clock,
  DollarSign,
  GraduationCap,
  LayoutDashboard,
  Maximize,
  Moon,
  PieChart as PieIcon,
  Receipt,
  Target,
  TrendingDown,
  TrendingUp,
  UserCheck,
  Users,
  UsersRound,
  Wallet,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { SelectablePreviewElement } from "../SelectablePreviewElement";
import { StudentsPreview } from "./StudentsPreview";

const GENDER_COLORS: Record<string, string> = {
  Male: "var(--tertiary)",
  Female: "var(--secondary)",
  Other: "var(--muted)",
};

const ATTENDANCE_ABSENT_COLOR = "#E11D48";
const ATTENDANCE_LATE_COLOR = "#F1B814";
const INCOME_COLOR = "#1e40af";
const EXPENSES_COLOR = "#f97316";
const EXPENSE_COLORS = [
  "#1e40af",
  "#f97316",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#ef4444",
  "#06b6d4",
  "#84cc16",
  "#ec4899",
  "#6b7280",
  "#14b8a6",
  "#f43f5e",
  "#a855f7",
  "#eab308",
  "#22c55e",
  "#3b82f6",
];

const kpis = [
  { label: "Total students", value: "1,284", icon: Users },
  { label: "Total teachers", value: "86", icon: GraduationCap },
  { label: "Income / Month", value: "212,480.00 MAD", icon: TrendingUp },
  { label: "Expenses / Month", value: "68,340.00 MAD", icon: TrendingDown },
  { label: "Net balance", value: "144,140.00 MAD", icon: Wallet },
  { label: "Collection rate YTD", value: "91.6%", icon: Target },
];

const studentGenderData = [
  { name: "Male", value: 702 },
  { name: "Female", value: 582 },
];

const studentAttendanceData = [
  { month: "Jan", absent: 38, late: 16 },
  { month: "Feb", absent: 42, late: 18 },
  { month: "Mar", absent: 31, late: 13 },
  { month: "Apr", absent: 29, late: 11 },
  { month: "May", absent: 24, late: 9 },
  { month: "Jun", absent: 33, late: 14 },
  { month: "Sep", absent: 28, late: 10 },
  { month: "Oct", absent: 35, late: 15 },
  { month: "Nov", absent: 27, late: 12 },
  { month: "Dec", absent: 22, late: 8 },
];

const teacherAttendanceData = [
  { month: "Jan", absent: 8, late: 5 },
  { month: "Feb", absent: 6, late: 4 },
  { month: "Mar", absent: 10, late: 6 },
  { month: "Apr", absent: 5, late: 3 },
  { month: "May", absent: 7, late: 4 },
  { month: "Jun", absent: 9, late: 5 },
  { month: "Sep", absent: 4, late: 3 },
  { month: "Oct", absent: 8, late: 4 },
  { month: "Nov", absent: 6, late: 3 },
  { month: "Dec", absent: 5, late: 2 },
];

const financeTrendData = [
  { month: "Jan", income: 176500, expenses: 52400 },
  { month: "Feb", income: 184200, expenses: 58100 },
  { month: "Mar", income: 197800, expenses: 61200 },
  { month: "Apr", income: 188400, expenses: 64500 },
  { month: "May", income: 205700, expenses: 68200 },
  { month: "Jun", income: 212480, expenses: 68340 },
  { month: "Sep", income: 234900, expenses: 72100 },
  { month: "Oct", income: 226300, expenses: 69400 },
  { month: "Nov", income: 219800, expenses: 67600 },
  { month: "Dec", income: 238200, expenses: 73100 },
];

const expenseBreakdown = [
  { name: "Payroll", value: 38400, count: 18 },
  { name: "Transport", value: 12600, count: 7 },
  { name: "Supplies", value: 8450, count: 14 },
  { name: "Utilities", value: 5610, count: 5 },
  { name: "Maintenance", value: 3280, count: 4 },
  { name: "Other", value: 2400, count: 6 },
];

const overdueFees = [
  { studentId: "S-2041", studentName: "Sara Idrissi", totalOverdue: 3250, daysOverdue: 18 },
  { studentId: "S-1187", studentName: "Yassine Alami", totalOverdue: 2800, daysOverdue: 14 },
  { studentId: "S-3022", studentName: "Nadia Benali", totalOverdue: 1950, daysOverdue: 11 },
  { studentId: "S-0794", studentName: "Omar Tazi", totalOverdue: 1500, daysOverdue: 7 },
  { studentId: "S-4419", studentName: "Mina Bennani", totalOverdue: 900, daysOverdue: 5 },
];

const navItems: NavItem[] = [
  { id: "/", label: "Dashboard", icon: LayoutDashboard, href: "/" },
  { id: "/students", label: "Students", icon: Users, href: "/students" },
  { id: "/parents", label: "Parents", icon: Users, href: "/parents" },
  {
    id: "personnel",
    label: "Personnel",
    icon: Users,
    children: [
      { id: "/staff", label: "Staff", icon: Users, href: "/staff" },
      { id: "/teachers", label: "Teachers", icon: GraduationCap, href: "/teachers" },
      { id: "/drivers", label: "Drivers", icon: Users, href: "/drivers" },
    ],
  },
  {
    id: "financial",
    label: "Financial",
    icon: Banknote,
    children: [
      { id: "/fees", label: "Fees", icon: Banknote, href: "/fees" },
      { id: "/expenses", label: "Expenses", icon: Receipt, href: "/expenses" },
      { id: "/payroll", label: "Payroll", icon: Banknote, href: "/payroll" },
      { id: "/fee-types", label: "Fee types", icon: Banknote, href: "/fee-types" },
      { id: "/reminders", label: "Reminders", icon: Bell, href: "/reminders" },
      { id: "/financial-operations", label: "Financial Operations", icon: Receipt, href: "/financial-operations" },
    ],
  },
  {
    id: "attendance",
    label: "Attendance",
    icon: Users,
    children: [
      { id: "/attendance/students", label: "Student Attendance", icon: Users, href: "/attendance/students" },
      { id: "/attendance/teachers", label: "Teacher Attendance", icon: GraduationCap, href: "/attendance/teachers" },
    ],
  },
  { id: "/announcements", label: "Announcements", icon: Bell, href: "/announcements" },
  { id: "/assessments", label: "Assessments", icon: BookOpen, href: "/assessments" },
  { id: "/exams", label: "Exams", icon: BookOpen, href: "/exams" },
  { id: "/grades", label: "Grades", icon: GraduationCap, href: "/grades" },
  { id: "/calendar", label: "Calendar", icon: CalendarDays, href: "/calendar" },
  {
    id: "academic",
    label: "Academic",
    icon: GraduationCap,
    children: [
      { id: "/classes", label: "Classes", icon: UsersRound, href: "/classes" },
      { id: "/sections", label: "Sections", icon: UsersRound, href: "/sections" },
      { id: "/subjects", label: "Subjects", icon: BookOpen, href: "/subjects" },
    ],
  },
  {
    id: "transport",
    label: "Transport",
    icon: Bus,
    children: [{ id: "/vehicles", label: "Vehicles", icon: Bus, href: "/vehicles" }],
  },
];

const tooltipStyle = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  color: "var(--popover-foreground)",
};

function formatMAD(value: number) {
  return `${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MAD`;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function isSidebarItemActive(item: NavItem, activePath: string) {
  if (!item.href) return false;
  if (item.href === "/") return activePath === "/";
  return activePath === item.href || activePath.startsWith(`${item.href}/`);
}

function ChartLegend({
  items,
  className = "",
}: {
  items: { label: string; color: string }[];
  className?: string;
}) {
  return (
    <div className={`mb-4 flex items-center justify-start gap-6 ${className}`}>
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
          <span className="text-sm text-muted-foreground">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

function MarsSymbol({ className, color }: { className?: string; color: string }) {
  return (
    <svg className={className} style={{ color }} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="9" cy="15" r="5" stroke="currentColor" strokeWidth="2" />
      <path d="M13 11l7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M15 4h5v5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function VenusSymbol({ className, color }: { className?: string; color: string }) {
  return (
    <svg className={className} style={{ color }} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="8" r="5" stroke="currentColor" strokeWidth="2" />
      <path d="M12 13v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M8 17h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function StudentsGenderCard({ className }: { className?: string }) {
  const total = studentGenderData.reduce((sum, item) => sum + item.value, 0);

  return (
    <SelectablePreviewElement component="card" className={`flex min-h-0 ${className ?? ""}`}>
      <NCard title="Students" icon={Users} className="h-full w-full">
        <div className="flex min-h-0 flex-1 flex-col gap-1">
          <div className="relative flex justify-center" style={{ height: 250 }}>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={studentGenderData}
                  cx="50%"
                  cy="50%"
                  innerRadius="50%"
                  outerRadius="78%"
                  paddingAngle={2}
                  dataKey="value"
                  startAngle={90}
                  endAngle={450}
                >
                  {studentGenderData.map((entry) => (
                    <Cell key={entry.name} fill={GENDER_COLORS[entry.name] ?? GENDER_COLORS.Other} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center">
              <MarsSymbol className="h-10 w-10" color={GENDER_COLORS.Male} />
              <VenusSymbol className="h-10 w-10" color={GENDER_COLORS.Female} />
            </div>
          </div>

          <div className="flex w-full flex-col gap-1.5">
            {studentGenderData.map((item) => {
              const pct = total > 0 ? ((item.value / total) * 100).toFixed(0) : 0;
              const color = GENDER_COLORS[item.name] ?? GENDER_COLORS.Other;

              return (
                <div key={item.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                    <span className="text-muted-foreground">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="font-bold" style={{ color }}>{item.value}</span>
                    <span className="text-muted-foreground">({pct}%)</span>
                  </div>
                </div>
              );
            })}
            <div className="mt-0.5 flex items-center justify-between border-t border-border pt-1 text-xs">
              <span className="font-medium text-muted-foreground">Total</span>
              <span className="font-bold">{total}</span>
            </div>
          </div>
        </div>
      </NCard>
    </SelectablePreviewElement>
  );
}

function StudentAttendanceCard({ className }: { className?: string }) {
  return (
    <SelectablePreviewElement component="card" className={`flex min-h-0 ${className ?? ""}`}>
      <NCard title="Student Attendance" icon={ClipboardCheck} className="h-full w-full">
        <div className="flex min-h-0 flex-1 flex-col">
          <ChartLegend
            items={[
              { label: "Absent", color: ATTENDANCE_ABSENT_COLOR },
              { label: "Late", color: ATTENDANCE_LATE_COLOR },
            ]}
          />
          <div className="min-h-0 flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={studentAttendanceData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="0" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} dx={-10} />
                <Tooltip contentStyle={tooltipStyle} />
                <Line type="monotone" dataKey="absent" name="Absent" stroke={ATTENDANCE_ABSENT_COLOR} strokeWidth={3} dot={false} />
                <Line type="monotone" dataKey="late" name="Late" stroke={ATTENDANCE_LATE_COLOR} strokeWidth={3} strokeDasharray="5 5" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </NCard>
    </SelectablePreviewElement>
  );
}

function IncomeExpensesCard({ className }: { className?: string }) {
  return (
    <SelectablePreviewElement component="card" className={`flex min-h-0 ${className ?? ""}`}>
      <NCard title="Income vs Expenses" icon={DollarSign} className="h-full w-full">
        <div className="flex min-h-0 flex-1 flex-col">
          <ChartLegend
            items={[
              { label: "Income", color: INCOME_COLOR },
              { label: "Expenses", color: EXPENSES_COLOR },
            ]}
          />
          <div className="min-h-0 flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={financeTrendData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="0" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} dx={-10} tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => formatMAD(Number(value))} />
                <Line type="monotone" dataKey="income" name="Income" stroke={INCOME_COLOR} strokeWidth={3} dot={false} />
                <Line type="monotone" dataKey="expenses" name="Expenses" stroke={EXPENSES_COLOR} strokeWidth={3} strokeDasharray="5 5" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </NCard>
    </SelectablePreviewElement>
  );
}

function ExpenseBreakdownCard({ className }: { className?: string }) {
  const total = expenseBreakdown.reduce((sum, item) => sum + item.value, 0);

  return (
    <SelectablePreviewElement component="card" className={`flex min-h-0 ${className ?? ""}`}>
      <NCard title="Expenses by Category" icon={PieIcon} className="h-full w-full">
        <div className="flex h-full flex-col gap-1">
          <p className="text-sm text-muted-foreground">
            Total : <span className="font-semibold text-foreground">{formatMAD(total)}</span>
          </p>
          <div className="min-h-[160px] flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={expenseBreakdown} cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={2} dataKey="value">
                  {expenseBreakdown.map((entry, i) => (
                    <Cell key={entry.name} fill={EXPENSE_COLORS[i % EXPENSE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => formatMAD(Number(value))} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-col gap-1">
            {expenseBreakdown.map((item, i) => (
              <div key={item.name} className="flex items-center justify-between text-xs">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: EXPENSE_COLORS[i % EXPENSE_COLORS.length] }} />
                  <span className="truncate">{item.name}</span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="tabular-nums font-medium">{formatMAD(item.value)}</span>
                  <span className="w-10 text-right tabular-nums text-muted-foreground">
                    {total > 0 ? ((item.value / total) * 100).toFixed(0) : 0}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </NCard>
    </SelectablePreviewElement>
  );
}

function TeachersAttendanceCard({ className }: { className?: string }) {
  return (
    <SelectablePreviewElement component="card" className={`flex min-h-0 ${className ?? ""}`}>
      <NCard title="Teacher Attendance" icon={UserCheck} className="h-full w-full">
        <ChartLegend
          items={[
            { label: "Absent", color: ATTENDANCE_ABSENT_COLOR },
            { label: "Late", color: ATTENDANCE_LATE_COLOR },
          ]}
        />
        <div className="min-h-0 flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={teacherAttendanceData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="absent" name="Absent" fill={ATTENDANCE_ABSENT_COLOR} radius={[6, 6, 0, 0]} maxBarSize={14} />
              <Bar dataKey="late" name="Late" fill={ATTENDANCE_LATE_COLOR} radius={[6, 6, 0, 0]} maxBarSize={14} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </NCard>
    </SelectablePreviewElement>
  );
}

function OverdueFeesCard({ className }: { className?: string }) {
  return (
    <SelectablePreviewElement component="card" className={`flex min-h-0 ${className ?? ""}`}>
      <NCard title="Overdue Fees" icon={Clock} className="h-full w-full">
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-auto">
          {overdueFees.map((row) => (
            <div key={row.studentId} className="flex items-center justify-between gap-2 rounded-lg border border-border/50 p-2 hover:bg-muted/30">
              <div className="flex min-w-0 items-center gap-2">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-100 text-xs font-bold text-red-600">
                  {getInitials(row.studentName)}
                </div>
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-semibold">{row.studentName}</span>
                  <span className="text-xs text-muted-foreground">{row.daysOverdue} days overdue</span>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-sm font-semibold text-red-600">{formatMAD(row.totalOverdue)}</span>
                <NButton size="sm" variant="outline" className="h-7 px-2">
                  <Bell className="h-3.5 w-3.5" />
                </NButton>
              </div>
            </div>
          ))}
        </div>
      </NCard>
    </SelectablePreviewElement>
  );
}

function CalendarCard({ className }: { className?: string }) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(() => new Date(2026, 5, 21));

  return (
    <SelectablePreviewElement component="card" className={`flex min-h-0 ${className ?? ""}`}>
      <NCard title="Calendar" icon={CalendarIcon} className="h-full w-full">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={setSelectedDate}
          className="mx-auto w-full rounded-md [--cell-size:2.25rem]"
        />
      </NCard>
    </SelectablePreviewElement>
  );
}

export function DashboardPreview() {
  const [active, setActive] = useState("/");
  const pageHeaderIsCard = useNajmComponentStyle("pageHeader")?.card === true;
  const sidebarStyle = useNajmComponentStyle("sidebar");
  const isStudentsView = active === "/students";

  const headerNode = (
    <SelectablePreviewElement component="pageHeader" className={pageHeaderIsCard ? "" : "shrink-0"}>
      <NPageHeader icon={LayoutDashboard} title="Dashboard">
        <NPageHeaderActions>
          <SelectablePreviewElement component="button">
            <NButton type="button" variant="outline" size="sm" className="h-9 px-3">
              EN
            </NButton>
          </SelectablePreviewElement>
          <SelectablePreviewElement component="button">
            <NButton type="button" variant="ghost" size="icon" aria-label="Toggle theme">
              <Moon size={18} />
            </NButton>
          </SelectablePreviewElement>
          <SelectablePreviewElement component="button" className="hidden sm:block">
            <NButton type="button" variant="ghost" size="icon" aria-label="Toggle fullscreen">
              <Maximize size={18} />
            </NButton>
          </SelectablePreviewElement>
        </NPageHeaderActions>
      </NPageHeader>
    </SelectablePreviewElement>
  );

  return (
    <div className="flex h-full w-full overflow-hidden bg-background font-sans">
      <SelectablePreviewElement component="sidebar" className="h-full shrink-0">
        <NSidebar
          logo={{ variant: "chip", expanded: <GraduationCap className="size-6 text-sidebar-primary" /> }}
          navItems={navItems}
          activePath={active}
          isActive={isSidebarItemActive}
          onNavigate={setActive}
          widths={{ expanded: 264 }}
          mobileBreakpoint="lg"
          collapseButtonPosition="rail"
          showHamburgerButton
          showSectionLabels={sidebarStyle?.showSectionLabels ?? true}
          showSectionSeparators={sidebarStyle?.showSectionSeparators ?? false}
          onSettings={() => setActive("/settings")}
          settingsLabel="Settings"
          onLogout={() => setActive("/login")}
          logoutLabel="Logout"
        />
      </SelectablePreviewElement>

      <main
        className="flex h-full min-w-0 flex-1 flex-col overflow-hidden"
        style={{ gap: "var(--section-gap)", padding: "var(--page-gutter)" }}
      >
        {!pageHeaderIsCard && !isStudentsView && headerNode}

        <NajmScroll className="min-h-0 flex-1">
          {isStudentsView ? (
            <StudentsPreview />
          ) : (
            <div className="flex min-h-full flex-col" style={{ gap: "var(--section-gap)" }}>
              {pageHeaderIsCard && headerNode}

              <div className="grid grid-cols-1 gap-[var(--section-gap)] sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                {kpis.map((kpi) => (
                  <SelectablePreviewElement component="card" key={kpi.label}>
                    <NStatCard icon={kpi.icon} label={kpi.label} value={kpi.value} />
                  </SelectablePreviewElement>
                ))}
              </div>

              <div className="grid min-h-[270px] flex-1 grid-cols-1 gap-[var(--section-gap)] md:grid-cols-12 [&>*]:min-h-0 [&>*]:min-w-0 [&>*]:overflow-hidden">
                <StudentsGenderCard className="md:col-span-2" />
                <StudentAttendanceCard className="md:col-span-4" />
                <IncomeExpensesCard className="md:col-span-6" />
              </div>

              <div className="grid min-h-[320px] flex-1 grid-cols-1 gap-[var(--section-gap)] md:grid-cols-12 [&>*]:min-h-0 [&>*]:min-w-0 [&>*]:overflow-hidden">
                <ExpenseBreakdownCard className="md:col-span-2" />
                <TeachersAttendanceCard className="md:col-span-4" />
                <OverdueFeesCard className="md:col-span-4" />
                <CalendarCard className="md:col-span-2" />
              </div>
            </div>
          )}
        </NajmScroll>
      </main>
    </div>
  );
}
