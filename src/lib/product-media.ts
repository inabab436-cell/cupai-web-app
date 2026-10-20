export const PRODUCT_SIZE_SUGGESTIONS = ["S", "M", "L", "XL", "XXL", "44", "46", "48", "50", "52", "54", "56", "58", "60"];

export function productPhotoGroups(images: string[], colorImages: Record<string, string[]> = {}, color: string | null = null) {
  const linked = new Set(Object.values(colorImages).flat());
  const general = [...new Set(images.filter((url) => !linked.has(url)))];
  const selected = color ? [...new Set(colorImages[color] ?? [])] : [];
  return { general, selected, gallery: [...new Set([...selected, ...general])] };
}

export function productDescriptionForColor(description: string | null, color: string | null) {
  return (description ?? "").replace(/\{\{color\}\}/g, color ?? "").replace(/اللون:\s*\./g, "").trim();
}