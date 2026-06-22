import {
  useGetMe,
  useListDeals,
  useListUsers,
  useCreateDeal,
  useUpdateDeal,
  useDeleteDeal,
  getListDealsQueryKey,
} from "@workspace/api-client-react";
import type { Deal } from "@workspace/api-client-react";
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
import { useCurrency } from "@/contexts/CurrencyContext";
import { AutocompleteInput } from "@/components/ui/autocomplete-input";

type Stage = "Quotation Sent" | "Order Confirmed" | "Order Closed" | "Order Lost";

const STAGES: Stage[] = [
  "Quotation Sent",
  "Order Confirmed",
  "Order Closed",
  "Order Lost",
];

// Excel template column headers (must stay in sync with parsing logic)
const TEMPLATE_HEADERS = [
  "Order Start Date",
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

const LOST_REASONS = [
  "Price Factor",
  "Specification Match",
  "Credit Period",
  "Availability Issue at our end",
] as const;

interface DealFormState {
  dealStartDate: string;
  name: string;
  companyName: string;
  productItem: string;
  stage: Stage;
  dealType: "New Deal" | "Recurring" | "Dealer";
  region: string;
  salesStatus: string;
  vatApplicable: boolean;
  agreedAmount: number;
  receivedAmount: number;
  outstandingAmount: number;
  earliestClosingDate: string;
  latestClosingDate: string;
  notes: string;
  lostReason: string;
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
  dealType: "New Deal",
  region: "",
  salesStatus: "25%",
  vatApplicable: false,
  agreedAmount: 0,
  receivedAmount: 0,
  outstandingAmount: 0,
  earliestClosingDate: "",
  latestClosingDate: "",
  notes: "",
  lostReason: "",
});

function toPayload(f: DealFormState) {
  return {
    dealStartDate: f.dealStartDate,
    name: f.name,
    companyName: f.companyName,
    productItem: f.productItem,
    stage: f.stage,
    dealType: f.dealType,
    region: f.region || undefined,
    salesStatus: f.salesStatus,
    vatApplicable: f.vatApplicable,
    agreedAmount: Number(f.agreedAmount),
    receivedAmount: Number(f.receivedAmount),
    outstandingAmount: Number(f.outstandingAmount),
    earliestClosingDate: f.earliestClosingDate || undefined,
    latestClosingDate: f.latestClosingDate || undefined,
    notes: f.notes || undefined,
    lostReason: f.stage === "Order Lost" ? (f.lostReason || undefined) : undefined,
  };
}

function missingFields(row: ImportRow): Set<keyof DealFormState> {
  const missing = new Set<keyof DealFormState>();
  if (!row.dealStartDate) missing.add("dealStartDate");
  if (!row.name?.trim()) missing.add("name");
  if (!row.companyName?.trim()) missing.add("companyName");
  if (!row.productItem?.trim()) missing.add("productItem");
  if (!row.stage?.trim()) missing.add("stage");
  if (!row.agreedAmount && row.agreedAmount !== 0) missing.add("agreedAmount");
  return missing;
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


// Month abbreviation → 1-based index
const MONTH_ABBR: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

/**
 * Convert any date value from Excel to YYYY-MM-DD.
 * Handles:
 *   - Excel serial number (e.g. 45000)
 *   - JS Date object
 *   - "DD/MM/YYYY" or "D/M/YYYY" or "DD/MM/YY"  ← most common in Middle East/UK
 *   - "DD-MM-YYYY" or "D-M-YYYY"
 *   - "YYYY/MM/DD"
 *   - "YYYY-MM-DD" or ISO string with time component
 *   - "9-Jan-25" / "9-Jan-2025"  (d-MMM-yy / d-MMM-yyyy)
 *   - Any string parseable by Date()
 * Returns "" for blank/unparseable values.
 */
function parseExcelDate(val: unknown): string {
  if (val === null || val === undefined || val === "") return "";

  // Excel serial number
  if (typeof val === "number") {
    const date = XLSX.SSF.parse_date_code(val);
    if (!date) return "";
    return `${date.y}-${String(date.m).padStart(2, "0")}-${String(date.d).padStart(2, "0")}`;
  }

  // JS Date object (returned by xlsx when cellDates: true)
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return "";
    const y = val.getFullYear();
    const m = val.getMonth() + 1;
    const d = val.getDate();
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

  const s = String(val).trim();
  if (!s) return "";

  // Already YYYY-MM-DD (or ISO datetime — just take the date part)
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);

  // "9-Jan-25" or "9-Jan-2025" (d-MMM-yy / d-MMM-yyyy)
  const dmyAbbr = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2,4})$/);
  if (dmyAbbr) {
    const day = parseInt(dmyAbbr[1], 10);
    const mon = MONTH_ABBR[dmyAbbr[2].toLowerCase()];
    let yr = parseInt(dmyAbbr[3], 10);
    if (yr < 100) yr += 2000;
    if (mon && day) return `${yr}-${String(mon).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  // DD/MM/YYYY or D/M/YYYY or DD/MM/YY  — assumed DD/MM (Middle East/UK convention)
  const slashMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (slashMatch) {
    let [, p1, p2, p3] = slashMatch;
    let d1 = parseInt(p1, 10), d2 = parseInt(p2, 10), yr = parseInt(p3, 10);
    if (yr < 100) yr += 2000;
    // If first part > 12 it's definitely the day → DD/MM/YYYY
    // If second part > 12 it's definitely the month — but we always treat as DD/MM here
    if (d1 <= 31 && d2 <= 12) {
      return `${yr}-${String(d2).padStart(2, "0")}-${String(d1).padStart(2, "0")}`;
    }
    // If d2 > 12 swap interpretation (MM/DD where month > 12 makes no sense)
    if (d2 > 12 && d1 <= 12) {
      return `${yr}-${String(d1).padStart(2, "0")}-${String(d2).padStart(2, "0")}`;
    }
  }

  // DD-MM-YYYY or D-M-YYYY  (numeric, not month-abbr — already caught above)
  const dashMatch = s.match(/^(\d{1,2})-(\d{1,2})-(\d{2,4})$/);
  if (dashMatch) {
    let d1 = parseInt(dashMatch[1], 10), d2 = parseInt(dashMatch[2], 10), yr = parseInt(dashMatch[3], 10);
    if (yr < 100) yr += 2000;
    if (d1 <= 31 && d2 <= 12) {
      return `${yr}-${String(d2).padStart(2, "0")}-${String(d1).padStart(2, "0")}`;
    }
  }

  // YYYY/MM/DD
  const isoSlash = s.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (isoSlash) {
    return `${isoSlash[1]}-${String(parseInt(isoSlash[2], 10)).padStart(2, "0")}-${String(parseInt(isoSlash[3], 10)).padStart(2, "0")}`;
  }

  // Fallback: let the JS Date parser try (works for RFC2822, locale strings, etc.)
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
  // Order / Deal Start Date
  "order start date": "dealStartDate", "deal start date": "dealStartDate",
  "start date": "dealStartDate", "date": "dealStartDate",
  "deal date": "dealStartDate", "order date": "dealStartDate",
  "commencement date": "dealStartDate",
  // Stage / Status
  "stage status": "stage", "stage": "stage", "status": "stage",
  "deal stage": "stage", "current stage": "stage",
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

function parseExcelRows(ws: XLSX.WorkSheet): { rows: ImportRow[]; skipped: number; detectedHeaders: string[] } {
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "", raw: true });
  if (json.length === 0) return { rows: [], skipped: 0, detectedHeaders: [] };

  const detectedHeaders = Object.keys(json[0]);
  const colMap = buildColumnMap(detectedHeaders);

  const get = (row: Record<string, unknown>, field: string): unknown => {
    const key = colMap[field];
    return key !== undefined ? row[key] : "";
  };
  const str = (row: Record<string, unknown>, field: string): string =>
    String(get(row, field) ?? "").trim();

  const allParsed = json.map((row, idx) => {
    const stageRaw = str(row, "stage");
    const stage: Stage = stageRaw ? normaliseStage(stageRaw) : "Quotation Sent";

    return {
      _rowIndex: idx + 2,
      name:              str(row, "name"),
      companyName:       str(row, "companyName"),
      productItem:       str(row, "productItem"),
      dealStartDate:     parseExcelDate(get(row, "dealStartDate")) || new Date().toISOString().split("T")[0],
      stage,
      salesStatus:       "25%",
      vatApplicable:     /^yes$/i.test(str(row, "vatApplicable")),
      agreedAmount:      parseAmount(get(row, "agreedAmount")),
      receivedAmount:    parseAmount(get(row, "receivedAmount")),
      outstandingAmount: parseAmount(get(row, "outstandingAmount")),
      earliestClosingDate: parseExcelDate(get(row, "earliestClosingDate")),
      latestClosingDate:   parseExcelDate(get(row, "latestClosingDate")),
      notes:             str(row, "notes"),
    } as ImportRow;
  });

  // Only drop rows where every meaningful field is blank (truly empty Excel rows)
  const rows = allParsed.filter(
    (r) => r.name || r.companyName || r.productItem || r.agreedAmount > 0 || r.dealStartDate
  );
  const skipped = allParsed.length - rows.length;

  return { rows, skipped, detectedHeaders };
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
    "Order Start Date":          todayStr,
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
  XLSX.utils.book_append_sheet(wb, ws, "Orders");
  XLSX.writeFile(wb, "star-crm-deals-template.xlsx");
}

function exportDealsToExcel(deals: Deal[] | undefined) {
  if (!deals?.length) return;
  const rows = deals.map((d) => ({
    "Order Start Date":    d.dealStartDate ? String(d.dealStartDate).split("T")[0] : "",
    "Customer Name":       d.name,
    "Company Name":        d.companyName,
    "Product / Item":      d.productItem,
    "Stage":               d.stage,
    "Order Type":          d.dealType ?? "",
    "Region":              d.region ?? "",
    "Sales Chances":       d.salesStatus ?? "",
    "VAT Applicable":      d.vatApplicable ? "Yes" : "No",
    "Price":               Number(d.agreedAmount) || 0,
    "Received Amount":     Number(d.receivedAmount) || 0,
    "Outstanding Amount":  Number(d.outstandingAmount) || 0,
    "Earliest Closing Date": d.earliestClosingDate ? String(d.earliestClosingDate).split("T")[0] : "",
    "Latest Closing Date":   d.latestClosingDate   ? String(d.latestClosingDate).split("T")[0]   : "",
    "Notes":               d.notes ?? "",
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = Object.keys(rows[0]).map((h) => ({ wch: Math.max(h.length + 2, 16) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Orders");
  const today = new Date().toISOString().split("T")[0];
  XLSX.writeFile(wb, `orders-${today}.xlsx`);
}

export default function Deals() {
  const { data: me } = useGetMe();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isOwner = me?.role === "owner";

  const { data: users } = useListUsers({ query: { enabled: isOwner } } as any);
  const salespersons = users?.filter((u) => u.role === "salesperson") ?? [];

  const [filterSpId, setFilterSpId] = useState<string>("all");

  const { data: deals, isLoading } = useListDeals(
    me?.role === "salesperson" ? { salespersonId: me.id } : undefined,
    { query: { enabled: !!me } as any }
  );

  const createDeal = useCreateDeal();
  const updateDeal = useUpdateDeal();
  const deleteDeal = useDeleteDeal();

  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [stageFilter, setStageFilter] = useState<Stage | "">("");
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
  const [importSkipped, setImportSkipped] = useState(0);
  const [importingNew, setImportingNew] = useState(false);
  const [importPhase, setImportPhase] = useState<"review" | "confirm-duplicates">("review");
  const [forceAddSelected, setForceAddSelected] = useState<Set<number>>(new Set());
  const [importProgress, setImportProgress] = useState<{ done: number; total: number } | null>(null);

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const filteredDeals = deals
    ?.filter((d) => {
      const dateStr = String(d.dealStartDate).split("T")[0];
      const q = search.toLowerCase();
      const matchesSearch =
        !q ||
        d.companyName.toLowerCase().includes(q) ||
        d.name.toLowerCase().includes(q) ||
        d.productItem.toLowerCase().includes(q);
      const matchesFrom  = !dateFrom     || dateStr >= dateFrom;
      const matchesTo    = !dateTo       || dateStr <= dateTo;
      const matchesStage = !stageFilter  || d.stage === stageFilter;
      const matchesSp    = !isOwner || filterSpId === "all" || d.salespersonId === Number(filterSpId);
      return matchesSearch && matchesFrom && matchesTo && matchesStage && matchesSp;
    })
    .slice()
    .sort((a, b) => {
      const da = a.dealStartDate ? new Date(a.dealStartDate).getTime() : 0;
      const db2 = b.dealStartDate ? new Date(b.dealStartDate).getTime() : 0;
      if (db2 !== da) return db2 - da;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  const totalDeals = filteredDeals?.length ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalDeals / pageSize));
  const safePage   = Math.min(page, totalPages);
  const pagedDeals = filteredDeals?.slice((safePage - 1) * pageSize, safePage * pageSize);

  const { formatAmount, currency: userCurrency } = useCurrency();
  const fmtCurrency = formatAmount;
  const formatCurrency = formatAmount;

  // Format an amount using the deal's own stored currency (falls back to user's currency)
  function fmtDealAmt(dealCurrency: string | null | undefined, amount: number): string {
    const cur = dealCurrency ?? userCurrency;
    try {
      return new Intl.NumberFormat("en-US", { style: "currency", currency: cur, maximumFractionDigits: 0 }).format(amount);
    } catch {
      return formatAmount(amount);
    }
  }

  const statsAgreed      = filteredDeals?.reduce((s, d) => s + (Number(d.agreedAmount)      || 0), 0) ?? 0;
  const statsReceived    = filteredDeals?.reduce((s, d) => s + (Number(d.receivedAmount)     || 0), 0) ?? 0;
  const statsOutstanding = filteredDeals?.reduce((s, d) => s + (Number(d.outstandingAmount)  || 0), 0) ?? 0;
  const stageCount  = (stage: string) => filteredDeals?.filter((d) => d.stage === stage).length ?? 0;
  const stageAmount = (stage: string) => filteredDeals?.filter((d) => d.stage === stage).reduce((s, d) => s + (Number(d.agreedAmount) || 0), 0) ?? 0;

  const cutoff90 = new Date();
  cutoff90.setDate(cutoff90.getDate() - 90);
  const cutoff90Str = cutoff90.toISOString().slice(0, 10);
  const quotationSent90 = filteredDeals?.filter((d) => d.stage === "Quotation Sent" && (d.dealStartDate ?? "") > cutoff90Str) ?? [];
  const quotationSent90Count  = quotationSent90.length;
  const quotationSent90Amount = quotationSent90.reduce((s, d) => s + (Number(d.agreedAmount) || 0), 0);

  // Reset to page 1 whenever filters or page size change
  const resetPage = () => setPage(1);

  function onSearchChange(v: string) { setSearch(v); resetPage(); }
  function onDateFromChange(v: string) { setDateFrom(v); resetPage(); }
  function onStageFilterChange(v: Stage | "") { setStageFilter(v); resetPage(); }
  function onDateToChange(v: string) { setDateTo(v); resetPage(); }
  function onPageSizeChange(v: number) { setPageSize(v); resetPage(); }

  function openAdd() {
    setEditingId(null);
    setForm(emptyForm());
    setFormOpen(true);
  }

  function openEdit(deal: NonNullable<typeof deals>[number]) {
    setEditingId(deal.id);
    setForm({
      dealStartDate: String(deal.dealStartDate).split("T")[0],
      name: deal.name,
      companyName: deal.companyName,
      productItem: deal.productItem,
      stage: deal.stage as Stage,
      dealType: (deal.dealType as "New Deal" | "Recurring" | "Dealer") ?? "New Deal",
      region: deal.region ?? "",
      salesStatus: deal.salesStatus,
      vatApplicable: deal.vatApplicable,
      agreedAmount: deal.agreedAmount,
      receivedAmount: deal.receivedAmount,
      outstandingAmount: deal.outstandingAmount,
      earliestClosingDate: deal.earliestClosingDate
          ? String(deal.earliestClosingDate).split("T")[0]
          : "",
      latestClosingDate: deal.latestClosingDate
          ? String(deal.latestClosingDate).split("T")[0]
          : "",
      notes: deal.notes ?? "",
      lostReason: deal.lostReason ?? "",
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
        const { rows, skipped, detectedHeaders } = parseExcelRows(ws);
        if (rows.length === 0) {
          const headerPreview = detectedHeaders.length
            ? `Columns detected: ${detectedHeaders.slice(0, 6).join(", ")}${detectedHeaders.length > 6 ? ` … (+${detectedHeaders.length - 6} more)` : ""}.`
            : "No column headers detected.";
          toast({
            title: "No importable rows found",
            description: `${headerPreview} The import needs at least a "Name", "Company Name", "Product", or "Amount" column with data. Download the template to see the expected format.`,
            variant: "destructive",
            duration: 9000,
          });
          return;
        }
        setImportRows(rows);
        setImportSkipped(skipped);
        setImportDuplicates([]);
        setForceAddSelected(new Set());
        setImportPhase("review");
        setImportProgress(null);
        setImportDialogOpen(true);
      } catch {
        toast({ title: "Failed to parse file", description: "Please use the downloaded Excel template.", variant: "destructive" });
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  }

  // Insert deals in batches of 50 (prevents timeouts on large imports)
  const IMPORT_BATCH = 50;
  async function importDealsSequentially(rows: ImportRow[]): Promise<number> {
    setImportProgress({ done: 0, total: rows.length });
    let successCount = 0;
    let lastError: string | null = null;
    for (let start = 0; start < rows.length; start += IMPORT_BATCH) {
      const batch = rows.slice(start, start + IMPORT_BATCH);
      try {
        const res = await fetch("/api/deals/bulk", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deals: batch.map(toPayload), force: true }),
        });
        const json = await res.json().catch(() => null);
        if (res.ok) {
          successCount += json?.imported?.length ?? 0;
        } else {
          const msg = json?.error ?? `HTTP ${res.status}`;
          console.error("[Import] Batch failed:", msg, json);
          lastError = msg;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[Import] Batch exception:", msg);
        lastError = msg;
      }
      setImportProgress({ done: Math.min(start + IMPORT_BATCH, rows.length), total: rows.length });
    }
    if (successCount === 0 && lastError) {
      throw new Error(lastError);
    }
    return successCount;
  }

  async function handleImport() {
    setImportingNew(true);
    try {
      // Client-side duplicate detection against already-loaded deals (no server round-trip)
      const existingKeys = new Set(
        (deals ?? []).map((d) =>
          `${d.name.trim().toLowerCase()}|${d.companyName.trim().toLowerCase()}`
        )
      );
      const newDeals: ImportRow[] = [];
      const duplicates: ImportRow[] = [];
      importRows.forEach((row) => {
        const key = `${String(row.name ?? "").trim().toLowerCase()}|${String(row.companyName ?? "").trim().toLowerCase()}`;
        (existingKeys.has(key) ? duplicates : newDeals).push(row);
      });

      if (duplicates.length > 0) {
        // Let user decide what to do with duplicates
        setImportRows(newDeals);
        setImportDuplicates(duplicates);
        setForceAddSelected(new Set());
        setImportProgress(null);
        setImportPhase("confirm-duplicates");
        setImportingNew(false);
      } else {
        // No duplicates — go straight to batched import with progress bar
        const count = await importDealsSequentially(importRows);
        await queryClient.invalidateQueries({ queryKey: getListDealsQueryKey() });
        const skippedMsg = importSkipped > 0 ? ` (${importSkipped} blank rows in file were skipped)` : "";
        toast({ title: "Import complete", description: `${count} deal${count !== 1 ? "s" : ""} added.${skippedMsg}` });
        setImportDialogOpen(false);
        setImportProgress(null);
        setImportingNew(false);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Please try again.";
      toast({ title: "Import failed", description: msg, variant: "destructive" });
      setImportProgress(null);
      setImportingNew(false);
    }
  }

  async function handleConfirmDuplicates() {
    const forceDuplicates = importDuplicates.filter((r) => forceAddSelected.has(r._rowIndex));
    const allDeals = [...importRows, ...forceDuplicates];
    setImportingNew(true);
    try {
      const count = await importDealsSequentially(allDeals);
      await queryClient.invalidateQueries({ queryKey: getListDealsQueryKey() });
      toast({ title: "Import complete", description: `${count} deal${count !== 1 ? "s" : ""} added.` });
      setImportDialogOpen(false);
      setImportProgress(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Please try again.";
      toast({ title: "Import failed", description: msg, variant: "destructive" });
      setImportProgress(null);
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
          <h1 className="text-3xl font-bold tracking-tight">Orders</h1>
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
          <Button variant="outline" onClick={() => exportDealsToExcel(filteredDeals)} title="Export current orders to Excel">
            <Download className="w-4 h-4 mr-2" />
            Export Excel
          </Button>
          <Button className="shrink-0" onClick={openAdd} data-testid="btn-add-deal">
            <Plus className="w-4 h-4 mr-2" />
            Add Order
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
            onChange={(e) => onSearchChange(e.target.value)}
            data-testid="input-search-deals"
          />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <CalendarRange className="w-4 h-4 text-muted-foreground" />
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => onDateFromChange(e.target.value)}
            className="h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            title="From date"
          />
          <span className="text-muted-foreground text-sm">to</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => onDateToChange(e.target.value)}
            className="h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            title="To date"
          />
          {(dateFrom || dateTo) && (
            <button
              onClick={() => { onDateFromChange(""); onDateToChange(""); }}
              className="text-xs text-muted-foreground hover:text-foreground underline"
            >
              Clear
            </button>
          )}
        </div>

        {/* Stage filter */}
        <select
          value={stageFilter}
          onChange={(e) => onStageFilterChange(e.target.value as Stage | "")}
          className="h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring shrink-0"
        >
          <option value="">All Stages</option>
          {STAGES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        {/* Salesperson filter — owner only */}
        {isOwner && salespersons.length > 0 && (
          <select
            value={filterSpId}
            onChange={(e) => { setFilterSpId(e.target.value); setPage(1); }}
            className="h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring shrink-0"
          >
            <option value="all">All Salespersons</option>
            {salespersons.map((u) => (
              <option key={u.id} value={String(u.id)}>{u.name ?? u.email}</option>
            ))}
          </select>
        )}
      </div>

      {/* ── Stat boxes ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">

        {/* Quotation Sent (within 90 days) */}
        <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Quotation Sent</span>
            <Clock4 className="w-4 h-4 text-muted-foreground" />
          </div>
          <p className="text-2xl font-bold tabular-nums">{quotationSent90Count}</p>
          <p className="text-xs text-muted-foreground">Within 90 days</p>
          <p className="text-xs font-medium text-muted-foreground tabular-nums">{fmtCurrency(quotationSent90Amount)}</p>
        </div>

        {/* Confirmed Orders */}
        <div className="bg-card border border-border border-l-4 border-l-yellow-500 rounded-xl p-4 flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Confirmed Orders</span>
            <CheckCircle2 className="w-4 h-4 text-yellow-500" />
          </div>
          <p className="text-2xl font-bold tabular-nums text-yellow-600 dark:text-yellow-400">
            {stageCount("Order Confirmed")}
          </p>
          <p className="text-xs font-medium text-yellow-700 dark:text-yellow-300 tabular-nums">
            {fmtCurrency(stageAmount("Order Confirmed"))}
          </p>
        </div>

        {/* Closed Orders */}
        <div className="bg-card border border-border border-l-4 border-l-green-500 rounded-xl p-4 flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Closed Orders</span>
            <Handshake className="w-4 h-4 text-green-500" />
          </div>
          <p className="text-2xl font-bold tabular-nums text-green-600 dark:text-green-400">
            {stageCount("Order Closed")}
          </p>
          <p className="text-xs font-medium text-green-700 dark:text-green-300 tabular-nums">
            {fmtCurrency(stageAmount("Order Closed"))}
          </p>
        </div>

        {/* Received Amount */}
        <div className="bg-card border border-border border-l-4 border-l-blue-500 rounded-xl p-4 flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Received Amount</span>
            <Wallet className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-2xl font-bold tabular-nums text-blue-600 dark:text-blue-400">
            {fmtCurrency(statsReceived)}
          </p>
          <p className="text-xs text-muted-foreground">total collected</p>
        </div>

        {/* Lost Orders */}
        <div className="bg-card border border-border border-l-4 border-l-red-500 rounded-xl p-4 flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Lost Orders</span>
            <XCircle className="w-4 h-4 text-red-500" />
          </div>
          <p className="text-2xl font-bold tabular-nums text-red-600 dark:text-red-400">
            {stageCount("Order Lost")}
          </p>
          <p className="text-xs font-medium text-red-700 dark:text-red-300 tabular-nums">
            {fmtCurrency(stageAmount("Order Lost"))}
          </p>
        </div>

      </div>

      <div className="border border-border rounded-lg bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-secondary/50">
              <TableHead>Start Date</TableHead>
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
            {pagedDeals?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  No deals found
                </TableCell>
              </TableRow>
            ) : (
              pagedDeals?.map((deal) => (
                <TableRow key={deal.id} data-testid={`row-deal-${deal.id}`}>
                  <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                    {deal.dealStartDate
                      ? new Date(
                          typeof deal.dealStartDate === "string"
                            ? deal.dealStartDate.split("T")[0] + "T00:00:00"
                            : deal.dealStartDate
                        ).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
                      : "—"}
                  </TableCell>
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
                    {fmtDealAmt((deal as any).currency, deal.agreedAmount)}
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

      {/* ── Pagination ── */}
      {totalDeals > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Rows per page:</span>
            {[50, 100, 200].map((n) => (
              <button
                key={n}
                onClick={() => onPageSizeChange(n)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${pageSize === n ? "bg-primary text-primary-foreground" : "bg-secondary hover:bg-secondary/80"}`}
              >
                {n}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 text-sm">
            <span className="text-muted-foreground mr-2 tabular-nums">
              {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, totalDeals)} of {totalDeals}
            </span>
            <button
              onClick={() => setPage(1)}
              disabled={safePage === 1}
              className="px-2 py-1 rounded-md bg-secondary text-xs font-medium disabled:opacity-40 hover:bg-secondary/80 transition-colors"
              title="First page"
            >
              «
            </button>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage === 1}
              className="px-2.5 py-1 rounded-md bg-secondary text-xs font-medium disabled:opacity-40 hover:bg-secondary/80 transition-colors"
            >
              Previous
            </button>
            <span className="px-3 py-1 rounded-md bg-primary/10 text-primary text-xs font-semibold tabular-nums">
              {safePage} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              className="px-2.5 py-1 rounded-md bg-secondary text-xs font-medium disabled:opacity-40 hover:bg-secondary/80 transition-colors"
            >
              Next
            </button>
            <button
              onClick={() => setPage(totalPages)}
              disabled={safePage === totalPages}
              className="px-2 py-1 rounded-md bg-secondary text-xs font-medium disabled:opacity-40 hover:bg-secondary/80 transition-colors"
              title="Last page"
            >
              »
            </button>
          </div>
        </div>
      )}

      {/* Add / Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId !== null ? "Edit Order" : "Add Order"}</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
            <div className="space-y-1.5">
              <Label>Customer Name *</Label>
              <AutocompleteInput
                value={form.name}
                onChange={(v) => set("name", v)}
                lookupType="customer"
                placeholder="e.g. Q3 Enterprise Renewal"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Company Name *</Label>
              <AutocompleteInput
                value={form.companyName}
                onChange={(v) => set("companyName", v)}
                lookupType="company"
                placeholder="e.g. Acme Corp"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Product / Item *</Label>
              <AutocompleteInput
                value={form.productItem}
                onChange={(v) => set("productItem", v)}
                lookupType="product"
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
              <Select
                value={form.stage}
                onValueChange={(v) => {
                  const stage = v as Stage;
                  set("stage", stage);
                  if (stage !== "Order Lost") set("lostReason", "");
                }}
              >
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
            {(form.stage === "Quotation Sent" || form.stage === "Order Confirmed") && (
              <div className="space-y-1.5">
                <Label>
                  Expected Closure Date
                  <span className="ml-1 text-xs text-muted-foreground">(optional)</span>
                </Label>
                <DatePicker
                  value={form.earliestClosingDate}
                  onChange={(v) => set("earliestClosingDate", v)}
                  placeholder="Pick a date"
                />
              </div>
            )}
            {form.stage === "Order Lost" && (
              <div className="space-y-1.5">
                <Label>
                  Lost Reason *
                </Label>
                <Select
                  value={form.lostReason || "__none__"}
                  onValueChange={(v) => set("lostReason", v === "__none__" ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a reason…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— No reason selected —</SelectItem>
                    {LOST_REASONS.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>
                Order Type
                <span className="ml-1 text-xs text-muted-foreground">(optional)</span>
              </Label>
              <Select
                value={form.dealType}
                onValueChange={(v) => set("dealType", v as "New Deal" | "Recurring" | "Dealer")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="New Deal">New Customer</SelectItem>
                  <SelectItem value="Recurring">Existing Customer</SelectItem>
                  <SelectItem value="Dealer">Dealer Customer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>
                Region
                <span className="ml-1 text-xs text-muted-foreground">(optional)</span>
              </Label>
              <Select value={form.region || "__none__"} onValueChange={(v) => set("region", v === "__none__" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a country…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— None —</SelectItem>
                  <SelectItem value="United Arab Emirates">United Arab Emirates</SelectItem>
                  <SelectItem value="Qatar">Qatar</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Sales Chances</Label>
              <Select value={form.salesStatus} onValueChange={(v) => set("salesStatus", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select chances" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="25%">25%</SelectItem>
                  <SelectItem value="50%">50%</SelectItem>
                  <SelectItem value="75%">75%</SelectItem>
                  <SelectItem value="100%">100%</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Price ($)</Label>
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
              disabled={saving || !form.name || !form.companyName || !form.productItem || (form.stage === "Order Lost" && !form.lostReason)}
              data-testid="btn-save-deal"
            >
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {editingId !== null ? "Save Changes" : "Create Order"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Order</AlertDialogTitle>
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
                  Review Import — {importRows.length} deal{importRows.length !== 1 ? "s" : ""} found{importSkipped > 0 ? ` (${importSkipped} blank rows skipped)` : ""}
                </>
              ) : (
                <>
                  <AlertTriangle className="w-5 h-5 text-yellow-500" />
                  Duplicate Orders Detected
                </>
              )}
            </DialogTitle>
          </DialogHeader>

          {importPhase === "review" ? (
            <>
              {(() => {
                const invalidRows = importRows.filter((r) => missingFields(r).size > 0);
                return (
                  <div className="space-y-2 px-1">
                    <p className="text-sm text-muted-foreground">
                      Review the deals parsed from your file. All rows will be imported — rows with missing required fields are highlighted in red and will use defaults.
                    </p>
                    {invalidRows.length > 0 && (
                      <div className="flex items-center gap-2 rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 text-xs text-destructive font-medium">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        {invalidRows.length} row{invalidRows.length !== 1 ? "s are" : " is"} missing required fields — highlighted below.
                        Required: Start Date, Name, Company, Product, Stage, Agreed Amount.
                      </div>
                    )}
                  </div>
                );
              })()}
              <div className="flex-1 overflow-auto mt-2 rounded-md border border-border">
                <table className="w-full text-xs">
                  <thead className="bg-muted/60 sticky top-0">
                    <tr>
                      <th className="px-2 py-2 text-left font-semibold">#</th>
                      <th className="px-2 py-2 text-left font-semibold">Start Date <span className="text-destructive">*</span></th>
                      <th className="px-2 py-2 text-left font-semibold">Order Name <span className="text-destructive">*</span></th>
                      <th className="px-2 py-2 text-left font-semibold">Company <span className="text-destructive">*</span></th>
                      <th className="px-2 py-2 text-left font-semibold">Product <span className="text-destructive">*</span></th>
                      <th className="px-2 py-2 text-left font-semibold">Stage <span className="text-destructive">*</span></th>
                      <th className="px-2 py-2 text-right font-semibold">Agreed <span className="text-destructive">*</span></th>
                      <th className="px-2 py-2 text-left font-semibold">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importRows.map((row) => {
                      const missing = missingFields(row);
                      const hasIssue = missing.size > 0;
                      const cell = (field: keyof DealFormState, content: React.ReactNode, extraClass = "") =>
                        missing.has(field)
                          ? <td className={`px-2 py-1.5 bg-destructive/10 text-destructive font-medium ${extraClass}`}>
                              <span className="flex items-center gap-1"><AlertTriangle className="w-3 h-3 shrink-0" />missing</span>
                            </td>
                          : <td className={`px-2 py-1.5 ${extraClass}`}>{content}</td>;
                      return (
                        <tr key={row._rowIndex} className={`border-t border-border/40 ${hasIssue ? "bg-destructive/5" : "hover:bg-muted/20"}`}>
                          <td className={`px-2 py-1.5 font-medium ${hasIssue ? "text-destructive" : "text-muted-foreground"}`}>{row._rowIndex}</td>
                          {cell("dealStartDate", <span className="text-muted-foreground">{row.dealStartDate}</span>)}
                          {cell("name", <span className="font-medium">{row.name}</span>)}
                          {cell("companyName", row.companyName)}
                          {cell("productItem", <span className="text-muted-foreground">{row.productItem}</span>)}
                          {missing.has("stage")
                            ? <td className="px-2 py-1.5 bg-destructive/10 text-destructive font-medium"><span className="flex items-center gap-1"><AlertTriangle className="w-3 h-3 shrink-0" />missing</span></td>
                            : <td className="px-2 py-1.5"><Badge variant="outline" className={`text-[10px] border-0 ${getStageColor(row.stage)}`}>{row.stage}</Badge></td>
                          }
                          {cell("agreedAmount", formatCurrency(row.agreedAmount), "text-right")}
                          <td className="px-2 py-1.5 text-muted-foreground max-w-[120px] truncate">{row.notes}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {importProgress && (
                <div className="mt-3 space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Importing deals…</span>
                    <span className="font-medium tabular-nums">{importProgress.done} / {importProgress.total}</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-secondary overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-200"
                      style={{ width: `${Math.round((importProgress.done / importProgress.total) * 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground text-right">
                    {importProgress.total - importProgress.done} remaining
                  </p>
                </div>
              )}
              <DialogFooter className="mt-2">
                <Button variant="outline" onClick={() => setImportDialogOpen(false)} disabled={importingNew}>Cancel</Button>
                <Button onClick={handleImport} disabled={importingNew || importRows.length === 0}>
                  {importingNew ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                  {importingNew ? "Importing…" : `Import ${importRows.length} Order${importRows.length !== 1 ? "s" : ""}`}
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
                          <th className="text-left pb-1">Order Name</th>
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
                        <th className="text-left pb-1">Order Name</th>
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

              {importProgress && (
                <div className="mt-3 space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Importing deals…</span>
                    <span className="font-medium tabular-nums">{importProgress.done} / {importProgress.total}</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-secondary overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-200"
                      style={{ width: `${Math.round((importProgress.done / importProgress.total) * 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground text-right">
                    {importProgress.total - importProgress.done} remaining
                  </p>
                </div>
              )}
              <DialogFooter className="mt-2">
                <Button variant="outline" onClick={() => setImportDialogOpen(false)} disabled={importingNew}>Cancel</Button>
                <Button onClick={handleConfirmDuplicates} disabled={importingNew}>
                  {importingNew ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                  {importingNew
                    ? "Importing…"
                    : `Import ${importRows.length + forceAddSelected.size} Order${(importRows.length + forceAddSelected.size) !== 1 ? "s" : ""}`}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
