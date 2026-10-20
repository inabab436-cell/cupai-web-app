import { createFileRoute, redirect } from "@tanstack/react-router";

// Customer accounts were removed — old links go to order tracking.
export const Route = createFileRoute("/c/$slug/account")({
  head: ({ params }) => ({ meta: [
    { title: `طلبات ${params.slug} — Cupai` },
    { name: "description", content: "انتقل إلى متابعة طلباتك في المتجر." },
    { property: "og:title", content: `طلبات ${params.slug} — Cupai` },
    { property: "og:description", content: "انتقل إلى متابعة طلباتك في المتجر." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/c/$slug/track", params: { slug: params.slug }, replace: true });
  },
});
