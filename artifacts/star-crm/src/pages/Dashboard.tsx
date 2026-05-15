import { useGetMe, useGetReportSummary, useListDeals } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, DollarSign, Briefcase, TrendingUp, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { useCurrency } from "@/contexts/CurrencyContext";

export default function Dashboard() {
  const { data: me, isLoading: meLoading } = useGetMe();
  const { data: summary, isLoading: summaryLoading } = useGetReportSummary(
    me?.role === "salesperson" ? { salespersonId: me.id } : undefined,
    { query: { enabled: !!me } }
  );
  const { data: deals, isLoading: dealsLoading } = useListDeals(
    me?.role === "salesperson" ? { salespersonId: me.id } : undefined,
    { query: { enabled: !!me } }
  );

  const { formatAmount: formatCurrency } = useCurrency();

  if (meLoading || summaryLoading || dealsLoading) {
    return <div className="flex items-center justify-center h-full"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  const recentDeals = deals?.slice(0, 5) || [];

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Welcome back, {me?.name || me?.email}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Deals</CardTitle>
            <Briefcase className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="kpi-total-deals">{summary?.totalDeals || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Active in pipeline</p>
          </CardContent>
        </Card>

        <Card className="bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pipeline Value</CardTitle>
            <DollarSign className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="kpi-pipeline-value">{formatCurrency(summary?.totalAgreedAmount || 0)}</div>
            <p className="text-xs text-muted-foreground mt-1">Total agreed amount</p>
          </CardContent>
        </Card>

        <Card className="bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Received</CardTitle>
            <TrendingUp className="w-4 h-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500" data-testid="kpi-received">{formatCurrency(summary?.totalReceivedAmount || 0)}</div>
            <p className="text-xs text-muted-foreground mt-1">Revenue secured</p>
          </CardContent>
        </Card>

        <Card className="bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Outstanding</CardTitle>
            <AlertCircle className="w-4 h-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive" data-testid="kpi-outstanding">{formatCurrency(summary?.totalOutstandingAmount || 0)}</div>
            <p className="text-xs text-muted-foreground mt-1">Pending collection</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {recentDeals.length > 0 ? (
              <div className="space-y-4">
                {recentDeals.map(deal => (
                  <div key={deal.id} className="flex items-center justify-between p-4 border border-border rounded-lg">
                    <div>
                      <p className="font-medium">{deal.companyName}</p>
                      <p className="text-sm text-muted-foreground">{deal.name} &middot; {deal.productItem}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{formatCurrency(deal.agreedAmount)}</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(deal.createdAt), 'MMM d, yyyy')}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">No recent deals</div>
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Pipeline Health</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-sm font-medium">Avg Progress</span>
                  <span className="text-sm font-medium">{Math.round(summary?.avgProgress || 0)}%</span>
                </div>
                <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                  <div className="bg-primary h-full" style={{ width: `${summary?.avgProgress || 0}%` }}></div>
                </div>
              </div>
              <div className="pt-4 flex justify-between items-center border-t border-border">
                <span className="text-sm text-muted-foreground">Won Deals</span>
                <span className="font-bold text-green-500">{summary?.closedDeals || 0}</span>
              </div>
              <div className="flex justify-between items-center border-t border-border pt-4">
                <span className="text-sm text-muted-foreground">Lost Deals</span>
                <span className="font-bold text-destructive">{summary?.lostDeals || 0}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
