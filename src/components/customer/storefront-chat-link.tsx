import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { MessageSquare } from "lucide-react";
import { getChatConfig } from "@/lib/chat-config.functions";
import { chatReadKey, countUnreadReplies, type IncomingChatMessage } from "@/lib/customer-chat-unread";
import { t } from "@/lib/store-i18n";

export function StorefrontChatLink({ slug, merchantId }: { slug: string; merchantId: string | null }) {
  const [unread, setUnread] = useState(0);
  const config = useQuery({ queryKey: ["chat-config"], queryFn: () => getChatConfig(), staleTime: Infinity });

  useEffect(() => {
    const settings = config.data;
    if (!merchantId || !settings) return;
    let cancelled = false;
    let running = false;
    let visitorId: string | null = null;
    let latest: { conversation_id?: string | null; messages?: IncomingChatMessage[] } | null = null;
    const updateBadge = () => {
      if (cancelled || !latest?.conversation_id) return;
      let seenId: string | null = null;
      try { seenId = window.localStorage.getItem(chatReadKey(slug, latest.conversation_id)); } catch { /* optional */ }
      setUnread(countUnreadReplies(latest.messages ?? [], seenId));
    };
    const poll = async () => {
      if (running || document.visibilityState !== "visible") return;
      running = true;
      try {
        if (!visitorId) {
          let fallback: string | null = null;
          try { fallback = window.localStorage.getItem(`cupai_visitor_${slug}`); } catch { /* optional */ }
          const response = await fetch(fallback ? `/api/visitor?fallback=${encodeURIComponent(fallback)}` : "/api/visitor", { credentials: "same-origin" });
          if (!response.ok) return;
          const visitor = await response.json() as { visitor_id?: string };
          visitorId = visitor.visitor_id ?? fallback;
          if (visitorId) {
            try { window.localStorage.setItem(`cupai_visitor_${slug}`, visitorId); } catch { /* optional */ }
          }
        }
        if (!visitorId || cancelled) return;
        const response = await fetch(settings.chatAiUrl, {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json", apikey: settings.supabaseAnonKey, Authorization: `Bearer ${settings.supabaseAnonKey}` },
          body: JSON.stringify({ action: "fetch", merchant_id: merchantId, visitor_id: visitorId }),
        });
        if (!response.ok || cancelled) return;
        latest = await response.json();
        updateBadge();
      } catch { /* Retry transient failures on the next poll. */ }
      finally { running = false; }
    };
    setUnread(0);
    void poll();
    const timer = window.setInterval(() => void poll(), 4000);
    const onVisibility = () => void poll();
    window.addEventListener("storage", updateBadge);
    window.addEventListener("cupai-chat-read", updateBadge);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener("storage", updateBadge);
      window.removeEventListener("cupai-chat-read", updateBadge);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [slug, merchantId, config.data]);

  return (
    <Link to="/chat/$slug" params={{ slug }} search={{ mode: "continue" }} aria-label={unread ? `${t("تواصل معنا")} (${unread})` : t("تواصل معنا")} className="store-chat-fab">
      <span className="store-chat-fab-ring" aria-hidden />
      <MessageSquare className="relative h-6 w-6" strokeWidth={1.75} />
      {unread > 0 && <span role="status" className="absolute -right-1 -top-1 grid h-6 min-w-6 place-items-center rounded-full border-2 border-background bg-destructive px-1 text-xs font-bold text-destructive-foreground">{unread > 99 ? "99+" : unread}</span>}
    </Link>
  );
}