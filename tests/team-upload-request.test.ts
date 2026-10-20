import { describe, expect, it } from "vitest";
import { teamUploadRequestSchema } from "../src/lib/team-upload-request";

describe("team upload request validation", () => {
  it("accepts a contact phone and normalizes Arabic numerals", () => {
    expect(teamUploadRequestSchema.parse({ phone: "٠١٠ ١٢٣٤ ٥٦٧٨" }).phone).toBe("01012345678");
  });
  it("rejects blank, overlong and injection content", () => {
    for (const phone of ["", "123", "1".repeat(31), "<script>alert(1)</script>", "01012345678;DROP TABLE products"]) {
      expect(teamUploadRequestSchema.safeParse({ phone }).success).toBe(false);
    }
  });
  it("allows international phone numbers but rejects arbitrary extra data", () => {
    expect(teamUploadRequestSchema.parse({ phone: "+20 (10) 1234-5678" }).phone).toBe("+201012345678");
    expect(teamUploadRequestSchema.safeParse({ phone: "01012345678", cost: 299 }).success).toBe(false);
  });
});