import { useGetMe } from "@workspace/api-client-react";
import { useOwnerControls } from "@/contexts/OwnerControlsContext";
import { useTranslation } from "@/i18n/LanguageContext";
import { OwnerControlsBar } from "@/components/layout/OwnerControlsBar";
import { useHistoricalRates } from "@/hooks/useHistoricalRates";
import { MonthRateCell } from "@/components/MonthRateCell";
import { useState, useEffect, useMemo } from "react";
import { format } from "date-fns";
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

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

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
                                  className={`px-3 py-2 text-right tabular-nums ${isCurCol ? "bg-primary/5 text-muted-foreground" : "text-muted-foreground"}`}
                                >
                                  {val ? fmtAmt(val, cellRate) : "-"}
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
                          <td key={mIdx} className="px-3 py-2 text-right">
                            {fmtAmt(totVal, 1)}
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
