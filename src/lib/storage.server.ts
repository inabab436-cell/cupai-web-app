/**
 * Server-only helpers for the cupai-uploads bucket.
 */
import { getSupabaseAdmin } from "@/lib/cupai-database.server";

export const UPLOAD_BUCKET = "cupai-uploads";

// In-memory cache of freshly signed URLs (per worker isolate). A signed URL is
// valid for its whole TTL, so reusing it for a bounded window is safe and
// removes one storage round-trip per image on every page load.
const signedUrlCache = new Map<string, { url: string; expiresAt: number; reuseUntil: number }>();
/** Stop reusing a signed URL this long before it actually expires. */
const SIGN_CACHE_MARGIN_MS = 0;

function cacheSigned(path: string, url: string, expiresIn: number) {
  signedUrlCache.set(path, {
    url,
    expiresAt: Date.now() + expiresIn * 1000 - SIGN_CACHE_MARGIN_MS,
    reuseUntil: Date.now() + (expiresIn * 1000) / 2,
  });
}

function cachedSigned(path: string): string | null {
  const hit = signedUrlCache.get(path);
  if (hit && hit.reuseUntil > Date.now()) return hit.url;
  if (hit) signedUrlCache.delete(path);
  return null;
}

export async function uploadOriginalFile(args: {
  userId: string;
  fileName: string;
  mimeType: string;
  bytes: ArrayBuffer;
}): Promise<{ path: string }> {
  const admin = getSupabaseAdmin();
  const safeName = args.fileName.replace(/[^\w.\-]+/g, "_");
  const path = `${args.userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;
  const { error } = await admin.storage
    .from(UPLOAD_BUCKET)
    .upload(path, args.bytes, {
      contentType: args.mimeType,
      upsert: false,
    });
  if (error) throw new Error(`Upload failed: ${error.message}`);
  return { path };
}

export async function createSignedUrl(
  path: string,
  expiresIn = 60 * 30,
): Promise<string> {
  const cached = cachedSigned(path);
  if (cached) return cached;
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.storage
    .from(UPLOAD_BUCKET)
    .createSignedUrl(path, expiresIn);
  if (error || !data) throw new Error(`Signed URL failed: ${error?.message}`);
  cacheSigned(path, data.signedUrl, expiresIn);
  return data.signedUrl;
}

/**
 * Sign many storage paths with ONE storage request (reusing cached URLs when
 * available). Returns a map path → signed URL; paths that failed to sign are
 * simply absent from the map, so callers keep their existing error handling.
 */
export async function createSignedUrlsBatch(
  paths: string[],
  expiresIn = 60 * 30,
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const missing: string[] = [];
  for (const p of paths) {
    const cached = cachedSigned(p);
    if (cached) out.set(p, cached);
    else if (!missing.includes(p)) missing.push(p);
  }
  if (!missing.length) return out;

  const admin = getSupabaseAdmin();
  const { data, error } = await admin.storage
    .from(UPLOAD_BUCKET)
    .createSignedUrls(missing, expiresIn);
  if (error || !data) {
    // Fall back to per-path signing so callers keep working.
    await Promise.all(
      missing.map(async (p) => {
        try {
          out.set(p, await createSignedUrl(p, expiresIn));
        } catch {
          /* leave missing */
        }
      }),
    );
    return out;
  }
  for (const item of data as Array<{
    path?: string;
    signedURL?: string;
    signedUrl?: string;
  }>) {
    const p = item?.path ? String(item.path) : "";
    const url = item?.signedURL ?? item?.signedUrl ?? "";
    if (p && url) {
      out.set(p, url);
      cacheSigned(p, url, expiresIn);
    }
  }
  return out;
}
