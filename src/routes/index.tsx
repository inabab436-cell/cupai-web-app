import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Check, CreditCard, Link2, Package, ShoppingBag, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CupaiLogo } from "@/components/cupai-logo";
import { getSessionInfo } from "@/lib/auth.functions";
import { StorefrontShowcase } from "@/components/homepage/storefront-showcase";
import { TeamUploadService } from "@/components/team-upload-service";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Cupai — متجرك الإلكتروني بـ 299 جنيه مصري شهريًا" },
      { name: "description", content: "اعرض منتجاتك في متجر برابط خاص، واستقبل طلبات عملائك وتابع الدفع والتوصيل. اشتراك Cupai بـ 299 جنيه مصري شهريًا." },
      { property: "og:title", content: "Cupai — متجر لمنتجاتك وطلباتك" },
      { property: "og:description", content: "من اختيار المنتج إلى تسليم الطلب: متجر لعملائك ومكان واحد لإدارة البيع، بـ 299 جنيه مصري شهريًا." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const JOURNEY = [
  { icon: Package, title: "أنت تضيف منتجاتك", text: "ارفع الصور، واكتب السعر والمقاسات والكميات المتاحة.", role: "أنت", tone: "bg-dashboard-blue-soft text-dashboard-blue" },
  { icon: ShoppingBag, title: "العميل يطلب من متجرك", text: "يختار المنتجات ويكتب اسمه ورقمه وعنوانه، ثم يختار طريقة الدفع التي أعددتها.", role: "العميل", tone: "bg-dashboard-green-soft text-dashboard-green" },
  { icon: CreditCard, title: "أنت تراجع الطلب والدفع", text: "يصلك الطلب ببياناته. تستلم المبلغ مباشرة، وتؤكد الدفع بعد مراجعته.", role: "أنت", tone: "bg-dashboard-amber-soft text-dashboard-amber" },
  { icon: Truck, title: "أنت تجهّز وتسلّم الطلب", text: "تحدّث حالة الطلب أثناء التجهيز والتوصيل، والعميل يتابع طلبه من متجرك.", role: "أنت والعميل", tone: "bg-dashboard-rose-soft text-dashboard-rose" },
];
const INCLUDED = ["متجر برابط خاص باسمك", "صور المنتجات والأسعار والمقاسات", "استقبال الطلبات وبيانات العملاء", "عرض طرق الدفع وبيانات التحويل", "متابعة حالة الطلب حتى التسليم", "تحديد مناطق الشحن وأسعارها", "إضافة عروض وخصومات على المنتجات"];
const PAYMENT_METHODS = [
  { title: "دفع أونلاين (تحويل أو محفظة)", text: "أنت تحدّد طريقة الدفع وبياناتها (رقم إنستا باي، محفظة، أو حساب بنكي) والمبلغ المطلوب من العميل: كاملًا أو نسبة أو مبلغًا ثابتًا. العميل يحوّل المبلغ ويرسل صورة الإيصال، وأنت تراجعه قبل تجهيز الطلب." },
  { title: "الدفع عند الاستلام", text: "العميل لا يدفع شيئًا عند الطلب. المبلغ كاملًا يُحصَّل نقدًا عند تسليم الطلب له. اختيار هذه الطريقة لا يعني أن العميل دفع، والطلب يبقى غير مدفوع حتى تسليمه." },
];
const QUESTIONS = [
  { question: "كيف يتواصل العميل معي؟", answer: "من زر الدردشة داخل متجرك: العميل يكتب سؤاله أو يرسل صورة إيصال الدفع، وتصلك رسالته في لوحة التاجر، وترد عليه من هناك. تظهر لك رسالة بعدد غير مقروء حتى لا تفوّتها." },
  { question: "متى أضغط «تأكيد الدفع»؟", answer: "فقط بعد أن تتحقق بنفسك من وصول المبلغ فعليًا (ظهور التحويل في محفظتك أو حسابك). قبل التأكيد يظهر الطلب بحالة «بانتظار الدفع»، وبعد التأكيد يتحول إلى «مدفوع» وتجهّزه." },
  { question: "هل العميل يحتاج إلى حساب ليشتري؟", answer: "لا. يختار منتجاته ويكتب بياناته ويُرسل الطلب من متجرك مباشرة." },
  { question: "ما الفرق بين تسجيل الطلب وتأكيد الدفع؟", answer: "تسجيل الطلب يعني وصول المنتجات المطلوبة وبيانات العميل إليك. أما تأكيد الدفع فتقوم به أنت بعد التحقق من استلام المبلغ؛ تسجيل الطلب وحده لا يعني أن العميل دفع." },
  { question: "من يستلم أموال العملاء؟", answer: "أنت تستلم الأموال مباشرة بالطريقة التي تحددها. Cupai تعرض للعميل بيانات الدفع والمبلغ المطلوب، ولا تستلم الأموال نيابةً عنك." },
  { question: "كيف يتابع العميل طلبه؟", answer: "من زر «تتبع طلبي» في متجرك. تظهر له حالة الطلب التي تحدّثها، من التجهيز حتى التسليم." },
  { question: "هل Cupai تقوم بتوصيل الطلبات؟", answer: "أنت تتولى التوصيل أو تتفق مع شركة شحن. في Cupai تحدد مناطق الشحن وتكلفة كل منطقة وتتابع حالة الطلب." },
];

function Index() {
  const fetchSession = useServerFn(getSessionInfo);
  const [showLanding, setShowLanding] = useState(false);
  useEffect(() => {
    fetchSession()
      .then((res) => (res.email ? window.location.replace("/dashboard") : setShowLanding(true)))
      .catch(() => setShowLanding(true));
  }, [fetchSession]);
  if (!showLanding) return <div className="hub min-h-screen bg-background" />;
  const toLogin = () => window.location.assign("/login");

  return (
    <div dir="rtl" className="hub hub-dashboard min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <CupaiLogo />
          <nav aria-label="الصفحة الرئيسية" className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <a href="#selling" className="transition hover:text-foreground">كيف تبيع؟</a>
            <a href="#pricing" className="transition hover:text-foreground">الاشتراك</a>
            <a href="#questions" className="transition hover:text-foreground">أسئلة شائعة</a>
          </nav>
          <Button variant="outline" size="sm" onClick={toLogin}>تسجيل الدخول</Button>
        </div>
      </header>
      <main>
        <section className="mx-auto max-w-6xl px-4 pb-12 pt-9 text-center sm:px-6 sm:pt-14">
          <p className="text-sm font-semibold text-primary">لأصحاب المتاجر والبراندات</p>
          <h1 className="mt-3 text-3xl font-extrabold leading-tight sm:text-5xl">Cupai — متجرك الإلكتروني</h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-8 text-muted-foreground sm:text-lg">اعرض منتجاتك في رابط واحد يشتري منه عملاؤك.<br className="hidden sm:block" /> وتابع الطلبات والدفع والتوصيل من مكان واحد.</p>
          <div className="mt-6 flex flex-col items-center gap-3">
            <Button size="lg" className="w-full rounded-lg px-8 sm:w-auto" onClick={toLogin}>أنشئ متجرك <ArrowLeft className="h-4 w-4" /></Button>
            <p className="text-sm text-muted-foreground"><strong className="font-semibold text-foreground">299 جنيه مصري</strong> شهريًا</p>
          </div>
          <StorefrontShowcase />
        </section>

        <TeamUploadService />

        <section id="selling" className="scroll-mt-20 border-y border-border bg-card">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
            <div className="mb-8"><p className="text-sm font-semibold text-primary">من المنتج إلى التسليم</p><h2 className="mt-2 text-2xl font-bold sm:text-3xl">كيف تتم عملية البيع؟</h2></div>
            <ol className="grid gap-7 sm:grid-cols-2 lg:grid-cols-4">
              {JOURNEY.map(({ icon: Icon, title, text, role, tone }, index) => (
                <li key={title} className="border-t border-border pt-5">
                  <div className="flex items-center justify-between"><span className={`grid h-11 w-11 place-items-center rounded-lg ${tone}`}><Icon className="h-5 w-5" /></span><span className="text-sm font-semibold text-muted-foreground">0{index + 1}</span></div>
                  <p className="mt-5 text-xs font-semibold text-muted-foreground">{role}</p>
                  <h3 className="mt-1 text-lg font-bold">{title}</h3>
                  <p className="mt-2 text-sm leading-7 text-muted-foreground">{text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 sm:py-16 md:grid-cols-2 md:gap-16">
          <div>
            <Link2 className="mb-4 h-6 w-6 text-primary" />
            <h2 className="text-2xl font-bold">متجر لعملائك.<br />وإدارة الطلبات لك.</h2>
            <p className="mt-4 max-w-md text-sm leading-7 text-muted-foreground">شارك رابط متجرك على صفحاتك. العميل يرى المنتجات ويطلب، وأنت ترى الطلب كاملًا وتتابع ما يحتاجه حتى يصل إليه.</p>
          </div>
          <div className="divide-y divide-border">
            <div className="pb-6"><h3 className="text-base font-bold">ما يراه العميل</h3><p className="mt-2 text-sm leading-7 text-muted-foreground">صور وأسعار ومقاسات، سلة شراء، بيانات الدفع، وزر لمتابعة طلبه.</p></div>
            <div className="pt-6"><h3 className="text-base font-bold">ما تديره أنت</h3><p className="mt-2 text-sm leading-7 text-muted-foreground">منتجاتك وكمياتها، بيانات العملاء، تأكيد الدفع، وحالة كل طلب ومصاريف شحنه.</p></div>
          </div>
        </section>

        <section id="pricing" className="scroll-mt-20 border-y border-border bg-card">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 sm:py-16 md:grid-cols-2 md:gap-16">
            <div><p className="text-sm font-semibold text-primary">اشتراك واضح</p><h2 className="mt-2 text-2xl font-bold sm:text-3xl">باقة واحدة لمتجرك</h2><div className="mt-6 flex flex-wrap items-baseline gap-x-3 gap-y-1"><span className="text-5xl font-extrabold tabular-nums">299</span><span className="text-lg font-semibold">جنيه مصري <span className="text-muted-foreground">/ شهريًا</span></span></div><p className="mt-4 text-sm leading-7 text-muted-foreground">اشتراك شهري في Cupai لإدارة متجرك.<br />أموال مبيعاتك تستلمها أنت مباشرة من عملائك.</p><Button size="lg" onClick={toLogin} className="mt-6 w-full rounded-lg sm:w-auto">ابدأ متجرك <ArrowLeft className="h-4 w-4" /></Button></div>
            <ul className="space-y-4 md:pt-2">{INCLUDED.map((item) => <li key={item} className="flex items-start gap-3 text-sm leading-6"><Check className="mt-0.5 h-5 w-5 shrink-0 text-dashboard-green" />{item}</li>)}</ul>
          </div>
        </section>

        <section id="questions" className="mx-auto max-w-3xl scroll-mt-20 px-4 py-12 sm:px-6 sm:py-16">
          <h2 className="mb-6 text-2xl font-bold">أسئلة قبل أن تبدأ</h2>
          <div className="divide-y divide-border">{QUESTIONS.map(({ question, answer }) => <details key={question} className="group py-5"><summary className="cursor-pointer text-base font-semibold leading-7 marker:text-primary">{question}</summary><p className="mt-3 text-sm leading-7 text-muted-foreground">{answer}</p></details>)}</div>
        </section>
      </main>
      <footer className="border-t border-border bg-card px-4 py-6 text-xs text-muted-foreground">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3"><span>© Cupai</span><a href="mailto:support.cupai@gmail.com" className="underline underline-offset-4 hover:text-foreground">support.cupai@gmail.com</a></div>
      </footer>
    </div>
  );
}
