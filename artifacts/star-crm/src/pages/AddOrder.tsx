import { useState, useEffect, useCallback } from "react";
import { useLocation, useRoute } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, ChevronLeft, ClipboardList } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AutocompleteInput } from "@/components/ui/autocomplete-input";
import {
  useCreateDeal,
  useUpdateDeal,
  useListDeals,
  getListDealsQueryKey,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { DatePicker } from "@/components/ui/date-picker";

interface OrderItem {
  id: string;
  brand: string;
  model: string;
  description: string;
  qty: number;
  unitPrice: number;
  discountPct: number;
  vatPct: number;
}

interface CatalogProduct {
  id: number;
  brand: string;
  model: string | null;
  description: string | null;
  origin: string | null;
}

const STAGES = [
  "Quotation Sent",
  "Order Confirmed",
  "Order Closed",
  "Order Lost",
  "Sales Return",
] as const;

const SALES_CHANCE_OPTIONS = [100, 90, 25, 0];

const STAGE_TO_SALES_CHANCE: Record<string, number> = {
  "Quotation Sent": 25,
  "Order Confirmed": 90,
  "Order Closed": 100,
  "Order Lost": 0,
};

const PAYMENT_TERMS = [
  "30 Days",
  "60 Days",
  "90 Days",
  "100% Advance",
  "50% Advance",
  "Net 30",
  "Net 60",
];
const WARRANTY_OPTIONS = [
  "6 Months",
  "1 Year",
  "2 Years",
  "3 Years",
  "5 Years",
  "No Warranty",
];
const DELIVERY_TERMS = ["FOB Dubai", "CIF", "EXW", "DDP", "DAP", "CFR"];
const REGIONS = [
  "Abu Dhabi",
  "Dubai",
  "Sharjah",
  "Ajman",
  "Umm Al Quwain",
  "Ras Al Khaimah",
  "Fujairah",
  "Qatar",
];

const CREDIT_TERMS = [
  "30 Days",
  "60 Days",
  "90 Days",
  "100% Advance",
  "50% Advance",
  "Net 30",
];

function newItem(): OrderItem {
  return {
    id: crypto.randomUUID(),
    brand: "",
    model: "",
    description: "",
    qty: 1,
    unitPrice: 0,
    discountPct: 0,
    vatPct: 5,
  };
}

function fmt(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function AddOrder() {
  const [, navigate] = useLocation();
  const [matchEdit, paramsEdit] = useRoute("/orders/:id/edit");
  const editId = matchEdit && paramsEdit?.id ? parseInt(paramsEdit.id) : null;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [mounted, setMounted] = useState(false);
  useEffect(() => { const id = requestAnimationFrame(() => setMounted(true)); return () => cancelAnimationFrame(id); }, []);

  // Form state
  const [customerName, setCustomerName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [region, setRegion] = useState("");
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split("T")[0]);
  const [closingDate, setClosingDate] = useState("");
  const [stage, setStage] = useState<string>("Quotation Sent");
  const [salesChancePct, setSalesChancePct] = useState(25);
  const [transportationFee, setTransportationFee] = useState(0);
  const [paymentTerms, setPaymentTerms] = useState("");
  const [warranty, setWarranty] = useState("");
  const [deliveryTerms, setDeliveryTerms] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<OrderItem[]>([newItem()]);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Catalog state: brand → products
  const [catalogByBrand, setCatalogByBrand] = useState<
    Record<string, CatalogProduct[]>
  >({});

  // Fetch existing deal for edit mode
  const { data: dealsData } = useListDeals({});

  useEffect(() => {
    if (!editId || !dealsData || loaded) return;
    const deal = (dealsData as any[]).find((d: any) => d.id === editId);
    if (!deal) return;

    setCustomerName(deal.name ?? "");
    setCompanyName(deal.companyName ?? "");
    setRegion(deal.region ?? "");
    setOrderDate(String(deal.dealStartDate ?? "").split("T")[0] || new Date().toISOString().split("T")[0]);
    setClosingDate(deal.earliestClosingDate ? String(deal.earliestClosingDate).split("T")[0] : "");
    setStage(deal.stage ?? "Quotation Sent");
    const pct = parseInt(String(deal.salesStatus).replace("%", "")) || 25;
    setSalesChancePct(pct);
    setTransportationFee(deal.transportationFee ?? 0);
    setPaymentTerms(deal.paymentTerms ?? "");
    setWarranty(deal.warranty ?? "");
    setDeliveryTerms(deal.deliveryTerms ?? "");
    setNotes(deal.notes ?? "");

    const dealItems = deal.items;
    if (Array.isArray(dealItems) && dealItems.length > 0) {
      setItems(
        dealItems.map((it: any) => ({ ...it, id: crypto.randomUUID() }))
      );
    } else {
      setItems([
        {
          id: crypto.randomUUID(),
          brand: deal.brand ?? "",
          model: deal.model ?? "",
          description: deal.productItem ?? "",
          qty: deal.quantity ?? 1,
          unitPrice: deal.agreedAmount ?? 0,
          discountPct: 0,
          vatPct: deal.vatApplicable ? 5 : 0,
        },
      ]);
    }
    setLoaded(true);
  }, [editId, dealsData, loaded]);

  // Fetch catalog models for a brand
  const fetchCatalogForBrand = useCallback(
    async (brand: string) => {
      if (!brand.trim() || catalogByBrand[brand] !== undefined) return;
      try {
        const res = await fetch(
          `/api/products-catalog/lookup?brand=${encodeURIComponent(brand)}`
        );
        if (res.ok) {
          const data = await res.json();
          setCatalogByBrand((prev) => ({
            ...prev,
            [brand]: Array.isArray(data) ? data : [],
          }));
        }
      } catch {
        // non-critical
      }
    },
    [catalogByBrand]
  );

  // Computed amounts
  const subTotal = items.reduce((s, it) => s + it.qty * it.unitPrice, 0);
  const totalDiscount = items.reduce(
    (s, it) => s + it.qty * it.unitPrice * (it.discountPct / 100),
    0
  );
  const totalVat = items.reduce((s, it) => {
    const base = it.qty * it.unitPrice * (1 - it.discountPct / 100);
    return s + base * (it.vatPct / 100);
  }, 0);
  const grandTotal = subTotal - totalDiscount + totalVat + transportationFee;

  function itemLineTotal(it: OrderItem) {
    const base = it.qty * it.unitPrice * (1 - it.discountPct / 100);
    return base * (1 + it.vatPct / 100);
  }

  // Item mutations
  const addItem = () => setItems((prev) => [...prev, newItem()]);
  const removeItem = (id: string) =>
    setItems((prev) => prev.filter((it) => it.id !== id));

  const updateItem = useCallback(
    (id: string, key: keyof OrderItem, value: string | number) => {
      setItems((prev) =>
        prev.map((it) => {
          if (it.id !== id) return it;
          const updated = { ...it, [key]: value };
          if (key === "brand") {
            updated.model = "";
            updated.description = "";
            if (String(value).trim()) fetchCatalogForBrand(String(value));
          }
          if (key === "model" && it.brand) {
            const prods = catalogByBrand[it.brand] ?? [];
            const found = prods.find((p) => p.model === value);
            if (found?.description) updated.description = found.description;
          }
          return updated;
        })
      );
    },
    [catalogByBrand, fetchCatalogForBrand]
  );

  // API
  const createDeal = useCreateDeal();
  const updateDeal = useUpdateDeal();

  async function handleSubmit() {
    if (!customerName.trim()) {
      toast({ title: "Customer Name is required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const firstItem = items[0] ?? {
        brand: "",
        model: "",
        description: "",
        qty: 1,
        unitPrice: 0,
        discountPct: 0,
        vatPct: 5,
      };
      const payload = {
        dealStartDate: orderDate,
        name: customerName,
        companyName: companyName || customerName,
        productItem: firstItem.description || firstItem.brand || "N/A",
        stage,
        salesStatus: `${salesChancePct}%`,
        vatApplicable: items.some((it) => it.vatPct > 0),
        agreedAmount: grandTotal,
        receivedAmount: 0,
        outstandingAmount: grandTotal,
        earliestClosingDate: closingDate || null,
        region: region || null,
        notes: notes || null,
        brand: firstItem.brand || null,
        model: firstItem.model || null,
        quantity: firstItem.qty,
        // new fields
        items,
        transportationFee,
        paymentTerms: paymentTerms || null,
        warranty: warranty || null,
        deliveryTerms: deliveryTerms || null,
      } as any;

      if (editId !== null) {
        await updateDeal.mutateAsync({ id: editId, data: payload });
        toast({ title: "Order updated successfully" });
      } else {
        await createDeal.mutateAsync({ data: payload });
        toast({ title: "Order created successfully" });
      }
      await queryClient.invalidateQueries({ queryKey: getListDealsQueryKey() });
      navigate("/deals");
    } catch (err: any) {
      toast({
        title: "Failed to save order",
        description: err?.message ?? "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className={`min-h-screen bg-background transition-all duration-500 ease-out ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"}`}
    >
      {/* ── Header ── */}
      <div
        className="flex items-center justify-between px-6 py-4"
        style={{ backgroundColor: "#0f2449" }}
      >
        <div className="flex items-center gap-3 text-white">
          <ClipboardList className="w-5 h-5" />
          <span className="text-lg font-bold tracking-widest">ORDERS</span>
        </div>
        <button
          onClick={() => navigate("/deals")}
          className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded text-sm font-medium transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>
      </div>

      {/* ── Content ── */}
      <div className="p-4 space-y-4">

        {/* ── Top 3-column section ── */}
        <div className="grid grid-cols-3 gap-4">

          {/* Customer Details */}
          <div className="bg-card border border-border rounded-lg p-4">
            <h2 className="text-blue-600 dark:text-blue-400 font-bold text-xs mb-4 uppercase tracking-wide">
              Customer Details
            </h2>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <label className="text-sm text-muted-foreground w-32 shrink-0">Customer Name</label>
                <AutocompleteInput
                  value={customerName}
                  onChange={setCustomerName}
                  lookupType="customer"
                  placeholder="Customer Name"
                  className="flex-1"
                />
              </div>
              <div className="flex items-center gap-3">
                <label className="text-sm text-muted-foreground w-32 shrink-0">Company Name</label>
                <AutocompleteInput
                  value={companyName}
                  onChange={setCompanyName}
                  lookupType="company"
                  placeholder="Company Name"
                  className="flex-1"
                />
              </div>
              <div className="flex items-center gap-3">
                <label className="text-sm text-muted-foreground w-32 shrink-0">Region / Country</label>
                <Select value={region} onValueChange={setRegion}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select region" />
                  </SelectTrigger>
                  <SelectContent>
                    {REGIONS.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Order Details */}
          <div className="bg-card border border-border rounded-lg p-4">
            <h2 className="text-blue-600 dark:text-blue-400 font-bold text-xs mb-4 uppercase tracking-wide">
              Order Details
            </h2>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <label className="text-sm text-muted-foreground w-44 shrink-0">Order Date</label>
                <DatePicker
                  value={orderDate}
                  onChange={(v) => setOrderDate(v ?? "")}
                  className="flex-1"
                />
              </div>
              <div className="flex items-center gap-3">
                <label className="text-sm text-muted-foreground w-44 shrink-0">Expected Closing Date</label>
                <DatePicker
                  value={closingDate}
                  onChange={(v) => setClosingDate(v ?? "")}
                  className="flex-1"
                />
              </div>
              <div className="flex items-center gap-3">
                <label className="text-sm text-muted-foreground w-44 shrink-0">Order Status</label>
                <Select
                  value={stage}
                  onValueChange={(v) => {
                    setStage(v);
                    if (STAGE_TO_SALES_CHANCE[v] !== undefined) {
                      setSalesChancePct(STAGE_TO_SALES_CHANCE[v]);
                    }
                  }}
                >
                  <SelectTrigger className="flex-1">
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
              <div className="flex items-center gap-3">
                <label className="text-sm text-muted-foreground w-44 shrink-0">Sales Chance (%)</label>
                <Select
                  value={String(salesChancePct)}
                  onValueChange={(v) => setSalesChancePct(Number(v))}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SALES_CHANCE_OPTIONS.map((opt) => (
                      <SelectItem key={opt} value={String(opt)}>
                        {opt}%
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Amount Summary */}
          <div className="bg-card border border-border rounded-lg p-4">
            <h2 className="text-blue-600 dark:text-blue-400 font-bold text-xs mb-4 uppercase tracking-wide">
              Amount Summary
            </h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Sub Total</span>
                <span className="font-medium tabular-nums">{fmt(subTotal)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Discount</span>
                <span className="font-medium tabular-nums">{fmt(totalDiscount)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">VAT (5%)</span>
                <span className="font-medium tabular-nums">{fmt(totalVat)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Delivery Charges</span>
                <Input
                  type="number"
                  min={0}
                  value={transportationFee || ""}
                  placeholder="0"
                  onChange={(e) =>
                    setTransportationFee(parseFloat(e.target.value) || 0)
                  }
                  className="w-28 text-right h-8 text-sm"
                />
              </div>
              <div className="border-t border-border pt-3 flex justify-between items-center">
                <span className="text-blue-600 dark:text-blue-400 font-bold text-sm uppercase">Grand Total</span>
                <span className="text-blue-600 dark:text-blue-400 font-bold text-xl tabular-nums">
                  {fmt(grandTotal)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Product / Items ── */}
        <div className="bg-card border border-border rounded-lg p-4">
          <h2 className="text-blue-600 dark:text-blue-400 font-bold text-xs mb-4 uppercase tracking-wide">
            Product / Items
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse min-w-[900px]">
              <thead>
                <tr style={{ backgroundColor: "#0f2449" }} className="text-white">
                  <th className="px-3 py-2.5 text-center font-medium w-12">S.No.</th>
                  <th className="px-3 py-2.5 text-center font-medium w-36">Brand</th>
                  <th className="px-3 py-2.5 text-center font-medium w-36">Model</th>
                  <th className="px-3 py-2.5 text-center font-medium">Description</th>
                  <th className="px-3 py-2.5 text-center font-medium w-16">Qty</th>
                  <th className="px-3 py-2.5 text-center font-medium w-28">Unit Price</th>
                  <th className="px-3 py-2.5 text-center font-medium w-24">Discount (%)</th>
                  <th className="px-3 py-2.5 text-center font-medium w-20">VAT (%)</th>
                  <th className="px-3 py-2.5 text-center font-medium w-28">Total Amount</th>
                  <th className="px-3 py-2.5 text-center font-medium w-16">Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => {
                  const brandProds = catalogByBrand[item.brand] ?? [];
                  const total = itemLineTotal(item);
                  return (
                    <tr
                      key={item.id}
                      className={idx % 2 === 0 ? "bg-card" : "bg-muted/30"}
                    >
                      <td className="px-3 py-1.5 text-center text-muted-foreground text-xs">
                        {idx + 1}
                      </td>
                      <td className="px-2 py-1">
                        <AutocompleteInput
                          value={item.brand}
                          onChange={(v) => updateItem(item.id, "brand", v)}
                          lookupType="catalog-brand"
                          placeholder="Brand"
                          className="w-full"
                        />
                      </td>
                      <td className="px-2 py-1">
                        {brandProds.length > 0 ? (
                          <Select
                            value={item.model || "__none__"}
                            onValueChange={(v) =>
                              updateItem(item.id, "model", v === "__none__" ? "" : v)
                            }
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Model" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">— Select —</SelectItem>
                              {brandProds.map((p, i) => (
                                <SelectItem
                                  key={i}
                                  value={p.model ?? `m-${i}`}
                                >
                                  {p.model ?? "(no model)"}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            value={item.model}
                            onChange={(e) =>
                              updateItem(item.id, "model", e.target.value)
                            }
                            placeholder="Model"
                            className="w-full"
                          />
                        )}
                      </td>
                      <td className="px-2 py-1">
                        <Input
                          value={item.description}
                          onChange={(e) =>
                            updateItem(item.id, "description", e.target.value)
                          }
                          placeholder="Description"
                          className="w-full"
                        />
                      </td>
                      <td className="px-2 py-1">
                        <Input
                          type="number"
                          min={1}
                          value={item.qty}
                          onChange={(e) =>
                            updateItem(item.id, "qty", parseInt(e.target.value) || 1)
                          }
                          className="w-full text-center"
                        />
                      </td>
                      <td className="px-2 py-1">
                        <Input
                          type="number"
                          min={0}
                          value={item.unitPrice || ""}
                          placeholder="0"
                          onChange={(e) =>
                            updateItem(
                              item.id,
                              "unitPrice",
                              parseFloat(e.target.value) || 0
                            )
                          }
                          className="w-full text-right"
                        />
                      </td>
                      <td className="px-2 py-1">
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={item.discountPct || ""}
                          placeholder="0"
                          onChange={(e) =>
                            updateItem(
                              item.id,
                              "discountPct",
                              parseFloat(e.target.value) || 0
                            )
                          }
                          className="w-full text-center"
                        />
                      </td>
                      <td className="px-2 py-1">
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={item.vatPct}
                          onChange={(e) =>
                            updateItem(
                              item.id,
                              "vatPct",
                              parseFloat(e.target.value) || 0
                            )
                          }
                          className="w-full text-center"
                        />
                      </td>
                      <td className="px-3 py-1.5 text-right font-medium tabular-nums">
                        {fmt(total)}
                      </td>
                      <td className="px-3 py-1.5 text-center">
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          disabled={items.length === 1}
                          className="text-red-500 hover:text-red-700 disabled:opacity-30 transition-colors"
                          title="Remove item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <button
            type="button"
            onClick={addItem}
            className="mt-3 flex items-center gap-2 text-blue-600 dark:text-blue-400 border border-blue-600 dark:border-blue-400 hover:bg-blue-500/10 px-3 py-1.5 rounded text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Item
          </button>
        </div>

        {/* ── Commercial Details ── */}
        <div className="bg-card border border-border rounded-lg p-4">
          <h2 className="text-blue-600 dark:text-blue-400 font-bold text-xs mb-4 uppercase tracking-wide">
            Commercial Details
          </h2>
          <div className="grid grid-cols-2 gap-x-8 gap-y-4">
            <div className="flex items-center gap-3">
              <label className="text-sm text-muted-foreground w-32 shrink-0">Payment Terms</label>
              <Select
                value={paymentTerms || "__none__"}
                onValueChange={(v) =>
                  setPaymentTerms(v === "__none__" ? "" : v)
                }
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Select —</SelectItem>
                  {PAYMENT_TERMS.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3">
              <label className="text-sm text-muted-foreground w-32 shrink-0">Warranty</label>
              <Select
                value={warranty || "__none__"}
                onValueChange={(v) => setWarranty(v === "__none__" ? "" : v)}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Select —</SelectItem>
                  {WARRANTY_OPTIONS.map((o) => (
                    <SelectItem key={o} value={o}>
                      {o}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3">
              <label className="text-sm text-muted-foreground w-32 shrink-0">Delivery Terms</label>
              <Select
                value={deliveryTerms || "__none__"}
                onValueChange={(v) =>
                  setDeliveryTerms(v === "__none__" ? "" : v)
                }
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Select —</SelectItem>
                  {DELIVERY_TERMS.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* ── Notes ── */}
        <div className="bg-card border border-border rounded-lg p-4">
          <h2 className="text-blue-600 dark:text-blue-400 font-bold text-xs mb-3 uppercase tracking-wide">
            Notes
          </h2>
          <Textarea
            rows={4}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Enter notes..."
            className="w-full resize-none"
          />
        </div>

        {/* ── Actions ── */}
        <div className="flex justify-end gap-3 pb-6">
          <Button variant="outline" onClick={() => navigate("/deals")}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={saving}
            style={{ backgroundColor: "#0f2449" }}
            className="text-white hover:opacity-90"
          >
            {saving ? "Saving..." : editId ? "Save Changes" : "Create Order"}
          </Button>
        </div>
      </div>
    </div>
  );
}
