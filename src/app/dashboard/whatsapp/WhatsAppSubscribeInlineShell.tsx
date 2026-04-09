"use client";

import dynamic from "next/dynamic";

import type { BillingPricesShape } from "@/app/lib/billing/pricesShape";

const SubscribeInline = dynamic(() => import("@/app/dashboard/billing/SubscribeInline"), {
  ssr: false,
  loading: () => (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-500 shadow-sm">
      Carregando checkout…
    </div>
  ),
});

export default function WhatsAppSubscribeInlineShell({ prices }: { prices: BillingPricesShape }) {
  return <SubscribeInline prices={prices} />;
}
