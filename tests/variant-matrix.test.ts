import { describe, expect, it } from "vitest";
import { buildMatrix, matrixFromVariants, matrixToVariants, parseList, cleanSpecs } from "@/lib/variant-matrix";

describe("variant matrix", () => {
  it("bulk colours and sizes generate every combination", () => {
    const rows = buildMatrix(parseList("أحمر، أزرق"), parseList("S, M, L"));
    expect(rows).toHaveLength(6);
  });

  it("excluded combinations are not saved as variants", () => {
    const rows = buildMatrix(["أحمر", "أزرق"], ["S"]);
    rows[1]!.enabled = false;
    expect(matrixToVariants(rows).map((v) => v.color)).toEqual(["أحمر"]);
  });

  it("regenerating keeps typed stock and price", () => {
    const first = buildMatrix(["أحمر"], ["S"]);
    first[0]!.stock = "7";
    first[0]!.price = "350";
    const next = buildMatrix(["أحمر", "أسود"], ["S"], first);
    expect(next[0]).toMatchObject({ stock: "7", price: "350" });
  });

  it("product without colours or sizes gets one row", () => {
    expect(buildMatrix([], [])).toHaveLength(1);
  });

  it("saved variants hydrate, missing combinations start excluded, price kept", () => {
    const rows = matrixFromVariants(["أحمر", "أزرق"], ["S"], [{ color: "أحمر", size: "S", quantity: 4, price: 300 }]);
    expect(rows.find((r) => r.color === "أزرق")!.enabled).toBe(false);
    expect(matrixToVariants(rows)).toEqual([{ color: "أحمر", size: "S", quantity: 4, price: 300 }]);
  });

  it("empty stock means 0, negative stock is rejected", () => {
    const rows = buildMatrix(["أحمر"], []);
    expect(matrixToVariants(rows)[0]!.quantity).toBe(0);
    rows[0]!.stock = "-1";
    expect(() => matrixToVariants(rows)).toThrow();
  });

  it("specs drop empty and duplicate names", () => {
    expect(cleanSpecs([{ name: "الوزن", value: "1كجم" }, { name: "الوزن", value: "2" }, { name: "", value: "x" }])).toHaveLength(1);
  });
});

import { sizeRange as _sizeRange } from "@/lib/variant-matrix";
describe("sizeRange", () => {
  it("40 to 60 by 2 gives 11 sizes", () => {
    const r = _sizeRange(40, 60, 2);
    expect(r[0]).toBe("40"); expect(r[r.length - 1]).toBe("60"); expect(r.length).toBe(11);
  });
  it("40 to 44 by 1", () => expect(_sizeRange(40, 44, 1)).toEqual(["40", "41", "42", "43", "44"]));
});
