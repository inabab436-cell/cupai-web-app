import type { SupabaseClient } from "@supabase/supabase-js";
import { cleanSpecs, type ProductSpec } from "@/lib/variant-matrix";

/**
 * Save custom product specs into products.attributes (jsonb). Databases that
 * have not run db/2026-10-20_product_attributes.sql yet are skipped silently
 * so saving the product itself never fails because of specs.
 */
export async function saveProductAttributes(
  admin: SupabaseClient,
  productId: string,
  userId: string,
  specs: ProductSpec[],
): Promise<boolean> {
  const { error } = await admin
    .from("products")
    .update({ attributes: cleanSpecs(specs) } as never)
    .eq("id", productId)
    .eq("user_id", userId);
  if (error && /attributes/i.test(error.message)) return false;
  if (error) throw new Error(error.message);
  return true;
}
