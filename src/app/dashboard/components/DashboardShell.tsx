"use client";

import React, { useEffect, useMemo } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import SidebarNav from "./SidebarNav";
import ActivationPendingWidget from "./activation/ActivationPendingWidget";
import Header from "../../components/Header";
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

type DashboardShellProps = {
  children: React.ReactNode;
};

export default function DashboardShell({ children }: DashboardShellProps) {
  React.useEffect(() => {
    if (typeof document === "undefined" || typeof window === "undefined") return;
    const body = document.body;
    const html = document.documentElement;
    const prevOverflow = body.style.overflow;
    const prevTouch = body.style.touchAction;
    const prevHtmlOverflow = html.style.overflow;
    body.style.touchAction = "";

    const mediaQuery = window.matchMedia("(min-width: 1024px)");
    const syncOverflow = () => {
      const overflowValue = mediaQuery.matches ? "hidden" : "";
      body.style.overflow = overflowValue;
      html.style.overflow = overflowValue;
    };

    syncOverflow();
    mediaQuery.addEventListener?.("change", syncOverflow);

    return () => {
      body.style.overflow = prevOverflow;
      body.style.touchAction = prevTouch;
      html.style.overflow = prevHtmlOverflow;
      mediaQuery.removeEventListener?.("change", syncOverflow);
    };
  }, []);

  return (
    <SidebarProvider>
      <HeaderProvider>
        <div className="dashboard-skin dashboard-shell-canvas relative h-screen min-h-0 w-full overflow-hidden">
          <LayoutContent>{children}</LayoutContent>
        </div>
      </HeaderProvider>
    </SidebarProvider>
  );
}

function LayoutContent({ children }: { children: React.ReactNode }) {
  const { isCollapsed, toggleSidebar } = useSidebar();
  const { config: activeHeaderConfig } = useHeaderConfig();
  const overlayIgnoreUntilRef = React.useRef(0);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const printParam = searchParams?.get("print");
  const isPrintMode = printParam === "1" || printParam === "true";

  const matchPath = (base: string) => pathname === base || pathname.startsWith(`${base}/`);

  const isChatPage = matchPath("/dashboard/chat") || matchPath("/planning/chat");
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

  React.useEffect(() => {
    if (isOpen) {
      overlayIgnoreUntilRef.current = Date.now() + 500;
    }
  }, [isOpen]);

  const layoutHeaderConfig = useMemo<Partial<HeaderConfig> | undefined>(() => {
    if (hasPageOverride) return undefined;
    const variant: HeaderVariant = isGuidedFlow ? "minimal" : "default";
    return {
      showSidebarToggle: !isGuidedFlow,
      showUserMenu: !isGuidedFlow,
      hideBrandLogoOnMobile: true,
      sticky: true,
      variant,
      contentTopPadding: undefined,
    };
  }, [hasPageOverride, isGuidedFlow]);

  useHeaderSetup(layoutHeaderConfig, [hasPageOverride, isGuidedFlow]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mediaQuery = window.matchMedia("(min-width: 1024px)");
    const syncHeaderOffset = () => {
      if (mediaQuery.matches) {
        document.documentElement.style.setProperty("--header-h", "0px");
        return;
      }
      if (!isGeminiHeaderPage) {
        document.documentElement.style.setProperty("--header-h", "4rem");
      }
    };

    syncHeaderOffset();
    mediaQuery.addEventListener?.("change", syncHeaderOffset);
    return () => mediaQuery.removeEventListener?.("change", syncHeaderOffset);
  }, [isGeminiHeaderPage]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const tapdebug = new URLSearchParams(window.location.search).has("tapdebug");
    if (!tapdebug) return;
    const handler = (event: PointerEvent) => {
      const el = document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null;
      console.log("[tapdebug] top element:", el?.tagName, el?.id, el?.className);
    };
    document.addEventListener("pointerdown", handler, true);
    return () => document.removeEventListener("pointerdown", handler, true);
  }, []);

  const mainOffset = isGuidedFlow || isPrintMode ? "" : "lg:ml-[92px]";

  const mainScrollClass = isPrintMode
    ? "overflow-visible"
    : "overflow-hidden flex min-h-0 flex-col";
  const headerOffsetRequested = Boolean(
    activeHeaderConfig.mobileTitle ||
      activeHeaderConfig.mobileSubtitle ||
      activeHeaderConfig.mobileAccessory ||
      activeHeaderConfig.contentTopPadding !== undefined
  );
  const resolvedExtraTopPadding = React.useMemo(() => {
    const topPadding = activeHeaderConfig.contentTopPadding;
    if (topPadding === undefined || topPadding === null) return "0px";
    return typeof topPadding === "number" ? `${topPadding}px` : String(topPadding);
  }, [activeHeaderConfig.contentTopPadding]);
  const resolvedPaddingTop =
    !isPrintMode && !isGuidedFlow && activeHeaderConfig.sticky && headerOffsetRequested
      ? resolvedExtraTopPadding === "0px"
        ? "var(--header-h, 0px)"
        : `calc(var(--header-h, 0px) + ${resolvedExtraTopPadding})`
      : "0px";

  const shellClassName = "flex flex-col w-full min-h-0";
  const shellStyle = isPrintMode ? undefined : { height: "100dvh", minHeight: "100dvh" };

  return (
    <>
      {!isGuidedFlow && !isPrintMode && (
        <SidebarNav isCollapsed={isCollapsed} onToggle={() => toggleSidebar()} />
      )}

      {!isGuidedFlow && !isPrintMode && (
        <div
          onClick={() => {
            if (!isOpen) return;
            if (Date.now() < overlayIgnoreUntilRef.current) return;
            toggleSidebar(true);
          }}
          className={`lg:hidden fixed inset-0 bg-black/40 z-[210] transition-opacity ${isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
            }`}
          aria-hidden="true"
        />
      )}

      <div className={shellClassName} id="dashboard-shell" style={shellStyle}>
        {!isPrintMode && (
          <div className="lg:hidden">
            <Header />
          </div>
        )}

        <main
          id="dashboard-main"
          className={`dashboard-main-surface dashboard-ambient-divider flex flex-col flex-1 min-h-0 ${mainOffset} ${isChatPage ? "overflow-hidden" : ""}`}
          style={{ paddingTop: resolvedPaddingTop }}
        >
          <div className={`flex-1 min-h-0 w-full ${mainScrollClass}`}>
            {!isChatPage && !isPrintMode && (
              <div className={`dashboard-page-shell space-y-4 ${isDiscover ? "pt-0" : "pt-4 lg:pt-0"}`}>
                <InstagramReconnectBanner />
                <TrialBanner />
              </div>
            )}
            {isChatPage ? (
              <div className="flex-1 min-h-0 w-full h-full overflow-hidden">
                {children}
              </div>
            ) : (
              <div className="flex-1 min-h-0 w-full overflow-hidden pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] sm:pb-5 lg:pb-4">
                {children}
              </div>
            )}
          </div>
        </main>
        {!isPrintMode ? <ActivationPendingWidget /> : null}
      </div>
    </>
  );
}
