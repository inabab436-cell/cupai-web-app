import type { OrderItem, OrderRow } from "@/lib/orders.functions";

/** Display saved amounts only; never reprice an order or read totals from notes. */
export function savedAmount(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : null;
}

export function orderLineAmount(item: OrderItem): number | null {
  const recorded = savedAmount(item.line_total);
  if (recorded !== null) return recorded;
  const unit = savedAmount(item.unit_price) ?? savedAmount(item.price);
  const quantity = savedAmount(item.quantity);
  return unit !== null && quantity !== null ? Math.round(unit * quantity * 100) / 100 : null;
}

export function orderPresentation(order: OrderRow) {
  const lines = order.items.map(orderLineAmount);
  const complete = lines.length > 0 && lines.every((value) => value !== null);
  return {
    currency: order.items.find((item) => item.currency?.trim())?.currency?.trim() ?? "",
    subtotal: savedAmount(order.subtotal_price) ?? (complete ? lines.reduce<number>((sum, value) => sum + (value ?? 0), 0) : null),
    discount: savedAmount(order.discount_amount),
    shipping: savedAmount(order.shipping_cost),
    total: savedAmount(order.total_price),
    customerNotes: (order.notes ?? "").split(/—\s*تفاصيل الأوردر/)[0].trim(),
  };
}