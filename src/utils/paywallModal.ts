"use client";

import type { PaywallContext, PaywallEventDetail } from "@/types/paywall";

export type OpenPaywallModalOptions = {
  context?: PaywallContext | null;
  source?: string | null;
  returnTo?: string | null;
  proposalId?: string | null;
};

export function openPaywallModal(options?: OpenPaywallModalOptions) {
  if (typeof window === "undefined") return;

  const detail: PaywallEventDetail = {
    context: (options?.context as PaywallContext) ?? "default",
    source: options?.source ?? null,
    returnTo: options?.returnTo ?? null,
    proposalId: options?.proposalId ?? null,
  };

  try {
    window.dispatchEvent(
      new CustomEvent<PaywallEventDetail>("open-subscribe-modal", {
        detail,
      })
    );
  } catch {
    /* no-op */
  }
}
