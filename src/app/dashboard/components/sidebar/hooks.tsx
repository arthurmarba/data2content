import { useCallback, useEffect, useRef, useState } from "react";
import type { PaywallContext } from "@/types/paywall";
import { track } from "@/lib/track";

type PaywallViewedContext = "planning" | "reply_email" | "ai_analysis" | "calculator" | "whatsapp_ai" | "other";

const normalizePaywallContextForTracking = (value: PaywallContext): PaywallViewedContext => {
  switch (value) {
    case "planning":
      return "planning";
    case "reply_email":
      return "reply_email";
    case "ai_analysis":
      return "ai_analysis";
    case "calculator":
      return "calculator";
    case "whatsapp":
      return "whatsapp_ai";
    default:
      return "other";
  }
};

export const useSidebarViewport = () => {
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(true);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted) return;
    const mm = window.matchMedia("(min-width: 1024px)");
    const apply = () => setIsMobile(!mm.matches);
    apply();
    mm.addEventListener?.("change", apply);
    return () => mm.removeEventListener?.("change", apply);
  }, [mounted]);

  return { mounted, isMobile };
};

export const useBodyScrollLock = (enabled: boolean) => {
  const previousOverflow = useRef<string | null>(null);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const body = document.body;

    if (previousOverflow.current === null) {
      previousOverflow.current = body.style.overflow;
    }

    if (enabled) {
      body.style.overflow = "hidden";
      return () => {
        body.style.overflow = previousOverflow.current || "";
      };
    }

    body.style.overflow = previousOverflow.current || "";
    return () => {
      body.style.overflow = previousOverflow.current || "";
    };
  }, [enabled]);
};

export const useMobileAutoClose = ({
  isMobile,
  isOpen,
  pathname,
  onToggle,
}: {
  isMobile: boolean;
  isOpen: boolean;
  pathname: string;
  onToggle: () => void;
}) => {
  const lastPathnameRef = useRef(pathname);

  useEffect(() => {
    const pathChanged = pathname !== lastPathnameRef.current;
    lastPathnameRef.current = pathname;

    if (isMobile && isOpen && pathChanged) {
      onToggle();
    }
  }, [isMobile, isOpen, onToggle, pathname]);
};

export const usePaywallOpener = () =>
  useCallback(
    (context: PaywallContext, detail?: { source?: string | null; returnTo?: string | null; proposalId?: string | null }) => {
      track("paywall_viewed", { creator_id: null, context: normalizePaywallContextForTracking(context), plan: null });
      if (typeof window !== "undefined") {
        try {
          window.dispatchEvent(
            new CustomEvent("open-subscribe-modal", {
              detail: { context, ...detail },
            })
          );
        } catch {
          /* ignore */
        }
      }
    },
    []
  );
