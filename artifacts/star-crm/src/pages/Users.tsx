import { useState, useEffect } from "react";
import { useListUsers, useUpdateUserRole, getListUsersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useGetMe } from "@workspace/api-client-react";
import {
  Loader2, Shield, Trash2, Pencil, Globe, DollarSign, AlertTriangle,
} from "lucide-react";
import { format } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

const COUNTRIES: { code: string; name: string; currency: string }[] = [
  { code: "AE", name: "United Arab Emirates", currency: "AED" },
  { code: "AR", name: "Argentina", currency: "ARS" },
  { code: "AT", name: "Austria", currency: "EUR" },
  { code: "AU", name: "Australia", currency: "AUD" },
  { code: "BD", name: "Bangladesh", currency: "BDT" },
  { code: "BE", name: "Belgium", currency: "EUR" },
  { code: "BH", name: "Bahrain", currency: "BHD" },
  { code: "BR", name: "Brazil", currency: "BRL" },
  { code: "CA", name: "Canada", currency: "CAD" },
  { code: "CH", name: "Switzerland", currency: "CHF" },
  { code: "CL", name: "Chile", currency: "CLP" },
  { code: "CN", name: "China", currency: "CNY" },
  { code: "CO", name: "Colombia", currency: "COP" },
  { code: "DE", name: "Germany", currency: "EUR" },
  { code: "DK", name: "Denmark", currency: "DKK" },
  { code: "EG", name: "Egypt", currency: "EGP" },
  { code: "ES", name: "Spain", currency: "EUR" },
  { code: "FI", name: "Finland", currency: "EUR" },
  { code: "FR", name: "France", currency: "EUR" },
  { code: "GB", name: "United Kingdom", currency: "GBP" },
  { code: "GR", name: "Greece", currency: "EUR" },
  { code: "HK", name: "Hong Kong", currency: "HKD" },
  { code: "ID", name: "Indonesia", currency: "IDR" },
  { code: "IE", name: "Ireland", currency: "EUR" },
  { code: "IL", name: "Israel", currency: "ILS" },
  { code: "IN", name: "India", currency: "INR" },
  { code: "IT", name: "Italy", currency: "EUR" },
  { code: "JP", name: "Japan", currency: "JPY" },
  { code: "KE", name: "Kenya", currency: "KES" },
  { code: "KR", name: "South Korea", currency: "KRW" },
  { code: "KW", name: "Kuwait", currency: "KWD" },
  { code: "LK", name: "Sri Lanka", currency: "LKR" },
  { code: "MX", name: "Mexico", currency: "MXN" },
  { code: "MY", name: "Malaysia", currency: "MYR" },
  { code: "NG", name: "Nigeria", currency: "NGN" },
  { code: "NL", name: "Netherlands", currency: "EUR" },
  { code: "NO", name: "Norway", currency: "NOK" },
  { code: "NZ", name: "New Zealand", currency: "NZD" },
  { code: "OM", name: "Oman", currency: "OMR" },
  { code: "PH", name: "Philippines", currency: "PHP" },
  { code: "PK", name: "Pakistan", currency: "PKR" },
  { code: "PL", name: "Poland", currency: "PLN" },
  { code: "PT", name: "Portugal", currency: "EUR" },
  { code: "QA", name: "Qatar", currency: "QAR" },
  { code: "RU", name: "Russia", currency: "RUB" },
  { code: "SA", name: "Saudi Arabia", currency: "SAR" },
  { code: "SE", name: "Sweden", currency: "SEK" },
  { code: "SG", name: "Singapore", currency: "SGD" },
  { code: "TH", name: "Thailand", currency: "THB" },
  { code: "TR", name: "Turkey", currency: "TRY" },
  { code: "TW", name: "Taiwan", currency: "TWD" },
  { code: "US", name: "United States", currency: "USD" },
  { code: "VN", name: "Vietnam", currency: "VND" },
  { code: "ZA", name: "South Africa", currency: "ZAR" },
];

const CURRENCIES = [
  "AED","ARS","AUD","BDT","BHD","BRL","CAD","CHF","CLP","CNY","COP","DKK","EGP",
  "EUR","GBP","HKD","IDR","ILS","INR","JPY","KES","KRW","KWD","LKR","MXN","MYR",
  "NGN","NOK","NZD","OMR","PHP","PKR","PLN","QAR","RUB","SAR","SEK","SGD","THB",
  "TRY","TWD","USD","VND","ZAR",
];

const selectClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

interface UserRow {
  id: number;
  name: string | null;
  email: string;
  role: "owner" | "salesperson";
  createdAt: string;
  country?: string | null;
  currency?: string | null;
}

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function Users() {
  const { data: users, isLoading } = useListUsers();
  const { data: me } = useGetMe();
  const updateRole = useUpdateUserRole();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Edit profile dialog
  const [editTarget, setEditTarget] = useState<UserRow | null>(null);
  const [editCountry, setEditCountry] = useState("");
  const [editCurrency, setEditCurrency] = useState("USD");
  const [editSaving, setEditSaving] = useState(false);

  // Delete confirm dialog
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (editTarget) {
      setEditCountry(editTarget.country ?? "");
      setEditCurrency(editTarget.currency ?? "USD");
    }
  }, [editTarget]);

  const handleRoleChange = (id: number, newRole: "owner" | "salesperson") => {
    updateRole.mutate(
      { id, data: { role: newRole } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
          toast({ title: "Role updated successfully" });
        },
        onError: () => {
          toast({ title: "Failed to update role", variant: "destructive" });
        },
      }
    );
  };

  function handleCountryChange(code: string) {
    setEditCountry(code);
    const match = COUNTRIES.find((c) => c.code === code);
    if (match) setEditCurrency(match.currency);
  }

  async function handleSaveProfile() {
    if (!editTarget) return;
    setEditSaving(true);
    try {
      const res = await fetch(`${BASE}/api/users/${editTarget.id}/profile`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          country: editCountry || null,
          currency: editCurrency,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Failed to save");
      }
      queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
      toast({ title: "Profile updated", description: `${editTarget.name || editTarget.email}'s region settings saved.` });
      setEditTarget(null);
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    } finally {
      setEditSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`${BASE}/api/users/${deleteTarget.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Failed to delete");
      }
      queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
      toast({ title: "User deleted", description: `${deleteTarget.name || deleteTarget.email} and all their deals have been removed.` });
      setDeleteTarget(null);
    } catch (e: any) {
      toast({ title: "Delete failed", description: e.message, variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  }

  if (isLoading)
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );

  const countryName = (code: string | null | undefined) =>
    code ? (COUNTRIES.find((c) => c.code === code)?.name ?? code) : "—";

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Team Members</h1>
        <p className="text-muted-foreground mt-1">Manage user access, roles, and regional settings.</p>
      </div>

      <div className="border border-border rounded-lg bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-secondary/50">
              <TableHead>User</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead>Region / Currency</TableHead>
              <TableHead className="w-40">Role</TableHead>
              <TableHead className="w-24 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(users as UserRow[] | undefined)?.map((user) => {
              const isSelf = user.id === me?.id;
              return (
                <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                  <TableCell className="font-medium">{user.name || "Unknown"}</TableCell>
                  <TableCell className="text-muted-foreground">{user.email}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(user.createdAt), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    <div className="flex items-center gap-1">
                      <Globe className="w-3.5 h-3.5 shrink-0" />
                      <span>{countryName(user.country)}</span>
                      {user.currency && (
                        <span className="ml-1 px-1.5 py-0.5 bg-secondary rounded text-xs font-mono">
                          {user.currency}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Select
                      defaultValue={user.role}
                      onValueChange={(val: "owner" | "salesperson") =>
                        handleRoleChange(user.id, val)
                      }
                      disabled={updateRole.isPending || isSelf}
                    >
                      <SelectTrigger className="w-full h-8" data-testid={`select-role-${user.id}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="owner">
                          <span className="flex items-center gap-1.5">
                            <Shield className="w-3.5 h-3.5 text-primary" /> Owner
                          </span>
                        </SelectItem>
                        <SelectItem value="salesperson">Salesperson</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        title="Edit region & currency"
                        onClick={() => setEditTarget(user)}
                        disabled={isSelf}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        title="Delete user"
                        onClick={() => setDeleteTarget(user)}
                        disabled={isSelf}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {users?.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No users found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* ── Edit Region Dialog ── */}
      <Dialog open={!!editTarget} onOpenChange={(o) => { if (!o) setEditTarget(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Region & Currency</DialogTitle>
            <DialogDescription>
              Set the region and currency for{" "}
              <span className="font-medium text-foreground">
                {editTarget?.name || editTarget?.email}
              </span>
              . The currency will be applied to all amounts shown in their account.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-country">Country / Region</Label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <select
                  id="edit-country"
                  value={editCountry}
                  onChange={(e) => handleCountryChange(e.target.value)}
                  className={`${selectClass} pl-9`}
                >
                  <option value="">— Select country —</option>
                  {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>{c.name}</option>
                  ))}
                </select>
              </div>
              <p className="text-xs text-muted-foreground">Selecting a country auto-fills the currency.</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-currency">Currency</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <select
                  id="edit-currency"
                  value={editCurrency}
                  onChange={(e) => setEditCurrency(e.target.value)}
                  className={`${selectClass} pl-9`}
                >
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <p className="text-xs text-muted-foreground">You can override the auto-filled currency if needed.</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)} disabled={editSaving}>
              Cancel
            </Button>
            <Button onClick={handleSaveProfile} disabled={editSaving}>
              {editSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm Dialog ── */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Delete User
            </DialogTitle>
            <DialogDescription>
              This will permanently delete{" "}
              <span className="font-semibold text-foreground">
                {deleteTarget?.name || deleteTarget?.email}
              </span>{" "}
              and <span className="font-semibold text-destructive">all deals</span> associated with
              their account. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Delete permanently"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
