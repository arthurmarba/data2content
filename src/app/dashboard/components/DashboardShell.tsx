"use client";

import React, { useEffect, useMemo } from "react";
import { usePathname } from "next/navigation";
import SidebarNav from "./SidebarNav";
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
    if (typeof document === "undefined") return;
    const body = document.body;
    const prevOverflow = body.style.overflow;
    const prevTouch = body.style.touchAction;
    body.style.overflow = "";
    body.style.touchAction = "";
    return () => {
      body.style.overflow = prevOverflow;
      body.style.touchAction = prevTouch;
    };
  }, []);

  return (
    <SidebarProvider>
      <HeaderProvider>
        <div className="relative w-full bg-white min-h-screen overflow-x-hidden">
          <LayoutContent>{children}</LayoutContent>
        </div>
      </HeaderProvider>
    </SidebarProvider>
  );
}

function LayoutContent({ children }: { children: React.ReactNode }) {
  const { isCollapsed, toggleSidebar } = useSidebar();
  const overlayIgnoreUntilRef = React.useRef(0);
  const pathname = usePathname();
  const { config: headerConfig } = useHeaderConfig();

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

  useEffect(() => {
    if (!isChatPage) return;
    if (typeof window === "undefined") return;

    const root = document.documentElement;
    let lastHeight = 0;
    const updateAppHeight = () => {
      const nextHeight = window.visualViewport?.height ?? window.innerHeight;
      if (!Number.isFinite(nextHeight)) return;
      const rounded = Math.round(nextHeight);
      if (rounded === lastHeight) return;
      lastHeight = rounded;
      root.style.setProperty("--app-height", `${rounded}px`);
    };

    updateAppHeight();

    const viewport = window.visualViewport;
    viewport?.addEventListener("resize", updateAppHeight);
    window.addEventListener("resize", updateAppHeight);

    return () => {
      viewport?.removeEventListener("resize", updateAppHeight);
      window.removeEventListener("resize", updateAppHeight);
    };
  }, [isChatPage]);

  const mainOffset = isGuidedFlow ? "" : "lg:ml-16";

  const mainScrollClass = isChatPage ? "overflow-hidden flex flex-col" : "overflow-y-auto";

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
    : isStickyHeader || isMediaKitPage
      ? baseTopPadding
      : resolvedContentTopPadding ?? "0px";

  const shellClassName = isChatPage
    ? "flex flex-col w-full min-h-0"
    : "flex flex-col w-full min-h-screen";
  const shellStyle = isChatPage ? { height: "var(--app-height, 100vh)" } : undefined;

  return (
    <>
      {!isGuidedFlow && <SidebarNav isCollapsed={isCollapsed} onToggle={() => toggleSidebar()} />}

      {!isGuidedFlow && (
        <div
          onClick={() => {
            if (!isOpen) return;
            if (Date.now() < overlayIgnoreUntilRef.current) return;
            toggleSidebar(true);
          }}
          className={`lg:hidden fixed inset-0 bg-black/40 z-50 transition-opacity ${isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
            }`}
          aria-hidden="true"
        />
      )}

      <div className={shellClassName} id="dashboard-shell" style={shellStyle}>
        <Header />

        <main
          id="dashboard-main"
          className={`flex flex-col flex-1 min-h-0 ${mainOffset} bg-white lg:rounded-tl-3xl ${isChatPage ? "overflow-hidden" : ""}`}
          style={{ paddingTop: resolvedPaddingTop }}
        >
          <div className={`flex-1 min-h-0 w-full ${mainScrollClass}`}>
            {!isChatPage && (
              <div className="dashboard-page-shell space-y-4 pt-4">
                <InstagramReconnectBanner />
                <TrialBanner />
              </div>
            )}
            {isChatPage ? (
              <div className="flex-1 min-h-0 w-full h-full overflow-hidden">
                {children}
              </div>
            ) : (
              children
            )}
          </div>
        </main>
      </div>
    </>
  );
}
