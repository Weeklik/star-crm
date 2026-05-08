import { useGetMe, useGetReportSummary, useGetStageBreakdown, useGetWeeklyReport, useGetReportBySalesperson } from "@workspace/api-client-react";
import { useState } from "react";
import { format, subDays } from "date-fns";
import { Loader2, Download, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

function CardSkeleton() {
  return <Skeleton className="h-24 w-full rounded-xl" />;
}

export default function Reports() {
  const { data: me } = useGetMe();

  const [startDate, setStartDate] = useState(format(subDays(new Date(), 90), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));

  const queryParams = {
    startDate,
    endDate,
    ...(me?.role === "salesperson" ? { salespersonId: me.id } : {}),
  };

  const { data: summary, isLoading: sLoading } = useGetReportSummary(queryParams, { query: { enabled: !!me } });
  const { data: stageBreakdown, isLoading: sbLoading } = useGetStageBreakdown(queryParams, { query: { enabled: !!me } });
  const { data: weekly, isLoading: wLoading } = useGetWeeklyReport({ weeks: 12 }, { query: { enabled: !!me } });
  const { data: salespersons, isLoading: spLoading } = useGetReportBySalesperson(
    { startDate, endDate },
    { query: { enabled: me?.role === "owner" } }
  );

  const handleExportPDF = () => window.print();

  const handleExportCSV = () => {
    let csv = "Metrics,Value\n";
    csv += `Total Deals,${summary?.totalDeals || 0}\n`;
    csv += `Total Pipeline,${summary?.totalAgreedAmount || 0}\n`;
    csv += `Total Received,${summary?.totalReceivedAmount || 0}\n`;
    csv += `Total Outstanding,${summary?.totalOutstandingAmount || 0}\n`;
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `star-crm-report-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 print:p-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
          <p className="text-muted-foreground mt-1">Analytics and performance tracking.</p>
        </div>
        <div className="flex items-center gap-2">
          <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-40" />
          <span className="text-muted-foreground">to</span>
          <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-40" />
          <Button variant="outline" size="icon" onClick={handleExportCSV} title="Export CSV">
            <FileSpreadsheet className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={handleExportPDF} title="Export PDF">
            <Download className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {sLoading ? (
          <>
            <CardSkeleton /><CardSkeleton /><CardSkeleton /><CardSkeleton />
          </>
        ) : (
          <>
            <Card className="bg-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Pipeline</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{fmt(summary?.totalAgreedAmount ?? 0)}</div>
                <p className="text-xs text-muted-foreground mt-1">{summary?.totalDeals ?? 0} deals</p>
              </CardContent>
            </Card>
            <Card className="bg-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Received</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-500">{fmt(summary?.totalReceivedAmount ?? 0)}</div>
              </CardContent>
            </Card>
            <Card className="bg-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Outstanding</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-destructive">{fmt(summary?.totalOutstandingAmount ?? 0)}</div>
              </CardContent>
            </Card>
            <Card className="bg-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Win Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {summary?.totalDeals ? Math.round((summary.closedDeals / summary.totalDeals) * 100) : 0}%
                </div>
                <p className="text-xs text-muted-foreground mt-1">{summary?.closedDeals ?? 0} closed</p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Stage Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Stage Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          {sbLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <div className="flex gap-4 items-end h-40">
              {stageBreakdown?.map(stage => (
                <div key={stage.stage} className="flex-1 flex flex-col justify-end items-center gap-2">
                  <div
                    className="w-full bg-primary rounded-t-sm transition-all"
                    style={{ height: `${Math.max((stage.count / (summary?.totalDeals || 1)) * 100, 4)}%` }}
                  />
                  <div className="text-xs text-muted-foreground text-center truncate w-full">{stage.stage}</div>
                  <div className="text-sm font-bold">{stage.count}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Weekly Trend */}
      <Card>
        <CardHeader>
          <CardTitle>Weekly Trend (last 12 weeks)</CardTitle>
        </CardHeader>
        <CardContent>
          {wLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <div className="flex gap-2 items-end h-40">
              {weekly?.map(week => {
                const maxDeals = Math.max(...(weekly?.map(w => w.newDeals) ?? [1]), 1);
                return (
                  <div key={week.weekLabel} className="flex-1 flex flex-col justify-end items-center gap-1">
                    <div
                      className="w-full bg-primary/60 rounded-t-sm transition-all"
                      style={{ height: `${Math.max((week.newDeals / maxDeals) * 100, week.newDeals > 0 ? 6 : 0)}%` }}
                    />
                    <div className="text-xs text-muted-foreground">{week.weekLabel}</div>
                    <div className="text-xs font-medium">{week.newDeals}</div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Salesperson Breakdown (owner only) */}
      {me?.role === "owner" && (
        <Card>
          <CardHeader>
            <CardTitle>Per Salesperson</CardTitle>
          </CardHeader>
          <CardContent>
            {spLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : salespersons?.length === 0 ? (
              <p className="text-muted-foreground text-sm">No data for this period.</p>
            ) : (
              <div className="space-y-3">
                {salespersons?.map(sp => (
                  <div key={sp.salespersonId} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div>
                      <div className="font-medium">{sp.salespersonName ?? sp.email}</div>
                      <div className="text-xs text-muted-foreground">{sp.totalDeals} deals · {sp.closedDeals} closed</div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">{fmt(sp.totalAgreedAmount)}</div>
                      <div className="text-xs text-green-500">{fmt(sp.totalReceivedAmount)} received</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
