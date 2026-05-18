import { useState, useEffect, useCallback } from "react";
import { useGetMe } from "@workspace/api-client-react";
import { useCurrency } from "@/contexts/CurrencyContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  BarChart,
  LabelList,
} from "recharts";
import {
  Loader2,
  TrendingUp,
  DollarSign,
  Briefcase,
  Target,
  AlertCircle,
  Users,
} from "lucide-react";

interface SummaryData {
  totalDeals: number;
  totalAgreedAmount: number;
  totalReceivedAmount: number;
  totalOutstandingAmount: number;
  closedDeals: number;
  lostDeals: number;
  avgProgress: number;
  quotationSentCount: number;
}

interface StageItem {
  stage: string;
  count: number;
  totalAgreedAmount: number;
  totalReceivedAmount: number;
}

interface WeeklyItem {
  weekLabel: string;
  weekStart: string;
  weekEnd: string;
  totalDeals: number;
  closedDeals: number;
  winRate: number;
  quotationSentAmount: number;
  orderClosedAmount: number;
  orderClosedReceivedAmount: number;
  orderConfirmedAmount: number;
  orderLostAmount: number;
}

interface PersonItem {
  salespersonId: number;
  salespersonName: string | null;
  email: string | null;
  totalDeals: number;
  totalAgreedAmount: number;
  totalReceivedAmount: number;
  closedDeals: number;
  lostDeals: number;
}

interface UserOption {
  id: number;
  name: string | null;
  email: string;
}

type DateRange = "today" | "yesterday" | "last7" | "last30";

const STAGE_COLORS: Record<string, string> = {
  "Quotation Sent": "#a78bfa",
  "Order Closed": "#fbbf24",
  "Order Confirmed": "#34d399",
  "Order Lost": "#f87171",
};

const DATE_OPTIONS: { key: DateRange; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "last7", label: "Last 7 Days" },
  { key: "last30", label: "Last 30 Days" },
];

function getDateBounds(range: DateRange): { startDate: string; endDate: string } {
  const now = new Date();
  const pad = (d: Date) => d.toISOString().split("T")[0];
  if (range === "today") return { startDate: pad(now), endDate: pad(now) };
  if (range === "yesterday") {
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    return { startDate: pad(y), endDate: pad(y) };
  }
  if (range === "last7") {
    const s = new Date(now);
    s.setDate(s.getDate() - 6);
    return { startDate: pad(s), endDate: pad(now) };
  }
  const s = new Date(now);
  s.setDate(s.getDate() - 29);
  return { startDate: pad(s), endDate: pad(now) };
}

function fmtK(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(Math.round(n));
}

const TOOLTIP_STYLE = {
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
  fontSize: "12px",
  color: "hsl(var(--foreground))",
};

export default function ReportsDashboard() {
  const { data: me } = useGetMe();
  const { formatAmount } = useCurrency();

  const isOwner = me?.role === "owner";

  const [dateRange, setDateRange] = useState<DateRange>("last30");
  const [selectedSpId, setSelectedSpId] = useState<string>("all");
  const [users, setUsers] = useState<UserOption[]>([]);

  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [stageData, setStageData] = useState<StageItem[]>([]);
  const [weeklyData, setWeeklyData] = useState<WeeklyItem[]>([]);
  const [byPerson, setByPerson] = useState<PersonItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOwner) {
      fetch("/api/users", { credentials: "include" })
        .then((r) => r.json())
        .then(setUsers)
        .catch(() => {});
    }
  }, [isOwner]);

  const buildQs = useCallback(() => {
    const { startDate, endDate } = getDateBounds(dateRange);
    const p = new URLSearchParams({ startDate, endDate });
    if (isOwner && selectedSpId !== "all") p.set("salespersonId", selectedSpId);
    return p.toString();
  }, [dateRange, selectedSpId, isOwner]);

  useEffect(() => {
    if (!me) return;
    setLoading(true);
    const qs = buildQs();
    Promise.all([
      fetch(`/api/reports/summary?${qs}`, { credentials: "include" }).then((r) => r.json()),
      fetch(`/api/reports/stage-breakdown?${qs}`, { credentials: "include" }).then((r) => r.json()),
      fetch(`/api/reports/weekly-stage-breakdown?${qs}`, { credentials: "include" }).then((r) => r.json()),
      isOwner && selectedSpId === "all"
        ? fetch(`/api/reports/by-salesperson?${qs}`, { credentials: "include" }).then((r) => r.json())
        : Promise.resolve([]),
    ])
      .then(([sum, stages, weekly, persons]) => {
        setSummary(sum && !sum.error ? sum : null);
        setStageData(Array.isArray(stages) ? stages : []);
        setWeeklyData(Array.isArray(weekly) ? weekly : []);
        setByPerson(Array.isArray(persons) ? persons : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [me, buildQs, isOwner, selectedSpId]);

  if (!me || loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const winRate =
    summary && summary.quotationSentCount > 0
      ? Math.round((summary.closedDeals / summary.quotationSentCount) * 100)
      : 0;

  const pieData = stageData
    .filter((s) => s.count > 0)
    .map((s) => ({ name: s.stage, value: s.count, amount: s.totalAgreedAmount }));

  const topPersons = [...byPerson]
    .sort((a, b) => b.totalAgreedAmount - a.totalAgreedAmount)
    .slice(0, 8)
    .map((p) => ({
      name: (p.salespersonName || p.email || "Unknown").split(" ")[0],
      agreed: Math.round(p.totalAgreedAmount),
      received: Math.round(p.totalReceivedAmount),
      deals: p.totalDeals,
    }));

  const CustomPieTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div style={TOOLTIP_STYLE} className="p-3 shadow-xl">
        <p className="font-semibold mb-1">{d.name}</p>
        <p className="text-muted-foreground">{d.value} deals</p>
        <p style={{ color: STAGE_COLORS[d.name] }}>{formatAmount(d.amount)}</p>
      </div>
    );
  };

  const CustomWeeklyTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={TOOLTIP_STYLE} className="p-3 shadow-xl min-w-52">
        <p className="font-semibold mb-2">{label}</p>
        {payload.map((p: any) => (
          <div key={p.name} className="flex justify-between gap-6 py-0.5">
            <span style={{ color: p.color }} className="text-xs">
              {p.name}
            </span>
            <span className="text-xs font-medium">
              {formatAmount(p.value ?? 0)}
            </span>
          </div>
        ))}
      </div>
    );
  };

  const CustomBarTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={TOOLTIP_STYLE} className="p-3 shadow-xl">
        <p className="font-semibold mb-1">{label}</p>
        {payload.map((p: any) => (
          <div key={p.name} className="flex justify-between gap-4 py-0.5">
            <span style={{ color: p.color }} className="text-xs">{p.name}</span>
            <span className="text-xs font-medium">{formatAmount(p.value ?? 0)}</span>
          </div>
        ))}
      </div>
    );
  };

  const renderCustomPieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
    if (percent < 0.06) return null;
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    return (
      <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={600}>
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  const kpiCards = [
    {
      label: "Total Deals",
      value: String(summary?.totalDeals ?? 0),
      sub: `${summary?.lostDeals ?? 0} lost`,
      icon: Briefcase,
      color: "violet",
      gradient: "from-violet-500/15",
      iconBg: "bg-violet-500/10",
      iconColor: "text-violet-400",
    },
    {
      label: "Pipeline Value",
      value: fmtK(summary?.totalAgreedAmount ?? 0),
      sub: "Total agreed",
      icon: DollarSign,
      color: "blue",
      gradient: "from-blue-500/15",
      iconBg: "bg-blue-500/10",
      iconColor: "text-blue-400",
    },
    {
      label: "Received",
      value: fmtK(summary?.totalReceivedAmount ?? 0),
      sub: "Collected",
      icon: TrendingUp,
      color: "emerald",
      gradient: "from-emerald-500/15",
      iconBg: "bg-emerald-500/10",
      iconColor: "text-emerald-400",
    },
    {
      label: "Outstanding",
      value: fmtK(summary?.totalOutstandingAmount ?? 0),
      sub: "Pending",
      icon: AlertCircle,
      color: "amber",
      gradient: "from-amber-500/15",
      iconBg: "bg-amber-500/10",
      iconColor: "text-amber-400",
    },
    {
      label: "Close Rate",
      value: `${winRate}%`,
      sub: `${summary?.closedDeals ?? 0} closed`,
      icon: Target,
      color: "pink",
      gradient: "from-pink-500/15",
      iconBg: "bg-pink-500/10",
      iconColor: "text-pink-400",
    },
  ];

  const showPersonChart = isOwner && selectedSpId === "all";

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 pb-10">
      {/* ── Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reports Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Analytics overview · {DATE_OPTIONS.find((o) => o.key === dateRange)?.label}
          </p>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          {DATE_OPTIONS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setDateRange(key)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all border ${
                dateRange === key
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "border-border text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}

          {isOwner && (
            <Select value={selectedSpId} onValueChange={setSelectedSpId}>
              <SelectTrigger className="w-48 h-9">
                <Users className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
                <SelectValue placeholder="All Salespersons" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Salespersons</SelectItem>
                {users
                  .filter((u) => u.id !== me.id)
                  .map((u) => (
                    <SelectItem key={u.id} value={String(u.id)}>
                      {u.name || u.email}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {kpiCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.label} className="relative overflow-hidden border-border/60">
              <div className={`absolute inset-0 bg-gradient-to-br ${card.gradient} to-transparent pointer-events-none`} />
              <CardContent className="p-5 relative">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    {card.label}
                  </p>
                  <div className={`p-1.5 ${card.iconBg} rounded-lg`}>
                    <Icon className={`w-3.5 h-3.5 ${card.iconColor}`} />
                  </div>
                </div>
                <p className="text-2xl font-bold tracking-tight">{card.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{card.sub}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ── Charts Row: Pie + Person/Stage Bar ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Stage Pie Chart */}
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Deal Stage Breakdown</CardTitle>
            <p className="text-xs text-muted-foreground">Distribution by stage · deal count</p>
          </CardHeader>
          <CardContent className="pt-0">
            {pieData.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
                No data for selected period
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={270}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="44%"
                    innerRadius={65}
                    outerRadius={105}
                    paddingAngle={3}
                    dataKey="value"
                    labelLine={false}
                    label={renderCustomPieLabel}
                  >
                    {pieData.map((entry) => (
                      <Cell
                        key={entry.name}
                        fill={STAGE_COLORS[entry.name] ?? "#94a3b8"}
                        stroke="transparent"
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomPieTooltip />} />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    formatter={(value) => (
                      <span className="text-xs text-foreground/80">{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Salesperson pipeline OR single-person stage amounts */}
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">
              {showPersonChart ? "Salesperson Pipeline" : "Stage Amount Breakdown"}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {showPersonChart
                ? "Orders closed & received amounts by salesperson"
                : "Agreed amount per deal stage"}
            </p>
          </CardHeader>
          <CardContent className="pt-0">
            {showPersonChart ? (
              topPersons.length === 0 ? (
                <div className="h-[270px] flex items-center justify-center text-muted-foreground text-sm">
                  No data for selected period
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={270}>
                  <BarChart
                    data={topPersons}
                    layout="vertical"
                    margin={{ left: 0, right: 48, top: 4, bottom: 4 }}
                    barCategoryGap="25%"
                  >
                    <CartesianGrid
                      horizontal={false}
                      strokeDasharray="3 3"
                      stroke="hsl(var(--border))"
                      strokeOpacity={0.6}
                    />
                    <XAxis
                      type="number"
                      tickFormatter={fmtK}
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                      axisLine={false}
                      tickLine={false}
                      width={56}
                    />
                    <Tooltip content={<CustomBarTooltip />} />
                    <Bar dataKey="agreed" name="Orders Closed" fill="#a78bfa" radius={[0, 4, 4, 0]} maxBarSize={14}>
                      <LabelList
                        dataKey="agreed"
                        position="right"
                        formatter={fmtK}
                        style={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                      />
                    </Bar>
                    <Bar dataKey="received" name="Received" fill="#34d399" radius={[0, 4, 4, 0]} maxBarSize={14} />
                  </BarChart>
                </ResponsiveContainer>
              )
            ) : (
              stageData.every((s) => s.totalAgreedAmount === 0) ? (
                <div className="h-[270px] flex items-center justify-center text-muted-foreground text-sm">
                  No data for selected period
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={270}>
                  <BarChart
                    data={stageData}
                    margin={{ left: 0, right: 16, top: 20, bottom: 4 }}
                    barCategoryGap="28%"
                  >
                    <CartesianGrid
                      vertical={false}
                      strokeDasharray="3 3"
                      stroke="hsl(var(--border))"
                      strokeOpacity={0.6}
                    />
                    <XAxis
                      dataKey="stage"
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tickFormatter={fmtK}
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip content={<CustomBarTooltip />} />
                    <Bar
                      dataKey="totalAgreedAmount"
                      name="Agreed"
                      radius={[6, 6, 0, 0]}
                      maxBarSize={56}
                    >
                      {stageData.map((entry) => (
                        <Cell
                          key={entry.stage}
                          fill={STAGE_COLORS[entry.stage] ?? "#94a3b8"}
                        />
                      ))}
                      <LabelList
                        dataKey="totalAgreedAmount"
                        position="top"
                        formatter={fmtK}
                        style={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Weekly Sales Comparison Chart ── */}
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Weekly Sales Comparison</CardTitle>
          <p className="text-xs text-muted-foreground">
            Order Closed amounts vs Received amounts · trend follows Order Closed
          </p>
        </CardHeader>
        <CardContent className="pt-0">
          {weeklyData.length === 0 || weeklyData.every((w) => w.totalDeals === 0) ? (
            <div className="h-72 flex items-center justify-center text-muted-foreground text-sm">
              No data for selected period
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart
                data={weeklyData}
                margin={{ top: 24, right: 56, left: 0, bottom: 4 }}
                barCategoryGap="30%"
              >
                <CartesianGrid
                  vertical={false}
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border))"
                  strokeOpacity={0.5}
                />
                <XAxis
                  dataKey="weekLabel"
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  yAxisId="amount"
                  tickFormatter={fmtK}
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                  width={48}
                />
                <Tooltip content={<CustomWeeklyTooltip />} />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ paddingTop: "12px" }}
                  formatter={(value) => (
                    <span className="text-xs text-foreground/80">{value}</span>
                  )}
                />

                <Bar
                  yAxisId="amount"
                  dataKey="orderClosedAmount"
                  name="Order Closed"
                  fill="#a78bfa"
                  fillOpacity={0.85}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={52}
                >
                  <LabelList
                    dataKey="orderClosedAmount"
                    position="top"
                    formatter={fmtK}
                    style={{ fontSize: 10, fill: "#a78bfa", fontWeight: 600 }}
                  />
                </Bar>

                <Bar
                  yAxisId="amount"
                  dataKey="orderClosedReceivedAmount"
                  name="Received"
                  fill="#34d399"
                  fillOpacity={0.85}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={52}
                >
                  <LabelList
                    dataKey="orderClosedReceivedAmount"
                    position="top"
                    formatter={fmtK}
                    style={{ fontSize: 10, fill: "#059669", fontWeight: 600 }}
                  />
                </Bar>

                <Line
                  yAxisId="amount"
                  type="monotone"
                  dataKey="orderClosedAmount"
                  name="Trend"
                  stroke="#60a5fa"
                  strokeWidth={2.5}
                  dot={{ fill: "#60a5fa", r: 4, strokeWidth: 2, stroke: "hsl(var(--card))" }}
                  activeDot={{ r: 6, strokeWidth: 2, stroke: "hsl(var(--card))" }}
                  legendType="none"
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
