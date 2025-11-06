"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  FaHome,
  FaCalendarAlt,
  FaAddressCard,
  FaCreditCard,
  FaUsers,
} from "react-icons/fa";
import { Lock, ChevronDown, Compass as CompassIcon, Sparkles, Calculator, Megaphone } from "lucide-react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFeatureFlag } from "@/app/context/FeatureFlagsContext";
import { navigationLabels } from "@/constants/navigationLabels";
import { useUserScopedBoolean } from "@/hooks/useUserScopedBoolean";
import { normalizePlanStatus, isPlanActiveLike } from "@/utils/planStatus";
import { track } from "@/lib/track";
import type { PaywallContext } from "@/types/paywall";

interface SidebarNavProps {
  isCollapsed: boolean; // true = fechado; false = aberto
  onToggle: () => void;
}

type NavSection = "primary" | "secondary";

type SidebarChild = {
  key: string;
  label: string;
  href: string;
  icon: React.ReactNode;
  exact?: boolean;
  tooltip?: string;
  paywallContext?: PaywallContext;
  hideInMinimal?: boolean;
};

type SidebarItem =
  | {
      type: "item";
      key: string;
      label: string;
      href: string;
      icon: React.ReactNode;
      section: NavSection;
      exact?: boolean;
      tooltip?: string;
      hideInMinimal?: boolean;
      paywallContext?: PaywallContext;
    }
  | {
      type: "group";
      key: string;
      label: string;
      icon: React.ReactNode;
      section: NavSection;
      tooltip?: string;
      paywallContext?: PaywallContext;
      children: SidebarChild[];
      autoExpandPaths: string[];
      hideInMinimal?: boolean;
    };

const ProBadge = ({ className = "" }: { className?: string }) => (
  <span
    className={`inline-flex items-center rounded-full border border-brand-magenta/40 bg-brand-magenta/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-magenta ${className}`}
  >
    PRO
  </span>
);

type BuildSidebarOptions = {
  hasPremiumAccess: boolean;
  planningLocked: boolean;
};

const buildSidebarNodes = ({ hasPremiumAccess, planningLocked }: BuildSidebarOptions): SidebarItem[] => [
  {
    type: "item",
    key: "dashboard",
    label: "Início",
    href: "/dashboard",
    icon: <FaHome />,
    section: "primary",
    exact: true,
  },
  {
    type: "group",
    key: "campaigns",
    label: "Publicidade",
    icon: <Megaphone className="h-5 w-5 text-brand-purple" />,
    section: "primary",
    tooltip: "Campanhas e calculadora",
    autoExpandPaths: ["/campaigns", "/dashboard/calculator"],
    children: [
      {
        key: "campaigns.overview",
        label: navigationLabels.campaigns.menu,
        href: "/campaigns",
        icon: <Megaphone className="h-5 w-5" />,
      },
      {
        key: "campaigns.calculator",
        label: "Calculadora",
        href: "/dashboard/calculator",
        icon: <Calculator className="h-5 w-5" />,
        tooltip: !hasPremiumAccess
          ? "Calculadora é PRO: preço justo a partir das suas métricas."
          : undefined,
        paywallContext: !hasPremiumAccess ? "calculator" : undefined,
      },
    ],
  },
  {
    type: "item",
    key: "media-kit",
    label: navigationLabels.mediaKit.menu,
    href: "/media-kit",
    icon: <FaAddressCard />,
    section: "primary",
    tooltip: navigationLabels.mediaKit.tooltip,
  },
  {
    type: "group",
    key: "planning",
    label: navigationLabels.planning.menu,
    icon: <Sparkles className="h-5 w-5 text-brand-purple" />,
    section: "primary",
    tooltip: navigationLabels.planning.tooltip,
    paywallContext: planningLocked ? "planning" : undefined,
    autoExpandPaths: ["/planning", "/planning/planner", "/planning/discover"],
    children: [
      {
        key: "planning.calendar",
        label: navigationLabels.planningPlanner.menu,
        href: "/planning/planner",
        icon: <FaCalendarAlt className="h-5 w-5" />,
        tooltip: navigationLabels.planningPlanner.tooltip,
        paywallContext: planningLocked ? "planning" : undefined,
      },
      {
        key: "planning.discover",
        label: navigationLabels.planningDiscover.menu,
        href: "/planning/discover",
        icon: <CompassIcon className="h-5 w-5" />,
        tooltip: navigationLabels.planningDiscover.tooltip,
        paywallContext: planningLocked ? "planning" : undefined,
      },
    ],
  },
  {
    type: "item",
    key: "affiliates",
    label: navigationLabels.affiliates.menu,
    href: "/affiliates",
    icon: <FaUsers />,
    section: "secondary",
    hideInMinimal: true,
  },
  {
    type: "item",
    key: "settings",
    label: "Gerir Assinatura",
    href: "/settings",
    icon: <FaCreditCard />,
    section: "secondary",
    hideInMinimal: true,
  },
];

export default function SidebarNav({ isCollapsed, onToggle }: SidebarNavProps) {
  const pathname = usePathname();
  const { enabled: dashboardMinimal } = useFeatureFlag("nav.dashboard_minimal");
  const { enabled: planningGroupLocked } = useFeatureFlag("planning.group_locked");
  const { data: session } = useSession();
  const sessionUser = session?.user as any;
  const userId = sessionUser?.id ?? null;
  const normalizedStatus = normalizePlanStatus(sessionUser?.planStatus);
  const userRole = typeof sessionUser?.role === "string" ? sessionUser.role.trim().toLowerCase() : null;
  const proTrialStatus = typeof sessionUser?.proTrialStatus === "string" ? sessionUser.proTrialStatus.trim().toLowerCase() : null;
  const hasPremiumAccess =
    isPlanActiveLike(normalizedStatus) || proTrialStatus === "active" || userRole === "admin";
  const [planningCollapsed, setPlanningCollapsed, planningHydrated] = useUserScopedBoolean(
    "nav:planning:collapsed",
    userId,
    true
  );
  const planningExpanded = planningHydrated ? !planningCollapsed : false;
  const [campaignsCollapsed, setCampaignsCollapsed, campaignsHydrated] = useUserScopedBoolean(
    "nav:campaigns:collapsed",
    userId,
    false
  );
  const campaignsExpanded = campaignsHydrated ? !campaignsCollapsed : true;

  // Evita FOUC/flash: só consideramos breakpoints depois de montar no cliente
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [isMobile, setIsMobile] = useState(true);
  const wasOverflow = useRef<string | null>(null);

  const navItems: SidebarItem[] = useMemo(() => {
    const nodes = buildSidebarNodes({
      hasPremiumAccess,
      planningLocked: planningGroupLocked && !hasPremiumAccess,
    });

    if (!dashboardMinimal) return nodes;

    return nodes.reduce<SidebarItem[]>((acc, item) => {
      if (item.hideInMinimal) return acc;
      if (item.type === "group") {
        const allowedChildren = item.children.filter((child) => !child.hideInMinimal);
        if (allowedChildren.length === 0) return acc;
        acc.push({ ...item, children: allowedChildren });
        return acc;
      }
      acc.push(item);
      return acc;
    }, []);
  }, [dashboardMinimal, hasPremiumAccess, planningGroupLocked]);

  const { primaryItems, secondaryItems } = useMemo(
    () => ({
      primaryItems: navItems.filter((item) => item.section === "primary"),
      secondaryItems: navItems.filter((item) => item.section === "secondary"),
    }),
    [navItems]
  );

  useEffect(() => {
    navItems.forEach((item) => {
      if (item.type !== "group" || item.paywallContext) return;
      if (item.key === "campaigns") return;
      const shouldExpand = item.autoExpandPaths.some((path) => {
        if (pathname === path) return true;
        const normalized = path.endsWith("/") ? path : `${path}/`;
        return pathname.startsWith(normalized);
      });
      if (!shouldExpand) return;
      if (item.key === "planning" && planningHydrated && planningCollapsed) {
        setPlanningCollapsed(false);
      }
      if (item.key === "campaigns" && campaignsHydrated && campaignsCollapsed) {
        setCampaignsCollapsed(false);
      }
    });
  }, [
    campaignsCollapsed,
    campaignsHydrated,
    navItems,
    pathname,
    planningCollapsed,
    planningHydrated,
    setCampaignsCollapsed,
    setPlanningCollapsed,
  ]);

  // Detecta breakpoint (mobile x desktop)
  useEffect(() => {
    if (!mounted) return;
    const mm = window.matchMedia("(min-width: 1024px)"); // lg
    const apply = () => setIsMobile(!mm.matches);
    apply();
    mm.addEventListener?.("change", apply);
    return () => mm.removeEventListener?.("change", apply);
  }, [mounted]);

  // Scroll lock ao abrir no mobile
  const isOpen = !isCollapsed;
  useEffect(() => {
    if (!isMobile) return;
    if (isOpen) {
      wasOverflow.current = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = wasOverflow.current || "";
    }
    return () => {
      document.body.style.overflow = wasOverflow.current || "";
    };
  }, [isOpen, isMobile]);

  // Fecha ao navegar (mobile)
  useEffect(() => {
    if (isMobile && isOpen) onToggle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Classes de base
  const asideBase =
    "flex flex-col border-slate-200/80 text-slate-900 transition-transform duration-200 ease-out";

  const mobileVisibility = isMobile
    ? isOpen
      ? "translate-x-0 opacity-100"
      : "-translate-x-full opacity-0 pointer-events-none"
    : "";

  const mobileClasses = isMobile
    ? `fixed inset-y-0 left-0 z-[60] w-64 transform transition-opacity ${mobileVisibility}`
    : "";

  const desktopClasses = !isMobile
    ? `hidden lg:flex lg:flex-col lg:fixed lg:top-[var(--header-h,4rem)] lg:left-0 lg:h-[calc(100svh - var(--header-h,4rem))] lg:z-[200] lg:transform-none ${
        isCollapsed ? "lg:w-16" : "lg:w-64"
      }`
    : "";

  const showLabels = !isCollapsed || isMobile;
  const alignClass = showLabels ? "justify-start" : "justify-center";
  const itemPadding = showLabels ? "px-4 py-3" : "py-2.5";
  const itemGap = showLabels ? "gap-4" : "gap-0";
  const itemTextSize = showLabels ? "text-[15px]" : "text-[13px]";
  const iconSize = showLabels ? "h-10 w-10" : "h-10 w-10";
  const focusOffsetClass = isMobile ? "focus-visible:ring-offset-white" : "focus-visible:ring-offset-[#f7f8fa]";
  const collapsedIconShift = showLabels ? "" : "translate-x-[1px]";

  const asideSurface = isMobile ? "bg-white shadow-xl border-r" : "bg-transparent border-r";
  const navPaddingX = showLabels ? "px-3 sm:px-4" : "px-2";

  const normalizePaywallContextForTracking = (value: PaywallContext | null | undefined) => {
    switch (value) {
      case "planning":
      case "reply_email":
      case "ai_analysis":
      case "calculator":
        return value;
      default:
        return "other" as const;
    }
  };

  const openPaywall = useCallback(
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

  const isRouteActive = (href: string, exact?: boolean) => {
    if (pathname === href) return true;
    if (exact) return false;
    const normalized = href.endsWith("/") ? href : `${href}/`;
    return pathname.startsWith(normalized);
  };

  const renderNavList = (entries: SidebarItem[]) => (
    <ul className="flex flex-col gap-1.5">
      {entries.map((entry) => {
        if (entry.type === "group") {
          const expanded = entry.key === "planning" ? planningExpanded : entry.key === "campaigns" ? campaignsExpanded : true;
          const locked = Boolean(entry.paywallContext);
          const active = entry.children.some((child) => isRouteActive(child.href, child.exact));
          const groupId = `nav-group-${entry.key}`;
          const returnTo = entry.children[0]?.href ?? "/dashboard";
          const handleGroupToggle = (event: React.MouseEvent<HTMLButtonElement>) => {
            event.preventDefault();
            if (locked && entry.paywallContext) {
              openPaywall(entry.paywallContext, {
                source: `sidebar_group_${entry.key}`,
                returnTo,
              });
              return;
            }
            if (entry.key === "planning") {
              setPlanningCollapsed((prev) => {
                const next = !prev;
                track("nav_group_toggled", { group: entry.key, expanded: !next });
                return next;
              });
              return;
            }
            if (entry.key === "campaigns") {
              setCampaignsCollapsed((prev) => {
                const next = !prev;
                track("nav_group_toggled", { group: entry.key, expanded: !next });
                return next;
              });
              return;
            }
          };

          return (
            <li key={entry.key}>
              <button
                type="button"
                onClick={handleGroupToggle}
                className={`group relative flex items-center ${itemGap} ${itemPadding} ${itemTextSize} rounded-xl ${alignClass} transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-magenta/60 focus-visible:ring-offset-2 ${focusOffsetClass} ${
                  active
                    ? "bg-slate-100 font-semibold text-slate-900"
                    : "font-medium text-slate-600 hover:bg-slate-100/80 hover:text-slate-900"
                }`}
                aria-expanded={expanded}
                aria-controls={groupId}
                title={entry.tooltip}
              >
                {active && (
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute left-0 top-1/2 h-[60%] w-1 -translate-y-1/2 rounded-full bg-gradient-to-b from-brand-purple via-brand-magenta to-brand-orange"
                  />
                )}

                <span
                  aria-hidden="true"
                  className={`relative flex ${iconSize} shrink-0 items-center justify-center rounded-xl ${
                    showLabels ? "" : "mx-auto"
                  } ${collapsedIconShift} border border-slate-200/70 bg-white/90 ${showLabels ? "text-[16px]" : "text-[18px]"} transition-colors duration-200 ${
                  active
                    ? "border-brand-magenta/40 text-brand-purple shadow shadow-brand-magenta/10"
                    : "text-slate-500 group-hover:border-brand-magenta/35 group-hover:text-brand-purple group-hover:bg-white"
                  }`}
                >
                  {entry.icon}
                  {locked && !showLabels && (
                    <Lock className="absolute right-1 top-1 h-3 w-3 text-brand-magenta/80" aria-hidden="true" />
                  )}
                </span>

                {showLabels && (
                  <span
                    className={`truncate leading-tight ${
                      active ? "text-slate-900" : "text-slate-700 group-hover:text-slate-900"
                    }`}
                  >
                    {entry.label}
                  </span>
                )}

                {showLabels && (
                  <span className="ml-auto flex items-center gap-2">
                    {locked && (
                      <>
                        <ProBadge />
                        <Lock className="h-4 w-4 text-brand-magenta/70" aria-hidden="true" />
                      </>
                    )}
                    {!locked && (
                      <ChevronDown
                        className={`h-4 w-4 text-slate-500 transition-transform duration-200 ${
                          expanded ? "rotate-180" : ""
                        }`}
                        aria-hidden="true"
                      />
                    )}
                  </span>
                )}
              </button>

              <div
                id={groupId}
                className={`overflow-hidden transition-[max-height,opacity] duration-200 ease-out ${
                  expanded && showLabels ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
                } ${showLabels ? "pl-2" : ""}`}
              >
                {showLabels && (
                  <ul className="mt-1 flex flex-col gap-1">
                    {entry.children.map((child) => {
                      const childActive = isRouteActive(child.href, child.exact);
                      const childLocked = Boolean(child.paywallContext);
                      return (
                        <li key={child.key}>
                          <Link
                            href={child.href}
                            prefetch={false}
                            onClick={(event) => {
                              if (childLocked && child.paywallContext) {
                                event.preventDefault();
                                openPaywall(child.paywallContext, {
                                  source: `sidebar_child_${child.key}`,
                                  returnTo: child.href,
                                });
                                return;
                              }
                              if (isMobile && isOpen) onToggle();
                            }}
                            className={`group relative flex items-center gap-3 rounded-lg px-4 py-2.5 text-[14px] font-medium transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-magenta/60 focus-visible:ring-offset-2 ${focusOffsetClass} ${
                              childActive
                                ? "bg-slate-100 text-slate-900"
                                : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900"
                            }`}
                            title={child.tooltip}
                          >
                            {childActive && (
                              <span
                                aria-hidden="true"
                                className="pointer-events-none absolute left-2 top-1/2 h-[60%] w-0.5 -translate-y-1/2 rounded-full bg-gradient-to-b from-brand-purple via-brand-magenta to-brand-orange"
                              />
                            )}

                            <span
                              aria-hidden="true"
                              className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200/70 bg-white/90 text-sm transition-colors duration-200 ${
                                childActive
                                  ? "border-brand-magenta/40 text-brand-purple shadow shadow-brand-magenta/10"
                                  : "text-slate-500 group-hover:border-brand-magenta/35 group-hover:text-brand-purple group-hover:bg-white"
                              }`}
                            >
                              {child.icon}
                              {childLocked && (
                                <Lock className="absolute right-1 top-1 h-3 w-3 text-brand-magenta/80" aria-hidden="true" />
                              )}
                            </span>

                            <span
                              className={`flex-1 truncate ${
                                childActive
                                  ? "text-slate-900"
                                  : "text-slate-700 group-hover:text-slate-900"
                              }`}
                            >
                              {child.label}
                            </span>

                            {childLocked && <ProBadge />}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </li>
          );
        }

        const active = isRouteActive(entry.href, entry.exact);
        const locked = Boolean(entry.paywallContext);
        const handleItemClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
          if (locked && entry.paywallContext) {
            event.preventDefault();
            openPaywall(entry.paywallContext, {
              source: `sidebar_item_${entry.key}`,
              returnTo: entry.href,
            });
            return;
          }
          if (isMobile && isOpen) onToggle();
        };

        return (
          <li key={entry.key}>
            <Link
              href={entry.href}
              prefetch={false}
              onClick={handleItemClick}
              className={`group relative flex items-center ${itemGap} ${itemPadding} ${itemTextSize} rounded-xl ${alignClass} transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-magenta/60 focus-visible:ring-offset-2 ${focusOffsetClass} ${
                active
                  ? "bg-slate-100 font-semibold text-slate-900"
                  : "font-medium text-slate-600 hover:bg-slate-100/80 hover:text-slate-900"
              }`}
              title={entry.tooltip}
            >
              {active && (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute left-0 top-1/2 h-[60%] w-1 -translate-y-1/2 rounded-full bg-gradient-to-b from-brand-purple via-brand-magenta to-brand-orange"
                />
              )}

              <span
                aria-hidden="true"
                className={`relative flex ${iconSize} shrink-0 items-center justify-center rounded-xl ${
                  showLabels ? "" : "mx-auto"
                } ${collapsedIconShift} border border-slate-200/70 bg-white/90 ${showLabels ? "text-[16px]" : "text-[18px]"} transition-colors duration-200 ${
                  active
                    ? "border-brand-magenta/40 text-brand-purple shadow shadow-brand-magenta/10"
                    : "text-slate-500 group-hover:border-brand-magenta/35 group-hover:text-brand-purple group-hover:bg-white"
                }`}
              >
                {entry.icon}
                {locked && !showLabels && (
                  <Lock className="absolute right-1 top-1 h-3 w-3 text-brand-magenta/80" aria-hidden="true" />
                )}
              </span>

              {showLabels && (
                <>
                  <span
                    className={`truncate leading-tight ${
                      active ? "text-slate-900" : "text-slate-700 group-hover:text-slate-900"
                    }`}
                  >
                    {entry.label}
                  </span>
                  <span className="ml-auto flex items-center gap-2">
                    {locked && (
                      <>
                        <ProBadge />
                        <Lock className="h-4 w-4 text-brand-magenta/70" aria-hidden="true" />
                      </>
                    )}
                  </span>
                </>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );

  return (
    <aside
      className={`${asideBase} ${asideSurface} ${mobileClasses} ${desktopClasses} ${
        !mounted ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
      aria-label="Navegação do dashboard"
      aria-hidden={isMobile ? !isOpen : false}
    >
      <nav className={`flex-1 overflow-y-auto ${navPaddingX} pb-6 pt-6 scrollbar-hide`}>
        {renderNavList(primaryItems)}
        {!!secondaryItems.length && (
          <div className="mt-8 border-t border-slate-200/80 pb-0 pt-8">
            {renderNavList(secondaryItems)}
          </div>
        )}
      </nav>
    </aside>
  );
}
