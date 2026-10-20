import { ImagePlus, X } from "lucide-react";
import { norm } from "@/lib/variant-matrix";

export type BoardImage = { key: string; url: string; group: string; onRemove: () => void };

/** Images grouped into boxes: "صور عامة" + one box per colour. Upload straight into a box. */
export function ImageBoard({
  colors, items, onAdd, onMove,
}: {
  colors: string[];
  items: BoardImage[];
  onAdd: (files: FileList | null, group: string) => void;
  onMove: (key: string, group: string) => void;
}) {
  const groups = ["", ...colors];
  return (
    <div className="space-y-3">
      {groups.map((g) => {
        const list = items.filter((i) => norm(i.group) === norm(g) || (g === "" && !colors.some((c) => norm(c) === norm(i.group))));
        return (
          <div key={g || "_general"} className="rounded-xl border border-border bg-card p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-bold">{g ? `صور اللون ${g}` : "صور عامة للمنتج"}</p>
              <span className="text-xs text-muted-foreground">{list.length} صورة</span>
            </div>
            {!g && <p className="mb-2 text-xs text-muted-foreground">تظهر مع كل الألوان.{colors.length ? " ولو عندك صور لكل لون حطها في مربع اللون تحت." : ""}</p>}
            <div className="flex flex-wrap gap-2">
              {list.map((img) => (
                <div key={img.key} className="w-24 space-y-1">
                  <div className="relative">
                    <img src={img.url} alt="" className="h-24 w-24 rounded-lg object-cover" />
                    <button type="button" aria-label="حذف الصورة" onClick={img.onRemove}
                      className="absolute left-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-destructive text-destructive-foreground">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {colors.length > 0 && (
                    <select aria-label="نقل الصورة" value={colors.find((c) => norm(c) === norm(img.group)) ?? ""}
                      onChange={(e) => onMove(img.key, e.target.value)}
                      className="h-8 w-full rounded-md border border-border bg-background px-1 text-[11px]">
                      <option value="">نقل: عامة</option>
                      {colors.map((c) => <option key={c} value={c}>نقل: {c}</option>)}
                    </select>
                  )}
                </div>
              ))}
              <label className="grid h-24 w-24 cursor-pointer place-items-center rounded-lg border-2 border-dashed border-border text-center text-xs text-muted-foreground transition hover:border-primary hover:text-primary">
                <span className="flex flex-col items-center gap-1"><ImagePlus className="h-6 w-6" />إضافة صور</span>
                <input type="file" accept="image/*" multiple className="hidden"
                  onChange={(e) => { onAdd(e.target.files, g); e.currentTarget.value = ""; }} />
              </label>
            </div>
          </div>
        );
      })}
    </div>
  );
}
