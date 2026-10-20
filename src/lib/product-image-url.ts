/**
 * Permanent, never-expiring address for a saved product photo.
 *
 * Product photos live in a private storage bucket; their storage path is kept
 * forever in `product_images.url`. Instead of handing the browser a signed
 * link that expires, we hand it this stable address — the server route
 * `/api/public/product-image` signs a fresh link on every request.
 */
export const PRODUCT_IMAGE_ROUTE = "/api/public/product-image";

export function isStoragePath(u: string): boolean {
  return !!u && !/^https?:/i.test(u) && !/^data:/i.test(u) && !u.startsWith("/");
}

export function permanentProductImageUrl(storagePath: string): string {
  return `${PRODUCT_IMAGE_ROUTE}?p=${encodeURIComponent(storagePath)}`;
}
