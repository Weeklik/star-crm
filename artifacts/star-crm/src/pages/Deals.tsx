import {
  useGetMe,
  useListDeals,
  useCreateDeal,
  useUpdateDeal,
  useDeleteDeal,
  getListDealsQueryKey,
} from "@workspace/api-client-react";
import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Plus, Search, MoreHorizontal, Pencil, Trash2, Loader2,
  Upload, Download, FileSpreadsheet, AlertTriangle, CheckCircle2, XCircle,
  Handshake, Wallet, Clock4, TrendingUp, CalendarRange,
} from "lucide-react";
import * as XLSX from "xlsx";
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
import { useToast } from "@/hooks/use-toast";

type Stage = "Quotation Sent" | "Order Confirmed" | "Order Closed" | "Order Lost";

const STAGES: Stage[] = [
  "Quotation Sent",
  "Order Confirmed",
  "Order Closed",
  "Order Lost",
];

// Excel template column headers (must stay in sync with parsing logic)
const TEMPLATE_HEADERS = [
  "Deal Start Date",
  "Name",
  "Company Name",
  "Product / Item",
  "Stage / Status",
  "Progress %",
  "VAT Applicable (Yes/No)",
  "Agreed Amount",
  "Received Amount",
  "Outstanding Amount",
  "Earliest Closing Date",
  "Latest Closing Date",
  "Notes / Comments",
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

interface ImportRow extends DealFormState {
  _rowIndex: number;
  _isDuplicate?: boolean;
  _forceAdd?: boolean;
  _error?: string;
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

// Month abbreviation → 1-based index
const MONTH_ABBR: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

/**
 * Convert any date value from Excel to YYYY-MM-DD.
 * Handles:
 *   - Excel serial number (e.g. 45000)
 *   - "9-Jan-25"  / "9-Jan-2025"  (d-MMM-yy / d-MMM-yyyy)
 *   - "YYYY-MM-DD"
 *   - Any string parseable by Date()
 * Returns "" for blank/unparseable values.
 */
function parseExcelDate(val: unknown): string {
  if (val === null || val === undefined || val === "") return "";
  if (typeof val === "number") {
    const date = XLSX.SSF.parse_date_code(val);
    if (!date) return "";
    return `${date.y}-${String(date.m).padStart(2, "0")}-${String(date.d).padStart(2, "0")}`;
  }
  const s = String(val).trim();
  if (!s) return "";

  // "9-Jan-25" or "9-Jan-2025"
  const dmy = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2,4})$/);
  if (dmy) {
    const day = parseInt(dmy[1], 10);
    const mon = MONTH_ABBR[dmy[2].toLowerCase()];
    let yr = parseInt(dmy[3], 10);
    if (yr < 100) yr += 2000;
    if (mon && day) {
      return `${yr}-${String(mon).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // Fallback: let the JS Date parser try
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];

  return "";
}

/** Strip currency symbols / commas and return a number (0 if blank) */
function parseAmount(val: unknown): number {
  if (val === null || val === undefined || val === "") return 0;
  if (typeof val === "number") return val;
  const clean = String(val).replace(/[^0-9.-]/g, "");
  return parseFloat(clean) || 0;
}

/** Normalise a stage string to one of our four valid values */
function normaliseStage(raw: string): Stage {
  const lower = raw.toLowerCase();
  if (lower.includes("confirm")) return "Order Confirmed";
  if (lower.includes("close") || lower.includes("closed")) return "Order Closed";
  if (lower.includes("lost")) return "Order Lost";
  return "Quotation Sent";
}

/** Normalise a column header for fuzzy matching: lowercase + collapse non-alphanumeric */
function normHeader(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/**
 * Maps every recognised normalised alias → internal field key.
 * This lets us accept slight variations in column naming from user sheets.
 */
const FIELD_ALIASES: Record<string, string> = {
  // Name
  "name": "name", "deal name": "name", "contact name": "name",
  "lead name": "name", "opportunity": "name", "opportunity name": "name",
  // Company Name
  "company name": "companyName", "company": "companyName",
  "organization": "companyName", "organisation": "companyName",
  "client": "companyName", "account": "companyName", "firm": "companyName",
  // Product / Item
  "product item": "productItem", "product": "productItem", "item": "productItem",
  "service": "productItem", "product name": "productItem",
  "product service": "productItem", "services": "productItem",
  // Deal Start Date
  "deal start date": "dealStartDate", "start date": "dealStartDate",
  "date": "dealStartDate", "deal date": "dealStartDate",
  "commencement date": "dealStartDate",
  // Stage / Status
  "stage status": "stage", "stage": "stage", "status": "stage",
  "deal stage": "stage", "current stage": "stage",
  // Progress %
  "progress": "progress", "completion": "progress",
  "progress percent": "progress", "completion percent": "progress",
  // VAT
  "vat applicable yes no": "vatApplicable", "vat applicable": "vatApplicable",
  "vat": "vatApplicable", "vat yes no": "vatApplicable",
  // Agreed Amount
  "agreed amount": "agreedAmount", "agreed": "agreedAmount",
  "deal value": "agreedAmount", "contract value": "agreedAmount",
  "total amount": "agreedAmount", "agreed value": "agreedAmount",
  "value": "agreedAmount",
  // Received Amount
  "received amount": "receivedAmount", "received": "receivedAmount",
  "paid": "receivedAmount", "payment received": "receivedAmount",
  "amount received": "receivedAmount", "down payment": "receivedAmount",
  "paid amount": "receivedAmount",
  // Outstanding Amount
  "outstanding amount": "outstandingAmount", "outstanding": "outstandingAmount",
  "balance": "outstandingAmount", "remaining": "outstandingAmount",
  "amount due": "outstandingAmount", "pending amount": "outstandingAmount",
  // Earliest Closing Date
  "earliest closing date": "earliestClosingDate", "earliest closing": "earliestClosingDate",
  "close date": "earliestClosingDate", "closing date": "earliestClosingDate",
  "earliest date": "earliestClosingDate",
  // Latest Closing Date
  "latest closing date": "latestClosingDate", "latest closing": "latestClosingDate",
  "end date": "latestClosingDate", "due date": "latestClosingDate",
  "target date": "latestClosingDate", "latest date": "latestClosingDate",
  // Notes
  "notes comments": "notes", "notes": "notes", "comments": "notes",
  "remarks": "notes", "description": "notes", "note": "notes",
};

/**
 * Given the actual header keys present in the sheet, build a map of
 *   internalFieldName → actualSheetKey
 * using fuzzy alias matching.
 */
function buildColumnMap(sheetKeys: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const key of sheetKeys) {
    const norm = normHeader(key);
    const field = FIELD_ALIASES[norm];
    if (field && !map[field]) {
      map[field] = key;
    }
  }
  return map;
}

function parseExcelRows(ws: XLSX.WorkSheet): { rows: ImportRow[]; detectedHeaders: string[] } {
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "", raw: true });
  if (json.length === 0) return { rows: [], detectedHeaders: [] };

  const detectedHeaders = Object.keys(json[0]);
  const colMap = buildColumnMap(detectedHeaders);

  const get = (row: Record<string, unknown>, field: string): unknown => {
    const key = colMap[field];
    return key !== undefined ? row[key] : "";
  };
  const str = (row: Record<string, unknown>, field: string): string =>
    String(get(row, field) ?? "").trim();

  const rows = json
    .map((row, idx) => {
      const stageRaw = str(row, "stage");
      const stage: Stage = stageRaw ? normaliseStage(stageRaw) : "Quotation Sent";

      const progressRaw = str(row, "progress");
      const progress = Math.min(100, Math.max(0, parseFloat(progressRaw.replace(/[^0-9.]/g, "")) || 0));

      return {
        _rowIndex: idx + 2,
        name:              str(row, "name"),
        companyName:       str(row, "companyName"),
        productItem:       str(row, "productItem"),
        dealStartDate:     parseExcelDate(get(row, "dealStartDate")) || new Date().toISOString().split("T")[0],
        stage,
        progress,
        salesStatus:       "Active",
        vatApplicable:     /^yes$/i.test(str(row, "vatApplicable")),
        agreedAmount:      parseAmount(get(row, "agreedAmount")),
        receivedAmount:    parseAmount(get(row, "receivedAmount")),
        outstandingAmount: parseAmount(get(row, "outstandingAmount")),
        earliestClosingDate: parseExcelDate(get(row, "earliestClosingDate")),
        latestClosingDate:   parseExcelDate(get(row, "latestClosingDate")),
        notes:             str(row, "notes"),
      } as ImportRow;
    })
    .filter((r) => r.name && r.companyName);

  return { rows, detectedHeaders };
}

function downloadTemplate() {
  const wb = XLSX.utils.book_new();

  const today = new Date();
  const fmtSample = (d: Date) => {
    const day = d.getDate();
    const mon = d.toLocaleString("en-US", { month: "short" });
    const yr  = String(d.getFullYear()).slice(-2);
    return `${day}-${mon}-${yr}`;
  };
  const todayStr = fmtSample(today);

  const sampleRow: Record<string, string | number> = {
    "Deal Start Date":          todayStr,
    "Name":                     "Q3 Enterprise Renewal",
    "Company Name":             "Acme Corp",
    "Product / Item":           "SaaS Pro Plan",
    "Stage / Status":           "Quotation Sent",
    "Progress %":               "50",
    "VAT Applicable (Yes/No)":  "No",
    "Agreed Amount":            "10000",
    "Received Amount":          "5000",
    "Outstanding Amount":       "5000",
    "Earliest Closing Date":    "",
    "Latest Closing Date":      "",
    "Notes / Comments":         "Example note",
  };

  const ws = XLSX.utils.json_to_sheet([sampleRow], { header: TEMPLATE_HEADERS });
  ws["!cols"] = TEMPLATE_HEADERS.map((h) => ({ wch: Math.max(h.length + 2, 18) }));
  XLSX.utils.book_append_sheet(wb, ws, "Deals");
  XLSX.writeFile(wb, "star-crm-deals-template.xlsx");
}

export default function Deals() {
  const { data: me } = useGetMe();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: deals, isLoading } = useListDeals(
    me?.role === "salesperson" ? { salespersonId: me.id } : undefined,
    { query: { enabled: !!me } }
  );

  const createDeal = useCreateDeal();
  const updateDeal = useUpdateDeal();
  const deleteDeal = useDeleteDeal();

  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<DealFormState>(emptyForm());
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  // Import state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [importDuplicates, setImportDuplicates] = useState<ImportRow[]>([]);
  const [importingNew, setImportingNew] = useState(false);
  const [importPhase, setImportPhase] = useState<"review" | "confirm-duplicates">("review");
  const [forceAddSelected, setForceAddSelected] = useState<Set<number>>(new Set());

  const filteredDeals = deals?.filter((d) => {
    const dateStr =
      typeof d.dealStartDate === "string"
        ? d.dealStartDate.split("T")[0]
        : d.dealStartDate instanceof Date
        ? d.dealStartDate.toISOString().split("T")[0]
        : "";
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      d.companyName.toLowerCase().includes(q) ||
      d.name.toLowerCase().includes(q) ||
      d.productItem.toLowerCase().includes(q);
    const matchesFrom = !dateFrom || dateStr >= dateFrom;
    const matchesTo   = !dateTo   || dateStr <= dateTo;
    return matchesSearch && matchesFrom && matchesTo;
  });

  const fmtCurrency = (n: number) =>
    new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);

  const statsAgreed      = filteredDeals?.reduce((s, d) => s + (Number(d.agreedAmount)      || 0), 0) ?? 0;
  const statsReceived    = filteredDeals?.reduce((s, d) => s + (Number(d.receivedAmount)     || 0), 0) ?? 0;
  const statsOutstanding = filteredDeals?.reduce((s, d) => s + (Number(d.outstandingAmount)  || 0), 0) ?? 0;
  const stageCount = (stage: string) => filteredDeals?.filter((d) => d.stage === stage).length ?? 0;

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

  // ── Import logic ──────────────────────────────────────────────────────────

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const { rows, detectedHeaders } = parseExcelRows(ws);
        if (rows.length === 0) {
          const headerPreview = detectedHeaders.length
            ? `Columns detected: ${detectedHeaders.slice(0, 6).join(", ")}${detectedHeaders.length > 6 ? ` … (+${detectedHeaders.length - 6} more)` : ""}.`
            : "No column headers detected.";
          toast({
            title: "No importable rows found",
            description: `${headerPreview} The import needs at least a "Name" (or "Deal Name") and "Company Name" (or "Company") column with data. Download the template to see the expected format.`,
            variant: "destructive",
            duration: 9000,
          });
          return;
        }
        setImportRows(rows);
        setImportDuplicates([]);
        setForceAddSelected(new Set());
        setImportPhase("review");
        setImportDialogOpen(true);
      } catch {
        toast({ title: "Failed to parse file", description: "Please use the downloaded Excel template.", variant: "destructive" });
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  }

  async function handleImport() {
    setImportingNew(true);
    try {
      const res = await fetch("/api/deals/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deals: importRows.map(toPayload), force: false }),
      });
      const json = await res.json();
      if (json.requiresConfirmation) {
        setImportRows(json.newDeals ?? []);
        setImportDuplicates(json.duplicates ?? []);
        setForceAddSelected(new Set());
        setImportPhase("confirm-duplicates");
      } else {
        const count = json.imported?.length ?? 0;
        toast({ title: `Import complete`, description: `${count} deal${count !== 1 ? "s" : ""} added.` });
        await queryClient.invalidateQueries({ queryKey: getListDealsQueryKey() });
        setImportDialogOpen(false);
      }
    } catch {
      toast({ title: "Import failed", description: "Please try again.", variant: "destructive" });
    } finally {
      setImportingNew(false);
    }
  }

  async function handleConfirmDuplicates() {
    // Build final list: all new + selected duplicates
    const forceDuplicates = importDuplicates.filter((r) => forceAddSelected.has(r._rowIndex));
    const allDeals = [...importRows, ...forceDuplicates];

    setImportingNew(true);
    try {
      const res = await fetch("/api/deals/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deals: allDeals.map(toPayload), force: true }),
      });
      const json = await res.json();
      const count = json.imported?.length ?? 0;
      toast({ title: `Import complete`, description: `${count} deal${count !== 1 ? "s" : ""} added.` });
      await queryClient.invalidateQueries({ queryKey: getListDealsQueryKey() });
      setImportDialogOpen(false);
    } catch {
      toast({ title: "Import failed", description: "Please try again.", variant: "destructive" });
    } finally {
      setImportingNew(false);
    }
  }

  function toggleForceAdd(rowIndex: number) {
    setForceAddSelected((prev) => {
      const next = new Set(prev);
      if (next.has(rowIndex)) next.delete(rowIndex);
      else next.add(rowIndex);
      return next;
    });
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
        <div className="flex items-center gap-2">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={handleFileChange}
          />
          <Button variant="outline" onClick={downloadTemplate} title="Download Excel template">
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Template
          </Button>
          <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
            <Upload className="w-4 h-4 mr-2" />
            Import Excel
          </Button>
          <Button className="shrink-0" onClick={openAdd} data-testid="btn-add-deal">
            <Plus className="w-4 h-4 mr-2" />
            Add Deal
          </Button>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap items-center gap-3 bg-card border border-border rounded-xl p-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search company, contact, or product..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="input-search-deals"
          />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <CalendarRange className="w-4 h-4 text-muted-foreground" />
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            title="From date"
          />
          <span className="text-muted-foreground text-sm">to</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            title="To date"
          />
          {(dateFrom || dateTo) && (
            <button
              onClick={() => { setDateFrom(""); setDateTo(""); }}
              className="text-xs text-muted-foreground hover:text-foreground underline"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* ── Stat boxes ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* Total Deals */}
        <div className="col-span-1 bg-card border border-border rounded-xl p-4 flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total Deals</span>
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
          </div>
          <p className="text-3xl font-bold tabular-nums">{filteredDeals?.length ?? 0}</p>
          <p className="text-xs text-muted-foreground">in current view</p>
        </div>

        {/* Agreed Amount */}
        <div className="col-span-1 bg-card border border-border rounded-xl p-4 flex flex-col gap-1 border-l-4 border-l-blue-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Agreed</span>
            <Handshake className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-2xl font-bold tabular-nums text-blue-600 dark:text-blue-400">{fmtCurrency(statsAgreed)}</p>
          <p className="text-xs text-muted-foreground">total agreed amount</p>
        </div>

        {/* Received Amount */}
        <div className="col-span-1 bg-card border border-border rounded-xl p-4 flex flex-col gap-1 border-l-4 border-l-green-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Received</span>
            <Wallet className="w-4 h-4 text-green-500" />
          </div>
          <p className="text-2xl font-bold tabular-nums text-green-600 dark:text-green-400">{fmtCurrency(statsReceived)}</p>
          <p className="text-xs text-muted-foreground">total received</p>
        </div>

        {/* Outstanding Amount */}
        <div className="col-span-1 bg-card border border-border rounded-xl p-4 flex flex-col gap-1 border-l-4 border-l-orange-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Outstanding</span>
            <Clock4 className="w-4 h-4 text-orange-500" />
          </div>
          <p className="text-2xl font-bold tabular-nums text-orange-600 dark:text-orange-400">{fmtCurrency(statsOutstanding)}</p>
          <p className="text-xs text-muted-foreground">pending collection</p>
        </div>

        {/* Pipeline Stages — spans 2 cols */}
        <div className="col-span-2 bg-card border border-border rounded-xl p-4 flex flex-col gap-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Pipeline Stages</span>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                <span className="text-xs text-muted-foreground">Quotation Sent</span>
              </div>
              <span className="text-sm font-bold tabular-nums">{stageCount("Quotation Sent")}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-yellow-500 shrink-0" />
                <span className="text-xs text-muted-foreground">Order Confirmed</span>
              </div>
              <span className="text-sm font-bold tabular-nums">{stageCount("Order Confirmed")}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                <span className="text-xs text-muted-foreground">Order Closed</span>
              </div>
              <span className="text-sm font-bold tabular-nums">{stageCount("Order Closed")}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                <span className="text-xs text-muted-foreground">Order Lost</span>
              </div>
              <span className="text-sm font-bold tabular-nums">{stageCount("Order Lost")}</span>
            </div>
          </div>
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

      {/* Import Preview Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={(o) => !o && setImportDialogOpen(false)}>
        <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {importPhase === "review" ? (
                <>
                  <Upload className="w-5 h-5" />
                  Review Import — {importRows.length} deal{importRows.length !== 1 ? "s" : ""} found
                </>
              ) : (
                <>
                  <AlertTriangle className="w-5 h-5 text-yellow-500" />
                  Duplicate Deals Detected
                </>
              )}
            </DialogTitle>
          </DialogHeader>

          {importPhase === "review" ? (
            <>
              <p className="text-sm text-muted-foreground px-1">
                Review the deals parsed from your file. All rows below will be imported. Click <strong>Import</strong> to proceed — duplicates will be flagged before any data is saved.
              </p>
              <div className="flex-1 overflow-auto mt-2 rounded-md border border-border">
                <table className="w-full text-xs">
                  <thead className="bg-muted/60 sticky top-0">
                    <tr>
                      <th className="px-2 py-2 text-left font-semibold">#</th>
                      <th className="px-2 py-2 text-left font-semibold">Deal Name</th>
                      <th className="px-2 py-2 text-left font-semibold">Company</th>
                      <th className="px-2 py-2 text-left font-semibold">Product</th>
                      <th className="px-2 py-2 text-left font-semibold">Stage</th>
                      <th className="px-2 py-2 text-right font-semibold">Agreed</th>
                      <th className="px-2 py-2 text-left font-semibold">Start Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importRows.map((row) => (
                      <tr key={row._rowIndex} className="border-t border-border/40 hover:bg-muted/20">
                        <td className="px-2 py-1.5 text-muted-foreground">{row._rowIndex}</td>
                        <td className="px-2 py-1.5 font-medium">{row.name}</td>
                        <td className="px-2 py-1.5">{row.companyName}</td>
                        <td className="px-2 py-1.5 text-muted-foreground">{row.productItem}</td>
                        <td className="px-2 py-1.5">
                          <Badge variant="outline" className={`text-[10px] border-0 ${getStageColor(row.stage)}`}>{row.stage}</Badge>
                        </td>
                        <td className="px-2 py-1.5 text-right">{formatCurrency(row.agreedAmount)}</td>
                        <td className="px-2 py-1.5 text-muted-foreground">{row.dealStartDate}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <DialogFooter className="mt-2">
                <Button variant="outline" onClick={() => setImportDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleImport} disabled={importingNew || importRows.length === 0}>
                  {importingNew ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                  Import {importRows.length} Deal{importRows.length !== 1 ? "s" : ""}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              {/* Duplicate confirmation phase */}
              <div className="space-y-3 flex-1 overflow-auto">
                {importRows.length > 0 && (
                  <div className="rounded-md border border-green-500/30 bg-green-500/5 p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                      <span className="text-sm font-medium text-green-500">{importRows.length} new deal{importRows.length !== 1 ? "s" : ""} ready to import</span>
                    </div>
                    <table className="w-full text-xs">
                      <thead className="text-muted-foreground">
                        <tr>
                          <th className="text-left pb-1">Deal Name</th>
                          <th className="text-left pb-1">Company</th>
                          <th className="text-right pb-1">Agreed</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importRows.map((r) => (
                          <tr key={r._rowIndex} className="border-t border-green-500/10">
                            <td className="py-1 font-medium">{r.name}</td>
                            <td className="py-1">{r.companyName}</td>
                            <td className="py-1 text-right">{formatCurrency(r.agreedAmount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="rounded-md border border-yellow-500/30 bg-yellow-500/5 p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0" />
                    <span className="text-sm font-medium text-yellow-500">
                      {importDuplicates.length} duplicate{importDuplicates.length !== 1 ? "s" : ""} found — a deal with the same name and company already exists
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">
                    Check the box next to any duplicate you still want to add.
                  </p>
                  <table className="w-full text-xs">
                    <thead className="text-muted-foreground">
                      <tr>
                        <th className="text-left pb-1 w-8">Add?</th>
                        <th className="text-left pb-1">Deal Name</th>
                        <th className="text-left pb-1">Company</th>
                        <th className="text-right pb-1">Agreed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importDuplicates.map((r) => (
                        <tr key={r._rowIndex} className="border-t border-yellow-500/10">
                          <td className="py-1.5">
                            <Checkbox
                              checked={forceAddSelected.has(r._rowIndex)}
                              onCheckedChange={() => toggleForceAdd(r._rowIndex)}
                            />
                          </td>
                          <td className="py-1.5 font-medium">{r.name}</td>
                          <td className="py-1.5">{r.companyName}</td>
                          <td className="py-1.5 text-right">{formatCurrency(r.agreedAmount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <DialogFooter className="mt-2">
                <Button variant="outline" onClick={() => setImportDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleConfirmDuplicates} disabled={importingNew}>
                  {importingNew ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                  Import {importRows.length + forceAddSelected.size} Deal{(importRows.length + forceAddSelected.size) !== 1 ? "s" : ""}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
