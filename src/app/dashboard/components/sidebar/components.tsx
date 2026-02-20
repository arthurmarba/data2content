import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, Lock } from "lucide-react";
import type { PaywallContext } from "@/types/paywall";
import { useUserScopedBoolean } from "@/hooks/useUserScopedBoolean";
import { track } from "@/lib/track";
import type { SidebarChildNode, SidebarGroupNode, SidebarSection } from "./types";

export type SidebarPaywallHandler = (
  context: PaywallContext,
  detail?: { source?: string | null; returnTo?: string | null; proposalId?: string | null }
) => void;

export type SidebarPresentationTokens = {
  showLabels: boolean;
  alignClass: string;
  itemPadding: string;
  itemGap: string;
  itemTextSize: string;
  iconSize: string;
  collapsedIconShift: string;
  focusOffsetClass: string;
};

export type SidebarInteractionState = {
  isMobile: boolean;
  isOpen: boolean;
  onItemNavigate: () => void;
  openPaywall: SidebarPaywallHandler;
};

type SidebarSectionListProps = {
  sections: SidebarSection[];
  tokens: SidebarPresentationTokens;
  pathname: string;
  userId: string | null;
  interaction: SidebarInteractionState;
  badges?: Record<string, number>;
  onLinkIntent?: (href: string) => void;
};

const normalizePath = (value: string) => (value.endsWith("/") ? value.slice(0, -1) : value);

const startsWithSegment = (pathname: string, href: string) => {
  const path = normalizePath(pathname);
  const target = normalizePath(href);
  return path === target || path.startsWith(`${target}/`);
};

const isRouteActive = (pathname: string, href: string, exact?: boolean) => {
  const matches = startsWithSegment(pathname, href);
  if (!matches) return false;
  if (exact) {
    return normalizePath(pathname) === normalizePath(href);
  }
  return true;
};

const pathMatches = (pathname: string, target: string) => startsWithSegment(pathname, target);

const ProBadge = ({ className = "" }: { className?: string }) => (
  <span
    className={`inline-flex items-center rounded-full border border-brand-magenta/40 bg-brand-magenta/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-magenta ${className}`}
  >
    AGÊNCIA
  </span>
);

const renderIcon = (iconSet: SidebarChildNode["icon"], active: boolean, className: string) => {
  const Icon = active ? iconSet.solid : iconSet.outline;
  return <Icon className={className} aria-hidden="true" />;
};

export const SidebarSectionList = ({
  sections,
  tokens,
  pathname,
  userId,
  interaction,
  badges,
  onLinkIntent,
}: SidebarSectionListProps) => {
  const flatItems = sections.flatMap((section) => section.items);
  const middleItems = flatItems;

  const renderNode = (item: SidebarSection["items"][number]) =>
    item.type === "group" ? (
      <SidebarGroupItem
        key={item.key}
        group={item}
        tokens={tokens}
        pathname={pathname}
        userId={userId}
        interaction={interaction}
        badges={badges}
        onLinkIntent={onLinkIntent}
      />
    ) : (
      <SidebarLinkItem
        key={item.key}
        item={item}
        tokens={tokens}
        pathname={pathname}
        interaction={interaction}
        badgeCount={badges?.[item.key] ?? 0}
        onLinkIntent={onLinkIntent}
        source={`sidebar_item_${item.key}`}
      />
    );

  return (
    <div className="flex min-h-full flex-col">
      <ul
        className={
          interaction.isMobile
            ? "flex flex-col gap-2 pb-2"
            : "flex flex-1 -translate-y-12 flex-col justify-center gap-3"
        }
      >
        {middleItems.map((item) => renderNode(item))}
      </ul>
    </div>
  );
};

const SidebarGroupItem = ({
  group,
  tokens,
  pathname,
  userId,
  interaction,
  badges,
  onLinkIntent,
  insertSeparator,
}: {
  group: SidebarGroupNode;
  tokens: SidebarPresentationTokens;
  pathname: string;
  userId: string | null;
  interaction: SidebarInteractionState;
  badges?: Record<string, number>;
  onLinkIntent?: (href: string) => void;
  insertSeparator?: boolean;
}) => {
  const persistenceKey = group.statePersistence?.key ?? `nav:${group.key}:collapsed`;
  const defaultCollapsed = group.statePersistence?.defaultCollapsed ?? false;
  const [collapsed, setCollapsed, hydrated] = useUserScopedBoolean(persistenceKey, userId, defaultCollapsed);
  const expanded = hydrated ? !collapsed : false;
  const locked = Boolean(group.paywallContext);
  const active = group.children.some((child) => isRouteActive(pathname, child.href, child.exact));
  const returnTo = group.children[0]?.href ?? "/dashboard";
  const childListRef = useRef<HTMLUListElement | null>(null);
  const [contentHeight, setContentHeight] = useState(0);

  useEffect(() => {
    if (!group.autoExpandPaths?.length || !hydrated || locked) return;
    const shouldExpand = group.autoExpandPaths.some((target) => pathMatches(pathname, target));
    if (shouldExpand && collapsed) {
      setCollapsed(false);
    }
  }, [collapsed, group.autoExpandPaths, hydrated, locked, pathname, setCollapsed]);

  useEffect(() => {
    if (!tokens.showLabels) {
      setContentHeight(0);
      return;
    }

    const node = childListRef.current;
    if (!node) return;

    const updateHeight = () => {
      setContentHeight(node.scrollHeight);
    };

    updateHeight();

    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => updateHeight())
        : null;

    if (observer) observer.observe(node);

    const handleWindowResize = () => updateHeight();
    window.addEventListener("resize", handleWindowResize);

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", handleWindowResize);
    };
  }, [group.children, tokens.showLabels]);

  const handleToggle = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (locked && group.paywallContext) {
      interaction.openPaywall(group.paywallContext, {
        source: `sidebar_group_${group.key}`,
        returnTo,
      });
      return;
    }
    setCollapsed((prev) => {
      const next = !prev;
      track("nav_group_toggled", { group: group.key, expanded: !next });
      return next;
    });
  };

  const iconColor = active ? "text-gray-900" : "text-gray-500 group-hover:text-gray-900";
  const labelTransition = tokens.showLabels
    ? "max-w-[200px] opacity-100 translate-x-0"
    : "max-w-0 opacity-0 -translate-x-1";
  const labelBase =
    "overflow-hidden whitespace-nowrap leading-tight transition-[max-width,opacity,transform] duration-200";

  return (
    <li className={insertSeparator ? "mt-4 pt-2 border-t border-gray-100/80" : ""}>
      <button
        type="button"
        onClick={handleToggle}
        className={`group relative flex items-center ${tokens.itemGap} ${tokens.itemPadding} ${tokens.itemTextSize} ${tokens.alignClass} rounded-lg transition-colors duration-150 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-300 focus-visible:ring-offset-2 ${tokens.focusOffsetClass}`}
        aria-expanded={expanded}
        aria-controls={`nav-group-${group.key}`}
        aria-label={!tokens.showLabels ? group.label : undefined}
        title={group.tooltip || group.label}
      >
        <span
          aria-hidden="true"
          className={`relative flex h-7 w-7 shrink-0 items-center justify-center ${tokens.collapsedIconShift}`}
        >
          {renderIcon(group.icon, active, `${tokens.iconSize} ${iconColor}`)}
          {locked && !tokens.showLabels && (
            <Lock className="absolute -right-1 -top-1 h-3 w-3 text-brand-magenta/80" aria-hidden="true" />
          )}
        </span>

        <span
          className={`${labelBase} ${labelTransition} ${active ? "font-semibold text-gray-900" : "font-medium text-gray-800 group-hover:text-gray-900"}`}
        >
          {group.label}
        </span>

        {tokens.showLabels && (
          <span className="ml-auto flex items-center gap-2">
            {locked && (
              <>
                <ProBadge />
                <Lock className="h-4 w-4 text-brand-magenta/70" aria-hidden="true" />
              </>
            )}
            {!locked && (
              <ChevronDown
                className={`h-4 w-4 text-gray-500 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
                aria-hidden="true"
              />
            )}
          </span>
        )}
      </button>

      <div
        id={`nav-group-${group.key}`}
        className={`overflow-hidden transition-[max-height,opacity] duration-200 ease-out ${expanded && tokens.showLabels ? "opacity-100" : "opacity-0"
          } ${tokens.showLabels ? "pl-2" : ""}`}
        style={
          tokens.showLabels
            ? { maxHeight: expanded ? contentHeight || 0 : 0 }
            : undefined
        }
      >
        {tokens.showLabels && (
          <ul ref={childListRef} className="mt-0.5 flex flex-col gap-0.5">
            {group.children.map((child) => (
              <SidebarChildLink
                key={child.key}
                item={child}
                pathname={pathname}
                interaction={interaction}
                focusOffsetClass={tokens.focusOffsetClass}
                badgeCount={badges?.[child.key] ?? 0}
                onLinkIntent={onLinkIntent}
              />
            ))}
          </ul>
        )}
      </div>
    </li>
  );
};

const SidebarLinkItem = React.memo(function SidebarLinkItem({
  item,
  tokens,
  pathname,
  interaction,
  badgeCount = 0,
  onLinkIntent,
  source,
  insertSeparator,
}: {
  item: SidebarChildNode;
  tokens: SidebarPresentationTokens;
  pathname: string;
  interaction: SidebarInteractionState;
  badgeCount?: number;
  onLinkIntent?: (href: string) => void;
  source: string;
  insertSeparator?: boolean;
}) {
  const active = isRouteActive(pathname, item.href, item.exact);
  const locked = Boolean(item.paywallContext);
  const hideLockBadge = Boolean(item.hideLockBadge);
  const showBadge = badgeCount > 0;
  const iconColor = active ? "text-gray-900" : "text-gray-500 group-hover:text-gray-900";
  const labelTransition = tokens.showLabels
    ? "max-w-full opacity-100 translate-x-0"
    : "max-w-0 opacity-0 -translate-x-1";
  const labelBase =
    "overflow-hidden whitespace-nowrap leading-tight transition-[max-width,opacity,transform] duration-200";

  const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (locked && item.paywallContext) {
      event.preventDefault();
      interaction.openPaywall(item.paywallContext, {
        source,
        returnTo: item.href,
      });
      return;
    }
    interaction.onItemNavigate();
  };
  const handleIntent = () => {
    if (locked) return;
    onLinkIntent?.(item.href);
  };

  return (
    <li className={insertSeparator ? "mt-4 pt-2 border-t border-gray-100/80" : ""}>
      <Link
        href={item.href}
        prefetch={false}
        onClick={handleClick}
        onMouseEnter={handleIntent}
        onFocus={handleIntent}
        onTouchStart={handleIntent}
        className={`group relative flex items-center ${tokens.itemGap} ${tokens.itemPadding} ${tokens.itemTextSize} ${tokens.alignClass} rounded-lg transition-colors duration-150 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-300 focus-visible:ring-offset-2 ${tokens.focusOffsetClass}`}
        aria-current={active ? "page" : undefined}
        aria-label={!tokens.showLabels ? item.label : undefined}
        title={item.tooltip || item.label}
      >
        <span
          aria-hidden="true"
          className={`relative flex h-7 w-7 shrink-0 items-center justify-center ${tokens.collapsedIconShift}`}
        >
          {renderIcon(item.icon, active, `${tokens.iconSize} ${iconColor}`)}
          {showBadge && !tokens.showLabels && (
            <span className="absolute -top-1 -right-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 py-[1px] text-[10px] font-bold leading-none text-white shadow">
              {badgeCount > 99 ? "99+" : badgeCount}
            </span>
          )}

          {locked && !hideLockBadge && !tokens.showLabels && (
            <Lock className="absolute -right-1 -top-1 h-3 w-3 text-brand-magenta/80" aria-hidden="true" />
          )}
        </span>

        <span
          className={`${labelBase} ${labelTransition} ${active ? "font-semibold text-gray-900" : "font-medium text-gray-800 group-hover:text-gray-900"}`}
        >
          {item.label}
        </span>
        {tokens.showLabels && (
          <span className="ml-auto flex items-center gap-2">
            {showBadge && (
              <span className="inline-flex h-[20px] min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 py-[1px] text-[11px] font-bold leading-none text-white shadow">
                {badgeCount > 99 ? "99+" : badgeCount}
              </span>
            )}

            {locked && !hideLockBadge && (
              <>
                <ProBadge />
                <Lock className="h-4 w-4 text-brand-magenta/70" aria-hidden="true" />
              </>
            )}
          </span>
        )}
      </Link>
    </li>
  );
});

const SidebarChildLink = React.memo(function SidebarChildLink({
  item,
  pathname,
  interaction,
  focusOffsetClass,
  badgeCount = 0,
  onLinkIntent,
}: {
  item: SidebarChildNode;
  pathname: string;
  interaction: SidebarInteractionState;
  focusOffsetClass: string;
  badgeCount?: number;
  onLinkIntent?: (href: string) => void;
}) {
  const active = isRouteActive(pathname, item.href, item.exact);
  const locked = Boolean(item.paywallContext);
  const hideLockBadge = Boolean(item.hideLockBadge);
  const showBadge = badgeCount > 0;
  const iconColor = active ? "text-gray-900" : "text-gray-500 group-hover:text-gray-900";

  const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (locked && item.paywallContext) {
      event.preventDefault();
      interaction.openPaywall(item.paywallContext, {
        source: `sidebar_child_${item.key}`,
        returnTo: item.href,
      });
      return;
    }
    interaction.onItemNavigate();
  };
  const handleIntent = () => {
    if (locked) return;
    onLinkIntent?.(item.href);
  };

  return (
    <li>
      <Link
        href={item.href}
        prefetch={false}
        onClick={handleClick}
        onMouseEnter={handleIntent}
        onFocus={handleIntent}
        onTouchStart={handleIntent}
        className={`group relative flex items-center gap-3 rounded-md px-3 py-2.5 text-[15px] font-medium transition-colors duration-150 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-300 focus-visible:ring-offset-2 ${focusOffsetClass}`}
        aria-current={active ? "page" : undefined}
        title={item.tooltip || item.label}
      >
        <span
          aria-hidden="true"
          className="relative inline-flex h-7 w-7 shrink-0 items-center justify-center"
        >
          {renderIcon(item.icon, active, `h-6 w-6 ${iconColor}`)}
          {locked && !hideLockBadge && (
            <Lock className="absolute -right-1 -top-1 h-3 w-3 text-brand-magenta/80" aria-hidden="true" />
          )}
        </span>


        <span className={`leading-tight whitespace-nowrap ${active ? "font-semibold text-gray-900" : "font-medium text-gray-800 group-hover:text-gray-900"}`}>
          {item.label}
        </span>

        {showBadge && (
          <span className="ml-auto inline-flex min-w-[20px] items-center justify-center rounded-full bg-red-500 px-2 py-[1px] text-[10px] font-bold leading-4 text-white shadow">
            {badgeCount > 99 ? "99+" : badgeCount}
          </span>
        )}

        {locked && !hideLockBadge && <ProBadge />}
      </Link>
    </li>
  );
});
