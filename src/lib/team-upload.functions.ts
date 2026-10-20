import { createServerFn } from "@tanstack/react-start";
import { teamUploadRequestSchema, TEAM_UPLOAD_REQUEST_FOLDER } from "@/lib/team-upload-request";

/** Narrow public intake: validated contact details only; no public reads. */
export const requestTeamUpload = createServerFn({ method: "POST" })
  .inputValidator((input: { phone: string }) => teamUploadRequestSchema.parse(input))
  .handler(async ({ data }): Promise<{ ok: boolean; message: string }> => {
    const { getSupabaseAdmin } = await import("@/lib/cupai-database.server");
    const { UPLOAD_BUCKET } = await import("@/lib/storage.server");
    const secret = process.env.CUPAI_APP_SESSION_SECRET;
    if (!secret) return { ok: false, message: "تعذّر إرسال الطلب الآن. حاول مرة أخرى لاحقًا." };
    const { createHmac } = await import("node:crypto");
    const now = new Date();
    // Atomic create without overwrite limits repeated submissions per number/day.
    const key = createHmac("sha256", secret).update(data.phone.replace(/^\+/, "")).digest("hex");
    const path = `${TEAM_UPLOAD_REQUEST_FOLDER}/${now.toISOString().slice(0, 10)}-${key}.json`;
    const payload = JSON.stringify({ phone: data.phone, createdAt: now.toISOString() });
    const { error } = await getSupabaseAdmin().storage.from(UPLOAD_BUCKET).upload(path, new Blob([payload], { type: "application/json" }), { contentType: "application/json", upsert: false });
    if (error) {
      if ("statusCode" in error && String(error.statusCode) === "409") {
        return { ok: true, message: "تم استلام طلب لهذا الرقم اليوم بالفعل. سيتواصل معك أحد مسؤولي فريقنا لتحديد التفاصيل والتكلفة." };
      }
      return { ok: false, message: "لم يتم إرسال الطلب. حاول مرة أخرى لاحقًا." };
    }
    return { ok: true, message: "تم إرسال طلبك. سيتواصل معك أحد مسؤولي فريقنا لمناقشة المنتجات وتحديد التكلفة قبل البدء." };
  });