import { useGetMe } from "@workspace/api-client-react";
import { useOwnerControls } from "@/contexts/OwnerControlsContext";
import { useTranslation } from "@/i18n/LanguageContext";
import { OwnerControlsBar } from "@/components/layout/OwnerControlsBar";
import { useHistoricalRates } from "@/hooks/useHistoricalRates";
import { MonthRateCell } from "@/components/MonthRateCell";
import { useState, useEffect, useMemo } from "react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { Download, FileSpreadsheet, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCurrency } from "@/contexts/CurrencyContext";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_FULL = ["January","February","March","April","May","June","July","August","September","October","November","December"];

interface SalespersonRow {
  salespersonId: number;
  name: string;
  currency: string | null;
  totalSales: number;
  avgMonthlySales: number;
  monthly: Record<number, number>;
  summaryTotal: number;
  summaryQuotation: number;
  summaryOrderConfirmed: number;
}

interface UserOption {
  id: number;
  email: string;
  name: string | null;
  currency: string | null;
}

interface WeekRow {
  monthName: string;
  monthYear: string;
  weekOrdinal: string;
  weekStart: string;
  weekEnd: string;
  orderClosedCount: number;
  orderClosedAmount: number;
  downPayment: number;
  totalPaymentReceipt: number;
  quotationSentCount: number;
  quotationSentAmount: number;
  orderConfirmedCount: number;
  orderConfirmedAmount: number;
  totalSalesInProcess: number;
}

interface DealDetail {
  id: number;
  name: string;
  companyName: string;
  productItem: string;
  stage: string;
  agreedAmount: string | null;
  receivedAmount: string | null;
  outstandingAmount: string | null;
  dealStartDate: string;
}

interface DrillDownState {
  monthStart: string;
  monthEnd: string;
  salespersonId: number | null;
  label: string;
  stage?: string;
}

function MonthDrillDownModal({
  drillDown,
  onClose,
}: {
  drillDown: DrillDownState | null;
  onClose: () => void;
}) {
  const [deals, setDeals] = useState<DealDetail[]>([]);
  const [loading, setLoading] = useState(false);
  const { formatAmount } = useCurrency();

  const fmtAmt = (s: string | null | undefined) => {
    const n = parseFloat(s ?? "0") || 0;
    return n ? formatAmount(n) : "—";
  };

  useEffect(() => {
    if (!drillDown) return;
    setLoading(true);
    const params = new URLSearchParams({
      weekStart: drillDown.monthStart,
      weekEnd: drillDown.monthEnd,
    });
    if (drillDown.salespersonId !== null) params.set("salespersonId", String(drillDown.salespersonId));
    if (drillDown.stage) params.set("stage", drillDown.stage);
    fetch(`/api/reports/sales-breakdown-deals?${params}`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setDeals(Array.isArray(d) ? d : []))
      .catch(() => setDeals([]))
      .finally(() => setLoading(false));
  }, [drillDown]);

  const totalAgreed      = deals.reduce((s, d) => s + (parseFloat(d.agreedAmount ?? "0") || 0), 0);
  const totalReceived    = deals.reduce((s, d) => s + (parseFloat(d.receivedAmount ?? "0") || 0), 0);
  const totalOutstanding = deals.reduce((s, d) => s + (parseFloat(d.outstandingAmount ?? "0") || 0), 0);

  return (
    <Dialog open={!!drillDown} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="text-base font-bold">{drillDown?.label}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-auto min-h-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            </div>
          ) : deals.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">No orders found for this period.</div>
          ) : (
            <table className="w-full border-collapse text-sm min-w-[700px]">
              <thead className="sticky top-0 z-10">
                <tr className="bg-muted/60">
                  <th className="border border-border px-3 py-2 text-left font-semibold text-xs">#</th>
                  <th className="border border-border px-3 py-2 text-left font-semibold text-xs whitespace-nowrap">Date</th>
                  <th className="border border-border px-3 py-2 text-left font-semibold text-xs">Order Name</th>
                  <th className="border border-border px-3 py-2 text-left font-semibold text-xs">Company</th>
                  <th className="border border-border px-3 py-2 text-left font-semibold text-xs">Product</th>
                  <th className="border border-border px-3 py-2 text-left font-semibold text-xs">Stage</th>
                  <th className="border border-border px-3 py-2 text-right font-semibold text-xs">Agreed</th>
                  <th className="border border-border px-3 py-2 text-right font-semibold text-xs">Received</th>
                  <th className="border border-border px-3 py-2 text-right font-semibold text-xs">Outstanding</th>
                </tr>
              </thead>
              <tbody>
                {deals.map((deal, i) => (
                  <tr key={deal.id} className={i % 2 === 0 ? "bg-background" : "bg-muted/20"}>
                    <td className="border border-border px-3 py-2 text-xs text-muted-foreground">{i + 1}</td>
                    <td className="border border-border px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                      {deal.dealStartDate
                        ? new Date(deal.dealStartDate.split("T")[0] + "T00:00:00")
                            .toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
                        : "—"}
                    </td>
                    <td className="border border-border px-3 py-2 text-xs font-medium whitespace-nowrap">{deal.name}</td>
                    <td className="border border-border px-3 py-2 text-xs whitespace-nowrap">{deal.companyName}</td>
                    <td className="border border-border px-3 py-2 text-xs whitespace-nowrap text-muted-foreground">{deal.productItem}</td>
                    <td className="border border-border px-3 py-2 text-xs">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-medium whitespace-nowrap ${
                        deal.stage === "Order Closed"    ? "bg-green-500/20 text-green-700 dark:text-green-400" :
                        deal.stage === "Order Confirmed" ? "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400" :
                        deal.stage === "Quotation Sent"  ? "bg-blue-500/20 text-blue-700 dark:text-blue-400" :
                        "bg-red-500/20 text-red-700 dark:text-red-400"
                      }`}>{deal.stage}</span>
                    </td>
                    <td className="border border-border px-3 py-2 text-xs text-right tabular-nums">{fmtAmt(deal.agreedAmount)}</td>
                    <td className="border border-border px-3 py-2 text-xs text-right tabular-nums">{fmtAmt(deal.receivedAmount)}</td>
                    <td className="border border-border px-3 py-2 text-xs text-right tabular-nums">{fmtAmt(deal.outstandingAmount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-muted/50 font-semibold border-t-2 border-border">
                  <td className="border border-border px-3 py-2 text-xs text-muted-foreground" colSpan={6}>
                    Total ({deals.length} order{deals.length !== 1 ? "s" : ""})
                  </td>
                  <td className="border border-border px-3 py-2 text-xs text-right tabular-nums">{formatAmount(totalAgreed)}</td>
                  <td className="border border-border px-3 py-2 text-xs text-right tabular-nums">{formatAmount(totalReceived)}</td>
                  <td className="border border-border px-3 py-2 text-xs text-right tabular-nums">{formatAmount(totalOutstanding)}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function fmtCurrency(n: number, currency: string, rate: number): string {
  if (!n) return "";
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(n * rate);
  } catch {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n * rate);
  }
}

export default function SummarySalesReport() {
  const { data: me } = useGetMe();
  const { t } = useTranslation();
  const currentYear = new Date().getFullYear();

  const [year, setYear]               = useState(String(currentYear));
  const [summaryStart, setSummaryStart] = useState("");
  const [summaryEnd, setSummaryEnd]   = useState("");
  const [filterSpId, setFilterSpId]   = useState<string>("all");
  const [rows, setRows]               = useState<SalespersonRow[]>([]);
  const [loading, setLoading]         = useState(false);
  const [users, setUsers]             = useState<UserOption[]>([]);

  const [drillDown, setDrillDown] = useState<DrillDownState | null>(null);

  const {
    selectedRegion,
    conversionRate, sourceCurrency, selectedCurrency,
    getRateFor, loadMultiRates,
  } = useOwnerControls();

  const isSameCurrency = sourceCurrency === selectedCurrency;
  const isAllRegions   = selectedRegion === "all";
  const yr = parseInt(year);


  // Pre-fetch conversion rates whenever rows or display currency changes
  // Use currencies directly from the row data (most reliable source)
  useEffect(() => {
    if (rows.length === 0) return;
    const currencies = [...new Set(rows.map((r) => r.currency).filter(Boolean))] as string[];
    if (currencies.length > 0) loadMultiRates(currencies);
  }, [rows, loadMultiRates]);

  // Per-amount formatter: uses each row's own currency (not a single global rate)
  // rate = 1 rowCurrency → X selectedCurrency
  const fmtAmt = (n: number, rate: number) => fmtCurrency(n, selectedCurrency, rate) || "-";

  // Historical rates for all 12 months of the selected year (specific-region mode only)
  const months12 = useMemo(
    () => Array.from({ length: 12 }, (_, i) => ({ year: yr, month: i + 1 })),
    [yr],
  );
  const {
    getRate, setOverride,
    isLoading: rateIsLoading,
    isOverridden: rateIsOverridden,
    isCurrentMonth: rateIsCurrent,
  } = useHistoricalRates(sourceCurrency, selectedCurrency, conversionRate, months12);

  useEffect(() => {
    if (me?.role === "owner") {
      fetch("/api/users").then((r) => r.json()).then(setUsers).catch(() => {});
    }
  }, [me]);

  useEffect(() => {
    if (!me) return;
    const params = new URLSearchParams({ year });
    if (summaryStart) params.set("summaryStart", summaryStart);
    if (summaryEnd)   params.set("summaryEnd",   summaryEnd);
    if (filterSpId && filterSpId !== "all") params.set("salespersonId", filterSpId);
    if (me.role === "owner" && selectedRegion !== "all") params.set("region", selectedRegion);

    setLoading(true);
    fetch(`/api/reports/summary-sales?${params}`)
      .then((r) => r.json())
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [me, year, summaryStart, summaryEnd, filterSpId, selectedRegion]);

  function openMonthModal(
    spId: number | null,
    spName: string,
    monthIdx: number,
    stage?: string,
  ) {
    const d0 = new Date(yr, monthIdx - 1, 1);
    const monthStart = format(startOfMonth(d0), "yyyy-MM-dd");
    const monthEnd   = format(endOfMonth(d0),   "yyyy-MM-dd");
    const monthLabel = MONTHS_FULL[monthIdx - 1];
    const label = spId !== null
      ? `${spName} — ${monthLabel} ${year}`
      : `All — ${monthLabel} ${year}`;
    setDrillDown({ salespersonId: spId, monthStart, monthEnd, label, stage });
  }

  function openSummaryModal(
    spId: number | null,
    spName: string,
    stage?: string,
  ) {
    if (!summaryStart || !summaryEnd) return;
    const label = spId !== null
      ? `${spName} — ${summaryLabel}${stage ? ` (${stage})` : ""}`
      : `All — ${summaryLabel}${stage ? ` (${stage})` : ""}`;
    setDrillDown({ salespersonId: spId, monthStart: summaryStart, monthEnd: summaryEnd, label, stage });
  }

  const currentMonth = new Date().getMonth() + 1; // 1-indexed

  const yearOptions = Array.from({ length: 5 }, (_, i) => String(currentYear - i));

  const totalSalesSum       = rows.reduce((s, r) => s + r.totalSales, 0);
  const monthlyTotals: Record<number, number> = {};
  for (let m = 1; m <= 12; m++) {
    monthlyTotals[m] = rows.reduce((s, r) => s + (r.monthly[m] ?? 0), 0);
  }
  const summaryTotalSum          = rows.reduce((s, r) => s + r.summaryTotal, 0);
  const summaryQuotationSum      = rows.reduce((s, r) => s + r.summaryQuotation, 0);
  const summaryOrderConfirmedSum = rows.reduce((s, r) => s + r.summaryOrderConfirmed, 0);

  // Pre-compute converted totals: use row.currency directly (reliable, no usersMap indirection).
  // Works for both "All Regions" and specific-region mode.
  const convertedTotals = useMemo(() => {
    const getR = (r: SalespersonRow) => getRateFor(r.currency ?? sourceCurrency);
    const monthTotals: Record<number, number> = {};
    for (let m = 1; m <= 12; m++) {
      monthTotals[m] = rows.reduce((s, r) => s + (r.monthly[m] ?? 0) * getR(r), 0);
    }
    return {
      monthTotals,
      totalSales:            rows.reduce((s, r) => s + r.totalSales            * getR(r), 0),
      avgMonthly:            rows.reduce((s, r) => s + r.avgMonthlySales       * getR(r), 0),
      summaryTotal:          rows.reduce((s, r) => s + r.summaryTotal          * getR(r), 0),
      summaryQuotation:      rows.reduce((s, r) => s + r.summaryQuotation      * getR(r), 0),
      summaryOrderConfirmed: rows.reduce((s, r) => s + r.summaryOrderConfirmed * getR(r), 0),
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, getRateFor, sourceCurrency]);

  // Sort by the current month's sales in the display currency so cross-currency rankings are accurate
  const sortedRows = useMemo(
    () =>
      [...rows].sort(
        (a, b) =>
          (b.monthly[currentMonth] ?? 0) * getRateFor(b.currency ?? sourceCurrency) -
          (a.monthly[currentMonth] ?? 0) * getRateFor(a.currency ?? sourceCurrency),
      ),
    [rows, currentMonth, getRateFor, sourceCurrency],
  );

  const hasSummary    = summaryStart && summaryEnd;
  const summaryLabel  = hasSummary
    ? `${format(new Date(summaryStart), "d MMM")} – ${format(new Date(summaryEnd), "d MMM")}`
    : "Summary Period";

  const totalCols = 3 + 12 + (hasSummary ? 3 : 0);


  const handleExportCSV = () => {
    let csv = "Monthly Report\n";
    csv += `Name,Total Sales ${year},Avg Monthly Sales`;
    for (const m of MONTHS) csv += `,${m} ${year}`;
    if (hasSummary) csv += `,${summaryLabel} Sales,${summaryLabel} Quotation,${summaryLabel} Order Confirmed`;
    csv += "\n";
    for (const r of rows) {
      csv += `${r.name},${r.totalSales},${Math.round(r.avgMonthlySales)}`;
      for (let m = 1; m <= 12; m++) csv += `,${r.monthly[m] ?? 0}`;
      if (hasSummary) csv += `,${r.summaryTotal},${r.summaryQuotation},${r.summaryOrderConfirmed}`;
      csv += "\n";
    }
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `summary-sales-${year}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col print:block">
    {me?.role === "owner" && <OwnerControlsBar />}
    <div className="p-6 max-w-full mx-auto w-full space-y-4 print:p-2">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("monthlyReport.title")}</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {t("monthlyReport.subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-nowrap">
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
            <SelectContent>
              {yearOptions.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
            </SelectContent>
          </Select>

          {me?.role === "owner" && (
            <Select value={filterSpId} onValueChange={setFilterSpId}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder={t("monthlyReport.allSalespersons")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("monthlyReport.allSalespersons")}</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u.id} value={String(u.id)}>{u.name || u.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <div className="flex items-center gap-1 flex-nowrap">
            <DatePicker value={summaryStart} onChange={setSummaryStart} placeholder="From" className="w-32" />
            <span className="text-muted-foreground text-xs shrink-0">to</span>
            <DatePicker value={summaryEnd} onChange={setSummaryEnd} placeholder="To" className="w-32" />
          </div>

          <Button variant="outline" size="icon" onClick={handleExportCSV} title="Export CSV">
            <FileSpreadsheet className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => window.print()} title="Print / PDF">
            <Download className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base print:text-center print:text-xl">{t("monthlyReport.title")} {year}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="overflow-x-auto scrollbar-subtle">
              <table className="w-full text-sm border-collapse">
                <thead>
                  {/* Main header row */}
                  <tr className="bg-muted/60 border-b border-border">
                    <th className="px-2 py-2.5 text-center font-semibold whitespace-nowrap w-8 sticky left-0 bg-muted/60">#</th>
                    <th className="px-3 py-2.5 text-left font-semibold whitespace-nowrap sticky left-8 bg-muted/60">{t("monthlyReport.name")}</th>
                    <th className="px-3 py-2.5 text-right font-semibold whitespace-nowrap">{t("monthlyReport.avgMonthly")} {year}</th>
                    <th className="px-3 py-2.5 text-right font-semibold whitespace-nowrap">{t("monthlyReport.total")} {year}</th>
                    {MONTHS.map((m, idx) => {
                      const isCurrentCol = idx + 1 === currentMonth;
                      return (
                        <th
                          key={m}
                          className={`px-3 py-2.5 text-right font-semibold whitespace-nowrap ${
                            isCurrentCol ? "bg-primary/10 text-primary" : ""
                          }`}
                        >
                          <span className="flex items-center justify-end gap-1">
                            {m} {year}
                            {isCurrentCol && (
                              <span className="text-[10px] font-normal opacity-70">▼</span>
                            )}
                          </span>
                          {!isSameCurrency && !isAllRegions && (
                            <div className="mt-0.5">
                              <MonthRateCell
                                baseCurrency={sourceCurrency}
                                targetCurrency={selectedCurrency}
                                rate={getRate(yr, idx + 1)}
                                loading={rateIsLoading(yr, idx + 1)}
                                overridden={rateIsOverridden(yr, idx + 1)}
                                isCurrentMonth={rateIsCurrent(yr, idx + 1)}
                                onEdit={(r) => setOverride(yr, idx + 1, r)}
                              />
                            </div>
                          )}
                        </th>
                      );
                    })}
                    {hasSummary && (
                      <th className="px-3 py-2.5 text-right font-semibold whitespace-nowrap bg-blue-500/10 border-l border-border" colSpan={3}>
                        Summary {summaryLabel}
                      </th>
                    )}
                  </tr>
                  {hasSummary && (
                    <tr className="bg-muted/30 border-b border-border text-xs">
                      <th className="px-2 py-1 sticky left-0 bg-muted/30" />
                      <th className="px-3 py-1 sticky left-8 bg-muted/30" />
                      <th className="px-3 py-1" />
                      <th className="px-3 py-1" />
                      {MONTHS.map((m) => <th key={m} className="px-3 py-1" />)}
                      <th className="px-3 py-1 text-right font-medium bg-blue-500/10 border-l border-border">Sales</th>
                      <th className="px-3 py-1 text-right font-medium bg-blue-500/10">Quotation</th>
                      <th className="px-3 py-1 text-right font-medium bg-blue-500/10">Order Confirmed</th>
                    </tr>
                  )}
                </thead>

                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={totalCols} className="text-center py-10 text-muted-foreground">
                        No data for this period.
                      </td>
                    </tr>
                  ) : (
                    sortedRows.map((row, i) => {
                      const rowCurrency = row.currency ?? sourceCurrency;
                      const rowRate     = getRateFor(rowCurrency);
                      const rowIsSame   = rowCurrency === selectedCurrency;

                      return (
                        <tr
                          key={`row-${row.salespersonId}`}
                          className={`border-b border-border/50 ${i % 2 === 0 ? "" : "bg-muted/10"}`}
                        >
                            <td className="px-2 py-2 text-center text-[11px] font-bold text-muted-foreground whitespace-nowrap sticky left-0 bg-card w-8">
                              {i + 1 === 1 ? (
                                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-yellow-400/20 text-yellow-600 dark:text-yellow-400 text-[10px] font-bold">1</span>
                              ) : i + 1 === 2 ? (
                                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-400/20 text-slate-500 dark:text-slate-300 text-[10px] font-bold">2</span>
                              ) : i + 1 === 3 ? (
                                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-orange-400/20 text-orange-600 dark:text-orange-400 text-[10px] font-bold">3</span>
                              ) : (
                                <span className="text-muted-foreground/60">{i + 1}</span>
                              )}
                            </td>
                            <td className="px-3 py-2 font-medium whitespace-nowrap sticky left-8 bg-card">
                              {row.name}
                              {!rowIsSame && (
                                <span className="ml-1.5 text-[10px] text-muted-foreground font-normal">({rowCurrency === "TND" ? "€" : rowCurrency})</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right">{fmtAmt(Math.round(row.avgMonthlySales), rowRate)}</td>
                            <td className="px-3 py-2 text-right font-medium">{fmtAmt(row.totalSales, rowRate)}</td>
                            {Array.from({ length: 12 }, (_, idx) => {
                              const mIdx     = idx + 1;
                              const val      = row.monthly[mIdx] ?? 0;
                              const isCurCol = mIdx === currentMonth;
                              const cellRate = isAllRegions ? rowRate : getRate(yr, mIdx);
                              return (
                                <td
                                  key={mIdx}
                                  onClick={() => val > 0 && openMonthModal(row.salespersonId, row.name, mIdx)}
                                  className={`px-3 py-2 text-right tabular-nums transition-colors select-none
                                    ${val > 0 ? "cursor-pointer hover:bg-primary/10 hover:text-foreground" : ""}
                                    ${isCurCol ? "bg-primary/5 text-muted-foreground" : "text-muted-foreground"}`}
                                >
                                  {val ? fmtAmt(val, cellRate) : "-"}
                                </td>
                              );
                            })}
                            {hasSummary && (
                              <>
                                <td
                                  onClick={() => row.summaryTotal > 0 && openSummaryModal(row.salespersonId, row.name)}
                                  className={`px-3 py-2 text-right bg-blue-500/5 border-l border-border transition-colors ${row.summaryTotal > 0 ? "cursor-pointer hover:bg-blue-500/15" : ""}`}
                                >{fmtAmt(row.summaryTotal, rowRate)}</td>
                                <td
                                  onClick={() => row.summaryQuotation > 0 && openSummaryModal(row.salespersonId, row.name, "Quotation Sent")}
                                  className={`px-3 py-2 text-right bg-blue-500/5 transition-colors ${row.summaryQuotation > 0 ? "cursor-pointer hover:bg-blue-500/15" : ""}`}
                                >{fmtAmt(row.summaryQuotation, rowRate)}</td>
                                <td
                                  onClick={() => row.summaryOrderConfirmed > 0 && openSummaryModal(row.salespersonId, row.name, "Order Confirmed")}
                                  className={`px-3 py-2 text-right bg-blue-500/5 transition-colors ${row.summaryOrderConfirmed > 0 ? "cursor-pointer hover:bg-blue-500/15" : ""}`}
                                >{fmtAmt(row.summaryOrderConfirmed, rowRate)}</td>
                              </>
                            )}
                      );
                    })
                  )}
                </tbody>

                {rows.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 border-border bg-muted/40 font-semibold">
                      <td className="px-2 py-2 sticky left-0 bg-muted/40" />
                      <td className="px-3 py-2 sticky left-8 bg-muted/40">Total</td>
                      <td className="px-3 py-2 text-right">
                        {fmtAmt(Math.round(convertedTotals?.avgMonthly ?? 0), 1)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {fmtAmt(convertedTotals?.totalSales ?? 0, 1)}
                      </td>
                      {Array.from({ length: 12 }, (_, idx) => {
                        const mIdx = idx + 1;
                        const totVal = convertedTotals?.monthTotals[mIdx] ?? 0;
                        return (
                          <td
                            key={mIdx}
                            onClick={() => totVal > 0 && openMonthModal(null, "All", mIdx)}
                            className={`px-3 py-2 text-right transition-colors ${totVal > 0 ? "cursor-pointer hover:bg-primary/10" : ""}`}
                          >
                            {fmtAmt(totVal, 1)}
                          </td>
                        );
                      })}
                      {hasSummary && (
                        <>
                          <td
                            onClick={() => (convertedTotals?.summaryTotal ?? 0) > 0 && openSummaryModal(null, "All")}
                            className={`px-3 py-2 text-right bg-blue-500/10 border-l border-border transition-colors ${(convertedTotals?.summaryTotal ?? 0) > 0 ? "cursor-pointer hover:bg-blue-500/20" : ""}`}
                          >
                            {fmtAmt(convertedTotals?.summaryTotal ?? 0, 1)}
                          </td>
                          <td
                            onClick={() => (convertedTotals?.summaryQuotation ?? 0) > 0 && openSummaryModal(null, "All", "Quotation Sent")}
                            className={`px-3 py-2 text-right bg-blue-500/10 transition-colors ${(convertedTotals?.summaryQuotation ?? 0) > 0 ? "cursor-pointer hover:bg-blue-500/20" : ""}`}
                          >
                            {fmtAmt(convertedTotals?.summaryQuotation ?? 0, 1)}
                          </td>
                          <td
                            onClick={() => (convertedTotals?.summaryOrderConfirmed ?? 0) > 0 && openSummaryModal(null, "All", "Order Confirmed")}
                            className={`px-3 py-2 text-right bg-blue-500/10 transition-colors ${(convertedTotals?.summaryOrderConfirmed ?? 0) > 0 ? "cursor-pointer hover:bg-blue-500/20" : ""}`}
                          >
                            {fmtAmt(convertedTotals?.summaryOrderConfirmed ?? 0, 1)}
                          </td>
                        </>
                      )}
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
    <MonthDrillDownModal drillDown={drillDown} onClose={() => setDrillDown(null)} />
    </div>
  );
}
