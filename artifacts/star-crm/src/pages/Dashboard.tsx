import { useEffect, useState, useMemo, useCallback } from "react";
import { useGetMe, useListDeals } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Briefcase, CheckCircle2, TrendingUp, Wallet, XCircle } from "lucide-react";
import { format } from "date-fns";
import { useOwnerControls } from "@/contexts/OwnerControlsContext";
import { OwnerControlsBar } from "@/components/layout/OwnerControlsBar";

interface KpiCardProps {
  title: string;
  subtitle?: string;
  count?: number;
  countLabel?: string;
  amount: string;
  amountLabel?: string;
  icon: React.ElementType;
  iconColor: string;
  accentColor: string;
  singleValue?: boolean;
}

function KpiCard({ title, subtitle, count, countLabel, amount, amountLabel, icon: Icon, iconColor, accentColor, singleValue }: KpiCardProps) {
  return (
    <Card className="bg-card border-border/60">
      <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-5">
        <div>
          <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
          <p className="text-xs text-muted-foreground/60 mt-0.5">{subtitle ?? "\u00a0"}</p>
        </div>
        <div className={`p-1.5 rounded-md ${accentColor}`}>
          <Icon className={`w-4 h-4 ${iconColor}`} />
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-4">
        {singleValue ? (
          <div className={`text-2xl font-bold ${iconColor}`}>{amount}</div>
        ) : (
          <div className="flex items-end justify-between gap-2">
            <div>
              <div className="text-2xl font-bold">{count ?? 0}</div>
              {countLabel && <p className="text-xs text-muted-foreground mt-0.5">{countLabel}</p>}
            </div>
            <div className="text-right">
              <div className={`text-base font-semibold ${iconColor}`}>{amount}</div>
              {amountLabel && <p className="text-xs text-muted-foreground mt-0.5">{amountLabel}</p>}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
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

export default function Dashboard() {
  const { data: me, isLoading: meLoading } = useGetMe();
  const isOwner = me?.role === "owner";

  const {
    selectedRegion, selectedYear,
    formatConverted, getRateFor, loadMultiRates,
    selectedCurrency,
  } = useOwnerControls();

  const yearStart = `${selectedYear}-01-01`;
  const yearEnd   = `${selectedYear}-12-31`;

  // Summary from API (salesperson mode or specific-region owner mode)
  const [summary, setSummary] = useState<any>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  const buildSummaryQs = useCallback(() => {
    const p = new URLSearchParams({ startDate: yearStart, endDate: yearEnd });
    if (me?.role === "salesperson") p.set("salespersonId", String(me.id));
    else if (isOwner && selectedRegion !== "all") p.set("region", selectedRegion);
    return p.toString();
  }, [me, isOwner, selectedRegion, yearStart, yearEnd]);

  useEffect(() => {
    if (!me) return;
    setSummaryLoading(true);
    fetch(`/api/reports/summary?${buildSummaryQs()}`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => setSummary(data?.error ? null : data))
      .catch(() => {})
      .finally(() => setSummaryLoading(false));
  }, [me, buildSummaryQs]);

  // Enriched by-salesperson data for "All Regions" currency conversion (owner only)
  const [byPerson, setByPerson] = useState<EnrichedPerson[]>([]);
  const [byPersonLoading, setByPersonLoading] = useState(false);

  useEffect(() => {
    if (!isOwner || selectedRegion !== "all") { setByPerson([]); return; }
    setByPersonLoading(true);
    const qs = new URLSearchParams({ startDate: yearStart, endDate: yearEnd });
    fetch(`/api/reports/by-salesperson?${qs}`, { credentials: "include" })
      .then((r) => r.json())
      .then((data: EnrichedPerson[]) => {
        const arr = Array.isArray(data) ? data : [];
        setByPerson(arr);
        const currencies = [...new Set(arr.map((p) => p.currency).filter(Boolean))] as string[];
        if (currencies.length > 0) loadMultiRates(currencies);
      })
      .catch(() => {})
      .finally(() => setByPersonLoading(false));
  }, [isOwner, selectedRegion, yearStart, yearEnd, loadMultiRates]);

  // Properly converted totals for "All Regions"
  const allRegionsTotals = useMemo(() => {
    if (!isOwner || selectedRegion !== "all" || byPerson.length === 0) return null;
    const sum = (field: keyof EnrichedPerson) =>
      byPerson.reduce((s, p) => s + ((p[field] as number) ?? 0) * getRateFor(p.currency ?? ""), 0);
    const cnt = (field: keyof EnrichedPerson) =>
      byPerson.reduce((s, p) => s + ((p[field] as number) ?? 0), 0);
    return {
      quotationSentCount:  cnt("quotationSentCount"),
      quotationSentAmount: sum("quotationSentAmount"),
      confirmedDeals:      cnt("confirmedDeals"),
      confirmedAmount:     sum("confirmedAmount"),
      closedDeals:         cnt("closedDeals"),
      closedAmount:        sum("totalAgreedAmount"),
      totalReceivedAmount: sum("totalReceivedAmount"),
      lostDeals:           cnt("lostDeals"),
      lostAmount:          sum("lostAmount"),
      avgProgress: byPerson.length > 0
        ? byPerson.reduce((s, p) => s + p.avgProgress, 0) / byPerson.length
        : 0,
    };
  }, [byPerson, getRateFor, isOwner, selectedRegion]);

  // Decide KPI source
  const kpi = (isOwner && selectedRegion === "all" && allRegionsTotals) ? allRegionsTotals : {
    quotationSentCount:  summary?.quotationSentCount  ?? 0,
    quotationSentAmount: summary?.quotationSentAmount ?? 0,
    confirmedDeals:      summary?.confirmedDeals      ?? 0,
    confirmedAmount:     summary?.confirmedAmount     ?? 0,
    closedDeals:         summary?.closedDeals         ?? 0,
    closedAmount:        summary?.closedAmount        ?? 0,
    totalReceivedAmount: summary?.totalReceivedAmount ?? 0,
    lostDeals:           summary?.lostDeals           ?? 0,
    lostAmount:          summary?.lostAmount          ?? 0,
    avgProgress:         summary?.avgProgress         ?? 0,
  };

  // For "All Regions" the amounts are already converted; just format them
  const fmtAmt = (n: number) => {
    if (isOwner && selectedRegion === "all" && allRegionsTotals) {
      return new Intl.NumberFormat("en-US", {
        style: "currency", currency: selectedCurrency,
        maximumFractionDigits: 0,
      }).format(n);
    }
    return formatConverted(n);
  };

  const { data: deals, isLoading: dealsLoading } = useListDeals(
    me?.role === "salesperson" ? { salespersonId: me.id } : undefined,
    { query: { enabled: !!me } as any }
  );

  const isLoading = meLoading || summaryLoading || byPersonLoading || dealsLoading;

  if (isLoading) {
    return <div className="flex items-center justify-center h-full"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  const filteredDeals = isOwner && selectedRegion !== "all"
    ? (deals ?? []).filter((d: any) => d.region === selectedRegion)
    : deals ?? [];
  const recentDeals = filteredDeals.slice(0, 5);

  return (
    <div className="flex flex-col h-full">
      {isOwner && <OwnerControlsBar />}

      <div className="p-8 max-w-7xl mx-auto w-full space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Welcome back, {me?.name || me?.email} &mdash; {selectedYear}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
          <KpiCard
            title="Quotation Sent"
            subtitle="Within selected year"
            count={kpi.quotationSentCount}
            countLabel="quotations sent"
            amount={fmtAmt(kpi.quotationSentAmount)}
            amountLabel="quotation value"
            icon={Briefcase}
            iconColor="text-primary"
            accentColor="bg-primary/10"
          />
          <KpiCard
            title="Confirmed Orders"
            count={kpi.confirmedDeals}
            countLabel="orders confirmed"
            amount={fmtAmt(kpi.confirmedAmount)}
            amountLabel="confirmed value"
            icon={CheckCircle2}
            iconColor="text-blue-400"
            accentColor="bg-blue-500/10"
          />
          <KpiCard
            title="Closed Orders"
            count={kpi.closedDeals}
            countLabel="orders closed"
            amount={fmtAmt(kpi.closedAmount)}
            amountLabel="closed value"
            icon={TrendingUp}
            iconColor="text-emerald-400"
            accentColor="bg-emerald-500/10"
          />
          <KpiCard
            title="Received Amount"
            amount={fmtAmt(kpi.totalReceivedAmount)}
            amountLabel="revenue secured"
            icon={Wallet}
            iconColor="text-violet-400"
            accentColor="bg-violet-500/10"
            singleValue
          />
          <KpiCard
            title="Lost Orders"
            count={kpi.lostDeals}
            countLabel="orders lost"
            amount={fmtAmt(kpi.lostAmount)}
            amountLabel="lost value"
            icon={XCircle}
            iconColor="text-destructive"
            accentColor="bg-destructive/10"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              {recentDeals.length > 0 ? (
                <div className="space-y-3">
                  {recentDeals.map((deal: any) => (
                    <div key={deal.id} className="flex items-center justify-between p-4 border border-border rounded-lg">
                      <div>
                        <p className="font-medium">{deal.companyName}</p>
                        <p className="text-sm text-muted-foreground">{deal.name} &middot; {deal.productItem}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">{formatConverted(deal.agreedAmount)}</p>
                        <p className="text-xs text-muted-foreground">{format(new Date(deal.createdAt), 'MMM d, yyyy')}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">No recent orders for {selectedYear}</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Pipeline Health</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium">Avg Progress</span>
                    <span className="text-sm font-medium">{Math.round(kpi.avgProgress)}%</span>
                  </div>
                  <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                    <div className="bg-primary h-full" style={{ width: `${kpi.avgProgress}%` }}></div>
                  </div>
                </div>
                <div className="pt-4 flex justify-between items-center border-t border-border">
                  <span className="text-sm text-muted-foreground">Closed Orders</span>
                  <span className="font-bold text-emerald-400">{kpi.closedDeals}</span>
                </div>
                <div className="flex justify-between items-center border-t border-border pt-4">
                  <span className="text-sm text-muted-foreground">Confirmed Orders</span>
                  <span className="font-bold text-blue-400">{kpi.confirmedDeals}</span>
                </div>
                <div className="flex justify-between items-center border-t border-border pt-4">
                  <span className="text-sm text-muted-foreground">Lost Orders</span>
                  <span className="font-bold text-destructive">{kpi.lostDeals}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
