/**
 * Simple per-product offers set from the inventory screen.
 * Stored in the existing `offers` table (scope 'product', no window, no
 * minimum, no limit) and marked as per-piece, so the existing pricing engine
 * applies them — each order line gets at most one discount.
 */
import { createServerFn } from "@tanstack/react-start";

export interface ProductPieceOffer {
  offer_id: string;
  product_id: string;
  discount_type: "percent" | "amount";
  discount_value: number;
}

export const listProductPieceOffers = createServerFn({ method: "GET" }).handler(
  async (): Promise<ProductPieceOffer[]> => {
    const { requirePermission } = await import("@/lib/session-guard.server");
    const { getSupabaseAdmin } = await import("@/lib/cupai-database.server");
    const { PIECE_OFFER_MARKER } = await import("@/lib/offers.server");
    const { userId } = await requirePermission("brand_data");
    const { data, error } = await getSupabaseAdmin()
      .from("offers")
      .select("id, product_id, discount_type, discount_value")
      .eq("user_id", userId)
      .eq("description", PIECE_OFFER_MARKER)
      .eq("is_active", true)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const seen = new Set<string>();
    const out: ProductPieceOffer[] = [];
    for (const r of (data ?? []) as any[]) {
      const pid = String(r.product_id ?? "");
      if (!pid || seen.has(pid)) continue;
      seen.add(pid);
      out.push({
        offer_id: String(r.id),
        product_id: pid,
        discount_type: r.discount_type === "amount" ? "amount" : "percent",
        discount_value: Number(r.discount_value) || 0,
      });
    }
    return out;
  },
);

async function deactivate(admin: any, userId: string, productId: string, marker: string) {
  const { error } = await admin
    .from("offers")
    .update({ is_active: false, ends_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("product_id", productId)
    .eq("description", marker)
    .eq("is_active", true);
  if (error) throw new Error(error.message);
}

export const setProductPieceOffer = createServerFn({ method: "POST" })
  .inputValidator((v: { productId: string; discount_type: "percent" | "amount"; discount_value: number }) => v)
  .handler(async ({ data }) => {
    const { requirePermission } = await import("@/lib/session-guard.server");
    const { getSupabaseAdmin } = await import("@/lib/cupai-database.server");
    const { PIECE_OFFER_MARKER } = await import("@/lib/offers.server");
    const { userId } = await requirePermission("brand_data");
    const admin = getSupabaseAdmin();
    const type = data.discount_type === "amount" ? "amount" : "percent";
    const value = Number(data.discount_value);
    if (!Number.isFinite(value) || value <= 0) throw new Error("اكتب قيمة خصم صحيحة.");
    if (type === "percent" && value >= 100) throw new Error("النسبة يجب أن تكون أقل من 100%.");
    const { data: prod } = await admin
      .from("products")
      .select("id, name, price")
      .eq("id", String(data.productId))
      .eq("user_id", userId)
      .maybeSingle();
    if (!prod) throw new Error("المنتج غير موجود.");
    const price = Number((prod as any).price);
    if (type === "amount" && Number.isFinite(price) && price > 0 && value >= price) {
      throw new Error("مبلغ الخصم يجب أن يكون أقل من سعر القطعة.");
    }
    await deactivate(admin, userId, String(prod.id), PIECE_OFFER_MARKER);
    const { error } = await admin.from("offers").insert({
      user_id: userId,
      title: `عرض ${String((prod as any).name ?? "").trim()}`.trim(),
      description: PIECE_OFFER_MARKER,
      scope: "product",
      product_id: String(prod.id),
      discount_type: type,
      discount_value: value,
      min_order_total: null,
      ends_at: null,
      is_active: true,
      notify_enabled: false,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeProductPieceOffer = createServerFn({ method: "POST" })
  .inputValidator((v: { productId: string }) => v)
  .handler(async ({ data }) => {
    const { requirePermission } = await import("@/lib/session-guard.server");
    const { getSupabaseAdmin } = await import("@/lib/cupai-database.server");
    const { PIECE_OFFER_MARKER } = await import("@/lib/offers.server");
    const { userId } = await requirePermission("brand_data");
    await deactivate(getSupabaseAdmin(), userId, String(data.productId), PIECE_OFFER_MARKER);
    return { ok: true };
  });
