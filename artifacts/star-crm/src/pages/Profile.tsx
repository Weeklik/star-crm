import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Camera, User } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const COUNTRIES: { code: string; name: string; currency: string }[] = [
  { code: "KSA",      name: "KSA (SAR)",      currency: "SAR" },
  { code: "UAE",      name: "UAE (AED)",       currency: "AED" },
  { code: "Nigeria",  name: "Nigeria (NGN)",   currency: "NGN" },
  { code: "Tunisia",  name: "Tunisia (TND)",   currency: "TND" },
  { code: "Egypt",    name: "Egypt (EGP)",     currency: "EGP" },
  { code: "Kenya",    name: "Kenya (KES)",     currency: "KES" },
  { code: "Ethiopia", name: "Ethiopia (ETB)",  currency: "ETB" },
];

const CURRENCIES = [
  { code: "AED", label: "AED — UAE Dirham" },
  { code: "ARS", label: "ARS — Argentine Peso" },
  { code: "AUD", label: "AUD — Australian Dollar" },
  { code: "BDT", label: "BDT — Bangladeshi Taka" },
  { code: "BHD", label: "BHD — Bahraini Dinar" },
  { code: "BRL", label: "BRL — Brazilian Real" },
  { code: "CAD", label: "CAD — Canadian Dollar" },
  { code: "CHF", label: "CHF — Swiss Franc" },
  { code: "CLP", label: "CLP — Chilean Peso" },
  { code: "CNY", label: "CNY — Chinese Yuan" },
  { code: "COP", label: "COP — Colombian Peso" },
  { code: "DKK", label: "DKK — Danish Krone" },
  { code: "EGP", label: "EGP — Egyptian Pound" },
  { code: "EUR", label: "EUR — Euro" },
  { code: "GBP", label: "GBP — British Pound" },
  { code: "HKD", label: "HKD — Hong Kong Dollar" },
  { code: "IDR", label: "IDR — Indonesian Rupiah" },
  { code: "ILS", label: "ILS — Israeli Shekel" },
  { code: "INR", label: "INR — Indian Rupee" },
  { code: "JPY", label: "JPY — Japanese Yen" },
  { code: "KES", label: "KES — Kenyan Shilling" },
  { code: "KRW", label: "KRW — South Korean Won" },
  { code: "KWD", label: "KWD — Kuwaiti Dinar" },
  { code: "LKR", label: "LKR — Sri Lankan Rupee" },
  { code: "MXN", label: "MXN — Mexican Peso" },
  { code: "MYR", label: "MYR — Malaysian Ringgit" },
  { code: "NGN", label: "NGN — Nigerian Naira" },
  { code: "NOK", label: "NOK — Norwegian Krone" },
  { code: "NZD", label: "NZD — New Zealand Dollar" },
  { code: "OMR", label: "OMR — Omani Rial" },
  { code: "PHP", label: "PHP — Philippine Peso" },
  { code: "PKR", label: "PKR — Pakistani Rupee" },
  { code: "PLN", label: "PLN — Polish Zloty" },
  { code: "QAR", label: "QAR — Qatari Riyal" },
  { code: "RUB", label: "RUB — Russian Ruble" },
  { code: "SAR", label: "SAR — Saudi Riyal" },
  { code: "SEK", label: "SEK — Swedish Krona" },
  { code: "SGD", label: "SGD — Singapore Dollar" },
  { code: "THB", label: "THB — Thai Baht" },
  { code: "TRY", label: "TRY — Turkish Lira" },
  { code: "TWD", label: "TWD — Taiwan Dollar" },
  { code: "USD", label: "USD — US Dollar" },
  { code: "VND", label: "VND — Vietnamese Dong" },
  { code: "ZAR", label: "ZAR — South African Rand" },
];

const selectClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

export default function Profile() {
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(user?.name ?? "");
  const [dateOfJoining, setDateOfJoining] = useState(user?.dateOfJoining ?? "");
  const [country, setCountry] = useState(user?.country ?? "");
  const [currency, setCurrency] = useState(user?.currency ?? "USD");
  const [profilePicture, setProfilePicture] = useState<string | null>(user?.profilePicture ?? null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name ?? "");
      setDateOfJoining(user.dateOfJoining ?? "");
      setCountry(user.country ?? "");
      setCurrency(user.currency ?? "USD");
      setProfilePicture(user.profilePicture ?? null);
    }
  }, [user]);

  function handleCountryChange(code: string) {
    setCountry(code);
    const match = COUNTRIES.find((c) => c.code === code);
    if (match) setCurrency(match.currency);
  }

  function handleImageFile(file: File) {
    if (file.size > 3 * 1024 * 1024) {
      toast({ title: "Image too large", description: "Please choose an image under 3 MB.", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => setProfilePicture(e.target?.result as string);
    reader.readAsDataURL(file);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`${BASE}/api/users/me`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, dateOfJoining: dateOfJoining || null, country: country || null, currency, profilePicture }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Failed to save");
      }
      await refreshUser();
      toast({ title: "Profile saved", description: "Your profile has been updated." });
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  const initials = (name || user?.email || "U").charAt(0).toUpperCase();

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
        <p className="text-muted-foreground mt-1">Manage your personal details and preferences.</p>
      </div>

      {/* Profile picture */}
      <div className="bg-card border border-border rounded-xl p-6 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Profile Picture</h2>
        <div className="flex items-center gap-6">
          <div className="relative group">
            <div className="w-24 h-24 rounded-full overflow-hidden bg-primary/20 flex items-center justify-center border-2 border-border">
              {profilePicture ? (
                <img src={profilePicture} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <span className="text-3xl font-bold text-primary">{initials}</span>
              )}
            </div>
            <button
              onClick={() => fileRef.current?.click()}
              className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
            >
              <Camera className="w-6 h-6 text-white" />
            </button>
          </div>
          <div className="space-y-1.5">
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              <Camera className="w-4 h-4 mr-2" />
              Upload photo
            </Button>
            {profilePicture && (
              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setProfilePicture(null)}>
                Remove
              </Button>
            )}
            <p className="text-xs text-muted-foreground">JPG, PNG or WebP · Max 3 MB</p>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageFile(f); e.target.value = ""; }}
          />
        </div>
      </div>

      {/* Personal info */}
      <div className="bg-card border border-border rounded-xl p-6 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Personal Information</h2>

        <div className="grid grid-cols-1 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <div className="flex h-9 w-full rounded-md border border-input bg-muted/40 px-3 py-1 text-sm items-center text-muted-foreground select-none">
              {user?.email}
            </div>
            <p className="text-xs text-muted-foreground">Email cannot be changed.</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="name">Full Name</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your full name"
                className="pl-9"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="dateOfJoining">Date of Joining</Label>
            <Input
              id="dateOfJoining"
              type="date"
              value={dateOfJoining}
              onChange={(e) => setDateOfJoining(e.target.value)}
              className="[color-scheme:inherit]"
            />
          </div>
        </div>
      </div>

      {/* Regional settings */}
      <div className="bg-card border border-border rounded-xl p-6 space-y-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Regional Settings</h2>
            <p className="text-xs text-muted-foreground mt-1">
              The selected currency is shown on all amounts throughout the app.
            </p>
          </div>
          {user?.role === "salesperson" && (
            <span className="shrink-0 text-xs text-muted-foreground border border-border rounded px-2 py-1 bg-secondary/50">
              Set by owner
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="country">Country</Label>
            {user?.role === "salesperson" ? (
              <div className="flex h-9 w-full rounded-md border border-input bg-muted/40 px-3 py-1 text-sm items-center text-muted-foreground select-none">
                {COUNTRIES.find((c) => c.code === country)?.name || country || "—"}
              </div>
            ) : (
              <select
                id="country"
                value={country}
                onChange={(e) => handleCountryChange(e.target.value)}
                className={selectClass}
              >
                <option value="">— Select country —</option>
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>{c.name}</option>
                ))}
              </select>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="currency">Currency</Label>
            {user?.role === "salesperson" ? (
              <div className="flex h-9 w-full rounded-md border border-input bg-muted/40 px-3 py-1 text-sm items-center text-muted-foreground select-none">
                {currency || "—"}
              </div>
            ) : (
              <>
                <select
                  id="currency"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className={selectClass}
                >
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>{c.label}</option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">Auto-set by country, but you can change it.</p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Save */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="min-w-[120px]">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Profile"}
        </Button>
      </div>
    </div>
  );
}
