import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Ban, LogIn, LogOut, Pencil, Plus, Search, Trash2, CheckCircle2, ReceiptText, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  adminLogout, adminStatus, createMerchant, deleteMerchant,
  getPaymentReceiptUrl, impersonateMerchant, listMerchants, reviewPaymentReceipt,
  updateMerchant, type AdminMerchant,
  listTeamUploadRequests,
} from "@/lib/admin.functions";
import type { TeamUploadRequest } from "@/lib/team-upload-request";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "إدارة التجار · Cupai" },
      { name: "description", content: "لوحة إدارة حسابات التجار في Cupai." },
      { property: "og:title", content: "إدارة التجار · Cupai" },
      { property: "og:description", content: "لوحة إدارة خاصة." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  ssr: false,
  component: AdminPage,
});

const fmt = (d: string | null) =>
  d ? new Date(d).toLocaleString("ar-EG", { dateStyle: "medium", timeStyle: "short" }) : "—";

function AdminPage() {
  const status = useServerFn(adminStatus);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  useEffect(() => { status().then((s) => setSignedIn(s.signedIn)).catch(() => setSignedIn(false)); }, [status]);
  useEffect(() => { if (signedIn === false) window.location.replace("/login"); }, [signedIn]);
  if (!signedIn) return <div className="p-10 text-center text-muted-foreground">جارٍ التحميل…</div>;
  return <Console onOut={() => setSignedIn(false)} />;
}

function Console({ onOut }: { onOut: () => void }) {
  const listUploadRequests = useServerFn(listTeamUploadRequests);
  const [uploadRequests, setUploadRequests] = useState<TeamUploadRequest[]>([]);
  const [uploadError, setUploadError] = useState("");
  const loadUploadRequests = useCallback(() => {
    setUploadError("");
    listUploadRequests().then(setUploadRequests).catch(() => setUploadError("تعذّر عرض طلبات رفع المنتجات."));
  }, [listUploadRequests]);
  useEffect(loadUploadRequests, [loadUploadRequests]);
  const list = useServerFn(listMerchants);
  const logout = useServerFn(adminLogout);
  const update = useServerFn(updateMerchant);
  const del = useServerFn(deleteMerchant);
  const imp = useServerFn(impersonateMerchant);
  const [rows, setRows] = useState<AdminMerchant[]>([]);
  const [q, setQ] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [edit, setEdit] = useState<AdminMerchant | "new" | null>(null);
  const [receipt, setReceipt] = useState<AdminMerchant | null>(null);

  const load = useCallback(() => { list().then(setRows).catch((e) => setErr(e.message)); }, [list]);
  useEffect(load, [load]);

  const act = async (fn: () => Promise<unknown>) => {
    setErr(null);
    try { await fn(); load(); } catch (e) { setErr(e instanceof Error ? e.message : "خطأ"); }
  };

  const filtered = useMemo(
    () => rows.filter((r) => (r.email + r.name).toLowerCase().includes(q.toLowerCase())),
    [rows, q],
  );
  const subs = rows.filter((r) => r.subscribed).length;
  const pendingReceipts = rows.filter((r) => r.paymentReceiptStatus === "pending_review").length;

  return (
    <div dir="rtl" className="min-h-screen bg-muted/40">
      <header className="flex items-center justify-between border-b bg-card px-4 py-3">
        <h1 className="text-lg font-bold">إدارة التجار</h1>
        <Button variant="ghost" size="sm" onClick={async () => { await logout(); onOut(); }}>
          <LogOut className="ms-1 h-4 w-4" />خروج
        </Button>
      </header>
      <main className="mx-auto max-w-5xl space-y-4 p-4">
        <section className="border-b border-border pb-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="font-bold">طلبات رفع المنتجات بواسطة الفريق</h2>
            <Button size="sm" variant="outline" onClick={loadUploadRequests}>تحديث</Button>
          </div>
          <p className="mb-3 text-xs text-muted-foreground">أحدث 100 طلب تواصل؛ تُحدَّد التكلفة مع صاحب الطلب قبل بدء العمل.</p>
          {uploadError && <p role="alert" className="text-sm text-destructive">{uploadError}</p>}
          <div className="divide-y divide-border">
            {uploadRequests.map((request) => <div key={`${request.createdAt}-${request.phone}`} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
              <a href={`tel:${encodeURIComponent(request.phone)}`} dir="ltr" className="font-semibold text-primary underline underline-offset-4">{request.phone}</a>
              <span className="text-xs text-muted-foreground">{fmt(request.createdAt)}</span>
            </div>)}
          </div>
          {!uploadError && uploadRequests.length === 0 && <p className="text-sm text-muted-foreground">لا توجد طلبات تواصل بعد.</p>}
        </section>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="كل التجار" value={rows.length} />
          <Stat label="مشتركون" value={subs} />
          <Stat label="مقيّدون" value={rows.filter((r) => r.restricted).length} />
          <Stat label="إيصالات قيد المراجعة" value={pendingReceipts} />
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute end-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="بحث بالبريد أو الاسم" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Button onClick={() => setEdit("new")}><Plus className="ms-1 h-4 w-4" />إضافة</Button>
        </div>
        {err && <p className="text-sm text-destructive">{err}</p>}
        <div className="space-y-2">
          {filtered.map((m) => (
            <div key={m.id} className="rounded-xl border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold">{m.name || "بدون اسم"}</p>
                  <p dir="ltr" className="truncate text-end text-sm text-muted-foreground">{m.email}</p>
                  <p className="mt-1 text-xs text-muted-foreground">سجّل: {fmt(m.createdAt)} · آخر دخول: {fmt(m.lastSignInAt)}</p>
                </div>
                <div className="flex gap-1">
                  <Badge variant={m.subscribed ? "default" : "secondary"}>{m.subscribed ? "مشترك" : "غير مشترك"}</Badge>
                  {m.subscribed && m.subscriptionEndsAt && new Date(m.subscriptionEndsAt).getTime() <= Date.now() && (
                    <Badge variant="destructive">منتهي</Badge>
                  )}
                  {!m.subscribed && m.activationRequestedAt && <Badge variant="outline">طلب تفعيل · {fmt(m.activationRequestedAt)}</Badge>}
                  {m.paymentReceiptStatus === "pending_review" && (
                    <Badge variant="outline">إيصال قيد المراجعة · {fmt(m.paymentReceiptSubmittedAt)}</Badge>
                  )}
                  {m.restricted && <Badge variant="destructive">مقيّد</Badge>}
                </div>
              </div>
              {m.subscribed && m.subscriptionStartedAt && m.subscriptionEndsAt && (
                <p className="mt-1 text-xs text-muted-foreground">
                  الاشتراك: من {fmt(m.subscriptionStartedAt)} إلى {fmt(m.subscriptionEndsAt)}
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {m.paymentReceiptPath && (
                  <Button size="sm" variant="outline" onClick={() => setReceipt(m)}>
                    <ReceiptText className="ms-1 h-4 w-4" />عرض الإيصال
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => act(async () => { await imp({ data: { id: m.id } }); window.open("/dashboard", "_blank"); })}>
                  <LogIn className="ms-1 h-4 w-4" />دخول لحسابه
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEdit(m)}><Pencil className="ms-1 h-4 w-4" />تعديل</Button>
                <Button size="sm" variant="outline" onClick={() => act(() => update({ data: { id: m.id, subscribed: !m.subscribed } }))}>
                  <CheckCircle2 className="ms-1 h-4 w-4" />{m.subscribed ? "إلغاء الاشتراك" : "تفعيل الاشتراك"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => act(() => update({ data: { id: m.id, restricted: !m.restricted } }))}>
                  <Ban className="ms-1 h-4 w-4" />{m.restricted ? "رفع التقييد" : "تقييد"}
                </Button>
                <Button size="sm" variant="destructive" onClick={() => {
                  if (confirm(`حذف حساب ${m.email} نهائيًا؟`)) act(() => del({ data: { id: m.id } }));
                }}><Trash2 className="ms-1 h-4 w-4" />حذف</Button>
              </div>
            </div>
          ))}
          {!filtered.length && <p className="py-10 text-center text-muted-foreground">لا توجد حسابات.</p>}
        </div>
      </main>
      {edit && <EditDialog target={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); }} />}
      {receipt && (
        <ReceiptDialog
          merchant={receipt}
          onClose={() => setReceipt(null)}
          onDone={() => { setReceipt(null); load(); }}
        />
      )}
    </div>
  );
}

function ReceiptDialog({ merchant, onClose, onDone }: { merchant: AdminMerchant; onClose: () => void; onDone: () => void }) {
  const getUrl = useServerFn(getPaymentReceiptUrl);
  const review = useServerFn(reviewPaymentReceipt);
  const [url, setUrl] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getUrl({ data: { id: merchant.id } })
      .then((r) => setUrl(r.url))
      .catch((e) => setErr(e instanceof Error ? e.message : "تعذّر تحميل الإيصال."));
  }, [getUrl, merchant.id]);

  const decide = async (decision: "approve" | "reject") => {
    setErr(null);
    setBusy(true);
    try {
      await review({ data: { id: merchant.id, decision } });
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "خطأ");
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent dir="rtl" className="max-w-lg">
        <DialogHeader><DialogTitle>إيصال الدفع — {merchant.name || merchant.email}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            أُرسل: {fmt(merchant.paymentReceiptSubmittedAt)}
            {merchant.paymentPhone && <> · رقم التحويل: <span dir="ltr">{merchant.paymentPhone}</span></>}
          </p>
          {url ? (
            <a href={url} target="_blank" rel="noreferrer">
              <img src={url} alt="إيصال الدفع" className="max-h-96 w-full rounded-lg border object-contain" />
            </a>
          ) : (
            !err && <p className="py-10 text-center text-sm text-muted-foreground">جارٍ تحميل الصورة…</p>
          )}
          {err && <p className="text-sm text-destructive">{err}</p>}
          {merchant.paymentReceiptStatus === "pending_review" && (
            <DialogFooter className="gap-2">
              <Button disabled={busy} onClick={() => decide("approve")}>
                <CheckCircle2 className="ms-1 h-4 w-4" />تأكيد الدفع وتفعيل الاشتراك
              </Button>
              <Button disabled={busy} variant="destructive" onClick={() => decide("reject")}>
                <XCircle className="ms-1 h-4 w-4" />رفض الإيصال
              </Button>
            </DialogFooter>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border bg-card p-3 text-center">
      <p className="text-2xl font-bold">{value}</p><p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function EditDialog({ target, onClose, onSaved }: { target: AdminMerchant | "new"; onClose: () => void; onSaved: () => void }) {
  const create = useServerFn(createMerchant);
  const update = useServerFn(updateMerchant);
  const isNew = target === "new";
  const [name, setName] = useState(isNew ? "" : target.name);
  const [email, setEmail] = useState(isNew ? "" : target.email);
  const [password, setPassword] = useState("");
  const [subscribed, setSubscribed] = useState(isNew ? false : target.subscribed);
  const [err, setErr] = useState<string | null>(null);
  const save = async (e: FormEvent) => {
    e.preventDefault(); setErr(null);
    try {
      if (isNew) {
        await create({ data: { name, email, password } });
      } else {
        await update({ data: { id: target.id, name, email: email !== target.email ? email : undefined, password: password || undefined, subscribed } });
      }
      onSaved();
    } catch (x) { setErr(x instanceof Error ? x.message : "خطأ"); }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent dir="rtl">
        <DialogHeader><DialogTitle>{isNew ? "إضافة تاجر" : "تعديل الحساب"}</DialogTitle></DialogHeader>
        <form onSubmit={save} className="space-y-3">
          <div className="space-y-1.5"><Label>الاسم</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>البريد</Label><Input dir="ltr" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>{isNew ? "كلمة المرور" : "كلمة مرور جديدة (اختياري)"}</Label>
            <Input dir="ltr" type="password" required={isNew} minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} /></div>
          {!isNew && <div className="flex items-center justify-between"><Label>مشترك</Label><Switch checked={subscribed} onCheckedChange={setSubscribed} /></div>}
          {err && <p className="text-sm text-destructive">{err}</p>}
          <DialogFooter><Button type="submit">حفظ</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
