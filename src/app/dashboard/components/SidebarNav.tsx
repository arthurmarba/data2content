"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import React, { useCallback, useMemo, useEffect, useTransition } from "react";
import { useFeatureFlag } from "@/app/context/FeatureFlagsContext";
import { normalizePlanStatus, isPlanActiveLike } from "@/utils/planStatus";
import { buildSidebarSections } from "./sidebar/config";
import { SidebarSectionList, type SidebarPresentationTokens } from "./sidebar/components";
import type { SidebarSection, SidebarChildNode } from "./sidebar/types";
import DashboardUserMenu from "./DashboardUserMenu";
import {
  useSidebarViewport,
  useBodyScrollLock,
  useMobileAutoClose,
  usePaywallOpener,
  useSidebarIntentPrefetch,
} from "./sidebar/hooks";
import { useDashboardNotificationBadges } from "../hooks/useDashboardNotificationBadges";

const normalizePath = (value: string) => (value.endsWith("/") ? value.slice(0, -1) : value);
const startsWithSegment = (pathname: string, href: string) => {
  const path = normalizePath(pathname);
  const target = normalizePath(href);
  return path === target || path.startsWith(`${target}/`);
};

const DESKTOP_HIDDEN_PANEL_ITEM_KEYS = new Set([
  "media-kit",
  "campaigns.overview",
  "planning.discover",
]);

const collectPrefetchTargets = (
  sections: SidebarSection[],
  pathname: string,
  badgesByKey: Record<string, number>,
  maxTargets = 4
) => {
  const current = normalizePath(pathname);
  const targets = new Map<string, number>();

  const currentSection = sections.find((section) =>
    section.items.some((item) =>
      item.type === "group"
        ? item.children.some((child) => startsWithSegment(pathname, child.href))
        : startsWithSegment(pathname, item.href)
    )
  )?.key;

  const pushTarget = (node: SidebarChildNode, sectionKey: SidebarSection["key"]) => {
    if (!node?.href || node.paywallContext) return;
    const href = normalizePath(node.href);
    if (!href || href === current) return;
    let score = 1;
    const badgeCount = badgesByKey[node.key] ?? 0;
    if (badgeCount > 0) {
      score += 200 + Math.min(badgeCount, 99);
    }
    if (currentSection && sectionKey === currentSection) {
      score += 40;
    }
    const existing = targets.get(href) ?? 0;
    if (score > existing) targets.set(href, score);
  };

  for (const section of sections) {
    for (const item of section.items) {
      if (item.type === "group") {
        for (const child of item.children) {
          pushTarget(child, section.key);
        }
        continue;
      }
      pushTarget(item, section.key);
    }
  }

  return Array.from(targets.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxTargets)
    .map(([href]) => href);
};

interface SidebarNavProps {
  isCollapsed: boolean; // true = fechado; false = aberto
  onToggle: () => void;
}

export default function SidebarNav({ isCollapsed, onToggle }: SidebarNavProps) {
  const asideRef = React.useRef<HTMLElement | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const normalizedPathname = useMemo(() => normalizePath(pathname), [pathname]);
  const [, startRouteTransition] = useTransition();
  const { data: session } = useSession();
  const sessionUser = session?.user as any;
  const userId = sessionUser?.id ?? null;
  const normalizedStatus = normalizePlanStatus(sessionUser?.planStatus);
  const userRole = typeof sessionUser?.role === "string" ? sessionUser.role.trim().toLowerCase() : null;
  const hasPremiumAccess = isPlanActiveLike(normalizedStatus) || userRole === "admin";

  const { enabled: dashboardMinimal } = useFeatureFlag("nav.dashboard_minimal");
  const { enabled: planningGroupLocked } = useFeatureFlag("planning.group_locked");
  const planningLocked = planningGroupLocked && !hasPremiumAccess;

  const { mounted, isMobile } = useSidebarViewport();
  const isOpen = !isCollapsed;

  useBodyScrollLock(isMobile && isOpen);
  useMobileAutoClose({ isMobile, isOpen, pathname, onToggle });

  const {
    alertsUnreadCount,
    reviewsUnreadCount,
    scriptsUnreadCount: scriptsRecommendationsUnreadCount,
    campaignsUnreadCount,
  } = useDashboardNotificationBadges();
  const sidebarBadges = useMemo(
    () => ({
      "planning.chat": alertsUnreadCount,
      "reviews": reviewsUnreadCount,
      "planning.scripts": scriptsRecommendationsUnreadCount,
      "campaigns.overview": campaignsUnreadCount,
    }),
    [alertsUnreadCount, reviewsUnreadCount, scriptsRecommendationsUnreadCount, campaignsUnreadCount]
  );

  const sections = useMemo(
    () =>
      buildSidebarSections({
        hasPremiumAccess,
        planningLocked,
        dashboardMinimal,
        isMobile,
      }),
    [dashboardMinimal, hasPremiumAccess, isMobile, planningLocked]
  );
  const visibleSections = useMemo(() => {
    if (isMobile) return sections;

    return sections
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => !DESKTOP_HIDDEN_PANEL_ITEM_KEYS.has(item.key)),
      }))
      .filter((section) => section.items.length > 0);
  }, [isMobile, sections]);
  const idlePrefetchTargets = useMemo(
    () => collectPrefetchTargets(visibleSections, pathname, sidebarBadges, isMobile ? 2 : 4),
    [isMobile, pathname, sidebarBadges, visibleSections]
  );
  const disableIdlePrefetch =
    !isMobile &&
    (normalizedPathname === "/" ||
      normalizedPathname === "/dashboard" ||
      normalizedPathname === "/dashboard/home");

  const effectiveCollapsed = true;
  const showLabels = isMobile;
  const openPaywall = usePaywallOpener();
  const prefetchSidebarLink = useSidebarIntentPrefetch();

  const layoutTokens = useMemo<SidebarPresentationTokens>(
    () => ({
      showLabels,
      alignClass: showLabels ? "justify-start" : "justify-center",
      itemPadding: showLabels ? "px-3.5 py-3" : "px-0 py-3",
      itemGap: showLabels ? "gap-3" : "gap-0",
      itemTextSize: showLabels ? "text-[14px]" : "text-[13px]",
      iconSize: "h-7 w-7",

      collapsedIconShift: "",
      focusOffsetClass: "focus-visible:ring-offset-transparent",
    }),
    [showLabels]
  );

  const handleNavigateTo = useCallback(
    (href: string) => {
      if (normalizePath(href) === normalizedPathname) return;
      startRouteTransition(() => {
        router.push(href);
      });
    },
    [normalizedPathname, router, startRouteTransition]
  );

  const interaction = useMemo(
    () => ({
      isMobile,
      isOpen,
      openPaywall,
      navigateTo: handleNavigateTo,
    }),
    [handleNavigateTo, isMobile, isOpen, openPaywall]
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

  useEffect(() => {
    if (!mounted || typeof window === "undefined") return;
    if (isMobile) return;
    if (disableIdlePrefetch) return;
    if (!idlePrefetchTargets.length) return;
    const navConnection = (navigator as any)?.connection as
      | { saveData?: boolean; effectiveType?: string }
      | undefined;
    if (navConnection?.saveData) return;
    const effectiveType = String(navConnection?.effectiveType || "").toLowerCase();
    if (effectiveType === "slow-2g" || effectiveType === "2g" || effectiveType === "3g") return;

    const deviceMemory = Number((navigator as any)?.deviceMemory);
    if (Number.isFinite(deviceMemory) && deviceMemory > 0 && deviceMemory <= 2) return;

    let timeoutId: number | null = null;
    let idleId: number | null = null;

    const runPrefetch = () => {
      idlePrefetchTargets.forEach((href) => prefetchSidebarLink(href));
    };

    if (typeof window.requestIdleCallback === "function") {
      idleId = window.requestIdleCallback(runPrefetch, { timeout: 1200 });
      return () => {
        if (idleId !== null && typeof window.cancelIdleCallback === "function") {
          window.cancelIdleCallback(idleId);
        }
      };
    }

    timeoutId = window.setTimeout(runPrefetch, 900);
    return () => {
      if (timeoutId !== null) window.clearTimeout(timeoutId);
    };
  }, [disableIdlePrefetch, idlePrefetchTargets, isMobile, mounted, prefetchSidebarLink]);

  useEffect(() => {
    const node = asideRef.current;
    if (!node) return;

    if (isMobile && !isOpen) {
      node.setAttribute("inert", "");
      const activeElement = document.activeElement;
      if (activeElement instanceof HTMLElement && node.contains(activeElement)) {
        document
          .querySelector<HTMLElement>('[data-dashboard-sidebar-toggle="true"]')
          ?.focus();
      }
      return;
    }

    node.removeAttribute("inert");
  }, [isMobile, isOpen]);

  const asideBase =
    "fixed left-0 top-0 z-[200] flex h-[100dvh] min-h-svh flex-col bg-[#f3f4f6] text-zinc-900 transition-[width,background-color,border-color,transform,opacity] duration-200 ease-[cubic-bezier(0.25,0.1,0.25,1)]";

  const desktopSurfaceTone = !isMobile ? "lg:bg-[#f3f4f6] lg:border-transparent lg:shadow-none" : "";

  const mobileVisibility = isMobile
    ? isOpen
      ? "translate-x-0 opacity-100"
      : "-translate-x-full opacity-0 pointer-events-none"
    : "";

  const mobileClasses = isMobile
    ? `fixed left-0 top-0 bottom-0 z-[220] w-[296px] transform border-r border-black/5 bg-[linear-gradient(180deg,rgba(251,251,252,0.98),rgba(244,244,246,0.96))] backdrop-blur-xl transition-opacity ${mobileVisibility} shadow-[0_24px_80px_rgba(24,24,27,0.18)]`
    : "";

  const desktopClasses = !isMobile
    ? "hidden lg:flex lg:w-[92px] lg:flex-col lg:transform-none"
    : "";


  const navPaddingX = "px-3";
  const navStyle = isMobile
    ? {
      paddingTop: "calc(var(--sat, 0px) + 1rem)",
      paddingBottom: "calc(var(--sab, 0px) + 1rem)",
    }
    : undefined;
  return (
    <>
      <aside
        ref={asideRef}
        className={`${asideBase} ${desktopSurfaceTone} ${mobileClasses} ${desktopClasses} ${!mounted ? "opacity-0 pointer-events-none" : "opacity-100"
          } overflow-visible`}
        aria-label="Navegação do dashboard"
      >
        <nav className={`flex h-full min-h-0 flex-col ${navPaddingX} ${isMobile ? "relative overflow-hidden" : "pb-5 pt-5"}`} style={navStyle}>
          {isMobile ? (
            <>
              <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_top_left,rgba(246,0,123,0.08),transparent_62%)]" />
              <div className="pointer-events-none absolute -right-10 top-24 h-36 w-36 rounded-full bg-white/50 blur-3xl" />
            </>
          ) : null}
          <Link
            href="/"
            className={`${isMobile ? "mb-3 mt-0 px-1.5 py-1" : "mb-5 -mt-1 justify-center px-2 py-2.5"} relative flex items-center rounded-[24px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent`}
            aria-label="Data2Content"
          >
            <div
              className={`${isMobile ? "h-16 w-16 translate-x-0" : "h-20 w-20"} relative shrink-0 flex items-center justify-center`}
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
            className={`dashboard-scrollbar relative z-[1] flex-1 min-h-0 overflow-y-auto overscroll-contain ${showLabels ? "pr-0.5" : "pr-0"}`}
          >
            <SidebarSectionList
              sections={visibleSections}
              tokens={layoutTokens}
              pathname={pathname}
              userId={userId}
              interaction={interaction}
              onLinkIntent={prefetchSidebarLink}
              badges={sidebarBadges}
            />
          </div>
          <div className={`relative z-[1] mt-4 ${showLabels ? "border-t border-zinc-200/80 pt-3.5" : "pb-1.5 pt-2"}`}>
            <DashboardUserMenu
              user={sessionUser}
              showLabel={showLabels}
              align="left"
            />
          </div>
        </nav>
      </aside>
    </>
  );
}
