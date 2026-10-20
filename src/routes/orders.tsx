import { useEffect, useState } from "react";
import excelJsUrl from "exceljs/dist/exceljs.min.js?url";
import { ORDER_PAYMENT_STATE_LABEL_AR, orderPaymentState } from "@/lib/payment-policy";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ChevronDown, Truck, PackageCheck, Package, Settings2, Info, XCircle,
  Trash2, BadgeCheck, Search, Download, Pencil, Plus,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { HubShell, HubCard } from "@/components/hub/hub-shell";
import {
  listOrders,
  updateOrderStatus,
  cancelOrder,
  confirmOrderPayment,

  getOrderStatusMessages,
  setOrderStatusMessages,
  type OrderRow,
} from "@/lib/orders.functions";
import { canStartFulfillmentForOrder } from "@/lib/order-status-gate";
import {
  hasPendingAddition,
} from "@/lib/order-pending-additions";
import { NewOrderDialog, EditOrderDialog } from "@/components/orders/order-dialogs";
import { OrderDetails } from "@/components/orders/order-details";
import { orderPresentation } from "@/lib/order-presentation";


export const Route = createFileRoute("/orders")({
  head: () => ({
    meta: [
      { title: "الطلبات · cupai" },
      { name: "description", content: "إدارة الطلبات ومتابعة حالة الشحن والتسليم." },
      { property: "og:title", content: "الطلبات · cupai" },
      { property: "og:description", content: "إدارة الطلبات ومتابعة حالة الشحن والتسليم." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OrdersPage,
});

const STATUS_ORDER = ["new", "prepared", "shipped", "delivered"] as const;

function statusLabel(s: string): string {
  switch (s) {
    case "new": return "جديد";
    case "prepared": return "تم التجهيز";
    case "shipped": return "تم الشحن";
    case "delivered": return "تم التسليم";
    case "cancelled": return "ملغى";
    default: return s;
  }
}

function statusClass(s: string): string {
  switch (s) {
    case "new": return "bg-accent text-accent-foreground";
    case "prepared": return "bg-secondary text-secondary-foreground";
    case "shipped": return "bg-accent text-accent-foreground";
    case "delivered": return "bg-primary text-primary-foreground";
    case "cancelled": return "bg-destructive/10 text-destructive";
    default: return "bg-muted text-muted-foreground";
  }
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("ar-EG", { dateStyle: "short", timeStyle: "short" });
  } catch { return iso; }
}

function fmtMoney(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
}

/**
 * Export orders as a shipping-company-ready .xlsx file:
 * one row per order, one column per data type, styled and wrapped.
 */
// exceljs is loaded as a static browser script (URL only), never bundled as
// code: bundling it pulls a require() shim into the server that crashes the
// live site at startup.
function loadExcelJs(): Promise<typeof import("exceljs")> {
  const w = window as unknown as { ExcelJS?: typeof import("exceljs") };
  if (w.ExcelJS) return Promise.resolve(w.ExcelJS);
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = excelJsUrl;
    s.onload = () => (w.ExcelJS ? resolve(w.ExcelJS) : reject(new Error("ExcelJS missing")));
    s.onerror = () => reject(new Error("Failed to load ExcelJS"));
    document.head.appendChild(s);
  });
}

async function exportOrdersToXlsx(orders: OrderRow[]) {
  const ExcelJS = await loadExcelJs();
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet("الطلبات", {
    views: [{ rightToLeft: true, state: "frozen", ySplit: 1 }],
  });

  const headers = [
    "رقم الأوردر",
    "اسم العميل",
    "رقم الهاتف",
    "عنوان الشحن",
    "المنتجات والكميات",
    "المبلغ المطلوب تحصيله",
    "ملاحظات الشحن",
  ];
  sheet.columns = headers.map((h) => ({ header: h, key: h, width: 16 }));

  const wrappedCols = new Set(["عنوان الشحن", "المنتجات والكميات", "ملاحظات الشحن"]);
  const colWidths: Record<string, number> = {
    "رقم الأوردر": 14,
    "اسم العميل": 20,
    "رقم الهاتف": 16,
    "عنوان الشحن": 38,
    "المنتجات والكميات": 42,
    "المبلغ المطلوب تحصيله": 18,
    "ملاحظات الشحن": 28,
  };

  const rowsData = orders.map((o) => {
    const value = o.total_price != null ? Number(o.total_price) : Number(o.subtotal_price ?? 0);
    const products = o.items.map((it) => {
      const variant = [it.color, it.size].filter(Boolean).join("، ");
      const name = it.product_name ?? "—";
      const qty = Number(it.quantity ?? 0);
      return variant ? `${name} (${variant}) × ${qty}` : `${name} × ${qty}`;
    });
    return {
      order: o.order_number ?? o.id.slice(0, 8),
      name: o.customer_name ?? "",
      phone: o.customer_phone ?? "",
      address: o.customer_address ?? "",
      products: products.join("\n"),
      amount: Number.isFinite(value) ? value : 0,
      // Keep only the customer's own note: drop the auto summary block, whose
      // heading differs between chat orders and store-page orders.
      notes: (o.notes ?? "").split(/—\s*تفاصيل الأوردر/)[0].trim(),
    };
  });

  for (const r of rowsData) {
    sheet.addRow({
      "رقم الأوردر": r.order,
      "اسم العميل": r.name,
      "رقم الهاتف": r.phone,
      "عنوان الشحن": r.address,
      "المنتجات والكميات": r.products,
      "المبلغ المطلوب تحصيله": r.amount,
      "ملاحظات الشحن": r.notes,
    });
  }

  // Column widths: fit the content, capped so wrapped columns stay readable.
  headers.forEach((h, i) => {
    if (wrappedCols.has(h)) {
      sheet.getColumn(i + 1).width = colWidths[h];
      return;
    }
    let maxLen = h.length;
    for (const r of rowsData) {
      const v = String(
        h === "رقم الأوردر" ? r.order : h === "اسم العميل" ? r.name : h === "رقم الهاتف" ? r.phone : r.amount,
      );
      maxLen = Math.max(maxLen, ...v.split("\n").map((l) => l.length));
    }
    sheet.getColumn(i + 1).width = Math.min(Math.max(maxLen + 4, 12), 45);
  });

  // Row heights: grow with the number of wrapped lines so nothing is clipped.
  const linesNeeded = (text: string, width: number) =>
    text.split("\n").reduce((n, line) => n + Math.max(1, Math.ceil(line.length / width)), 0);

  // Styling: bold header on a dark fill, bordered cells, wrapped text.
  const border = { style: "thin" as const, color: { argb: "FFD9D9D9" } };
  sheet.eachRow({ includeEmpty: true }, (row, num) => {
    row.eachCell({ includeEmpty: true }, (cell, colNum) => {
      cell.border = { top: border, bottom: border, left: border, right: border };
      const h = headers[colNum - 1];
      if (num === 1) {
        cell.font = { bold: true, size: 11, color: { argb: "FFFFFFFF" } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F2937" } };
        cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
        return;
      }
      if (h === "المبلغ المطلوب تحصيله") {
        cell.alignment = { vertical: "top", horizontal: "center" };
        cell.numFmt = "#,##0.00";
      } else if (h === "رقم الهاتف" || h === "رقم الأوردر") {
        if (h === "رقم الهاتف") cell.numFmt = "@";
        cell.alignment = { vertical: "top", horizontal: "center" };
      } else {
        cell.alignment = {
          vertical: "top",
          horizontal: "right",
          wrapText: wrappedCols.has(h),
        };
      }
    });
    if (num === 1) {
      row.height = 26;
      return;
    }
    const r = rowsData[num - 2];
    const lines = Math.max(
      linesNeeded(r.address, 34),
      linesNeeded(r.products, 38),
      linesNeeded(r.notes, 26),
    );
    row.height = Math.max(22, lines * 16 + 6);
  });

  const date = new Date().toISOString().slice(0, 10);
  const buffer = await book.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `shipping-orders-${date}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Order value = what the customer pays (products − discount + shipping).
 * When a discount was applied, a small line under the value states it, as
 * either an amount or a percentage of the products total.
 */
function OrderValue({ order }: { order: OrderRow }) {
  const { currency, total, discount } = orderPresentation(order);
  if (total === null) return <span className="text-xs text-muted-foreground">الإجمالي غير مسجل</span>;
  const value = total;

  const pendingTotal = Number(order.pending_total ?? 0) || 0;
  const pendingDiscount = Number(order.pending_discount ?? 0) || 0;

  return (
    <div className="text-end leading-tight">
      <div className="hub-display text-xl font-bold">
        {fmtMoney(value)} <span className="text-xs font-medium text-muted-foreground">{currency}</span>
      </div>
      {discount !== null && discount > 0 && (
        <div className="text-[11px] font-medium text-primary">
          بعد خصم {fmtMoney(discount)} {currency}
        </div>
      )}
      {hasPendingAddition(order) && (
        <div className="text-[11px] font-medium text-muted-foreground">
          + إضافة بانتظار الدفع: {fmtMoney(pendingTotal)} {currency}
          {pendingDiscount > 0 ? ` (بعد خصم ${fmtMoney(pendingDiscount)})` : ""}
        </div>
      )}
    </div>
  );
}


function OrdersPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["orders"], queryFn: () => listOrders() });
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [selectMode, setSelectMode] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [editing, setEditing] = useState<OrderRow | null>(null);
  const [filter, setFilter] = useState<"all" | "new" | "prepared" | "shipped" | "delivered" | "cancelled">("all");
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"orders" | "messages">("orders");

  const statusMut = useMutation({
    mutationFn: (v: { id: string; status: "prepared" | "shipped" | "delivered" }) =>
      updateOrderStatus({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      toast.success("تم تحديث حالة الطلب.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "فشل التحديث."),
  });

  const cancelMut = useMutation({
    mutationFn: (v: { id: string; deducted: boolean }) => cancelOrder({ data: { id: v.id } }),
    onSuccess: (_r, v) => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      toast.success(v.deducted ? "تم إلغاء الطلب وإرجاع الكميات للمخزون." : "تم إلغاء الطلب. لم يُخصم من المخزون أصلاً.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "فشل الإلغاء."),
  });

  const payMut = useMutation({
    mutationFn: (v: { id: string }) => confirmOrderPayment({ data: v }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      if (res.ok === false) {
        const lines = (res.shortages ?? [])
          .map(
            (s: any) =>
              `${s.product_name ?? ""}${s.color ? ` - ${s.color}` : ""}${s.size ? ` - ${s.size}` : ""}: المطلوب ${s.requested} / المتاح ${s.available}`,
          )
          .join(" • ");
        toast.error(`الكمية غير متاحة الآن، لم يتم الخصم. ${lines}`);
        return;
      }
      toast.success(
        res.alreadyConfirmed
          ? "الدفع مؤكد بالفعل — لم يتم خصم أي كمية إضافية."
          : "تم تأكيد الدفع وخصم الكميات من المخزون.",
      );
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "فشل تأكيد الدفع."),
  });

  /**
   * Fulfilment (تجهيز/شحن/تسليم) is blocked until the payment is confirmed —
   * including the payment of a later, still unpaid addition.
   */
  const guardedStatus = (o: OrderRow, status: "prepared" | "shipped" | "delivered") => {
    const gate = canStartFulfillmentForOrder(o);
    if (!gate.ok) {
      toast.error(gate.message);
      return;
    }
    statusMut.mutate({ id: o.id, status });
  };

  const rows: OrderRow[] = q.data ?? [];

  const counts = rows.reduce<Record<string, number>>((acc, o) => {
    acc[o.status] = (acc[o.status] ?? 0) + 1;
    return acc;
  }, {});

  const term = search.trim().toLowerCase();
  const visible = rows.filter((o) => {
    if (filter !== "all" && o.status !== filter) return false;
    if (!term) return true;
    return [o.order_number, o.customer_name, o.customer_phone, o.customer_address]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(term));
  });

  const chips: { key: typeof filter; label: string }[] = [
    { key: "all", label: `الكل (${rows.length})` },
    ...STATUS_ORDER.map((s) => ({ key: s as typeof filter, label: `${statusLabel(s)} (${counts[s] ?? 0})` })),
    { key: "cancelled", label: `ملغى (${counts.cancelled ?? 0})` },
  ];

  return (
    <HubShell
      eyebrow="إدارة الطلبات"
      title={<>كل الطلبات</>}
      subtitle="افتح أي طلب لعرض تفاصيله، وحدّث حالته ليصل إشعار للعميل تلقائياً."
    >
      <div className="grid grid-cols-2 gap-1 rounded-full border border-border bg-muted p-1">
        {([
          { key: "orders", label: "الطلبات" },
          { key: "messages", label: "رسائل الطلبات" },
        ] as const).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-full py-2 text-sm font-semibold transition-colors ${
              tab === t.key ? "bg-primary text-primary-foreground" : "text-muted-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "messages" ? <StatusMessagesEditor /> : <>
      <NewOrderDialog open={newOpen} onOpenChange={setNewOpen} />
      <EditOrderDialog order={editing} onClose={() => setEditing(null)} />
      <div className="flex justify-end">
        <Button size="sm" className="rounded-full" onClick={() => setNewOpen(true)}>
          <Plus className="ml-1 h-4 w-4" /> طلب جديد
        </Button>
      </div>
      {/* Search + filters */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث برقم الطلب، الاسم، الهاتف أو العنوان"
            className="hub-card w-full px-4 py-3 pe-10 text-sm outline-none placeholder:text-muted-foreground focus:border-primary/50"
          />
        </div>
        <div className="hub-scroll-x -mx-4 flex gap-2 px-4 pb-1">
          {chips.map((c) => (
            <button
              key={c.key}
              onClick={() => setFilter(c.key)}
              className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                filter === c.key
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-muted-foreground"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(() => {
            const chosen = visible.filter((o) => selected[o.id]);
            const toExport = selectMode && chosen.length > 0 ? chosen : visible;
            const allChosen = visible.length > 0 && chosen.length === visible.length;
            return (
              <>
                <Button
                  size="sm"
                  className="rounded-full"
                  disabled={toExport.length === 0}
                  onClick={async () => {
                    try {
                      await exportOrdersToXlsx(toExport);
                      toast.success(`تم تصدير ${toExport.length} طلب بنجاح.`);
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "فشل التصدير.");
                    }
                  }}
                >
                  <Download className="ml-1 h-4 w-4" />
                  {selectMode && chosen.length > 0 ? `تصدير المحدد (${chosen.length})` : "تصدير"}
                </Button>
                {visible.length > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-full"
                    onClick={() => {
                      setSelectMode((m) => !m);
                      setSelected({});
                    }}
                  >
                    {selectMode ? "إنهاء التحديد" : "تحديد"}
                  </Button>
                )}
                {selectMode && visible.length > 0 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="rounded-full"
                    onClick={() =>
                      setSelected(allChosen ? {} : Object.fromEntries(visible.map((o) => [o.id, true])))
                    }
                  >
                    {allChosen ? "إلغاء الكل" : "تحديد الكل"}
                  </Button>
                )}
              </>
            );
          })()}
        </div>
      </div>

      {q.isLoading ? (
        <HubCard className="p-10 text-center text-sm text-muted-foreground">جاري التحميل...</HubCard>
      ) : visible.length === 0 ? (
        <HubCard className="p-12 text-center text-sm text-muted-foreground">
          {rows.length === 0 ? "لا توجد طلبات بعد." : "لا توجد طلبات مطابقة."}
        </HubCard>
      ) : (
        <div className="space-y-3">
          {visible.map((o) => (
            <div key={o.id} className="flex items-start gap-2">
              {selectMode && (
                <input
                  type="checkbox"
                  aria-label="تحديد الطلب للتصدير"
                  checked={!!selected[o.id]}
                  onChange={(e) => setSelected((s) => ({ ...s, [o.id]: e.target.checked }))}
                  className="mt-5 h-5 w-5 shrink-0 accent-primary"
                />
              )}
              <div className="min-w-0 flex-1">
                <OrderCard
                  o={o}
                  open={!!expanded[o.id]}
                  onToggle={() => setExpanded((s) => ({ ...s, [o.id]: !s[o.id] }))}
                  onPay={() => payMut.mutate({ id: o.id })}
                  onStatus={(s) => guardedStatus(o, s)}
                  onCancel={() => cancelMut.mutate({ id: o.id, deducted: Array.isArray((o as any).stock_deducted) && (o as any).stock_deducted.length > 0 })}
                  onEdit={() => setEditing(o)}
                  busy={{ pay: payMut.isPending, status: statusMut.isPending, cancel: cancelMut.isPending }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
      </>}
    </HubShell>
  );
}

function StatusRail({ status }: { status: string }) {
  if (status === "cancelled") return null;
  const idx = STATUS_ORDER.indexOf(status as (typeof STATUS_ORDER)[number]);
  return (
    <div className="mt-3 flex items-center gap-1.5">
      {STATUS_ORDER.map((s, i) => (
        <span
          key={s}
          className={`h-1.5 flex-1 rounded-full ${i <= idx ? "bg-primary" : "bg-muted"}`}
          title={statusLabel(s)}
        />
      ))}
    </div>
  );
}

function OrderCard({
  o, open, onToggle, onPay, onStatus, onCancel, onEdit, busy,
}: {
  o: OrderRow;
  open: boolean;
  onToggle: () => void;
  onPay: () => void;
  onStatus: (s: "prepared" | "shipped" | "delivered") => void;
  onCancel: () => void;
  onEdit: () => void;
  busy: { pay: boolean; status: boolean; cancel: boolean };
}) {
  const pending = hasPendingAddition(o);
  return (
    <HubCard className="overflow-hidden rounded-lg shadow-none">
      {(o.payment_status === "pending" || pending) && o.status !== "cancelled" && (
        <div className="flex justify-end px-4 pt-3" dir="rtl">
          <Button size="sm" className="rounded-full" disabled={busy.pay} onClick={onPay}>
            <BadgeCheck className="ml-1 h-3.5 w-3.5" />
            {o.payment_status === "pending" ? "تأكيد الدفع" : "تأكيد دفع الإضافة"}
          </Button>
        </div>
      )}
      <Button variant="ghost" onClick={onToggle} aria-expanded={open} aria-label={`تفاصيل الطلب ${o.order_number ?? o.id.slice(0, 8)}`} className="block h-auto w-full whitespace-normal rounded-none p-4 text-start hover:bg-muted/30">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`hub-chip ${statusClass(o.status)}`}>{statusLabel(o.status)}</span>
              <span
                className={`hub-chip ${
                  o.payment_status === "pending"
                    ? "bg-muted text-muted-foreground"
                    : orderPaymentState(o) === "on_delivery"
                      ? "bg-accent text-accent-foreground"
                      : "bg-primary/10 text-primary"
                }`}
                title={o.payment_method ?? ""}
              >
                {ORDER_PAYMENT_STATE_LABEL_AR[orderPaymentState(o)]}
              </span>
              {pending && <span className="hub-chip bg-muted text-muted-foreground">إضافة بانتظار الدفع</span>}
            </div>
            <div className="mt-2 break-words text-[15px] font-bold">{o.customer_name?.trim() || "بدون اسم"}</div>
            <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
              <span dir="ltr">#{o.order_number ?? o.id.slice(0, 8)}</span>
              <span>{fmtDate(o.created_at)}</span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <OrderValue order={o} />
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
          </div>
        </div>
      </Button>

      {open && <OrderDetails order={o} />}

      <div className="grid grid-cols-3 gap-2 border-t border-border p-3 sm:flex sm:flex-wrap">
        <Button size="sm" variant="outline" className="rounded-md" onClick={onEdit}>
          <Pencil className="ml-1 h-3.5 w-3.5" /> تعديل
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="rounded-md"
          disabled={
            o.status === "prepared" || o.status === "shipped" ||
            o.status === "delivered" || o.status === "cancelled" || busy.status
          }
          onClick={() => onStatus("prepared")}
        >
          <Package className="ml-1 h-3.5 w-3.5" /> تجهيز
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="rounded-md"
          disabled={o.status === "shipped" || o.status === "delivered" || busy.status}
          onClick={() => onStatus("shipped")}
        >
          <Truck className="ml-1 h-3.5 w-3.5" /> شحن
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="rounded-md"
          disabled={o.status === "delivered" || busy.status}
          onClick={() => onStatus("delivered")}
        >
          <PackageCheck className="ml-1 h-3.5 w-3.5" /> تسليم
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="rounded-md text-destructive hover:text-destructive"
          disabled={o.status === "cancelled" || busy.cancel}
          onClick={onCancel}
        >
          <XCircle className="ml-1 h-3.5 w-3.5" /> إلغاء
        </Button>
      </div>
    </HubCard>
  );
}


function StatusMessagesEditor() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["order-status-messages"], queryFn: () => getOrderStatusMessages() });
  const [prepared, setPrepared] = useState("");
  const [shipped, setShipped] = useState("");
  const [delivered, setDelivered] = useState("");
  const [preparedEnabled, setPreparedEnabled] = useState(true);
  const [shippedEnabled, setShippedEnabled] = useState(true);
  const [deliveredEnabled, setDeliveredEnabled] = useState(true);

  useEffect(() => {
    if (q.data) {
      setPrepared(q.data.prepared);
      setShipped(q.data.shipped);
      setDelivered(q.data.delivered);
      setPreparedEnabled(q.data.preparedEnabled);
      setShippedEnabled(q.data.shippedEnabled);
      setDeliveredEnabled(q.data.deliveredEnabled);
    }
  }, [q.data]);

  const saveMut = useMutation({
    mutationFn: (v: {
      prepared: string;
      shipped: string;
      delivered: string;
      preparedEnabled: boolean;
      shippedEnabled: boolean;
      deliveredEnabled: boolean;
    }) => setOrderStatusMessages({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["order-status-messages"] });
      toast.success("تم حفظ رسائل الحالة.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "فشل الحفظ."),
  });

  const save = (
    over?: Partial<{
      prepared: string;
      shipped: string;
      delivered: string;
      preparedEnabled: boolean;
      shippedEnabled: boolean;
      deliveredEnabled: boolean;
    }>,
  ) =>
    saveMut.mutate({
      prepared,
      shipped,
      delivered,
      preparedEnabled,
      shippedEnabled,
      deliveredEnabled,
      ...over,
    });

  return (
    <HubCard className="space-y-5 p-5">
      <div>
        <div className="flex items-center gap-2 text-sm font-bold">
          <Settings2 className="h-4 w-4 text-primary" />
          الرسائل التلقائية لحالات الأوردر
        </div>
        <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
          تحكم في الرسائل التي يتم إرسالها تلقائيًا للعميل عند تحديث حالة الأوردر. يمكنك تعديلها أو حذفها أو إيقاف إرسالها بالكامل.
        </p>
      </div>

      <MessageBlock
        title="رسالة عند تجهيز الأوردر"
        value={prepared}
        onChange={setPrepared}
        enabled={preparedEnabled}
        onToggle={(v) => {
          setPreparedEnabled(v);
          save({ preparedEnabled: v });
        }}
        onDelete={() => {
          setPrepared("");
          save({ prepared: "" });
        }}
        rows={2}
        pending={saveMut.isPending}
      />

      <MessageBlock
        title="رسالة عند تم الشحن"
        value={shipped}
        onChange={setShipped}
        enabled={shippedEnabled}
        onToggle={(v) => {
          setShippedEnabled(v);
          save({ shippedEnabled: v });
        }}
        onDelete={() => {
          setShipped("");
          save({ shipped: "" });
        }}
        rows={2}
        pending={saveMut.isPending}
      />

      <MessageBlock
        title="رسالة عند تم التسليم"
        value={delivered}
        onChange={setDelivered}
        enabled={deliveredEnabled}
        onToggle={(v) => {
          setDeliveredEnabled(v);
          save({ deliveredEnabled: v });
        }}
        onDelete={() => {
          setDelivered("");
          save({ delivered: "" });
        }}
        rows={3}
        pending={saveMut.isPending}
      />

      <Button className="rounded-full" onClick={() => save()} disabled={saveMut.isPending || q.isLoading}>
        حفظ التعديلات
      </Button>
    </HubCard>
  );
}

function MessageBlock(props: {
  title: string;
  value: string;
  onChange: (v: string) => void;
  enabled: boolean;
  onToggle: (v: boolean) => void;
  onDelete: () => void;
  rows: number;
  pending: boolean;
}) {
  return (
    <div className="space-y-2 rounded-xl border border-border bg-secondary/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="text-xs font-bold">{props.title}</label>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground">
              {props.enabled ? "الإرسال مفعّل" : "الإرسال متوقف"}
            </span>
            <Switch checked={props.enabled} onCheckedChange={props.onToggle} disabled={props.pending} />
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            disabled={props.pending || !props.value.trim()}
            onClick={props.onDelete}
          >
            <Trash2 className="ml-1 h-3.5 w-3.5" /> حذف
          </Button>
        </div>
      </div>
      <Textarea
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        rows={props.rows}
        disabled={!props.enabled}
        className="bg-background"
        placeholder="لا توجد رسالة — لن يتم إرسال أي شيء للعميل."
      />
      {(!props.enabled || !props.value.trim()) && (
        <p className="text-[11px] text-muted-foreground">لن يتم إرسال أي رسالة للعميل عند هذه الحالة.</p>
      )}
    </div>
  );
}
