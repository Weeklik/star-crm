import { useState, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Plus, Pencil, Trash2, X, CalendarDays, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];

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

interface Target {
  id?: number;
  month: number;
  expectedSales: number;
  salesDone: number;
}

// ── API helpers ──────────────────────────────────────────────────────────────

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

// ── Calendar Tab ─────────────────────────────────────────────────────────────

function CalendarTab() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth()); // 0-based
  const [modalOpen, setModalOpen] = useState(false);
  const [editMeeting, setEditMeeting] = useState<Meeting | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: meetings = [] } = useQuery<Meeting[]>({
    queryKey: ["planner-meetings", year, month + 1],
    queryFn: () => apiFetch(`/api/planner/meetings?year=${year}&month=${month + 1}`),
  });

  const meetingsByDate = meetings.reduce<Record<string, Meeting[]>>((acc, m) => {
    (acc[m.date] ??= []).push(m);
    return acc;
  }, {});

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  }

  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDayOfWeek).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  function dateStr(day: number) {
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  function openCreate(day: number) {
    setSelectedDate(dateStr(day));
    setEditMeeting(null);
    setModalOpen(true);
  }

  function openEdit(meeting: Meeting) {
    setSelectedDate(meeting.date);
    setEditMeeting(meeting);
    setModalOpen(true);
  }

  const createMutation = useMutation({
    mutationFn: (body: Omit<Meeting, "id">) => apiFetch("/api/planner/meetings", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["planner-meetings"] }); setModalOpen(false); toast({ title: "Meeting saved" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...body }: Meeting) => apiFetch(`/api/planner/meetings/${id}`, { method: "PUT", body: JSON.stringify(body) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["planner-meetings"] }); setModalOpen(false); toast({ title: "Meeting updated" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/planner/meetings/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["planner-meetings"] }); setModalOpen(false); toast({ title: "Meeting deleted" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={prevMonth}><ChevronLeft className="w-4 h-4" /></Button>
          <h2 className="text-xl font-semibold w-52 text-center">{MONTHS[month]} {year}</h2>
          <Button variant="ghost" size="icon" onClick={nextMonth}><ChevronRight className="w-4 h-4" /></Button>
        </div>
        <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => { setMonth(today.getMonth()); setYear(today.getFullYear()); }}>
          Today
        </Button>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 border-b border-border bg-card">
        {DAYS.map(d => (
          <div key={d} className="py-2 text-center text-xs font-medium text-muted-foreground tracking-wide uppercase">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-7 h-full" style={{ gridAutoRows: "minmax(100px, 1fr)" }}>
          {cells.map((day, idx) => {
            const ds = day ? dateStr(day) : null;
            const dayMeetings = ds ? (meetingsByDate[ds] ?? []) : [];
            const isToday = ds === todayStr;
            const isPast = ds ? ds < todayStr : false;

            return (
              <div
                key={idx}
                onClick={() => day && openCreate(day)}
                className={`border-r border-b border-border p-2 flex flex-col gap-1 transition-colors
                  ${day ? "cursor-pointer hover:bg-accent/30" : "bg-muted/20"}
                  ${idx % 7 === 6 ? "border-r-0" : ""}`}
              >
                {day && (
                  <>
                    <span className={`text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full
                      ${isToday ? "bg-primary text-primary-foreground" : isPast ? "text-muted-foreground" : "text-foreground"}`}>
                      {day}
                    </span>
                    <div className="flex flex-col gap-0.5">
                      {dayMeetings.slice(0, 3).map(m => (
                        <div
                          key={m.id}
                          onClick={(e) => { e.stopPropagation(); openEdit(m); }}
                          className="flex items-center gap-1 px-1.5 py-0.5 bg-primary/15 hover:bg-primary/25 rounded text-xs text-primary font-medium truncate cursor-pointer group"
                        >
                          <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                          <span className="truncate">{m.companyName}</span>
                          {m.meetingTime && <span className="text-primary/60 shrink-0">{m.meetingTime}</span>}
                        </div>
                      ))}
                      {dayMeetings.length > 3 && (
                        <span className="text-xs text-muted-foreground px-1">+{dayMeetings.length - 3} more</span>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Meeting Modal */}
      <MeetingModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        date={selectedDate}
        meeting={editMeeting}
        onCreate={(data) => createMutation.mutate(data)}
        onUpdate={(data) => updateMutation.mutate(data)}
        onDelete={(id) => deleteMutation.mutate(id)}
        saving={createMutation.isPending || updateMutation.isPending}
        deleting={deleteMutation.isPending}
      />
    </div>
  );
}

// ── Meeting Modal ─────────────────────────────────────────────────────────────

interface MeetingModalProps {
  open: boolean;
  onClose: () => void;
  date: string;
  meeting: Meeting | null;
  onCreate: (data: Omit<Meeting, "id">) => void;
  onUpdate: (data: Meeting) => void;
  onDelete: (id: number) => void;
  saving: boolean;
  deleting: boolean;
}

function MeetingModal({ open, onClose, date, meeting, onCreate, onUpdate, onDelete, saving, deleting }: MeetingModalProps) {
  const [form, setForm] = useState({ companyName: "", productName: "", meetingTime: "", location: "", notes: "" });

  // Reset form when modal opens
  const prevOpen = useRef(false);
  if (open !== prevOpen.current) {
    prevOpen.current = open;
    if (open) {
      setForm({
        companyName: meeting?.companyName ?? "",
        productName: meeting?.productName ?? "",
        meetingTime: meeting?.meetingTime ?? "",
        location: meeting?.location ?? "",
        notes: meeting?.notes ?? "",
      });
    }
  }

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }));
  }

  function handleSave() {
    if (!form.companyName.trim()) return;
    const payload = {
      date,
      companyName: form.companyName.trim(),
      productName: form.productName.trim() || undefined,
      meetingTime: form.meetingTime.trim() || undefined,
      location: form.location.trim() || undefined,
      notes: form.notes.trim() || undefined,
    };
    if (meeting) onUpdate({ ...payload, id: meeting.id });
    else onCreate(payload);
  }

  const displayDate = date ? new Date(date + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" }) : "";

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{meeting ? "Edit Meeting" : "New Meeting"}</DialogTitle>
          <p className="text-sm text-muted-foreground">{displayDate}</p>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Company Name <span className="text-destructive">*</span></Label>
            <Input value={form.companyName} onChange={e => set("companyName", e.target.value)} placeholder="Enter company name" />
          </div>
          <div className="space-y-1.5">
            <Label>Product / Service <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Input value={form.productName} onChange={e => set("productName", e.target.value)} placeholder="e.g. Enterprise License" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Meeting Time <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input value={form.meetingTime} onChange={e => set("meetingTime", e.target.value)} placeholder="e.g. 10:30 AM" />
            </div>
            <div className="space-y-1.5">
              <Label>Location <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input value={form.location} onChange={e => set("location", e.target.value)} placeholder="Office / Zoom" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Notes <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Textarea value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Additional notes..." rows={3} />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          {meeting && (
            <Button variant="destructive" size="sm" onClick={() => onDelete(meeting.id)} disabled={deleting} className="mr-auto">
              <Trash2 className="w-3.5 h-3.5 mr-1" />
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

  const { data: targets = [] } = useQuery<Target[]>({
    queryKey: ["planner-targets", year],
    queryFn: () => apiFetch(`/api/planner/targets?year=${year}`),
  });

  const targetByMonth = targets.reduce<Record<number, Target>>((acc, t) => {
    acc[t.month] = t;
    return acc;
  }, {});

  const saveMutation = useMutation({
    mutationFn: ({ month, expectedSales, salesDone }: { month: number; expectedSales: number; salesDone: number }) =>
      apiFetch(`/api/planner/targets/${year}/${month}`, { method: "PUT", body: JSON.stringify({ expectedSales, salesDone }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["planner-targets"] }),
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const [editing, setEditing] = useState<{ month: number; field: "expectedSales" | "salesDone"; value: string } | null>(null);

  function startEdit(month: number, field: "expectedSales" | "salesDone", current: number) {
    setEditing({ month, field, value: String(current) });
  }

  function commitEdit() {
    if (!editing) return;
    const num = Math.max(0, parseInt(editing.value) || 0);
    const current = targetByMonth[editing.month];
    const expectedSales = editing.field === "expectedSales" ? num : (current?.expectedSales ?? 0);
    const salesDone = editing.field === "salesDone" ? num : (current?.salesDone ?? 0);
    saveMutation.mutate({ month: editing.month, expectedSales, salesDone });
    setEditing(null);
  }

  const totalExpected = MONTHS.reduce((s, _, i) => s + (targetByMonth[i + 1]?.expectedSales ?? 0), 0);
  const totalDone = MONTHS.reduce((s, _, i) => s + (targetByMonth[i + 1]?.salesDone ?? 0), 0);
  const totalPending = Math.max(0, totalExpected - totalDone);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Year navigation */}
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => setYear(y => y - 1)}><ChevronLeft className="w-4 h-4" /></Button>
        <span className="text-xl font-semibold w-16 text-center">{year}</span>
        <Button variant="ghost" size="icon" onClick={() => setYear(y => y + 1)}><ChevronRight className="w-4 h-4" /></Button>
        <span className="text-sm text-muted-foreground ml-2">Click any cell to edit</span>
      </div>

      <div className="border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-card border-b border-border">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground w-32">Month</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Expected Sales</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Sales Done</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Pending</th>
            </tr>
          </thead>
          <tbody>
            {MONTHS.map((name, idx) => {
              const mo = idx + 1;
              const t = targetByMonth[mo];
              const expected = t?.expectedSales ?? 0;
              const done = t?.salesDone ?? 0;
              const pending = Math.max(0, expected - done);
              const isCurrentMonth = mo === today.getMonth() + 1 && year === today.getFullYear();

              return (
                <tr key={mo} className={`border-b border-border last:border-0 hover:bg-accent/20 transition-colors ${isCurrentMonth ? "bg-primary/5" : ""}`}>
                  <td className="px-4 py-3 font-medium">
                    {name}
                    {isCurrentMonth && <span className="ml-2 text-xs text-primary font-semibold">● now</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <EditableCell
                      value={expected}
                      isEditing={editing?.month === mo && editing.field === "expectedSales"}
                      editValue={editing?.month === mo && editing.field === "expectedSales" ? editing.value : ""}
                      onStartEdit={() => startEdit(mo, "expectedSales", expected)}
                      onEditChange={v => setEditing(e => e ? { ...e, value: v } : e)}
                      onCommit={commitEdit}
                      onCancel={() => setEditing(null)}
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <EditableCell
                      value={done}
                      isEditing={editing?.month === mo && editing.field === "salesDone"}
                      editValue={editing?.month === mo && editing.field === "salesDone" ? editing.value : ""}
                      onStartEdit={() => startEdit(mo, "salesDone", done)}
                      onEditChange={v => setEditing(e => e ? { ...e, value: v } : e)}
                      onCommit={commitEdit}
                      onCancel={() => setEditing(null)}
                      highlight={done > 0 ? "success" : undefined}
                    />
                  </td>
                  <td className={`px-4 py-3 text-right font-medium ${pending > 0 ? "text-amber-500" : expected > 0 ? "text-green-500" : "text-muted-foreground"}`}>
                    {pending > 0 ? pending : expected > 0 ? "✓ Done" : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-card border-t-2 border-border font-semibold">
              <td className="px-4 py-3">Total</td>
              <td className="px-4 py-3 text-right">{totalExpected || "—"}</td>
              <td className="px-4 py-3 text-right text-green-500">{totalDone || "—"}</td>
              <td className={`px-4 py-3 text-right ${totalPending > 0 ? "text-amber-500" : totalExpected > 0 ? "text-green-500" : "text-muted-foreground"}`}>
                {totalPending > 0 ? totalPending : totalExpected > 0 ? "✓ All done" : "—"}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Summary cards */}
      {totalExpected > 0 && (
        <div className="grid grid-cols-3 gap-4 mt-6">
          <div className="bg-card border border-border rounded-lg p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Expected</p>
            <p className="text-2xl font-bold">{totalExpected}</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Done</p>
            <p className="text-2xl font-bold text-green-500">{totalDone}</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Pending</p>
            <p className={`text-2xl font-bold ${totalPending > 0 ? "text-amber-500" : "text-green-500"}`}>{totalPending}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Editable Cell ─────────────────────────────────────────────────────────────

function EditableCell({
  value, isEditing, editValue,
  onStartEdit, onEditChange, onCommit, onCancel,
  highlight,
}: {
  value: number;
  isEditing: boolean;
  editValue: string;
  onStartEdit: () => void;
  onEditChange: (v: string) => void;
  onCommit: () => void;
  onCancel: () => void;
  highlight?: "success";
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        autoFocus
        type="number"
        min={0}
        value={editValue}
        onChange={e => onEditChange(e.target.value)}
        onBlur={onCommit}
        onKeyDown={e => { if (e.key === "Enter") onCommit(); if (e.key === "Escape") onCancel(); }}
        className="w-20 text-right bg-background border border-primary rounded px-2 py-0.5 text-sm focus:outline-none ml-auto block"
      />
    );
  }

  return (
    <span
      onClick={onStartEdit}
      className={`cursor-pointer hover:underline decoration-dashed underline-offset-2 
        ${highlight === "success" ? "text-green-500" : ""}
        ${value === 0 ? "text-muted-foreground" : ""}`}
    >
      {value || "—"}
    </span>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

type Tab = "calendar" | "targets";

export default function Planner() {
  const [activeTab, setActiveTab] = useState<Tab>("calendar");

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="flex items-center gap-6 px-6 py-4 border-b border-border bg-card">
        <h1 className="text-lg font-semibold">Planner</h1>
        <div className="flex items-center gap-1 bg-secondary rounded-lg p-1">
          <button
            onClick={() => setActiveTab("calendar")}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all
              ${activeTab === "calendar" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            <CalendarDays className="w-4 h-4" />
            Calendar
          </button>
          <button
            onClick={() => setActiveTab("targets")}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all
              ${activeTab === "targets" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Target className="w-4 h-4" />
            Sales Targets
          </button>
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "calendar" ? <CalendarTab /> : <TargetsTab />}
      </div>
    </div>
  );
}
