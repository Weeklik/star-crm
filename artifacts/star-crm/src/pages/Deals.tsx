import {
  useGetMe,
  useListDeals,
  useCreateDeal,
  useUpdateDeal,
  useDeleteDeal,
  getListDealsQueryKey,
} from "@workspace/api-client-react";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Search, MoreHorizontal, Pencil, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";

type Stage = "Quotation Sent" | "Order Confirmed" | "Order Closed" | "Order Lost";

const STAGES: Stage[] = [
  "Quotation Sent",
  "Order Confirmed",
  "Order Closed",
  "Order Lost",
];

interface DealFormState {
  dealStartDate: string;
  name: string;
  companyName: string;
  productItem: string;
  stage: Stage;
  progress: number;
  salesStatus: string;
  vatApplicable: boolean;
  agreedAmount: number;
  receivedAmount: number;
  outstandingAmount: number;
  earliestClosingDate: string;
  latestClosingDate: string;
  notes: string;
}

const emptyForm = (): DealFormState => ({
  dealStartDate: new Date().toISOString().split("T")[0],
  name: "",
  companyName: "",
  productItem: "",
  stage: "Quotation Sent",
  progress: 0,
  salesStatus: "Active",
  vatApplicable: false,
  agreedAmount: 0,
  receivedAmount: 0,
  outstandingAmount: 0,
  earliestClosingDate: "",
  latestClosingDate: "",
  notes: "",
});

function toPayload(f: DealFormState) {
  return {
    dealStartDate: f.dealStartDate,
    name: f.name,
    companyName: f.companyName,
    productItem: f.productItem,
    stage: f.stage,
    progress: Number(f.progress),
    salesStatus: f.salesStatus,
    vatApplicable: f.vatApplicable,
    agreedAmount: Number(f.agreedAmount),
    receivedAmount: Number(f.receivedAmount),
    outstandingAmount: Number(f.outstandingAmount),
    earliestClosingDate: f.earliestClosingDate || undefined,
    latestClosingDate: f.latestClosingDate || undefined,
    notes: f.notes || undefined,
  };
}

const getStageColor = (stage: string) => {
  switch (stage) {
    case "Quotation Sent": return "bg-blue-500/20 text-blue-500";
    case "Order Confirmed": return "bg-yellow-500/20 text-yellow-500";
    case "Order Closed": return "bg-green-500/20 text-green-500";
    case "Order Lost": return "bg-red-500/20 text-red-500";
    default: return "bg-gray-500/20 text-gray-500";
  }
};

const formatCurrency = (val: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(val);

export default function Deals() {
  const { data: me } = useGetMe();
  const queryClient = useQueryClient();

  const { data: deals, isLoading } = useListDeals(
    me?.role === "salesperson" ? { salespersonId: me.id } : undefined,
    { query: { enabled: !!me } }
  );

  const createDeal = useCreateDeal();
  const updateDeal = useUpdateDeal();
  const deleteDeal = useDeleteDeal();

  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<DealFormState>(emptyForm());
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const filteredDeals = deals?.filter(
    (d) =>
      d.companyName.toLowerCase().includes(search.toLowerCase()) ||
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.productItem.toLowerCase().includes(search.toLowerCase())
  );

  function openAdd() {
    setEditingId(null);
    setForm(emptyForm());
    setFormOpen(true);
  }

  function openEdit(deal: NonNullable<typeof deals>[number]) {
    setEditingId(deal.id);
    setForm({
      dealStartDate:
        deal.dealStartDate instanceof Date
          ? deal.dealStartDate.toISOString().split("T")[0]
          : String(deal.dealStartDate).split("T")[0],
      name: deal.name,
      companyName: deal.companyName,
      productItem: deal.productItem,
      stage: deal.stage as Stage,
      progress: deal.progress,
      salesStatus: deal.salesStatus,
      vatApplicable: deal.vatApplicable,
      agreedAmount: deal.agreedAmount,
      receivedAmount: deal.receivedAmount,
      outstandingAmount: deal.outstandingAmount,
      earliestClosingDate:
        deal.earliestClosingDate instanceof Date
          ? deal.earliestClosingDate.toISOString().split("T")[0]
          : deal.earliestClosingDate
          ? String(deal.earliestClosingDate).split("T")[0]
          : "",
      latestClosingDate:
        deal.latestClosingDate instanceof Date
          ? deal.latestClosingDate.toISOString().split("T")[0]
          : deal.latestClosingDate
          ? String(deal.latestClosingDate).split("T")[0]
          : "",
      notes: deal.notes ?? "",
    });
    setFormOpen(true);
  }

  function set<K extends keyof DealFormState>(key: K, value: DealFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    if (!form.name || !form.companyName || !form.productItem) return;
    setSaving(true);
    try {
      const payload = toPayload(form);
      if (editingId !== null) {
        await updateDeal.mutateAsync({ id: editingId, data: payload });
      } else {
        await createDeal.mutateAsync({ data: payload });
      }
      await queryClient.invalidateQueries({ queryKey: getListDealsQueryKey() });
      setFormOpen(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (deleteId === null) return;
    await deleteDeal.mutateAsync({ id: deleteId });
    await queryClient.invalidateQueries({ queryKey: getListDealsQueryKey() });
    setDeleteId(null);
  }

  if (isLoading)
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Deals</h1>
          <p className="text-muted-foreground mt-1">
            Manage your active pipeline and closed won/lost orders.
          </p>
        </div>
        <Button className="shrink-0" onClick={openAdd} data-testid="btn-add-deal">
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
              filteredDeals?.map((deal) => (
                <TableRow key={deal.id} data-testid={`row-deal-${deal.id}`}>
                  <TableCell className="font-medium">{deal.companyName}</TableCell>
                  <TableCell>{deal.name}</TableCell>
                  <TableCell className="text-muted-foreground">{deal.productItem}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`border-0 ${getStageColor(deal.stage)}`}
                    >
                      {deal.stage}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(deal.agreedAmount)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <span className="text-xs text-muted-foreground">{deal.progress}%</span>
                      <div className="w-16 h-1.5 bg-secondary rounded-full overflow-hidden">
                        <div
                          className="bg-primary h-full"
                          style={{ width: `${deal.progress}%` }}
                        />
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
                        <DropdownMenuItem
                          onClick={() => openEdit(deal)}
                          data-testid={`btn-edit-deal-${deal.id}`}
                        >
                          <Pencil className="w-4 h-4 mr-2" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => setDeleteId(deal.id)}
                          data-testid={`btn-delete-deal-${deal.id}`}
                        >
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

      {/* Add / Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId !== null ? "Edit Deal" : "Add Deal"}</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
            <div className="space-y-1.5">
              <Label>Deal Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="e.g. Q3 Enterprise Renewal"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Company Name *</Label>
              <Input
                value={form.companyName}
                onChange={(e) => set("companyName", e.target.value)}
                placeholder="e.g. Acme Corp"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Product / Item *</Label>
              <Input
                value={form.productItem}
                onChange={(e) => set("productItem", e.target.value)}
                placeholder="e.g. SaaS Pro Plan"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Start Date *</Label>
              <DatePicker
                value={form.dealStartDate}
                onChange={(v) => set("dealStartDate", v)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Stage</Label>
              <Select value={form.stage} onValueChange={(v) => set("stage", v as Stage)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STAGES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Sales Status</Label>
              <Input
                value={form.salesStatus}
                onChange={(e) => set("salesStatus", e.target.value)}
                placeholder="e.g. Active"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Progress ({form.progress}%)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={form.progress}
                onChange={(e) => set("progress", Math.min(100, Math.max(0, Number(e.target.value))))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Agreed Amount ($)</Label>
              <Input
                type="number"
                min={0}
                value={form.agreedAmount}
                onChange={(e) => set("agreedAmount", Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Received Amount ($)</Label>
              <Input
                type="number"
                min={0}
                value={form.receivedAmount}
                onChange={(e) => set("receivedAmount", Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Outstanding Amount ($)</Label>
              <Input
                type="number"
                min={0}
                value={form.outstandingAmount}
                onChange={(e) => set("outstandingAmount", Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Earliest Closing Date</Label>
              <DatePicker
                value={form.earliestClosingDate}
                onChange={(v) => set("earliestClosingDate", v)}
                placeholder="Pick a date"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Latest Closing Date</Label>
              <DatePicker
                value={form.latestClosingDate}
                onChange={(v) => set("latestClosingDate", v)}
                placeholder="Pick a date"
              />
            </div>
            <div className="sm:col-span-2 flex items-center gap-2">
              <Checkbox
                id="vat"
                checked={form.vatApplicable}
                onCheckedChange={(v) => set("vatApplicable", Boolean(v))}
              />
              <Label htmlFor="vat" className="cursor-pointer">
                VAT Applicable
              </Label>
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label>Notes</Label>
              <Textarea
                rows={3}
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
                placeholder="Any additional notes..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !form.name || !form.companyName || !form.productItem}
              data-testid="btn-save-deal"
            >
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {editingId !== null ? "Save Changes" : "Create Deal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Deal</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the deal. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="btn-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
