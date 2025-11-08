"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import BillingSubscribeModal from "@/app/dashboard/billing/BillingSubscribeModal";
import { useFeatureFlag } from "@/app/context/FeatureFlagsContext";
import type { PaywallContext, PaywallEventDetail } from "@/types/paywall";
import { PAYWALL_RETURN_STORAGE_KEY } from "@/types/paywall";

const ALLOWED_CONTEXTS: PaywallContext[] = [
  "default",
  "reply_email",
  "ai_analysis",
  "calculator",
  "planning",
  "whatsapp",
];

export default function PaywallModalProvider() {
  const router = useRouter();
  const { enabled: paywallModalEnabled } = useFeatureFlag("paywall.modal_enabled", true);
  const [isOpen, setIsOpen] = useState(false);
  const [context, setContext] = useState<PaywallContext>("default");

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<PaywallEventDetail> | undefined)?.detail;
      const ctxCandidate = (detail?.context ?? "default") as PaywallContext;
      const normalizedContext = ALLOWED_CONTEXTS.includes(ctxCandidate)
        ? ctxCandidate
        : "default";

      setContext(normalizedContext);

      if (typeof window !== "undefined") {
        const rawReturn = typeof detail?.returnTo === "string" ? detail.returnTo : null;
        const sanitizedReturn =
          rawReturn && rawReturn.startsWith("/") && !rawReturn.startsWith("//")
            ? rawReturn
            : null;
        const proposalId =
          typeof detail?.proposalId === "string" && detail.proposalId.trim().length > 0
            ? detail.proposalId.trim()
            : null;

        if (sanitizedReturn || proposalId) {
          try {
            window.sessionStorage.setItem(
              PAYWALL_RETURN_STORAGE_KEY,
              JSON.stringify({
                context: normalizedContext,
                returnTo: sanitizedReturn,
                proposalId,
                ts: Date.now(),
              })
            );
          } catch {
            /* storage failures are non-fatal */
          }
        }
      }

      if (paywallModalEnabled) {
        setIsOpen(true);
      } else {
        router.push("/dashboard/billing");
      }
    };

    window.addEventListener("open-subscribe-modal" as any, handler);
    return () => window.removeEventListener("open-subscribe-modal" as any, handler);
  }, [paywallModalEnabled, router]);

  useEffect(() => {
    if (!paywallModalEnabled && isOpen) {
      setIsOpen(false);
    }
  }, [paywallModalEnabled, isOpen]);

  if (!paywallModalEnabled) {
    return null;
  }

  return (
    <BillingSubscribeModal open={isOpen} onClose={() => setIsOpen(false)} context={context} />
  );
}
