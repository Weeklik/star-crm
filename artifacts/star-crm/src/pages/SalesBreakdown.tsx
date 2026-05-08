import { useGetMe } from "@workspace/api-client-react";
import { useState, useEffect } from "react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { Loader2, FileSpreadsheet, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  weekLabel: string;
  weekStart: string;
  weekEnd: string;
  byPerson: Record<number, number>;
}

interface Salesperson {
  id: number;
  name: string;
}

interface BreakdownData {
  weeks: WeekRow[];
  salespersons: Salesperson[];
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

function monthKey(year: number, month: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

export default function SalesBreakdown() {
  const { data: me } = useGetMe();
  const now = new Date();
  const currentYear = now.getFullYear();

  const [startYear, setStartYear] = useState(String(currentYear));
  const [startMonth, setStartMonth] = useState(String(0)); // 0-indexed
  const [endYear, setEndYear] = useState(String(currentYear));
  const [endMonth, setEndMonth] = useState(String(now.getMonth()));
  const [filterSpId, setFilterSpId] = useState<string>("all");
  const [data, setData] = useState<BreakdownData | null>(null);
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<UserOption[]>([]);

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

    const sDate = format(startOfMonth(new Date(parseInt(startYear), parseInt(startMonth), 1)), "yyyy-MM-dd");
    const eDate = format(endOfMonth(new Date(parseInt(endYear), parseInt(endMonth), 1)), "yyyy-MM-dd");

    const params = new URLSearchParams({ startDate: sDate, endDate: eDate });
    if (filterSpId && filterSpId !== "all") params.set("salespersonId", filterSpId);

    setLoading(true);
    fetch(`/api/reports/sales-breakdown?${params}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [me, startYear, startMonth, endYear, endMonth, filterSpId]);

  const yearOptions = Array.from({ length: 5 }, (_, i) => String(currentYear - i));

  // Column totals per salesperson
  const columnTotals: Record<number, number> = {};
  if (data) {
    for (const sp of data.salespersons) {
      columnTotals[sp.id] = data.weeks.reduce((s, w) => s + (w.byPerson[sp.id] ?? 0), 0);
    }
  }

  const handleExportCSV = () => {
    if (!data) return;
    let csv = "Week,Week Start,Week End";
    for (const sp of data.salespersons) csv += `,${sp.name}`;
    csv += "\n";
    for (const w of data.weeks) {
      csv += `${w.weekLabel},${w.weekStart},${w.weekEnd}`;
      for (const sp of data.salespersons) csv += `,${w.byPerson[sp.id] ?? 0}`;
      csv += "\n";
    }
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sales-breakdown-${startYear}-${String(parseInt(startMonth) + 1).padStart(2, "0")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Group weeks by month label for visual section headers
  const weeksByMonth: Array<{ monthLabel: string; weeks: WeekRow[] }> = [];
  if (data) {
    for (const w of data.weeks) {
      const d = new Date(w.weekStart);
      const label = `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
      const last = weeksByMonth[weeksByMonth.length - 1];
      if (last && last.monthLabel === label) {
        last.weeks.push(w);
      } else {
        weeksByMonth.push({ monthLabel: label, weeks: [w] });
      }
    }
  }

  return (
    <div className="p-6 max-w-full mx-auto space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sales Breakdown</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Week-by-week sales per salesperson across a month range.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="icon" onClick={handleExportCSV} title="Export CSV" disabled={!data}>
            <FileSpreadsheet className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => window.print()} title="Print / PDF">
            <Download className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 bg-card border border-border rounded-lg p-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground whitespace-nowrap">From</span>
          <Select value={startMonth} onValueChange={setStartMonth}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTH_NAMES.map((m, i) => (
                <SelectItem key={i} value={String(i)}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={startYear} onValueChange={setStartYear}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground whitespace-nowrap">To</span>
          <Select value={endMonth} onValueChange={setEndMonth}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTH_NAMES.map((m, i) => (
                <SelectItem key={i} value={String(i)}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={endYear} onValueChange={setEndYear}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {me?.role === "owner" && (
          <Select value={filterSpId} onValueChange={setFilterSpId}>
            <SelectTrigger className="w-48">
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
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            {data && `${MONTH_NAMES[parseInt(startMonth)]} ${startYear} – ${MONTH_NAMES[parseInt(endMonth)]} ${endYear}`}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : !data || data.weeks.length === 0 ? (
            <p className="text-center text-muted-foreground py-10">No data for this period.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-muted/60 border-b border-border">
                    <th className="px-3 py-2.5 text-left font-semibold whitespace-nowrap sticky left-0 bg-muted/60 min-w-[120px]">Week</th>
                    <th className="px-3 py-2.5 text-left font-semibold whitespace-nowrap text-muted-foreground">Dates</th>
                    {data.salespersons.map((sp) => (
                      <th key={sp.id} className="px-3 py-2.5 text-right font-semibold whitespace-nowrap">{sp.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {weeksByMonth.map(({ monthLabel, weeks }) => (
                    <>
                      <tr key={monthLabel} className="bg-primary/10 border-y border-border/60">
                        <td
                          colSpan={2 + (data?.salespersons.length ?? 0)}
                          className="px-3 py-1.5 text-xs font-semibold text-primary uppercase tracking-wide"
                        >
                          {monthLabel}
                        </td>
                      </tr>
                      {weeks.map((w, wi) => {
                        const rowTotal = data.salespersons.reduce((s, sp) => s + (w.byPerson[sp.id] ?? 0), 0);
                        return (
                          <tr key={w.weekLabel + w.weekStart} className={`border-b border-border/40 hover:bg-muted/20 ${wi % 2 === 0 ? "" : "bg-muted/10"}`}>
                            <td className="px-3 py-2 font-medium whitespace-nowrap sticky left-0 bg-card">{w.weekLabel}</td>
                            <td className="px-3 py-2 text-muted-foreground text-xs whitespace-nowrap">
                              {format(new Date(w.weekStart), "d MMM")} – {format(new Date(w.weekEnd), "d MMM")}
                            </td>
                            {data.salespersons.map((sp) => (
                              <td key={sp.id} className="px-3 py-2 text-right">
                                {fmt(w.byPerson[sp.id] ?? 0)}
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border bg-muted/40 font-semibold">
                    <td className="px-3 py-2 sticky left-0 bg-muted/40" colSpan={2}>Total</td>
                    {data.salespersons.map((sp) => (
                      <td key={sp.id} className="px-3 py-2 text-right">{fmt(columnTotals[sp.id] ?? 0)}</td>
                    ))}
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
