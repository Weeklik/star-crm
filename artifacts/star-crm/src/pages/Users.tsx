import { useState, useEffect } from "react";
import { useListUsers, useUpdateUserRole, getListUsersQueryKey, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useGetMe } from "@workspace/api-client-react";
import {
  Loader2, Shield, Trash2, Pencil, Globe, DollarSign, AlertTriangle, UserPlus, Eye, EyeOff, KeyRound,
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
import { useTranslation } from "@/i18n/LanguageContext";
import { countryLabel } from "@/utils/countryNames";

const COUNTRIES: { code: string; name: string; currency: string }[] = [
  { code: "KSA",      name: "Saudi Arabia (SAR)",      currency: "SAR" },
  { code: "UAE",      name: "United Arab Emirates (AED)", currency: "AED" },
  { code: "Nigeria",  name: "Nigeria (NGN)",   currency: "NGN" },
  { code: "TN",       name: "Tunisia (EUR)",   currency: "EUR" },
  { code: "Egypt",    name: "Egypt (EGP)",     currency: "EGP" },
  { code: "Kenya",    name: "Kenya (KES)",     currency: "KES" },
  { code: "Ethiopia", name: "Ethiopia (ETB)",  currency: "ETB" },
  { code: "Ghana",    name: "Ghana (GHS)",     currency: "GHS" },
];

const CURRENCIES = [
  "USD","EUR","JPY","AED","SAR","KES","NGN","EGP","ETB","GHS",
];

const selectClass =
  "flex h-9 w-full rounded-md border border-input bg-background text-foreground px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

interface UserRow {
  id: number;
  name: string | null;
  email: string;
  role: "owner" | "salesperson";
  createdAt: string;
  country?: string | null;
  currency?: string | null;
  passwordPlain?: string | null;
}

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function Users() {
  const { data: users, isLoading } = useListUsers();
  const { data: me } = useGetMe();
  const updateRole = useUpdateUserRole();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation();

  const [addOpen, setAddOpen] = useState(false);
  const [addName, setAddName] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addPassword, setAddPassword] = useState("");
  const [addShowPw, setAddShowPw] = useState(false);
  const [addCountry, setAddCountry] = useState("");
  const [addCurrency, setAddCurrency] = useState("USD");
  const [addSaving, setAddSaving] = useState(false);

  function resetAdd() {
    setAddName(""); setAddEmail(""); setAddPassword("");
    setAddShowPw(false); setAddCountry(""); setAddCurrency("USD");
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
      toast({ title: t("users.salespersonAdded"), description: `${addName.trim()} ${t("users.canNowSignIn")}` });
      setAddOpen(false);
      resetAdd();
    } catch (e: any) {
      toast({ title: t("users.failedToAdd"), description: e.message, variant: "destructive" });
    } finally {
      setAddSaving(false);
    }
  }

  const [editTarget, setEditTarget] = useState<UserRow | null>(null);
  const [editCountry, setEditCountry] = useState("");
  const [editCurrency, setEditCurrency] = useState("USD");
  const [editSaving, setEditSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [shownPasswords, setShownPasswords] = useState<Set<number>>(new Set());
  function togglePasswordVisibility(id: number) {
    setShownPasswords((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const [pwTarget, setPwTarget] = useState<UserRow | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [showNewPw, setShowNewPw] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);

  async function handleChangePassword() {
    if (!pwTarget || newPassword.length < 6) return;
    setPwSaving(true);
    try {
      const res = await fetch(`${BASE}/api/users/${pwTarget.id}/password`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: newPassword }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Failed to change password");
      queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
      toast({ title: "Password updated", description: `Password for ${pwTarget.name || pwTarget.email} has been changed.` });
      setPwTarget(null);
      setNewPassword("");
    } catch (e: any) {
      toast({ title: "Failed to change password", description: e.message, variant: "destructive" });
    } finally {
      setPwSaving(false);
    }
  }

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
          toast({ title: t("users.roleUpdated") });
        },
        onError: () => {
          toast({ title: t("users.failedToUpdateRole"), variant: "destructive" });
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
      const res = await fetch(`/api/users/${editTarget.id}/profile`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json", "Cache-Control": "no-cache" },
        body: JSON.stringify({
          country: editCountry || null,
          currency: editCurrency || "USD",
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || `Save failed (${res.status})`);
      }
      const updated = await res.json();
      queryClient.setQueryData(getListUsersQueryKey(), (old: any) =>
        Array.isArray(old)
          ? old.map((u: any) => (u.id === updated.id ? { ...u, country: updated.country, currency: updated.currency } : u))
          : old,
      );
      queryClient.resetQueries({ queryKey: getListUsersQueryKey() });
      queryClient.resetQueries({ queryKey: getGetMeQueryKey() });
      toast({ title: t("users.profileUpdated"), description: `${editTarget.name || editTarget.email} ${t("users.regionSettingsSaved")}` });
      setEditTarget(null);
    } catch (e: any) {
      toast({ title: t("users.saveFailed"), description: e.message, variant: "destructive" });
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
      toast({ title: t("users.userDeleted"), description: `${deleteTarget.name || deleteTarget.email} ${t("users.allDealsRemoved")}` });
      setDeleteTarget(null);
    } catch (e: any) {
      toast({ title: t("users.deleteFailed"), description: e.message, variant: "destructive" });
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

  const countryName = (code: string | null | undefined) => countryLabel(code);

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("users.title")}</h1>
          <p className="text-muted-foreground mt-1">{t("users.subtitle")}</p>
        </div>
        <Button onClick={() => { resetAdd(); setAddOpen(true); }} className="shrink-0">
          <UserPlus className="w-4 h-4 mr-2" />
          {t("users.addSalesperson")}
        </Button>
      </div>

      <div className="border border-border rounded-lg bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-secondary/50">
              <TableHead>{t("users.user")}</TableHead>
              <TableHead>{t("common.email")}</TableHead>
              <TableHead>Password</TableHead>
              <TableHead>{t("users.joined")}</TableHead>
              <TableHead>{t("users.regionCurrency")}</TableHead>
              <TableHead className="w-40">{t("common.role")}</TableHead>
              <TableHead className="w-28 text-right">{t("common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(users as UserRow[] | undefined)?.map((user) => {
              const isSelf = user.id === me?.id;
              const pwVisible = shownPasswords.has(user.id);
              return (
                <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                  <TableCell className="font-medium">{user.name || t("common.unknown")}</TableCell>
                  <TableCell className="text-muted-foreground">{user.email}</TableCell>
                  <TableCell>
                    {user.passwordPlain ? (
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-sm">
                          {pwVisible ? user.passwordPlain : "••••••••"}
                        </span>
                        <button
                          type="button"
                          onClick={() => togglePasswordVisibility(user.id)}
                          className="text-muted-foreground hover:text-foreground"
                          title={pwVisible ? "Hide password" : "Show password"}
                        >
                          {pwVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">not stored</span>
                    )}
                  </TableCell>
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
                      onValueChange={(val: "owner" | "salesperson") => handleRoleChange(user.id, val)}
                      disabled={updateRole.isPending || isSelf}
                    >
                      <SelectTrigger className="w-full h-8" data-testid={`select-role-${user.id}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="owner">
                          <span className="flex items-center gap-1.5">
                            <Shield className="w-3.5 h-3.5 text-primary" /> {t("users.ownerRole")}
                          </span>
                        </SelectItem>
                        <SelectItem value="salesperson">{t("users.salespersonRole")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        title="Change password"
                        onClick={() => { setPwTarget(user); setNewPassword(""); setShowNewPw(false); }}
                        disabled={isSelf}
                      >
                        <KeyRound className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        title={t("users.editRegionCurrencyTitle")}
                        onClick={() => setEditTarget(user)}
                        disabled={isSelf}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        title={t("users.deleteUserTitle")}
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
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  {t("users.noUsersFound")}
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
              {t("users.addTitle")}
            </DialogTitle>
            <DialogDescription>{t("users.addDescription")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="add-name">{t("users.fullName")}</Label>
              <Input
                id="add-name"
                placeholder="e.g. Jane Smith"
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                disabled={addSaving}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="add-email">{t("users.emailAddress")}</Label>
              <Input
                id="add-email"
                type="email"
                placeholder="jane@example.com"
                value={addEmail}
                onChange={(e) => setAddEmail(e.target.value)}
                disabled={addSaving}
                autoComplete="off"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="add-password">{t("users.password")}</Label>
              <div className="relative">
                <Input
                  id="add-password"
                  type={addShowPw ? "text" : "password"}
                  placeholder={t("orders.minimumChars")}
                  value={addPassword}
                  onChange={(e) => setAddPassword(e.target.value)}
                  disabled={addSaving}
                  className="pr-10"
                  autoComplete="new-password"
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
                <p className="text-xs text-destructive">{t("orders.passwordTooShort")}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="add-country">{t("users.country")}</Label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  <select
                    id="add-country"
                    value={addCountry}
                    onChange={(e) => handleAddCountryChange(e.target.value)}
                    disabled={addSaving}
                    className={`${selectClass} pl-9`}
                  >
                    <option value="">{t("users.select")}</option>
                    {COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="add-currency">{t("users.currency")}</Label>
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
              {t("orders.selectingCountryFillsCurrency")}
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setAddOpen(false); resetAdd(); }} disabled={addSaving}>
              {t("common.cancel")}
            </Button>
            <Button
              onClick={handleAddSalesperson}
              disabled={addSaving || !addName.trim() || !addEmail.trim() || addPassword.length < 6}
            >
              {addSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <UserPlus className="w-4 h-4 mr-2" />}
              {t("orders.createAccount")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Region Dialog ── */}
      <Dialog open={!!editTarget} onOpenChange={(o) => { if (!o) setEditTarget(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("users.editTitle")}</DialogTitle>
            <DialogDescription>
              {t("users.editDescription")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-country">{t("users.editCountryLabel")}</Label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <select
                  id="edit-country"
                  value={editCountry}
                  onChange={(e) => handleCountryChange(e.target.value)}
                  className={`${selectClass} pl-9`}
                >
                  <option value="">{t("users.selectCountry")}</option>
                  {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>{c.name}</option>
                  ))}
                </select>
              </div>
              <p className="text-xs text-muted-foreground">{t("users.editCountryHint")}</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-currency">{t("users.currency")}</Label>
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
              <p className="text-xs text-muted-foreground">{t("users.editCurrencyHint")}</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)} disabled={editSaving}>
              {t("common.cancel")}
            </Button>
            <Button onClick={handleSaveProfile} disabled={editSaving}>
              {editSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : t("users.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Change Password Dialog ── */}
      <Dialog open={!!pwTarget} onOpenChange={(o) => { if (!o) { setPwTarget(null); setNewPassword(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-primary" />
              Change Password
            </DialogTitle>
            <DialogDescription>
              Set a new password for{" "}
              <span className="font-semibold text-foreground">{pwTarget?.name || pwTarget?.email}</span>.
              The new password will be stored and visible in the users table.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="new-password">New Password</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showNewPw ? "text" : "password"}
                  placeholder="Minimum 6 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={pwSaving}
                  className="pr-10"
                  autoComplete="new-password"
                  onKeyDown={(e) => { if (e.key === "Enter") handleChangePassword(); }}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {newPassword.length > 0 && newPassword.length < 6 && (
                <p className="text-xs text-destructive">Password must be at least 6 characters</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setPwTarget(null); setNewPassword(""); }} disabled={pwSaving}>
              {t("common.cancel")}
            </Button>
            <Button onClick={handleChangePassword} disabled={pwSaving || newPassword.length < 6}>
              {pwSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <KeyRound className="w-4 h-4 mr-2" />}
              Update Password
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
              {t("users.deleteTitle")}
            </DialogTitle>
            <DialogDescription>
              {t("users.deleteDescription1")}{" "}
              <span className="font-semibold text-foreground">
                {deleteTarget?.name || deleteTarget?.email}
              </span>{" "}
              {t("users.deleteDescription2")}{" "}
              <span className="font-semibold text-destructive">{t("users.deleteAllDeals")}</span>{" "}
              {t("users.deleteDescription3")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              {t("common.cancel")}
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : t("users.deletePermanently")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
