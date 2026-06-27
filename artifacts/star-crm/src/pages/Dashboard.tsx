import { useState, useEffect, useCallback, useMemo } from "react";
import { useLocation } from "wouter";
import { useGetMe } from "@workspace/api-client-react";
import { useOwnerControls, DateRange, getDateBounds, MONTHS } from "@/contexts/OwnerControlsContext";
import { useTranslation } from "@/i18n/LanguageContext";
import { OwnerControlsBar } from "@/components/layout/OwnerControlsBar";
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
  Briefcase,
  Target,
  Users,
  CalendarRange,
} from "lucide-react";

interface SummaryData {
  totalDeals: number;
  totalAgreedAmount: number;
  totalReceivedAmount: number;
  totalOutstandingAmount: number;
  closedDeals: number;
  closedAmount: number;
  confirmedDeals: number;
  confirmedAmount: number;
  lostDeals: number;
  lostAmount: number;
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

interface EnrichedPerson {
  salespersonId: number;
  salespersonName: string | null;
  email: string | null;
  currency: string | null;
  totalDeals: number;
  totalAgreedAmount: number;
  totalReceivedAmount: number;
  totalOutstandingAmount: number;
  closedDeals: number;
  confirmedDeals: number;
  confirmedAmount: number;
  lostDeals: number;
  lostAmount: number;
  quotationSentCount: number;
  quotationSentAmount: number;
  agreedAmountAll: number;
  avgProgress: number;
}

interface UserOption {
  id: number;
  name: string | null;
  email: string;
}

interface RegionStageRow {
  region: string;
  currency: string;
  stage: string;
  amount: number;
  count: number;
}

interface CategoryBreakdownRow {
  dealType: string;
  currency: string;
  count: number;
  totalAmount: number;
}

const STAGE_COLORS: Record<string, string> = {
  "Quotation Sent": "#a78bfa",
  "Order Closed": "#fbbf24",
  "Order Confirmed": "#34d399",
  "Order Lost": "#f87171",
  "Sales Return": "#fb923c",
};

const CATEGORY_LABELS: Record<string, string> = {
  "New Deal":  "New Customer",
  "Recurring": "Existing Customer",
  "Dealer":    "Dealer Customer",
};

const CATEGORY_COLORS: Record<string, string> = {
  "New Deal":  "#60a5fa",
  "Recurring": "#34d399",
  "Dealer":    "#a78bfa",
};

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

export default function Dashboard() {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const { data: me } = useGetMe();
  const {
    formatConverted, selectedRegion, selectedYear,
    getRateFor, loadMultiRates, selectedCurrency, conversionRate,
    dateRange, setDateRange, fromMonth, setFromMonth, toMonth, setToMonth, getActiveDateBounds,
  } = useOwnerControls();

  const isOwner = me?.role === "owner";

  const [selectedSpId, setSelectedSpId] = useState<string>("all");
  const [users, setUsers] = useState<UserOption[]>([]);

  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [stageData, setStageData] = useState<StageItem[]>([]);
  const [weeklyData, setWeeklyData] = useState<WeeklyItem[]>([]);
  const [byPerson, setByPerson] = useState<EnrichedPerson[]>([]);
  const [regionStageRaw, setRegionStageRaw] = useState<RegionStageRow[]>([]);
  const [categoryRaw, setCategoryRaw] = useState<CategoryBreakdownRow[]>([]);
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
    const { startDate, endDate } = getActiveDateBounds();
    const p = new URLSearchParams({ startDate, endDate });
    if (isOwner && selectedSpId !== "all") p.set("salespersonId", selectedSpId);
    if (isOwner && selectedRegion !== "all") p.set("region", selectedRegion);
    return p.toString();
  }, [getActiveDateBounds, selectedSpId, isOwner, selectedRegion]);

  // Fetch region-stage breakdown independently (always all regions, only date-filtered)
  useEffect(() => {
    if (!me || !isOwner) return;
    const { startDate, endDate } = getActiveDateBounds();
    const qs = new URLSearchParams({ startDate, endDate }).toString();
    fetch(`/api/reports/region-stage-breakdown?${qs}`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => setRegionStageRaw(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [me, isOwner, getActiveDateBounds]);

  // Fetch category (dealType) breakdown for closed orders — respects all filters
  useEffect(() => {
    if (!me) return;
    const qs = buildQs();
    fetch(`/api/reports/category-breakdown?${qs}`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => setCategoryRaw(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [me, buildQs]);

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
        const arr: EnrichedPerson[] = Array.isArray(persons) ? persons : [];
        setByPerson(arr);
        if (isOwner && selectedSpId === "all" && selectedRegion === "all" && arr.length > 0) {
          const currencies = [...new Set(arr.map((p) => p.currency).filter(Boolean))] as string[];
          if (currencies.length > 0) loadMultiRates(currencies);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [me, buildQs, isOwner, selectedSpId, selectedRegion, loadMultiRates]);

  // Aggregate region-stage raw rows into chart-ready entries with currency conversion
  const regionChartData = useMemo(() => {
    if (!isOwner || regionStageRaw.length === 0) return [];
    type RegionEntry = {
      region: string;
      "Quotation Sent": number; quotationSentCount: number;
      "Order Confirmed": number; orderConfirmedCount: number;
      "Order Closed": number; orderClosedCount: number;
      "Order Lost": number; orderLostCount: number;
    };
    const map = new Map<string, RegionEntry>();
    for (const row of regionStageRaw) {
      if (!map.has(row.region)) {
        map.set(row.region, {
          region: row.region,
          "Quotation Sent": 0, quotationSentCount: 0,
          "Order Confirmed": 0, orderConfirmedCount: 0,
          "Order Closed": 0, orderClosedCount: 0,
          "Order Lost": 0, orderLostCount: 0,
        });
      }
      const entry = map.get(row.region)!;
      const converted = Math.round(row.amount * getRateFor(row.currency));
      if (row.stage === "Quotation Sent")  { entry["Quotation Sent"]  += converted; entry.quotationSentCount  += row.count; }
      if (row.stage === "Order Confirmed") { entry["Order Confirmed"] += converted; entry.orderConfirmedCount += row.count; }
      if (row.stage === "Order Closed")    { entry["Order Closed"]    += converted; entry.orderClosedCount    += row.count; }
      if (row.stage === "Order Lost")      { entry["Order Lost"]      += converted; entry.orderLostCount      += row.count; }
    }
    return Array.from(map.values()).sort(
      (a, b) => b["Quotation Sent"] - a["Quotation Sent"],
    );
  }, [regionStageRaw, getRateFor, isOwner]);

  // Aggregate category breakdown rows with currency conversion
  const categoryChartData = useMemo(() => {
    const map = new Map<string, { dealType: string; count: number; totalAmount: number }>();
    for (const row of categoryRaw) {
      if (!map.has(row.dealType)) {
        map.set(row.dealType, { dealType: row.dealType, count: 0, totalAmount: 0 });
      }
      const entry = map.get(row.dealType)!;
      entry.count      += row.count;
      entry.totalAmount += Math.round(row.totalAmount * getRateFor(row.currency));
    }
    return Array.from(map.values()).sort((a, b) => b.totalAmount - a.totalAmount);
  }, [categoryRaw, getRateFor]);

  const allRegionsTotals = useMemo(() => {
    if (!isOwner || selectedRegion !== "all" || selectedSpId !== "all" || byPerson.length === 0) return null;
    const sum  = (field: keyof EnrichedPerson) =>
      byPerson.reduce((s, p) => s + ((p[field] as number) ?? 0) * getRateFor(p.currency ?? ""), 0);
    const cnt  = (field: keyof EnrichedPerson) =>
      byPerson.reduce((s, p) => s + ((p[field] as number) ?? 0), 0);
    return {
      totalDeals:             cnt("totalDeals"),
      totalAgreedAmount:      sum("agreedAmountAll"),
      totalReceivedAmount:    sum("totalReceivedAmount"),
      totalOutstandingAmount: sum("totalOutstandingAmount"),
      closedDeals:            cnt("closedDeals"),
      closedAmount:           sum("totalAgreedAmount"),
      quotationSentCount:     cnt("quotationSentCount"),
      quotationSentAmount:    sum("quotationSentAmount"),
      confirmedDeals:         cnt("confirmedDeals"),
      confirmedAmount:        sum("confirmedAmount"),
      lostDeals:              cnt("lostDeals"),
      lostAmount:             sum("lostAmount"),
    };
  }, [byPerson, getRateFor, isOwner, selectedRegion, selectedSpId]);

  const useConverted = isOwner && selectedRegion === "all" && selectedSpId === "all" && !!allRegionsTotals;
  const kpiSrc = useConverted ? allRegionsTotals! : summary;

  const fmtAmt = useCallback((n: number) => {
    if (useConverted) {
      return new Intl.NumberFormat("en-US", {
        style: "currency", currency: selectedCurrency, maximumFractionDigits: 0,
      }).format(n);
    }
    return formatConverted(n);
  }, [useConverted, selectedCurrency, formatConverted]);

  // Formats an already-converted value in the display currency (no multiplication)
  const fmtDisplay = useCallback((n: number) => {
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency", currency: selectedCurrency, maximumFractionDigits: 0,
      }).format(n);
    } catch {
      return fmtK(n);
    }
  }, [selectedCurrency]);

  // Rate to apply to raw API chart data (weekly / stage) so bars reflect display currency.
  // topPersons values are already converted individually via getRateFor — don't apply this to them.
  const chartRate = useConverted ? 1 : conversionRate;

  if (!me || loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Pre-convert stage & weekly data to the display currency so bar heights are accurate
  const convertedStageData = stageData.map((s) => ({
    ...s,
    totalAgreedAmount:    Math.round(s.totalAgreedAmount    * chartRate),
    totalReceivedAmount:  Math.round(s.totalReceivedAmount  * chartRate),
  }));

  const convertedWeeklyData = weeklyData.map((w) => ({
    ...w,
    orderClosedAmount:          Math.round(w.orderClosedAmount          * chartRate),
    orderClosedReceivedAmount:  Math.round(w.orderClosedReceivedAmount  * chartRate),
    orderConfirmedAmount:       Math.round(w.orderConfirmedAmount       * chartRate),
    orderLostAmount:            Math.round(w.orderLostAmount            * chartRate),
  }));

  const quotationSentAmt = useConverted
    ? (allRegionsTotals?.quotationSentAmount ?? 0)
    : (stageData.find((s) => s.stage === "Quotation Sent")?.totalAgreedAmount ?? 0);

  // Always include all 4 stages, even those with 0 count
  const ALL_STAGES = ["Quotation Sent", "Order Confirmed", "Order Closed", "Order Lost", "Sales Return"];
  const pieData = ALL_STAGES.map((stageName) => {
    const found = convertedStageData.find((s) => s.stage === stageName);
    return { name: stageName, value: found?.count ?? 0, amount: found?.totalAgreedAmount ?? 0 };
  });

  const topPersons = [...byPerson]
    .map((p) => ({
      name: p.salespersonName || p.email || "Unknown",
      closedAmount: Math.round((p.totalAgreedAmount ?? 0) * getRateFor(p.currency ?? "")),
      deals: p.closedDeals ?? 0,
    }))
    .sort((a, b) => b.closedAmount - a.closedAmount);

  const CustomPieTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div style={TOOLTIP_STYLE} className="p-3 shadow-xl">
        <p className="font-semibold mb-1">{d.name}</p>
        <p className="text-muted-foreground">{d.value} deals</p>
        <p style={{ color: STAGE_COLORS[d.name] }}>{fmtDisplay(d.amount)}</p>
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
            <span style={{ color: p.color }} className="text-xs">{p.name}</span>
            <span className="text-xs font-medium">{fmtDisplay(p.value ?? 0)}</span>
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
            <span className="text-xs font-medium">{fmtDisplay(p.value ?? 0)}</span>
          </div>
        ))}
      </div>
    );
  };

  const CustomRegionTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const row = regionChartData.find((r) => r.region === label);
    if (!row) return null;
    const stages = [
      { key: "Quotation Sent",  color: STAGE_COLORS["Quotation Sent"],  count: row.quotationSentCount  },
      { key: "Order Confirmed", color: STAGE_COLORS["Order Confirmed"], count: row.orderConfirmedCount },
      { key: "Order Closed",    color: STAGE_COLORS["Order Closed"],    count: row.orderClosedCount    },
      { key: "Order Lost",      color: STAGE_COLORS["Order Lost"],      count: row.orderLostCount      },
    ];
    return (
      <div style={TOOLTIP_STYLE} className="p-3 shadow-xl min-w-52">
        <p className="font-semibold mb-2 text-sm">{label}</p>
        {payload.map((p: any) => {
          const meta = stages.find((s) => s.key === p.name);
          return (
            <div key={p.name} className="flex items-center justify-between gap-6 py-0.5">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.fill }} />
                <span className="text-xs" style={{ color: p.fill }}>{p.name}</span>
              </div>
              <div className="text-right">
                <span className="text-xs font-semibold">{fmtDisplay(p.value ?? 0)}</span>
                {meta && <span className="text-[10px] text-muted-foreground ml-1">({meta.count})</span>}
              </div>
            </div>
          );
        })}
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
      label: t("dashboard.quotationSent"),
      stage: "Quotation Sent",
      value: String(useConverted ? (allRegionsTotals?.quotationSentCount ?? 0) : (summary?.quotationSentCount ?? 0)),
      sub: fmtAmt(quotationSentAmt),
      icon: Briefcase,
      gradient: "from-violet-500/15",
      iconBg: "bg-violet-500/10",
      iconColor: "text-violet-400",
    },
    {
      label: t("dashboard.confirmedOrders"),
      stage: "Order Confirmed",
      value: String(useConverted ? (allRegionsTotals?.confirmedDeals ?? 0) : (summary?.confirmedDeals ?? 0)),
      sub: fmtAmt(useConverted ? (allRegionsTotals?.confirmedAmount ?? 0) : (summary?.confirmedAmount ?? 0)),
      icon: Target,
      gradient: "from-blue-500/15",
      iconBg: "bg-blue-500/10",
      iconColor: "text-blue-400",
    },
    {
      label: t("dashboard.closedOrders"),
      stage: "Order Closed",
      value: String(useConverted ? (allRegionsTotals?.closedDeals ?? 0) : (summary?.closedDeals ?? 0)),
      sub: fmtAmt(useConverted ? (allRegionsTotals?.closedAmount ?? 0) : (summary?.closedAmount ?? 0)),
      icon: TrendingUp,
      gradient: "from-emerald-500/15",
      iconBg: "bg-emerald-500/10",
      iconColor: "text-emerald-400",
    },
    {
      label: t("dashboard.lostOrders"),
      stage: "Order Lost",
      sublabel: t("dashboard.last90Days"),
      value: String(useConverted ? (allRegionsTotals?.lostDeals ?? 0) : (summary?.lostDeals ?? 0)),
      sub: fmtAmt(useConverted ? (allRegionsTotals?.lostAmount ?? 0) : (summary?.lostAmount ?? 0)),
      icon: Target,
      gradient: "from-pink-500/15",
      iconBg: "bg-pink-500/10",
      iconColor: "text-pink-400",
    },
  ];

  const dateRangeOptions = [
    { key: "fullyear" as DateRange, label: `${t("dashboard.fullYear")} ${selectedYear}` },
    { key: "h1"       as DateRange, label: t("dashboard.h1") },
    { key: "h2"       as DateRange, label: t("dashboard.h2") },
    { key: "last30"   as DateRange, label: t("dashboard.last30Days") },
    { key: "last7"    as DateRange, label: t("dashboard.last7Days") },
  ];

  const showPersonChart = isOwner && selectedSpId === "all";

  return (
    <div className="flex flex-col">
      <OwnerControlsBar />
      <div className="p-6 max-w-7xl mx-auto w-full space-y-6 pb-10">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t("dashboard.title")}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {t("dashboard.analyticsOverview")} ·{" "}
              {fromMonth > 0 || toMonth > 0
                ? `${fromMonth > 0 ? MONTHS[fromMonth - 1] : "Jan"} → ${toMonth > 0 ? MONTHS[toMonth - 1] : MONTHS[(fromMonth > 0 ? fromMonth : 12) - 1]} ${selectedYear}`
                : dateRangeOptions.find((o) => o.key === dateRange)?.label}
            </p>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            {/* Month range selectors */}
            <div className="flex items-center gap-1.5 border border-border rounded-md px-2 py-1 bg-background">
              <CalendarRange className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <select
                value={fromMonth}
                onChange={(e) => {
                  setFromMonth(Number(e.target.value));
                }}
                className="bg-transparent text-sm text-foreground focus:outline-none cursor-pointer pr-1"
              >
                <option value={0}>{t("dashboard.from")}</option>
                {MONTHS.map((m, i) => (
                  <option key={m} value={i + 1}>{m}</option>
                ))}
              </select>
              <span className="text-muted-foreground text-xs">→</span>
              <select
                value={toMonth}
                onChange={(e) => {
                  setToMonth(Number(e.target.value));
                }}
                className="bg-transparent text-sm text-foreground focus:outline-none cursor-pointer pr-1"
              >
                <option value={0}>{t("dashboard.to")}</option>
                {MONTHS.map((m, i) => (
                  <option key={m} value={i + 1}>{m}</option>
                ))}
              </select>
              {(fromMonth > 0 || toMonth > 0) && (
                <button
                  onClick={() => { setFromMonth(0); setToMonth(0); }}
                  className="text-muted-foreground hover:text-foreground text-xs ml-0.5"
                  title="Clear month filter"
                >✕</button>
              )}
            </div>

            {/* Preset range buttons — greyed when month filter active */}
            {dateRangeOptions.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => { setDateRange(key); setFromMonth(0); setToMonth(0); }}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all border ${
                  dateRange === key && fromMonth === 0 && toMonth === 0
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
                  <SelectValue placeholder={t("dashboard.allSalespersons")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("dashboard.allSalespersons")}</SelectItem>
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

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {kpiCards.map((card) => {
            const Icon = card.icon;
            const handleKpiClick = () => {
              const params = new URLSearchParams();
              params.set("stage", card.stage);
              if (isOwner && selectedSpId !== "all") params.set("salespersonId", selectedSpId);
              navigate(`/deals?${params.toString()}`);
            };
            return (
              <Card
                key={card.label}
                className="relative overflow-hidden border-border/60 cursor-pointer hover:shadow-lg hover:border-border transition-all"
                onClick={handleKpiClick}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${card.gradient} to-transparent pointer-events-none`} />
                <CardContent className="p-5 relative">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                        {card.label}
                      </p>
                      {(card as any).sublabel && (
                        <p className="text-[10px] text-muted-foreground/60 mt-0.5">{(card as any).sublabel}</p>
                      )}
                    </div>
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

        {/* Charts Row: Pie + Person/Stage Bar */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">{t("dashboard.orderStageDistribution")}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex flex-col gap-4">
                <ResponsiveContainer width="100%" height={230}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={95}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {pieData.map((entry) => (
                        <Cell key={entry.name} fill={STAGE_COLORS[entry.name] ?? "#94a3b8"} stroke="transparent" />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomPieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>

                {/* Custom legend — % relative to Quotation Sent */}
                {(() => {
                  return (
                    <div className="grid grid-cols-2 gap-2">
                      {pieData.map((entry) => {
                        return (
                          <div key={entry.name} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary/50">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ background: STAGE_COLORS[entry.name] ?? "#94a3b8" }}
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-[11px] text-muted-foreground truncate">{entry.name}</p>
                              <p className="text-sm font-bold leading-tight">
                                {entry.value}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">
                {showPersonChart ? t("dashboard.closedOrders") : t("dashboard.stageAmountBreakdown")}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {showPersonChart
                  ? t("dashboard.closedOrdersByPerson")
                  : t("dashboard.agreedAmountPerStage")}
              </p>
            </CardHeader>
            <CardContent className="pt-0">
              {showPersonChart ? (
                topPersons.length === 0 ? (
                  <div className="h-[270px] flex items-center justify-center text-muted-foreground text-sm">
                    {t("dashboard.noData")}
                  </div>
                ) : (
                  <div style={{ overflowY: "auto", maxHeight: 420 }}>
                    <ResponsiveContainer width="100%" height={Math.max(220, topPersons.length * 36)}>
                      <BarChart
                        data={topPersons}
                        layout="vertical"
                        margin={{ left: 0, right: 56, top: 4, bottom: 4 }}
                        barCategoryGap="25%"
                      >
                        <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.6} />
                        <XAxis type="number" tickFormatter={fmtK} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={110} />
                        <Tooltip content={<CustomBarTooltip />} />
                        <Bar dataKey="closedAmount" name="Closed Orders Amount" fill="#fbbf24" radius={[0, 4, 4, 0]} maxBarSize={18}>
                          <LabelList dataKey="closedAmount" position="right" formatter={fmtK} style={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )
              ) : (
                convertedStageData.every((s) => s.totalAgreedAmount === 0) ? (
                  <div className="h-[270px] flex items-center justify-center text-muted-foreground text-sm">
                    No data for selected period
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={270}>
                    <BarChart data={convertedStageData} margin={{ left: 0, right: 16, top: 20, bottom: 4 }} barCategoryGap="28%">
                      <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.6} />
                      <XAxis dataKey="stage" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                      <YAxis tickFormatter={fmtK} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                      <Tooltip content={<CustomBarTooltip />} />
                      <Bar dataKey="totalAgreedAmount" name="Agreed" radius={[6, 6, 0, 0]} maxBarSize={56}>
                        {convertedStageData.map((entry) => (
                          <Cell key={entry.stage} fill={STAGE_COLORS[entry.stage] ?? "#94a3b8"} />
                        ))}
                        <LabelList dataKey="totalAgreedAmount" position="top" formatter={fmtK} style={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )
              )}
            </CardContent>
          </Card>
        </div>

        {/* Weekly Sales Comparison Chart */}
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">{t("dashboard.weeklyPerformance")}</CardTitle>
            <p className="text-xs text-muted-foreground">
              Order Closed amounts vs Received amounts · trend follows Order Closed
            </p>
          </CardHeader>
          <CardContent className="pt-0">
            {convertedWeeklyData.length === 0 || convertedWeeklyData.every((w) => w.totalDeals === 0) ? (
              <div className="h-72 flex items-center justify-center text-muted-foreground text-sm">
                {t("dashboard.noData")}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <ComposedChart data={convertedWeeklyData} margin={{ top: 24, right: 56, left: 0, bottom: 4 }} barCategoryGap="30%">
                  <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
                  <XAxis dataKey="weekLabel" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="amount" tickFormatter={fmtK} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={48} />
                  <Tooltip content={<CustomWeeklyTooltip />} />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ paddingTop: "12px" }}
                    formatter={(value) => <span className="text-xs text-foreground/80">{value}</span>}
                  />
                  <Bar yAxisId="amount" dataKey="orderClosedAmount" name="Order Closed" fill="#a78bfa" fillOpacity={0.85} radius={[4, 4, 0, 0]} maxBarSize={32} />
                  <Bar yAxisId="amount" dataKey="orderConfirmedAmount" name="Order Confirmed" fill="#34d399" fillOpacity={0.85} radius={[4, 4, 0, 0]} maxBarSize={32} />
                  <Bar yAxisId="amount" dataKey="orderLostAmount" name="Order Lost" fill="#f87171" fillOpacity={0.75} radius={[4, 4, 0, 0]} maxBarSize={32} />
                  <Line yAxisId="amount" type="monotone" dataKey="orderClosedReceivedAmount" name="Received" stroke="#fbbf24" strokeWidth={2.5} dot={{ fill: "#fbbf24", r: 4 }} activeDot={{ r: 6 }} />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Region × Stage Breakdown Chart — owner only */}
        {isOwner && (
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">{t("dashboard.regionBreakdown")}</CardTitle>
              <p className="text-xs text-muted-foreground">
                Agreed amounts by stage across all regions · filtered by selected period · hover for deal counts
              </p>
            </CardHeader>
            <CardContent className="pt-0">
              {regionChartData.length === 0 ? (
                <div className="h-72 flex items-center justify-center text-muted-foreground text-sm">
                  No regional data for selected period
                </div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={regionChartData.length > 4 ? 380 : 320}>
                    <BarChart
                      data={regionChartData}
                      margin={{ top: 16, right: 24, left: 0, bottom: regionChartData.length > 3 ? 60 : 16 }}
                      barCategoryGap="22%"
                      barGap={3}
                    >
                      <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
                      <XAxis
                        dataKey="region"
                        tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                        axisLine={false}
                        tickLine={false}
                        angle={regionChartData.length > 3 ? -35 : 0}
                        textAnchor={regionChartData.length > 3 ? "end" : "middle"}
                        interval={0}
                      />
                      <YAxis
                        tickFormatter={fmtK}
                        tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                        axisLine={false}
                        tickLine={false}
                        width={48}
                      />
                      <Tooltip content={<CustomRegionTooltip />} cursor={{ fill: "hsl(var(--muted)/0.08)" }} />
                      <Legend
                        iconType="circle"
                        iconSize={8}
                        wrapperStyle={{ paddingTop: "14px" }}
                        formatter={(value) => <span className="text-xs text-foreground/80">{value}</span>}
                      />
                      <Bar dataKey="Quotation Sent"  name="Quotation Sent"  fill={STAGE_COLORS["Quotation Sent"]}  fillOpacity={0.9} radius={[4, 4, 0, 0]} maxBarSize={28} />
                      <Bar dataKey="Order Confirmed" name="Order Confirmed" fill={STAGE_COLORS["Order Confirmed"]} fillOpacity={0.9} radius={[4, 4, 0, 0]} maxBarSize={28} />
                      <Bar dataKey="Order Closed"    name="Order Closed"    fill={STAGE_COLORS["Order Closed"]}    fillOpacity={0.9} radius={[4, 4, 0, 0]} maxBarSize={28} />
                      <Bar dataKey="Order Lost"      name="Order Lost"      fill={STAGE_COLORS["Order Lost"]}      fillOpacity={0.8} radius={[4, 4, 0, 0]} maxBarSize={28} />
                    </BarChart>
                  </ResponsiveContainer>

                  {/* Region summary table */}
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border/50">
                          <th className="text-left py-2 pr-4 font-semibold text-muted-foreground">Region</th>
                          {["Quotation Sent", "Order Confirmed", "Order Closed", "Order Lost"].map((s) => (
                            <th key={s} className="text-right py-2 px-3 font-semibold" style={{ color: STAGE_COLORS[s] }}>{s}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {regionChartData.map((row) => (
                          <tr key={row.region} className="border-b border-border/20 hover:bg-secondary/30 transition-colors">
                            <td className="py-2 pr-4 font-medium text-foreground/90">{row.region}</td>
                            <td className="py-2 px-3 text-right tabular-nums">
                              <span style={{ color: STAGE_COLORS["Quotation Sent"] }} className="font-semibold">{fmtK(row["Quotation Sent"])}</span>
                              <span className="text-muted-foreground ml-1">({row.quotationSentCount})</span>
                            </td>
                            <td className="py-2 px-3 text-right tabular-nums">
                              <span style={{ color: STAGE_COLORS["Order Confirmed"] }} className="font-semibold">{fmtK(row["Order Confirmed"])}</span>
                              <span className="text-muted-foreground ml-1">({row.orderConfirmedCount})</span>
                            </td>
                            <td className="py-2 px-3 text-right tabular-nums">
                              <span style={{ color: STAGE_COLORS["Order Closed"] }} className="font-semibold">{fmtK(row["Order Closed"])}</span>
                              <span className="text-muted-foreground ml-1">({row.orderClosedCount})</span>
                            </td>
                            <td className="py-2 px-3 text-right tabular-nums">
                              <span style={{ color: STAGE_COLORS["Order Lost"] }} className="font-semibold">{fmtK(row["Order Lost"])}</span>
                              <span className="text-muted-foreground ml-1">({row.orderLostCount})</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* ── Closed Orders by Customer Category ── */}
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">{t("dashboard.orderCategory")}</CardTitle>
            <p className="text-xs text-muted-foreground">
              Agreed amounts &amp; deal counts for Order Closed · filtered by selected period
            </p>
          </CardHeader>
          <CardContent className="pt-0">
            {categoryChartData.length === 0 ? (
              <div className="h-60 flex items-center justify-center text-muted-foreground text-sm">
                No closed orders for selected period
              </div>
            ) : (
              <div className="flex flex-col md:flex-row gap-6 items-center">
                {/* Pie chart */}
                <div className="w-full md:w-64 shrink-0">
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={categoryChartData.map((d) => ({
                          name: CATEGORY_LABELS[d.dealType] ?? d.dealType,
                          value: d.totalAmount,
                          fill: CATEGORY_COLORS[d.dealType] ?? "#94a3b8",
                        }))}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={90}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {categoryChartData.map((d) => (
                          <Cell
                            key={d.dealType}
                            fill={CATEGORY_COLORS[d.dealType] ?? "#94a3b8"}
                            fillOpacity={0.9}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={TOOLTIP_STYLE}
                        formatter={(value: number) => [fmtK(value), "Amount"]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Summary table */}
                <div className="flex-1 w-full overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/50">
                        <th className="text-left py-2 pr-6 font-semibold text-muted-foreground">Category</th>
                        <th className="text-center py-2 px-4 font-semibold text-muted-foreground">Count</th>
                        <th className="text-right py-2 pl-4 font-semibold text-muted-foreground">Amount ({selectedCurrency})</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const grandTotal = categoryChartData.reduce((s, d) => s + d.totalAmount, 0);
                        const grandCount = categoryChartData.reduce((s, d) => s + d.count, 0);
                        return (
                          <>
                            {categoryChartData.map((d) => {
                              const color = CATEGORY_COLORS[d.dealType] ?? "#94a3b8";
                              const pct   = grandTotal > 0 ? Math.round((d.totalAmount / grandTotal) * 100) : 0;
                              return (
                                <tr key={d.dealType} className="border-b border-border/20 hover:bg-secondary/30 transition-colors">
                                  <td className="py-3 pr-6">
                                    <div className="flex items-center gap-2">
                                      <span
                                        className="inline-block w-3 h-3 rounded-full shrink-0"
                                        style={{ background: color }}
                                      />
                                      <span className="font-medium">
                                        {CATEGORY_LABELS[d.dealType] ?? d.dealType}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="py-3 px-4 text-center tabular-nums font-semibold" style={{ color }}>
                                    {d.count}
                                  </td>
                                  <td className="py-3 pl-4 text-right tabular-nums font-semibold" style={{ color }}>
                                    {fmtK(d.totalAmount)}
                                  </td>
                                </tr>
                              );
                            })}
                            <tr className="border-t-2 border-border/50 font-semibold bg-muted/30">
                              <td className="py-2 pr-6 text-sm">Total</td>
                              <td className="py-2 px-4 text-center tabular-nums">{grandCount}</td>
                              <td className="py-2 pl-4 text-right tabular-nums">{fmtK(grandTotal)}</td>
                            </tr>
                          </>
                        );
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
