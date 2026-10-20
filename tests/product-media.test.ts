import { describe, expect, it } from "vitest";
import { PRODUCT_SIZE_SUGGESTIONS, productDescriptionForColor, productPhotoGroups } from "../src/lib/product-media";
import { basicFieldsFilled, missingRequiredFields, requireMaterial, requireSize } from "../src/lib/product-required-fields";

describe("product media requirements", () => {
  it("keeps general photos and every selected-color photo without other colors", () => {
    expect(productPhotoGroups(["general", "red1", "red2", "blue1"], { "أحمر": ["red1", "red2"], "أزرق": ["blue1"] }, "أحمر"))
      .toEqual({ general: ["general"], selected: ["red1", "red2"], gallery: ["red1", "red2", "general"] });
  });
  it("allows multiple unlinked photos without a color", () => {
    expect(productPhotoGroups(["front", "back"], {}, null).gallery).toEqual(["front", "back"]);
  });
  it("material is optional while price and inventory remain required", () => {
    expect(requireMaterial("")).toBe("");
    const input = { name: "قميص", material: "", price: "400", rows: [{ label: "أحمر", size: "44", quantity: "3" }] };
    expect(missingRequiredFields(input).size).toBe(0);
    expect(basicFieldsFilled({ ...input, rows: 1 })).toBe(true);
    expect(missingRequiredFields({ ...input, price: "" }).has("price")).toBe(true);
  });
  for (const size of ["44", "46", "48", "50", "52", "54", "56", "58", "60", "S", "M", "L"]) {
    it(`supports size ${size}`, () => {
      expect(PRODUCT_SIZE_SUGGESTIONS).toContain(size);
      expect(requireSize(size, "أحمر")).toBe(size);
    });
  }
  it("reuses exactly one base description and substitutes only the color", () => {
    const base = "قميص بأكمام طويلة. اللون: {{color}}.";
    expect(productDescriptionForColor(base, "أحمر")).toBe("قميص بأكمام طويلة. اللون: أحمر.");
    expect(productDescriptionForColor(base, "أزرق")).toBe("قميص بأكمام طويلة. اللون: أزرق.");
    expect(base).toBe("قميص بأكمام طويلة. اللون: {{color}}.");
  });
});