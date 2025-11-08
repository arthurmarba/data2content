"use client";

import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import React, { useCallback, useMemo } from "react";
import { useFeatureFlag } from "@/app/context/FeatureFlagsContext";
import { normalizePlanStatus, isPlanActiveLike } from "@/utils/planStatus";
import { buildSidebarSections } from "./sidebar/config";
import { SidebarSectionList, type SidebarPresentationTokens } from "./sidebar/components";
import { useSidebarViewport, useBodyScrollLock, useMobileAutoClose, usePaywallOpener } from "./sidebar/hooks";

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

  const sections = useMemo(
    () =>
      buildSidebarSections({
        hasPremiumAccess,
        planningLocked,
        dashboardMinimal,
      }),
    [dashboardMinimal, hasPremiumAccess, planningLocked]
  );

  const showLabels = !isCollapsed || isMobile;
  const openPaywall = usePaywallOpener();

  const layoutTokens = useMemo<SidebarPresentationTokens>(
    () => ({
      showLabels,
      alignClass: showLabels ? "justify-start" : "justify-center",
      itemPadding: showLabels ? "px-4 py-3" : "py-2.5",
      itemGap: showLabels ? "gap-4" : "gap-0",
      itemTextSize: showLabels ? "text-[15px]" : "text-[13px]",
      iconSize: "h-10 w-10",
      collapsedIconShift: showLabels ? "" : "translate-x-[1px]",
      focusOffsetClass: isMobile ? "focus-visible:ring-offset-white" : "focus-visible:ring-offset-[#f7f8fa]",
    }),
    [isMobile, showLabels]
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

  const asideBase =
    "flex flex-col border-slate-200/80 text-slate-900 transition-transform duration-200 ease-out";

  const mobileVisibility = isMobile
    ? isOpen
      ? "translate-x-0 opacity-100"
      : "-translate-x-full opacity-0 pointer-events-none"
    : "";

  const mobileClasses = isMobile
    ? `fixed inset-y-0 left-0 z-[60] w-72 transform transition-opacity ${mobileVisibility}`
    : "";

  const desktopClasses = !isMobile
    ? `hidden lg:flex lg:flex-col lg:fixed lg:top-[var(--header-h,4rem)] lg:left-0 lg:h-[calc(100svh_-_var(--header-h,4rem))] lg:z-[200] lg:transform-none ${
        isCollapsed ? "lg:w-16" : "lg:w-72"
      }`
    : "";

  const asideSurface = isMobile ? "bg-white shadow-xl border-r" : "bg-transparent border-r";
  const navPaddingX = showLabels ? "px-3 sm:px-4" : "px-2";

  return (
    <aside
      className={`${asideBase} ${asideSurface} ${mobileClasses} ${desktopClasses} ${
        !mounted ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
      aria-label="Navegação do dashboard"
      aria-hidden={isMobile ? !isOpen : false}
    >
      <nav className={`flex h-full min-h-0 flex-col ${navPaddingX} pb-6 pt-6`}>
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
          />
        </div>
      </nav>
    </aside>
  );
}
