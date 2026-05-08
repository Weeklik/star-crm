import { useGetMe, useGetReportSummary, useGetStageBreakdown, useGetWeeklyReport, useGetReportBySalesperson } from "@workspace/api-client-react";
import { useState } from "react";
import { format, subDays } from "date-fns";
import { Loader2, Download, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function Reports() {
  const { data: me } = useGetMe();
  
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));

  const queryParams = { 
    startDate, 
    endDate,
    ...(me?.role === "salesperson" ? { salespersonId: me.id } : {})
  };

  const { data: summary, isLoading: sLoading } = useGetReportSummary(queryParams, { query: { enabled: !!me } });
  const { data: stageBreakdown, isLoading: sbLoading } = useGetStageBreakdown(queryParams, { query: { enabled: !!me } });
  const { data: weekly, isLoading: wLoading } = useGetWeeklyReport({ ...queryParams, weeks: 12 }, { query: { enabled: !!me } });
  const { data: salespersons, isLoading: spLoading } = useGetReportBySalesperson(
    { startDate, endDate }, 
    { query: { enabled: me?.role === "owner" } }
  );

  const isLoading = sLoading || sbLoading || wLoading || (me?.role === "owner" && spLoading);

  const handleExportPDF = () => {
    window.print();
  };

  const handleExportCSV = () => {
    // Basic CSV export
    let csv = "Metrics,Value\n";
    csv += `Total Deals,${summary?.totalDeals || 0}\n`;
    csv += `Total Pipeline,${summary?.totalAgreedAmount || 0}\n`;
    csv += `Total Received,${summary?.totalReceivedAmount || 0}\n`;
    csv += `Total Outstanding,${summary?.totalOutstandingAmount || 0}\n`;
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `star-crm-report-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (isLoading) return <div className="flex items-center justify-center h-full"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 print:p-0">
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

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6" id="printable-report">
        <Card className="bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Pipeline</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${summary?.totalAgreedAmount?.toLocaleString() || 0}</div>
          </CardContent>
        </Card>
        <Card className="bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Received Amount</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">${summary?.totalReceivedAmount?.toLocaleString() || 0}</div>
          </CardContent>
        </Card>
        <Card className="bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Outstanding</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">${summary?.totalOutstandingAmount?.toLocaleString() || 0}</div>
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
          </CardContent>
        </Card>
        
        <Card className="md:col-span-4">
          <CardHeader>
            <CardTitle>Stages Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 items-end h-40">
              {stageBreakdown?.map(stage => (
                <div key={stage.stage} className="flex-1 flex flex-col justify-end items-center gap-2">
                  <div 
                    className="w-full bg-primary rounded-t-sm transition-all"
                    style={{ height: `${Math.max((stage.count / (summary?.totalDeals || 1)) * 100, 5)}%` }}
                  ></div>
                  <div className="text-xs text-muted-foreground text-center truncate w-full">{stage.stage}</div>
                  <div className="text-sm font-bold">{stage.count}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
