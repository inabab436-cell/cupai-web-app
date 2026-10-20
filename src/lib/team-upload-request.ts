import { z } from "zod";

export const teamUploadRequestSchema = z.object({
  phone: z.string().trim().max(30, "رقم الهاتف طويل جدًا.")
    .transform((value) => value.replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit))).replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit))).replace(/[\s()-]/g, ""))
    .refine((value) => /^\+?[0-9]{10,15}$/.test(value), "اكتب رقم هاتف صحيحًا من 10 إلى 15 رقمًا، مع كود الدولة عند الحاجة."),
}).strict();

export const TEAM_UPLOAD_REQUEST_FOLDER = "team-upload-requests";
export const savedTeamUploadRequestSchema = teamUploadRequestSchema.extend({
  createdAt: z.string().datetime(),
});
export type TeamUploadRequest = z.infer<typeof savedTeamUploadRequestSchema>;