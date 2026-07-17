import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { usePersistedState } from "@/hooks/usePersistedState";
import { Plus, Pencil, Trash2, Loader2, Search, ChevronDown, X, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { COUNTRY_CODES } from "@/data/countryCodes";
import { countryLabel } from "@/utils/countryNames";

interface Lead {
  id: number;
  leadSource: string;
  dateTime: string;
  customerName: string;
  companyName: string | null;
  mobileCountryCode: string;
  mobileNumber: string;
  email: string | null;
  region: string;
  brand: string;
  model: string;
  closure: string;
  notes: string | null;
  assignedToId: number;
  assignedToName: string | null;
  leadStatus: string;
  nextFollowUpDate: string;
  followUpRemarks: string | null;
  createdById: number;
  createdAt: string;
}

interface UserOption { id: number; name: string | null; email: string; }
interface RegionOption { country: string; currency: string | null; }

interface LeadForm {
  leadSource: string;
  dateTime: string;
  customerName: string;
  companyName: string;
  mobileCountryCode: string;
  mobileNumber: string;
  email: string;
  region: string;
  brand: string;
  model: string;
  closure: string;
  notes: string;
  assignedToId: string;
  leadStatus: string;
  nextFollowUpDate: string;
  followUpRemarks: string;
}

const LEAD_SOURCES = [
  "Walk-in", "Phone Call", "Email", "Social Media", "Referral",
  "Website", "Exhibition", "Cold Call", "WhatsApp", "Other",
];
const LEAD_STATUSES = ["Quotation Sent", "Confirmed Orders", "Closed Orders", "Lost Orders", "Other"];
const CLOSURE_OPTIONS = [
  "Immediately", "Within 1 Month", "1-3 Months",
  "3-6 Months", "6-12 Months", "More than 1 Year", "Other",
];
const STATUS_COLORS: Record<string, string> = {
  "Quotation Sent":    "bg-blue-500/15 text-blue-400",
  "Confirmed Orders":  "bg-violet-500/15 text-violet-400",
  "Closed Orders":     "bg-emerald-500/15 text-emerald-400",
  "Lost Orders":       "bg-red-500/15 text-red-400",
  "Other":         "bg-secondary text-muted-foreground",
};

const emptyForm = (): LeadForm => ({
  leadSource: "",
  dateTime: new Date().toISOString().slice(0, 16),
  customerName: "",
  companyName: "",
  mobileCountryCode: "+971",
  mobileNumber: "",
  email: "",
  region: "",
  brand: "",
  model: "",
  closure: "",
  notes: "",
  assignedToId: "",
  leadStatus: "Quotation Sent",
  nextFollowUpDate: "",
  followUpRemarks: "",
});

async function apiFetch(path: string, opts?: RequestInit) {
  const res = await fetch(path, { credentials: "include", ...opts });
  if (!res.ok) throw new Error(await res.text());
  if (res.status === 204) return null;
  return res.json();
}

const selClass = "w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring";
const otherInputClass = "mt-1.5";

/* Helper: detect if a value is "non-standard" (was typed via Other) */
function detectOther(value: string, knownOptions: string[]): { formVal: string; otherVal: string } {
  if (!value) return { formVal: "", otherVal: "" };
  const known = knownOptions.filter((o) => o !== "Other");
  if (known.includes(value)) return { formVal: value, otherVal: "" };
  return { formVal: "Other", otherVal: value };
}

/* ── Searchable Model Dropdown ─────────────────────────────────── */
function ModelCombobox({
  models,
  value,
  onChange,
  loading,
  disabled,
}: {
  models: string[];
  value: string;
  onChange: (v: string) => void;
  loading: boolean;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = models.filter((m) => m.toLowerCase().includes(search.toLowerCase()));
  const allOptions = [...filtered, "Other"];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const select = (v: string) => {
    onChange(v);
    setOpen(false);
    setSearch("");
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          setOpen((o) => !o);
          setTimeout(() => inputRef.current?.focus(), 50);
        }}
        className={`${selClass} flex items-center justify-between gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        <span className={value ? "text-foreground" : "text-muted-foreground"}>
          {loading ? "Loading models…" : value || (disabled ? "Select a brand first" : "Select model")}
        </span>
        {loading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0 text-muted-foreground" />
        ) : value ? (
          <X
            className="w-3.5 h-3.5 shrink-0 text-muted-foreground hover:text-foreground"
            onClick={(e) => { e.stopPropagation(); onChange(""); }}
          />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className="absolute z-50 left-0 right-0 top-[calc(100%+4px)] rounded-md border border-border bg-popover shadow-lg overflow-hidden">
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <input
                ref={inputRef}
                type="text"
                placeholder="Search model…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-8 pl-8 pr-3 rounded border border-input bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>
          <div className="max-h-52 overflow-y-auto">
            {allOptions.length === 0 ? (
              <div className="px-3 py-4 text-sm text-center text-muted-foreground">No models found</div>
            ) : (
              allOptions.map((m) => (
                <button
                  key={m}
                  type="button"
                  onMouseDown={() => select(m)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors ${
                    value === m ? "bg-accent font-medium" : ""
                  } ${m === "Other" ? "text-muted-foreground italic border-t border-border mt-0.5" : ""}`}
                >
                  {m}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Main Component ────────────────────────────────────────────── */
export default function Leads() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const connectToOrder = (lead: Lead) => {
    const leadStatusToOrderType: Record<string, string> = {
      "Quotation Sent":   "New",
      "Confirmed Orders": "New",
      "Closed Orders":    "New",
      "Lost Orders":      "New",
    };
    const params = new URLSearchParams();
    params.set("fromLead", "1");
    if (lead.customerName) params.set("customerName", lead.customerName);
    if (lead.companyName)  params.set("companyName", lead.companyName);
    const phone = [lead.mobileCountryCode, lead.mobileNumber].filter(Boolean).join(" ");
    if (phone) params.set("phone", phone);
    if (lead.email)  params.set("email", lead.email);
    if (lead.region) params.set("region", lead.region);
    const orderType = leadStatusToOrderType[lead.leadStatus] ?? "";
    if (orderType) params.set("orderType", orderType);
    if (lead.brand) params.set("brand", lead.brand);
    if (lead.model) params.set("model", lead.model);
    if (lead.leadSource) params.set("leadSource", lead.leadSource);
    navigate(`/orders/new?${params.toString()}`);
  };

  const [leads, setLeads]         = useState<Lead[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = usePersistedState<string>("leads:search", "");
  const [statusFilter, setStatusFilter] = usePersistedState<string>("leads:statusFilter", "all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm]           = useState<LeadForm>(emptyForm());
  const [saving, setSaving]       = useState(false);
  const [deleteId, setDeleteId]   = useState<number | null>(null);

  const [users, setUsers]         = useState<UserOption[]>([]);
  const [regions, setRegions]     = useState<RegionOption[]>([]);
  const [brands, setBrands]       = useState<string[]>([]);
  const [models, setModels]       = useState<string[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);

  /* "Other" free-text values, keyed by form field name */
  const [otherText, setOtherText] = useState<Record<string, string>>({});
  const setOther = (field: string, val: string) =>
    setOtherText((p) => ({ ...p, [field]: val }));

  /* Resolve a field value: if "Other", use the typed text instead */
  const resolve = (val: string, key: string) =>
    val === "Other" ? (otherText[key]?.trim() ?? "") : val;

  const loadLeads = () => {
    setLoading(true);
    apiFetch("/api/leads")
      .then((d) => setLeads(Array.isArray(d) ? d : []))
      .catch(() => toast({ title: "Failed to load leads", variant: "destructive" }))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadLeads();
    apiFetch("/api/users").then((d) => setUsers(Array.isArray(d) ? d : [])).catch(() => {});
    apiFetch("/api/lookup/regions").then((d) => setRegions(Array.isArray(d) ? d : [])).catch(() => {});
    apiFetch("/api/products-catalog/brands").then((d) => setBrands(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  /* Fetch models whenever the selected brand changes */
  useEffect(() => {
    if (!form.brand || form.brand === "Other") {
      setModels([]);
      return;
    }
    setModelsLoading(true);
    apiFetch(`/api/products-catalog/lookup?brand=${encodeURIComponent(form.brand)}`)
      .then((rows: any[]) => {
        const unique = [...new Set((rows ?? []).map((r: any) => r.model).filter(Boolean))].sort() as string[];
        setModels(unique);
      })
      .catch(() => setModels([]))
      .finally(() => setModelsLoading(false));
  }, [form.brand]);

  const sf = (field: keyof LeadForm, value: string) => {
    if (field === "brand") {
      setForm((f) => ({ ...f, brand: value, model: "" }));
      /* clear model's Other text when brand changes */
      setOtherText((p) => ({ ...p, model: "" }));
    } else {
      setForm((f) => ({ ...f, [field]: value }));
    }
  };

  const openAdd = () => {
    setEditingId(null);
    setForm({ ...emptyForm(), assignedToId: user ? String(user.id) : "" });
    setOtherText({});
    setModels([]);
    setModalOpen(true);
  };

  const openEdit = (lead: Lead) => {
    setEditingId(lead.id);

    /* Detect which stored values were typed via "Other" */
    const newOther: Record<string, string> = {};

    const src = detectOther(lead.leadSource, LEAD_SOURCES);
    if (src.otherVal) newOther.leadSource = src.otherVal;

    const reg = detectOther(lead.region, regions.map((r) => r.country));
    if (reg.otherVal) newOther.region = reg.otherVal;

    const br = detectOther(lead.brand, brands);
    if (br.otherVal) newOther.brand = br.otherVal;

    /* Model: if brand resolved to "Other", model is free text */
    if (br.formVal === "Other" && lead.model) {
      newOther.model = lead.model;
    } else {
      /* Brand is known — model will be validated against loaded list later;
         for now store it so the combobox shows the right value */
    }

    const cls = detectOther(lead.closure, CLOSURE_OPTIONS);
    if (cls.otherVal) newOther.closure = cls.otherVal;

    const st = detectOther(lead.leadStatus, LEAD_STATUSES);
    if (st.otherVal) newOther.leadStatus = st.otherVal;

    setOtherText(newOther);
    setForm({
      leadSource:        src.formVal || lead.leadSource,
      dateTime:          lead.dateTime ? lead.dateTime.slice(0, 16) : "",
      customerName:      lead.customerName,
      companyName:       lead.companyName ?? "",
      mobileCountryCode: lead.mobileCountryCode,
      mobileNumber:      lead.mobileNumber,
      email:             lead.email ?? "",
      region:            reg.formVal || lead.region,
      brand:             br.formVal || lead.brand,
      model:             br.formVal === "Other" ? "" : lead.model,
      closure:           cls.formVal || lead.closure,
      notes:             lead.notes ?? "",
      assignedToId:      String(lead.assignedToId),
      leadStatus:        st.formVal || lead.leadStatus,
      nextFollowUpDate:  lead.nextFollowUpDate ?? "",
      followUpRemarks:   lead.followUpRemarks ?? "",
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    /* Resolve "Other" fields to their typed text before validating */
    const resolvedBrand  = resolve(form.brand,      "brand");
    const resolvedModel  = form.brand === "Other"
      ? (otherText.model?.trim() ?? "")
      : resolve(form.model, "model");
    const resolvedSource  = resolve(form.leadSource, "leadSource");
    const resolvedRegion  = resolve(form.region,     "region");
    const resolvedClosure = resolve(form.closure,    "closure");
    const resolvedStatus  = resolve(form.leadStatus, "leadStatus");

    const requiredResolved: [string, string][] = [
      ["Lead Source",        resolvedSource],
      ["Customer Name",      form.customerName],
      ["Mobile Number",      form.mobileNumber],
      ["Region",             resolvedRegion],
      ["Brand",              resolvedBrand],
      ["Model",              resolvedModel],
      ["Closure",            resolvedClosure],
      ["Assigned Employee",  form.assignedToId],
      ["Next Follow-up Date",form.nextFollowUpDate],
    ];
    const missing = requiredResolved.find(([, v]) => !v);
    if (missing) {
      toast({ title: `Please fill in: ${missing[0]}`, variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const body = {
        ...form,
        leadSource:  resolvedSource,
        region:      resolvedRegion,
        brand:       resolvedBrand,
        model:       resolvedModel,
        closure:     resolvedClosure,
        leadStatus:  resolvedStatus || form.leadStatus,
        assignedToId: Number(form.assignedToId),
      };
      if (editingId) {
        await apiFetch(`/api/leads/${editingId}`, {
          method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        });
        toast({ title: "Lead updated successfully" });
      } else {
        await apiFetch("/api/leads", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        });
        toast({ title: "Lead created successfully" });
      }
      setModalOpen(false);
      loadLeads();
    } catch {
      toast({ title: "Failed to save lead", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await apiFetch(`/api/leads/${deleteId}`, { method: "DELETE" });
      toast({ title: "Lead deleted" });
      loadLeads();
    } catch {
      toast({ title: "Failed to delete lead", variant: "destructive" });
    } finally {
      setDeleteId(null);
    }
  };

  const filtered = leads.filter((l) => {
    const q = search.toLowerCase();
    const matchSearch = !search
      || l.customerName.toLowerCase().includes(q)
      || (l.companyName ?? "").toLowerCase().includes(q)
      || l.mobileNumber.includes(q);
    const matchStatus = statusFilter === "all" || l.leadStatus === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Lead Management</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Track and manage your sales leads</p>
        </div>
        <Button onClick={openAdd} className="gap-2">
          <Plus className="w-4 h-4" />
          Add Lead
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search name, company, mobile…"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="all">All Statuses</option>
          {LEAD_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <span className="text-xs text-muted-foreground ml-1">{filtered.length} lead{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Table */}
      <div className="border border-border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead>Lead Source</TableHead>
              <TableHead>Mobile</TableHead>
              <TableHead>Region</TableHead>
              <TableHead>Brand / Model</TableHead>
              <TableHead>Closure</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Assigned To</TableHead>
              <TableHead>Follow-up</TableHead>
              <TableHead className="w-[80px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-14">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-14 text-muted-foreground">
                  No leads found
                </TableCell>
              </TableRow>
            ) : filtered.map((lead) => (
              <TableRow key={lead.id}>
                <TableCell>
                  <div className="font-medium text-sm">{lead.customerName}</div>
                  {lead.companyName && (
                    <div className="text-xs text-muted-foreground">{lead.companyName}</div>
                  )}
                </TableCell>
                <TableCell className="text-sm">{lead.leadSource}</TableCell>
                <TableCell className="text-sm tabular-nums">
                  {lead.mobileCountryCode} {lead.mobileNumber}
                </TableCell>
                <TableCell className="text-sm">{lead.region}</TableCell>
                <TableCell className="text-sm">
                  <span className="font-medium">{lead.brand}</span>
                  <span className="text-muted-foreground"> / {lead.model}</span>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{lead.closure}</TableCell>
                <TableCell>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[lead.leadStatus] ?? "bg-secondary text-muted-foreground"}`}>
                    {lead.leadStatus}
                  </span>
                </TableCell>
                <TableCell className="text-sm">{lead.assignedToName ?? "—"}</TableCell>
                <TableCell className="text-sm tabular-nums">{lead.nextFollowUpDate}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEdit(lead)}
                      className="p-1.5 rounded hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
                      title="Edit lead"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => connectToOrder(lead)}
                      className="p-1.5 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                      title="Connect to order"
                    >
                      <Link2 className="w-3.5 h-3.5" />
                    </button>
                    {user?.role === "owner" && (
                      <button
                        onClick={() => setDeleteId(lead.id)}
                        className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                        title="Delete lead"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Add / Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Lead" : "Add New Lead"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-1">

            {/* Lead Source + Date & Time */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Lead Source (Means) <span className="text-destructive">*</span></Label>
                <select value={form.leadSource} onChange={(e) => sf("leadSource", e.target.value)} className={selClass}>
                  <option value="">Select Lead Source</option>
                  {LEAD_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                {form.leadSource === "Other" && (
                  <Input
                    className={otherInputClass}
                    placeholder="Please specify lead source…"
                    value={otherText.leadSource ?? ""}
                    onChange={(e) => setOther("leadSource", e.target.value)}
                  />
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Date &amp; Time</Label>
                <Input type="datetime-local" value={form.dateTime} onChange={(e) => sf("dateTime", e.target.value)} />
              </div>
            </div>

            {/* Customer Name + Company Name */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Customer Name <span className="text-destructive">*</span></Label>
                <Input placeholder="Enter customer name" value={form.customerName} onChange={(e) => sf("customerName", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Company Name</Label>
                <Input placeholder="Enter company name" value={form.companyName} onChange={(e) => sf("companyName", e.target.value)} />
              </div>
            </div>

            {/* Mobile + Email */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Mobile Number <span className="text-destructive">*</span></Label>
                <div className="flex gap-2">
                  <select
                    value={form.mobileCountryCode}
                    onChange={(e) => sf("mobileCountryCode", e.target.value)}
                    className="h-9 rounded-md border border-input bg-background px-2 text-sm w-[110px] shrink-0 focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    {COUNTRY_CODES.map((c) => (
                      <option key={c.code} value={c.code}>{c.flag} {c.code}</option>
                    ))}
                  </select>
                  <Input placeholder="50 123 4567" value={form.mobileNumber} onChange={(e) => sf("mobileNumber", e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" placeholder="Enter email address" value={form.email} onChange={(e) => sf("email", e.target.value)} />
              </div>
            </div>

            {/* Region */}
            <div className="space-y-1.5">
              <Label>Regions/Country <span className="text-destructive">*</span></Label>
              <select value={form.region} onChange={(e) => sf("region", e.target.value)} className={selClass}>
                <option value="">Select region / country</option>
                {regions.map((r) => <option key={r.country} value={r.country}>{countryLabel(r.country)}</option>)}
                <option value="Other">Other</option>
              </select>
              {form.region === "Other" && (
                <Input
                  className={otherInputClass}
                  placeholder="Please specify region / country…"
                  value={otherText.region ?? ""}
                  onChange={(e) => setOther("region", e.target.value)}
                />
              )}
            </div>

            {/* Brand + Model */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Brand <span className="text-destructive">*</span></Label>
                <select value={form.brand} onChange={(e) => sf("brand", e.target.value)} className={selClass}>
                  <option value="">Select brand</option>
                  {brands.map((b) => <option key={b} value={b}>{b}</option>)}
                  <option value="Other">Other</option>
                </select>
                {form.brand === "Other" && (
                  <Input
                    className={otherInputClass}
                    placeholder="Please specify brand…"
                    value={otherText.brand ?? ""}
                    onChange={(e) => setOther("brand", e.target.value)}
                  />
                )}
              </div>

              <div className="space-y-1.5">
                <Label>Model <span className="text-destructive">*</span></Label>
                {/* When brand is "Other", show a plain text input for model */}
                {form.brand === "Other" ? (
                  <Input
                    placeholder="Enter model…"
                    value={otherText.model ?? ""}
                    onChange={(e) => setOther("model", e.target.value)}
                  />
                ) : (
                  <>
                    <ModelCombobox
                      models={models}
                      value={form.model}
                      onChange={(v) => sf("model", v)}
                      loading={modelsLoading}
                      disabled={!form.brand}
                    />
                    {form.model === "Other" && (
                      <Input
                        className={otherInputClass}
                        placeholder="Please specify model…"
                        value={otherText.model ?? ""}
                        onChange={(e) => setOther("model", e.target.value)}
                      />
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Closure */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Closure (Expected Purchase Time) <span className="text-destructive">*</span></Label>
                <select value={form.closure} onChange={(e) => sf("closure", e.target.value)} className={selClass}>
                  <option value="">Select closure</option>
                  {CLOSURE_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                {form.closure === "Other" && (
                  <Input
                    className={otherInputClass}
                    placeholder="Please specify expected purchase time…"
                    value={otherText.closure ?? ""}
                    onChange={(e) => setOther("closure", e.target.value)}
                  />
                )}
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label>Additional Requirements / Notes</Label>
              <Textarea
                placeholder="Enter details about requirement (optional)"
                value={form.notes}
                onChange={(e) => sf("notes", e.target.value)}
                rows={3}
              />
            </div>

            {/* Employee + Lead Status */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>All Employee <span className="text-destructive">*</span></Label>
                <select value={form.assignedToId} onChange={(e) => sf("assignedToId", e.target.value)} className={selClass}>
                  <option value="">Select employee</option>
                  {users.map((u) => (
                    <option key={u.id} value={String(u.id)}>{u.name ?? u.email}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Lead Status <span className="text-destructive">*</span></Label>
                <select value={form.leadStatus} onChange={(e) => sf("leadStatus", e.target.value)} className={selClass}>
                  {LEAD_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                {form.leadStatus === "Other" && (
                  <Input
                    className={otherInputClass}
                    placeholder="Please specify lead status…"
                    value={otherText.leadStatus ?? ""}
                    onChange={(e) => setOther("leadStatus", e.target.value)}
                  />
                )}
              </div>
            </div>

            {/* Next Follow-up Date + Remarks */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Next Follow-up Date <span className="text-destructive">*</span></Label>
                <Input type="date" value={form.nextFollowUpDate} onChange={(e) => sf("nextFollowUpDate", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Follow-up Remarks</Label>
                <Input placeholder="Enter follow-up remarks…" value={form.followUpRemarks} onChange={(e) => sf("followUpRemarks", e.target.value)} />
              </div>
            </div>

          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {editingId ? "Update Lead" : "Create Lead"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Lead</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the lead. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
