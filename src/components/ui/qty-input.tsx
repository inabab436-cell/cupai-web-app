import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";

/**
 * Quantity box the user can clear and retype freely. The number is only
 * committed (minimum `min`) while typing a valid value or when leaving the box.
 */
export function QtyInput({
  value, onChange, min = 1, className,
}: { value: number; onChange: (n: number) => void; min?: number; className?: string }) {
  const [text, setText] = useState(String(value));
  useEffect(() => { setText(String(value)); }, [value]);
  return (
    <Input
      type="text" inputMode="numeric" className={className} value={text}
      onChange={(e) => {
        const raw = e.target.value.replace(/[^\d٠-٩]/g, "").replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
        setText(raw);
        const n = Number(raw);
        if (raw !== "" && n >= min) onChange(Math.floor(n));
      }}
      onBlur={() => {
        const n = Number(text);
        const v = text !== "" && n >= min ? Math.floor(n) : Math.max(min, value);
        setText(String(v));
        if (v !== value) onChange(v);
      }}
    />
  );
}
