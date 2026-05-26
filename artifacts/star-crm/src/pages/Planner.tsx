import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Trash2, CalendarDays, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_SHORT  = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

// ── Types ────────────────────────────────────────────────────────────────────

interface Meeting {
  id: number;
  date: string;
  companyName: string;
  productName?: string | null;
  meetingTime?: string | null;
  location?: string | null;
  notes?: string | null;
}

interface TargetRow {
  id?: number;
  month: number;
  expectedSales: number;
  salesDone: number;
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

function toDateStr(year: number, month1: number, day: number) {
  return `${year}-${String(month1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// ── Calendar Tab ─────────────────────────────────────────────────────────────

function CalendarTab() {
  const today = new Date();
  const todayStr = toDateStr(today.getFullYear(), today.getMonth() + 1, today.getDate());

  const [year,  setYear]  = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth()); // 0-based
  const [modalOpen, setModalOpen]     = useState(false);
  const [editMeeting, setEditMeeting] = useState<Meeting | null>(null);
  const [selectedDate, setSelectedDate] = useState("");

  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: meetings = [] } = useQuery<Meeting[]>({
    queryKey: ["planner-meetings", year, month + 1],
    queryFn: () => apiFetch(`/api/planner/meetings?year=${year}&month=${month + 1}`),
  });

  const byDate = meetings.reduce<Record<string, Meeting[]>>((acc, m) => {
    (acc[m.date] ??= []).push(m);
    return acc;
  }, {});

  // calendar grid cells: null for blank leading cells, number for days
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth  = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks = cells.length / 7;

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  }
  function goToday() { setMonth(today.getMonth()); setYear(today.getFullYear()); }

  function openCreate(day: number) {
    setSelectedDate(toDateStr(year, month + 1, day));
    setEditMeeting(null);
    setModalOpen(true);
  }
  function openEdit(m: Meeting) {
    setSelectedDate(m.date);
    setEditMeeting(m);
    setModalOpen(true);
  }

  const createMutation = useMutation({
    mutationFn: (body: Omit<Meeting, "id">) =>
      apiFetch("/api/planner/meetings", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["planner-meetings"] }); setModalOpen(false); toast({ title: "Meeting saved" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, ...body }: Meeting) =>
      apiFetch(`/api/planner/meetings/${id}`, { method: "PUT", body: JSON.stringify(body) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["planner-meetings"] }); setModalOpen(false); toast({ title: "Meeting updated" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      apiFetch(`/api/planner/meetings/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["planner-meetings"] }); setModalOpen(false); toast({ title: "Meeting deleted" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // row height: fill remaining space below the two header rows (~112px total)
  const rowH = `calc((100vh - 112px - 36px - 41px) / ${weeks})`;

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 112px)" }}>

      {/* ── Month navigation ── */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border shrink-0">
        {/* Left: prev + month label + next  */}
        <div className="flex items-center gap-2">
          <button
            onClick={prevMonth}
            className="p-2 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h2 className="text-2xl font-bold min-w-[220px] text-center select-none">
            {MONTHS[month]} <span className="text-muted-foreground font-normal">{year}</span>
          </h2>
          <button
            onClick={nextMonth}
            className="p-2 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Right: Today */}
        <button
          onClick={goToday}
          className="px-4 py-1.5 text-sm border border-border rounded-lg hover:bg-accent transition-colors font-medium"
        >
          Today
        </button>
      </div>

      {/* ── Day-of-week header ── */}
      <div className="grid grid-cols-7 border-b border-border bg-card shrink-0">
        {DAY_SHORT.map((d, i) => (
          <div
            key={d}
            className={`py-2 text-center text-xs font-semibold uppercase tracking-widest
              ${i === 0 || i === 6 ? "text-muted-foreground/60" : "text-muted-foreground"}`}
          >
            {d}
          </div>
        ))}
      </div>

      {/* ── Calendar grid ── */}
      <div className="grid grid-cols-7 flex-1 border-l border-border">
        {cells.map((day, idx) => {
          const col   = idx % 7;
          const ds    = day ? toDateStr(year, month + 1, day) : null;
          const evts  = ds ? (byDate[ds] ?? []) : [];
          const isToday = ds === todayStr;
          const isWeekend = col === 0 || col === 6;

          return (
            <div
              key={idx}
              onClick={() => day && openCreate(day)}
              style={{ minHeight: rowH }}
              className={[
                "border-r border-b border-border flex flex-col p-1.5 transition-colors",
                day ? "cursor-pointer" : "",
                day && !isWeekend ? "hover:bg-accent/25" : "",
                isWeekend && day ? "bg-muted/30 hover:bg-muted/50" : "",
                !day ? "bg-muted/10" : "",
              ].join(" ")}
            >
              {day && (
                <>
                  {/* Day number */}
                  <div className="flex justify-end mb-1">
                    <span className={[
                      "w-7 h-7 flex items-center justify-center rounded-full text-sm font-medium select-none",
                      isToday
                        ? "bg-amber-500 text-white font-bold"
                        : isWeekend
                          ? "text-muted-foreground"
                          : "text-foreground",
                    ].join(" ")}>
                      {day}
                    </span>
                  </div>

                  {/* Events */}
                  <div className="flex flex-col gap-0.5 overflow-hidden">
                    {evts.slice(0, 3).map(m => (
                      <div
                        key={m.id}
                        onClick={e => { e.stopPropagation(); openEdit(m); }}
                        title={`${m.companyName}${m.meetingTime ? " · " + m.meetingTime : ""}${m.location ? " · " + m.location : ""}`}
                        className="flex items-center gap-1 px-1.5 py-0.5 bg-primary/20 hover:bg-primary/35 text-primary rounded text-xs font-medium truncate cursor-pointer"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                        <span className="truncate">{m.companyName}</span>
                        {m.meetingTime && (
                          <span className="shrink-0 text-primary/70 ml-auto pl-1">{m.meetingTime}</span>
                        )}
                      </div>
                    ))}
                    {evts.length > 3 && (
                      <span className="text-[11px] text-muted-foreground pl-1">+{evts.length - 3} more</span>
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
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        date={selectedDate}
        meeting={editMeeting}
        onCreate={data => createMutation.mutate(data)}
        onUpdate={data => updateMutation.mutate(data)}
        onDelete={id  => deleteMutation.mutate(id)}
        saving={createMutation.isPending || updateMutation.isPending}
        deleting={deleteMutation.isPending}
      />
    </div>
  );
}

// ── Meeting Modal ─────────────────────────────────────────────────────────────

interface MeetingModalProps {
  open: boolean; onClose: () => void; date: string;
  meeting: Meeting | null;
  onCreate: (d: Omit<Meeting, "id">) => void;
  onUpdate: (d: Meeting) => void;
  onDelete: (id: number) => void;
  saving: boolean; deleting: boolean;
}

function MeetingModal({ open, onClose, date, meeting, onCreate, onUpdate, onDelete, saving, deleting }: MeetingModalProps) {
  const blank = { companyName: "", productName: "", meetingTime: "", location: "", notes: "" };
  const [form, setForm] = useState(blank);
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
      date,
      companyName: form.companyName.trim(),
      productName: form.productName.trim()  || undefined,
      meetingTime: form.meetingTime.trim()  || undefined,
      location:    form.location.trim()     || undefined,
      notes:       form.notes.trim()        || undefined,
    };
    if (meeting) onUpdate({ ...payload, id: meeting.id });
    else onCreate(payload);
  }

  const label = date
    ? new Date(date + "T00:00:00").toLocaleDateString("en-US",
        { weekday: "long", year: "numeric", month: "long", day: "numeric" })
    : "";

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{meeting ? "Edit Meeting" : "New Meeting"}</DialogTitle>
          <p className="text-sm text-muted-foreground">{label}</p>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label>Company Name <span className="text-destructive">*</span></Label>
            <Input value={form.companyName} onChange={e => set("companyName", e.target.value)}
              placeholder="Enter company name" autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1">
              Product / Service <span className="text-xs text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input value={form.productName} onChange={e => set("productName", e.target.value)}
              placeholder="e.g. Enterprise License" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1">
                Time <span className="text-xs text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Input value={form.meetingTime} onChange={e => set("meetingTime", e.target.value)}
                placeholder="e.g. 10:30 AM" />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1">
                Location <span className="text-xs text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Input value={form.location} onChange={e => set("location", e.target.value)}
                placeholder="Office / Zoom" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1">
              Notes <span className="text-xs text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Textarea value={form.notes} onChange={e => set("notes", e.target.value)}
              placeholder="Any extra details…" rows={3} />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          {meeting && (
            <Button variant="destructive" size="sm" onClick={() => onDelete(meeting.id)}
              disabled={deleting} className="mr-auto">
              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
              {deleting ? "Deleting…" : "Delete"}
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
    setEditing({ month, field, value: String(cur === 0 ? "" : cur) });
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
      {/* Year nav */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => setYear(y => y - 1)}
          className="p-1.5 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <span className="text-2xl font-bold w-16 text-center">{year}</span>
        <button onClick={() => setYear(y => y + 1)}
          className="p-1.5 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground">
          <ChevronRight className="w-5 h-5" />
        </button>
        <span className="text-sm text-muted-foreground ml-1">Click a number to edit, Enter to save</span>
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
                <tr key={mo}
                  className={`border-b border-border last:border-0 transition-colors
                    ${isCur ? "bg-amber-500/8 font-medium" : "hover:bg-accent/20"}`}>
                  <td className="px-5 py-3">
                    <span>{name}</span>
                    {isCur && <span className="ml-2 text-[10px] bg-amber-500/20 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded-full font-semibold">NOW</span>}
                  </td>
                  <td className="px-5 py-3 text-center">
                    <NumCell value={exp} field="expectedSales" month={mo}
                      editing={editing} onStart={startEdit}
                      onChange={v => setEditing(e => e ? { ...e, value: v } : e)}
                      onCommit={commit} onCancel={() => setEditing(null)} />
                  </td>
                  <td className="px-5 py-3 text-center">
                    <NumCell value={done} field="salesDone" month={mo}
                      editing={editing} onStart={startEdit}
                      onChange={v => setEditing(e => e ? { ...e, value: v } : e)}
                      onCommit={commit} onCancel={() => setEditing(null)}
                      className={done > 0 ? "text-green-500" : ""} />
                  </td>
                  <td className="px-5 py-3 text-center font-semibold">
                    {exp === 0 ? (
                      <span className="text-muted-foreground">—</span>
                    ) : pend === 0 ? (
                      <span className="text-green-500">✓ Complete</span>
                    ) : (
                      <span className="text-amber-500">{pend}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          {totExp > 0 && (
            <tfoot>
              <tr className="bg-muted/50 border-t-2 border-border font-semibold text-sm">
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
        <div className="grid grid-cols-3 gap-4 mt-6">
          {[
            { label: "Expected", val: totExp, cls: "" },
            { label: "Done",     val: totDone, cls: "text-green-500" },
            { label: "Pending",  val: totPend, cls: totPend > 0 ? "text-amber-500" : "text-green-500" },
          ].map(c => (
            <div key={c.label} className="bg-card border border-border rounded-xl p-5 text-center shadow-sm">
              <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">{c.label}</p>
              <p className={`text-3xl font-bold ${c.cls}`}>{c.val}</p>
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
      onChange={e => onChange(e.target.value)}
      onBlur={onCommit}
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
    <div className="flex flex-col" style={{ minHeight: "calc(100vh - 0px)" }}>
      {/* Page header with tabs */}
      <div className="flex items-center gap-6 px-6 py-3 border-b border-border bg-card shrink-0">
        <h1 className="text-lg font-semibold">Planner</h1>
        <div className="flex items-center gap-1 bg-secondary rounded-lg p-1">
          {([
            { key: "calendar", label: "Calendar",      icon: CalendarDays },
            { key: "targets",  label: "Sales Targets", icon: Target },
          ] as { key: Tab; label: string; icon: React.ElementType }[]).map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all
                ${tab === key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1">
        {tab === "calendar" ? <CalendarTab /> : <TargetsTab />}
      </div>
    </div>
  );
}
