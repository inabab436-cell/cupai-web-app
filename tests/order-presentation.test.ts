import { describe, expect, it } from "vitest";
import type { OrderRow } from "@/lib/orders.functions";
import { orderPresentation, orderLineAmount } from "@/lib/order-presentation";

const order = (fields: Partial<OrderRow>) => ({ items: [], notes: null, ...fields } as OrderRow);

describe("saved order presentation", () => {
  it("displays the saved 1220 total without subtracting the per-piece discount twice", () => {
    const data = orderPresentation(order({ items: [{ product_name: "منتج", color: null, size: null, quantity: 2, unit_price: 400 }, { product_name: "آخر", color: null, size: null, quantity: 1, unit_price: 500 }], subtotal_price: 1300, discount_amount: 80, shipping_cost: 0, total_price: 1220 }));
    expect(data).toMatchObject({ subtotal: 1300, discount: 80, shipping: 0, total: 1220 });
  });
  it("does not use a stale automatic note as current amounts", () => {
    const data = orderPresentation(order({ notes: "اتصل قبل الوصول\n— تفاصيل الأوردر (من صفحة المتجر) —\nإجمالي المنتجات: 500 EGP\nالإجمالي النهائي: 1000 EGP", subtotal_price: 900, shipping_cost: 50, total_price: 950 }));
    expect(data.customerNotes).toBe("اتصل قبل الوصول");
    expect(data.total).toBe(950);
    expect(data.subtotal).toBe(900);
  });
  it("keeps unknown amounts unknown and preserves recorded zero shipping", () => {
    const data = orderPresentation(order({ shipping_cost: 0 }));
    expect(data.shipping).toBe(0);
    expect(data.total).toBeNull();
    expect(data.subtotal).toBeNull();
  });
  it("uses recorded line amounts rather than overriding them", () => {
    expect(orderLineAmount({ product_name: "منتج", color: null, size: null, quantity: 2, unit_price: 400, line_total: 720 })).toBe(720);
  });
});