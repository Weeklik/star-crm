import { useGetMe } from "@workspace/api-client-react";
import { useState, useEffect } from "react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { Loader2, FileSpreadsheet, Printer } from "lucide-react";
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

function fmt(n: number) {
  if (!n) return "";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);
}

function fmtCount(n: number) {
  if (!n) return "";
  return String(n);
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

  // Build rows manually for exact formatting
  const aoa: unknown[][] = [];

  // Row 1: Title
  aoa.push(["SUMMARY REPORT"]);
  aoa.push([]);

  // Row 3: Section headers
  aoa.push([
    "Months",
    "Payment Receipt", "", "", "",   // spans 4
    "",                               // gap
    "Sales in Process", "", "", "", "",  // spans 5
  ]);

  // Row 4: Sub-section headers
  aoa.push([
    "",
    "Order Closed", "", "Down Payment Amount", "Total Amount",
    "",
    "Quotation Sent", "", "Order Confirmed", "", "Total Amount",
  ]);

  // Row 5: Column headers
  aoa.push([
    "",
    "Total Orders", "Amount", "Amount", "Amount",
    "",
    "Total Quotations", "Amount", "Total Orders", "Amount", "Amount",
  ]);

  // Data rows grouped by month
  const groups = groupByMonth(weeks);
  for (const group of groups) {
    // Month header row
    aoa.push([group.monthLabel, "", "", "", "", "", "", "", "", "", ""]);

    for (const w of group.rows) {
      const weekLabel = `${w.monthName} ${w.weekOrdinal} Week`;
      aoa.push([
        weekLabel,
        fmtCount(w.orderClosedCount) || "",
        fmt(w.orderClosedAmount) || "",
        fmt(w.downPayment) || "",
        fmt(w.totalPaymentReceipt) || "",
        "",
        fmtCount(w.quotationSentCount) || "",
        fmt(w.quotationSentAmount) || "",
        fmtCount(w.orderConfirmedCount) || "",
        fmt(w.orderConfirmedAmount) || "",
        fmt(w.totalSalesInProcess) || "",
      ]);
    }
  }

  // Totals row
  const totOC = weeks.reduce((s, w) => s + w.orderClosedCount, 0);
  const totOCA = weeks.reduce((s, w) => s + w.orderClosedAmount, 0);
  const totDP = weeks.reduce((s, w) => s + w.downPayment, 0);
  const totPR = weeks.reduce((s, w) => s + w.totalPaymentReceipt, 0);
  const totQC = weeks.reduce((s, w) => s + w.quotationSentCount, 0);
  const totQA = weeks.reduce((s, w) => s + w.quotationSentAmount, 0);
  const totCC = weeks.reduce((s, w) => s + w.orderConfirmedCount, 0);
  const totCA = weeks.reduce((s, w) => s + w.orderConfirmedAmount, 0);
  const totSIP = weeks.reduce((s, w) => s + w.totalSalesInProcess, 0);

  aoa.push([
    "TOTAL",
    fmtCount(totOC), fmt(totOCA), fmt(totDP), fmt(totPR),
    "",
    fmtCount(totQC), fmt(totQA), fmtCount(totCC), fmt(totCA), fmt(totSIP),
  ]);

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Merge cells for headers
  ws["!merges"] = [
    // Title
    { s: { r: 0, c: 0 }, e: { r: 0, c: 10 } },
    // Section headers
    { s: { r: 2, c: 1 }, e: { r: 2, c: 4 } },  // Payment Receipt
    { s: { r: 2, c: 6 }, e: { r: 2, c: 10 } }, // Sales in Process
    // Sub-section headers
    { s: { r: 3, c: 1 }, e: { r: 3, c: 2 } },  // Order Closed
    { s: { r: 3, c: 6 }, e: { r: 3, c: 7 } },  // Quotation Sent
    { s: { r: 3, c: 8 }, e: { r: 3, c: 9 } },  // Order Confirmed
  ];

  // Column widths
  ws["!cols"] = [
    { wch: 24 }, // Months
    { wch: 13 }, // Total Orders (OC)
    { wch: 13 }, // Amount (OC)
    { wch: 18 }, // Down Payment
    { wch: 13 }, // Total Amount (PR)
    { wch: 3 },  // Gap
    { wch: 16 }, // Total Quotations
    { wch: 13 }, // Amount (QS)
    { wch: 13 }, // Total Orders (CC)
    { wch: 13 }, // Amount (CC)
    { wch: 13 }, // Total Amount (SIP)
  ];

  XLSX.utils.book_append_sheet(wb, ws, "Summary Report");
  XLSX.writeFile(wb, `sales-breakdown-${startMonth}-${startYear}-to-${endMonth}-${endYear}.xlsx`);
}

export default function SalesBreakdown() {
  const { data: me } = useGetMe();
  const now = new Date();
  const currentYear = now.getFullYear();

  const [startYear, setStartYear] = useState(String(currentYear));
  const [startMonth, setStartMonth] = useState(String(0));
  const [endYear, setEndYear] = useState(String(currentYear));
  const [endMonth, setEndMonth] = useState(String(now.getMonth()));
  const [filterSpId, setFilterSpId] = useState<string>("all");
  const [weeks, setWeeks] = useState<WeekRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<UserOption[]>([]);

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
  const groups = groupByMonth(weeks);

  // Grand totals
  const totOC    = weeks.reduce((s, w) => s + w.orderClosedCount, 0);
  const totOCA   = weeks.reduce((s, w) => s + w.orderClosedAmount, 0);
  const totDP    = weeks.reduce((s, w) => s + w.downPayment, 0);
  const totPR    = weeks.reduce((s, w) => s + w.totalPaymentReceipt, 0);
  const totQC    = weeks.reduce((s, w) => s + w.quotationSentCount, 0);
  const totQA    = weeks.reduce((s, w) => s + w.quotationSentAmount, 0);
  const totCC    = weeks.reduce((s, w) => s + w.orderConfirmedCount, 0);
  const totCA    = weeks.reduce((s, w) => s + w.orderConfirmedAmount, 0);
  const totSIP   = weeks.reduce((s, w) => s + w.totalSalesInProcess, 0);

  const smLabel = MONTH_NAMES[parseInt(startMonth)];
  const emLabel = MONTH_NAMES[parseInt(endMonth)];

  // Shared cell style classes
  const thBase = "border border-border text-center text-xs font-semibold px-2 py-1.5 whitespace-nowrap";
  const tdBase = "border border-border text-center text-xs px-2 py-1.5 whitespace-nowrap";

  return (
    <div className="p-6 max-w-full mx-auto space-y-4">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sales Breakdown</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Weekly summary report by deal stage.</p>
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
                {/* ── Row 1: Title ── */}
                <tr>
                  <th colSpan={11} className="border border-border py-3 text-center text-base font-bold tracking-wide uppercase bg-muted/30">
                    SUMMARY REPORT
                  </th>
                </tr>

                {/* ── Row 2: Top section headers ── */}
                <tr>
                  <th rowSpan={3} className={`${thBase} bg-muted/40 text-left min-w-[180px]`}>Months</th>
                  {/* Payment Receipt */}
                  <th colSpan={4} className={`${thBase} bg-green-700/30 text-green-300`}>Payment Receipt</th>
                  {/* Gap */}
                  <th className="border border-border w-4 bg-muted/10" />
                  {/* Sales in Process */}
                  <th colSpan={5} className={`${thBase} bg-yellow-600/20 text-yellow-300`}>Sales in Process</th>
                </tr>

                {/* ── Row 3: Sub-section headers ── */}
                <tr>
                  <th colSpan={2} className={`${thBase} bg-green-700/20 text-green-400 italic`}>Order Closed ✓</th>
                  <th className={`${thBase} bg-green-700/10`}>Down Payment Amount</th>
                  <th className={`${thBase} bg-green-700/10`}>Total Amount</th>
                  <th className="border border-border bg-muted/10" />
                  <th colSpan={2} className={`${thBase} bg-yellow-600/20 text-yellow-400 italic`}>Quotation Sent</th>
                  <th colSpan={2} className={`${thBase} bg-blue-600/20 text-blue-400`}>Order Confirmed</th>
                  <th className={`${thBase} bg-yellow-600/10`}>Total Amount</th>
                </tr>

                {/* ── Row 4: Column headers ── */}
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
                  groups.map(({ monthKey, monthLabel, rows }) => (
                    <>
                      {/* Month header row */}
                      <tr key={`month-${monthKey}`} className="bg-muted/30">
                        <td
                          colSpan={11}
                          className="border border-border px-3 py-1.5 font-bold text-sm"
                        >
                          {monthLabel}
                        </td>
                      </tr>

                      {/* Week rows */}
                      {rows.map((w, wi) => (
                        <tr
                          key={w.weekStart}
                          className={`hover:bg-muted/10 ${wi % 2 === 0 ? "" : "bg-muted/5"}`}
                        >
                          {/* Month label */}
                          <td className={`${tdBase} text-left font-medium`}>
                            {w.monthName} {w.weekOrdinal} Week
                          </td>

                          {/* Order Closed */}
                          <td className={`${tdBase} bg-green-900/10`}>{fmtCount(w.orderClosedCount)}</td>
                          <td className={`${tdBase} bg-green-900/10`}>{fmt(w.orderClosedAmount)}</td>

                          {/* Down Payment */}
                          <td className={`${tdBase} bg-green-900/5`}>{fmt(w.downPayment)}</td>

                          {/* Total Payment Receipt */}
                          <td className={`${tdBase} bg-green-900/5 font-medium`}>{fmt(w.totalPaymentReceipt)}</td>

                          {/* Gap */}
                          <td className="border border-border bg-muted/10" />

                          {/* Quotation Sent */}
                          <td className={`${tdBase} bg-yellow-900/10`}>{fmtCount(w.quotationSentCount)}</td>
                          <td className={`${tdBase} bg-yellow-900/10`}>{fmt(w.quotationSentAmount)}</td>

                          {/* Order Confirmed */}
                          <td className={`${tdBase} bg-blue-900/10`}>{fmtCount(w.orderConfirmedCount)}</td>
                          <td className={`${tdBase} bg-blue-900/10`}>{fmt(w.orderConfirmedAmount)}</td>

                          {/* Total Sales in Process */}
                          <td className={`${tdBase} bg-yellow-900/5 font-medium`}>{fmt(w.totalSalesInProcess)}</td>
                        </tr>
                      ))}
                    </>
                  ))
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
    </div>
  );
}
