/**
 * Layout route for the public storefront namespace (/c/$slug/*).
 *
 * The storefront page itself lives in `c.$slug.index.tsx`; the customer
 * account / order-tracking page lives in `c.$slug.account.tsx`. This layout
 * must only render <Outlet /> so child routes can mount.
 */
import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/c/$slug")({
  head: ({ params }) => ({ meta: [
    { title: `${params.slug} — متجر Cupai` },
    { name: "description", content: "تصفح المنتجات واطلب من متجر Cupai." },
    { property: "og:title", content: `${params.slug} — متجر Cupai` },
    { property: "og:description", content: "تصفح المنتجات واطلب من متجر Cupai." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: () => <Outlet />,
});