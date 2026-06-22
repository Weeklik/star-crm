import { useState, useEffect } from "react";
import { useListUsers, useUpdateUserRole, getListUsersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useGetMe } from "@workspace/api-client-react";
import {
  Loader2, Shield, Trash2, Pencil, Globe, DollarSign, AlertTriangle, UserPlus, Eye, EyeOff,
} from "lucide-react";
import { format } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

const COUNTRIES: { code: string; name: string; currency: string }[] = [
  { code: "Dubai",          name: "Dubai (AED)",          currency: "AED" },
  { code: "Abu Dhabi",      name: "Abu Dhabi (AED)",      currency: "AED" },
  { code: "Sharjah",        name: "Sharjah (AED)",        currency: "AED" },
  { code: "Ajman",          name: "Ajman (AED)",          currency: "AED" },
  { code: "Umm Al Quwain",  name: "Umm Al Quwain (AED)", currency: "AED" },
  { code: "Ras Al Khaimah", name: "Ras Al Khaimah (AED)",currency: "AED" },
  { code: "Fujairah",       name: "Fujairah (AED)",       currency: "AED" },
  { code: "Qatar",          name: "Qatar (QAR)",          currency: "QAR" },
];

const CURRENCIES = [
  "AED","ARS","AUD","BDT","BHD","BRL","CAD","CHF","CLP","CNY","COP","DKK","EGP",
  "EUR","GBP","HKD","IDR","ILS","INR","JPY","KES","KRW","KWD","LKR","MXN","MYR",
  "NGN","NOK","NZD","OMR","PHP","PKR","PLN","QAR","RUB","SAR","SEK","SGD","THB",
  "TND","TRY","TWD","USD","VND","ZAR",
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

  // Add salesperson dialog
  const [addOpen, setAddOpen] = useState(false);
  const [addName, setAddName] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addPassword, setAddPassword] = useState("");
  const [addShowPw, setAddShowPw] = useState(false);
  const [addCountry, setAddCountry] = useState("");
  const [addCurrency, setAddCurrency] = useState("USD");
  const [addSaving, setAddSaving] = useState(false);

  function resetAdd() {
    setAddName("");
    setAddEmail("");
    setAddPassword("");
    setAddShowPw(false);
    setAddCountry("");
    setAddCurrency("USD");
  }

  function handleAddCountryChange(code: string) {
    setAddCountry(code);
    const match = COUNTRIES.find((c) => c.code === code);
    if (match) setAddCurrency(match.currency);
  }

  async function handleAddSalesperson() {
    if (!addName.trim() || !addEmail.trim() || addPassword.length < 6) return;
    setAddSaving(true);
    try {
      const res = await fetch(`${BASE}/api/users`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: addName.trim(),
          email: addEmail.trim(),
          password: addPassword,
          country: addCountry || null,
          currency: addCurrency,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Failed to create user");
      queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
      toast({ title: "Salesperson added", description: `${addName.trim()} can now sign in with their credentials.` });
      setAddOpen(false);
      resetAdd();
    } catch (e: any) {
      toast({ title: "Failed to add", description: e.message, variant: "destructive" });
    } finally {
      setAddSaving(false);
    }
  }

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
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Team Members</h1>
          <p className="text-muted-foreground mt-1">Manage user access, roles, and regional settings.</p>
        </div>
        <Button onClick={() => { resetAdd(); setAddOpen(true); }} className="shrink-0">
          <UserPlus className="w-4 h-4 mr-2" />
          Add Salesperson
        </Button>
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

      {/* ── Add Salesperson Dialog ── */}
      <Dialog open={addOpen} onOpenChange={(o) => { if (!o) { setAddOpen(false); resetAdd(); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-primary" />
              Add Salesperson
            </DialogTitle>
            <DialogDescription>
              Create a new salesperson account. They can log in immediately with the credentials you set.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="add-name">Full Name</Label>
              <Input
                id="add-name"
                placeholder="e.g. Jane Smith"
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                disabled={addSaving}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="add-email">Email Address</Label>
              <Input
                id="add-email"
                type="email"
                placeholder="jane@example.com"
                value={addEmail}
                onChange={(e) => setAddEmail(e.target.value)}
                disabled={addSaving}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="add-password">Password</Label>
              <div className="relative">
                <Input
                  id="add-password"
                  type={addShowPw ? "text" : "password"}
                  placeholder="Minimum 6 characters"
                  value={addPassword}
                  onChange={(e) => setAddPassword(e.target.value)}
                  disabled={addSaving}
                  className="pr-10"
                  onKeyDown={(e) => { if (e.key === "Enter") handleAddSalesperson(); }}
                />
                <button
                  type="button"
                  onClick={() => setAddShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {addShowPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {addPassword.length > 0 && addPassword.length < 6 && (
                <p className="text-xs text-destructive">Password must be at least 6 characters.</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="add-country">Country</Label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  <select
                    id="add-country"
                    value={addCountry}
                    onChange={(e) => handleAddCountryChange(e.target.value)}
                    disabled={addSaving}
                    className={`${selectClass} pl-9`}
                  >
                    <option value="">— Select —</option>
                    {COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="add-currency">Currency</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  <select
                    id="add-currency"
                    value={addCurrency}
                    onChange={(e) => setAddCurrency(e.target.value)}
                    disabled={addSaving}
                    className={`${selectClass} pl-9`}
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground -mt-2">
              Selecting a country auto-fills the currency. All their deal amounts will be shown in this currency.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setAddOpen(false); resetAdd(); }} disabled={addSaving}>
              Cancel
            </Button>
            <Button
              onClick={handleAddSalesperson}
              disabled={addSaving || !addName.trim() || !addEmail.trim() || addPassword.length < 6}
            >
              {addSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <UserPlus className="w-4 h-4 mr-2" />}
              Create Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
