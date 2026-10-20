import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertCircle, ArrowRight, CheckCircle2, Crown, ExternalLink, ImageUp, Loader2, Phone, ShieldCheck } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { PageShell, PageHero, SurfaceCard } from "@/components/layout/page-shell";
import { getActivationStatus, submitPaymentReceipt } from "@/lib/activation.functions";

const RECEIPT_TYPES = ["image/jpeg", "image/png", "image/webp"];
const RECEIPT_MAX = 5 * 1024 * 1024;

/** One size for every control on this page: same height, radius and text weight. */
const FIELD =
  "h-12 w-full rounded-xl border border-border bg-card px-4 text-sm font-bold outline-none focus:border-primary";
const BTN =
  "flex h-12 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold transition-colors";

function StepHeader({ n, title }: { n: string; title: string }) {
  return (
    <header className="flex items-center gap-3 border-b border-border px-5 py-4">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-extrabold text-primary">
        {n}
      </span>
      <h2 className="text-sm font-extrabold">{title}</h2>
    </header>
  );
}

function ReceiptSection({ phone, receiptStatus }: {
  phone: string;
  receiptStatus: "pending_review" | "rejected" | "approved" | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const pending = done || receiptStatus === "pending_review" || receiptStatus === "approved";
  const rejected = receiptStatus === "rejected";

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!RECEIPT_TYPES.includes(f.type)) { setError("نوع الملف غير مدعوم. الصور المسموح بها: JPG وPNG وWebP فقط."); return; }
    if (f.size > RECEIPT_MAX) { setError("حجم الصورة يتجاوز 5 ميجابايت."); return; }
    setError(null);
    setFile(f);
    const reader = new FileReader();
    reader.onload = () => setPreview(String(reader.result));
    reader.readAsDataURL(f);
  };

  const onSubmit = async () => {
    if (!file || !preview) { setError("يرجى اختيار صورة إيصال التحويل قبل الإرسال."); return; }
    setSending(true);
    setError(null);
    try {
      await submitPaymentReceipt({ data: { dataUrl: preview, fileName: file.name, phone } });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "تعذّر إرسال الإيصال، حاول مرة أخرى.");
    } finally {
      setSending(false);
    }
  };

  return (
    <SurfaceCard>
      <StepHeader n="٢" title="إثبات الدفع" />
      <div className="space-y-3 p-5">
        {pending ? (
          <div className="flex items-start gap-2 rounded-xl bg-dashboard-green-soft p-4 text-sm font-semibold leading-relaxed text-dashboard-green">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            تم استلام إيصالك — قيد المراجعة. سيتم مراجعة التحويل وتفعيل اشتراكك بعد التأكد من وصول المبلغ.
          </div>
        ) : (
          <>
            {rejected && (
              <div className="flex items-start gap-2 rounded-xl bg-dashboard-amber-soft p-4 text-sm font-semibold leading-relaxed text-dashboard-amber">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                تم رفض الإيصال السابق. يرجى مراجعة التحويل ورفع صورة إيصال جديدة.
              </div>
            )}
            <p className="text-sm leading-relaxed text-muted-foreground">
              بعد تحويل المبلغ، ارفع صورة إيصال التحويل لإرسال طلب تفعيل اشتراكك.
            </p>
            <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onPick} />
            {preview && (
              <img src={preview} alt="معاينة إيصال التحويل" className="mx-auto max-h-72 rounded-xl border border-border object-contain" />
            )}
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={sending}
              className={`${BTN} border border-dashed border-primary/50 bg-card text-primary hover:bg-primary/5`}
            >
              <ImageUp className="h-4 w-4" />
              {preview ? "تغيير الصورة" : "اختيار صورة"}
            </button>
            <p className="text-center text-xs text-muted-foreground">JPG أو PNG أو WebP — حتى 5 ميجابايت</p>
            {error && <p className="text-center text-xs font-semibold text-destructive">{error}</p>}
            <button
              type="button"
              onClick={onSubmit}
              disabled={sending || !file}
              className={`${BTN} bg-primary text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground`}
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              تم الدفع — إرسال الإيصال
            </button>
          </>
        )}
      </div>
    </SurfaceCard>
  );
}

const INSTAPAY_URL = "https://ipn.eg/S/cupai/instapay/9AjTZi";
const AMOUNT = "299";

export const Route = createFileRoute("/subscribe")({
  head: () => ({ meta: [
    { title: "الاشتراك · cupai" },
    { name: "description", content: "ادفع 299 جنيهًا عبر انستا باي لتفعيل اشتراكك." },
    { property: "og:title", content: "الاشتراك · cupai" },
    { property: "og:description", content: "ادفع عبر انستا باي وسيتم تفعيل اشتراكك." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex" },
  ] }),
  component: SubscribePage,
});

function SubscribePage() {
  const fetchActivation = useServerFn(getActivationStatus);
  const activation = useQuery({ queryKey: ["activation-status"], queryFn: () => fetchActivation() });
  const [phone, setPhone] = useState(() => {
    try { return localStorage.getItem("cupai_pay_phone") ?? ""; } catch { return ""; }
  });
  const phoneValid = /^01[0-9]{9}$/.test(phone.trim());

  const onPayClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!phoneValid) {
      e.preventDefault();
      toast.error("أدخل رقم موبايل صحيح (11 رقمًا يبدأ بـ 01)");
      return;
    }
    try { localStorage.setItem("cupai_pay_phone", phone.trim()); } catch { /* ignore */ }
  };

  return (
    <PageShell>
      <PageHero eyebrow="الاشتراك" icon={<Crown className="h-3.5 w-3.5" />} title="ابدأ الآن بـ 299 جنيهًا" />

      <div className="hub-dashboard space-y-5">
        <SurfaceCard>
          <StepHeader n="١" title="الدفع عبر انستا باي" />
          <div className="space-y-4 p-5">
            <div className="space-y-2">
              <p className="text-center text-sm font-extrabold text-foreground">
                أرسل {AMOUNT} جنيه مصري فقط لا غير
              </p>
              <label htmlFor="pay-phone" className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
                <Phone className="h-3.5 w-3.5 text-primary" />
                رقم موبايلك
              </label>
              <input
                id="pay-phone"
                type="tel"
                inputMode="numeric"
                dir="ltr"
                maxLength={11}
                placeholder="أدخل رقم هاتفك"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 11))}
                className={`${FIELD} text-center`}
              />
              {phone.length > 0 && !phoneValid && (
                <p className="text-xs font-semibold text-dashboard-amber">أدخل 11 رقمًا يبدأ بـ 01.</p>
              )}
            </div>

            <a
              href={INSTAPAY_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onPayClick}
              aria-disabled={!phoneValid}
              className={`${BTN} ${
                phoneValid
                  ? "bg-primary text-primary-foreground hover:opacity-90"
                  : "cursor-not-allowed bg-muted text-muted-foreground"
              }`}
            >
              <ExternalLink className="h-4 w-4" />
              ادفع الآن عبر انستا باي
            </a>
          </div>
        </SurfaceCard>

        <ReceiptSection phone={phone} receiptStatus={activation.data?.receiptStatus ?? null} />

        <SurfaceCard>
          <ul className="divide-y divide-border">
            <li className="flex items-start gap-3 px-5 py-3.5 text-sm font-semibold leading-relaxed">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              أرسل المبلغ عبر الرابط الرسمي في هذه الصفحة فقط.
            </li>
            <li className="flex items-start gap-3 px-5 py-3.5 text-sm font-semibold leading-relaxed">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-dashboard-amber" />
              لن يطلب منك Cupai أبدًا كلمة المرور أو الرقم السري لـ InstaPay.
            </li>
          </ul>
        </SurfaceCard>

        <Link to="/account" className="flex items-center justify-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground">
          <ArrowRight className="h-4 w-4" />
          العودة إلى حسابي
        </Link>
      </div>
    </PageShell>
  );
}
