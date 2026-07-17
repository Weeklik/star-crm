import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Trash2, CalendarDays, Target, Plus, Check, User, MapPin, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "@/i18n/LanguageContext";

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
  salespersonId?: number;
}

interface TargetRow {
  id?: number; month: number; expectedSales: number; salesDone: number;
}

interface UserOption { id: number; name: string | null; role: string; }

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

// ── Event color palette (consistent per company name) ────────────────────────

const EVENT_COLORS = [
  { bg: "#4285F4", hover: "#3367D6" },
  { bg: "#0F9D58", hover: "#0B8043" },
  { bg: "#DB4437", hover: "#C53929" },
  { bg: "#F4B400", hover: "#F09300" },
  { bg: "#AB47BC", hover: "#8E24AA" },
  { bg: "#00ACC1", hover: "#00838F" },
  { bg: "#FF7043", hover: "#E64A19" },
  { bg: "#43A047", hover: "#2E7D32" },
  { bg: "#7986CB", hover: "#5C6BC0" },
  { bg: "#F06292", hover: "#E91E63" },
];

function getEventColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return EVENT_COLORS[hash % EVENT_COLORS.length];
}

// Distinct color per salesperson ID for "all" calendar view
const SP_COLORS = ["#4285F4","#0F9D58","#AB47BC","#FF7043","#00ACC1","#F4B400","#7986CB","#F06292"];
function getSpColor(spId: number) { return SP_COLORS[spId % SP_COLORS.length]; }

// ── Calendar Tab ─────────────────────────────────────────────────────────────

interface CalendarTabProps {
  spId: number | "all";
  isOwner: boolean;
  users: UserOption[];
}

function CalendarTab({ spId, isOwner, users }: CalendarTabProps) {
  const today    = new Date();
  const todayStr = toDateStr(today.getFullYear(), today.getMonth() + 1, today.getDate());
  const { t } = useTranslation();

  const [year,      setYear]      = useState(today.getFullYear());
  const [month,     setMonth]     = useState(today.getMonth());
  const [modalOpen, setModalOpen] = useState(false);
  const [editMeeting, setEditMeeting] = useState<Meeting | null>(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [dayViewDate, setDayViewDate] = useState<string | null>(null);

  const { toast } = useToast();
  const qc = useQueryClient();

  // Build query key & URL param
  const spParam = isOwner && spId !== "all" ? `&salespersonId=${spId}` : "";

  const { data: meetings = [] } = useQuery<Meeting[]>({
    queryKey: ["planner-meetings", year, month + 1, spId],
    queryFn:  () => apiFetch(`/api/planner/meetings?year=${year}&month=${month + 1}${spParam}`),
  });

  // Build a map from spId → name for the "all" view badge
  const usersMap = users.reduce<Record<number, string>>((acc, u) => {
    acc[u.id] = u.name ?? u.id.toString(); return acc;
  }, {});

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

  // Only allow adding/editing when a specific salesperson is selected (or it's the salesperson's own view)
  const canEdit = !isOwner || (isOwner && spId !== "all");

  function openCreate(day: number) {
    if (!canEdit) return;
    setSelectedDate(toDateStr(year, month + 1, day));
    setEditMeeting(null);
    setModalOpen(true);
  }
  function openEdit(m: Meeting) {
    setSelectedDate(m.date);
    setEditMeeting(m);
    setModalOpen(true);
  }

  const create = useMutation({
    mutationFn: (b: Omit<Meeting, "id">) => {
      const payload: any = { ...b };
      if (isOwner && spId !== "all") payload.salespersonId = Number(spId);
      return apiFetch("/api/planner/meetings", { method: "POST", body: JSON.stringify(payload) });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["planner-meetings"] }); setModalOpen(false); toast({ title: t("planner.meetingSaved") }); },
    onError:   (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
  const update = useMutation({
    mutationFn: ({ id, ...b }: Meeting) => apiFetch(`/api/planner/meetings/${id}`, { method: "PUT", body: JSON.stringify(b) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["planner-meetings"] }); setModalOpen(false); toast({ title: t("planner.meetingUpdated") }); },
    onError:   (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
  const del = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/planner/meetings/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["planner-meetings"] }); setModalOpen(false); toast({ title: t("planner.meetingDeleted") }); },
    onError:   (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Month navigation ── */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card flex-shrink-0">
        <div className="flex items-center gap-1">
          <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-accent transition-colors" aria-label="Previous month">
            <ChevronLeft className="w-5 h-5 text-muted-foreground" />
          </button>
          <h2 className="text-2xl font-bold px-3 min-w-[220px] text-center">
            {MONTHS[month]}&nbsp;
            <span className="font-light text-muted-foreground">{year}</span>
          </h2>
          <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-accent transition-colors" aria-label="Next month">
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        <div className="flex items-center gap-3">
          {/* "All salespersons" hint */}
          {isOwner && spId === "all" && (
            <span className="text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
              {t("planner.selectSalesperson")}
            </span>
          )}
          <button
            onClick={() => { setMonth(today.getMonth()); setYear(today.getFullYear()); }}
            className="px-4 py-1.5 text-sm border border-border rounded-lg hover:bg-accent transition-colors font-medium"
          >
            {t("planner.today")}
          </button>
        </div>
      </div>

      {/* ── Salesperson legend (only in "all" mode) ── */}
      {isOwner && spId === "all" && users.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 px-6 py-2 border-b border-border bg-muted/20 text-xs flex-shrink-0">
          <span className="text-muted-foreground font-medium mr-1">{t("planner.allSalespersons")}:</span>
          {users.map(u => (
            <span key={u.id} className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-white font-medium"
              style={{ backgroundColor: getSpColor(u.id) }}>
              {u.name ?? "—"}
            </span>
          ))}
        </div>
      )}

      {/* ── Day-of-week header row ── */}
      <div className="border-b border-border bg-muted/30 flex-shrink-0" style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
        {DAY_SHORT.map((d, i) => (
          <div key={d} className="py-2.5 text-center text-xs font-semibold uppercase tracking-widest"
            style={{ color: i === 0 || i === 6 ? "var(--muted-foreground)" : "var(--foreground)", opacity: i === 0 || i === 6 ? 0.5 : 0.7 }}>
            {d}
          </div>
        ))}
      </div>

      {/* ── Calendar cells (scrollable) ── */}
      <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="border-l border-border" style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
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
                minHeight: "130px", padding: "6px",
                display: "flex", flexDirection: "column", gap: "3px",
                cursor: day && canEdit ? "pointer" : day ? "default" : "default",
                backgroundColor: !day
                  ? "color-mix(in srgb, var(--muted) 20%, transparent)"
                  : isWeekend
                    ? "color-mix(in srgb, var(--muted) 15%, transparent)"
                    : undefined,
              }}
              onMouseEnter={e => { if (day && canEdit) (e.currentTarget as HTMLDivElement).style.backgroundColor = "color-mix(in srgb, var(--accent) 30%, transparent)"; }}
              onMouseLeave={e => {
                if (!day) return;
                (e.currentTarget as HTMLDivElement).style.backgroundColor = isWeekend
                  ? "color-mix(in srgb, var(--muted) 15%, transparent)" : "";
              }}
            >
              {day && (
                <>
                  <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "2px" }}>
                    <span style={{
                      width: "28px", height: "28px",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      borderRadius: "50%", fontSize: "13px", fontWeight: isToday ? 700 : 500,
                      backgroundColor: isToday ? "#f59e0b" : "transparent",
                      color: isToday ? "#fff" : isWeekend ? "var(--muted-foreground)" : "var(--foreground)",
                    }}>
                      {day}
                    </span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "2px", overflow: "hidden" }}>
                    {evts.slice(0, 3).map(m => {
                      // In "all" mode color by salesperson; otherwise by company
                      const color = (isOwner && spId === "all" && m.salespersonId)
                        ? { bg: getSpColor(m.salespersonId), hover: getSpColor(m.salespersonId) }
                        : getEventColor(m.companyName);
                      const spFullName = (isOwner && spId === "all" && m.salespersonId)
                        ? usersMap[m.salespersonId]
                        : null;
                      // Abbreviate salesperson to initials (e.g. "John Doe" → "JD")
                      const spInitials = spFullName
                        ? spFullName.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2)
                        : null;
                      // Shorten company name: first word, max 10 chars
                      const shortCompany = (m.companyName ?? "").split(/[\s,.(]/)[0].slice(0, 10);
                      // Shorten time to HH:MM only
                      const shortTime = m.meetingTime ? m.meetingTime.slice(0, 5) : null;
                      return (
                        <div
                          key={m.id}
                          onClick={e => { e.stopPropagation(); openEdit(m); }}
                          title={[spFullName, m.companyName, m.meetingTime, m.location].filter(Boolean).join(" · ")}
                          onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.backgroundColor = color.hover}
                          onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.backgroundColor = color.bg}
                          style={{
                            display: "flex", alignItems: "center", gap: "3px",
                            padding: "2px 5px", borderRadius: "4px",
                            fontSize: "10px", fontWeight: 600,
                            backgroundColor: color.bg, color: "#fff",
                            cursor: "pointer", overflow: "hidden", whiteSpace: "nowrap",
                            transition: "background-color 0.12s",
                          }}
                        >
                          {spInitials && (
                            <span style={{ flexShrink: 0, opacity: 0.9, fontSize: "9px",
                              background: "rgba(0,0,0,0.18)", borderRadius: "3px", padding: "0 3px" }}>
                              {spInitials}
                            </span>
                          )}
                          {shortTime && (
                            <span style={{ flexShrink: 0, opacity: 0.85, fontSize: "9px", fontWeight: 500 }}>
                              {shortTime}
                            </span>
                          )}
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", flex: 1, minWidth: 0 }}>
                            {shortCompany}
                          </span>
                        </div>
                      );
                    })}
                    {evts.length > 3 && (
                      <button
                        onClick={e => { e.stopPropagation(); setDayViewDate(ds); }}
                        style={{
                          fontSize: "10px", color: "var(--primary)", paddingLeft: "4px",
                          background: "none", border: "none", cursor: "pointer",
                          textAlign: "left", fontWeight: 600, textDecoration: "underline",
                          textUnderlineOffset: "2px",
                        }}
                      >
                        +{evts.length - 3} more
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
      </div>{/* end scrollable calendar area */}

      <MeetingModal
        open={modalOpen} onClose={() => setModalOpen(false)}
        date={selectedDate} meeting={editMeeting}
        onCreate={d => create.mutate(d)} onUpdate={d => update.mutate(d)} onDelete={id => del.mutate(id)}
        saving={create.isPending || update.isPending} deleting={del.isPending}
        isOwner={isOwner}
      />

      {/* ── Day overflow modal ── */}
      <Dialog open={!!dayViewDate} onOpenChange={open => { if (!open) setDayViewDate(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {dayViewDate
                ? new Date(dayViewDate + "T00:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
                : ""}
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                {dayViewDate ? `${(byDate[dayViewDate] ?? []).length} meeting${(byDate[dayViewDate] ?? []).length !== 1 ? "s" : ""}` : ""}
              </span>
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2 max-h-[60vh] overflow-y-auto pr-1">
            {(dayViewDate ? (byDate[dayViewDate] ?? []) : []).map(m => {
              const color = (isOwner && spId === "all" && m.salespersonId)
                ? { bg: getSpColor(m.salespersonId) }
                : getEventColor(m.companyName);
              const spFullName = (isOwner && spId === "all" && m.salespersonId)
                ? usersMap[m.salespersonId] : null;
              return (
                <button
                  key={m.id}
                  onClick={() => { setDayViewDate(null); openEdit(m); }}
                  className="flex items-start gap-3 text-left rounded-lg border border-border p-3 hover:bg-accent transition-colors w-full"
                >
                  <span className="mt-1 w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: color.bg }} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{m.companyName}</div>
                    {m.productName && <div className="text-xs text-muted-foreground truncate">{m.productName}</div>}
                    <div className="flex flex-wrap gap-2 mt-1">
                      {m.meetingTime && (
                        <span className="text-xs text-muted-foreground">🕐 {m.meetingTime}</span>
                      )}
                      {m.location && (
                        <span className="text-xs text-muted-foreground">📍 {m.location}</span>
                      )}
                      {spFullName && (
                        <span className="text-xs text-muted-foreground">👤 {spFullName}</span>
                      )}
                    </div>
                    {m.notes && <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{m.notes}</div>}
                  </div>
                  {canEdit && <span className="text-xs text-muted-foreground shrink-0 self-center">Edit →</span>}
                </button>
              );
            })}
          </div>
          {canEdit && dayViewDate && (
            <div className="pt-2 border-t border-border">
              <button
                onClick={() => { setDayViewDate(null); openCreate(parseInt(dayViewDate.split("-")[2])); }}
                className="w-full text-sm text-primary hover:underline font-medium py-1"
              >
                + Add meeting on this day
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
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
  const [open,   setOpen]   = useState(false);
  const [query,  setQuery]  = useState(value);
  const [adding, setAdding] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  useEffect(() => { setQuery(value); }, [value]);

  const { data: options = [] } = useQuery<string[]>({
    queryKey: ["lookup", type, query],
    queryFn:  () => apiFetch(`/api/lookup?type=${type}&q=${encodeURIComponent(query)}`),
    enabled: open,
  });

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const exactMatch = options.some(o => o.toLowerCase() === query.trim().toLowerCase());
  const showAdd    = query.trim().length > 0 && !exactMatch;

  function pick(name: string) { setQuery(name); onChange(name); setOpen(false); }

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
    } finally { setAdding(false); }
  }

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <Input
        autoFocus={autoFocus} value={query} placeholder={placeholder}
        onChange={e => { setQuery(e.target.value); onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={e => {
          if (e.key === "Escape") setOpen(false);
          if (e.key === "Enter" && showAdd) { e.preventDefault(); addNew(); }
        }}
        className={required && !query.trim() ? "border-destructive" : ""}
      />
      {open && (options.length > 0 || showAdd) && (
        <div className="bg-popover border border-border rounded-lg shadow-xl overflow-hidden"
          style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 9999, maxHeight: "220px", overflowY: "auto" }}>
          {options.map(opt => {
            const isSelected = opt.toLowerCase() === query.trim().toLowerCase();
            return (
              <button key={opt} type="button" onMouseDown={e => { e.preventDefault(); pick(opt); }}
                className="flex items-center gap-2 w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors">
                {isSelected ? <Check className="w-3.5 h-3.5 text-primary shrink-0" /> : <span className="w-3.5 h-3.5 shrink-0" />}
                <span>{opt}</span>
              </button>
            );
          })}
          {showAdd && (
            <button type="button" onMouseDown={e => { e.preventDefault(); addNew(); }} disabled={adding}
              className="flex items-center gap-2 w-full text-left px-3 py-2 text-sm text-primary hover:bg-primary/10 transition-colors font-medium"
              style={{ borderTop: options.length > 0 ? "1px solid var(--border)" : "none" }}>
              <Plus className="w-3.5 h-3.5 shrink-0" />
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
  isOwner: boolean;
}

function MeetingModal({ open, onClose, date, meeting, onCreate, onUpdate, onDelete, saving, deleting, isOwner }: MeetingModalProps) {
  const [form, setForm] = useState({ companyName: "", productName: "", meetingTime: "", location: "", notes: "" });
  const { t } = useTranslation();
  const { toast } = useToast();
  const prevOpen = useRef(false);

  const [geoState, setGeoState]     = useState<"idle" | "loading" | "done" | "error">("idle");
  const [geoSaving, setGeoSaving]   = useState(false);

  // Reset geo state when modal closes
  useEffect(() => { if (!open) { setGeoState("idle"); setGeoSaving(false); } }, [open]);

  async function handleGetMyLocation() {
    if (!navigator.geolocation) {
      toast({ title: "Geolocation not supported by your browser", variant: "destructive" });
      return;
    }
    setGeoState("loading");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const now  = new Date();
        const actDate = now.toISOString().split("T")[0];
        const actTime = now.toTimeString().slice(0, 5);

        let locationName = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        try {
          const geo = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
            { headers: { "Accept-Language": "en" } },
          );
          const geoData = await geo.json();
          if (geoData.display_name) locationName = geoData.display_name;
        } catch { /* keep coordinate fallback */ }

        setGeoSaving(true);
        try {
          const res = await fetch(`${BASE}/api/activities`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              date: actDate,
              time: actTime,
              latitude: lat,
              longitude: lng,
              locationName,
              company:  form.companyName.trim() || undefined,
              product:  form.productName.trim()  || undefined,
            }),
          });
          if (!res.ok) throw new Error("Failed");
          setGeoState("done");
          toast({ title: "Location saved to My Activities" });
        } catch {
          setGeoState("error");
          toast({ title: "Failed to save activity", variant: "destructive" });
        } finally {
          setGeoSaving(false);
        }
      },
      () => {
        setGeoState("error");
        toast({ title: "Could not get your location. Please allow location access.", variant: "destructive" });
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }

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
      productName: form.productName.trim() || undefined,
      meetingTime: form.meetingTime.trim() || undefined,
      location:    form.location.trim()    || undefined,
      notes:       form.notes.trim()       || undefined,
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
          <DialogTitle>{meeting ? t("planner.editMeeting") : t("planner.newMeeting")}</DialogTitle>
          <p className="text-sm text-muted-foreground">{displayDate}</p>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label>{t("planner.companyName")} <span className="text-destructive">*</span></Label>
            <LookupCombobox type="company" value={form.companyName} onChange={v => set("companyName", v)}
              placeholder="Search or add company…" required autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label>{t("planner.productName")} <span className="text-xs text-muted-foreground font-normal">(optional)</span></Label>
            <LookupCombobox type="product" value={form.productName} onChange={v => set("productName", v)}
              placeholder="Search or add product…" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t("planner.time")} <span className="text-xs text-muted-foreground font-normal">(optional)</span></Label>
              <Input value={form.meetingTime} onChange={e => set("meetingTime", e.target.value)} placeholder="e.g. 10:30 AM" />
            </div>
            <div className="space-y-1.5">
              <Label>{t("planner.location")} <span className="text-xs text-muted-foreground font-normal">(optional)</span></Label>
              <Input value={form.location} onChange={e => set("location", e.target.value)} placeholder="Office / Zoom" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{t("planner.notes")} <span className="text-xs text-muted-foreground font-normal">(optional)</span></Label>
            <Textarea value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Any extra details…" rows={3} />
          </div>
        </div>
        {meeting && (
          <div className="pt-1 pb-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleGetMyLocation}
              disabled={geoState === "loading" || geoSaving}
              className={`w-full flex items-center gap-2 ${geoState === "done" ? "border-green-500 text-green-600" : ""}`}
            >
              {geoState === "loading" || geoSaving
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <MapPin className="w-4 h-4" />}
              {geoState === "loading" ? "Getting location…"
                : geoSaving ? "Saving…"
                : geoState === "done" ? "✓ Location saved to My Activities"
                : geoState === "error" ? "Retry Get My Location"
                : "Get My Location"}
            </Button>
          </div>
        )}
        <DialogFooter className="gap-2 sm:gap-0">
          {meeting && isOwner && (
            <Button variant="destructive" size="sm" onClick={() => onDelete(meeting.id)} disabled={deleting} className="mr-auto">
              <Trash2 className="w-3.5 h-3.5 mr-1.5" />{deleting ? "…" : t("planner.deleteMeeting")}
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>{t("planner.cancel")}</Button>
          <Button onClick={handleSave} disabled={saving || !form.companyName.trim()}>
            {saving ? "…" : meeting ? t("planner.updateMeeting") : t("planner.saveMeeting")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Targets Tab ───────────────────────────────────────────────────────────────

interface TargetsTabProps {
  spId: number | "all";
  isOwner: boolean;
}

function TargetsTab({ spId, isOwner }: TargetsTabProps) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const { toast } = useToast();
  const qc = useQueryClient();

  const hasTarget = spId !== "all";
  const spParam   = isOwner && hasTarget ? `&salespersonId=${spId}` : "";

  const { data: targets = [] } = useQuery<TargetRow[]>({
    queryKey: ["planner-targets", year, spId],
    queryFn:  () => apiFetch(`/api/planner/targets?year=${year}${spParam}`),
    enabled:  hasTarget,
  });

  const byMonth = targets.reduce<Record<number, TargetRow>>((acc, t) => { acc[t.month] = t; return acc; }, {});

  const saveMutation = useMutation({
    mutationFn: ({ month, expectedSales, salesDone }: { month: number; expectedSales: number; salesDone: number }) => {
      const body: any = { expectedSales, salesDone };
      if (isOwner && hasTarget) body.salespersonId = Number(spId);
      return apiFetch(`/api/planner/targets/${year}/${month}`, { method: "PUT", body: JSON.stringify(body) });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["planner-targets"] }),
    onError:   (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
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

  if (!hasTarget) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
        <User className="w-10 h-10 mb-3 opacity-30" />
        <p className="font-medium">Select a salesperson to view their targets</p>
        <p className="text-sm mt-1">Use the dropdown in the header to choose one</p>
      </div>
    );
  }

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
              const mo   = i + 1;
              const t    = byMonth[mo];
              const exp  = t?.expectedSales ?? 0;
              const done = t?.salesDone     ?? 0;
              const pend = Math.max(0, exp - done);
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
                    {exp === 0
                      ? <span className="text-muted-foreground">—</span>
                      : pend === 0
                        ? <span className="text-green-500">✓ Done</span>
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
  const { user }   = useAuth();
  const { t }      = useTranslation();
  const isOwner    = user?.role === "owner";
  const [tab, setTab]   = useState<Tab>("calendar");
  const [users, setUsers] = useState<UserOption[]>([]);
  // "all" = show everyone; number = filter to specific SP
  const [spId, setSpId] = useState<number | "all">("all");

  // Fetch salesperson list for owners
  useEffect(() => {
    if (!isOwner) return;
    apiFetch("/api/users")
      .then((data: UserOption[]) => {
        setUsers(data);
        // For targets tab, default to the first salesperson
        const first = data.find(u => u.role === "salesperson");
        if (first && tab === "targets") setSpId(first.id);
      })
      .catch(() => {});
  }, [isOwner]);

  // When switching to Targets tab: if still "all", auto-select first salesperson
  function handleTabChange(t: Tab) {
    setTab(t);
    if (t === "targets" && spId === "all") {
      const first = users.find(u => u.role === "salesperson");
      if (first) setSpId(first.id);
    }
  }

  return (
    <div>
      {/* Page header */}
      <div className="flex flex-wrap items-center gap-3 px-6 py-3 border-b border-border bg-card">
        <h1 className="text-lg font-semibold">{t("nav.planner")}</h1>

        {/* Tab switcher */}
        <div className="flex items-center gap-1 bg-secondary rounded-lg p-1">
          {([
            { key: "calendar" as Tab, label: t("planner.calendar"),  Icon: CalendarDays },
            { key: "targets"  as Tab, label: t("planner.targets"),   Icon: Target },
          ]).map(({ key, label, Icon }) => (
            <button key={key} onClick={() => handleTabChange(key)}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all
                ${tab === key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
              <Icon className="w-4 h-4" />{label}
            </button>
          ))}
        </div>

        {/* Salesperson filter (owners only) */}
        {isOwner && users.length > 0 && (
          <div className="flex items-center gap-2 ml-auto">
            <User className="w-4 h-4 text-muted-foreground shrink-0" />
            <Select
              value={spId === "all" ? "all" : String(spId)}
              onValueChange={v => setSpId(v === "all" ? "all" : Number(v))}
            >
              <SelectTrigger className="w-[190px] h-8 text-sm">
                <SelectValue placeholder="Select salesperson" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("planner.allSalespersons")}</SelectItem>
                {users.map(u => (
                  <SelectItem key={u.id} value={String(u.id)}>
                    {u.name ?? `User ${u.id}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Content */}
      {tab === "calendar"
        ? <CalendarTab spId={spId} isOwner={isOwner} users={users} />
        : <TargetsTab  spId={spId} isOwner={isOwner} />
      }
    </div>
  );
}
