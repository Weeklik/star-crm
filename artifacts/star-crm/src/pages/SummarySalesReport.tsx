import { useGetMe } from "@workspace/api-client-react";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useState, useEffect } from "react";
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

  // Inline week expansion
  const [expanded, setExpanded]       = useState<ExpandedKey | null>(null);
  const [weekRows, setWeekRows]       = useState<WeekRow[]>([]);
  const [weekLoading, setWeekLoading] = useState(false);

  const { formatAmount } = useCurrency();
  const fmt  = (n: number) => (n ? formatAmount(n) : "-");
  const fmtW = (n: number) => (n ? formatAmount(n) : "");

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

    setLoading(true);
    fetch(`/api/reports/summary-sales?${params}`)
      .then((r) => r.json())
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [me, year, summaryStart, summaryEnd, filterSpId]);

  // Collapse expansion when year changes
  useEffect(() => { setExpanded(null); setWeekRows([]); }, [year]);

  function handleMonthClick(spId: number, monthIdx: number) {
    // monthIdx is 1-based
    if (expanded?.spId === spId && expanded?.monthIdx === monthIdx) {
      setExpanded(null);
      setWeekRows([]);
      return;
    }
    setExpanded({ spId, monthIdx });
    setWeekLoading(true);
    setWeekRows([]);
    const d0 = new Date(parseInt(year), monthIdx - 1, 1);
    const startDate = format(startOfMonth(d0), "yyyy-MM-dd");
    const endDate   = format(endOfMonth(d0),   "yyyy-MM-dd");
    const params = new URLSearchParams({ startDate, endDate, salespersonId: String(spId) });
    fetch(`/api/reports/sales-breakdown?${params}`)
      .then((r) => r.json())
      .then((d) => setWeekRows(d.weeks ?? []))
      .catch(() => setWeekRows([]))
      .finally(() => setWeekLoading(false));
  }

  const yearOptions = Array.from({ length: 5 }, (_, i) => String(currentYear - i));

  const totalSalesSum       = rows.reduce((s, r) => s + r.totalSales, 0);
  const monthlyTotals: Record<number, number> = {};
  for (let m = 1; m <= 12; m++) {
    monthlyTotals[m] = rows.reduce((s, r) => s + (r.monthly[m] ?? 0), 0);
  }
  const summaryTotalSum          = rows.reduce((s, r) => s + r.summaryTotal, 0);
  const summaryQuotationSum      = rows.reduce((s, r) => s + r.summaryQuotation, 0);
  const summaryOrderConfirmedSum = rows.reduce((s, r) => s + r.summaryOrderConfirmed, 0);

  const hasSummary    = summaryStart && summaryEnd;
  const summaryLabel  = hasSummary
    ? `${format(new Date(summaryStart), "d MMM")} – ${format(new Date(summaryEnd), "d MMM")}`
    : "Summary Period";

  // Total columns count for colspan
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
    a.href     = url;
    a.download = `summary-sales-${year}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 max-w-full mx-auto space-y-4 print:p-2">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Monthly Report</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Year-to-date sales per salesperson. Click any month cell to expand weekly breakdown.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              {yearOptions.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
            </SelectContent>
          </Select>

          {me?.role === "owner" && (
            <Select value={filterSpId} onValueChange={setFilterSpId}>
              <SelectTrigger className="w-44">
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

          <div className="flex items-center gap-1">
            <DatePicker value={summaryStart} onChange={setSummaryStart} placeholder="Summary from" className="w-40" />
            <span className="text-muted-foreground text-sm">to</span>
            <DatePicker value={summaryEnd} onChange={setSummaryEnd} placeholder="Summary to" className="w-40" />
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
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-muted/60 border-b border-border">
                    <th className="px-3 py-2.5 text-left font-semibold whitespace-nowrap sticky left-0 bg-muted/60">Name</th>
                    <th className="px-3 py-2.5 text-right font-semibold whitespace-nowrap">Avg Monthly {year}</th>
                    <th className="px-3 py-2.5 text-right font-semibold whitespace-nowrap">Total {year}</th>
                    {MONTHS.map((m) => (
                      <th key={m} className="px-3 py-2.5 text-right font-semibold whitespace-nowrap">{m} {year}</th>
                    ))}
                    {hasSummary && (
                      <th className="px-3 py-2.5 text-right font-semibold whitespace-nowrap bg-blue-500/10 border-l border-border" colSpan={3}>
                        Summary {summaryLabel}
                      </th>
                    )}
                  </tr>
                  {hasSummary && (
                    <tr className="bg-muted/30 border-b border-border text-xs">
                      <th className="px-3 py-1 sticky left-0 bg-muted/30" />
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
                    rows.map((row, i) => {
                      const isExpanded = expanded?.spId === row.salespersonId;
                      const expandedMonth = expanded?.monthIdx ?? null;

                      return (
                        <>
                          {/* ── Main salesperson row ── */}
                          <tr
                            key={`row-${row.salespersonId}`}
                            className={`border-b border-border/50 ${i % 2 === 0 ? "" : "bg-muted/10"}`}
                          >
                            <td className="px-3 py-2 font-medium whitespace-nowrap sticky left-0 bg-card">{row.name}</td>
                            <td className="px-3 py-2 text-right">{fmt(Math.round(row.avgMonthlySales))}</td>
                            <td className="px-3 py-2 text-right font-medium">{fmt(row.totalSales)}</td>
                            {Array.from({ length: 12 }, (_, idx) => {
                              const mIdx = idx + 1;
                              const val  = row.monthly[mIdx] ?? 0;
                              const active = isExpanded && expandedMonth === mIdx;
                              return (
                                <td
                                  key={mIdx}
                                  onClick={() => handleMonthClick(row.salespersonId, mIdx)}
                                  className={`px-3 py-2 text-right tabular-nums cursor-pointer select-none transition-colors
                                    ${active
                                      ? "bg-primary/15 text-primary font-semibold ring-inset ring-1 ring-primary/40"
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
                                    {fmt(val)}
                                  </span>
                                </td>
                              );
                            })}
                            {hasSummary && (
                              <>
                                <td className="px-3 py-2 text-right bg-blue-500/5 border-l border-border">{fmt(row.summaryTotal)}</td>
                                <td className="px-3 py-2 text-right bg-blue-500/5">{fmt(row.summaryQuotation)}</td>
                                <td className="px-3 py-2 text-right bg-blue-500/5">{fmt(row.summaryOrderConfirmed)}</td>
                              </>
                            )}
                          </tr>

                          {/* ── Inline weekly expansion ── */}
                          {isExpanded && (
                            <tr key={`expand-${row.salespersonId}`} className="border-b border-primary/20">
                              <td colSpan={totalCols} className="p-0 bg-primary/5">
                                <div className="px-4 py-3">
                                  {/* Expansion header */}
                                  <div className="flex items-center gap-2 mb-2.5">
                                    <ChevronDown className="w-4 h-4 text-primary" />
                                    <span className="text-sm font-semibold text-primary">
                                      {row.name} — {MONTHS_FULL[expandedMonth! - 1]} {year} — Weekly Breakdown
                                    </span>
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
                                          {/* Section headers */}
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
                                              <td className={`${tdW} text-green-800 dark:text-green-300`}>{fmtW(w.orderClosedAmount)}</td>
                                              <td className={`${tdW}`}>{fmtW(w.downPayment)}</td>
                                              <td className={`${tdW} font-semibold`}>{fmtW(w.totalPaymentReceipt)}</td>
                                              <td className="border border-border bg-muted/10" />
                                              <td className={`${tdW} text-yellow-800 dark:text-yellow-300 font-medium`}>{w.quotationSentCount || ""}</td>
                                              <td className={`${tdW} text-yellow-800 dark:text-yellow-300`}>{fmtW(w.quotationSentAmount)}</td>
                                              <td className={`${tdW} text-blue-800 dark:text-blue-300 font-medium`}>{w.orderConfirmedCount || ""}</td>
                                              <td className={`${tdW} text-blue-800 dark:text-blue-300`}>{fmtW(w.orderConfirmedAmount)}</td>
                                              <td className={`${tdW} font-semibold`}>{fmtW(w.totalSalesInProcess)}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                        <tfoot>
                                          <tr className="bg-muted/40 font-semibold border-t-2 border-border">
                                            <td className={`${tdW} text-left`}>Total {MONTHS_FULL[expandedMonth! - 1]}</td>
                                            <td className={tdW}>{weekRows.reduce((s, w) => s + w.orderClosedCount, 0) || ""}</td>
                                            <td className={tdW}>{fmtW(weekRows.reduce((s, w) => s + w.orderClosedAmount, 0))}</td>
                                            <td className={tdW}>{fmtW(weekRows.reduce((s, w) => s + w.downPayment, 0))}</td>
                                            <td className={tdW}>{fmtW(weekRows.reduce((s, w) => s + w.totalPaymentReceipt, 0))}</td>
                                            <td className="border border-border bg-muted/10" />
                                            <td className={tdW}>{weekRows.reduce((s, w) => s + w.quotationSentCount, 0) || ""}</td>
                                            <td className={tdW}>{fmtW(weekRows.reduce((s, w) => s + w.quotationSentAmount, 0))}</td>
                                            <td className={tdW}>{weekRows.reduce((s, w) => s + w.orderConfirmedCount, 0) || ""}</td>
                                            <td className={tdW}>{fmtW(weekRows.reduce((s, w) => s + w.orderConfirmedAmount, 0))}</td>
                                            <td className={tdW}>{fmtW(weekRows.reduce((s, w) => s + w.totalSalesInProcess, 0))}</td>
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
                      <td className="px-3 py-2 sticky left-0 bg-muted/40">Total</td>
                      <td className="px-3 py-2 text-right">{fmt(Math.round(rows.reduce((s, r) => s + r.avgMonthlySales, 0)))}</td>
                      <td className="px-3 py-2 text-right">{fmt(totalSalesSum)}</td>
                      {Array.from({ length: 12 }, (_, idx) => (
                        <td key={idx + 1} className="px-3 py-2 text-right">{fmt(monthlyTotals[idx + 1])}</td>
                      ))}
                      {hasSummary && (
                        <>
                          <td className="px-3 py-2 text-right bg-blue-500/10 border-l border-border">{fmt(summaryTotalSum)}</td>
                          <td className="px-3 py-2 text-right bg-blue-500/10">{fmt(summaryQuotationSum)}</td>
                          <td className="px-3 py-2 text-right bg-blue-500/10">{fmt(summaryOrderConfirmedSum)}</td>
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
  );
}
