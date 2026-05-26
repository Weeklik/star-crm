import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Trash2, CalendarDays, Target, Plus, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

// ── Types ────────────────────────────────────────────────────────────────────

interface Meeting {
  id: number; date: string; companyName: string;
  productName?: string | null; meetingTime?: string | null;
  location?: string | null; notes?: string | null;
}

interface TargetRow {
  id?: number; month: number; expectedSales: number; salesDone: number;
}

// ── API ───────────────────────────────────────────────────────────────────────

async function apiFetch(path: string, init?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Request failed");
  }
  if (res.status === 204) return null;
  return res.json();
}

function toDateStr(y: number, m: number, d: number) {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

// ── Calendar Tab ─────────────────────────────────────────────────────────────

function CalendarTab() {
  const today = new Date();
  const todayStr = toDateStr(today.getFullYear(), today.getMonth() + 1, today.getDate());

  const [year,  setYear]  = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [modalOpen, setModalOpen] = useState(false);
  const [editMeeting, setEditMeeting] = useState<Meeting | null>(null);
  const [selectedDate, setSelectedDate] = useState("");

  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: meetings = [] } = useQuery<Meeting[]>({
    queryKey: ["planner-meetings", year, month + 1],
    queryFn: () => apiFetch(`/api/planner/meetings?year=${year}&month=${month + 1}`),
  });

  const byDate = meetings.reduce<Record<string, Meeting[]>>((acc, m) => {
    (acc[m.date] ??= []).push(m); return acc;
  }, {});

  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth  = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  function prevMonth() { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); }
  function nextMonth() { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); }

  function openCreate(day: number) { setSelectedDate(toDateStr(year, month + 1, day)); setEditMeeting(null); setModalOpen(true); }
  function openEdit(m: Meeting)    { setSelectedDate(m.date); setEditMeeting(m); setModalOpen(true); }

  const create = useMutation({
    mutationFn: (b: Omit<Meeting, "id">) => apiFetch("/api/planner/meetings", { method: "POST", body: JSON.stringify(b) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["planner-meetings"] }); setModalOpen(false); toast({ title: "Meeting saved" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
  const update = useMutation({
    mutationFn: ({ id, ...b }: Meeting) => apiFetch(`/api/planner/meetings/${id}`, { method: "PUT", body: JSON.stringify(b) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["planner-meetings"] }); setModalOpen(false); toast({ title: "Meeting updated" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
  const del = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/planner/meetings/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["planner-meetings"] }); setModalOpen(false); toast({ title: "Meeting deleted" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div>
      {/* ── Month navigation ── */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card">
        <div className="flex items-center gap-1">
          <button
            onClick={prevMonth}
            className="p-2 rounded-lg hover:bg-accent transition-colors"
            aria-label="Previous month"
          >
            <ChevronLeft className="w-5 h-5 text-muted-foreground" />
          </button>

          <h2 className="text-2xl font-bold px-3 min-w-[220px] text-center">
            {MONTHS[month]}&nbsp;
            <span className="font-light text-muted-foreground">{year}</span>
          </h2>

          <button
            onClick={nextMonth}
            className="p-2 rounded-lg hover:bg-accent transition-colors"
            aria-label="Next month"
          >
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        <button
          onClick={() => { setMonth(today.getMonth()); setYear(today.getFullYear()); }}
          className="px-4 py-1.5 text-sm border border-border rounded-lg hover:bg-accent transition-colors font-medium"
        >
          Today
        </button>
      </div>

      {/* ── Day-of-week header row ── */}
      <div
        className="border-b border-border bg-muted/30"
        style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}
      >
        {DAY_SHORT.map((d, i) => (
          <div
            key={d}
            className="py-2.5 text-center text-xs font-semibold uppercase tracking-widest"
            style={{ color: i === 0 || i === 6 ? "var(--muted-foreground)" : "var(--foreground)", opacity: i === 0 || i === 6 ? 0.5 : 0.7 }}
          >
            {d}
          </div>
        ))}
      </div>

      {/* ── Calendar cells ── */}
      <div
        className="border-l border-border"
        style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}
      >
        {cells.map((day, idx) => {
          const col      = idx % 7;
          const ds       = day ? toDateStr(year, month + 1, day) : null;
          const evts     = ds ? (byDate[ds] ?? []) : [];
          const isToday  = ds === todayStr;
          const isWeekend = col === 0 || col === 6;

          return (
            <div
              key={idx}
              onClick={() => day && openCreate(day)}
              className="border-r border-b border-border transition-colors"
              style={{
                minHeight: "130px",
                padding: "6px",
                display: "flex",
                flexDirection: "column",
                gap: "3px",
                cursor: day ? "pointer" : "default",
                backgroundColor: !day
                  ? "color-mix(in srgb, var(--muted) 20%, transparent)"
                  : isWeekend
                    ? "color-mix(in srgb, var(--muted) 15%, transparent)"
                    : undefined,
              }}
              onMouseEnter={e => { if (day) (e.currentTarget as HTMLDivElement).style.backgroundColor = "color-mix(in srgb, var(--accent) 30%, transparent)"; }}
              onMouseLeave={e => {
                if (!day) return;
                (e.currentTarget as HTMLDivElement).style.backgroundColor = isWeekend
                  ? "color-mix(in srgb, var(--muted) 15%, transparent)"
                  : "";
              }}
            >
              {day && (
                <>
                  {/* Day number */}
                  <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "2px" }}>
                    <span
                      style={{
                        width: "28px", height: "28px",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        borderRadius: "50%",
                        fontSize: "13px", fontWeight: isToday ? 700 : 500,
                        backgroundColor: isToday ? "#f59e0b" : "transparent",
                        color: isToday ? "#fff" : isWeekend ? "var(--muted-foreground)" : "var(--foreground)",
                      }}
                    >
                      {day}
                    </span>
                  </div>

                  {/* Events */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "2px", overflow: "hidden" }}>
                    {evts.slice(0, 3).map(m => (
                      <div
                        key={m.id}
                        onClick={e => { e.stopPropagation(); openEdit(m); }}
                        title={[m.companyName, m.meetingTime, m.location].filter(Boolean).join(" · ")}
                        style={{
                          display: "flex", alignItems: "center", gap: "4px",
                          padding: "2px 6px", borderRadius: "4px",
                          fontSize: "11px", fontWeight: 500,
                          backgroundColor: "color-mix(in srgb, var(--primary) 20%, transparent)",
                          color: "var(--primary)",
                          cursor: "pointer", overflow: "hidden", whiteSpace: "nowrap",
                        }}
                      >
                        <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "var(--primary)", flexShrink: 0 }} />
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", flex: 1 }}>{m.companyName}</span>
                        {m.meetingTime && (
                          <span style={{ flexShrink: 0, opacity: 0.7, marginLeft: "4px" }}>{m.meetingTime}</span>
                        )}
                      </div>
                    ))}
                    {evts.length > 3 && (
                      <span style={{ fontSize: "10px", color: "var(--muted-foreground)", paddingLeft: "4px" }}>
                        +{evts.length - 3} more
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Meeting modal */}
      <MeetingModal
        open={modalOpen} onClose={() => setModalOpen(false)}
        date={selectedDate} meeting={editMeeting}
        onCreate={d => create.mutate(d)} onUpdate={d => update.mutate(d)} onDelete={id => del.mutate(id)}
        saving={create.isPending || update.isPending} deleting={del.isPending}
      />
    </div>
  );
}

// ── Lookup Combobox ───────────────────────────────────────────────────────────

interface LookupComboboxProps {
  type: "company" | "product";
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  autoFocus?: boolean;
}

function LookupCombobox({ type, value, onChange, placeholder, required, autoFocus }: LookupComboboxProps) {
  const [open, setOpen]     = useState(false);
  const [query, setQuery]   = useState(value);
  const [adding, setAdding] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  // sync external value → local query when modal reopens
  useEffect(() => { setQuery(value); }, [value]);

  const { data: options = [] } = useQuery<string[]>({
    queryKey: ["lookup", type, query],
    queryFn: () => apiFetch(`/api/lookup?type=${type}&q=${encodeURIComponent(query)}`),
    enabled: open,
  });

  // close dropdown when clicking outside
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const exactMatch = options.some(o => o.toLowerCase() === query.trim().toLowerCase());
  const showAdd    = query.trim().length > 0 && !exactMatch;

  function pick(name: string) {
    setQuery(name);
    onChange(name);
    setOpen(false);
  }

  async function addNew() {
    const name = query.trim();
    if (!name) return;
    setAdding(true);
    try {
      await apiFetch(`/api/lookup?type=${type}`, { method: "POST", body: JSON.stringify({ name }) });
      qc.invalidateQueries({ queryKey: ["lookup", type] });
      onChange(name);
      setOpen(false);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setAdding(false);
    }
  }

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <Input
        autoFocus={autoFocus}
        value={query}
        placeholder={placeholder}
        onChange={e => { setQuery(e.target.value); onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={e => {
          if (e.key === "Escape") setOpen(false);
          if (e.key === "Enter" && showAdd) { e.preventDefault(); addNew(); }
        }}
        className={required && !query.trim() ? "border-destructive" : ""}
      />
      {open && (options.length > 0 || showAdd) && (
        <div
          style={{
            position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 50,
            background: "var(--card)", border: "1px solid var(--border)",
            borderRadius: "8px", boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
            maxHeight: "220px", overflowY: "auto",
          }}
        >
          {options.map(opt => (
            <button
              key={opt}
              type="button"
              onMouseDown={e => { e.preventDefault(); pick(opt); }}
              style={{
                display: "flex", alignItems: "center", gap: "8px",
                width: "100%", textAlign: "left", padding: "8px 12px",
                fontSize: "14px", background: "transparent", border: "none",
                cursor: "pointer", color: "var(--foreground)",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "var(--accent)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              {opt.toLowerCase() === query.trim().toLowerCase() && (
                <Check style={{ width: "14px", height: "14px", color: "var(--primary)", flexShrink: 0 }} />
              )}
              <span style={{ marginLeft: opt.toLowerCase() === query.trim().toLowerCase() ? 0 : "22px" }}>{opt}</span>
            </button>
          ))}
          {showAdd && (
            <button
              type="button"
              onMouseDown={e => { e.preventDefault(); addNew(); }}
              disabled={adding}
              style={{
                display: "flex", alignItems: "center", gap: "8px",
                width: "100%", textAlign: "left", padding: "8px 12px",
                fontSize: "14px", border: "none", cursor: "pointer",
                color: "var(--primary)",
                background: "color-mix(in srgb, var(--primary) 8%, transparent)",
                borderTop: options.length > 0 ? "1px solid var(--border)" : "none",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "color-mix(in srgb, var(--primary) 16%, transparent)")}
              onMouseLeave={e => (e.currentTarget.style.background = "color-mix(in srgb, var(--primary) 8%, transparent)")}
            >
              <Plus style={{ width: "14px", height: "14px", flexShrink: 0 }} />
              <span>{adding ? "Adding…" : `Add "${query.trim()}"`}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Meeting Modal ─────────────────────────────────────────────────────────────

interface MeetingModalProps {
  open: boolean; onClose: () => void; date: string; meeting: Meeting | null;
  onCreate: (d: Omit<Meeting, "id">) => void; onUpdate: (d: Meeting) => void;
  onDelete: (id: number) => void; saving: boolean; deleting: boolean;
}

function MeetingModal({ open, onClose, date, meeting, onCreate, onUpdate, onDelete, saving, deleting }: MeetingModalProps) {
  const [form, setForm] = useState({ companyName: "", productName: "", meetingTime: "", location: "", notes: "" });
  const prevOpen = useRef(false);

  if (open !== prevOpen.current) {
    prevOpen.current = open;
    if (open) setForm({
      companyName: meeting?.companyName ?? "",
      productName: meeting?.productName ?? "",
      meetingTime: meeting?.meetingTime ?? "",
      location:    meeting?.location    ?? "",
      notes:       meeting?.notes       ?? "",
    });
  }

  const set = (f: string, v: string) => setForm(p => ({ ...p, [f]: v }));

  function handleSave() {
    if (!form.companyName.trim()) return;
    const payload = {
      date, companyName: form.companyName.trim(),
      productName: form.productName.trim()  || undefined,
      meetingTime: form.meetingTime.trim()  || undefined,
      location:    form.location.trim()     || undefined,
      notes:       form.notes.trim()        || undefined,
    };
    if (meeting) onUpdate({ ...payload, id: meeting.id });
    else onCreate(payload);
  }

  const displayDate = date
    ? new Date(date + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })
    : "";

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{meeting ? "Edit Meeting" : "New Meeting"}</DialogTitle>
          <p className="text-sm text-muted-foreground">{displayDate}</p>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label>
              Company Name <span className="text-destructive">*</span>
            </Label>
            <LookupCombobox
              type="company"
              value={form.companyName}
              onChange={v => set("companyName", v)}
              placeholder="Search or add company…"
              required
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label>
              Product / Service{" "}
              <span className="text-xs text-muted-foreground font-normal">(optional)</span>
            </Label>
            <LookupCombobox
              type="product"
              value={form.productName}
              onChange={v => set("productName", v)}
              placeholder="Search or add product…"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Time <span className="text-xs text-muted-foreground font-normal">(optional)</span></Label>
              <Input value={form.meetingTime} onChange={e => set("meetingTime", e.target.value)} placeholder="e.g. 10:30 AM" />
            </div>
            <div className="space-y-1.5">
              <Label>Location <span className="text-xs text-muted-foreground font-normal">(optional)</span></Label>
              <Input value={form.location} onChange={e => set("location", e.target.value)} placeholder="Office / Zoom" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Notes <span className="text-xs text-muted-foreground font-normal">(optional)</span></Label>
            <Textarea value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Any extra details…" rows={3} />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          {meeting && (
            <Button variant="destructive" size="sm" onClick={() => onDelete(meeting.id)} disabled={deleting} className="mr-auto">
              <Trash2 className="w-3.5 h-3.5 mr-1.5" />{deleting ? "Deleting…" : "Delete"}
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !form.companyName.trim()}>
            {saving ? "Saving…" : meeting ? "Save Changes" : "Add Meeting"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Targets Tab ───────────────────────────────────────────────────────────────

function TargetsTab() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: targets = [] } = useQuery<TargetRow[]>({
    queryKey: ["planner-targets", year],
    queryFn: () => apiFetch(`/api/planner/targets?year=${year}`),
  });

  const byMonth = targets.reduce<Record<number, TargetRow>>((acc, t) => { acc[t.month] = t; return acc; }, {});

  const saveMutation = useMutation({
    mutationFn: ({ month, expectedSales, salesDone }: { month: number; expectedSales: number; salesDone: number }) =>
      apiFetch(`/api/planner/targets/${year}/${month}`, { method: "PUT", body: JSON.stringify({ expectedSales, salesDone }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["planner-targets"] }),
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const [editing, setEditing] = useState<{ month: number; field: "expectedSales" | "salesDone"; value: string } | null>(null);

  function startEdit(month: number, field: "expectedSales" | "salesDone", cur: number) {
    setEditing({ month, field, value: cur === 0 ? "" : String(cur) });
  }
  function commit() {
    if (!editing) return;
    const num = Math.max(0, parseInt(editing.value) || 0);
    const cur = byMonth[editing.month];
    saveMutation.mutate({
      month: editing.month,
      expectedSales: editing.field === "expectedSales" ? num : (cur?.expectedSales ?? 0),
      salesDone:     editing.field === "salesDone"     ? num : (cur?.salesDone     ?? 0),
    });
    setEditing(null);
  }

  const totExp  = MONTHS.reduce((s, _, i) => s + (byMonth[i + 1]?.expectedSales ?? 0), 0);
  const totDone = MONTHS.reduce((s, _, i) => s + (byMonth[i + 1]?.salesDone     ?? 0), 0);
  const totPend = Math.max(0, totExp - totDone);
  const curMo   = today.getMonth() + 1;

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => setYear(y => y - 1)} className="p-1.5 rounded-lg hover:bg-accent transition-colors">
          <ChevronLeft className="w-5 h-5 text-muted-foreground" />
        </button>
        <span className="text-2xl font-bold w-16 text-center">{year}</span>
        <button onClick={() => setYear(y => y + 1)} className="p-1.5 rounded-lg hover:bg-accent transition-colors">
          <ChevronRight className="w-5 h-5 text-muted-foreground" />
        </button>
        <span className="text-sm text-muted-foreground ml-1">Click a number to edit</span>
      </div>

      <div className="border border-border rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 border-b border-border">
              <th className="text-left px-5 py-3 font-semibold text-muted-foreground w-36">Month</th>
              <th className="text-center px-5 py-3 font-semibold text-muted-foreground">Expected</th>
              <th className="text-center px-5 py-3 font-semibold text-muted-foreground">Done</th>
              <th className="text-center px-5 py-3 font-semibold text-muted-foreground">Pending</th>
            </tr>
          </thead>
          <tbody>
            {MONTHS.map((name, i) => {
              const mo  = i + 1;
              const t   = byMonth[mo];
              const exp = t?.expectedSales ?? 0;
              const done= t?.salesDone     ?? 0;
              const pend= Math.max(0, exp - done);
              const isCur = mo === curMo && year === today.getFullYear();

              return (
                <tr key={mo} className={`border-b border-border last:border-0 hover:bg-accent/20 transition-colors ${isCur ? "bg-amber-500/5" : ""}`}>
                  <td className="px-5 py-3 font-medium">
                    {name}
                    {isCur && <span className="ml-2 text-[10px] bg-amber-500/20 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded-full">NOW</span>}
                  </td>
                  <td className="px-5 py-3 text-center">
                    <NumCell value={exp} field="expectedSales" month={mo} editing={editing}
                      onStart={startEdit} onChange={v => setEditing(e => e ? { ...e, value: v } : e)}
                      onCommit={commit} onCancel={() => setEditing(null)} />
                  </td>
                  <td className="px-5 py-3 text-center">
                    <NumCell value={done} field="salesDone" month={mo} editing={editing}
                      onStart={startEdit} onChange={v => setEditing(e => e ? { ...e, value: v } : e)}
                      onCommit={commit} onCancel={() => setEditing(null)}
                      className={done > 0 ? "text-green-500" : ""} />
                  </td>
                  <td className="px-5 py-3 text-center font-semibold">
                    {exp === 0 ? <span className="text-muted-foreground">—</span>
                      : pend === 0 ? <span className="text-green-500">✓ Done</span>
                      : <span className="text-amber-500">{pend}</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
          {totExp > 0 && (
            <tfoot>
              <tr className="bg-muted/50 border-t-2 border-border font-semibold">
                <td className="px-5 py-3">Total</td>
                <td className="px-5 py-3 text-center">{totExp}</td>
                <td className="px-5 py-3 text-center text-green-500">{totDone}</td>
                <td className={`px-5 py-3 text-center ${totPend > 0 ? "text-amber-500" : "text-green-500"}`}>
                  {totPend > 0 ? totPend : "✓ All done"}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {totExp > 0 && (
        <div className="mt-6" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px" }}>
          {[
            { label: "Expected", val: totExp, color: "" },
            { label: "Done",     val: totDone, color: "color: #22c55e" },
            { label: "Pending",  val: totPend, color: totPend > 0 ? "color: #f59e0b" : "color: #22c55e" },
          ].map(c => (
            <div key={c.label} className="bg-card border border-border rounded-xl p-5 text-center shadow-sm">
              <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">{c.label}</p>
              <p className="text-3xl font-bold" style={{ [c.color.split(":")[0]]: c.color.split(":")[1] }}>{c.val}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function NumCell({ value, field, month, editing, onStart, onChange, onCommit, onCancel, className = "" }: {
  value: number; field: "expectedSales" | "salesDone"; month: number;
  editing: { month: number; field: string; value: string } | null;
  onStart: (m: number, f: "expectedSales" | "salesDone", v: number) => void;
  onChange: (v: string) => void; onCommit: () => void; onCancel: () => void;
  className?: string;
}) {
  const active = editing?.month === month && editing.field === field;
  if (active) return (
    <input autoFocus type="number" min={0} value={editing!.value}
      onChange={e => onChange(e.target.value)} onBlur={onCommit}
      onKeyDown={e => { if (e.key === "Enter") onCommit(); if (e.key === "Escape") onCancel(); }}
      className="w-20 text-center bg-background border border-primary rounded-md px-2 py-0.5 text-sm focus:outline-none mx-auto block" />
  );
  return (
    <span onClick={() => onStart(month, field, value)}
      className={`cursor-pointer hover:underline decoration-dashed underline-offset-2 ${value === 0 ? "text-muted-foreground" : className}`}>
      {value === 0 ? "—" : value}
    </span>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

type Tab = "calendar" | "targets";

export default function Planner() {
  const [tab, setTab] = useState<Tab>("calendar");

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center gap-6 px-6 py-3 border-b border-border bg-card">
        <h1 className="text-lg font-semibold">Planner</h1>
        <div className="flex items-center gap-1 bg-secondary rounded-lg p-1">
          {([
            { key: "calendar" as Tab, label: "Calendar",      Icon: CalendarDays },
            { key: "targets"  as Tab, label: "Sales Targets", Icon: Target },
          ]).map(({ key, label, Icon }) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all
                ${tab === key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
              <Icon className="w-4 h-4" />{label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {tab === "calendar" ? <CalendarTab /> : <TargetsTab />}
    </div>
  );
}
