import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Package, ChevronDown, MoreVertical, Plus, Trash2, Loader2, ImageOff, ImagePlus, X, Pencil, PackagePlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { PageShell } from "@/components/layout/page-shell";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  listWebsiteProducts, setProductPublished, uploadProductImage,
  upsertWebsiteProduct, deleteWebsiteProduct, deleteProductImage,
  listProductSales,
  type WebsiteProductDTO,
  type ProductSalesDTO,
} from "@/lib/website-products.functions";
import { addVariantStock, createManualProduct } from "@/lib/inventory.functions";
import { setProductPieceOffer } from "@/lib/product-offers.functions";
import { ProductOfferControl, usePieceOffers } from "@/components/products/product-offer-control";
import { requirePrice } from "@/lib/product-required-fields";
import {
  buildMatrix, cleanSpecs, matrixFromVariants, matrixToVariants, mergeLabels, norm, usedLabels,
  type MatrixRow, type ProductSpec,
} from "@/lib/variant-matrix";
import { ImageBoard } from "@/components/products/image-board";
import { VariantMatrixEditor } from "@/components/products/variant-matrix-editor";




export const Route = createFileRoute("/products")({
  head: () => ({
    meta: [
      { title: "المخزون · cupai" },
      { name: "description", content: "منتجاتك، الألوان، المقاسات، والكميات." },
      { property: "og:title", content: "المخزون · cupai" },
      { property: "og:description", content: "منتجاتك، الألوان، المقاسات، والكميات." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProductsPage,
});

/**
 * Total stock for the whole product = sum of every colour/size quantity.
 * `known` is false when no variant carries a number, so the UI shows
 * "غير محدّد" instead of wrongly claiming the product is sold out.
 */
function totalQty(p: WebsiteProductDTO) {
  let qty = 0;
  let known = false;
  for (const v of p.variants) {
    if (v.quantity != null && Number.isFinite(Number(v.quantity))) {
      qty += Number(v.quantity);
      known = true;
    }
  }
  return { qty, known };
}

function ProductsPage() {
  const qc = useQueryClient();
  
  const q = useQuery({
    queryKey: ["website-products"],
    queryFn: () => listWebsiteProducts(),
  });
  // Sold pieces per product, read from confirmed orders.
  const salesQ = useQuery({
    queryKey: ["product-sales"],
    queryFn: () => listProductSales(),
    refetchInterval: 60_000,
  });
  const salesById = new Map<string, ProductSalesDTO>(
    (salesQ.data ?? []).map((s) => [s.productId, s]),
  );
  const pieceOffersQ = usePieceOffers();
  const offerByProduct = new Map((pieceOffersQ.data ?? []).map((o) => [o.product_id, o]));
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  // Selected colour per product (colour id); undefined = show all colours.
  const [colorSel, setColorSel] = useState<Record<string, string | null>>({});
  const [addOpen, setAddOpen] = useState(false);
  // Keep only the id: the dialog always reads the latest saved product row.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [quickStock, setQuickStock] = useState<{ product: WebsiteProductDTO; variantIndex: number } | null>(null);
  const pubMut = useMutation({
    mutationFn: (v: { id: string; is_published: boolean }) =>
      setProductPublished({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["website-products"] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "فشل النشر."),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => deleteWebsiteProduct({ data: { id } }),
    onSuccess: () => {
      toast.success("تم حذف المنتج.");
      qc.invalidateQueries({ queryKey: ["website-products"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "فشل الحذف."),
  });


  const rows = q.data ?? [];
  const totalStock = rows.reduce((n, p) => n + totalQty(p).qty, 0);
  const totalSold = Array.from(salesById.values()).reduce((n, s) => n + s.sold, 0);

  // Low-stock alert: every colour/size with 3 pieces or fewer left.
  const lowItems = rows.flatMap((p) =>
    p.variants
      .filter((v) => v.quantity != null && Number(v.quantity) <= 3)
      .map((v) => ({
        key: `${p.id}-${v.color}-${v.size}`,
        label: [p.name, v.color, v.size].filter(Boolean).join(" - "),
        qty: Number(v.quantity),
      })),
  );
  const alertedRef = useRef(false);
  useEffect(() => {
    if (alertedRef.current || !q.data || lowItems.length === 0) return;
    alertedRef.current = true;
    toast.warning(`تنبيه: ${lowItems.length} من منتجاتك قاربت على النفاد`, {
      description: lowItems.slice(0, 3).map((i) => `${i.label}: ${i.qty === 0 ? "نفدت" : `متبقي ${i.qty}`}`).join("\n"),
      duration: 8000,
    });
  }, [q.data, lowItems.length]);

  return (
    <PageShell>
      <div className="inventory-navy -mx-4 -mt-6 min-h-[70vh] space-y-4 bg-background px-4 pb-4 pt-5">
        <header className="min-w-0">
          <h1 className="inv-title text-2xl font-bold">كل منتجاتك</h1>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            تابع كمياتك وأسعارك، واضغط على أي منتج لرؤية ألوانه ومقاساته.
          </p>
        </header>

        {lowItems.length > 0 && (
          <div role="alert" className="rounded-2xl border border-border bg-inv-warn-soft p-3">
            <div className="text-sm font-bold text-inv-warn">
              ⚠️ تنبيه: {lowItems.length} {lowItems.length === 1 ? "منتج قارب" : "منتجات قاربت"} على النفاد
            </div>
            <ul className="mt-1.5 space-y-0.5 text-[12px]">
              {lowItems.slice(0, 6).map((i) => (
                <li key={i.key} className="flex justify-between gap-2">
                  <span className="truncate">{i.label}</span>
                  <span className="inv-num shrink-0 font-semibold text-inv-warn">
                    {i.qty === 0 ? "نفدت" : `متبقي ${i.qty}`}
                  </span>
                </li>
              ))}
            </ul>
            {lowItems.length > 6 && (
              <div className="mt-1 text-[11px] text-muted-foreground">و{lowItems.length - 6} أخرى…</div>
            )}
          </div>
        )}

        <Button
          onClick={() => setAddOpen(true)}
          className="h-12 w-full gap-2 rounded-xl text-base font-bold shadow-card active:scale-[0.98]"
        >
          <Plus className="h-5 w-5" />
          إضافة منتج جديد
        </Button>

        <AddProductDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          onCreated={() => {
            setAddOpen(false);
            toast.success("تم إضافة المنتج إلى المخزون.");
            qc.invalidateQueries({ queryKey: ["website-products"] });
          }}
        />
        <EditProductDialog
          product={rows.find((p) => p.id === editingId) ?? null}
          onOpenChange={(v) => { if (!v) setEditingId(null); }}
          onSaved={() => {
            setEditingId(null);
            toast.success("تم حفظ التعديلات.");
            qc.invalidateQueries({ queryKey: ["website-products"] });
          }}
        />
        <QuickStockDialog
          target={quickStock}
          onOpenChange={(open) => { if (!open) setQuickStock(null); }}
          onSaved={() => {
            setQuickStock(null);
            qc.invalidateQueries({ queryKey: ["website-products"] });
          }}
        />

        {q.isLoading ? (
          <div className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">جاري التحميل...</div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-10 text-center">
            <Package className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">لا توجد منتجات بعد. أضف منتجك الأول من الزر بالأعلى.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3">
              <StatTile label="عدد المنتجات" value={String(rows.length)} />
              <StatTile label="إجمالي الكميات" value={String(totalStock)} />
              <StatTile label="إجمالي المُباع" value={String(totalSold)} accent />
            </div>

            <div className="space-y-3">
              {rows.map((p) => {
                const isOpen = expanded[p.id] === true;
                const sales = salesById.get(p.id);
                // Colour filter: when a swatch is picked, every number/image
                // below reflects that colour only.
                const selColorId = colorSel[p.id] ?? null;
                const selColor = p.colors.find((c) => c.id === selColorId) ?? null;
                const selKey = selColor ? String(selColor.label).trim().toLocaleLowerCase("ar") : null;
                const firstImg = selColor
                  ? (p.images.find((im) => im.color_id === selColor.id) ?? p.images[0])
                  : p.images[0];
                const colorVariants = selKey
                  ? p.variants.filter((v) => String(v.color ?? "").trim().toLocaleLowerCase("ar") === selKey)
                  : p.variants;
                let remainingQty = 0;
                let qtyKnown = false;
                for (const v of colorVariants) {
                  if (v.quantity != null && Number.isFinite(Number(v.quantity))) {
                    remainingQty += Number(v.quantity);
                    qtyKnown = true;
                  }
                }
                const low = qtyKnown && remainingQty <= 3;
                return (
                  <article key={p.id} className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                    <div className="flex gap-3 p-3">
                      {firstImg ? (
                        <img src={firstImg.url} alt={p.name} loading="lazy"
                          className="h-20 w-20 shrink-0 rounded-lg bg-muted object-cover" />
                      ) : (
                        <div className="grid h-20 w-20 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                          <ImageOff className="h-5 w-5" />
                        </div>
                      )}
                      <div className="flex min-w-0 flex-1 flex-col justify-between">
                        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                          <div className="min-w-0">
                            <h3 className="line-clamp-2 text-sm font-bold leading-snug">{p.name}</h3>
                            {p.price != null && (
                              <p className="inv-num mt-0.5 text-sm font-bold text-primary">
                                {p.price} {p.currency ?? ""}
                              </p>
                            )}
                          </div>
                          <DropdownMenu dir="rtl">
                            <DropdownMenuTrigger asChild>
                              <button type="button" aria-label="خيارات المنتج"
                                className="-m-1 grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted">
                                <MoreVertical className="h-5 w-5" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="min-w-40">
                              <DropdownMenuItem onClick={() => setQuickStock({ product: p, variantIndex: 0 })}>
                                <PackagePlus className="ml-2 h-4 w-4" />تزويد المخزون
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setEditingId(p.id)}>
                                <Pencil className="ml-2 h-4 w-4" />تعديل
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                disabled={delMut.isPending}
                                onClick={() => {
                                  if (window.confirm(`حذف المنتج "${p.name}" نهائياً؟`)) delMut.mutate(p.id);
                                }}
                              >
                                <Trash2 className="ml-2 h-4 w-4" />حذف
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <span className={`inv-num rounded-md px-2 py-0.5 text-[11px] font-semibold ${low ? "bg-inv-warn-soft text-inv-warn" : "bg-muted text-muted-foreground"}`}>
                            {qtyKnown ? (remainingQty === 0 ? "نفدت الكمية" : `المتبقي: ${remainingQty}`) : "الكمية غير محدّدة"}
                          </span>
                          {p.variants.length > 0 && (
                            <button type="button"
                              onClick={() => setExpanded((prev) => ({ ...prev, [p.id]: !isOpen }))}
                              className="flex items-center gap-1 text-xs font-medium"
                              aria-expanded={isOpen}>
                              التفاصيل
                              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="border-t border-border px-3 py-2">
                      <ProductOfferControl productId={p.id} price={p.price == null ? null : Number(p.price)} currency={p.currency ?? null} offer={offerByProduct.get(p.id) ?? null} />
                    </div>
                    {p.colors.length > 1 && (
                      <div className="flex flex-wrap items-center gap-1.5 border-t border-border px-3 py-2">
                        {p.colors.map((c) => {
                          const active = selColorId === c.id;
                          const colorImg = p.images.find((im) => im.color_id === c.id);
                          return (
                            <button
                              key={c.id}
                              type="button"
                              title={c.label}
                              aria-label={c.label}
                              aria-pressed={active}
                              onClick={() =>
                                setColorSel((prev) => ({ ...prev, [p.id]: active ? null : c.id }))
                              }
                              className={`relative h-6 w-6 shrink-0 overflow-hidden rounded-md border transition-transform active:scale-95 ${active ? "ring-2 ring-primary ring-offset-1 ring-offset-card" : "border-border"}`}
                              style={{ background: c.hex ?? "transparent" }}
                            >
                              {colorImg ? (
                                <img src={colorImg.url} alt="" loading="lazy"
                                  className="absolute inset-0 h-full w-full object-cover" />
                              ) : (
                                !c.hex && (
                                  <span className="block truncate px-0.5 text-[8px] leading-6 text-muted-foreground">{c.label}</span>
                                )
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {isOpen && <VariantGrid product={p} sales={sales} colorLabel={selColor?.label ?? null} />}
                  </article>
                );
              })}
            </div>
          </>
        )}
      </div>
    </PageShell>
  );
}

/** Compact stat tile — three sit side by side on a phone. */
function StatTile({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3 text-center">
      <p className="mb-1 text-[10px] text-muted-foreground">{label}</p>
      <p className={`inv-num text-lg font-bold ${accent ? "text-primary" : ""}`}>{value}</p>
    </div>
  );
}

/** Normalised key so an order line ("أحمر"/"M") lines up with a variant row. */
function vKey(color: unknown, size: unknown) {
  const n = (v: unknown) => String(v ?? "").trim().toLocaleLowerCase("ar");
  return `${n(color)}|${n(size)}`;
}

/** Expanded variants: one chip per colour + size with remaining stock. */
function VariantGrid({ product, sales, colorLabel }: { product: WebsiteProductDTO; sales: ProductSalesDTO | undefined; colorLabel?: string | null }) {
  const hexByLabel = new Map(
    product.colors.map((c) => [String(c.label ?? "").trim().toLocaleLowerCase("ar"), c.hex]),
  );
  const soldByVariant = new Map((sales?.variants ?? []).map((v) => [vKey(v.color, v.size), v.sold]));
  const filterKey = colorLabel ? String(colorLabel).trim().toLocaleLowerCase("ar") : null;
  const variants = filterKey
    ? product.variants.filter((v) => String(v.color ?? "").trim().toLocaleLowerCase("ar") === filterKey)
    : product.variants;
  return (
    <div className="grid grid-cols-2 gap-2 border-t border-border bg-muted/60 px-3 py-2.5">
      {variants.map((v, i) => {
        const qty = v.quantity != null && Number.isFinite(Number(v.quantity)) ? Number(v.quantity) : null;
        const hex = hexByLabel.get(String(v.color ?? "").trim().toLocaleLowerCase("ar"));
        const sold = soldByVariant.get(vKey(v.color, v.size)) ?? 0;
        const low = qty != null && qty <= 3;
        return (
          <div key={i} className="flex min-w-0 items-center justify-between gap-2 rounded-lg border border-border bg-card p-2 text-[11px]">
            <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
              {hex && <span className="h-2.5 w-2.5 shrink-0 rounded-full border border-border" style={{ background: hex }} />}
              <span className="truncate">{[v.color, v.size].filter(Boolean).join(" / ") || "أساسي"}</span>
            </span>
            <span className="flex shrink-0 flex-col items-end leading-tight">
              <span className={`inv-num font-bold ${low ? "text-inv-warn" : ""}`}>{qty ?? "—"}</span>
              {sold > 0 && <span className="text-[9px] text-muted-foreground">مُباع {sold}</span>}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function QuickStockDialog({
  target,
  onOpenChange,
  onSaved,
}: {
  target: { product: WebsiteProductDTO; variantIndex: number } | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [variantIndex, setVariantIndex] = useState(0);
  const [amount, setAmount] = useState("1");
  const product = target?.product;
  const variants = product?.variants ?? [];
  const chosen = variants[variantIndex];
  useEffect(() => {
    if (target) {
      setVariantIndex(target.variantIndex);
      setAmount("1");
    }
  }, [target]);
  const add = useMutation({
    mutationFn: () => {
      if (!product) throw new Error("المنتج غير موجود.");
      return addVariantStock({
        data: {
          productId: product.id,
          color: chosen?.color ?? null,
          size: chosen?.size ?? null,
          amount: Number(amount),
        },
      });
    },
    onSuccess: (result) => {
      toast.success(`تم تحديث المخزون إلى ${result.quantity}.`);
      onSaved();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "تعذر تحديث المخزون."),
  });

  const open = target != null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="hub max-w-sm">
        <DialogHeader>
          <DialogTitle>تزويد مخزون {product?.name ?? "المنتج"}</DialogTitle>
          <DialogDescription>اختر المتغير والكمية التي تريد إضافتها.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {variants.length > 1 && (
            <label className="block space-y-1.5 text-sm font-semibold">
              <span>اللون أو المقاس</span>
              <select value={variantIndex} onChange={(e) => setVariantIndex(Number(e.target.value))} className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm">
                {variants.map((variant, index) => (
                  <option key={`${variant.color ?? ""}-${variant.size ?? ""}-${index}`} value={index}>
                    {[variant.color, variant.size].filter(Boolean).join(" · ") || "المنتج الأساسي"} — المتاح {variant.quantity ?? 0}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="block space-y-1.5 text-sm font-semibold">
            <span>الكمية المضافة</span>
            <Input inputMode="numeric" type="number" min={1} max={100000} value={amount} onChange={(e) => setAmount(e.target.value)} />
          </label>
          <div className="grid grid-cols-4 gap-2">
            {[1, 5, 10, 20].map((value) => (
              <Button key={value} type="button" variant="outline" size="sm" onClick={() => setAmount(String(value))}>+{value}</Button>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button onClick={() => add.mutate()} disabled={add.isPending || Number(amount) < 1}>
            {add.isPending && <Loader2 className="ml-1 h-4 w-4 animate-spin" />}
            إضافة للمخزون
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


// ---------------------------------------------------------------------------
// Product form (add + edit). Colours and sizes are typed once (bulk), every
// combination is generated automatically into ONE table for stock / price,
// and unavailable combinations are simply excluded. Images are general by
// default; linking an image to a colour is optional.
// ---------------------------------------------------------------------------

/** Big, first-thing upload area for product images. */
type PendingImage = { id: number; file: File; url: string; color: string };
let pendingSeq = 0;

type ProductFormState = {
  name: string;
  description: string;
  material: string;
  price: string;
  colors: string[];
  sizes: string[];
  rows: MatrixRow[];
  specs: ProductSpec[];
};

const emptyForm = (): ProductFormState => ({
  name: "", description: "", material: "", price: "",
  colors: [], sizes: [], rows: buildMatrix([], []), specs: [],
});

function formFromProduct(p: WebsiteProductDTO): ProductFormState {
  const rows = matrixFromVariants(p.colors.map((c) => c.label), p.sizes.map((s) => s.label), p.variants);
  const colors = mergeLabels(p.colors.map((c) => c.label), p.variants.map((v) => v.color ?? "").filter(Boolean));
  const sizes = mergeLabels(p.sizes.map((s) => s.label), p.variants.map((v) => v.size ?? "").filter(Boolean));
  return {
    name: p.name, description: p.description ?? "", material: p.material ?? "",
    price: p.price != null ? String(p.price) : "",
    colors, sizes, rows, specs: p.attributes ?? [],
  };
}

/** Validated payload shared by create + edit. */
function preparePayload(f: ProductFormState) {
  if (!f.name.trim()) throw new Error("اكتب اسم المنتج.");
  const price = requirePrice(f.price);
  const variants = matrixToVariants(f.rows);
  const used = usedLabels(f.rows);
  return {
    name: f.name.trim(),
    description: f.description.trim() || null,
    material: f.material.trim() || null,
    price,
    variants,
    colors: used.colors,
    sizes: used.sizes,
    attributes: cleanSpecs(f.specs),
  };
}

function ProductFormFields({
  form, setForm, showErrors,
}: { form: ProductFormState; setForm: (f: ProductFormState) => void; showErrors: boolean }) {
  const err = (bad: boolean) => (showErrors && bad ? "border-destructive ring-1 ring-destructive" : "");
  const p = Number(form.price);
  return (
    <>
      <section className="space-y-3 border-b border-border pb-5">
        <h4 className="text-sm font-semibold">٢. بيانات المنتج</h4>
        <div className="space-y-1.5">
          <label className="text-xs font-medium">اسم المنتج</label>
          <Input className={err(!form.name.trim())} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="مثال: تيشيرت قطن" />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium">الوصف</label>
          <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-xs font-medium">السعر (ج.م)</label>
            <Input className={err(!(p > 0))} type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="مثال: 350" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium">الخامة (اختياري)</label>
            <Input value={form.material} onChange={(e) => setForm({ ...form, material: e.target.value })} placeholder="مثال: قطن ١٠٠٪" />
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h4 className="text-sm font-semibold">٣. المقاسات والألوان والكمية</h4>
        <VariantMatrixEditor
          colors={form.colors} sizes={form.sizes} rows={form.rows} basePrice={form.price}
          onChange={(n) => setForm({ ...form, ...n })}
        />
      </section>
    </>
  );
}

async function uploadPending(productId: string, pending: PendingImage[], colors: { id: string; label: string }[]) {
  const idByLabel = new Map(colors.map((c) => [norm(c.label), c.id] as const));
  for (const img of pending) {
    const fd = new FormData();
    fd.append("file", img.file);
    fd.append("productId", productId);
    const cid = img.color ? idByLabel.get(norm(img.color)) : undefined;
    if (cid) fd.append("colorId", cid);
    await uploadProductImage({ data: fd });
  }
}

function usePendingImages() {
  const [pending, setPending] = useState<PendingImage[]>([]);
  const add = (list: FileList | null, color = "") => {
    const picked = Array.from(list ?? []).filter((f) => /^image\//i.test(f.type));
    if (picked.length) setPending((prev) => [...prev, ...picked.map((file) => ({ id: ++pendingSeq, file, url: URL.createObjectURL(file), color }))]);
  };
  const remove = (id: number) => setPending((prev) => prev.filter((p) => p.id !== id));
  const setColor = (id: number, color: string) => setPending((prev) => prev.map((p) => (p.id === id ? { ...p, color } : p)));
  return { pending, setPending, add, remove, setColor };
}

function AddProductDialog({
  open, onOpenChange, onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (productId: string) => void;
}) {
  const [form, setForm] = useState<ProductFormState>(emptyForm);
  const imgs = usePendingImages();
  const [showErrors, setShowErrors] = useState(false);
  const [offerOn, setOfferOn] = useState(false);
  const [offerValue, setOfferValue] = useState("");

  function reset() {
    setForm(emptyForm()); imgs.setPending([]); setShowErrors(false);
    setOfferOn(false); setOfferValue("");
  }

  const createMut = useMutation({
    mutationFn: async () => {
      const data = preparePayload(form);
      const res = await createManualProduct({ data });
      await uploadPending(res.productId, imgs.pending, res.colors ?? []);
      const sale = Number(offerValue);
      const base = Number(form.price);
      if (offerOn && sale > 0 && sale < base) {
        try {
          await setProductPieceOffer({ data: { productId: res.productId, discount_type: "amount", discount_value: Math.round((base - sale) * 100) / 100 } });
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "تم حفظ المنتج لكن تعذّر حفظ العرض.");
        }
      }
      return res;
    },
    onSuccess: (r) => { reset(); onCreated(r.productId); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "فشل إنشاء المنتج."),
  });

  function trySave() {
    setShowErrors(true);
    try { preparePayload(form); } catch (e) { toast.error(e instanceof Error ? e.message : "أكمل البيانات."); return; }
    createMut.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent dir="rtl" className="max-h-[88vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>إضافة منتج جديد</DialogTitle>
          <DialogDescription>ارفع الصور، اكتب الألوان والمقاسات مرة واحدة، وعدّل الكميات من جدول واحد.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <ProductFormFields form={form} setForm={setForm} showErrors={showErrors} />
          <section className="space-y-3">
            <h4 className="text-sm font-semibold">٤. الصور</h4>
            <ImageBoard colors={usedLabels(form.rows).colors}
              items={imgs.pending.map((img) => ({ key: `p${img.id}`, url: img.url, group: img.color, onRemove: () => imgs.remove(img.id) }))}
              onAdd={(f, g) => imgs.add(f, g)} onMove={(k, g) => imgs.setColor(Number(k.slice(1)), g)} />
          </section>
        </div>

        <section className="space-y-2 rounded-xl border border-border p-3">
          {!offerOn ? (
            <Button size="sm" variant="outline" type="button" className="w-full" onClick={() => setOfferOn(true)}>+ إضافة عرض</Button>
          ) : (
            <>
              <div className="flex items-center justify-between text-sm font-bold">السعر بعد الخصم
                <Button size="sm" variant="ghost" type="button" onClick={() => { setOfferOn(false); setOfferValue(""); }}>إلغاء العرض</Button>
              </div>
              <Input type="number" min={0} inputMode="numeric" className="h-11 text-base" value={offerValue}
                onChange={(e) => setOfferValue(e.target.value)} placeholder={form.price ? `أقل من ${form.price}` : "مثال: 300"} />
              {Number(offerValue) > 0 && Number(form.price) > 0 && (
                Number(offerValue) < Number(form.price)
                  ? <p className="text-xs text-muted-foreground">العميل هيشوف: <span className="font-bold text-destructive">{offerValue} ج.م</span> بدل <span className="line-through">{form.price} ج.م</span></p>
                  : <p className="text-xs text-destructive">لازم السعر بعد الخصم يكون أقل من سعر المنتج.</p>
              )}
            </>
          )}
        </section>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button onClick={trySave} disabled={createMut.isPending}>
            {createMut.isPending && <Loader2 className="ml-1 h-4 w-4 animate-spin" />}
            حفظ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditProductDialog({
  product, onOpenChange, onSaved,
}: {
  product: WebsiteProductDTO | null;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}) {
  const qc = useQueryClient();
  const editOffersQ = usePieceOffers();
  const [form, setForm] = useState<ProductFormState>(emptyForm);
  const imgs = usePendingImages();
  /** Saved image → colour label ("" = general) changed in this session. */
  const [savedAssign, setSavedAssign] = useState<Record<string, string>>({});
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);

  if (product && loadedId !== product.id) {
    setLoadedId(product.id);
    setForm(formFromProduct(product));
    imgs.setPending([]);
    setSavedAssign({});
  }

  const delImg = useMutation({
    mutationFn: (imageId: string) => deleteProductImage({ data: { imageId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["website-products"] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "فشل حذف الصورة."),
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!product) return;
      const data = preparePayload(form);
      // Keep every listed colour as a colour row so images linked to a colour
      // whose combinations are temporarily excluded keep their link.
      const colorRows = mergeLabels(data.colors, form.colors);
      const res = await upsertWebsiteProduct({
        data: {
          id: product.id,
          name: data.name,
          description: data.description,
          material: data.material,
          price: data.price,
          currency: product.currency,
          sizes: data.sizes.map((label) => ({ label })),
          colors: colorRows.map((label) => ({ label, hex: product.colors.find((c) => norm(c.label) === norm(label))?.hex ?? null })),
          variants: data.variants,
          attributes: data.attributes,
          imageColorAssignments: Object.entries(savedAssign).map(([imageId, colorLabel]) => ({ imageId, colorLabel })),
        },
      });
      await uploadPending(product.id, imgs.pending, res.colors ?? []);
    },
    onSuccess: () => { setLoadedId(null); onSaved(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "فشل حفظ التعديلات."),
  });

  if (!product) return null;

  function trySave() {
    setShowErrors(true);
    try { preparePayload(form); } catch (e) { toast.error(e instanceof Error ? e.message : "أكمل البيانات."); return; }
    save.mutate();
  }

  const colorChoices = form.colors;

  return (
    <Dialog open={!!product} onOpenChange={(v) => { if (!v) { setLoadedId(null); setShowErrors(false); } onOpenChange(v); }}>
      <DialogContent dir="rtl" className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>تعديل المنتج</DialogTitle>
          <DialogDescription>عدّل الصور والبيانات، والكميات والأسعار من جدول واحد.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <ProductFormFields form={form} setForm={setForm} showErrors={showErrors} />
          <section className="space-y-3">
            <h4 className="text-sm font-semibold">٤. الصور</h4>
            <ImageBoard colors={colorChoices}
              items={[
                ...product.images.map((img) => ({
                  key: `s${img.id}`, url: img.url,
                  group: savedAssign[img.id] ?? (product.colors.find((c) => c.id === img.color_id)?.label ?? ""),
                  onRemove: () => delImg.mutate(img.id),
                })),
                ...imgs.pending.map((img) => ({ key: `p${img.id}`, url: img.url, group: img.color, onRemove: () => imgs.remove(img.id) })),
              ]}
              onAdd={(f, g) => imgs.add(f, g)}
              onMove={(k, g) => k.startsWith("p") ? imgs.setColor(Number(k.slice(1)), g) : setSavedAssign((prev) => ({ ...prev, [k.slice(1)]: g }))} />
          </section>
        </div>

        <section className="space-y-1.5 rounded-xl border border-border p-3">
          <div className="text-sm font-bold">العرض</div>
          <ProductOfferControl productId={product.id} price={product.price == null ? null : Number(product.price)} currency={product.currency ?? null} offer={(editOffersQ.data ?? []).find((o) => o.product_id === product.id) ?? null} />
        </section>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button onClick={trySave} disabled={save.isPending}>
            {save.isPending ? <Loader2 className="ml-1 h-4 w-4 animate-spin" /> : null}
            حفظ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
