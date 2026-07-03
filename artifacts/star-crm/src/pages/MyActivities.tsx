import { useState, useEffect, useRef } from "react";
import {
  MapPin, Plus, Loader2, Navigation, CheckCircle2, Eye, X, Search,
  Filter, Map, List, ChevronDown, Check, Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useGetMe } from "@workspace/api-client-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface Activity {
  id: number;
  salespersonId: number;
  date: string;
  time: string;
  latitude: string;
  longitude: string;
  locationName: string | null;
  company: string | null;
  product: string | null;
  meetingPerson: string | null;
  createdAt: string;
}

interface User {
  id: number;
  name: string;
  role: string;
}

function formatTime(t: string) {
  const [h, m] = t.split(":");
  const hour = Number(h);
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}

function formatDate(d: string) {
  const dt = new Date(d + "T00:00:00");
  return dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

// Distinct colors for up to 14 salespersons
const SP_COLORS = [
  "#a78bfa", "#f472b6", "#34d399", "#60a5fa", "#fb923c",
  "#a3e635", "#e879f9", "#2dd4bf", "#fbbf24", "#f87171",
  "#818cf8", "#4ade80", "#f97316", "#38bdf8",
];

// ── Single-pin location map (used in modals) ───────────────────────────────────
function LocationMap({ lat, lng, height = "h-52" }: { lat: number; lng: number; height?: string }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current) return;
    if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; }

    const icon = L.divIcon({
      html: `<div style="width:28px;height:28px;border-radius:50% 50% 50% 0;background:#a78bfa;border:3px solid white;transform:rotate(-45deg);box-shadow:0 2px 8px rgba(167,139,250,0.6)"></div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 28],
      className: "",
    });

    const map = L.map(mapRef.current, { zoomControl: true, dragging: true, scrollWheelZoom: false });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
    }).addTo(map);
    L.marker([lat, lng], { icon }).addTo(map);
    map.setView([lat, lng], 15);
    mapInstanceRef.current = map;

    return () => { map.remove(); mapInstanceRef.current = null; };
  }, [lat, lng]);

  return <div ref={mapRef} className={`w-full ${height} rounded-lg overflow-hidden`} />;
}

// ── Multi-pin map for Map View (owner) ────────────────────────────────────────
function AllActivitiesMap({
  activities,
  usersMap,
}: {
  activities: Activity[];
  usersMap: Record<number, string>;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);

  // Init map once
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;
    const map = L.map(mapRef.current, { zoomControl: true });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
    }).addTo(map);
    map.setView([25, 45], 5);
    mapInstanceRef.current = map;
    return () => { map.remove(); mapInstanceRef.current = null; };
  }, []);

  // Update markers when activities change
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    if (activities.length === 0) return;

    const spIds = [...new Set(activities.map((a) => a.salespersonId))];
    const spColorMap: Record<number, string> = {};
    spIds.forEach((id, i) => { spColorMap[id] = SP_COLORS[i % SP_COLORS.length]; });

    const bounds: [number, number][] = [];

    activities.forEach((act) => {
      const lat = parseFloat(act.latitude);
      const lng = parseFloat(act.longitude);
      if (isNaN(lat) || isNaN(lng)) return;

      const color = spColorMap[act.salespersonId] ?? "#a78bfa";
      const spName = usersMap[act.salespersonId] ?? "Unknown";
      const initials = spName
        .split(" ")
        .map((w) => w[0] ?? "")
        .join("")
        .toUpperCase()
        .slice(0, 2);

      const icon = L.divIcon({
        html: `<div style="position:relative;width:36px;height:36px">
          <div style="width:36px;height:36px;border-radius:50% 50% 50% 0;background:${color};border:3px solid white;transform:rotate(-45deg);box-shadow:0 2px 10px rgba(0,0,0,0.25)"></div>
          <div style="position:absolute;top:5px;left:5px;width:24px;height:24px;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:800;color:white;letter-spacing:0.5px">${initials}</div>
        </div>`,
        iconSize: [36, 36],
        iconAnchor: [18, 36],
        className: "",
      });

      const locLine = act.locationName
        ? `<div style="margin-top:4px;font-size:11px;color:#666;max-width:200px;word-wrap:break-word">${act.locationName.slice(0, 100)}${act.locationName.length > 100 ? "…" : ""}</div>`
        : "";
      const companyLine = act.company ? `<div><b>Company:</b> ${act.company}</div>` : "";
      const productLine = act.product ? `<div><b>Product:</b> ${act.product}</div>` : "";
      const customerLine = act.meetingPerson ? `<div><b>Customer:</b> ${act.meetingPerson}</div>` : "";

      const popup = `<div style="font-family:Arial,sans-serif;font-size:12px;min-width:170px;line-height:1.6">
        <div style="font-weight:800;font-size:13px;color:${color};margin-bottom:5px;border-bottom:2px solid ${color}22;padding-bottom:4px">${spName}</div>
        <div><b>Date:</b> ${formatDate(act.date)}</div>
        <div><b>Time:</b> ${formatTime(act.time)}</div>
        ${companyLine}${productLine}${customerLine}${locLine}
      </div>`;

      const marker = L.marker([lat, lng], { icon }).addTo(map);
      marker.bindPopup(popup, { maxWidth: 240 });
      markersRef.current.push(marker);
      bounds.push([lat, lng]);
    });

    if (bounds.length === 1) {
      map.setView(bounds[0], 14);
    } else if (bounds.length > 1) {
      map.fitBounds(bounds as L.LatLngBoundsExpression, { padding: [50, 50] });
    }
  }, [activities, usersMap]);

  return (
    <div ref={mapRef} className="w-full rounded-xl overflow-hidden" style={{ height: "calc(100vh - 340px)", minHeight: "460px" }} />
  );
}

// ── Multi-select salesperson dropdown ─────────────────────────────────────────
function MultiSelectSalesperson({
  users,
  selected,
  onChange,
}: {
  users: User[];
  selected: number[];
  onChange: (ids: number[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      const target = e.target as Node;
      if (
        buttonRef.current && !buttonRef.current.contains(target) &&
        dropdownRef.current && !dropdownRef.current.contains(target)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  function handleOpen() {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    setDropdownStyle({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    setOpen((o) => !o);
  }

  function toggle(id: number) {
    onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);
  }

  function selectAll() { onChange([]); }

  const label =
    selected.length === 0
      ? "All salespersons"
      : selected.length === 1
      ? (users.find((u) => u.id === selected[0])?.name ?? "1 selected")
      : `${selected.length} selected`;

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={handleOpen}
        className="flex items-center gap-2 w-full h-9 px-3 rounded-md border border-input bg-background text-sm hover:bg-muted/30 transition-colors"
      >
        <Users className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
        <span className="flex-1 text-left truncate text-foreground">{label}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div
          ref={dropdownRef}
          style={{ position: "fixed", top: dropdownStyle.top, left: dropdownStyle.left, width: dropdownStyle.width, zIndex: 99999 }}
          className="bg-popover border border-border rounded-md shadow-lg max-h-56 overflow-y-auto"
        >
          <button
            type="button"
            onClick={selectAll}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-muted/50 text-left border-b border-border/40"
          >
            <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${selected.length === 0 ? "bg-violet-500 border-violet-500" : "border-muted-foreground/40"}`}>
              {selected.length === 0 && <Check className="w-3 h-3 text-white" />}
            </div>
            <span className="font-medium">All salespersons</span>
          </button>
          {users.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => toggle(u.id)}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-muted/50 text-left"
            >
              <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${selected.includes(u.id) ? "bg-violet-500 border-violet-500" : "border-muted-foreground/40"}`}>
                {selected.includes(u.id) && <Check className="w-3 h-3 text-white" />}
              </div>
              {u.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── View Activity Modal ────────────────────────────────────────────────────────
function ViewActivityModal({
  activity,
  onClose,
  salespersonName,
}: {
  activity: Activity | null;
  onClose: () => void;
  salespersonName?: string;
}) {
  if (!activity) return null;
  const lat = parseFloat(activity.latitude);
  const lng = parseFloat(activity.longitude);
  const hasCoords = !isNaN(lat) && !isNaN(lng);

  return (
    <Dialog open={!!activity} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md w-full max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-violet-400" />
            Activity Details
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {salespersonName && (
            <div className="flex items-center gap-2 bg-violet-500/10 border border-violet-500/20 rounded-lg px-3 py-2">
              <Users className="w-4 h-4 text-violet-400 flex-shrink-0" />
              <span className="text-sm font-semibold text-violet-300">{salespersonName}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-muted/40 rounded-lg p-3 text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium mb-1">Date</p>
              <p className="font-semibold text-sm">{formatDate(activity.date)}</p>
            </div>
            <div className="bg-muted/40 rounded-lg p-3 text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium mb-1">Time</p>
              <p className="font-semibold text-sm">{formatTime(activity.time)}</p>
            </div>
          </div>

          {hasCoords && (
            <div className="space-y-2">
              <LocationMap lat={lat} lng={lng} />
              <div className="flex items-start gap-2 bg-muted/40 rounded-lg px-3 py-2">
                <MapPin className="w-3.5 h-3.5 text-violet-400 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-muted-foreground leading-snug">
                  {activity.locationName ?? `${activity.latitude}, ${activity.longitude}`}
                </p>
              </div>
            </div>
          )}

          {(activity.company || activity.product || activity.meetingPerson) && (
            <div className="bg-muted/20 rounded-lg p-3 space-y-2">
              {activity.meetingPerson && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Customer</span>
                  <span className="font-medium">{activity.meetingPerson}</span>
                </div>
              )}
              {activity.company && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Company</span>
                  <span className="font-medium">{activity.company}</span>
                </div>
              )}
              {activity.product && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Product</span>
                  <span className="inline-block bg-violet-500/10 text-violet-400 text-xs font-medium px-2 py-0.5 rounded-full border border-violet-500/20">
                    {activity.product}
                  </span>
                </div>
              )}
            </div>
          )}

          <Button variant="outline" className="w-full" onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Add Activity Modal ────────────────────────────────────────────────────────
function AddActivityModal({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [geoState, setGeoState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [geoErrorCode, setGeoErrorCode] = useState<number | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationName, setLocationName] = useState("");
  const [company, setCompany] = useState("");
  const [product, setProduct] = useState("");
  const [meetingPerson, setMeetingPerson] = useState("");
  const [saving, setSaving] = useState(false);

  function reset() {
    setGeoState("idle"); setGeoErrorCode(null); setCoords(null); setLocationName("");
    setCompany(""); setProduct(""); setMeetingPerson(""); setSaving(false);
  }

  function handleClose() { reset(); onClose(); }

  function handleGetLocation() {
    if (!navigator.geolocation) {
      setGeoState("error");
      setGeoErrorCode(2);
      return;
    }
    setGeoState("loading");
    setGeoErrorCode(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setCoords({ lat, lng });
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
            { headers: { "Accept-Language": "en" } },
          );
          const data = await res.json();
          setLocationName(data.display_name ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`);
        } catch {
          setLocationName(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
        }
        setGeoState("done");
      },
      (err) => {
        setGeoState("error");
        setGeoErrorCode(err.code);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }

  async function handleSave() {
    if (!coords) {
      toast({ title: "Please get your location first", variant: "destructive" });
      return;
    }
    setSaving(true);
    const now = new Date();
    const date = now.toISOString().split("T")[0];
    const time = now.toTimeString().slice(0, 5);
    try {
      const res = await fetch(`${BASE}/api/activities`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date, time,
          latitude: coords.lat,
          longitude: coords.lng,
          locationName: locationName || undefined,
          company: company.trim() || undefined,
          product: product.trim() || undefined,
          meetingPerson: meetingPerson.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      toast({ title: "Activity saved successfully" });
      onSaved();
      handleClose();
    } catch {
      toast({ title: "Failed to save activity", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-md w-full max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-violet-400" />
            Add Activity
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          <div className="space-y-3">
            <Button
              type="button"
              onClick={handleGetLocation}
              disabled={geoState === "loading" || geoState === "done"}
              className="w-full gap-2"
              variant={geoState === "done" ? "outline" : "default"}
            >
              {geoState === "loading" && <Loader2 className="w-4 h-4 animate-spin" />}
              {geoState === "done" && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
              {geoState === "error" && <Navigation className="w-4 h-4" />}
              {geoState === "idle" && <Navigation className="w-4 h-4" />}
              {geoState === "loading"
                ? "Getting location…"
                : geoState === "done"
                ? "Location captured"
                : geoState === "error"
                ? "Try Again"
                : "Get My Location"}
            </Button>

            {geoState === "error" && (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 space-y-1">
                <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                  {geoErrorCode === 1
                    ? "Location permission was blocked"
                    : geoErrorCode === 3
                    ? "Location timed out — is GPS on?"
                    : "Location service is off on this device"}
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {geoErrorCode === 1
                    ? "Your browser blocked this site from accessing location. Open your browser or device settings, allow location for this site, then tap \"Try Again\"."
                    : geoErrorCode === 3
                    ? "GPS took too long to respond. Make sure Location Services is enabled, then tap \"Try Again\"."
                    : "Go to your device Settings → Privacy → Location Services and turn it on, then tap \"Try Again\"."}
                </p>
              </div>
            )}

            {geoState === "done" && coords && (
              <div className="space-y-2">
                <LocationMap lat={coords.lat} lng={coords.lng} />
                <div className="flex items-start gap-2 bg-muted/40 rounded-lg px-3 py-2">
                  <MapPin className="w-3.5 h-3.5 text-violet-400 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-muted-foreground leading-snug">{locationName}</p>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-3 pt-1 border-t border-border/40">
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Optional details</p>

            <div className="space-y-1.5">
              <Label htmlFor="act-company" className="text-sm">Company</Label>
              <Input id="act-company" placeholder="e.g. Al-Farid Textiles" value={company} onChange={(e) => setCompany(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="act-product" className="text-sm">Product</Label>
              <Input id="act-product" placeholder="e.g. Juki DDL-9000C" value={product} onChange={(e) => setProduct(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="act-person" className="text-sm">Customer Name</Label>
              <Input id="act-person" placeholder="e.g. Ahmed Al-Rashid" value={meetingPerson} onChange={(e) => setMeetingPerson(e.target.value)} />
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={handleClose} disabled={saving}>Cancel</Button>
            <Button className="flex-1 gap-2" onClick={handleSave} disabled={saving || !coords}>
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Save Activity
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function MyActivities() {
  const { data: me } = useGetMe();
  const { toast } = useToast();
  const isOwner = me?.role === "owner";

  const [activeTab, setActiveTab] = useState<"list" | "map">("list");
  const [activities, setActivities] = useState<Activity[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [viewActivity, setViewActivity] = useState<Activity | null>(null);

  // List tab filters
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterTimeFrom, setFilterTimeFrom] = useState("");
  const [filterTimeTo, setFilterTimeTo] = useState("");
  const [filterLocation, setFilterLocation] = useState("");
  const [filterSalesperson, setFilterSalesperson] = useState<number[]>([]);

  // Map tab filters
  const [mapSalespeople, setMapSalespeople] = useState<number[]>([]);
  const [mapDateFrom, setMapDateFrom] = useState("");
  const [mapDateTo, setMapDateTo] = useState("");
  const [mapTimeFrom, setMapTimeFrom] = useState("");
  const [mapTimeTo, setMapTimeTo] = useState("");

  async function fetchActivities() {
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/activities`, { credentials: "include" });
      const data = await res.json();
      setActivities(Array.isArray(data) ? data : []);
    } catch {
      toast({ title: "Failed to load activities", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function fetchUsers() {
    try {
      const res = await fetch(`${BASE}/api/users`, { credentials: "include" });
      const data = await res.json();
      setUsers(Array.isArray(data) ? data : []);
    } catch {
      // non-critical
    }
  }

  useEffect(() => {
    if (me) {
      fetchActivities();
      if (me.role === "owner") fetchUsers();
    }
  }, [me]);

  const usersMap: Record<number, string> = {};
  users.forEach((u) => { usersMap[u.id] = u.name; });

  // List tab filtered
  const listFiltered = activities.filter((a) => {
    if (filterDateFrom && a.date < filterDateFrom) return false;
    if (filterDateTo && a.date > filterDateTo) return false;
    if (filterTimeFrom && a.time < filterTimeFrom) return false;
    if (filterTimeTo && a.time > filterTimeTo) return false;
    if (filterLocation) {
      const loc = (a.locationName ?? `${a.latitude}, ${a.longitude}`).toLowerCase();
      if (!loc.includes(filterLocation.toLowerCase())) return false;
    }
    if (filterSalesperson.length > 0 && !filterSalesperson.includes(a.salespersonId)) return false;
    return true;
  });

  // Map tab filtered
  const mapFiltered = activities.filter((a) => {
    if (mapSalespeople.length > 0 && !mapSalespeople.includes(a.salespersonId)) return false;
    if (mapDateFrom && a.date < mapDateFrom) return false;
    if (mapDateTo && a.date > mapDateTo) return false;
    if (mapTimeFrom && a.time < mapTimeFrom) return false;
    if (mapTimeTo && a.time > mapTimeTo) return false;
    return true;
  });

  const hasListFilters = filterDateFrom || filterDateTo || filterTimeFrom || filterTimeTo || filterLocation || filterSalesperson.length > 0;
  const hasMapFilters = mapSalespeople.length > 0 || mapDateFrom || mapDateTo || mapTimeFrom || mapTimeTo;

  function clearListFilters() { setFilterDateFrom(""); setFilterDateTo(""); setFilterTimeFrom(""); setFilterTimeTo(""); setFilterLocation(""); setFilterSalesperson([]); }
  function clearMapFilters() { setMapSalespeople([]); setMapDateFrom(""); setMapDateTo(""); setMapTimeFrom(""); setMapTimeTo(""); }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MapPin className="w-6 h-6 text-violet-400" />
            My Activities
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Track your field visits and customer meetings</p>
        </div>
        <Button onClick={() => setAddOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          Add Activity
        </Button>
      </div>

      {/* Tabs — Map View only visible to owner */}
      {isOwner && (
        <div className="flex gap-1 bg-muted/40 rounded-lg p-1 mb-5 w-fit">
          <button
            type="button"
            onClick={() => setActiveTab("list")}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === "list"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <List className="w-4 h-4" />
            List View
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("map")}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === "map"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Map className="w-4 h-4" />
            Map View
          </button>
        </div>
      )}

      {/* ── LIST VIEW ── */}
      {activeTab === "list" && (
        <>
          <div className="bg-card border border-border/50 rounded-xl p-4 mb-5">
            <div className="flex items-center gap-2 mb-3">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Filters</span>
              {hasListFilters && (
                <button
                  onClick={clearListFilters}
                  className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="w-3 h-3" /> Clear all
                </button>
              )}
            </div>
            <div className="flex flex-wrap items-end gap-3">
              {/* Date From → To */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Date From → To</Label>
                <div className="flex gap-1.5 items-center">
                  <Input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} className="h-9 text-sm w-36" />
                  <span className="text-muted-foreground text-xs flex-shrink-0">–</span>
                  <Input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} className="h-9 text-sm w-36" />
                </div>
              </div>

              {/* Divider */}
              <div className="h-9 w-px bg-border/60 self-end mb-0.5 hidden sm:block" />

              {/* Time From → To */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Time From → To</Label>
                <div className="flex gap-1.5 items-center">
                  <Input type="time" value={filterTimeFrom} onChange={(e) => setFilterTimeFrom(e.target.value)} className="h-9 text-sm w-28" />
                  <span className="text-muted-foreground text-xs flex-shrink-0">–</span>
                  <Input type="time" value={filterTimeTo} onChange={(e) => setFilterTimeTo(e.target.value)} className="h-9 text-sm w-28" />
                </div>
              </div>

              {/* Location */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Location</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                  <Input
                    placeholder="Search location…"
                    value={filterLocation}
                    onChange={(e) => setFilterLocation(e.target.value)}
                    className="h-9 pl-8 text-sm w-44"
                  />
                </div>
              </div>

              {/* Salesperson */}
              {isOwner && users.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Salesperson</Label>
                  <div className="w-44">
                    <MultiSelectSalesperson
                      users={users}
                      selected={filterSalesperson}
                      onChange={setFilterSalesperson}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-border/60 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/30">
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground whitespace-nowrap w-10">#</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground whitespace-nowrap">Date</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground whitespace-nowrap">Time</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground whitespace-nowrap">Location</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground whitespace-nowrap">Product</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground whitespace-nowrap">Meeting Person</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground whitespace-nowrap">Company</th>
                    {isOwner && <th className="text-left px-4 py-3 font-semibold text-muted-foreground whitespace-nowrap">Salesperson</th>}
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground whitespace-nowrap">View</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={isOwner ? 9 : 8} className="py-16 text-center">
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                          <Loader2 className="w-6 h-6 animate-spin" />
                          <span className="text-sm">Loading activities…</span>
                        </div>
                      </td>
                    </tr>
                  ) : listFiltered.length === 0 ? (
                    <tr>
                      <td colSpan={isOwner ? 9 : 8} className="py-16 text-center">
                        <div className="flex flex-col items-center gap-3 text-muted-foreground">
                          <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center">
                            <MapPin className="w-6 h-6 opacity-40" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground/60">
                              {hasListFilters ? "No activities match your filters" : "No activities yet"}
                            </p>
                            <p className="text-xs mt-0.5">
                              {hasListFilters ? "Try adjusting the filters above" : `Click "Add Activity" to log your first field visit`}
                            </p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    listFiltered.map((act, i) => (
                      <tr
                        key={act.id}
                        className={`border-b border-border/30 transition-colors hover:bg-muted/20 ${i % 2 === 0 ? "" : "bg-muted/10"}`}
                      >
                        <td className="px-4 py-3 text-muted-foreground text-sm w-10">{i + 1}</td>
                        <td className="px-4 py-3 font-medium whitespace-nowrap">{formatDate(act.date)}</td>
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{formatTime(act.time)}</td>
                        <td className="px-4 py-3 max-w-52">
                          <div className="flex items-start gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-violet-400 mt-0.5 flex-shrink-0" />
                            <span className="text-xs text-muted-foreground leading-snug line-clamp-2">
                              {act.locationName ?? `${act.latitude}, ${act.longitude}`}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {act.product
                            ? <span className="inline-block bg-violet-500/10 text-violet-400 text-xs font-medium px-2 py-0.5 rounded-full border border-violet-500/20">{act.product}</span>
                            : <span className="text-muted-foreground/40 text-xs">—</span>}
                        </td>
                        <td className="px-4 py-3 font-medium">
                          {act.meetingPerson ?? <span className="text-muted-foreground/40 text-xs">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          {act.company
                            ? <span className="font-medium text-foreground/80">{act.company}</span>
                            : <span className="text-muted-foreground/40 text-xs">—</span>}
                        </td>
                        {isOwner && (
                          <td className="px-4 py-3 whitespace-nowrap font-medium text-sm">
                            {usersMap[act.salespersonId] ?? <span className="text-muted-foreground/40 text-xs">—</span>}
                          </td>
                        )}
                        <td className="px-4 py-3">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 gap-1.5 text-violet-400 hover:text-violet-300 hover:bg-violet-500/10"
                            onClick={() => setViewActivity(act)}
                          >
                            <Eye className="w-3.5 h-3.5" />
                            View
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {listFiltered.length > 0 && (
            <p className="text-xs text-muted-foreground mt-3 text-right">
              {listFiltered.length} of {activities.length} {activities.length === 1 ? "activity" : "activities"}
            </p>
          )}
        </>
      )}

      {/* ── MAP VIEW (owner only) ── */}
      {activeTab === "map" && isOwner && (
        <>
          {/* Map filters */}
          <div className="bg-card border border-border/50 rounded-xl p-4 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Filters</span>
              <span className="text-xs text-muted-foreground ml-1">({mapFiltered.length} pin{mapFiltered.length !== 1 ? "s" : ""})</span>
              {hasMapFilters && (
                <button
                  onClick={clearMapFilters}
                  className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="w-3 h-3" /> Clear all
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {/* Salesperson multi-select */}
              <div className="space-y-1.5 lg:col-span-2">
                <Label className="text-xs text-muted-foreground">Salesperson</Label>
                <MultiSelectSalesperson
                  users={users.filter((u) => u.role !== "owner")}
                  selected={mapSalespeople}
                  onChange={setMapSalespeople}
                />
              </div>
              {/* Date from */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Date From</Label>
                <Input type="date" value={mapDateFrom} onChange={(e) => setMapDateFrom(e.target.value)} className="h-9 text-sm" />
              </div>
              {/* Date to */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Date To</Label>
                <Input type="date" value={mapDateTo} onChange={(e) => setMapDateTo(e.target.value)} className="h-9 text-sm" />
              </div>
              {/* Time range */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Time From → To</Label>
                <div className="flex gap-1.5 items-center">
                  <Input type="time" value={mapTimeFrom} onChange={(e) => setMapTimeFrom(e.target.value)} className="h-9 text-sm flex-1" />
                  <span className="text-muted-foreground text-xs">–</span>
                  <Input type="time" value={mapTimeTo} onChange={(e) => setMapTimeTo(e.target.value)} className="h-9 text-sm flex-1" />
                </div>
              </div>
            </div>
          </div>

          {/* Legend */}
          {mapFiltered.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {[...new Set(mapFiltered.map((a) => a.salespersonId))].map((spId, i) => (
                <div key={spId} className="flex items-center gap-1.5 bg-muted/40 rounded-full px-2.5 py-1 text-xs">
                  <div
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ background: SP_COLORS[i % SP_COLORS.length] }}
                  />
                  <span>{usersMap[spId] ?? `SP #${spId}`}</span>
                </div>
              ))}
            </div>
          )}

          {/* Map */}
          {loading ? (
            <div className="flex items-center justify-center rounded-xl border border-border/60 bg-muted/20" style={{ height: "460px" }}>
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <Loader2 className="w-6 h-6 animate-spin" />
                <span className="text-sm">Loading activities…</span>
              </div>
            </div>
          ) : mapFiltered.length === 0 ? (
            <div className="flex items-center justify-center rounded-xl border border-border/60 bg-muted/20" style={{ height: "460px" }}>
              <div className="flex flex-col items-center gap-3 text-muted-foreground">
                <Map className="w-10 h-10 opacity-30" />
                <div className="text-center">
                  <p className="font-medium text-foreground/60">
                    {hasMapFilters ? "No activities match your filters" : "No activities to show"}
                  </p>
                  <p className="text-xs mt-0.5">
                    {hasMapFilters ? "Try adjusting the filters above" : "Activities will appear here once logged"}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <AllActivitiesMap activities={mapFiltered} usersMap={usersMap} />
          )}
        </>
      )}

      <AddActivityModal open={addOpen} onClose={() => setAddOpen(false)} onSaved={fetchActivities} />
      <ViewActivityModal
        activity={viewActivity}
        onClose={() => setViewActivity(null)}
        salespersonName={viewActivity && isOwner ? usersMap[viewActivity.salespersonId] : undefined}
      />
    </div>
  );
}
