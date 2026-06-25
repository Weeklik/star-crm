import { useGetMe } from "@workspace/api-client-react";
import { useOwnerControls } from "@/contexts/OwnerControlsContext";
import { OwnerControlsBar } from "@/components/layout/OwnerControlsBar";
import { useHistoricalRates } from "@/hooks/useHistoricalRates";
import { MonthRateCell } from "@/components/MonthRateCell";
import { useState, useEffect, useMemo } from "react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { Download, FileSpreadsheet, Loader2, ChevronDown, ChevronRight } from "lucide-react";
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

interface ExpandedKey { spId: number; monthIdx: number }

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
  const currentYear = new Date().getFullYear();

  const [year, setYear]               = useState(String(currentYear));
  const [summaryStart, setSummaryStart] = useState("");
  const [summaryEnd, setSummaryEnd]   = useState("");
  const [filterSpId, setFilterSpId]   = useState<string>("all");
  const [rows, setRows]               = useState<SalespersonRow[]>([]);
  const [loading, setLoading]         = useState(false);
  const [users, setUsers]             = useState<UserOption[]>([]);

  const [expanded, setExpanded]       = useState<ExpandedKey | null>(null);
  const [weekRows, setWeekRows]       = useState<WeekRow[]>([]);
  const [weekLoading, setWeekLoading] = useState(false);

  const {
    selectedRegion,
    conversionRate, sourceCurrency, selectedCurrency,
    getRateFor, loadMultiRates,
  } = useOwnerControls();

  const isSameCurrency = sourceCurrency === selectedCurrency;
  const isAllRegions   = selectedRegion === "all";
  const yr = parseInt(year);

  // Build salespersonId → currency lookup from the users list.
  // Fall back to sourceCurrency (not "") so getRateFor() always gets a valid code.
  const usersMap = useMemo(
    () => Object.fromEntries(users.map((u) => [u.id, u.currency ?? sourceCurrency])) as Record<number, string>,
    [users, sourceCurrency],
  );

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

  useEffect(() => { setExpanded(null); setWeekRows([]); }, [year]);

  function handleMonthClick(spId: number, monthIdx: number) {
    if (expanded?.spId === spId && expanded?.monthIdx === monthIdx) {
      setExpanded(null); setWeekRows([]); return;
    }
    setExpanded({ spId, monthIdx });
    setWeekLoading(true); setWeekRows([]);
    const d0 = new Date(yr, monthIdx - 1, 1);
    const startDate = format(startOfMonth(d0), "yyyy-MM-dd");
    const endDate   = format(endOfMonth(d0),   "yyyy-MM-dd");
    const params = new URLSearchParams({ startDate, endDate, salespersonId: String(spId) });
    fetch(`/api/reports/sales-breakdown?${params}`)
      .then((r) => r.json())
      .then((d) => setWeekRows(d.weeks ?? []))
      .catch(() => setWeekRows([]))
      .finally(() => setWeekLoading(false));
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

  const thW = "border border-border text-center text-[11px] font-semibold px-2 py-1.5 whitespace-nowrap bg-muted/60";
  const tdW = "border border-border text-center text-[11px] px-2 py-1.5 whitespace-nowrap tabular-nums";

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
          <h1 className="text-2xl font-bold tracking-tight">Monthly Report</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Year-to-date sales per salesperson. Click any month cell to expand weekly breakdown.
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
                <SelectValue placeholder="All salespersons" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All salespersons</SelectItem>
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
          <CardTitle className="text-base print:text-center print:text-xl">Monthly Report {year}</CardTitle>
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
                    <th className="px-3 py-2.5 text-left font-semibold whitespace-nowrap sticky left-8 bg-muted/60">Name</th>
                    <th className="px-3 py-2.5 text-right font-semibold whitespace-nowrap">Avg Monthly {year}</th>
                    <th className="px-3 py-2.5 text-right font-semibold whitespace-nowrap">Total {year}</th>
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
                      // Use currency directly from API row — no usersMap indirection
                      const rowCurrency   = row.currency ?? sourceCurrency;
                      const rowRate       = getRateFor(rowCurrency);
                      const rowIsSame     = rowCurrency === selectedCurrency;
                      const isExpanded    = expanded?.spId === row.salespersonId;
                      const expandedMonth = expanded?.monthIdx ?? null;
                      const expandedRate  = expandedMonth
                        ? (isAllRegions ? rowRate : getRate(yr, expandedMonth))
                        : rowRate;

                      return (
                        <>
                          {/* ── Main salesperson row ── */}
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
                                <span className="ml-1.5 text-[10px] text-muted-foreground font-normal">({rowCurrency})</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right">{fmtAmt(Math.round(row.avgMonthlySales), rowRate)}</td>
                            <td className="px-3 py-2 text-right font-medium">{fmtAmt(row.totalSales, rowRate)}</td>
                            {Array.from({ length: 12 }, (_, idx) => {
                              const mIdx     = idx + 1;
                              const val      = row.monthly[mIdx] ?? 0;
                              const active   = isExpanded && expandedMonth === mIdx;
                              const isCurCol = mIdx === currentMonth;
                              // In specific-region mode use historical rate; in "All Regions" use live per-row rate
                              const cellRate = isAllRegions ? rowRate : getRate(yr, mIdx);
                              return (
                                <td
                                  key={mIdx}
                                  onClick={() => handleMonthClick(row.salespersonId, mIdx)}
                                  className={`px-3 py-2 text-right tabular-nums cursor-pointer select-none transition-colors
                                    ${active
                                      ? "bg-primary/15 text-primary font-semibold ring-inset ring-1 ring-primary/40"
                                      : isCurCol
                                        ? "bg-primary/5 text-muted-foreground hover:bg-primary/10 hover:text-foreground"
                                        : "text-muted-foreground hover:bg-muted/30 hover:text-foreground"
                                    }`}
                                >
                                  <span className="flex items-center justify-end gap-0.5">
                                    {active
                                      ? <ChevronDown className="w-3 h-3 shrink-0 text-primary" />
                                      : val > 0
                                        ? <ChevronRight className="w-3 h-3 shrink-0 opacity-30" />
                                        : null
                                    }
                                    {val ? fmtAmt(val, cellRate) : "-"}
                                  </span>
                                </td>
                              );
                            })}
                            {hasSummary && (
                              <>
                                <td className="px-3 py-2 text-right bg-blue-500/5 border-l border-border">{fmtAmt(row.summaryTotal, rowRate)}</td>
                                <td className="px-3 py-2 text-right bg-blue-500/5">{fmtAmt(row.summaryQuotation, rowRate)}</td>
                                <td className="px-3 py-2 text-right bg-blue-500/5">{fmtAmt(row.summaryOrderConfirmed, rowRate)}</td>
                              </>
                            )}
                          </tr>

                          {/* ── Inline weekly expansion ── */}
                          {isExpanded && (
                            <tr key={`expand-${row.salespersonId}`} className="border-b border-primary/20">
                              <td colSpan={totalCols} className="p-0 bg-primary/5">
                                <div className="px-4 py-3">
                                  <div className="flex items-center gap-2 mb-2.5">
                                    <ChevronDown className="w-4 h-4 text-primary" />
                                    <span className="text-sm font-semibold text-primary">
                                      {row.name} — {MONTHS_FULL[expandedMonth! - 1]} {year} — Weekly Breakdown
                                    </span>
                                    {!rowIsSame && (
                                      <span className="text-xs text-muted-foreground ml-2">
                                        Rate: 1 {rowCurrency} = {expandedRate.toFixed(4)} {selectedCurrency}
                                      </span>
                                    )}
                                    <button
                                      onClick={() => { setExpanded(null); setWeekRows([]); }}
                                      className="ml-auto text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-0.5 rounded border border-border hover:border-foreground/30"
                                    >
                                      Collapse
                                    </button>
                                  </div>

                                  {weekLoading ? (
                                    <div className="flex items-center justify-center py-6">
                                      <Loader2 className="w-5 h-5 animate-spin text-primary" />
                                    </div>
                                  ) : weekRows.length === 0 ? (
                                    <div className="text-center py-6 text-sm text-muted-foreground">
                                      No deals in {MONTHS_FULL[expandedMonth! - 1]} {year}.
                                    </div>
                                  ) : (
                                    <div className="overflow-x-auto rounded border border-border/60">
                                      <table className="w-full border-collapse text-sm">
                                        <thead>
                                          <tr>
                                            <th rowSpan={3} className={`${thW} text-left min-w-[120px] bg-muted/50`}>Week</th>
                                            <th colSpan={4} className={`${thW} bg-green-700/20 text-green-800 dark:text-green-300`}>Payment Receipt</th>
                                            <th className="border border-border w-3 bg-muted/10" />
                                            <th colSpan={5} className={`${thW} bg-yellow-500/15 text-yellow-800 dark:text-yellow-300`}>Sales in Process</th>
                                          </tr>
                                          <tr>
                                            <th colSpan={2} className={`${thW} bg-green-700/15 text-green-800 dark:text-green-400 italic`}>Order Closed ✓</th>
                                            <th className={`${thW} bg-green-700/10`}>Down Payment</th>
                                            <th className={`${thW} bg-green-700/10`}>Total Amount</th>
                                            <th className="border border-border bg-muted/10" />
                                            <th colSpan={2} className={`${thW} bg-yellow-500/15 text-yellow-800 dark:text-yellow-400 italic`}>Quotation Sent</th>
                                            <th colSpan={2} className={`${thW} bg-blue-600/15 text-blue-800 dark:text-blue-400`}>Order Confirmed</th>
                                            <th className={`${thW} bg-yellow-500/10`}>Total SIP</th>
                                          </tr>
                                          <tr>
                                            <th className={`${thW} bg-green-700/10`}>Orders</th>
                                            <th className={`${thW} bg-green-700/10`}>Amount</th>
                                            <th className={`${thW} bg-green-700/10`}>Amount</th>
                                            <th className={`${thW} bg-green-700/10`}>Amount</th>
                                            <th className="border border-border bg-muted/10" />
                                            <th className={`${thW} bg-yellow-600/10`}>Quotations</th>
                                            <th className={`${thW} bg-yellow-600/10`}>Amount</th>
                                            <th className={`${thW} bg-blue-600/10`}>Orders</th>
                                            <th className={`${thW} bg-blue-600/10`}>Amount</th>
                                            <th className={`${thW} bg-yellow-600/10`}>Amount</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {weekRows.map((w, wi) => (
                                            <tr key={wi} className={wi % 2 === 0 ? "bg-background" : "bg-muted/10"}>
                                              <td className={`${tdW} text-left font-medium text-foreground`}>
                                                {w.monthName} {w.weekOrdinal} Week
                                                <div className="text-[10px] text-muted-foreground font-normal">
                                                  {w.weekStart} – {w.weekEnd}
                                                </div>
                                              </td>
                                              <td className={`${tdW} text-green-800 dark:text-green-300 font-medium`}>{w.orderClosedCount || ""}</td>
                                              <td className={`${tdW} text-green-800 dark:text-green-300`}>{fmtAmt(w.orderClosedAmount, expandedRate)}</td>
                                              <td className={tdW}>{fmtAmt(w.downPayment, expandedRate)}</td>
                                              <td className={`${tdW} font-semibold`}>{fmtAmt(w.totalPaymentReceipt, expandedRate)}</td>
                                              <td className="border border-border bg-muted/10" />
                                              <td className={`${tdW} text-yellow-800 dark:text-yellow-300 font-medium`}>{w.quotationSentCount || ""}</td>
                                              <td className={`${tdW} text-yellow-800 dark:text-yellow-300`}>{fmtAmt(w.quotationSentAmount, expandedRate)}</td>
                                              <td className={`${tdW} text-blue-800 dark:text-blue-300 font-medium`}>{w.orderConfirmedCount || ""}</td>
                                              <td className={`${tdW} text-blue-800 dark:text-blue-300`}>{fmtAmt(w.orderConfirmedAmount, expandedRate)}</td>
                                              <td className={`${tdW} font-semibold`}>{fmtAmt(w.totalSalesInProcess, expandedRate)}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                        <tfoot>
                                          <tr className="bg-muted/40 font-semibold border-t-2 border-border">
                                            <td className={`${tdW} text-left`}>Total {MONTHS_FULL[expandedMonth! - 1]}</td>
                                            <td className={tdW}>{weekRows.reduce((s, w) => s + w.orderClosedCount, 0) || ""}</td>
                                            <td className={tdW}>{fmtAmt(weekRows.reduce((s, w) => s + w.orderClosedAmount, 0), expandedRate)}</td>
                                            <td className={tdW}>{fmtAmt(weekRows.reduce((s, w) => s + w.downPayment, 0), expandedRate)}</td>
                                            <td className={tdW}>{fmtAmt(weekRows.reduce((s, w) => s + w.totalPaymentReceipt, 0), expandedRate)}</td>
                                            <td className="border border-border bg-muted/10" />
                                            <td className={tdW}>{weekRows.reduce((s, w) => s + w.quotationSentCount, 0) || ""}</td>
                                            <td className={tdW}>{fmtAmt(weekRows.reduce((s, w) => s + w.quotationSentAmount, 0), expandedRate)}</td>
                                            <td className={tdW}>{weekRows.reduce((s, w) => s + w.orderConfirmedCount, 0) || ""}</td>
                                            <td className={tdW}>{fmtAmt(weekRows.reduce((s, w) => s + w.orderConfirmedAmount, 0), expandedRate)}</td>
                                            <td className={tdW}>{fmtAmt(weekRows.reduce((s, w) => s + w.totalSalesInProcess, 0), expandedRate)}</td>
                                          </tr>
                                        </tfoot>
                                      </table>
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
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
                        return (
                          <td key={mIdx} className="px-3 py-2 text-right">
                            {fmtAmt(convertedTotals?.monthTotals[mIdx] ?? 0, 1)}
                          </td>
                        );
                      })}
                      {hasSummary && (
                        <>
                          <td className="px-3 py-2 text-right bg-blue-500/10 border-l border-border">
                            {fmtAmt(convertedTotals?.summaryTotal ?? 0, 1)}
                          </td>
                          <td className="px-3 py-2 text-right bg-blue-500/10">
                            {fmtAmt(convertedTotals?.summaryQuotation ?? 0, 1)}
                          </td>
                          <td className="px-3 py-2 text-right bg-blue-500/10">
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
    </div>
  );
}
