import type { OrderRow } from "@/lib/orders.functions";
import { ORDER_PAYMENT_STATE_LABEL_AR, orderPaymentState } from "@/lib/payment-policy";
import { hasPendingAddition } from "@/lib/order-pending-additions";
import { orderLineAmount, orderPresentation } from "@/lib/order-presentation";

function money(value: number | null, currency: string) {
  return value === null ? "غير مسجل" : `${new Intl.NumberFormat("ar-EG", { maximumFractionDigits: 2 }).format(value)} ${currency}`.trim();
}

function date(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "غير مسجل" : parsed.toLocaleString("ar-EG", { dateStyle: "short", timeStyle: "short" });
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="min-w-0"><dt className="mb-1 text-xs text-muted-foreground">{label}</dt><dd className="m-0 break-words text-sm leading-7 text-foreground">{children}</dd></div>;
}

export function OrderDetails({ order }: { order: OrderRow }) {
  const data = orderPresentation(order);
  const pending = hasPendingAddition(order);
  const milestones = [
    { label: "تأكيد الدفع", at: order.payment_confirmed_at },
    { label: "التجهيز", at: order.prepared_at },
    { label: "الشحن", at: order.shipped_at },
    { label: "التسليم", at: order.delivered_at },
  ].filter((step) => step.at);
  return (
    <div className="space-y-5 border-t border-border px-4 py-5 sm:px-5">
      <section aria-label="بيانات العميل">
        <h3 className="mb-3 text-sm font-semibold">بيانات العميل</h3>
        <dl className="grid gap-3 sm:grid-cols-2">
          <Detail label="رقم هاتف العميل"><span dir="ltr" className="inline-block tabular-nums">{order.customer_phone?.trim() || "غير مسجل"}</span></Detail>
          <Detail label="عنوان الشحن">{order.customer_address?.trim() || "غير مسجل"}</Detail>
        </dl>
      </section>

      <section aria-label="المنتجات" className="border-t border-border pt-4">
        <h3 className="mb-1 text-sm font-semibold">المنتجات</h3>
        {order.items.length === 0 ? <p className="text-sm text-muted-foreground">لا توجد منتجات مسجلة.</p> : (
          <ul className="divide-y divide-border">
            {order.items.map((item, index) => (
              <li key={index} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 py-3">
                <div className="min-w-0">
                  <p className="break-words text-sm font-semibold">{item.product_name || "منتج بدون اسم"}</p>
                  {(item.color || item.size) && <p className="mt-1 break-words text-xs text-muted-foreground">{[item.color, item.size].filter(Boolean).join(" · ")}</p>}
                  <p className="mt-1 text-xs text-muted-foreground">الكمية: <span className="tabular-nums text-foreground">{item.quantity ?? "غير مسجلة"}</span></p>
                </div>
                <div className="text-end"><p className="text-[11px] text-muted-foreground">قيمة المنتجات</p><p className="mt-1 text-sm font-medium tabular-nums">{money(orderLineAmount(item), item.currency || data.currency)}</p></div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="ملخص المبلغ" className="border-t border-border pt-4">
        <h3 className="mb-3 text-sm font-semibold">ملخص المبلغ</h3>
        <dl className="space-y-2.5 text-sm">
          <div className="flex justify-between gap-3"><dt className="text-muted-foreground">إجمالي المنتجات قبل الخصم</dt><dd className="m-0 shrink-0 tabular-nums">{money(data.subtotal, data.currency)}</dd></div>
          {data.discount !== null && data.discount > 0 && <div className="flex justify-between gap-3"><dt className="text-muted-foreground">الخصم</dt><dd className="m-0 shrink-0 tabular-nums">− {money(data.discount, data.currency)}</dd></div>}
          <div className="flex justify-between gap-3"><dt className="text-muted-foreground">الشحن</dt><dd className="m-0 shrink-0 tabular-nums">{money(data.shipping, data.currency)}</dd></div>
          <div className="flex justify-between gap-3 border-t border-border pt-3 font-semibold"><dt>{pending ? "إجمالي الطلب دون الإضافة" : "إجمالي الطلب"}</dt><dd className="m-0 shrink-0 tabular-nums">{money(data.total, data.currency)}</dd></div>
        </dl>
      </section>

      <section aria-label="الدفع" className="border-t border-border pt-4">
        <h3 className="mb-3 text-sm font-semibold">الدفع</h3>
        <dl className="grid gap-3 sm:grid-cols-2"><Detail label="طريقة الدفع">{order.payment_method?.trim() || "غير مسجلة"}</Detail><Detail label="حالة الدفع">{ORDER_PAYMENT_STATE_LABEL_AR[orderPaymentState(order)]}</Detail></dl>
      </section>

      {pending && <section aria-label="الإضافة بانتظار الدفع" className="border-t border-border pt-4">
        <h3 className="mb-3 text-sm font-semibold">إضافة بانتظار الدفع</h3>
        <ul className="space-y-2 text-sm">{(order.pending_items ?? []).map((item, index) => <li key={index} className="flex justify-between gap-3"><span className="min-w-0 break-words">{item.product_name || "منتج بدون اسم"}<span className="block text-xs text-muted-foreground">{[item.color, item.size].filter(Boolean).join(" · ")}</span></span><span className="shrink-0 tabular-nums">الكمية: {item.quantity ?? "—"}</span></li>)}</ul>
        <div className="mt-3 flex justify-between gap-3 text-sm font-medium"><span>مبلغ الإضافة</span><span className="tabular-nums">{money(order.pending_total ?? null, data.currency)}</span></div>
      </section>}

      {data.customerNotes && <section aria-label="ملاحظات العميل" className="border-t border-border pt-4"><h3 className="mb-2 text-sm font-semibold">ملاحظات العميل</h3><p className="whitespace-pre-wrap break-words text-sm leading-7 text-muted-foreground">{data.customerNotes}</p></section>}
      {milestones.length > 0 && <section aria-label="تحديثات الطلب" className="border-t border-border pt-4"><h3 className="mb-3 text-sm font-semibold">تحديثات الطلب</h3><dl className="space-y-2 text-xs">{milestones.map((step) => <div key={step.label} className="flex justify-between gap-3"><dt className="text-muted-foreground">{step.label}</dt><dd className="m-0">{step.at ? date(step.at) : ""}</dd></div>)}</dl></section>}
    </div>
  );
}