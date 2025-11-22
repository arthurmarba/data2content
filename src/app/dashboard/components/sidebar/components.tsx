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
};

type SectionBlockProps = Omit<SidebarSectionListProps, "sections"> & {
  section: SidebarSection;
  index: number;
};

const isRouteActive = (pathname: string, href: string, exact?: boolean) => {
  if (pathname === href) return true;
  if (exact) return false;
  const normalized = href.endsWith("/") ? href : `${href}/`;
  return pathname.startsWith(normalized);
};

const pathMatches = (pathname: string, target: string) => {
  if (pathname === target) return true;
  const normalized = target.endsWith("/") ? target : `${target}/`;
  return pathname.startsWith(normalized);
};

const ProBadge = ({ className = "" }: { className?: string }) => (
  <span
    className={`inline-flex items-center rounded-full border border-brand-magenta/40 bg-brand-magenta/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-magenta ${className}`}
  >
    AGÊNCIA
  </span>
);

export const SidebarSectionList = ({
  sections,
  tokens,
  pathname,
  userId,
  interaction,
  badges,
}: SidebarSectionListProps) => (
  <div className="flex flex-col">
    {sections.map((section, index) => (
      <SectionBlock
        key={section.key}
        section={section}
        index={index}
        tokens={tokens}
        pathname={pathname}
        userId={userId}
        interaction={interaction}
        badges={badges}
      />
    ))}
  </div>
);

const SectionBlock = ({ section, index, tokens, pathname, userId, interaction, badges }: SectionBlockProps) => {
  const wrapperClass =
    index === 0 ? "" : "mt-6 border-t border-slate-200/80 pt-6";

  return (
    <section className={wrapperClass}>
      {tokens.showLabels && (
        <header className="mb-3 px-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600">{section.title}</p>
          {section.description && (
            <p className="text-[12px] text-slate-500/80">{section.description}</p>
          )}
        </header>
      )}

      <ul className="flex flex-col gap-1">
        {section.items.map((item) =>
          item.type === "group" ? (
            <SidebarGroupItem
              key={item.key}
              group={item}
              tokens={tokens}
              pathname={pathname}
              userId={userId}
              interaction={interaction}
              badges={badges}
            />
          ) : (
            <SidebarLinkItem
              key={item.key}
              item={item}
              tokens={tokens}
              pathname={pathname}
              interaction={interaction}
              badges={badges}
              source={`sidebar_item_${item.key}`}
            />
          )
        )}
      </ul>
    </section>
  );
};

const SidebarGroupItem = ({
  group,
  tokens,
  pathname,
  userId,
  interaction,
  badges,
}: {
  group: SidebarGroupNode;
  tokens: SidebarPresentationTokens;
  pathname: string;
  userId: string | null;
  interaction: SidebarInteractionState;
  badges?: Record<string, number>;
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

  return (
    <li>
      <button
        type="button"
        onClick={handleToggle}
        className={`group relative flex items-center ${tokens.itemGap} ${tokens.itemPadding} ${tokens.itemTextSize} rounded-xl ${tokens.alignClass} transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-magenta/60 focus-visible:ring-offset-2 ${tokens.focusOffsetClass} ${
          active
            ? "bg-white font-semibold text-slate-900 border border-slate-200 shadow-sm shadow-brand-magenta/10"
            : "font-medium text-slate-600 hover:bg-white/80 hover:text-slate-900 border border-transparent"
        }`}
        aria-expanded={expanded}
        aria-controls={`nav-group-${group.key}`}
        title={group.tooltip}
      >
        {tokens.showLabels && active && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-0 top-1/2 h-[60%] w-1 -translate-y-1/2 rounded-full bg-brand-magenta"
          />
        )}

        <span
          aria-hidden="true"
          className={`relative flex ${tokens.iconSize} shrink-0 items-center justify-center rounded-xl ${
            tokens.showLabels ? "" : "mx-auto"
          } ${tokens.collapsedIconShift} border border-slate-200 bg-white ${tokens.showLabels ? "text-[16px]" : "text-[18px]"} transition-colors duration-200 ${
            active
              ? "border-brand-magenta/40 text-brand-purple shadow shadow-brand-magenta/15"
              : "text-slate-500 group-hover:border-brand-magenta/35 group-hover:text-brand-purple group-hover:bg-white"
          } ${!tokens.showLabels && active ? "ring-2 ring-brand-magenta/35 shadow shadow-brand-magenta/20" : ""} ${
            !tokens.showLabels && !active ? "hover:shadow hover:shadow-brand-magenta/10" : ""
          }`}
        >
          {group.icon}
          {locked && !tokens.showLabels && (
            <Lock className="absolute right-1 top-1 h-3 w-3 text-brand-magenta/80" aria-hidden="true" />
          )}
        </span>

        {tokens.showLabels && (
          <span className={`truncate leading-tight ${active ? "text-slate-900" : "text-slate-700 group-hover:text-slate-900"}`}>
            {group.label}
          </span>
        )}

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
                className={`h-4 w-4 text-slate-500 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
                aria-hidden="true"
              />
            )}
          </span>
        )}
      </button>

      <div
        id={`nav-group-${group.key}`}
        className={`overflow-hidden transition-[max-height,opacity] duration-200 ease-out ${
          expanded && tokens.showLabels ? "opacity-100" : "opacity-0"
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
                badges={badges}
                showLabels={tokens.showLabels}
              />
            ))}
          </ul>
        )}
      </div>
    </li>
  );
};

const SidebarLinkItem = ({
  item,
  tokens,
  pathname,
  interaction,
  badges,
  source,
  showLabels,
}: {
  item: SidebarChildNode;
  tokens: SidebarPresentationTokens;
  pathname: string;
  interaction: SidebarInteractionState;
  badges?: Record<string, number>;
  source: string;
  showLabels?: boolean;
}) => {
  const active = isRouteActive(pathname, item.href, item.exact);
  const locked = Boolean(item.paywallContext);
  const hideLockBadge = Boolean(item.hideLockBadge);
  const showActiveIndicator = active && !item.hideActiveIndicator && tokens.showLabels;
  const badgeCount = badges?.[item.key] ?? 0;
  const showBadge = badgeCount > 0;

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

  return (
    <li>
      <Link
        href={item.href}
        prefetch={false}
        onClick={handleClick}
        className={`group relative flex items-center ${tokens.itemGap} ${tokens.itemPadding} ${tokens.itemTextSize} rounded-xl ${tokens.alignClass} transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-magenta/60 focus-visible:ring-offset-2 ${tokens.focusOffsetClass} ${
          active
            ? "bg-white font-semibold text-slate-900 border border-slate-200 shadow-sm shadow-brand-magenta/10"
            : "font-medium text-slate-600 hover:bg-white/85 hover:text-slate-900 border border-transparent"
        } ${!tokens.showLabels ? "px-0.5 py-2 justify-center" : ""}`}
        title={item.tooltip}
      >
        {showActiveIndicator && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-0 top-1/2 h-[60%] w-1 -translate-y-1/2 rounded-full bg-brand-magenta"
          />
        )}

        <span
          aria-hidden="true"
          className={`relative flex ${tokens.iconSize} shrink-0 items-center justify-center rounded-xl ${
            tokens.showLabels ? "" : "mx-auto"
          } ${tokens.collapsedIconShift} border border-slate-200 bg-white ${tokens.showLabels ? "text-[16px]" : "text-[18px]"} transition-colors duration-200 ${
            active
              ? "border-brand-magenta/40 text-brand-purple shadow shadow-brand-magenta/15"
              : "text-slate-500 group-hover:border-brand-magenta/35 group-hover:text-brand-purple group-hover:bg-white"
          } ${!tokens.showLabels && active ? "ring-2 ring-brand-magenta/35 shadow shadow-brand-magenta/20" : ""} ${
            !tokens.showLabels && !active ? "hover:shadow hover:shadow-brand-magenta/10" : ""
          }`}
        >
          {item.icon}
          {showBadge && (
            <span className="absolute -top-1 -right-1 min-w-[18px] rounded-full bg-red-500 px-1.5 py-[1px] text-[10px] font-bold leading-4 text-white shadow">
              {badgeCount > 99 ? "99+" : badgeCount}
            </span>
          )}
          {locked && !hideLockBadge && !tokens.showLabels && (
            <Lock className="absolute right-1 top-1 h-3 w-3 text-brand-magenta/80" aria-hidden="true" />
          )}
        </span>

        {tokens.showLabels && (
          <>
            <span className={`truncate leading-tight ${active ? "text-slate-900" : "text-slate-700 group-hover:text-slate-900"}`}>
              {item.label}
            </span>
            <span className="ml-auto flex items-center gap-2">
              {showBadge && (
                <span className="inline-flex min-w-[22px] items-center justify-center rounded-full bg-red-500 px-2 py-[2px] text-[11px] font-bold leading-4 text-white shadow">
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
          </>
        )}
      </Link>
    </li>
  );
};

const SidebarChildLink = ({
  item,
  pathname,
  interaction,
  focusOffsetClass,
  badges,
  showLabels,
}: {
  item: SidebarChildNode;
  pathname: string;
  interaction: SidebarInteractionState;
  focusOffsetClass: string;
  badges?: Record<string, number>;
  showLabels?: boolean;
}) => {
  const active = isRouteActive(pathname, item.href, item.exact);
  const locked = Boolean(item.paywallContext);
  const hideLockBadge = Boolean(item.hideLockBadge);
  const showActiveIndicator = active && !item.hideActiveIndicator && showLabels;
  const badgeCount = badges?.[item.key] ?? 0;
  const showBadge = badgeCount > 0;

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

  return (
    <li>
      <Link
        href={item.href}
        prefetch={false}
        onClick={handleClick}
        className={`group relative flex items-center gap-3 rounded-lg px-4 py-2.5 text-[13px] font-medium transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-magenta/60 focus-visible:ring-offset-2 ${focusOffsetClass} ${
          active
            ? "bg-white text-slate-900 border border-slate-200 shadow-sm shadow-brand-magenta/10"
            : "text-slate-600 hover:bg-white/80 hover:text-slate-900 border border-transparent"
        } ${!showLabels ? "justify-center px-0.5" : ""}`}
        title={item.tooltip}
      >
        {showActiveIndicator && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-0 top-1/2 h-[60%] w-1 -translate-y-1/2 rounded-full bg-brand-magenta"
          />
        )}

        <span
          aria-hidden="true"
          className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-[13px] text-slate-600 transition-colors duration-200 group-hover:border-brand-magenta/35 group-hover:text-brand-purple"
        >
          {item.icon}
          {showBadge && (
            <span className="absolute -top-1 -right-1 min-w-[16px] rounded-full bg-red-500 px-1 py-[1px] text-[9px] font-bold leading-4 text-white shadow">
              {badgeCount > 99 ? "99+" : badgeCount}
            </span>
          )}
          {locked && !hideLockBadge && (
            <Lock className="absolute right-1 top-1 h-3 w-3 text-brand-magenta/80" aria-hidden="true" />
          )}
        </span>

        <span className={`truncate leading-tight ${active ? "text-slate-900" : "text-slate-700 group-hover:text-slate-900"}`}>
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
};
