import { useState, useEffect, useRef } from "react";
import {
  MapPin, Plus, Loader2, Navigation, CheckCircle2, Eye, X, Search, Filter,
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

// ── Leaflet map ───────────────────────────────────────────────────────────────
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

    const map = L.map(mapRef.current, {
      center: [lat, lng], zoom: 15,
      zoomControl: true, dragging: false,
      scrollWheelZoom: false, doubleClickZoom: false, touchZoom: false,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
    }).addTo(map);

    L.marker([lat, lng], { icon }).addTo(map);
    mapInstanceRef.current = map;

    return () => { map.remove(); mapInstanceRef.current = null; };
  }, [lat, lng]);

  return <div ref={mapRef} className={`w-full ${height} rounded-xl overflow-hidden border border-border/50`} />;
}

// ── View Activity Modal ───────────────────────────────────────────────────────
function ViewActivityModal({
  activity,
  onClose,
}: {
  activity: Activity | null;
  onClose: () => void;
}) {
  if (!activity) return null;
  const lat = parseFloat(activity.latitude);
  const lng = parseFloat(activity.longitude);

  return (
    <Dialog open={!!activity} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg w-full">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-violet-400" />
            Activity Details
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Date & Time strip */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-muted/40 rounded-xl p-3 border border-border/30 text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-1">Date</p>
              <p className="text-sm font-bold text-foreground">{formatDate(activity.date)}</p>
            </div>
            <div className="bg-muted/40 rounded-xl p-3 border border-border/30 text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-1">Time</p>
              <p className="text-sm font-bold text-foreground">{formatTime(activity.time)}</p>
            </div>
          </div>

          {/* Map */}
          <LocationMap lat={lat} lng={lng} height="h-56" />

          {/* Location address */}
          <div className="flex items-start gap-2 bg-muted/30 rounded-lg px-3 py-2.5 border border-border/30">
            <MapPin className="w-4 h-4 text-violet-400 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              {activity.locationName ?? `${activity.latitude}, ${activity.longitude}`}
            </p>
          </div>

          {/* Other details */}
          {(activity.company || activity.product || activity.meetingPerson) && (
            <div className="grid grid-cols-1 gap-2 border-t border-border/30 pt-3">
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
            {geoState !== "error" && (
              <Button
                type="button"
                onClick={handleGetLocation}
                disabled={geoState === "loading" || geoState === "done"}
                className="w-full gap-2"
                variant={geoState === "done" ? "outline" : "default"}
              >
                {geoState === "loading" && <Loader2 className="w-4 h-4 animate-spin" />}
                {geoState === "done" && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                {geoState === "idle" && <Navigation className="w-4 h-4" />}
                {geoState === "loading" ? "Getting location…" : geoState === "done" ? "Location captured" : "Get My Location"}
              </Button>
            )}

            {geoState === "error" && (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 space-y-2">
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-semibold text-sm">
                  <Navigation className="w-4 h-4 flex-shrink-0" />
                  {geoErrorCode === 1
                    ? "Location access was blocked"
                    : geoErrorCode === 3
                    ? "Location timed out"
                    : "Location unavailable"}
                </div>

                {geoErrorCode === 1 ? (
                  <div className="text-xs text-muted-foreground space-y-2 leading-relaxed">
                    <p>This website's location was previously blocked. Safari remembers this per website — follow the steps for your device:</p>
                    <div className="space-y-1 bg-background/60 rounded p-2">
                      <p className="font-semibold text-foreground">Safari (iPhone / iPad) — per-site reset:</p>
                      <p>1. Open the iPhone <span className="font-medium text-foreground">Settings</span> app</p>
                      <p>2. Scroll down and tap <span className="font-medium text-foreground">Safari</span></p>
                      <p>3. Tap <span className="font-medium text-foreground">Settings for Websites</span> → <span className="font-medium text-foreground">Location</span></p>
                      <p>4. Find this website and change it to <span className="font-medium text-foreground">Allow</span></p>
                      <p className="text-amber-600 dark:text-amber-400 mt-1">Or tap <span className="font-medium">Clear History and Website Data</span> in Safari settings to reset all site permissions.</p>
                    </div>
                    <div className="space-y-1 bg-background/60 rounded p-2">
                      <p className="font-semibold text-foreground">Chrome (Android):</p>
                      <p>Tap the lock 🔒 in the address bar → <span className="font-medium text-foreground">Site settings</span> → <span className="font-medium text-foreground">Location</span> → <span className="font-medium text-foreground">Allow</span></p>
                    </div>
                    <div className="space-y-1 bg-background/60 rounded p-2">
                      <p className="font-semibold text-foreground">Chrome (iPhone / iPad):</p>
                      <p>iPhone Settings → <span className="font-medium text-foreground">Privacy & Security</span> → <span className="font-medium text-foreground">Location Services</span> → <span className="font-medium text-foreground">Chrome</span> → <span className="font-medium text-foreground">While Using</span></p>
                    </div>
                    <p className="text-amber-600 dark:text-amber-400">After updating the permission, tap "Try Again" below.</p>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {geoErrorCode === 3
                      ? "Location took too long. Make sure GPS / Location Services is on, then try again."
                      : "Could not determine your location. Make sure Location Services is enabled on your device."}
                  </p>
                )}

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="w-full gap-2 mt-1"
                  onClick={handleGetLocation}
                >
                  <Navigation className="w-3.5 h-3.5" />
                  Try Again
                </Button>
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
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [viewActivity, setViewActivity] = useState<Activity | null>(null);

  // Filters
  const [filterDate, setFilterDate] = useState("");
  const [filterTime, setFilterTime] = useState("");
  const [filterLocation, setFilterLocation] = useState("");

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

  useEffect(() => { if (me) fetchActivities(); }, [me]);

  const filtered = activities.filter((a) => {
    if (filterDate && a.date !== filterDate) return false;
    if (filterTime) {
      const t = filterTime.replace(":", "");
      const at = a.time.replace(":", "");
      if (!at.startsWith(t.slice(0, at.length))) return false;
    }
    if (filterLocation) {
      const loc = (a.locationName ?? `${a.latitude}, ${a.longitude}`).toLowerCase();
      if (!loc.includes(filterLocation.toLowerCase())) return false;
    }
    return true;
  });

  const hasFilters = filterDate || filterTime || filterLocation;

  function clearFilters() { setFilterDate(""); setFilterTime(""); setFilterLocation(""); }

  return (
    <div className="p-6 max-w-6xl mx-auto">
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

      {/* ── Filters ── */}
      <div className="bg-card border border-border/50 rounded-xl p-4 mb-5">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">Filters</span>
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-3 h-3" /> Clear all
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Date */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Date</Label>
            <Input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="h-9 text-sm"
            />
          </div>
          {/* Time */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Time</Label>
            <Input
              type="time"
              value={filterTime}
              onChange={(e) => setFilterTime(e.target.value)}
              className="h-9 text-sm"
            />
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
                className="h-9 pl-8 text-sm"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="rounded-xl border border-border/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 bg-muted/30">
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground whitespace-nowrap">Date</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground whitespace-nowrap">Time</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground whitespace-nowrap">Location</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground whitespace-nowrap">Product</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground whitespace-nowrap">Meeting Person</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground whitespace-nowrap">Company</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground whitespace-nowrap">View</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Loader2 className="w-6 h-6 animate-spin" />
                      <span className="text-sm">Loading activities…</span>
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-3 text-muted-foreground">
                      <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center">
                        <MapPin className="w-6 h-6 opacity-40" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground/60">
                          {hasFilters ? "No activities match your filters" : "No activities yet"}
                        </p>
                        <p className="text-xs mt-0.5">
                          {hasFilters ? "Try adjusting the filters above" : `Click "Add Activity" to log your first field visit`}
                        </p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((act, i) => (
                  <tr
                    key={act.id}
                    className={`border-b border-border/30 transition-colors hover:bg-muted/20 ${i % 2 === 0 ? "" : "bg-muted/10"}`}
                  >
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

      {filtered.length > 0 && (
        <p className="text-xs text-muted-foreground mt-3 text-right">
          {filtered.length} of {activities.length} {activities.length === 1 ? "activity" : "activities"}
        </p>
      )}

      <AddActivityModal open={addOpen} onClose={() => setAddOpen(false)} onSaved={fetchActivities} />
      <ViewActivityModal activity={viewActivity} onClose={() => setViewActivity(null)} />
    </div>
  );
}
