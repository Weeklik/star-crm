import { useGetMe } from "@workspace/api-client-react";
import { useState, useEffect } from "react";
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

function fmt(n: number) {
  if (!n) return "-";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);
}

export default function SummarySalesReport() {
  const { data: me } = useGetMe();
  const currentYear = new Date().getFullYear();

  const [year, setYear] = useState(String(currentYear));
  const [summaryStart, setSummaryStart] = useState("");
  const [summaryEnd, setSummaryEnd] = useState("");
  const [filterSpId, setFilterSpId] = useState<string>("all");
  const [rows, setRows] = useState<SalespersonRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<UserOption[]>([]);

  // fetch users for owner filter
  useEffect(() => {
    if (me?.role === "owner") {
      fetch("/api/users")
        .then((r) => r.json())
        .then(setUsers)
        .catch(() => {});
    }
  }, [me]);

  useEffect(() => {
    if (!me) return;
    const params = new URLSearchParams({ year });
    if (summaryStart) params.set("summaryStart", summaryStart);
    if (summaryEnd) params.set("summaryEnd", summaryEnd);
    if (filterSpId && filterSpId !== "all") params.set("salespersonId", filterSpId);

    setLoading(true);
    fetch(`/api/reports/summary-sales?${params}`)
      .then((r) => r.json())
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [me, year, summaryStart, summaryEnd, filterSpId]);

  const yearOptions = Array.from({ length: 5 }, (_, i) => String(currentYear - i));

  // column totals
  const totalSalesSum = rows.reduce((s, r) => s + r.totalSales, 0);
  const monthlyTotals: Record<number, number> = {};
  for (let m = 1; m <= 12; m++) {
    monthlyTotals[m] = rows.reduce((s, r) => s + (r.monthly[m] ?? 0), 0);
  }
  const summaryTotalSum = rows.reduce((s, r) => s + r.summaryTotal, 0);
  const summaryQuotationSum = rows.reduce((s, r) => s + r.summaryQuotation, 0);
  const summaryOrderConfirmedSum = rows.reduce((s, r) => s + r.summaryOrderConfirmed, 0);

  const hasSummary = summaryStart && summaryEnd;
  const summaryLabel = hasSummary
    ? `${format(new Date(summaryStart), "d MMM")} – ${format(new Date(summaryEnd), "d MMM")}`
    : "Summary Period";

  const handleExportCSV = () => {
    let csv = "Summary Sales Report\n";
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
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `summary-sales-${year}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 max-w-full mx-auto space-y-4 print:p-2">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Summary Sales Report</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Year-to-date sales per salesperson with monthly breakdown.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((y) => (
                <SelectItem key={y} value={y}>{y}</SelectItem>
              ))}
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
                  <SelectItem key={u.id} value={String(u.id)}>
                    {u.name || u.email}
                  </SelectItem>
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
          <CardTitle className="text-base print:text-center print:text-xl">Summary Sales Report {year}</CardTitle>
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
                    <th className="px-3 py-2.5 text-right font-semibold whitespace-nowrap">Avg Monthly Sales {year}</th>
                    <th className="px-3 py-2.5 text-right font-semibold whitespace-nowrap">Total Sales {year}</th>
                    {MONTHS.map((m) => (
                      <th key={m} className="px-3 py-2.5 text-right font-semibold whitespace-nowrap">{m} {year}</th>
                    ))}
                    {hasSummary && (
                      <>
                        <th className="px-3 py-2.5 text-right font-semibold whitespace-nowrap bg-blue-500/10 border-l border-border" colSpan={3}>
                          Summary {summaryLabel}
                        </th>
                      </>
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
                      <td colSpan={3 + 12 + (hasSummary ? 3 : 0)} className="text-center py-10 text-muted-foreground">
                        No data for this period.
                      </td>
                    </tr>
                  ) : (
                    rows.map((row, i) => (
                      <tr key={row.salespersonId} className={`border-b border-border/50 hover:bg-muted/20 ${i % 2 === 0 ? "" : "bg-muted/10"}`}>
                        <td className="px-3 py-2 font-medium whitespace-nowrap sticky left-0 bg-card">{row.name}</td>
                        <td className="px-3 py-2 text-right">{fmt(Math.round(row.avgMonthlySales))}</td>
                        <td className="px-3 py-2 text-right font-medium">{fmt(row.totalSales)}</td>
                        {Array.from({ length: 12 }, (_, idx) => (
                          <td key={idx + 1} className="px-3 py-2 text-right text-muted-foreground">
                            {fmt(row.monthly[idx + 1] ?? 0)}
                          </td>
                        ))}
                        {hasSummary && (
                          <>
                            <td className="px-3 py-2 text-right bg-blue-500/5 border-l border-border">{fmt(row.summaryTotal)}</td>
                            <td className="px-3 py-2 text-right bg-blue-500/5">{fmt(row.summaryQuotation)}</td>
                            <td className="px-3 py-2 text-right bg-blue-500/5">{fmt(row.summaryOrderConfirmed)}</td>
                          </>
                        )}
                      </tr>
                    ))
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
