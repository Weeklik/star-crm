import { useGetMe } from "@workspace/api-client-react";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useState, useEffect } from "react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { Loader2, FileSpreadsheet, Printer, X } from "lucide-react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

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

interface UserOption {
  id: number;
  email: string;
  name: string | null;
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
  notes: string | null;
}

interface DrillDown {
  weekLabel: string;
  weekStart: string;
  weekEnd: string;
  stage: string;       // API stage param: "Order Closed" | "Quotation Sent" | "Order Confirmed" | "Sales in Process"
  columnLabel: string; // Human-readable column name shown in modal title
}

function fmtCount(n: number) {
  if (!n) return "";
  return String(n);
}

function fmtExport(n: number) {
  if (!n) return "";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);
}

// Group consecutive weeks by month
function groupByMonth(weeks: WeekRow[]): Array<{ monthKey: string; monthLabel: string; rows: WeekRow[] }> {
  const groups: Array<{ monthKey: string; monthLabel: string; rows: WeekRow[] }> = [];
  for (const w of weeks) {
    const key = `${w.monthName} ${w.monthYear}`;
    const last = groups[groups.length - 1];
    if (last && last.monthKey === key) {
      last.rows.push(w);
    } else {
      groups.push({ monthKey: key, monthLabel: `${w.monthName} ${w.monthYear}`, rows: [w] });
    }
  }
  return groups;
}

function handleExportExcel(weeks: WeekRow[], startMonth: string, startYear: string, endMonth: string, endYear: string) {
  const wb = XLSX.utils.book_new();
  const aoa: unknown[][] = [];

  aoa.push(["SUMMARY REPORT"]);
  aoa.push([]);
  aoa.push([
    "Months",
    "Payment Receipt", "", "", "",
    "",
    "Sales in Process", "", "", "", "",
  ]);
  aoa.push([
    "",
    "Order Closed", "", "Down Payment Amount", "Total Amount",
    "",
    "Quotation Sent", "", "Order Confirmed", "", "Total Amount",
  ]);
  aoa.push([
    "",
    "Total Orders", "Amount", "Amount", "Amount",
    "",
    "Total Quotations", "Amount", "Total Orders", "Amount", "Amount",
  ]);

  const groups = groupByMonth(weeks);
  for (const group of groups) {
    aoa.push([group.monthLabel, "", "", "", "", "", "", "", "", "", ""]);
    for (const w of group.rows) {
      const weekLabel = `${w.monthName} ${w.weekOrdinal} Week`;
      aoa.push([
        weekLabel,
        fmtCount(w.orderClosedCount) || "",
        fmtExport(w.orderClosedAmount) || "",
        fmtExport(w.downPayment) || "",
        fmtExport(w.totalPaymentReceipt) || "",
        "",
        fmtCount(w.quotationSentCount) || "",
        fmtExport(w.quotationSentAmount) || "",
        fmtCount(w.orderConfirmedCount) || "",
        fmtExport(w.orderConfirmedAmount) || "",
        fmtExport(w.totalSalesInProcess) || "",
      ]);
    }
    // Monthly total row
    const mOC  = group.rows.reduce((s, w) => s + w.orderClosedCount, 0);
    const mOCA = group.rows.reduce((s, w) => s + w.orderClosedAmount, 0);
    const mDP  = group.rows.reduce((s, w) => s + w.downPayment, 0);
    const mPR  = group.rows.reduce((s, w) => s + w.totalPaymentReceipt, 0);
    const mQC  = group.rows.reduce((s, w) => s + w.quotationSentCount, 0);
    const mQA  = group.rows.reduce((s, w) => s + w.quotationSentAmount, 0);
    const mCC  = group.rows.reduce((s, w) => s + w.orderConfirmedCount, 0);
    const mCA  = group.rows.reduce((s, w) => s + w.orderConfirmedAmount, 0);
    const mSIP = group.rows.reduce((s, w) => s + w.totalSalesInProcess, 0);
    aoa.push([
      `Total ${group.rows[0]?.monthName ?? group.monthLabel}`,
      fmtCount(mOC) || "", fmtExport(mOCA) || "", fmtExport(mDP) || "", fmtExport(mPR) || "",
      "",
      fmtCount(mQC) || "", fmtExport(mQA) || "", fmtCount(mCC) || "", fmtExport(mCA) || "", fmtExport(mSIP) || "",
    ]);
  }

  const totOC  = weeks.reduce((s, w) => s + w.orderClosedCount, 0);
  const totOCA = weeks.reduce((s, w) => s + w.orderClosedAmount, 0);
  const totDP  = weeks.reduce((s, w) => s + w.downPayment, 0);
  const totPR  = weeks.reduce((s, w) => s + w.totalPaymentReceipt, 0);
  const totQC  = weeks.reduce((s, w) => s + w.quotationSentCount, 0);
  const totQA  = weeks.reduce((s, w) => s + w.quotationSentAmount, 0);
  const totCC  = weeks.reduce((s, w) => s + w.orderConfirmedCount, 0);
  const totCA  = weeks.reduce((s, w) => s + w.orderConfirmedAmount, 0);
  const totSIP = weeks.reduce((s, w) => s + w.totalSalesInProcess, 0);

  aoa.push([
    "TOTAL",
    fmtCount(totOC), fmtExport(totOCA), fmtExport(totDP), fmtExport(totPR),
    "",
    fmtCount(totQC), fmtExport(totQA), fmtCount(totCC), fmtExport(totCA), fmtExport(totSIP),
  ]);

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 10 } },
    { s: { r: 2, c: 1 }, e: { r: 2, c: 4 } },
    { s: { r: 2, c: 6 }, e: { r: 2, c: 10 } },
    { s: { r: 3, c: 1 }, e: { r: 3, c: 2 } },
    { s: { r: 3, c: 6 }, e: { r: 3, c: 7 } },
    { s: { r: 3, c: 8 }, e: { r: 3, c: 9 } },
  ];
  ws["!cols"] = [
    { wch: 24 }, { wch: 13 }, { wch: 13 }, { wch: 18 }, { wch: 13 },
    { wch: 3 },
    { wch: 16 }, { wch: 13 }, { wch: 13 }, { wch: 13 }, { wch: 13 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, "Summary Report");
  XLSX.writeFile(wb, `sales-breakdown-${startMonth}-${startYear}-to-${endMonth}-${endYear}.xlsx`);
}

// ── Drill-down modal ──────────────────────────────────────────────────────────

function DealDrillDownModal({
  drillDown,
  filterSpId,
  onClose,
}: {
  drillDown: DrillDown | null;
  filterSpId: string;
  onClose: () => void;
}) {
  const [deals, setDeals] = useState<DealDetail[]>([]);
  const [loading, setLoading] = useState(false);
  const { formatAmount } = useCurrency();
  const fmt = (n: number) => (n ? formatAmount(n) : "");
  const fmtAmt = (s: string | null | undefined) => {
    const n = parseFloat(s ?? "0") || 0;
    return n ? formatAmount(n) : "—";
  };

  useEffect(() => {
    if (!drillDown) return;
    setLoading(true);
    const params = new URLSearchParams({
      weekStart: drillDown.weekStart,
      weekEnd: drillDown.weekEnd,
      stage: drillDown.stage,
    });
    if (filterSpId && filterSpId !== "all") params.set("salespersonId", filterSpId);

    fetch(`/api/reports/sales-breakdown-deals?${params}`)
      .then((r) => r.json())
      .then((d) => setDeals(Array.isArray(d) ? d : []))
      .catch(() => setDeals([]))
      .finally(() => setLoading(false));
  }, [drillDown, filterSpId]);

  const totalAgreed      = deals.reduce((s, d) => s + (parseFloat(d.agreedAmount ?? "0") || 0), 0);
  const totalReceived    = deals.reduce((s, d) => s + (parseFloat(d.receivedAmount ?? "0") || 0), 0);
  const totalOutstanding = deals.reduce((s, d) => s + (parseFloat(d.outstandingAmount ?? "0") || 0), 0);

  return (
    <Dialog open={!!drillDown} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-start justify-between gap-4">
            <div>
              <span className="text-base font-bold">{drillDown?.columnLabel}</span>
              <p className="text-xs font-normal text-muted-foreground mt-0.5">
                {drillDown?.weekLabel}
              </p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto min-h-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            </div>
          ) : deals.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              No deals found for this period and stage.
            </div>
          ) : (
            <table className="w-full border-collapse text-sm min-w-[800px]">
              <thead className="sticky top-0 z-10">
                <tr className="bg-muted/60">
                  <th className="border border-border px-3 py-2 text-left font-semibold text-xs">#</th>
                  <th className="border border-border px-3 py-2 text-left font-semibold text-xs whitespace-nowrap">Start Date</th>
                  <th className="border border-border px-3 py-2 text-left font-semibold text-xs">Deal Name</th>
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
                        ? new Date(
                            (typeof deal.dealStartDate === "string"
                              ? deal.dealStartDate.split("T")[0]
                              : deal.dealStartDate) + "T00:00:00"
                          ).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
                        : "—"}
                    </td>
                    <td className="border border-border px-3 py-2 text-xs font-medium whitespace-nowrap">{deal.name}</td>
                    <td className="border border-border px-3 py-2 text-xs whitespace-nowrap">{deal.companyName}</td>
                    <td className="border border-border px-3 py-2 text-xs whitespace-nowrap text-muted-foreground">{deal.productItem}</td>
                    <td className="border border-border px-3 py-2 text-xs">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-medium whitespace-nowrap ${
                        deal.stage === "Order Closed"     ? "bg-green-500/20 text-green-700 dark:text-green-400" :
                        deal.stage === "Order Confirmed"  ? "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400" :
                        deal.stage === "Quotation Sent"   ? "bg-blue-500/20 text-blue-700 dark:text-blue-400" :
                        "bg-red-500/20 text-red-700 dark:text-red-400"
                      }`}>
                        {deal.stage}
                      </span>
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
                    Total ({deals.length} deal{deals.length !== 1 ? "s" : ""})
                  </td>
                  <td className="border border-border px-3 py-2 text-xs text-right tabular-nums">{fmt(totalAgreed)}</td>
                  <td className="border border-border px-3 py-2 text-xs text-right tabular-nums">{fmt(totalReceived)}</td>
                  <td className="border border-border px-3 py-2 text-xs text-right tabular-nums">{fmt(totalOutstanding)}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SalesBreakdown() {
  const { data: me } = useGetMe();
  const now = new Date();
  const currentYear = now.getFullYear();

  const [startYear,   setStartYear]   = useState(String(currentYear));
  const [startMonth,  setStartMonth]  = useState(String(0));
  const [endYear,     setEndYear]     = useState(String(currentYear));
  const [endMonth,    setEndMonth]    = useState(String(now.getMonth()));
  const [filterSpId,  setFilterSpId]  = useState<string>("all");
  const [weeks,       setWeeks]       = useState<WeekRow[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [users,       setUsers]       = useState<UserOption[]>([]);
  const [drillDown,   setDrillDown]   = useState<DrillDown | null>(null);
  const { formatAmount } = useCurrency();
  const fmt = (n: number) => (n ? formatAmount(n) : "");

  useEffect(() => {
    if (me?.role === "owner") {
      fetch("/api/users").then((r) => r.json()).then(setUsers).catch(() => {});
    }
  }, [me]);

  useEffect(() => {
    if (!me) return;
    const sDate = format(startOfMonth(new Date(parseInt(startYear), parseInt(startMonth), 1)), "yyyy-MM-dd");
    const eDate = format(endOfMonth(new Date(parseInt(endYear), parseInt(endMonth), 1)), "yyyy-MM-dd");
    const params = new URLSearchParams({ startDate: sDate, endDate: eDate });
    if (filterSpId && filterSpId !== "all") params.set("salespersonId", filterSpId);

    setLoading(true);
    fetch(`/api/reports/sales-breakdown?${params}`)
      .then((r) => r.json())
      .then((d) => setWeeks(d.weeks ?? []))
      .catch(() => setWeeks([]))
      .finally(() => setLoading(false));
  }, [me, startYear, startMonth, endYear, endMonth, filterSpId]);

  const yearOptions = Array.from({ length: 5 }, (_, i) => String(currentYear - i));
  const groups      = groupByMonth(weeks);

  const totOC  = weeks.reduce((s, w) => s + w.orderClosedCount, 0);
  const totOCA = weeks.reduce((s, w) => s + w.orderClosedAmount, 0);
  const totDP  = weeks.reduce((s, w) => s + w.downPayment, 0);
  const totPR  = weeks.reduce((s, w) => s + w.totalPaymentReceipt, 0);
  const totQC  = weeks.reduce((s, w) => s + w.quotationSentCount, 0);
  const totQA  = weeks.reduce((s, w) => s + w.quotationSentAmount, 0);
  const totCC  = weeks.reduce((s, w) => s + w.orderConfirmedCount, 0);
  const totCA  = weeks.reduce((s, w) => s + w.orderConfirmedAmount, 0);
  const totSIP = weeks.reduce((s, w) => s + w.totalSalesInProcess, 0);

  const smLabel = MONTH_NAMES[parseInt(startMonth)];
  const emLabel = MONTH_NAMES[parseInt(endMonth)];

  const thBase = "border border-border text-center text-xs font-semibold px-2 py-1.5 whitespace-nowrap";
  const tdBase = "border border-border text-center text-xs px-2 py-1.5 whitespace-nowrap";

  // Helper: open drill-down modal
  function openDrill(w: WeekRow, stage: string, columnLabel: string) {
    setDrillDown({
      weekLabel: `${w.monthName} ${w.weekOrdinal} Week, ${w.monthYear}  (${w.weekStart} – ${w.weekEnd})`,
      weekStart: w.weekStart,
      weekEnd: w.weekEnd,
      stage,
      columnLabel,
    });
  }

  // Clickable cell style
  const clickable = "cursor-pointer hover:brightness-90 active:brightness-75 transition-all select-none";

  return (
    <div className="p-6 max-w-full mx-auto space-y-4">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Summary Report</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Weekly summary report by deal stage. Click any value to see the deals behind it.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => handleExportExcel(weeks, smLabel, startYear, emLabel, endYear)}
            disabled={weeks.length === 0}
          >
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Export Excel
          </Button>
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="w-4 h-4 mr-2" />
            Print / PDF
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 bg-card border border-border rounded-lg p-4 print:hidden">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground whitespace-nowrap">From</span>
          <Select value={startMonth} onValueChange={setStartMonth}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MONTH_NAMES.map((m, i) => <SelectItem key={i} value={String(i)}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={startYear} onValueChange={setStartYear}>
            <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
            <SelectContent>
              {yearOptions.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground whitespace-nowrap">To</span>
          <Select value={endMonth} onValueChange={setEndMonth}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MONTH_NAMES.map((m, i) => <SelectItem key={i} value={String(i)}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={endYear} onValueChange={setEndYear}>
            <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
            <SelectContent>
              {yearOptions.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {me?.role === "owner" && (
          <Select value={filterSpId} onValueChange={setFilterSpId}>
            <SelectTrigger className="w-48"><SelectValue placeholder="All salespersons" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All salespersons</SelectItem>
              {users.map((u) => (
                <SelectItem key={u.id} value={String(u.id)}>{u.name || u.email}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                {/* Row 1: Title */}
                <tr>
                  <th colSpan={11} className="border border-border py-3 text-center text-base font-bold tracking-wide uppercase bg-muted/30">
                    SUMMARY REPORT
                  </th>
                </tr>

                {/* Row 2: Top section headers */}
                <tr>
                  <th rowSpan={3} className={`${thBase} bg-muted/40 text-left min-w-[180px]`}>Months</th>
                  <th colSpan={4} className={`${thBase} bg-green-700/30 text-green-800 dark:text-green-300`}>Payment Receipt</th>
                  <th className="border border-border w-4 bg-muted/10" />
                  <th colSpan={5} className={`${thBase} bg-yellow-500/20 text-yellow-800 dark:text-yellow-300`}>Sales in Process</th>
                </tr>

                {/* Row 3: Sub-section headers */}
                <tr>
                  <th colSpan={2} className={`${thBase} bg-green-700/20 text-green-800 dark:text-green-400 italic`}>Order Closed ✓</th>
                  <th className={`${thBase} bg-green-700/10 text-green-900 dark:text-foreground`}>Down Payment Amount</th>
                  <th className={`${thBase} bg-green-700/10 text-green-900 dark:text-foreground`}>Total Amount</th>
                  <th className="border border-border bg-muted/10" />
                  <th colSpan={2} className={`${thBase} bg-yellow-500/20 text-yellow-800 dark:text-yellow-400 italic`}>Quotation Sent</th>
                  <th colSpan={2} className={`${thBase} bg-blue-600/20 text-blue-800 dark:text-blue-400`}>Order Confirmed</th>
                  <th className={`${thBase} bg-yellow-500/10 text-yellow-900 dark:text-foreground`}>Total Amount</th>
                </tr>

                {/* Row 4: Column headers */}
                <tr>
                  <th className={`${thBase} bg-green-700/10`}>Total Orders</th>
                  <th className={`${thBase} bg-green-700/10`}>Amount</th>
                  <th className={`${thBase} bg-green-700/10`}>Amount</th>
                  <th className={`${thBase} bg-green-700/10`}>Amount</th>
                  <th className="border border-border bg-muted/10" />
                  <th className={`${thBase} bg-yellow-600/10`}>Total Quotations</th>
                  <th className={`${thBase} bg-yellow-600/10`}>Amount</th>
                  <th className={`${thBase} bg-blue-600/10`}>Total Orders</th>
                  <th className={`${thBase} bg-blue-600/10`}>Amount</th>
                  <th className={`${thBase} bg-yellow-600/10`}>Amount</th>
                </tr>
              </thead>

              <tbody>
                {groups.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="text-center py-10 text-muted-foreground text-sm">
                      No data for this period.
                    </td>
                  </tr>
                ) : (
                  groups.map(({ monthKey, monthLabel, rows }) => {
                    const mOC  = rows.reduce((s, w) => s + w.orderClosedCount, 0);
                    const mOCA = rows.reduce((s, w) => s + w.orderClosedAmount, 0);
                    const mDP  = rows.reduce((s, w) => s + w.downPayment, 0);
                    const mPR  = rows.reduce((s, w) => s + w.totalPaymentReceipt, 0);
                    const mQC  = rows.reduce((s, w) => s + w.quotationSentCount, 0);
                    const mQA  = rows.reduce((s, w) => s + w.quotationSentAmount, 0);
                    const mCC  = rows.reduce((s, w) => s + w.orderConfirmedCount, 0);
                    const mCA  = rows.reduce((s, w) => s + w.orderConfirmedAmount, 0);
                    const mSIP = rows.reduce((s, w) => s + w.totalSalesInProcess, 0);
                    return (
                    <>
                      {/* Month header row */}
                      <tr key={`month-${monthKey}`} className="bg-muted/30">
                        <td colSpan={11} className="border border-border px-3 py-1.5 font-bold text-sm">
                          {monthLabel}
                        </td>
                      </tr>

                      {/* Week rows */}
                      {rows.map((w, wi) => (
                        <tr
                          key={w.weekStart}
                          className={`${wi % 2 === 0 ? "" : "bg-muted/5"}`}
                        >
                          <td className={`${tdBase} text-left font-medium`}>
                            {w.monthName} {w.weekOrdinal} Week
                          </td>

                          {/* Order Closed — count */}
                          <td
                            className={`${tdBase} bg-green-900/10 ${w.orderClosedCount ? clickable : ""}`}
                            onClick={() => w.orderClosedCount && openDrill(w, "Order Closed", "Order Closed — No. of Orders")}
                            title={w.orderClosedCount ? "Click to view deals" : undefined}
                          >
                            {fmtCount(w.orderClosedCount)}
                          </td>

                          {/* Order Closed — amount */}
                          <td
                            className={`${tdBase} bg-green-900/10 ${w.orderClosedAmount ? clickable : ""}`}
                            onClick={() => w.orderClosedAmount && openDrill(w, "Order Closed", "Order Closed — Amount")}
                            title={w.orderClosedAmount ? "Click to view deals" : undefined}
                          >
                            {fmt(w.orderClosedAmount)}
                          </td>

                          {/* Down Payment */}
                          <td
                            className={`${tdBase} bg-green-900/5 ${w.downPayment ? clickable : ""}`}
                            onClick={() => w.downPayment && openDrill(w, "Order Closed", "Order Closed — Down Payment")}
                            title={w.downPayment ? "Click to view deals" : undefined}
                          >
                            {fmt(w.downPayment)}
                          </td>

                          {/* Total Payment Receipt */}
                          <td
                            className={`${tdBase} bg-green-900/5 font-medium ${w.totalPaymentReceipt ? clickable : ""}`}
                            onClick={() => w.totalPaymentReceipt && openDrill(w, "Order Closed", "Payment Receipt — Total")}
                            title={w.totalPaymentReceipt ? "Click to view deals" : undefined}
                          >
                            {fmt(w.totalPaymentReceipt)}
                          </td>

                          {/* Gap */}
                          <td className="border border-border bg-muted/10" />

                          {/* Quotation Sent — count */}
                          <td
                            className={`${tdBase} bg-yellow-900/10 ${w.quotationSentCount ? clickable : ""}`}
                            onClick={() => w.quotationSentCount && openDrill(w, "Quotation Sent", "Quotation Sent — No. of Quotations")}
                            title={w.quotationSentCount ? "Click to view deals" : undefined}
                          >
                            {fmtCount(w.quotationSentCount)}
                          </td>

                          {/* Quotation Sent — amount */}
                          <td
                            className={`${tdBase} bg-yellow-900/10 ${w.quotationSentAmount ? clickable : ""}`}
                            onClick={() => w.quotationSentAmount && openDrill(w, "Quotation Sent", "Quotation Sent — Amount")}
                            title={w.quotationSentAmount ? "Click to view deals" : undefined}
                          >
                            {fmt(w.quotationSentAmount)}
                          </td>

                          {/* Order Confirmed — count */}
                          <td
                            className={`${tdBase} bg-blue-900/10 ${w.orderConfirmedCount ? clickable : ""}`}
                            onClick={() => w.orderConfirmedCount && openDrill(w, "Order Confirmed", "Order Confirmed — No. of Orders")}
                            title={w.orderConfirmedCount ? "Click to view deals" : undefined}
                          >
                            {fmtCount(w.orderConfirmedCount)}
                          </td>

                          {/* Order Confirmed — amount */}
                          <td
                            className={`${tdBase} bg-blue-900/10 ${w.orderConfirmedAmount ? clickable : ""}`}
                            onClick={() => w.orderConfirmedAmount && openDrill(w, "Order Confirmed", "Order Confirmed — Amount")}
                            title={w.orderConfirmedAmount ? "Click to view deals" : undefined}
                          >
                            {fmt(w.orderConfirmedAmount)}
                          </td>

                          {/* Total Sales in Process */}
                          <td
                            className={`${tdBase} bg-yellow-900/5 font-medium ${w.totalSalesInProcess ? clickable : ""}`}
                            onClick={() => w.totalSalesInProcess && openDrill(w, "Sales in Process", "Sales in Process — Total")}
                            title={w.totalSalesInProcess ? "Click to view deals" : undefined}
                          >
                            {fmt(w.totalSalesInProcess)}
                          </td>
                        </tr>
                      ))}

                      {/* Monthly total row */}
                      <tr key={`total-${monthKey}`} className="bg-muted/50 border-t border-border font-semibold">
                        <td className={`${tdBase} text-left text-xs font-bold`}>
                          Total {rows[0]?.monthName}
                        </td>
                        <td className={`${tdBase} bg-green-700/25 font-bold`}>{fmtCount(mOC)}</td>
                        <td className={`${tdBase} bg-green-700/25 font-bold`}>{fmt(mOCA)}</td>
                        <td className={`${tdBase} bg-green-700/15 font-bold`}>{fmt(mDP)}</td>
                        <td className={`${tdBase} bg-green-700/15 font-bold`}>{fmt(mPR)}</td>
                        <td className="border border-border bg-muted/10" />
                        <td className={`${tdBase} bg-yellow-600/20 font-bold`}>{fmtCount(mQC)}</td>
                        <td className={`${tdBase} bg-yellow-600/20 font-bold`}>{fmt(mQA)}</td>
                        <td className={`${tdBase} bg-blue-600/20 font-bold`}>{fmtCount(mCC)}</td>
                        <td className={`${tdBase} bg-blue-600/20 font-bold`}>{fmt(mCA)}</td>
                        <td className={`${tdBase} bg-yellow-600/15 font-bold`}>{fmt(mSIP)}</td>
                      </tr>
                    </>
                  );
                  })
                )}
              </tbody>

              {/* Grand Totals footer */}
              {weeks.length > 0 && (
                <tfoot>
                  <tr className="bg-muted/40 font-bold border-t-2 border-border">
                    <td className={`${tdBase} text-left`}>TOTAL</td>
                    <td className={`${tdBase} bg-green-900/20`}>{fmtCount(totOC)}</td>
                    <td className={`${tdBase} bg-green-900/20`}>{fmt(totOCA)}</td>
                    <td className={`${tdBase} bg-green-900/10`}>{fmt(totDP)}</td>
                    <td className={`${tdBase} bg-green-900/10`}>{fmt(totPR)}</td>
                    <td className="border border-border bg-muted/10" />
                    <td className={`${tdBase} bg-yellow-900/20`}>{fmtCount(totQC)}</td>
                    <td className={`${tdBase} bg-yellow-900/20`}>{fmt(totQA)}</td>
                    <td className={`${tdBase} bg-blue-900/20`}>{fmtCount(totCC)}</td>
                    <td className={`${tdBase} bg-blue-900/20`}>{fmt(totCA)}</td>
                    <td className={`${tdBase} bg-yellow-900/10`}>{fmt(totSIP)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          )}
        </CardContent>
      </Card>

      {/* Drill-down modal */}
      <DealDrillDownModal
        drillDown={drillDown}
        filterSpId={filterSpId}
        onClose={() => setDrillDown(null)}
      />
    </div>
  );
}
