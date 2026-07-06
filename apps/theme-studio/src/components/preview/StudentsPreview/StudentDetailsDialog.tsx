import type { ReactNode } from "react";
import { NButton, NDialog, NTabs } from "najm-kit";
import {
  Activity,
  BookOpen,
  Calendar,
  CalendarCheck,
  CalendarDays,
  CheckCircle,
  CircleDollarSign,
  Clock,
  DollarSign,
  Download,
  Edit3,
  GraduationCap,
  HeartPulse,
  IdCard,
  Layers,
  Mail,
  MapPin,
  Percent,
  Phone,
  School,
  User,
  UserRound,
  Users,
} from "lucide-react";
import type { StudentPreviewRow } from "./types";

type Tone = "blue" | "violet" | "pink" | "amber" | "teal" | "emerald" | "rose" | "primary";

const toneChip: Record<Tone, string> = {
  blue: "bg-blue-500/10 text-blue-500",
  violet: "bg-violet-500/10 text-violet-500",
  pink: "bg-pink-500/10 text-pink-500",
  amber: "bg-amber-500/10 text-amber-500",
  teal: "bg-teal-500/10 text-teal-500",
  emerald: "bg-emerald-500/10 text-emerald-500",
  rose: "bg-rose-500/10 text-rose-500",
  primary: "bg-primary/10 text-primary",
};

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

/* ── Left profile panel ─────────────────────────────────────────────── */

function StatTile({ label, value, icon: Icon, tone }: { label: string; value: string; icon: any; tone: Tone }) {
  return (
    <div className="min-w-0 rounded-xl border border-border bg-card p-2.5 shadow-sm transition-all hover:shadow-md">
      <div className="mb-1.5 flex items-center gap-1.5">
        <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${toneChip[tone]}`}>
          <Icon className="h-3.5 w-3.5" />
        </div>
        <span className="truncate text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</span>
      </div>
      <p className="truncate text-sm font-bold text-foreground">{value}</p>
    </div>
  );
}

function MetricRow({
  label,
  value,
  icon: Icon,
  progress,
  barColor = "bg-primary",
  iconTone = "text-muted-foreground",
  valueClass = "text-foreground",
}: {
  label: string;
  value: string;
  icon: any;
  progress?: number;
  barColor?: string;
  iconTone?: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-3 shadow-sm transition-all hover:shadow-md">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-bold text-foreground/80">
          <Icon className={`h-4 w-4 ${iconTone}`} />
          {label}
        </div>
        <span className={`text-sm font-bold ${valueClass}`}>{value}</span>
      </div>
      {typeof progress === "number" && (
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full rounded-full ${barColor} transition-all duration-500`}
            style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}

function ProfileSidebar({ student }: { student: StudentPreviewRow }) {
  const isActive = student.status === "active";
  return (
    <aside className="h-full min-h-0 overflow-y-auto border-b border-border bg-gradient-to-b from-muted/40 to-transparent lg:border-b-0 lg:border-r">
      <div className="relative">
        <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent" />
        <div className="relative flex flex-col items-center px-4 pt-8 text-center">
          <div className="mb-3 rounded-full bg-gradient-to-br from-primary/40 via-primary/20 to-primary/5 p-[3px] shadow-lg shadow-primary/10">
            <div className="flex h-24 w-24 items-center justify-center rounded-full border-2 border-background bg-muted text-2xl font-bold text-foreground">
              {initials(student.name)}
            </div>
          </div>
          <h3 className="max-w-full truncate text-lg font-bold text-foreground">{student.name}</h3>
          <p className="font-mono text-xs tracking-wide text-muted-foreground">{student.studentCode}</p>

          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {student.class && (
              <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-600">
                {student.class.name}
                {student.section ? ` · ${student.section.name}` : ""}
              </span>
            )}
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${
                isActive
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600"
                  : "border-border bg-card text-muted-foreground"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${isActive ? "bg-emerald-500" : "bg-muted-foreground"}`} />
              {student.status.charAt(0).toUpperCase() + student.status.slice(1)}
            </span>
          </div>
        </div>
      </div>

      <div className="px-4 pb-5 pt-5">
        <div className="grid grid-cols-2 gap-2.5">
          <StatTile icon={UserRound} label="Age" value="16 yrs" tone="blue" />
          <StatTile icon={UserRound} label="Gender" value={student.gender === "F" ? "Female" : "Male"} tone="violet" />
          <StatTile icon={CalendarDays} label="Enrolled" value="2025" tone="amber" />
          <StatTile icon={BookOpen} label="Class" value={student.class?.name ?? "—"} tone="emerald" />
        </div>

        <div className="mt-2.5 space-y-2.5">
          <MetricRow icon={Activity} label="Attendance" value="92%" progress={92} barColor="bg-emerald-500" iconTone="text-emerald-500" />
          <MetricRow icon={GraduationCap} label="Avg Grade" value="78%" progress={78} barColor="bg-emerald-500" iconTone="text-violet-500" />
          <MetricRow icon={CircleDollarSign} label="Fees" value="4" iconTone="text-blue-500" />
          <MetricRow icon={Percent} label="Due" value="1.2k DH" iconTone="text-rose-500" valueClass="text-rose-600" />
        </div>
      </div>
    </aside>
  );
}

/* ── Overview tab ───────────────────────────────────────────────────── */

function SectionTitle({ title }: { title: string }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className="h-4 w-1 rounded-full bg-primary/70" />
      <h3 className="shrink-0 text-xs font-bold uppercase tracking-wider text-muted-foreground">{title}</h3>
    </div>
  );
}

function InfoItem({ icon: Icon, label, value, tone }: { icon: any; label: string; value: string; tone: Tone }) {
  return (
    <div className="flex min-w-0 items-start gap-3">
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${toneChip[tone]}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-0.5 text-xs font-medium text-muted-foreground">{label}</div>
        <div className="truncate text-sm font-semibold text-foreground">{value || "—"}</div>
      </div>
    </div>
  );
}

function InfoCard({ children }: { children: ReactNode }) {
  return (
    <div className="w-full rounded-xl border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md">
      {children}
    </div>
  );
}

function OverviewTab({ student }: { student: StudentPreviewRow }) {
  return (
    <div className="space-y-5">
      <section>
        <SectionTitle title="Personal Information" />
        <InfoCard>
          <div className="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-3">
            <InfoItem icon={User} label="Full Name" value={student.name} tone="blue" />
            <InfoItem icon={IdCard} label="Student Code" value={student.studentCode} tone="violet" />
            <InfoItem icon={Calendar} label="Date of Birth" value="Mar 13, 2010" tone="pink" />
            <InfoItem icon={Users} label="Gender" value={student.gender === "F" ? "Female" : "Male"} tone="teal" />
            <InfoItem icon={CheckCircle} label="Status" value={student.status} tone="emerald" />
            <InfoItem icon={HeartPulse} label="Medical" value="None recorded" tone="rose" />
          </div>
        </InfoCard>
      </section>

      <section>
        <SectionTitle title="Academic Information" />
        <InfoCard>
          <div className="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-3">
            <InfoItem icon={BookOpen} label="Class" value={student.class?.name ?? "—"} tone="blue" />
            <InfoItem icon={Layers} label="Section" value={student.section?.name ?? "—"} tone="violet" />
            <InfoItem icon={Clock} label="Enrollment Date" value="Sep 1, 2025" tone="amber" />
            <InfoItem icon={School} label="Previous School" value="Al Jabr School" tone="primary" />
          </div>
        </InfoCard>
      </section>

      <section>
        <SectionTitle title="Contact Information" />
        <InfoCard>
          <div className="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-3">
            <InfoItem icon={Mail} label="Email" value={student.email ?? "No email"} tone="blue" />
            <InfoItem icon={Phone} label="Phone" value={student.phone ?? "No phone"} tone="emerald" />
            <InfoItem icon={MapPin} label="Address" value="249, Avenue Imam Malik, Meknès" tone="rose" />
          </div>
        </InfoCard>
      </section>
    </div>
  );
}

function TabPlaceholder({ label }: { label: string }) {
  return (
    <div className="flex h-40 flex-col items-center justify-center gap-1 text-center">
      <p className="text-sm font-semibold text-foreground">{label}</p>
      <p className="text-xs text-muted-foreground">Demo tab — content lives in the full application.</p>
    </div>
  );
}

/* ── Dialog ─────────────────────────────────────────────────────────── */

export function StudentDetailsDialog({
  student,
  open,
  onOpenChange,
}: {
  student: StudentPreviewRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!student) return null;

  const tabItems = [
    { value: "overview", icon: User, label: "Overview", content: <OverviewTab student={student} /> },
    { value: "parents", icon: Users, label: "Parents", content: <TabPlaceholder label="Parents" /> },
    { value: "attendance", icon: CalendarCheck, label: "Attendance", content: <TabPlaceholder label="Attendance" /> },
    { value: "grades", icon: GraduationCap, label: "Grades", content: <TabPlaceholder label="Grades" /> },
    { value: "fees", icon: DollarSign, label: "Fees", content: <TabPlaceholder label="Fees" /> },
  ];

  return (
    <NDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Student Details"
      pageHeader={{
        icon: GraduationCap,
        title: "Student Details",
        subtitle: "Profile & Academic Records",
        actions: (
          <>
            <NButton variant="outline" size="sm" className="gap-2">
              <Download className="h-4 w-4" />
              Download Report
            </NButton>
            <NButton size="sm" className="gap-2">
              <Edit3 className="h-4 w-4" />
              Edit Student
            </NButton>
          </>
        ),
      }}
      padding="none"
      width="full"
      height="full"
      showButtons={false}
    >
      <div className="grid h-full min-h-0 w-full grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)]">
        <ProfileSidebar student={student} />
        <div className="flex min-h-0 flex-col">
          <NTabs
            items={tabItems}
            defaultValue="overview"
            variant="underline"
            classNames={{
              root: "min-h-0 w-full flex-1 gap-0",
              list: "sticky top-0 z-10 h-auto shrink-0 justify-start gap-4 overflow-x-auto bg-card px-5 py-0",
              trigger:
                "text-muted-foreground hover:text-foreground data-[state=active]:text-primary! data-[state=active]:border-b-primary! pb-3 pt-3 px-2 gap-2",
              content: "min-h-0 flex-1 overflow-y-auto px-5 py-4",
            }}
          />
        </div>
      </div>
    </NDialog>
  );
}
