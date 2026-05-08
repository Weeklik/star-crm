import { useGetMe, useListDeals, useCreateDeal, useUpdateDeal, useDeleteDeal, getListDealsQueryKey } from "@workspace/api-client-react";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Plus, Search, MoreHorizontal, Pencil, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

export default function Deals() {
  const { data: me } = useGetMe();
  const { data: deals, isLoading } = useListDeals(
    me?.role === "salesperson" ? { salespersonId: me.id } : undefined,
    { query: { enabled: !!me } }
  );
  
  const [search, setSearch] = useState("");

  const filteredDeals = deals?.filter(d => 
    d.companyName.toLowerCase().includes(search.toLowerCase()) || 
    d.name.toLowerCase().includes(search.toLowerCase()) ||
    d.productItem.toLowerCase().includes(search.toLowerCase())
  );

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);
  };

  const getStageColor = (stage: string) => {
    switch (stage) {
      case 'Quotation Sent': return 'bg-blue-500/20 text-blue-500';
      case 'Order Confirmed': return 'bg-yellow-500/20 text-yellow-500';
      case 'Order Closed': return 'bg-green-500/20 text-green-500';
      case 'Order Lost': return 'bg-red-500/20 text-red-500';
      default: return 'bg-gray-500/20 text-gray-500';
    }
  };

  if (isLoading) return <div className="flex items-center justify-center h-full"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Deals</h1>
          <p className="text-muted-foreground mt-1">Manage your active pipeline and closed won/lost orders.</p>
        </div>
        <Button className="shrink-0" data-testid="btn-add-deal">
          <Plus className="w-4 h-4 mr-2" />
          Add Deal
        </Button>
      </div>

      <div className="flex items-center gap-2 max-w-md">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search company, contact, or product..." 
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="input-search-deals"
          />
        </div>
      </div>

      <div className="border border-border rounded-lg bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-secondary/50">
              <TableHead>Company</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Stage</TableHead>
              <TableHead className="text-right">Value</TableHead>
              <TableHead className="text-right">Progress</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredDeals?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No deals found
                </TableCell>
              </TableRow>
            ) : (
              filteredDeals?.map(deal => (
                <TableRow key={deal.id} data-testid={`row-deal-${deal.id}`}>
                  <TableCell className="font-medium">{deal.companyName}</TableCell>
                  <TableCell>{deal.name}</TableCell>
                  <TableCell className="text-muted-foreground">{deal.productItem}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`border-0 ${getStageColor(deal.stage)}`}>
                      {deal.stage}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(deal.agreedAmount)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <span className="text-xs text-muted-foreground">{deal.progress}%</span>
                      <div className="w-16 h-1.5 bg-secondary rounded-full overflow-hidden">
                        <div className="bg-primary h-full" style={{ width: `${deal.progress}%` }}></div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem data-testid={`btn-edit-deal-${deal.id}`}>
                          <Pencil className="w-4 h-4 mr-2" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" data-testid={`btn-delete-deal-${deal.id}`}>
                          <Trash2 className="w-4 h-4 mr-2" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
