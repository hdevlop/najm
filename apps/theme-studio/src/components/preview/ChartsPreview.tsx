import { NCard } from "najm-kit";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

const series = [
  { m: "Jan", a: 240, b: 140, c: 90 },
  { m: "Feb", a: 320, b: 180, c: 120 },
  { m: "Mar", a: 280, b: 220, c: 100 },
  { m: "Apr", a: 410, b: 260, c: 160 },
  { m: "May", a: 380, b: 300, c: 190 },
  { m: "Jun", a: 520, b: 340, c: 210 },
];

const pie = [
  { name: "Math", value: 40 },
  { name: "Science", value: 30 },
  { name: "Arts", value: 20 },
  { name: "Sports", value: 10 },
];

const chartColors = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)"];

const tooltipStyle = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  color: "var(--popover-foreground)",
};

export function ChartsPreview() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2" style={{ gap: "var(--section-gap)" }}>
      <NCard title="Line chart">
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="m" stroke="var(--muted-foreground)" fontSize={12} />
              <YAxis stroke="var(--muted-foreground)" fontSize={12} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend />
              <Line dataKey="a" stroke="var(--chart-1)" strokeWidth={2} />
              <Line dataKey="b" stroke="var(--chart-2)" strokeWidth={2} />
              <Line dataKey="c" stroke="var(--chart-3)" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </NCard>

      <NCard title="Bar chart">
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={series}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="m" stroke="var(--muted-foreground)" fontSize={12} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="a" fill="var(--chart-1)" radius={4} />
              <Bar dataKey="b" fill="var(--chart-2)" radius={4} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </NCard>

      <NCard title="Area chart">
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="m" stroke="var(--muted-foreground)" fontSize={12} />
              <Tooltip contentStyle={tooltipStyle} />
              <Area dataKey="a" stroke="var(--chart-1)" fill="var(--chart-1)" fillOpacity={0.2} />
              <Area dataKey="b" stroke="var(--chart-3)" fill="var(--chart-3)" fillOpacity={0.2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </NCard>

      <NCard title="Donut chart">
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={pie} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80}>
                {pie.map((_, i) => (
                  <Cell key={i} fill={chartColors[i % chartColors.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </NCard>
    </div>
  );
}
