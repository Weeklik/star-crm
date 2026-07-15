import { useState, useEffect, useCallback } from "react";
import { v4 as uuidv4 } from "uuid";
import { useLocation, useRoute } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, ChevronLeft, ClipboardList, ChevronDown, Check } from "lucide-react";
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
import { Popover, PopoverContent, PopoverAnchor } from "@/components/ui/popover";
import { Command, CommandList, CommandItem, CommandEmpty } from "@/components/ui/command";
import { useRef } from "react";
import {
  useCreateDeal,
  useUpdateDeal,
  useListDeals,
  getListDealsQueryKey,
  useGetMe,
  useListUsers,
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
  otherBrand?: string;
  otherModel?: string;
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

const ORDER_TYPES = ["New Customer", "Dealer Customer", "Existing Customer"];

const PAYMENT_TERMS = [
  "30 Days",
  "60 Days",
  "90 Days",
  "100% Advance",
  "50% Advance",
  "PDC",
  "Other",
];
const WARRANTY_OPTIONS = [
  "3 Months",
  "6 Months",
  "1 Year",
  "2 Years",
  "3 Years",
  "5 Years",
  "No Warranty",
  "Other",
];
const DELIVERY_TERMS = [
  "Free On Board Dubai",
  "Cost, Insurance & Freight",
  "Ex-Works",
  "Delivered Duty Paid",
  "Delivered At Place",
  "Cost and Freight",
  "Other",
];
const DELIVERY_TIME_OPTIONS = [
  "3 Days",
  "7 Days",
  "14 Days",
  "30 Days",
  "45 Days",
  "60 Days",
  "90 Days",
  "120 Days",
  "180 Days",
  "Upon Availability",
  "To Be Confirmed",
  "Ex stock (subject to prior sale).",
  "Other",
];
const REGIONS = [
  "Abu Dhabi",
  "Dubai",
  "Sharjah",
  "Ajman",
  "Umm Al Quwain",
  "Ras Al Khaimah",
  "Fujairah",
  "Qatar",
  "Egypt",
  "Ethiopia",
  "Ghana",
  "Kenya",
  "Saudi Arabia",
  "Nigeria",
  "Tunisia",
];

const CREDIT_TERMS = [
  "30 Days",
  "60 Days",
  "90 Days",
  "100% Advance",
  "50% Advance",
  "Net 30",
];

const ADDITIONAL_INFO_ITEMS = [
  "SGS certificate, COC, ECTN, shipment inspection or any other certificate required by importing country authorities - expenses to buyers account",
  "Technician visits during installation & warranty, buyer to arrange or bear cost of visa, hotel accommodation, food & local expenses.",
  "Shipping charges shared is estimated cost based on current rates. Actual cost at the time of shipping will be informed before shipment and will be applicable.",
  "Warranty: 12 months covering breakdowns resulting from a malfunction originating from manufacturing defect. The warranty does not cover replacement parts, periodic maintenance or failure resulting from misuse. \n\nValidity: 02 Weeks",
];

const VAT_BY_COUNTRY: Record<string, number> = {
  UAE:      5,
  KSA:      15,
  Kenya:    16,
  Nigeria:  7.5,
  TN:       19,
  Ethiopia: 15,
  Egypt:    14,
  Ghana:    15,
};

function SearchableModelSelect({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = query.trim()
    ? options.filter((o) => o.toLowerCase().includes(query.toLowerCase()))
    : options;

  function handleOpen() {
    setOpen(true);
    setQuery("");
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function handleSelect(opt: string) {
    onChange(opt);
    setOpen(false);
    setQuery("");
  }

  function handleClear() {
    onChange("");
    setOpen(false);
    setQuery("");
  }

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQuery(""); }}>
      <PopoverAnchor asChild>
        <button
          type="button"
          onClick={handleOpen}
          className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className={value ? "text-foreground" : "text-muted-foreground"}>
            {value || "Select model…"}
          </span>
          <ChevronDown className="h-4 w-4 opacity-50 flex-shrink-0" />
        </button>
      </PopoverAnchor>
      <PopoverContent
        className="p-0 w-[var(--radix-popover-trigger-width)]"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="flex items-center border-b border-border px-2">
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type to search…"
            className="h-9 border-0 shadow-none focus-visible:ring-0 text-sm px-1"
            autoComplete="off"
          />
        </div>
        <Command shouldFilter={false}>
          <CommandList className="max-h-52">
            {filtered.length === 0 ? (
              <CommandEmpty className="py-2 px-3 text-sm text-muted-foreground">No matches</CommandEmpty>
            ) : (
              <>
                {value && (
                  <CommandItem onSelect={handleClear} className="text-muted-foreground text-xs italic">
                    — Clear selection —
                  </CommandItem>
                )}
                {filtered.map((opt) => (
                  <CommandItem
                    key={opt}
                    value={opt}
                    onSelect={() => handleSelect(opt)}
                    className="flex items-center justify-between"
                  >
                    {opt}
                    {opt === value && <Check className="w-3.5 h-3.5 text-primary" />}
                  </CommandItem>
                ))}
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function getCountryVat(country: string | null | undefined): number {
  if (!country) return 0;
  return VAT_BY_COUNTRY[country] ?? 0;
}

function getEffectiveVat(
  country: string | null | undefined,
  company: string,
): number {
  if (company === "STAR GLOBAL TECH FZCO") return 0;
  if (country === "TN") return 0;
  return getCountryVat(country);
}

const BANK_OPTIONS: Record<string, { value: string; label: string }[]> = {
  "STAR SEWING MACHINES TRADING L.L.C": [
    { value: "AED",     label: "AED (National Bank of Fujairah)" },
    { value: "USD",     label: "USD (Emirates NBD)" },
    { value: "EURO",    label: "EUR (Emirates NBD)" },
    { value: "JPY",     label: "JPY (Emirates NBD)" },
    { value: "USD-NBF", label: "USD (National Bank of Fujairah)" },
    { value: "EUR-NBF", label: "EUR (National Bank of Fujairah)" },
    { value: "JPY-NBF", label: "JPY (National Bank of Fujairah)" },
  ],
  "STAR GLOBAL TECH FZCO": [
    { value: "AED",     label: "AED (Emirates NBD)" },
    { value: "USD",     label: "USD (Emirates NBD)" },
    { value: "EURO",    label: "EUR (Emirates NBD)" },
    { value: "AED-NBF", label: "AED (National Bank of Fujairah)" },
  ],
  "STAR SEWING MACHINES TRADING L.L.C BR": [
    { value: "AED", label: "AED (Habib Bank AG Zurich)" },
  ],
  "MODREN SEWING MACHINE TRADING": [
    { value: "AED", label: "AED (United Arab Bank)" },
  ],
  "DUBAI SEWING MACHINE": [
    { value: "AED", label: "AED (Emirates NBD)" },
  ],
};

function newItem(vatPct = 0): OrderItem {
  return {
    id: uuidv4(),
    brand: "",
    model: "",
    description: "",
    qty: 1,
    unitPrice: 0,
    discountPct: 0,
    vatPct,
  };
}

function fmt(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getCurrencyCode(bankKey: string): string {
  const base = bankKey.split("-")[0];
  return base === "EURO" ? "EUR" : (base || "AED");
}

export default function AddOrder() {
  const [, navigate] = useLocation();
  const [matchEdit, paramsEdit] = useRoute("/orders/:id/edit");
  const editId = matchEdit && paramsEdit?.id ? parseInt(paramsEdit.id) : null;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: me } = useGetMe();
  const isOwner = me?.role === "owner";
  const { data: allUsers } = useListUsers({ query: { enabled: isOwner } } as any);
  const [orderOwnerCountry, setOrderOwnerCountry] = useState<string | null | undefined>(undefined);
  // VAT must follow the country of the order's own salesperson, not the
  // logged-in owner's country — otherwise switching regions on Orders and
  // opening a different-region order would show the wrong VAT rate.
  const effectiveCountry = editId !== null ? orderOwnerCountry : me?.country;
  const defaultVat = getCountryVat(effectiveCountry);

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
  const [receivedAmount, setReceivedAmount] = useState(0);
  const [orderType, setOrderType] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [warranty, setWarranty] = useState("");
  const [pdc, setPdc] = useState("");
  const [deliveryTerms, setDeliveryTerms] = useState("");
  const [deliveryTermsCustom, setDeliveryTermsCustom] = useState("");
  const [deliveryTime, setDeliveryTime] = useState("");
  const [notes, setNotes] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerTrn, setCustomerTrn] = useState("");
  const [items, setItems] = useState<OrderItem[]>([newItem(0)]);
  const [companySelection, setCompanySelection] = useState("STAR SEWING MACHINES TRADING L.L.C");
  const [bankDetails, setBankDetails] = useState("AED");
  const [additionalInfo, setAdditionalInfo] = useState<boolean[]>([false, false, false, false]);
  const [addInfoOpen, setAddInfoOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  // Ref: skip bankDetails reset when loading an existing deal
  const editLoadedRef = useRef(false);

  // Enforce VAT on all items — 0 if company is STAR GLOBAL TECH FZCO or salesperson is from Tunisia
  useEffect(() => {
    if (!effectiveCountry) return;
    const vat = getEffectiveVat(effectiveCountry, companySelection);
    setItems((prev) => prev.map((it) => ({ ...it, vatPct: vat })));
  }, [effectiveCountry, companySelection, loaded]);

  // Reset bankDetails to AED when the user switches company (not on initial load)
  useEffect(() => {
    if (!loaded) return;
    // Skip reset when this change came from loading an existing deal
    if (editLoadedRef.current) {
      editLoadedRef.current = false;
      return;
    }
    setBankDetails("AED");
  }, [companySelection]);

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

    // Resolve the order's own salesperson's country so VAT reflects that
    // salesperson's region, not the viewing owner's own country.
    if (isOwner) {
      const owningUser = (allUsers as any[] | undefined)?.find((u) => u.id === deal.salespersonId);
      if (!owningUser) return; // wait for users list to load before proceeding
      setOrderOwnerCountry(owningUser.country ?? null);
    } else {
      setOrderOwnerCountry(me?.country ?? null);
    }

    setCustomerName(deal.name ?? "");
    setCompanyName(deal.companyName ?? "");
    setRegion(deal.region ?? "");
    setOrderDate(String(deal.dealStartDate ?? "").split("T")[0] || new Date().toISOString().split("T")[0]);
    setClosingDate(deal.earliestClosingDate ? String(deal.earliestClosingDate).split("T")[0] : "");
    setStage(deal.stage ?? "Quotation Sent");
    const pct = parseInt(String(deal.salesStatus).replace("%", "")) || 25;
    setSalesChancePct(pct);
    setTransportationFee(deal.transportationFee ?? 0);
    setReceivedAmount(deal.receivedAmount ?? 0);
    setOrderType((deal as any).orderType ?? "");
    setPaymentTerms(deal.paymentTerms ?? "");
    setWarranty(deal.warranty ?? "");
    setPdc((deal as any).pdc ?? "");
    // Delivery terms — detect if stored value was a free-text "Other"
    const storedDt = deal.deliveryTerms ?? "";
    if (storedDt && !DELIVERY_TERMS.includes(storedDt)) {
      setDeliveryTerms("Other");
      setDeliveryTermsCustom(storedDt);
    } else {
      setDeliveryTerms(storedDt);
    }
    setDeliveryTime((deal as any).deliveryTime ?? "");
    // Mark that the next companySelection change comes from this load, not user action
    editLoadedRef.current = true;
    setCompanySelection((deal as any).companySelection ?? "");
    setBankDetails((deal as any).bankDetails ?? "AED");
    const ai = (deal as any).additionalInfo;
    if (Array.isArray(ai)) setAdditionalInfo([ai[0] ?? false, ai[1] ?? false, ai[2] ?? false, ai[3] ?? false]);
    setNotes(deal.notes ?? "");
    setCustomerAddress((deal as any).customerAddress ?? "");
    setCustomerPhone((deal as any).customerPhone ?? "");
    setCustomerEmail((deal as any).customerEmail ?? "");
    setCustomerTrn((deal as any).customerTrn ?? "");

    const dealItems = deal.items;
    if (Array.isArray(dealItems) && dealItems.length > 0) {
      setItems(
        dealItems.map((it: any) => ({ ...it, id: uuidv4() }))
      );
    } else {
      const fallbackCountry = isOwner
        ? (allUsers as any[] | undefined)?.find((u) => u.id === deal.salespersonId)?.country
        : me?.country;
      setItems([
        {
          id: uuidv4(),
          brand: deal.brand ?? "",
          model: deal.model ?? "",
          description: deal.productItem ?? "",
          qty: deal.quantity ?? 1,
          unitPrice: deal.agreedAmount ?? 0,
          discountPct: 0,
          vatPct: deal.vatApplicable ? getEffectiveVat(fallbackCountry, (deal as any).companySelection ?? "") : 0,
        },
      ]);
    }
    setLoaded(true);
  }, [editId, dealsData, loaded, isOwner, allUsers, me?.country]);

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

  // Display currency: derive from bank details selection for UAE, or user's native currency
  const displayCurrency = me?.country === "UAE"
    ? getCurrencyCode(bankDetails)
    : (me?.currency ?? "");

  // Item mutations
  const addItem = () => setItems((prev) => [...prev, newItem(getEffectiveVat(effectiveCountry, companySelection))]);
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
            updated.otherBrand = undefined;
            if (String(value).trim() && value !== "Other") fetchCatalogForBrand(String(value));
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
        receivedAmount: receivedAmount,
        outstandingAmount: Math.max(0, grandTotal - receivedAmount),
        earliestClosingDate: closingDate || null,
        region: region || null,
        notes: notes || null,
        brand: firstItem.brand || null,
        model: firstItem.model || null,
        quantity: firstItem.qty,
        // new fields
        items: items.map((it) => ({
          ...it,
          brand: it.brand === "Other" ? (it.otherBrand || "Other") : it.brand,
          model: it.model === "Other" ? (it.otherModel || "Other") : it.model,
        })),
        transportationFee,
        orderType: orderType || null,
        paymentTerms: paymentTerms || null,
        warranty: warranty || null,
        pdc: pdc || null,
        deliveryTerms: deliveryTerms === "Other" ? (deliveryTermsCustom.trim() || null) : (deliveryTerms || null),
        deliveryTime: deliveryTime || null,
        companySelection: companySelection || null,
        bankDetails: bankDetails || null,
        currency: getCurrencyCode(bankDetails),
        additionalInfo,
        customerAddress: customerAddress || null,
        customerPhone: customerPhone || null,
        customerEmail: customerEmail || null,
        customerTrn: customerTrn || null,
      } as any;

      if (editId !== null) {
        await updateDeal.mutateAsync({ id: editId, data: payload });
        toast({ title: "Order updated successfully" });
      } else {
        await createDeal.mutateAsync({ data: payload });
        toast({ title: "Order created successfully" });
      }
      void queryClient.invalidateQueries({ queryKey: getListDealsQueryKey() });
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

      {/* ── Company Selection (UAE only) ── */}
      {me?.country === "UAE" && (
        <div className="flex items-center gap-4 px-6 py-3 border-b border-border bg-muted/40">
          <label className="text-sm font-medium text-muted-foreground whitespace-nowrap">
            Choose Your Company
          </label>
          <Select
            value={companySelection || "__none__"}
            onValueChange={(v) => setCompanySelection(v === "__none__" ? "" : v)}
          >
            <SelectTrigger className="w-96">
              <SelectValue placeholder="Select company..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="STAR SEWING MACHINES TRADING L.L.C">
                STAR SEWING MACHINES TRADING L.L.C
              </SelectItem>
              <SelectItem value="STAR GLOBAL TECH FZCO">
                STAR GLOBAL TECH FZCO
              </SelectItem>
              <SelectItem value="STAR SEWING MACHINES TRADING L.L.C BR">
                STAR SEWING MACHINES TRADING L.L.C BR
              </SelectItem>
              <SelectItem value="MODREN SEWING MACHINE TRADING">
                MODREN SEWING MACHINE TRADING
              </SelectItem>
              <SelectItem value="DUBAI SEWING MACHINE">
                DUBAI SEWING MACHINE
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

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
                <label className="text-sm text-muted-foreground w-32 shrink-0">Customer Type</label>
                <Select
                  value={orderType || "__none__"}
                  onValueChange={(v) => setOrderType(v === "__none__" ? "" : v)}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select type..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Select —</SelectItem>
                    {ORDER_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-start gap-3">
                <label className="text-sm text-muted-foreground w-32 shrink-0 pt-2">Address</label>
                <textarea
                  rows={2}
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  placeholder="Customer address"
                  className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
              <div className="flex items-center gap-3">
                <label className="text-sm text-muted-foreground w-32 shrink-0">Phone Number</label>
                <Input
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="Phone number"
                  className="flex-1"
                />
              </div>
              <div className="flex items-center gap-3">
                <label className="text-sm text-muted-foreground w-32 shrink-0">Email</label>
                <Input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="Email address"
                  className="flex-1"
                />
              </div>
              <div className="flex items-center gap-3">
                <label className="text-sm text-muted-foreground w-32 shrink-0">TRN Number</label>
                <Input
                  value={customerTrn}
                  onChange={(e) => setCustomerTrn(e.target.value)}
                  placeholder="TRN number"
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
                <span className="text-muted-foreground">VAT ({defaultVat}%)</span>
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
                <span className="text-blue-600 dark:text-blue-400 font-bold text-sm uppercase">
                  Grand Total{displayCurrency ? ` (${displayCurrency})` : ""}
                </span>
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
                  <th className="px-3 py-2.5 text-center font-medium min-w-[4rem]">Qty</th>
                  <th className="px-3 py-2.5 text-center font-medium min-w-[5rem]">Unit Price</th>
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
                        {item.brand === "Other" ? (
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-muted-foreground italic">Other</span>
                              <button type="button" onClick={() => updateItem(item.id, "brand", "")} className="text-xs text-blue-500 hover:underline">← back</button>
                            </div>
                            <Input
                              value={item.otherBrand ?? ""}
                              onChange={(e) => setItems((prev) => prev.map((it) => it.id === item.id ? { ...it, otherBrand: e.target.value } : it))}
                              placeholder="Enter brand name"
                              className="w-full"
                            />
                          </div>
                        ) : (
                          <div className="flex flex-col gap-0.5">
                            <AutocompleteInput
                              value={item.brand}
                              onChange={(v) => updateItem(item.id, "brand", v)}
                              lookupType="catalog-brand"
                              placeholder="Brand"
                              className="w-full"
                            />
                            <button type="button" onClick={() => updateItem(item.id, "brand", "Other")} className="text-xs text-muted-foreground hover:text-blue-500 text-left leading-none">+ Other</button>
                          </div>
                        )}
                      </td>
                      <td className="px-2 py-1">
                        {item.model === "Other" ? (
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-muted-foreground italic">Other</span>
                              <button type="button" onClick={() => updateItem(item.id, "model", "")} className="text-xs text-blue-500 hover:underline">← back</button>
                            </div>
                            <Input
                              value={item.otherModel ?? ""}
                              onChange={(e) => setItems((prev) => prev.map((it) => it.id === item.id ? { ...it, otherModel: e.target.value } : it))}
                              placeholder="Enter model name"
                              className="w-full"
                            />
                          </div>
                        ) : brandProds.length > 0 ? (
                          <SearchableModelSelect
                            options={[...brandProds.map((p, i) => p.model ?? `m-${i}`).filter(Boolean), "Other"]}
                            value={item.model}
                            onChange={(v) => updateItem(item.id, "model", v)}
                          />
                        ) : (
                          <div className="flex flex-col gap-0.5">
                            <Input
                              value={item.model}
                              onChange={(e) => updateItem(item.id, "model", e.target.value)}
                              placeholder="Model"
                              className="w-full"
                            />
                            <button type="button" onClick={() => updateItem(item.id, "model", "Other")} className="text-xs text-muted-foreground hover:text-blue-500 text-left leading-none">+ Other</button>
                          </div>
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
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={item.qty === 0 ? "" : String(item.qty)}
                          onChange={(e) => {
                            const digits = e.target.value.replace(/[^0-9]/g, "");
                            updateItem(item.id, "qty", digits === "" ? 0 : parseInt(digits, 10));
                          }}
                          placeholder="0"
                          className="text-center"
                          style={{ width: `${Math.max(String(item.qty).length * 10 + 40, 80)}px` }}
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
                          className="text-right"
                          style={{ width: `${Math.max(10, String(item.unitPrice || 0).length + 2)}ch` }}
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
                        <div className="w-full h-9 flex items-center justify-center rounded-md border border-input bg-muted/40 text-sm font-medium tabular-nums select-none">
                          {item.vatPct}%
                        </div>
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

          <div className="mt-4 pt-4 border-t border-border flex items-center justify-end gap-4">
            <label className="text-sm font-medium text-muted-foreground">Amount Received</label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                value={receivedAmount || ""}
                placeholder="0.00"
                onChange={(e) => setReceivedAmount(parseFloat(e.target.value) || 0)}
                className="w-40 text-right h-9 text-sm"
              />
            </div>
            <div className="flex items-center gap-2 min-w-[180px] justify-between">
              <span className="text-sm text-muted-foreground">Outstanding</span>
              <span className={`font-semibold text-sm tabular-nums ${Math.max(0, grandTotal - receivedAmount) > 0 ? "text-amber-600 dark:text-amber-400" : "text-green-600 dark:text-green-400"}`}>
                {fmt(Math.max(0, grandTotal - receivedAmount))}
              </span>
            </div>
          </div>
        </div>

        {/* ── Commercial Details ── */}
        <div className="bg-card border border-border rounded-lg p-4">
          <h2 className="text-blue-600 dark:text-blue-400 font-bold text-xs mb-4 uppercase tracking-wide">
            Commercial Details
          </h2>
          <div className="grid grid-cols-2 gap-x-8 gap-y-4">
            <div className="flex items-start gap-3">
              <label className="text-sm text-muted-foreground w-32 shrink-0 pt-2">Payment Terms</label>
              <div className="flex-1 flex flex-col gap-1">
                <Select
                  value={paymentTerms || "__none__"}
                  onValueChange={(v) => setPaymentTerms(v === "__none__" ? "" : v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Select —</SelectItem>
                    {PAYMENT_TERMS.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {paymentTerms === "PDC" && (
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-muted-foreground whitespace-nowrap">Number of PDC's</label>
                      <Input
                        type="number"
                        min={1}
                        value={pdc || ""}
                        placeholder="e.g. 3"
                        onChange={(e) => setPdc(e.target.value)}
                        className="w-24 h-7 text-sm text-center"
                      />
                    </div>
                    {(() => {
                      const count = parseInt(pdc);
                      const outstanding = Math.max(0, grandTotal - receivedAmount);
                      if (count > 0 && outstanding > 0) {
                        return (
                          <p className="text-xs font-semibold text-violet-500 dark:text-violet-400">
                            Amount per cheque: {fmt(outstanding / count)}
                          </p>
                        );
                      }
                      return null;
                    })()}
                  </div>
                )}
              </div>
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
              <div className="flex-1 flex flex-col gap-2">
                <Select
                  value={deliveryTerms || "__none__"}
                  onValueChange={(v) =>
                    setDeliveryTerms(v === "__none__" ? "" : v)
                  }
                >
                  <SelectTrigger className="w-full">
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
                {deliveryTerms === "Other" && (
                  <Input
                    value={deliveryTermsCustom}
                    onChange={(e) => setDeliveryTermsCustom(e.target.value.slice(0, 50))}
                    placeholder="Specify delivery terms (max 50 chars)"
                    className="w-full"
                    maxLength={50}
                  />
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <label className="text-sm text-muted-foreground w-32 shrink-0">Delivery Time</label>
              <Select
                value={deliveryTime || "__none__"}
                onValueChange={(v) =>
                  setDeliveryTime(v === "__none__" ? "" : v)
                }
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Select —</SelectItem>
                  {DELIVERY_TIME_OPTIONS.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {me?.country === "UAE" && (
              <div className="flex items-center gap-3 sm:col-span-2">
                <label className="text-sm text-muted-foreground w-32 shrink-0">Bank Details</label>
                <Select value={bankDetails} onValueChange={setBankDetails}>
                  <SelectTrigger className="w-64">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(BANK_OPTIONS[companySelection] ?? BANK_OPTIONS["STAR SEWING MACHINES TRADING L.L.C"]).map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </div>

        {/* ── Additional Information ── */}
        <div className="bg-card border border-border rounded-lg p-4">
          <button
            type="button"
            className="flex w-full items-center justify-between"
            onClick={() => setAddInfoOpen((o) => !o)}
          >
            <h2 className="text-blue-600 dark:text-blue-400 font-bold text-xs uppercase tracking-wide">
              Additional Information
            </h2>
            <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${addInfoOpen ? "rotate-180" : ""}`} />
          </button>
          {addInfoOpen && (
            <div className="mt-4 space-y-3">
              {ADDITIONAL_INFO_ITEMS.map((label, i) => (
                <label key={i} className="flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={additionalInfo[i] ?? false}
                    onChange={(e) =>
                      setAdditionalInfo((prev) => {
                        const next = [...prev] as boolean[];
                        next[i] = e.target.checked;
                        return next;
                      })
                    }
                    className="w-4 h-4 rounded border-border accent-blue-600"
                  />
                  <span className="text-sm">{label}</span>
                </label>
              ))}
            </div>
          )}
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
