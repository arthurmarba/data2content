"use client";

import React, { useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useSidebarViewport } from "./sidebar/hooks";
import InstagramReconnectBanner from "./InstagramReconnectBanner";
import TrialBanner from "./TrialBanner";
import ChunkLoadRecovery from "./ChunkLoadRecovery";
import { SidebarProvider, useSidebar } from "../context/SidebarContext";
import { MOBILE_PROFILE_ROUTE } from "../boards/videoUpload/mobileStrategicProfileRoutes";
import {
  HeaderProvider,
  useHeaderConfig,
  useHeaderSetup,
  type HeaderConfig,
  type HeaderVariant,
} from "../context/HeaderContext";

const MOBILE_STRATEGIC_PROFILE_PREVIEW_ROUTE = "/dashboard/boards/mobile-strategic-profile-preview";
const MOBILE_DASHBOARD_ENTRY_PATHS = new Set(["/", "/dashboard", "/dashboard/home"]);

export function isMobileStrategicProfileRoute(pathname?: string | null) {
  if (!pathname) return false;
  return (
    pathname === MOBILE_PROFILE_ROUTE ||
    pathname.startsWith(`${MOBILE_PROFILE_ROUTE}/`) ||
    pathname === MOBILE_STRATEGIC_PROFILE_PREVIEW_ROUTE ||
    pathname.startsWith(`${MOBILE_STRATEGIC_PROFILE_PREVIEW_ROUTE}/`)
  );
}

export function shouldRenderDashboardMobileBottomNav({
  isPrintMode,
  isGuidedFlow,
  isMobile,
  isMobileStrategicProfileAppEnabled,
  pathname,
}: {
  isPrintMode: boolean;
  isGuidedFlow: boolean;
  isMobile: boolean;
  isMobileStrategicProfileAppEnabled: boolean;
  pathname?: string | null;
}) {
  if (isPrintMode || isGuidedFlow || !isMobile) return false;
  if (isMobileStrategicProfileAppEnabled && isMobileStrategicProfileRoute(pathname)) return false;
  return true;
}

export function isMobileDashboardEntryRoute(pathname?: string | null) {
  return MOBILE_DASHBOARD_ENTRY_PATHS.has(pathname || "");
}

const SidebarNav = dynamic(() => import("./SidebarNav"), {
  loading: () => null,
});

const Header = dynamic(() => import("../../components/Header"), {
  loading: () => null,
});

const ActivationPendingWidget = dynamic(() => import("./activation/ActivationPendingWidget"), {
  loading: () => null,
});

const MobileBottomNav = dynamic(() => import("./MobileBottomNav"), {
  loading: () => null,
  ssr: false,
});

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
  const { mounted, isMobile } = useSidebarViewport();
  const { config: activeHeaderConfig } = useHeaderConfig();
  const [activationWidgetReady, setActivationWidgetReady] = React.useState(false);
  const overlayIgnoreUntilRef = React.useRef(0);
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const printParam = searchParams?.get("print");
  const isPrintMode = printParam === "1" || printParam === "true";
  const isMobileStrategicProfileAppEnabled =
    process.env.NEXT_PUBLIC_MOBILE_STRATEGIC_PROFILE_ENABLED === "1";

  const matchPath = (base: string) => pathname === base || pathname.startsWith(`${base}/`);

  const isChatPage = matchPath("/dashboard/chat") || matchPath("/planning/chat");
  const isMediaKitPage = matchPath("/dashboard/media-kit") || matchPath("/media-kit");
  const isSettingsPage = matchPath("/dashboard/settings") || matchPath("/settings");
  const isBillingPage = matchPath("/dashboard/billing") || matchPath("/settings/billing");
  const isDiscover = matchPath("/dashboard/discover") || matchPath("/planning/discover");
  const isCalendarHub = matchPath("/calendar");
  const isPlanningPage = matchPath("/dashboard/planning") || matchPath("/planning");
  const isGuidedFlow = matchPath("/dashboard/instagram");
  const isPlannerPage =
    matchPath("/dashboard/planning") || matchPath("/planning/planner") || matchPath("/planning/demo");
  const isGeminiHeaderPage =
    isChatPage || isMediaKitPage || isSettingsPage || isBillingPage || isDiscover || isPlanningPage;

  const isOpen = !isCollapsed;
  const hasPageOverride = isMediaKitPage || isPlannerPage || isDiscover;
  const isMobileStrategicProfileSurface = isMobileStrategicProfileRoute(pathname);
  const isMobileStrategicProfileMediaKitReturn =
    isMediaKitPage && searchParams?.get("from") === "mobile-strategic-profile";
  const shouldRedirectMobileDashboardEntryPath =
    isMobileStrategicProfileAppEnabled &&
    !isPrintMode &&
    searchParams?.get("board") !== "post-creation" &&
    isMobileDashboardEntryRoute(pathname);
  const shouldRedirectMobileDashboardEntryClient =
    shouldRedirectMobileDashboardEntryPath && mounted && isMobile;
  const shouldUseMobileStrategicProfileShell =
    mounted && isMobile && isMobileStrategicProfileAppEnabled && isMobileStrategicProfileSurface;
  const shouldShowMobileBottomNav =
    !isMobileStrategicProfileMediaKitReturn &&
    shouldRenderDashboardMobileBottomNav({
      isPrintMode,
      isGuidedFlow,
      isMobile,
      isMobileStrategicProfileAppEnabled,
      pathname,
    });
  const shouldShowGlobalBanners =
    !isChatPage &&
    !isPrintMode &&
    !isCalendarHub &&
    !shouldUseMobileStrategicProfileShell &&
    !isMobileStrategicProfileMediaKitReturn;

  useEffect(() => {
    if (!shouldRedirectMobileDashboardEntryClient) return;
    router.replace(MOBILE_PROFILE_ROUTE);
  }, [router, shouldRedirectMobileDashboardEntryClient]);

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
      if (!mediaQuery.matches) {
        document.documentElement.style.setProperty("--header-h", "0px");
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

  useEffect(() => {
    if (typeof window === "undefined") return;

    let timeoutId: number | null = null;
    let idleId: number | null = null;

    const activateWidget = () => {
      setActivationWidgetReady(true);
    };

    if (typeof window.requestIdleCallback === "function") {
      idleId = window.requestIdleCallback(activateWidget, {
        timeout: isMobile ? 1600 : 900,
      });
    } else {
      timeoutId = window.setTimeout(activateWidget, isMobile ? 1100 : 600);
    }

    return () => {
      if (idleId !== null && typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idleId);
      }
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [isMobile]);

  const mainOffset = isGuidedFlow || isPrintMode ? "" : "lg:ml-[92px]";

  const mainScrollClass = isPrintMode
    ? "overflow-visible"
    : shouldUseMobileStrategicProfileShell
      ? "overflow-y-auto flex min-h-0 flex-col"
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
    !isMobile && !isPrintMode && !isGuidedFlow && activeHeaderConfig.sticky && headerOffsetRequested
      ? resolvedExtraTopPadding === "0px"
        ? "var(--header-h, 0px)"
        : `calc(var(--header-h, 0px) + ${resolvedExtraTopPadding})`
      : "0px";

  const shellClassName = "flex flex-col w-full min-h-0";
  const shellStyle = isPrintMode ? undefined : { height: "100dvh", minHeight: "100dvh" };
  const contentBottomPaddingClass =
    shouldUseMobileStrategicProfileShell || isMobileStrategicProfileMediaKitReturn
      ? "pb-0"
      : isDiscover && isMobile
      ? "pb-[calc(env(safe-area-inset-bottom,0px)+4.75rem)]"
      : "pb-[calc(env(safe-area-inset-bottom,0px)+4.75rem)] sm:pb-5 lg:pb-4";

  if (shouldRedirectMobileDashboardEntryClient) {
    return <MobileDashboardEntryRedirectFallback />;
  }

  const shell = (
    <>
      {!isGuidedFlow && !isPrintMode && (
        <SidebarNav isCollapsed={isCollapsed} onToggle={() => toggleSidebar()} />
      )}

      {/* Overlay removido pois o menu mobile agora eh bottom nav e o header top foi ocultado */}

      <div className={shellClassName} id="dashboard-shell" style={shellStyle}>
        {!isPrintMode && !isMobile && (
          <div className="hidden lg:block">
            {/* Header rendered only on desktop to avoid CSS variable injection on mobile */}
            <Header />
          </div>
        )}

        <main
          id="dashboard-main"
          className={`dashboard-main-surface dashboard-ambient-divider flex flex-col flex-1 min-h-0 ${mainOffset} ${isChatPage ? "overflow-hidden" : ""}`}
          style={{ paddingTop: resolvedPaddingTop }}
        >
          <div className={`flex-1 min-h-0 w-full ${mainScrollClass}`}>
            {shouldShowGlobalBanners && (
              <div className={`dashboard-page-shell space-y-4 ${isDiscover || isMobile ? "pt-0" : "pt-4 lg:pt-0"}`}>
                <InstagramReconnectBanner />
                <TrialBanner />
              </div>
            )}
            {isChatPage ? (
              <div className="flex-1 min-h-0 w-full h-full overflow-hidden">
                {children}
              </div>
            ) : (
              <div className={`flex-1 min-h-0 w-full overflow-visible ${contentBottomPaddingClass}`}>
                {children}
              </div>
            )}
          </div>
        </main>
        {!isPrintMode &&
        activationWidgetReady &&
        !shouldUseMobileStrategicProfileShell &&
        !isMobileStrategicProfileMediaKitReturn ? (
          <ActivationPendingWidget />
        ) : null}
        {shouldShowMobileBottomNav ? <MobileBottomNav /> : null}
        <ChunkLoadRecovery />
      </div>
    </>
  );

  if (shouldRedirectMobileDashboardEntryPath) {
    return (
      <>
        <div className="hidden lg:block">{shell}</div>
        <MobileDashboardEntryRedirectFallback className="lg:hidden" />
      </>
    );
  }

  return shell;
}

function MobileDashboardEntryRedirectFallback({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`dashboard-skin min-h-[100dvh] w-full bg-[#f4f4f8] ${className}`}
    />
  );
}
