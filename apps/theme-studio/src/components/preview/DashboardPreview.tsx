import { useState } from "react";
import {
  NSidebar,
  NPageHeader,
  NPageHeaderActions,
  NStatCard,
  NCard,
  NBadge,
  NButton,
  NAlert,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  NajmScroll,
  useNajmComponentStyle,
  type NavItem,
} from "najm-kit";
import {
  LayoutDashboard,
  Users,
  BookOpen,
  CalendarDays,
  CreditCard,
  Settings,
  GraduationCap,
  Plus,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { SelectablePreviewElement } from "../SelectablePreviewElement";

const revenueData = [
  { m: "Jan", revenue: 240, enrollments: 86, retention: 91 },
  { m: "Feb", revenue: 320, enrollments: 112, retention: 92 },
  { m: "Mar", revenue: 280, enrollments: 98, retention: 90 },
  { m: "Apr", revenue: 410, enrollments: 136, retention: 93 },
  { m: "May", revenue: 380, enrollments: 128, retention: 94 },
  { m: "Jun", revenue: 520, enrollments: 162, retention: 95 },
  { m: "Jul", revenue: 560, enrollments: 171, retention: 96 },
  { m: "Aug", revenue: 610, enrollments: 184, retention: 94 },
];

const attendanceData = [
  { grade: "G6", present: 94, absent: 6 },
  { grade: "G7", present: 89, absent: 11 },
  { grade: "G8", present: 92, absent: 8 },
  { grade: "G9", present: 87, absent: 13 },
  { grade: "G10", present: 95, absent: 5 },
];

const programMix = [
  { name: "STEM", value: 42 },
  { name: "Languages", value: 24 },
  { name: "Arts", value: 18 },
  { name: "Sports", value: 16 },
];

const pipelineData = [
  { stage: "Leads", value: 380 },
  { stage: "Tours", value: 240 },
  { stage: "Applied", value: 168 },
  { stage: "Admitted", value: 121 },
  { stage: "Enrolled", value: 96 },
];

const rows = [
  { name: "Sara Idrissi", action: "Enrolled in Algebra 101", status: "Active", time: "08:42" },
  { name: "Yassine Alami", action: "Paid invoice #2043", status: "Active", time: "09:16" },
  { name: "Nadia Benali", action: "Submitted enrollment form", status: "Pending", time: "10:03" },
  { name: "Omar Tazi", action: "Updated profile", status: "Active", time: "11:28" },
  { name: "Mina Bennani", action: "Booked parent conference", status: "Pending", time: "12:10" },
];

const agenda = [
  { title: "Parent orientation", meta: "Auditorium · 10:00", tone: "default" },
  { title: "Scholarship review", meta: "Finance office · 13:30", tone: "secondary" },
  { title: "Science fair setup", meta: "Lab wing · 15:00", tone: "outline" },
  { title: "Transport audit", meta: "Operations · 16:15", tone: "warning" },
];

const courseLoad = [
  { course: "Algebra 101", seats: "31/36", fill: "86%" },
  { course: "Biology Lab", seats: "24/28", fill: "86%" },
  { course: "Creative Writing", seats: "18/24", fill: "75%" },
  { course: "Robotics", seats: "16/18", fill: "89%" },
];

const chartColors = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)"];

const tooltipStyle = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  color: "var(--popover-foreground)",
};

const navItems: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, sectionLabel: "Overview" },
  { id: "students", label: "Students", icon: Users, sectionLabel: "Manage" },
  { id: "courses", label: "Courses", icon: BookOpen, sectionLabel: "Manage" },
  { id: "schedule", label: "Schedule", icon: CalendarDays, sectionLabel: "Manage" },
  { id: "billing", label: "Billing", icon: CreditCard, sectionLabel: "Manage" },
  { id: "settings", label: "Settings", icon: Settings, sectionLabel: "System" },
];

export function DashboardPreview() {
  const [active, setActive] = useState("dashboard");
  // When the page header renders as a card it should sit inside the same p-5
  // gutter as the rest of the content; the bar (border-b) variant stays
  // full-bleed across the top.
  const pageHeaderIsCard = useNajmComponentStyle("pageHeader")?.card === true;
  const sidebarStyle = useNajmComponentStyle("sidebar");

  const headerNode = (
    <SelectablePreviewElement component="pageHeader">
      <NPageHeader
        icon={LayoutDashboard}
        title="Dashboard"
        subtitle="Overview of recent activity"
      >
        <NPageHeaderActions>
          <NButton size="sm" leftIcon={<Plus className="size-4" />}>
            New record
          </NButton>
        </NPageHeaderActions>
      </NPageHeader>
    </SelectablePreviewElement>
  );

  return (
    // Matches the studio shell: standalone NSidebar + <main>, one NPageHeader per page.
    <div className="flex h-full w-full overflow-hidden">
      <SelectablePreviewElement component="sidebar" className="h-full shrink-0">
        <NSidebar
          logo={
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <GraduationCap className="size-5 text-primary" />
              </div>
              <div className="flex min-w-0 flex-col leading-tight">
                <span className="truncate text-sm font-semibold">Najm Academy</span>
                <span className="truncate text-xs text-muted-foreground">School admin</span>
              </div>
            </div>
          }
          navItems={navItems}
          activePath={active}
          onNavigate={setActive}
          collapseButtonPosition="rail"
          showSectionLabels={sidebarStyle?.showSectionLabels ?? true}
          showSectionSeparators={sidebarStyle?.showSectionSeparators ?? true}
        />
      </SelectablePreviewElement>

      <main className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
        {/* Bar (default) header: a full-bleed top bar OUTSIDE the scroll area,
            so it spans edge-to-edge and is unaffected by the preview spacing. */}
        {!pageHeaderIsCard && headerNode}
        {/* Overlay scrollbar reserves no layout space, so a 0 gutter is a true
            0 and the card header / content stay symmetric left-to-right. */}
        <NajmScroll className="min-h-0 flex-1">
          {/* Card header: inset INSIDE the scroll area so it shares the gutter
              and lines up with the content cards below. */}
          {pageHeaderIsCard && (
            <div
              className="sticky top-0 z-10 bg-background"
              style={{
                paddingLeft: "var(--page-gutter)",
                paddingRight: "var(--page-gutter)",
                paddingTop: "var(--section-gap)",
              }}
            >
              {headerNode}
            </div>
          )}

          <div
            className="flex flex-col"
            style={{
              gap: "var(--section-gap)",
              paddingLeft: "var(--page-gutter)",
              paddingRight: "var(--page-gutter)",
              paddingTop: "var(--section-gap)",
              paddingBottom: "var(--section-gap)",
            }}
          >
          <SelectablePreviewElement component="alert">
            <NAlert
              variant="info"
              title="Enrollment season is trending ahead"
              description="Applications are up 14% week over week. Review tour capacity and scholarship approvals before Friday."
            />
          </SelectablePreviewElement>

          <div className="grid grid-cols-1 gap-[var(--section-gap)] sm:grid-cols-2 lg:grid-cols-4">
            <SelectablePreviewElement component="card">
              <NStatCard icon="users" label="Students" value="1,284" change={{ value: "+4.2%", positive: true }} />
            </SelectablePreviewElement>
            <SelectablePreviewElement component="card">
              <NStatCard icon="dollar-sign" label="Revenue" value="$84k" change={{ value: "+8.1%", positive: true }} />
            </SelectablePreviewElement>
            <SelectablePreviewElement component="card">
              <NStatCard icon="calendar" label="Attendance" value="92%" change={{ value: "-1.3%", positive: false }} />
            </SelectablePreviewElement>
            <SelectablePreviewElement component="card">
              <NStatCard icon="book" label="Open seats" value="312" change={{ value: "86% filled", positive: true }} />
            </SelectablePreviewElement>
          </div>

          <div className="grid grid-cols-1 gap-[var(--section-gap)] lg:grid-cols-3">
            <SelectablePreviewElement component="card" className="lg:col-span-2">
              <NCard title="Revenue and enrollment" description="Monthly revenue, starts, and retention">
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={revenueData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="m" stroke="var(--muted-foreground)" fontSize={12} />
                      <YAxis stroke="var(--muted-foreground)" fontSize={12} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Legend />
                      <Area
                        type="monotone"
                        dataKey="revenue"
                        name="Revenue"
                        stroke="var(--chart-1)"
                        fill="var(--chart-1)"
                        fillOpacity={0.18}
                      />
                      <Area
                        type="monotone"
                        dataKey="enrollments"
                        name="Enrollments"
                        stroke="var(--chart-2)"
                        fill="var(--chart-2)"
                        fillOpacity={0.14}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </NCard>
            </SelectablePreviewElement>

            <SelectablePreviewElement component="card">
              <NCard title="Program mix" description="Current enrollment by track">
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={programMix} dataKey="value" nameKey="name" innerRadius={54} outerRadius={88} paddingAngle={3}>
                        {programMix.map((_, i) => (
                          <Cell key={i} fill={chartColors[i % chartColors.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </NCard>
            </SelectablePreviewElement>
          </div>

          <div className="grid grid-cols-1 gap-[var(--section-gap)] xl:grid-cols-5">
            <SelectablePreviewElement component="card" className="xl:col-span-3">
              <NCard title="Attendance by grade" description="Present vs absent today">
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={attendanceData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="grade" stroke="var(--muted-foreground)" fontSize={12} />
                      <YAxis stroke="var(--muted-foreground)" fontSize={12} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Legend />
                      <Bar dataKey="present" name="Present" stackId="a" fill="var(--chart-2)" radius={[5, 5, 0, 0]} />
                      <Bar dataKey="absent" name="Absent" stackId="a" fill="var(--chart-3)" radius={[5, 5, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </NCard>
            </SelectablePreviewElement>

            <SelectablePreviewElement component="card" className="xl:col-span-2">
              <NCard title="Admissions funnel" description="Lead flow this term">
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={pipelineData} layout="vertical" margin={{ left: 14 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis type="number" hide />
                      <YAxis type="category" dataKey="stage" stroke="var(--muted-foreground)" fontSize={12} width={72} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="value" name="Students" fill="var(--chart-1)" radius={5} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </NCard>
            </SelectablePreviewElement>
          </div>

          <div className="grid grid-cols-1 gap-[var(--section-gap)] xl:grid-cols-3">
            <SelectablePreviewElement component="card">
              <NCard title="Retention health" description="Monthly retention percentage">
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={revenueData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="m" stroke="var(--muted-foreground)" fontSize={12} />
                      <YAxis domain={[84, 100]} stroke="var(--muted-foreground)" fontSize={12} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Line
                        type="monotone"
                        dataKey="retention"
                        name="Retention"
                        stroke="var(--chart-3)"
                        strokeWidth={3}
                        dot={{ r: 3, fill: "var(--chart-3)" }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </NCard>
            </SelectablePreviewElement>

            <SelectablePreviewElement component="card">
              <NCard title="Today's agenda">
                <div className="flex flex-col divide-y divide-border">
                  {agenda.map((item) => (
                    <div key={item.title} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{item.title}</div>
                        <div className="truncate text-xs text-muted-foreground">{item.meta}</div>
                      </div>
                      <NBadge
                        variant={
                          item.tone === "warning"
                            ? "warning"
                            : item.tone === "outline"
                              ? "outline"
                              : item.tone === "secondary"
                                ? "secondary"
                                : "default"
                        }
                      >
                        Today
                      </NBadge>
                    </div>
                  ))}
                </div>
              </NCard>
            </SelectablePreviewElement>

            <SelectablePreviewElement component="card">
              <NCard title="Course capacity">
                <div className="flex flex-col gap-3">
                  {courseLoad.map((course) => (
                    <div key={course.course} className="space-y-1.5">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="font-medium">{course.course}</span>
                        <span className="text-muted-foreground">{course.seats}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary" style={{ width: course.fill }} />
                      </div>
                    </div>
                  ))}
                </div>
              </NCard>
            </SelectablePreviewElement>
          </div>

          <div className="grid grid-cols-1 gap-[var(--section-gap)] xl:grid-cols-3">
            <SelectablePreviewElement component="card" className="xl:col-span-2">
              <NCard title="Recent activity" description="Latest student and billing events">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow key={r.name}>
                        <TableCell className="font-medium">{r.name}</TableCell>
                        <TableCell className="text-muted-foreground">{r.action}</TableCell>
                        <TableCell>
                          <NBadge variant={r.status === "Active" ? "success" : "warning"}>{r.status}</NBadge>
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">{r.time}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </NCard>
            </SelectablePreviewElement>

            <SelectablePreviewElement component="card">
              <NCard title="Finance snapshot" description="Open billing queue">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-md border border-border bg-muted/35 p-3">
                    <div className="text-xs text-muted-foreground">Collected</div>
                    <div className="mt-1 text-2xl font-semibold">$42.8k</div>
                  </div>
                  <div className="rounded-md border border-border bg-muted/35 p-3">
                    <div className="text-xs text-muted-foreground">Outstanding</div>
                    <div className="mt-1 text-2xl font-semibold">$9.4k</div>
                  </div>
                  <div className="rounded-md border border-border bg-muted/35 p-3">
                    <div className="text-xs text-muted-foreground">Autopay</div>
                    <div className="mt-1 text-2xl font-semibold">68%</div>
                  </div>
                  <div className="rounded-md border border-border bg-muted/35 p-3">
                    <div className="text-xs text-muted-foreground">Risk</div>
                    <div className="mt-1 text-2xl font-semibold">12</div>
                  </div>
                </div>
              </NCard>
            </SelectablePreviewElement>
          </div>
          </div>
        </NajmScroll>
      </main>
    </div>
  );
}
