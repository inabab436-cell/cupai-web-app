import { useId, useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, CheckCircle2, Loader2, Phone, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { requestTeamUpload } from "@/lib/team-upload.functions";
import { teamUploadRequestSchema } from "@/lib/team-upload-request";

export function TeamUploadService() {
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const id = useId();
  const send = useServerFn(requestTeamUpload);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setError("");
    const parsed = teamUploadRequestSchema.safeParse({ phone });
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "راجع رقم الهاتف."); return; }
    setBusy(true);
    try {
      const result = await send({ data: parsed.data });
      if (result.ok) setSuccess(result.message);
      else setError(result.message);
    } catch { setError("لم يتم إرسال الطلب. حاول مرة أخرى."); }
    finally { setBusy(false); }
  };

  return (
    <section aria-label="خدمة رفع المنتجات بواسطة فريقنا" className="border-y border-border bg-accent/40 px-4 py-6 text-right sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Upload className="mt-1 h-6 w-6 shrink-0 text-primary" />
          <div>
            <h2 className="text-lg font-bold">فريقنا يرفع منتجاتك بدلًا منك</h2>
            <p className="mt-1 text-sm leading-7 text-muted-foreground">لا تحتاج لرفع الصور وكتابة التفاصيل بنفسك. اترك رقمك لنتواصل معك ونحدّد التكلفة بعد معرفة المطلوب.</p>
          </div>
        </div>
        <Button className="shrink-0" onClick={() => setOpen(true)}>اطلب مساعدة فريقنا <ArrowLeft className="h-4 w-4" /></Button>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir="rtl" className="hub max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto rounded-lg text-right">
          <DialogHeader className="pt-3 text-right sm:text-right">
            <DialogTitle className="leading-7">دع فريقنا يجهّز منتجاتك</DialogTitle>
            <DialogDescription className="leading-7">نساعدك في رفع صور المنتجات وكتابة تفاصيلها، بدلًا من القيام بذلك بنفسك.</DialogDescription>
          </DialogHeader>
          <ol className="space-y-3 border-y border-border py-4 text-sm leading-7">
            <li>١. اترك رقم الهاتف الذي يمكننا التواصل معك عليه.</li>
            <li>٢. يتواصل معك مسؤول من فريقنا لمعرفة عدد المنتجات والصور والتفاصيل المطلوبة.</li>
            <li>٣. نحدّد التكلفة بعد الاتفاق على المطلوب، وقبل بدء الرفع.</li>
          </ol>
          <p className="text-xs leading-6 text-muted-foreground">هذه خدمة إضافية؛ إرسال الطلب لا يلزمك بالدفع ولا يبدأ العمل تلقائيًا.</p>
          {success ? <div role="status" className="flex items-start gap-2 text-sm leading-7"><CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-primary" /><p>{success}</p></div> : (
            <form onSubmit={submit} className="space-y-3" noValidate>
              <Label htmlFor={id}>رقم هاتفك للتواصل</Label>
              <Input id={id} type="tel" inputMode="tel" autoComplete="tel" dir="ltr" maxLength={30} value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="رقم الهاتف" required aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} disabled={busy} />
              <p className="text-xs text-muted-foreground">سيُستخدم رقمك للتواصل بشأن خدمة رفع المنتجات.</p>
              {error && <p id={`${id}-error`} role="alert" className="text-sm text-destructive">{error}</p>}
              <Button type="submit" disabled={busy} className="w-full">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Phone className="h-4 w-4" />}{busy ? "جارٍ الإرسال…" : "اطلب التواصل معي"}</Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}