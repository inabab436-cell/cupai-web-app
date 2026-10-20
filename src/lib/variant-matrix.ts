/**
 * Variant matrix: the merchant types every colour and every size once, and
 * every colour × size combination is generated automatically. Each
 * combination can be edited (stock / price override) or excluded (not sold).
 *
 * Output stays compatible with the existing inventory model: one
 * product_variants row per INCLUDED combination, keyed by the colour and size
 * text labels that orders and stock deduction already match on.
 */

export interface MatrixRow {
  color: string | null;
  size: string | null;
  enabled: boolean;
  /** Text as typed; empty = 0 (out of stock). */
  stock: string;
  /** Text as typed; empty = use the product's base price. */
  price: string;
}

export interface ExistingVariant {
  color: string | null;
  size: string | null;
  quantity: number | null;
  price?: number | null;
}

export function norm(label: string | null | undefined): string {
  return String(label ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function rowKey(color: string | null, size: string | null): string {
  return `${norm(color)}|${norm(size)}`;
}

/** Split bulk input ("أحمر، أزرق, أسود\nأبيض") into unique trimmed labels. */
export function parseList(text: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const part of String(text ?? "").split(/[,،\n;؛]+/)) {
    const v = part.trim().replace(/\s+/g, " ");
    if (!v || seen.has(norm(v))) continue;
    seen.add(norm(v));
    out.push(v);
  }
  return out;
}

/** Add labels to a list without duplicates (case-insensitive). */
export function mergeLabels(list: string[], add: string[]): string[] {
  const seen = new Set(list.map(norm));
  const out = [...list];
  for (const a of add) {
    if (seen.has(norm(a))) continue;
    seen.add(norm(a));
    out.push(a);
  }
  return out;
}

/**
 * Regenerate the full combination grid, keeping whatever the merchant already
 * typed (stock, price, excluded) for combinations that still exist.
 * No colours → rows by size only; no sizes → rows by colour only; neither →
 * one single row for the whole product.
 */
export function buildMatrix(colors: string[], sizes: string[], previous: MatrixRow[] = []): MatrixRow[] {
  const prev = new Map(previous.map((r) => [rowKey(r.color, r.size), r] as const));
  const cs: (string | null)[] = colors.length ? colors : [null];
  const ss: (string | null)[] = sizes.length ? sizes : [null];
  const rows: MatrixRow[] = [];
  for (const c of cs) {
    for (const s of ss) {
      const old = prev.get(rowKey(c, s));
      rows.push(old ? { ...old, color: c, size: s } : { color: c, size: s, enabled: true, stock: "", price: "" });
    }
  }
  return rows;
}

/** Hydrate the grid from saved variants; missing combinations start excluded. */
export function matrixFromVariants(colors: string[], sizes: string[], variants: ExistingVariant[]): MatrixRow[] {
  const allColors = mergeLabels(colors, variants.map((v) => v.color ?? "").filter(Boolean));
  const allSizes = mergeLabels(sizes, variants.map((v) => v.size ?? "").filter(Boolean));
  const saved = variants.map<MatrixRow>((v) => ({
    color: v.color,
    size: v.size,
    enabled: true,
    stock: v.quantity != null ? String(v.quantity) : "0",
    price: v.price != null ? String(v.price) : "",
  }));
  const savedKeys = new Set(saved.map((r) => rowKey(r.color, r.size)));
  return buildMatrix(allColors, allSizes, saved).map((r) =>
    savedKeys.has(rowKey(r.color, r.size)) || variants.length === 0 ? r : { ...r, enabled: false },
  );
}

export interface VariantOut {
  color: string | null;
  size: string | null;
  quantity: number;
  price: number | null;
}

/** Included rows → variant rows. Throws an Arabic message on invalid numbers. */
export function matrixToVariants(rows: MatrixRow[]): VariantOut[] {
  const out: VariantOut[] = [];
  for (const r of rows) {
    if (!r.enabled) continue;
    const label = [r.color, r.size].filter(Boolean).join(" / ") || "المنتج";
    const qText = r.stock.trim();
    const q = qText === "" ? 0 : Number(qText);
    if (!Number.isInteger(q) || q < 0) throw new Error(`الكمية في «${label}» يجب أن تكون رقماً صحيحاً (0 أو أكثر).`);
    const pText = r.price.trim();
    let price: number | null = null;
    if (pText !== "") {
      price = Number(pText);
      if (!Number.isFinite(price) || price <= 0) throw new Error(`السعر في «${label}» يجب أن يكون أكبر من صفر.`);
    }
    out.push({ color: r.color, size: r.size, quantity: q, price });
  }
  if (out.length === 0) throw new Error("فعّل تركيبة واحدة على الأقل في جدول المتغيرات.");
  return out;
}

/** Colours / sizes that are actually used by at least one included row. */
export function usedLabels(rows: MatrixRow[]): { colors: string[]; sizes: string[] } {
  const on = rows.filter((r) => r.enabled);
  return {
    colors: mergeLabels([], on.map((r) => r.color ?? "").filter(Boolean)),
    sizes: mergeLabels([], on.map((r) => r.size ?? "").filter(Boolean)),
  };
}

/** Product specs (custom attributes): name → value pairs, e.g. الوزن: ٥٠٠ جم. */
export interface ProductSpec { name: string; value: string }

export function cleanSpecs(specs: ProductSpec[]): ProductSpec[] {
  const seen = new Set<string>();
  const out: ProductSpec[] = [];
  for (const s of specs) {
    const name = String(s?.name ?? "").trim().slice(0, 80);
    const value = String(s?.value ?? "").trim().slice(0, 300);
    if (!name || !value || seen.has(norm(name))) continue;
    seen.add(norm(name));
    out.push({ name, value });
  }
  return out.slice(0, 30);
}

/** Numeric size range, e.g. 40→60 step 2 → ["40","42",…,"60"]. Max 40 sizes. */
export function sizeRange(from: number, to: number, step = 1): string[] {
  if (!Number.isFinite(from) || !Number.isFinite(to) || step <= 0) return [];
  const [a, b] = from <= to ? [from, to] : [to, from];
  const out: string[] = [];
  for (let n = a; n <= b && out.length < 40; n += step) out.push(String(n));
  return out;
}
