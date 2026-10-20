import { getSession } from "@tanstack/react-start/server";
/**
 * Store activation (pre-payment trial → paid plan). The merchant can only read
 * their own status and flag an activation request; turning `subscribed` on stays
 * an admin-only action in the platform console.
 */
import { createServerFn } from "@tanstack/react-start";

export interface ActivationStatus {
  subscribed: boolean;
  requestedAt: string | null;
  startedAt: string | null;
  endsAt: string | null;
  receiptStatus: "pending_review" | "rejected" | "approved" | null;
  receiptSubmittedAt: string | null;
}

function receiptFields(meta: Record<string, unknown>): Pick<ActivationStatus, "receiptStatus" | "receiptSubmittedAt"> {
  const status = typeof meta.payment_receipt_status === "string" ? meta.payment_receipt_status : null;
  return {
    receiptStatus: status === "pending_review" || status === "rejected" || status === "approved" ? status : null,
    receiptSubmittedAt: typeof meta.payment_receipt_submitted_at === "string" ? meta.payment_receipt_submitted_at : null,
  };
}

async function currentUserId(): Promise<string> {
  const { getSessionConfig } = await import("@/lib/session.server");
  const s = await getSession<{ userId: string }>(getSessionConfig());
  if (!s.data?.userId) throw new Error("You must be logged in.");
  return s.data.userId;
}

async function admin() {
  const { getSupabaseAdmin } = await import("@/lib/cupai-database.server");
  return getSupabaseAdmin();
}

export const getActivationStatus = createServerFn({ method: "GET" }).handler(
  async (): Promise<ActivationStatus> => {
    const id = await currentUserId();
    const { data } = await (await admin()).auth.admin.getUserById(id);
    const meta = data.user?.app_metadata ?? {};
    return {
      subscribed: meta.subscribed === true,
      requestedAt: typeof meta.activation_requested_at === "string" ? meta.activation_requested_at : null,
      startedAt: typeof meta.subscription_started_at === "string" ? meta.subscription_started_at : null,
      endsAt: typeof meta.subscription_ends_at === "string" ? meta.subscription_ends_at : null,
      ...receiptFields(meta),
    };
  },
);

const RECEIPT_MIME: Record<string, true> = { "image/jpeg": true, "image/png": true, "image/webp": true };
const RECEIPT_MAX_BYTES = 5 * 1024 * 1024;

/** Upload an InstaPay transfer receipt and flag the merchant's activation request as pending review. */
export const submitPaymentReceipt = createServerFn({ method: "POST" })
  .inputValidator((input: { dataUrl: string; fileName?: string | null; phone?: string | null }) => {
    if (!input || typeof input.dataUrl !== "string") throw new Error("يرجى اختيار صورة الإيصال.");
    return input;
  })
  .handler(async ({ data }): Promise<{ submittedAt: string }> => {
    const id = await currentUserId();
    const match = /^data:([^;,]+);base64,(.*)$/s.exec(data.dataUrl.trim());
    if (!match) throw new Error("يرجى اختيار صورة الإيصال.");
    const mime = match[1].toLowerCase();
    if (!RECEIPT_MIME[mime]) throw new Error("نوع الملف غير مدعوم. الصور المسموح بها: JPG وPNG وWebP فقط.");
    const binary = atob(match[2].replace(/\s+/g, ""));
    if (binary.length === 0) throw new Error("الملف فارغ.");
    if (binary.length > RECEIPT_MAX_BYTES) throw new Error("حجم الصورة يتجاوز 5 ميجابايت.");
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);

    const { uploadOriginalFile } = await import("@/lib/storage.server");
    const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
    const { path } = await uploadOriginalFile({
      userId: `${id}/payment-receipts`,
      fileName: `receipt.${ext}`,
      mimeType: mime,
      bytes: bytes.buffer as ArrayBuffer,
    });

    const sb = await admin();
    const { data: u } = await sb.auth.admin.getUserById(id);
    const meta = u.user?.app_metadata ?? {};
    const submittedAt = new Date().toISOString();
    const phone = typeof data.phone === "string" && /^01[0-9]{9}$/.test(data.phone.trim()) ? data.phone.trim() : meta.payment_phone ?? null;
    const { error } = await sb.auth.admin.updateUserById(id, {
      app_metadata: {
        ...meta,
        activation_requested_at: typeof meta.activation_requested_at === "string" ? meta.activation_requested_at : submittedAt,
        payment_receipt_path: path,
        payment_receipt_submitted_at: submittedAt,
        payment_receipt_status: "pending_review",
        payment_phone: phone,
      },
    });
    if (error) throw new Error("تعذّر إرسال الإيصال، حاول مرة أخرى.");
    return { submittedAt };
  });

export const requestActivation = createServerFn({ method: "POST" }).handler(
  async (): Promise<ActivationStatus> => {
    const id = await currentUserId();
    const sb = await admin();
    const { data } = await sb.auth.admin.getUserById(id);
    const meta = data.user?.app_metadata ?? {};
    const startedAt = typeof meta.subscription_started_at === "string" ? meta.subscription_started_at : null;
    const endsAt = typeof meta.subscription_ends_at === "string" ? meta.subscription_ends_at : null;
    if (meta.subscribed === true)
      return { subscribed: true, requestedAt: meta.activation_requested_at ?? null, startedAt, endsAt, ...receiptFields(meta) };
    const requestedAt = typeof meta.activation_requested_at === "string" ? meta.activation_requested_at : new Date().toISOString();
    const { error } = await sb.auth.admin.updateUserById(id, {
      app_metadata: { ...meta, activation_requested_at: requestedAt },
    });
    if (error) throw new Error("تعذّر إرسال طلب التفعيل، حاول مرة أخرى.");
    return { subscribed: false, requestedAt, startedAt: null, endsAt: null, ...receiptFields(meta) };
  },
);
