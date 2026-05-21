import { useGetMe, useGetReportSummary, useListDeals } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Briefcase, CheckCircle2, TrendingUp, Wallet, XCircle } from "lucide-react";
import { format } from "date-fns";
import { useCurrency } from "@/contexts/CurrencyContext";

interface KpiCardProps {
  title: string;
  count?: number;
  countLabel?: string;
  amount: string;
  amountLabel?: string;
  icon: React.ElementType;
  iconColor: string;
  accentColor: string;
  singleValue?: boolean;
}

function KpiCard({ title, count, countLabel, amount, amountLabel, icon: Icon, iconColor, accentColor, singleValue }: KpiCardProps) {
  return (
    <Card className="bg-card border-border/60">
      <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-5">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className={`p-1.5 rounded-md ${accentColor}`}>
          <Icon className={`w-4 h-4 ${iconColor}`} />
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-4">
        {singleValue ? (
          <div className={`text-2xl font-bold ${iconColor}`}>{amount}</div>
        ) : (
          <div className="flex items-end justify-between gap-2">
            <div>
              <div className="text-2xl font-bold">{count ?? 0}</div>
              {countLabel && <p className="text-xs text-muted-foreground mt-0.5">{countLabel}</p>}
            </div>
            <div className="text-right">
              <div className={`text-base font-semibold ${iconColor}`}>{amount}</div>
              {amountLabel && <p className="text-xs text-muted-foreground mt-0.5">{amountLabel}</p>}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

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

  const { formatAmount } = useCurrency();

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

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <KpiCard
          title="Total Deals"
          count={summary?.totalDeals ?? 0}
          countLabel="in pipeline"
          amount={formatAmount(summary?.totalAgreedAmount ?? 0)}
          amountLabel="total value"
          icon={Briefcase}
          iconColor="text-primary"
          accentColor="bg-primary/10"
        />
        <KpiCard
          title="Confirmed Orders"
          count={summary?.confirmedDeals ?? 0}
          countLabel="orders confirmed"
          amount={formatAmount(summary?.confirmedAmount ?? 0)}
          amountLabel="confirmed value"
          icon={CheckCircle2}
          iconColor="text-blue-400"
          accentColor="bg-blue-500/10"
        />
        <KpiCard
          title="Closed Orders"
          count={summary?.closedDeals ?? 0}
          countLabel="orders closed"
          amount={formatAmount(summary?.closedAmount ?? 0)}
          amountLabel="closed value"
          icon={TrendingUp}
          iconColor="text-emerald-400"
          accentColor="bg-emerald-500/10"
        />
        <KpiCard
          title="Received Amount"
          amount={formatAmount(summary?.totalReceivedAmount ?? 0)}
          amountLabel="revenue secured"
          icon={Wallet}
          iconColor="text-violet-400"
          accentColor="bg-violet-500/10"
          singleValue
        />
        <KpiCard
          title="Lost Orders"
          count={summary?.lostDeals ?? 0}
          countLabel="orders lost"
          amount={formatAmount(summary?.lostAmount ?? 0)}
          amountLabel="lost value"
          icon={XCircle}
          iconColor="text-destructive"
          accentColor="bg-destructive/10"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {recentDeals.length > 0 ? (
              <div className="space-y-3">
                {recentDeals.map(deal => (
                  <div key={deal.id} className="flex items-center justify-between p-4 border border-border rounded-lg">
                    <div>
                      <p className="font-medium">{deal.companyName}</p>
                      <p className="text-sm text-muted-foreground">{deal.name} &middot; {deal.productItem}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{formatAmount(deal.agreedAmount)}</p>
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
                <span className="text-sm text-muted-foreground">Closed Orders</span>
                <span className="font-bold text-emerald-400">{summary?.closedDeals || 0}</span>
              </div>
              <div className="flex justify-between items-center border-t border-border pt-4">
                <span className="text-sm text-muted-foreground">Confirmed Orders</span>
                <span className="font-bold text-blue-400">{summary?.confirmedDeals || 0}</span>
              </div>
              <div className="flex justify-between items-center border-t border-border pt-4">
                <span className="text-sm text-muted-foreground">Lost Orders</span>
                <span className="font-bold text-destructive">{summary?.lostDeals || 0}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
