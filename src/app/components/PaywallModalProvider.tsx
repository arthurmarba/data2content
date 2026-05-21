"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import BillingSubscribeModal from "@/app/dashboard/billing/BillingSubscribeModal";
import { trackMobileNarrativeEvent } from "@/app/dashboard/boards/videoUpload/mobileNarrativeTelemetry";
import { useFeatureFlag } from "@/app/context/FeatureFlagsContext";
import { startGoogleSignInForPaywall } from "@/app/lib/paywall/startGoogleSignInForPaywall";
import type { PaywallContext, PaywallEventDetail } from "@/types/paywall";
import {
  ACTIVATION_JOURNEY_STORAGE_KEY,
  PAYWALL_AUTOSTART_PARAM,
  PAYWALL_CONTEXT_PARAM,
  PAYWALL_RETURN_STORAGE_KEY,
  PAYWALL_URL_PARAM,
} from "@/types/paywall";

const ALLOWED_CONTEXTS: PaywallContext[] = [
  "default",
  "reply_email",
  "ai_analysis",
  "calculator",
  "narrative_map",
  "mentoria",
  "media_kit",
  "publis",
  "planning",
  "whatsapp",
];

export default function PaywallModalProvider() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { status: sessionStatus } = useSession();
  const { enabled: paywallModalEnabled } = useFeatureFlag("paywall.modal_enabled", true);
  const [isOpen, setIsOpen] = useState(false);
  const [context, setContext] = useState<PaywallContext>("default");
  const shouldResumeCheckoutDirect =
    Boolean(paywallModalEnabled) &&
    sessionStatus === "authenticated" &&
    searchParams?.get(PAYWALL_URL_PARAM) === "1" &&
    searchParams?.get(PAYWALL_AUTOSTART_PARAM) === "1";

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<PaywallEventDetail> | undefined)?.detail;
      const ctxCandidate = (detail?.context ?? "default") as PaywallContext;
      const normalizedContext = ALLOWED_CONTEXTS.includes(ctxCandidate)
        ? ctxCandidate
        : "default";
      const rawReturn = typeof detail?.returnTo === "string" ? detail.returnTo : null;
      const sanitizedReturn =
        rawReturn && rawReturn.startsWith("/") && !rawReturn.startsWith("//")
          ? rawReturn
          : null;
      const proposalId =
        typeof detail?.proposalId === "string" && detail.proposalId.trim().length > 0
          ? detail.proposalId.trim()
          : null;
      const postCheckoutIntent =
        detail?.postCheckoutIntent === "connect_instagram" || detail?.postCheckoutIntent === "join_community"
          ? detail.postCheckoutIntent
          : null;

      setContext(normalizedContext);
      if (normalizedContext === "narrative_map" || normalizedContext === "mentoria") {
        trackMobileNarrativeEvent("mobile_paywall_opened", {
          route: sanitizedReturn ?? (typeof window !== "undefined" ? window.location.pathname : undefined),
          paywallContext: normalizedContext,
          postCheckoutIntent: postCheckoutIntent ?? undefined,
          actionType: "open_paywall",
        });
      }

      if (typeof window !== "undefined") {
        try {
          window.sessionStorage.setItem(
            PAYWALL_RETURN_STORAGE_KEY,
            JSON.stringify({
              context: normalizedContext,
              source: typeof detail?.source === "string" ? detail.source : null,
              returnTo: sanitizedReturn,
              proposalId,
              postCheckoutIntent,
              ts: Date.now(),
            })
          );
        } catch {
          /* storage failures are non-fatal */
        }

        try {
          window.localStorage.setItem(
            ACTIVATION_JOURNEY_STORAGE_KEY,
            JSON.stringify({
              context: normalizedContext,
              source: typeof detail?.source === "string" ? detail.source : null,
              returnTo: sanitizedReturn,
              postCheckoutIntent,
              ts: Date.now(),
            })
          );
        } catch {
          /* storage failures are non-fatal */
        }
      }

      if (sessionStatus === "unauthenticated") {
        void startGoogleSignInForPaywall({
          context: normalizedContext,
          source: typeof detail?.source === "string" ? detail.source : "paywall_modal",
          returnTo:
            sanitizedReturn ??
            (typeof window !== "undefined"
              ? `${window.location.pathname}${window.location.search}${window.location.hash}`
              : "/"),
        });
        return;
      }

      if (paywallModalEnabled) {
        setIsOpen(true);
      } else {
        router.push("/dashboard/billing");
      }
    };

    window.addEventListener("open-subscribe-modal" as any, handler);
    return () => window.removeEventListener("open-subscribe-modal" as any, handler);
  }, [paywallModalEnabled, router, sessionStatus]);

  useEffect(() => {
    if (!paywallModalEnabled && isOpen) {
      setIsOpen(false);
    }
  }, [paywallModalEnabled, isOpen]);

  useEffect(() => {
    if (!paywallModalEnabled) return;
    if (!searchParams || searchParams.get(PAYWALL_URL_PARAM) !== "1") return;

    const ctxCandidate = (searchParams.get(PAYWALL_CONTEXT_PARAM) ?? "default") as PaywallContext;
    const normalizedContext = ALLOWED_CONTEXTS.includes(ctxCandidate)
      ? ctxCandidate
      : "default";

    setContext(normalizedContext);
    if (searchParams.get(PAYWALL_AUTOSTART_PARAM) === "1" && sessionStatus === "authenticated") {
      setIsOpen(false);
      return;
    }
    setIsOpen(true);
  }, [paywallModalEnabled, searchParams, sessionStatus]);

  // Fecha o modal ao mudar de rota (ex: redirecionamento para checkout)
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  if (!paywallModalEnabled) {
    return null;
  }

  return (
    <BillingSubscribeModal
      open={isOpen}
      onClose={() => setIsOpen(false)}
      context={context}
      resumeCheckoutDirect={shouldResumeCheckoutDirect}
    />
  );
}
