import { useState } from "react";
import { ChevronDown, Plus, X, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { buildMatrix, mergeLabels, norm, parseList, rowKey, sizeRange, type MatrixRow, type ProductSpec } from "@/lib/variant-matrix";

const QUICK_SIZES = ["S", "M", "L", "XL", "XXL", "3XL"];

function Chip({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className={`h-10 min-w-12 rounded-lg border px-3 text-sm font-semibold transition ${active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:border-primary/60"}`}>
      {children}
    </button>
  );
}

function Step({ n, title, hint, children }: { n: number; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{n}</span>
        <div>
          <p className="text-sm font-bold">{title}</p>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

function AddInput({ placeholder, onAdd }: { placeholder: string; onAdd: (v: string[]) => void }) {
  const [text, setText] = useState("");
  const commit = () => { const v = parseList(text); if (v.length) onAdd(v); setText(""); };
  return (
    <div className="flex gap-2">
      <Input className="h-10" value={text} placeholder={placeholder} onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commit(); } }} onBlur={commit} />
      <Button type="button" variant="outline" className="h-10" onClick={commit}><Plus className="h-4 w-4" /></Button>
    </div>
  );
}

function Removable({ values, hide = [], onRemove }: { values: string[]; hide?: string[]; onRemove: (v: string) => void }) {
  const list = values.filter((v) => !hide.some((h) => norm(h) === norm(v)));
  if (!list.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {list.map((v) => (
        <span key={v} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-muted px-3 text-sm font-medium">
          {v}
          <button type="button" aria-label={`حذف ${v}`} onClick={() => onRemove(v)}><X className="h-3.5 w-3.5" /></button>
        </span>
      ))}
    </div>
  );
}

export function VariantMatrixEditor({
  colors, sizes, rows, basePrice, onChange,
}: {
  colors: string[];
  sizes: string[];
  rows: MatrixRow[];
  basePrice: string;
  onChange: (next: { colors: string[]; sizes: string[]; rows: MatrixRow[] }) => void;
}) {
  const [showPrices, setShowPrices] = useState(() => rows.some((r) => r.price.trim() !== ""));
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [step, setStep] = useState(2);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [allQty, setAllQty] = useState("");

  const setLists = (c: string[], s: string[]) => onChange({ colors: c, sizes: s, rows: buildMatrix(c, s, rows) });
  const update = (match: (r: MatrixRow) => boolean, p: Partial<MatrixRow>) =>
    onChange({ colors, sizes, rows: rows.map((r) => (match(r) ? { ...r, ...p } : r)) });
  const has = (list: string[], v: string) => list.some((x) => norm(x) === norm(v));
  const toggleSize = (v: string) => setLists(colors, has(sizes, v) ? sizes.filter((x) => norm(x) !== norm(v)) : [...sizes, v]);
  const addRange = () => {
    const r = sizeRange(Number(from), Number(to), step);
    if (r.length) setLists(colors, mergeLabels(sizes, r));
  };
  const togglePrices = (on: boolean) => {
    setShowPrices(on);
    if (!on) onChange({ colors, sizes, rows: rows.map((r) => ({ ...r, price: "" })) });
  };

  const groups: (string | null)[] = colors.length ? colors : [null];
  const total = rows.filter((r) => r.enabled).reduce((n, r) => n + (Number(r.stock) || 0), 0);
  const rangePreview = sizeRange(Number(from), Number(to), step);

  return (
    <div className="space-y-4">
      <Step n={1} title="المقاسات" hint="اضغط على المقاس، أو اكتب من رقم لرقم">
        <div className="flex flex-wrap gap-2">
          {QUICK_SIZES.map((q) => <Chip key={q} active={has(sizes, q)} onClick={() => toggleSize(q)}>{q}</Chip>)}
        </div>
        <div className="rounded-lg bg-muted/50 p-3">
          <p className="mb-2 text-xs font-medium">مقاسات بالأرقام</p>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm">من</span>
            <Input className="h-10 w-20 text-center" type="number" inputMode="numeric" placeholder="40" value={from} onChange={(e) => setFrom(e.target.value)} />
            <span className="text-sm">إلى</span>
            <Input className="h-10 w-20 text-center" type="number" inputMode="numeric" placeholder="60" value={to} onChange={(e) => setTo(e.target.value)} />
            <div className="flex overflow-hidden rounded-lg border border-border text-xs">
              {[1, 2].map((s) => (
                <button key={s} type="button" onClick={() => setStep(s)}
                  className={`h-10 px-3 font-medium ${step === s ? "bg-primary text-primary-foreground" : "bg-background"}`}>
                  {s === 1 ? "كل رقم" : "زوجي فقط"}
                </button>
              ))}
            </div>
            <Button type="button" className="h-10" disabled={!rangePreview.length || from === "" || to === ""} onClick={addRange}>إضافة</Button>
          </div>
          {from !== "" && to !== "" && rangePreview.length > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">هيضيف: {rangePreview.join("، ")}</p>
          )}
        </div>
        <Removable values={sizes} hide={QUICK_SIZES} onRemove={(v) => setLists(colors, sizes.filter((x) => x !== v))} />
        <AddInput placeholder="مقاس آخر (مثال: فري سايز)" onAdd={(v) => setLists(colors, mergeLabels(sizes, v))} />
      </Step>

      <Step n={2} title="الألوان" hint="اكتبهم كلهم مرة واحدة: أسود، أبيض، أحمر">
        <AddInput placeholder="أسود، أبيض، أحمر" onAdd={(v) => setLists(mergeLabels(colors, v), sizes)} />
        <Removable values={colors} onRemove={(v) => setLists(colors.filter((x) => x !== v), sizes)} />
      </Step>

      <Step n={3} title="الكمية" hint="اكتب رقم واحد لكل لون، وهيتحط لكل مقاساته. ولو مقاس مختلف افتح التفاصيل.">
        {groups.length > 1 && sizes.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/50 p-3">
            <span className="text-sm">نفس الكمية لكل الألوان والمقاسات</span>
            <Input className="h-10 w-20 text-center" type="number" min={0} inputMode="numeric" placeholder="0" value={allQty} onChange={(e) => setAllQty(e.target.value)} />
            <Button type="button" variant="outline" className="h-10" disabled={allQty === ""} onClick={() => update(() => true, { stock: allQty, enabled: true })}>تطبيق</Button>
          </div>
        )}
        <div className="space-y-2">
          {groups.map((c) => {
            const gk = norm(c);
            const gRows = rows.filter((r) => norm(r.color) === gk);
            const same = gRows.every((r) => r.stock === gRows[0]?.stock);
            const gTotal = gRows.reduce((n, r) => n + (Number(r.stock) || 0), 0);
            const multi = gRows.length > 1;
            return (
              <div key={gk || "_"} className="rounded-lg border border-border">
                <div className="flex items-center gap-3 p-3">
                  <div className="flex-1">
                    <p className="text-sm font-bold">{c ?? (multi ? "كل المقاسات" : "الكمية")}</p>
                    {multi && <p className="text-xs text-muted-foreground">{gRows.length} مقاس · إجمالي {gTotal} قطعة</p>}
                  </div>
                  <div className="text-center">
                    <Input className="h-11 w-20 text-center text-base" type="number" min={0} inputMode="numeric" placeholder={same ? "0" : "مختلف"}
                      aria-label={`كمية ${c ?? ""}`} value={same ? (gRows[0]?.stock ?? "") : ""}
                      onChange={(e) => update((r) => norm(r.color) === gk, { stock: e.target.value, enabled: true })} />
                    {multi && <p className="mt-0.5 text-[10px] text-muted-foreground">لكل مقاس</p>}
                  </div>
                </div>
                {(multi || showPrices) && (
                  <>
                    <button type="button" onClick={() => setOpen({ ...open, [gk]: !open[gk] })}
                      className="flex w-full items-center justify-center gap-1 border-t border-border py-2 text-xs font-medium text-primary">
                      {open[gk] ? "إخفاء التفاصيل" : "تعديل مقاس لوحده"}
                      <ChevronDown className={`h-3.5 w-3.5 transition ${open[gk] ? "rotate-180" : ""}`} />
                    </button>
                    {open[gk] && (
                      <div className="grid grid-cols-2 gap-2 border-t border-border p-3 sm:grid-cols-3">
                        {gRows.map((r) => {
                          const key = rowKey(r.color, r.size);
                          const zero = (Number(r.stock) || 0) === 0;
                          return (
                            <div key={key} className={`space-y-1 rounded-lg border p-2 ${zero ? "border-dashed border-border opacity-70" : "border-border"}`}>
                              <p className="text-center text-sm font-semibold">{r.size ?? "—"}</p>
                              <Input className="h-9 text-center" type="number" min={0} inputMode="numeric" placeholder="0" aria-label={`كمية ${key}`}
                                value={r.stock} onChange={(e) => update((x) => rowKey(x.color, x.size) === key, { stock: e.target.value, enabled: true })} />
                              {showPrices && (
                                <Input className="h-9 text-center" type="number" min={0} inputMode="numeric" placeholder={basePrice || "السعر"} aria-label={`سعر ${key}`}
                                  value={r.price} onChange={(e) => update((x) => rowKey(x.color, x.size) === key, { price: e.target.value })} />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input type="checkbox" className="h-4 w-4 accent-primary" checked={showPrices} onChange={(e) => togglePrices(e.target.checked)} />
            فيه مقاس أو لون سعره مختلف
          </label>
          <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold">الإجمالي: {total} قطعة</span>
        </div>
      </Step>
    </div>
  );
}

/** Free-form product specs: الوزن، السعة، بلد الصنع… */
export function SpecsEditor({ specs, onChange }: { specs: ProductSpec[]; onChange: (s: ProductSpec[]) => void }) {
  return (
    <div className="space-y-2">
      {specs.map((s, i) => (
        <div key={i} className="flex gap-2">
          <Input className="w-1/3" placeholder="الخاصية (مثال: الوزن)" value={s.name} onChange={(e) => onChange(specs.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
          <Input className="flex-1" placeholder="القيمة (مثال: ٥٠٠ جم)" value={s.value} onChange={(e) => onChange(specs.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} />
          <Button type="button" size="icon" variant="ghost" aria-label="حذف الخاصية" onClick={() => onChange(specs.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
        </div>
      ))}
      <Button type="button" size="sm" variant="outline" onClick={() => onChange([...specs, { name: "", value: "" }])}>
        <Plus className="ml-1 h-3.5 w-3.5" /> إضافة خاصية
      </Button>
    </div>
  );
}

/** Image grouping chip: "عامة" or one of the colours. Optional by design. */
export function ImageGroupChips({ colors, value, onPick }: { colors: string[]; value: string; onPick: (color: string) => void }) {
  if (colors.length === 0) return <p className="mt-1 text-center text-[10px] text-muted-foreground">صورة عامة</p>;
  const opts = ["", ...colors];
  return (
    <div className="mt-1.5 flex flex-wrap justify-center gap-1">
      {opts.map((c) => {
        const active = norm(c) === norm(value);
        return (
          <button key={c || "_general"} type="button" onClick={() => onPick(c)}
            className={`rounded-full border px-2 py-0.5 text-[10px] font-medium transition ${active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:border-primary/60"}`}>
            {c || "عامة"}
          </button>
        );
      })}
    </div>
  );
}
