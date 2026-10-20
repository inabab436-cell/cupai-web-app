import { useEffect, useRef, useState } from "react";
import { Check, LockKeyhole, MousePointer2, Pause, Play, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import tshirt from "@/assets/brand-tshirt.jpg";
import jeans from "@/assets/brand-jeans.jpg";
import sneakers from "@/assets/brand-sneakers.jpg";

const PRODUCTS = [
  { name: "تيشيرت قطن كلاسيك", category: "ESSENTIALS", price: 450, image: tshirt, alt: "تيشيرت أبيض قطني حقيقي", sizes: ["S", "M", "L", "XL"] },
  { name: "جينز أزرق", category: "EVERYDAY DENIM", price: 850, image: jeans, alt: "بنطلون جينز أزرق حقيقي", sizes: ["30", "32", "34", "36"] },
  { name: "سنيكرز يومي", category: "STREET EDIT", price: 1200, image: sneakers, alt: "حذاء رياضي حقيقي باللون البرتقالي", sizes: ["40", "41", "42", "43"] },
];

export function StorefrontShowcase() {
  const [playing, setPlaying] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [sizes, setSizes] = useState(["S", "30", "40"]);
  const [count, setCount] = useState(0);
  const [added, setAdded] = useState<number | null>(null);
  const [bagOpen, setBagOpen] = useState(false);
  const [cursorVisible, setCursorVisible] = useState(false);
  const [pressing, setPressing] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Array<HTMLElement | null>>([]);
  const sizeRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const buyRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => { setReducedMotion(media.matches); };
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const addProduct = (index: number) => {
    setCount((previous) => previous + 1);
    setAdded(index);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setAdded(null), 1200);
  };

  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  useEffect(() => {
    if (!playing || reducedMotion) { setCursorVisible(false); return; }
    const timers: Array<ReturnType<typeof setTimeout>> = [];
    let stopped = false;
    const schedule = (action: () => void, delay: number) => {
      timers.push(setTimeout(() => { if (!stopped) action(); }, delay));
    };
    const moveCursor = (element: HTMLElement | null) => {
      const stage = stageRef.current;
      const cursor = cursorRef.current;
      if (!stage || !cursor || !element) return;
      const bounds = stage.getBoundingClientRect();
      const target = element.getBoundingClientRect();
      cursor.style.transform = `translate(${target.left - bounds.left + target.width * 0.55}px, ${target.top - bounds.top + target.height * 0.65}px)`;
      setCursorVisible(true);
    };
    const cycle = () => {
      setCount(0);
      setBagOpen(false);
      setSizes(["S", "30", "40"]);
      PRODUCTS.forEach((product, index) => {
        const start = index * 4000;
        schedule(() => {
          setCursorVisible(false);
          const card = cardRefs.current[index];
          const track = trackRef.current;
          if (card && track) track.scrollTo({ left: card.offsetLeft - track.offsetLeft, behavior: "smooth" });
        }, start + 200);
        schedule(() => moveCursor(sizeRefs.current[index]), start + 850);
        schedule(() => {
          setPressing(true);
          setSizes((previous) => previous.map((size, i) => i === index ? product.sizes[1] : size));
        }, start + 1550);
        schedule(() => { setPressing(false); moveCursor(buyRefs.current[index]); }, start + 1800);
        schedule(() => { setPressing(true); addProduct(index); }, start + 2550);
        schedule(() => setPressing(false), start + 2800);
        schedule(() => setCursorVisible(false), start + 3550);
      });
      schedule(cycle, 13200);
    };
    schedule(cycle, 600);
    return () => { stopped = true; timers.forEach(clearTimeout); setPressing(false); };
  }, [playing, reducedMotion]);

  const takeControl = () => { setPlaying(false); setCursorVisible(false); };

  return (
    <div className="homepage-showcase mx-auto mt-9 max-w-5xl text-right sm:mt-12">
      <div className="mb-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-2"><span className="showcase-live-dot" /> متجرك، كما يراه عملاؤك</span>
        <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2 text-xs" aria-label={playing && !reducedMotion ? "إيقاف العرض المتحرك" : "تشغيل العرض المتحرك"} disabled={reducedMotion} onClick={() => setPlaying(!playing)}>
          {playing && !reducedMotion ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />} <span>عرض تجريبي</span>
        </Button>
      </div>
      <div className="showcase-browser overflow-hidden rounded-lg border border-border bg-card">
        <div dir="ltr" className="flex h-10 items-center justify-between border-b border-border bg-muted/60 px-3 sm:px-5">
          <div className="flex gap-1.5" aria-hidden="true"><i className="showcase-window-dot" /><i className="showcase-window-dot" /><i className="showcase-window-dot" /></div>
          <span className="flex items-center gap-2 text-[10px] text-muted-foreground sm:text-xs"><LockKeyhole className="h-3 w-3" /> cupai.app / brand</span>
          <div className="w-8" />
        </div>
        <div ref={stageRef} className="store showcase-store relative">
          <header className="flex h-16 items-center justify-between border-b border-border px-4 sm:h-20 sm:px-7">
            <div className="flex items-baseline gap-2"><span className="showcase-brand text-2xl font-extrabold sm:text-3xl">براند</span><span className="text-[10px] text-muted-foreground" lang="en">BRAND</span></div>
            <span className="hidden text-xs text-muted-foreground sm:block">تفاصيل بسيطة. ستايل مختلف.</span>
            <Button variant="ghost" size="icon" className="relative h-10 w-10" aria-label="سلة العرض التجريبي" aria-expanded={bagOpen} onClick={() => { takeControl(); setBagOpen(!bagOpen); }}>
              <ShoppingBag className="h-5 w-5" />
              {count > 0 && <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-primary text-[10px] text-primary-foreground" aria-live="polite">{count}</span>}
            </Button>
          </header>
          <div className="flex items-end justify-between px-4 pb-4 pt-5 sm:px-7 sm:pt-6">
            <div><p className="mb-1 text-[10px] text-muted-foreground" lang="en">THE EVERYDAY COLLECTION</p><h2 className="text-lg font-bold sm:text-2xl">اختياراتك اليومية</h2></div>
            <span className="text-[10px] text-muted-foreground sm:text-xs">٣ منتجات</span>
          </div>
          <div ref={trackRef} dir="ltr" className="showcase-product-track">
            {PRODUCTS.map((product, index) => (
              <article key={product.name} ref={(element) => { cardRefs.current[index] = element; }} dir="rtl" className="showcase-product">
                <div className="showcase-product-image overflow-hidden bg-muted"><img src={product.image} alt={product.alt} width="600" height="650" className="h-full w-full object-cover" /></div>
                <div className="pb-1 pt-3">
                  <p className="text-[9px] text-muted-foreground" lang="en">{product.category}</p>
                  <h3 className="mt-1 text-sm font-semibold sm:text-base">{product.name}</h3>
                  <p className="mt-1 text-sm font-bold tabular-nums">{product.price.toLocaleString("en-US")} <span className="text-[11px] font-normal text-muted-foreground">جنيه</span></p>
                  <div className="mb-3 mt-3 flex items-center gap-1.5" role="group" aria-label={`مقاس ${product.name}`}>
                    <span className="me-1 text-[10px] text-muted-foreground">المقاس</span>
                    {product.sizes.map((size, sizeIndex) => (
                      <Button key={size} ref={(element) => { if (sizeIndex === 1) sizeRefs.current[index] = element; }} variant="outline" size="sm" aria-pressed={sizes[index] === size} className={`h-7 min-w-7 rounded-none px-1.5 text-[10px] ${sizes[index] === size ? "border-primary bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground" : ""}`} onClick={() => { takeControl(); setSizes((previous) => previous.map((old, i) => i === index ? size : old)); }}>{size}</Button>
                    ))}
                  </div>
                  <Button ref={(element) => { buyRefs.current[index] = element; }} className={`h-9 w-full gap-2 rounded-none text-xs ${added === index ? "showcase-buy-added" : ""}`} onClick={() => { takeControl(); addProduct(index); }}>
                    {added === index ? <><Check className="h-3.5 w-3.5" /> تمت الإضافة</> : <>شراء الآن <ShoppingBag className="h-3.5 w-3.5" /></>}
                  </Button>
                </div>
              </article>
            ))}
          </div>
          <div className="flex justify-center gap-1.5 py-4 sm:hidden" aria-hidden="true">{PRODUCTS.map((product) => <span key={product.name} className="h-1 w-5 bg-border" />)}</div>
          <div ref={cursorRef} aria-hidden="true" className={`showcase-cursor ${cursorVisible ? "is-visible" : ""} ${pressing ? "is-pressing" : ""}`}><MousePointer2 className="h-7 w-7 fill-primary-foreground text-primary" strokeWidth={1.7} /><span className="showcase-click-ring" /></div>
          {added !== null && <div role="status" className="showcase-toast pointer-events-none absolute bottom-16 left-1/2 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap border border-border bg-card px-4 py-2 text-xs shadow-card"><Check className="h-4 w-4" /> تمت الإضافة</div>}
          {bagOpen && <div className="absolute inset-x-4 top-16 z-10 border border-border bg-card p-4 text-sm shadow-card" role="status">{count ? `السلة: ${count} قطع` : "السلة فارغة"}</div>}
          <footer className="hidden border-t border-border px-7 py-3 text-center text-[10px] text-muted-foreground sm:block">براند — اختيارات تشبهك</footer>
        </div>
      </div>
    </div>
  );
}