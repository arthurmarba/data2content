"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import React, { useCallback, useMemo, useRef, useState, useEffect } from "react";
import { useFeatureFlag } from "@/app/context/FeatureFlagsContext";
import { normalizePlanStatus, isPlanActiveLike } from "@/utils/planStatus";
import { buildSidebarSections } from "./sidebar/config";
import { SidebarSectionList, type SidebarPresentationTokens } from "./sidebar/components";
import { useSidebarViewport, useBodyScrollLock, useMobileAutoClose, usePaywallOpener } from "./sidebar/hooks";
import { useAlerts } from "../hooks/useAlerts";
import { usePostReviewNotifications } from "../hooks/usePostReviewNotifications";
import { useScriptRecommendationsNotifications } from "../hooks/useScriptRecommendationsNotifications";

interface SidebarNavProps {
  isCollapsed: boolean; // true = fechado; false = aberto
  onToggle: () => void;
}

export default function SidebarNav({ isCollapsed, onToggle }: SidebarNavProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const sessionUser = session?.user as any;
  const userId = sessionUser?.id ?? null;
  const normalizedStatus = normalizePlanStatus(sessionUser?.planStatus);
  const userRole = typeof sessionUser?.role === "string" ? sessionUser.role.trim().toLowerCase() : null;
  const proTrialStatus = typeof sessionUser?.proTrialStatus === "string" ? sessionUser.proTrialStatus.trim().toLowerCase() : null;
  const hasPremiumAccess =
    isPlanActiveLike(normalizedStatus) || proTrialStatus === "active" || userRole === "admin";

  const { enabled: dashboardMinimal } = useFeatureFlag("nav.dashboard_minimal");
  const { enabled: planningGroupLocked } = useFeatureFlag("planning.group_locked");
  const planningLocked = planningGroupLocked && !hasPremiumAccess;

  const { mounted, isMobile } = useSidebarViewport();
  const isOpen = !isCollapsed;

  useBodyScrollLock(isMobile && isOpen);
  useMobileAutoClose({ isMobile, isOpen, pathname, onToggle });

  const {
    unreadCount: alertsUnreadCount,
    refreshUnreadCount: refreshAlertsBadge,
  } = useAlerts();

  const reviewsUnreadCount = usePostReviewNotifications();
  const scriptsRecommendationsUnreadCount = useScriptRecommendationsNotifications();

  React.useEffect(() => {
    refreshAlertsBadge();
    const id = window.setInterval(() => {
      refreshAlertsBadge();
    }, 60000);
    return () => window.clearInterval(id);
  }, [refreshAlertsBadge]);

  const sections = useMemo(
    () =>
      buildSidebarSections({
        hasPremiumAccess,
        planningLocked,
        dashboardMinimal,
      }),
    [dashboardMinimal, hasPremiumAccess, planningLocked]
  );

  const [isHovering, setIsHovering] = useState(false);
  const collapseTimer = useRef<number | null>(null);
  const isDesktop = !isMobile;
  const effectiveCollapsed = isMobile ? isCollapsed : !isHovering;
  const showLabels = isMobile ? true : !effectiveCollapsed;
  const openPaywall = usePaywallOpener();

  const layoutTokens = useMemo<SidebarPresentationTokens>(
    () => ({
      showLabels,
      alignClass: "justify-start",
      itemPadding: "px-3 py-2.5",
      itemGap: showLabels ? "gap-3" : "gap-0",
      itemTextSize: showLabels ? "text-[15px]" : "text-sm",
      iconSize: "h-7 w-7",

      collapsedIconShift: "",
      focusOffsetClass: "focus-visible:ring-offset-white",
    }),
    [showLabels]
  );

  const handleItemNavigate = useCallback(() => {
    if (isMobile && isOpen) onToggle();
  }, [isMobile, isOpen, onToggle]);

  const interaction = useMemo(
    () => ({
      isMobile,
      isOpen,
      onItemNavigate: handleItemNavigate,
      openPaywall,
    }),
    [handleItemNavigate, isMobile, isOpen, openPaywall]
  );

  const handleSidebarWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    const node = event.currentTarget;
    const canScroll = node.scrollHeight > node.clientHeight;
    if (!canScroll) return;

    const atTop = node.scrollTop <= 0;
    const atBottom = node.scrollTop + node.clientHeight >= node.scrollHeight - 1;
    const scrollingUp = event.deltaY < 0;
    const scrollingDown = event.deltaY > 0;

    if ((atTop && scrollingUp) || (atBottom && scrollingDown)) {
      return;
    }

    event.stopPropagation();
  }, []);

  const clearCollapseTimer = useCallback(() => {
    if (collapseTimer.current) {
      window.clearTimeout(collapseTimer.current);
      collapseTimer.current = null;
    }
  }, []);

  const handleMouseEnter = useCallback(() => {
    if (!isDesktop) return;
    clearCollapseTimer();
    setIsHovering(true);
  }, [clearCollapseTimer, isDesktop]);

  const handleMouseLeave = useCallback(() => {
    if (!isDesktop) return;
    clearCollapseTimer();
    collapseTimer.current = window.setTimeout(() => {
      setIsHovering(false);
      collapseTimer.current = null;
    }, 120);
  }, [clearCollapseTimer, isDesktop]);

  const handleFocusCapture = useCallback(() => {
    if (!isDesktop) return;
    clearCollapseTimer();
    setIsHovering(true);
  }, [clearCollapseTimer, isDesktop]);

  const handleBlurCapture = useCallback(
    (event: React.FocusEvent<HTMLElement>) => {
      if (!isDesktop) return;
      const nextTarget = event.relatedTarget as HTMLElement | null;
      if (nextTarget && event.currentTarget.contains(nextTarget)) {
        return;
      }
      clearCollapseTimer();
      setIsHovering(false);
    },
    [clearCollapseTimer, isDesktop]
  );

  useEffect(() => {
    return () => {
      clearCollapseTimer();
    };
  }, [clearCollapseTimer]);

  const asideBase =
    "fixed left-0 top-0 z-40 flex h-[100dvh] min-h-svh flex-col bg-white text-slate-900 border-r border-gray-200/50 transition-[width] duration-200 ease-[cubic-bezier(0.25,0.1,0.25,1)]";

  const mobileVisibility = isMobile
    ? isOpen
      ? "translate-x-0 opacity-100"
      : "-translate-x-full opacity-0 pointer-events-none"
    : "";

  const mobileClasses = isMobile
    ? `fixed left-0 top-0 bottom-0 z-[60] w-72 transform transition-opacity ${mobileVisibility} shadow-xl`
    : "";

  const desktopClasses = !isMobile
    ? `hidden lg:flex lg:flex-col lg:transform-none ${effectiveCollapsed ? "lg:w-[72px]" : "lg:w-64"}`
    : "";


  const navPaddingX = "px-3";
  const navStyle = isMobile
    ? {
      paddingTop: "calc(var(--sat, 0px) + 1rem)",
      paddingBottom: "calc(var(--sab, 0px) + 1rem)",
    }
    : undefined;
  const labelTransition = showLabels ? "max-w-full opacity-100 translate-x-0" : "max-w-0 opacity-0 -translate-x-1";
  const labelBase = "overflow-hidden whitespace-nowrap leading-tight transition-[max-width,opacity,transform] duration-200";

  return (
    <>
      <aside
        className={`${asideBase} ${mobileClasses} ${desktopClasses} ${!mounted ? "opacity-0 pointer-events-none" : "opacity-100"
          } overflow-visible`}
        aria-label="Navegação do dashboard"
        aria-hidden={isMobile ? !isOpen : false}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocusCapture={handleFocusCapture}
        onBlurCapture={handleBlurCapture}
      >
        <nav className={`flex h-full min-h-0 flex-col ${navPaddingX} ${isMobile ? "" : "pb-6 pt-6"}`} style={navStyle}>
          <Link
            href="/dashboard"
            className={`${isMobile ? "mb-3 mt-0" : "mb-4 -mt-6"} flex items-center rounded-lg px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-300 focus-visible:ring-offset-2 focus-visible:ring-offset-white`}
            aria-label="Data2Content"
          >
            <div
              className={`${isMobile ? "h-12 w-12 translate-x-0" : "h-[72px] w-[72px] -translate-x-5"} relative shrink-0 flex items-center justify-center`}
            >
              <Image
                src="/images/Colorido-Simbolo.png"
                alt="Data2Content"
                fill
                className="object-contain object-center"
                priority
              />
            </div>
            <span className="sr-only">Data2Content</span>
          </Link>
          <div
            onWheel={handleSidebarWheel}
            className="flex-1 min-h-0 overflow-y-auto overscroll-contain pr-1 sm:pr-1.5 scrollbar-hide"
          >
            <SidebarSectionList
              sections={sections}
              tokens={layoutTokens}
              pathname={pathname}
              userId={userId}
              interaction={interaction}
              badges={{
                "planning.chat": alertsUnreadCount,
                "reviews": reviewsUnreadCount,
                "planning.scripts": scriptsRecommendationsUnreadCount,
              }}
            />
          </div>
        </nav>
      </aside>
    </>
  );
}
