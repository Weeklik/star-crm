import { useState, useRef, useEffect } from "react";
import { Plus, Pencil, Trash2, Upload, Loader2, Search, X } from "lucide-react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

interface Product {
  id: number;
  origin: string | null;
  brand: string | null;
  model: string | null;
  description: string | null;
  unitPrice: string | null;
  createdAt: string;
}

interface ProductForm {
  origin: string;
  brand: string;
  model: string;
  description: string;
  unitPrice: string;
}

const emptyForm = (): ProductForm => ({
  origin: "",
  brand: "",
  model: "",
  description: "",
  unitPrice: "",
});

async function apiFetch(path: string, opts?: RequestInit) {
  const res = await fetch(path, { credentials: "include", ...opts });
  if (!res.ok) throw new Error(await res.text());
  if (res.status === 204) return null;
  return res.json();
}

export default function Products() {
  const [products, setProducts]   = useState<Product[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm]           = useState<ProductForm>(emptyForm());
  const [saving, setSaving]       = useState(false);
  const [deleteId, setDeleteId]   = useState<number | null>(null);
  const [importing, setImporting] = useState(false);
  const fileRef                   = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  async function load() {
    try {
      const rows = await apiFetch("/api/products-catalog");
      setProducts(rows);
    } catch {
      toast({ title: "Failed to load products", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function openAdd() {
    setEditingId(null);
    setForm(emptyForm());
    setModalOpen(true);
  }

  function openEdit(p: Product) {
    setEditingId(p.id);
    setForm({
      origin:      p.origin      ?? "",
      brand:       p.brand       ?? "",
      model:       p.model       ?? "",
      description: p.description ?? "",
      unitPrice:   p.unitPrice   ?? "",
    });
    setModalOpen(true);
  }

  function set<K extends keyof ProductForm>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    if (!form.brand.trim() && !form.model.trim() && !form.description.trim()) {
      toast({ title: "Please fill at least one field", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      if (editingId !== null) {
        const updated = await apiFetch(`/api/products-catalog/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        setProducts((prev) => prev.map((p) => p.id === editingId ? updated : p));
      } else {
        const created = await apiFetch("/api/products-catalog", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        setProducts((prev) => [...prev, created]);
      }
      setModalOpen(false);
      toast({ title: editingId !== null ? "Product updated" : "Product added" });
    } catch {
      toast({ title: "Failed to save product", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (deleteId === null) return;
    try {
      await apiFetch(`/api/products-catalog/${deleteId}`, { method: "DELETE" });
      setProducts((prev) => prev.filter((p) => p.id !== deleteId));
      toast({ title: "Product deleted" });
    } catch {
      toast({ title: "Failed to delete product", variant: "destructive" });
    } finally {
      setDeleteId(null);
    }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setImporting(true);
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: Record<string, string>[] = XLSX.utils.sheet_to_json(ws, { defval: "" });

      const normalize = (row: Record<string, string>, keys: string[]): string => {
        for (const k of keys) {
          const found = Object.keys(row).find((rk) => rk.trim().toLowerCase() === k.toLowerCase());
          if (found) return String(row[found] ?? "").trim();
        }
        return "";
      };

      const payload = rows.map((row) => ({
        origin:      normalize(row, ["origin", "Origin"]),
        brand:       normalize(row, ["brand", "Brand"]),
        model:       normalize(row, ["model", "Model"]),
        description: normalize(row, ["description", "Description"]),
        unitPrice:   normalize(row, ["unit price", "unitprice", "Unit Price", "UnitPrice", "price", "Price"]),
      }));

      const result = await apiFetch("/api/products-catalog/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      await load();
      toast({ title: `Imported ${result.inserted} product(s)` });
    } catch (err) {
      toast({ title: "Import failed — check your Excel format", variant: "destructive" });
    } finally {
      setImporting(false);
    }
  }

  const filtered = products.filter((p) => {
    const q = search.toLowerCase();
    return (
      (p.origin      ?? "").toLowerCase().includes(q) ||
      (p.brand       ?? "").toLowerCase().includes(q) ||
      (p.model       ?? "").toLowerCase().includes(q) ||
      (p.description ?? "").toLowerCase().includes(q) ||
      (p.unitPrice   ?? "").toLowerCase().includes(q)
    );
  });

  const fields: { key: keyof ProductForm; label: string; placeholder: string }[] = [
    { key: "origin",      label: "Origin",      placeholder: "e.g. Japan" },
    { key: "brand",       label: "Brand",       placeholder: "e.g. Juki" },
    { key: "model",       label: "Model",       placeholder: "e.g. DDL-9000C" },
    { key: "description", label: "Description", placeholder: "Short product description" },
    { key: "unitPrice",   label: "Unit Price",  placeholder: "e.g. 1500.00" },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Products</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage your product catalog</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={handleImport}
          />
          <Button
            variant="outline"
            onClick={() => fileRef.current?.click()}
            disabled={importing}
          >
            {importing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
            Import Excel
          </Button>
          <Button onClick={openAdd}>
            <Plus className="w-4 h-4 mr-2" />
            Add Product
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search products…"
          className="pl-9 pr-9"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead>Origin</TableHead>
              <TableHead>Brand</TableHead>
              <TableHead>Model</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Unit Price</TableHead>
              <TableHead className="w-20 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-muted-foreground text-sm">
                  {search ? "No products match your search." : 'No products yet. Click "Add Product" to get started.'}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((p) => (
                <TableRow key={p.id} className="hover:bg-muted/30 transition-colors">
                  <TableCell className="text-sm">{p.origin   || <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell className="text-sm font-medium">{p.brand || <span className="text-muted-foreground font-normal">—</span>}</TableCell>
                  <TableCell className="text-sm">{p.model       || <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell className="text-sm max-w-[260px] truncate">{p.description || <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell className="text-sm tabular-nums">{p.unitPrice   || <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEdit(p)}
                        className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteId(p.id)}
                        className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Count */}
      {!loading && filtered.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Showing {filtered.length} of {products.length} product{products.length !== 1 ? "s" : ""}
        </p>
      )}

      {/* Add / Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId !== null ? "Edit Product" : "Add Product"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {fields.map(({ key, label, placeholder }) => (
              <div key={key} className="space-y-1.5">
                <Label>{label}</Label>
                <Input
                  type="text"
                  value={form[key]}
                  onChange={(e) => set(key, e.target.value)}
                  placeholder={placeholder}
                />
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingId !== null ? "Save Changes" : "Add Product"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={deleteId !== null} onOpenChange={(o) => { if (!o) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete product?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The product will be permanently removed from the catalog.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
