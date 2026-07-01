import { useState, useEffect, useRef } from "react";
import { MapPin, Plus, Loader2, Navigation, X, CheckCircle2 } from "lucide-react";
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

// ── Leaflet map component ─────────────────────────────────────────────────────
function LocationMap({ lat, lng }: { lat: number; lng: number }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current) return;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const icon = L.divIcon({
      html: `<div style="
        width:32px;height:32px;border-radius:50% 50% 50% 0;
        background:#a78bfa;border:3px solid white;
        transform:rotate(-45deg);
        box-shadow:0 2px 8px rgba(167,139,250,0.6)
      "></div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      className: "",
    });

    const map = L.map(mapRef.current, {
      center: [lat, lng],
      zoom: 15,
      zoomControl: true,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      touchZoom: false,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
    }).addTo(map);

    L.marker([lat, lng], { icon }).addTo(map);

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [lat, lng]);

  return <div ref={mapRef} className="w-full h-52 rounded-xl overflow-hidden border border-border/50" />;
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
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationName, setLocationName] = useState("");
  const [company, setCompany] = useState("");
  const [product, setProduct] = useState("");
  const [meetingPerson, setMeetingPerson] = useState("");
  const [saving, setSaving] = useState(false);

  function reset() {
    setGeoState("idle");
    setCoords(null);
    setLocationName("");
    setCompany("");
    setProduct("");
    setMeetingPerson("");
    setSaving(false);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleGetLocation() {
    if (!navigator.geolocation) {
      toast({ title: "Geolocation not supported by your browser", variant: "destructive" });
      return;
    }
    setGeoState("loading");
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
        console.error(err);
        setGeoState("error");
        toast({
          title: "Location access denied",
          description: "Please allow location access in your browser settings.",
          variant: "destructive",
        });
      },
      { enableHighAccuracy: true, timeout: 15000 },
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
          date,
          time,
          latitude: coords.lat,
          longitude: coords.lng,
          locationName: locationName || undefined,
          company: company.trim() || undefined,
          product: product.trim() || undefined,
          meetingPerson: meetingPerson.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      toast({ title: "Activity saved" });
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
      <DialogContent className="max-w-md w-full">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-violet-400" />
            Add Activity
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Get Location */}
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
              {geoState === "idle" || geoState === "error" ? <Navigation className="w-4 h-4" /> : null}
              {geoState === "loading"
                ? "Getting location…"
                : geoState === "done"
                ? "Location captured"
                : "Get Location"}
            </Button>

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

          {/* Optional fields */}
          <div className="space-y-3 pt-1 border-t border-border/40">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Optional details</p>

            <div className="space-y-1.5">
              <Label htmlFor="act-company" className="text-sm">Company</Label>
              <Input
                id="act-company"
                placeholder="e.g. Al-Farid Textiles"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="act-product" className="text-sm">Product</Label>
              <Input
                id="act-product"
                placeholder="e.g. Juki DDL-9000C"
                value={product}
                onChange={(e) => setProduct(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="act-person" className="text-sm">Customer Name</Label>
              <Input
                id="act-person"
                placeholder="e.g. Ahmed Al-Rashid"
                value={meetingPerson}
                onChange={(e) => setMeetingPerson(e.target.value)}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={handleClose} disabled={saving}>
              Cancel
            </Button>
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
  const [modalOpen, setModalOpen] = useState(false);

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

  useEffect(() => {
    if (me) fetchActivities();
  }, [me]);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MapPin className="w-6 h-6 text-violet-400" />
            My Activities
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Track your field visits and customer meetings</p>
        </div>
        <Button onClick={() => setModalOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          Add Activity
        </Button>
      </div>

      {/* Table */}
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
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Loader2 className="w-6 h-6 animate-spin" />
                      <span className="text-sm">Loading activities…</span>
                    </div>
                  </td>
                </tr>
              ) : activities.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-3 text-muted-foreground">
                      <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center">
                        <MapPin className="w-6 h-6 opacity-40" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground/60">No activities yet</p>
                        <p className="text-xs mt-0.5">Click "Add Activity" to log your first field visit</p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                activities.map((act, i) => (
                  <tr
                    key={act.id}
                    className={`border-b border-border/30 transition-colors hover:bg-muted/20 ${i % 2 === 0 ? "" : "bg-muted/10"}`}
                  >
                    <td className="px-4 py-3 font-medium whitespace-nowrap">{formatDate(act.date)}</td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{formatTime(act.time)}</td>
                    <td className="px-4 py-3 max-w-56">
                      <div className="flex items-start gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-violet-400 mt-0.5 flex-shrink-0" />
                        <span className="text-xs text-muted-foreground leading-snug line-clamp-2">
                          {act.locationName ?? `${act.latitude}, ${act.longitude}`}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {act.product ? (
                        <span className="inline-block bg-violet-500/10 text-violet-400 text-xs font-medium px-2 py-0.5 rounded-full border border-violet-500/20">
                          {act.product}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/40 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {act.meetingPerson ?? <span className="text-muted-foreground/40 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {act.company ? (
                        <span className="font-medium text-foreground/80">{act.company}</span>
                      ) : (
                        <span className="text-muted-foreground/40 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {activities.length > 0 && (
        <p className="text-xs text-muted-foreground mt-3 text-right">
          {activities.length} {activities.length === 1 ? "activity" : "activities"} recorded
        </p>
      )}

      <AddActivityModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={fetchActivities}
      />
    </div>
  );
}
