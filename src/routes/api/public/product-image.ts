/**
 * Serves saved product photos through a permanent address.
 *
 * Public on purpose (storefront visitors see product photos), but it only
 * serves files that are registered as product photos in `product_images`,
 * so other private uploads (receipts, chat files) are never reachable.
 */
import { createFileRoute } from "@tanstack/react-router";

const SIGN_TTL = 60 * 60 * 24; // 1 day; browser re-asks this route after 1 hour

export const Route = createFileRoute("/api/public/product-image")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const path = new URL(request.url).searchParams.get("p") ?? "";
        if (!path || path.length > 500 || /^https?:/i.test(path)) {
          return new Response("Not found", { status: 404 });
        }
        const { getSupabaseAdmin } = await import("@/lib/cupai-database.server");
        const { UPLOAD_BUCKET } = await import("@/lib/storage.server");
        const admin = getSupabaseAdmin();
        const { data: row } = await admin
          .from("product_images")
          .select("id")
          .eq("url", path)
          .limit(1)
          .maybeSingle();
        if (!row) return new Response("Not found", { status: 404 });
        const { data, error } = await admin.storage
          .from(UPLOAD_BUCKET)
          .createSignedUrl(path, SIGN_TTL);
        if (error || !data?.signedUrl) return new Response("Not found", { status: 404 });
        return new Response(null, {
          status: 302,
          headers: {
            Location: data.signedUrl,
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
