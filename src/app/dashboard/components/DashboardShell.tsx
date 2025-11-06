"use client";

import React, { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import SidebarNav from "./SidebarNav";
import Header from "../../components/Header";
import BillingSubscribeModal from "../billing/BillingSubscribeModal";
import InstagramReconnectBanner from "./InstagramReconnectBanner";
import TrialBanner from "./TrialBanner";
import { SidebarProvider, useSidebar } from "../context/SidebarContext";
import {
  HeaderProvider,
  useHeaderConfig,
  useHeaderSetup,
  type HeaderConfig,
  type HeaderVariant,
} from "../context/HeaderContext";
import { useFeatureFlag } from "@/app/context/FeatureFlagsContext";
import type { PaywallContext, PaywallEventDetail } from "@/types/paywall";
import { PAYWALL_RETURN_STORAGE_KEY } from "@/types/paywall";

type DashboardShellProps = {
  children: React.ReactNode;
};

export default function DashboardShell({ children }: DashboardShellProps) {
  return (
    <SidebarProvider>
      <HeaderProvider>
        <div className="relative w-full bg-[#f7f8fa] overflow-x-hidden min-h-svh overscroll-none">
          <LayoutContent>{children}</LayoutContent>
        </div>
      </HeaderProvider>
    </SidebarProvider>
  );
}

function LayoutContent({ children }: { children: React.ReactNode }) {
  const { isCollapsed, toggleSidebar } = useSidebar();
  const pathname = usePathname();
  const router = useRouter();
  const { enabled: paywallModalEnabled } = useFeatureFlag("paywall.modal_enabled", true);
  const { config: headerConfig } = useHeaderConfig();

  const matchPath = (base: string) => pathname === base || pathname.startsWith(`${base}/`);

  const isChatPage = matchPath("/dashboard/chat");
  const isMediaKitPage = matchPath("/dashboard/media-kit") || matchPath("/media-kit");
  const isSettingsPage = matchPath("/dashboard/settings") || matchPath("/settings");
  const isBillingPage = matchPath("/dashboard/billing") || matchPath("/settings/billing");
  const isDiscover = matchPath("/dashboard/discover") || matchPath("/planning/discover");
  const isPlanningPage = matchPath("/dashboard/planning") || matchPath("/planning");
  const isGuidedFlow = matchPath("/dashboard/instagram");
  const isPlannerPage =
    matchPath("/dashboard/planning") || matchPath("/planning/planner") || matchPath("/planning/demo");
  const isGeminiHeaderPage =
    isChatPage || isMediaKitPage || isSettingsPage || isBillingPage || isDiscover || isPlanningPage;

  const isOpen = !isCollapsed;
  const hasPageOverride = isMediaKitPage || isPlannerPage || isDiscover;

  const layoutHeaderConfig = useMemo<Partial<HeaderConfig> | undefined>(() => {
    if (hasPageOverride) return undefined;
    const variant: HeaderVariant = isGuidedFlow ? "minimal" : "default";
    return {
      showSidebarToggle: !isGuidedFlow,
      showUserMenu: !isGuidedFlow,
      sticky: true,
      variant,
      contentTopPadding: undefined,
    };
  }, [hasPageOverride, isGuidedFlow]);

  useHeaderSetup(layoutHeaderConfig, [hasPageOverride, isGuidedFlow]);

  useEffect(() => {
    if (!isGeminiHeaderPage) {
      document.documentElement.style.setProperty("--header-h", "4rem");
    }
  }, [isGeminiHeaderPage]);

  const mainOffset = isGuidedFlow ? "" : isCollapsed ? "lg:ml-16" : "lg:ml-64";

  const mainScrollClass = isMediaKitPage
    ? "overflow-y-auto"
    : isChatPage
    ? "overflow-hidden"
    : "overflow-y-auto";

  const [showBillingModal, setShowBillingModal] = useState(false);
  const [paywallContext, setPaywallContext] = useState<PaywallContext>("default");
  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<PaywallEventDetail> | undefined)?.detail;
      const allowed: PaywallContext[] = ["default", "reply_email", "ai_analysis", "calculator", "planning"];
      const ctxCandidate = detail?.context ?? "default";
      const ctx = (allowed.includes(ctxCandidate as PaywallContext)
        ? ctxCandidate
        : "default") as PaywallContext;
      setPaywallContext(ctx);
      if (typeof window !== "undefined") {
        const rawReturn = typeof detail?.returnTo === "string" ? detail.returnTo : null;
        const sanitizedReturn =
          rawReturn && rawReturn.startsWith("/") && !rawReturn.startsWith("//") ? rawReturn : null;
        const proposalId =
          typeof detail?.proposalId === "string" && detail.proposalId.trim().length > 0
            ? detail.proposalId.trim()
            : null;
        if (sanitizedReturn || proposalId) {
          try {
            window.sessionStorage.setItem(
              PAYWALL_RETURN_STORAGE_KEY,
              JSON.stringify({
                context: ctx,
                returnTo: sanitizedReturn,
                proposalId,
                ts: Date.now(),
              })
            );
          } catch {
            /* ignore storage failures */
          }
        }
      }
      if (paywallModalEnabled) {
        setShowBillingModal(true);
      } else {
        router.push("/dashboard/billing");
      }
    };
    window.addEventListener("open-subscribe-modal" as any, handler);
    return () => window.removeEventListener("open-subscribe-modal" as any, handler);
  }, [paywallModalEnabled, router]);

  useEffect(() => {
    if (!paywallModalEnabled && showBillingModal) {
      setShowBillingModal(false);
    }
  }, [paywallModalEnabled, showBillingModal]);

  const wantsStickyHeader = headerConfig?.sticky !== false;
  const isMobileDocked = Boolean(headerConfig?.mobileDocked && wantsStickyHeader);
  const isStickyHeader = !isMediaKitPage && wantsStickyHeader && !isMobileDocked;

  const customPadding = headerConfig?.contentTopPadding;
  const resolvedContentTopPadding =
    typeof customPadding === "number"
      ? `${customPadding}px`
      : typeof customPadding === "string"
      ? customPadding
      : undefined;

  const baseTopPadding = "var(--header-h, 56px)";
  const resolvedPaddingTop = isMobileDocked
    ? "0px"
    : isStickyHeader
    ? `calc(${baseTopPadding} + ${resolvedContentTopPadding ?? "0px"})`
    : resolvedContentTopPadding ?? "0px";

  return (
    <>
      {!isGuidedFlow && <SidebarNav isCollapsed={isCollapsed} onToggle={() => toggleSidebar()} />}

      {isOpen && !isGuidedFlow && (
        <div
          onClick={() => toggleSidebar()}
          className="lg:hidden fixed inset-0 bg-black/40 z-50"
          aria-hidden="true"
        />
      )}

      <div className="flex flex-col w-full min-h-svh" id="dashboard-shell">
        <Header />

        <main
          id="dashboard-main"
          className={`flex flex-col flex-1 min-h-0 ${mainOffset} ${mainScrollClass}`}
          style={{ paddingTop: resolvedPaddingTop }}
        >
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 space-y-4">
            <InstagramReconnectBanner />
            <TrialBanner />
          </div>
          {children}
        </main>
      </div>

      {paywallModalEnabled ? (
        <BillingSubscribeModal
          open={showBillingModal}
          onClose={() => setShowBillingModal(false)}
          context={paywallContext}
        />
      ) : null}
    </>
  );
}
