"use client";

import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { FaBars, FaCreditCard } from "react-icons/fa";
import { useSidebar } from "../dashboard/context/SidebarContext";
import {
  useHeaderConfig,
  type HeaderCta,
  type HeaderVariant,
} from "../dashboard/context/HeaderContext";
import { useHeaderVisibility } from "@/hooks/useHeaderVisibility";
import { MAIN_DASHBOARD_ROUTE } from "@/constants/routes";
import { normalizePlanStatus, isPlanActiveLike } from "@/utils/planStatus";

const TAP_DEBUG =
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).has("tapdebug");

const IS_IOS_SAFARI =
  typeof navigator !== "undefined" &&
  /iP(hone|od|ad)/.test(navigator.userAgent) &&
  /Safari/.test(navigator.userAgent) &&
  !/CriOS|FxiOS/.test(navigator.userAgent);

type ActiveElementInfo = {
  tagName: string;
  id: string | null;
  className: string | null;
};

function getActiveElementInfo(): ActiveElementInfo | null {
  if (typeof document === "undefined") return null;
  const active = document.activeElement as HTMLElement | null;
  if (!active) return null;
  return {
    tagName: active.tagName,
    id: active.id || null,
    className: active.className ? String(active.className) : null,
  };
}

function getViewportHeight() {
  if (typeof window === "undefined") return null;
  return window.visualViewport?.height ?? null;
}

function logTapDebug(label: string, payload: Record<string, unknown>) {
  if (!TAP_DEBUG) return;
  console.log(`[tapdebug] ${label}`, payload);
}

function buildTapDebugPayload(
  event: React.SyntheticEvent<HTMLElement> | undefined,
  suppressNextClick: boolean,
  didBlur: boolean | null
) {
  return {
    type: event?.type ?? null,
    target: event?.target ?? null,
    currentTarget: event?.currentTarget ?? null,
    activeElement: getActiveElementInfo(),
    viewportHeight: getViewportHeight(),
    suppressNextClick,
    didBlur,
  };
}

function runAfterKeyboardSettles(action: () => void) {
  if (typeof window === "undefined") {
    action();
    return;
  }
  const vv = window.visualViewport;
  let done = false;
  let timeoutId: number | null = null;

  function run() {
    if (done) return;
    done = true;
    if (timeoutId !== null) {
      window.clearTimeout(timeoutId);
      timeoutId = null;
    }
    vv?.removeEventListener("resize", handleResize);
    window.requestAnimationFrame(() => window.requestAnimationFrame(action));
  }

  function handleResize() {
    run();
  }

  vv?.addEventListener("resize", handleResize, { once: true });
  timeoutId = window.setTimeout(run, 450);
}

interface SessionUser {
  id?: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

function buildLayoutClasses(
  variant: HeaderVariant,
  condensed: boolean,
  hasMobileTitle: boolean
) {
  const base = [
    "px-3",
    "sm:px-6",
    "flex",
    "flex-wrap",
    "gap-y-1.5",
    "sm:flex-nowrap",
    "items-center",
    "justify-between",
    "gap-x-3",
    "w-full",
  ];
  if (variant === "immersive") {
    base.push(hasMobileTitle ? "min-h-[58px] sm:min-h-[72px]" : "min-h-[68px] sm:min-h-[72px]");
    base.push(condensed ? "py-2 sm:py-2.5" : "py-2.5 sm:py-3.5");
  } else if (variant === "compact") {
    base.push(hasMobileTitle ? "min-h-[50px] sm:min-h-[72px]" : "min-h-[64px] sm:min-h-[72px]");
    base.push(condensed ? "py-0.5 sm:py-2" : hasMobileTitle ? "py-0.5 sm:py-2.5" : "py-2 sm:py-2.5");
  } else if (condensed) {
    base.push(hasMobileTitle ? "min-h-[60px] sm:min-h-[64px]" : "min-h-[64px]");
    base.push("py-1.5", "sm:py-2", "h-16");
  } else {
    base.push(hasMobileTitle ? "min-h-[62px] sm:min-h-[72px]" : "min-h-[72px]");
    base.push(hasMobileTitle ? "py-1.5 sm:py-2" : "py-2", "h-[72px]");
  }

  return base.join(" ");
}

function buildShellClasses(
  variant: HeaderVariant,
  sticky: boolean,
  condensed: boolean,
  mobileDocked: boolean
) {
  const docked = sticky && mobileDocked;
  const basePosition = docked
    ? "fixed inset-x-0 bottom-0"
    : sticky
      ? "fixed inset-x-0 top-0"
      : "relative";

  const base = [
    basePosition,
    // ↓ z-index menor que a sidebar (que usa lg:z-[200])
    "z-30",
    "w-full",
    "transition-all",
    "duration-200",
    "will-change-[background,box-shadow,transform]",
  ];

  if (variant === "immersive") {
    base.push(
      "backdrop-blur-xl supports-[backdrop-filter]:bg-white/68",
      condensed ? "bg-white/72 shadow-[0_12px_32px_rgba(24,24,27,0.08)]" : "bg-transparent shadow-none"
    );
  } else if (variant === "minimal") {
    base.push("bg-transparent");
  } else {
    const shadowClass = condensed
      ? "shadow-[0_12px_30px_rgba(24,24,27,0.06)]"
      : "shadow-none";
    base.push(
      "border-none",
      condensed ? "bg-white/76 backdrop-blur-xl" : "bg-transparent",
      shadowClass
    );
  }

  return base.join(" ");
}

function HeaderCtaButton({ cta }: { cta: HeaderCta }) {
  if (!cta) return null;

  const content = (
    <span className="inline-flex items-center gap-2 font-semibold text-xs sm:text-sm">
      {cta.icon}
      {cta.label}
    </span>
  );

  if (cta.href) {
    return (
      <Link
        href={cta.href}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gray-900 px-3 py-2 text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 sm:w-auto sm:px-4"
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      onClick={cta.onClick}
      className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gray-900 px-3 py-2 text-white shadow-sm transition hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 sm:w-auto sm:px-4"
    >
      {content}
    </button>
  );
}

export default function Header() {
  const { data: session } = useSession();
  const rawSessionUser = session?.user as (SessionUser & { planStatus?: string | null }) | undefined;
  const normalizedPlanStatus = normalizePlanStatus(rawSessionUser?.planStatus);
  const planActive = isPlanActiveLike(normalizedPlanStatus);
  const { config } = useHeaderConfig();
  const { toggleSidebar } = useSidebar();
  const headerRef = useRef<HTMLElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const lastHeightRef = useRef<number>(64);
  const suppressNextClickRef = useRef(false);
  const suppressTimeoutRef = useRef<number | null>(null);

  const dismissActiveInput = useCallback(() => {
    if (typeof document === "undefined") return false;
    const active = document.activeElement as HTMLElement | null;
    if (!active) return false;
    const tagName = active.tagName;
    if (tagName === "INPUT" || tagName === "TEXTAREA" || active.isContentEditable) {
      active.blur();
      return true;
    }
    return false;
  }, []);

  const triggerTouchAction = useCallback(
    (action: () => void, event: React.SyntheticEvent<HTMLElement>) => {
      if (suppressNextClickRef.current) {
        logTapDebug(
          "triggerTouchAction:suppressed",
          buildTapDebugPayload(event, suppressNextClickRef.current, null)
        );
        return;
      }
      const didBlur = dismissActiveInput();
      if (didBlur) {
        suppressNextClickRef.current = true;
      }
      logTapDebug(
        "triggerTouchAction",
        buildTapDebugPayload(event, suppressNextClickRef.current, didBlur)
      );
      if (!didBlur) return;
      event.preventDefault();
      if (typeof window !== "undefined") {
        if (suppressTimeoutRef.current) {
          window.clearTimeout(suppressTimeoutRef.current);
        }
        if (IS_IOS_SAFARI) {
          suppressTimeoutRef.current = window.setTimeout(() => {
            suppressNextClickRef.current = false;
            suppressTimeoutRef.current = null;
          }, 600);
        } else {
          const vv = window.visualViewport;
          let cleared = false;
          const clearSuppression = () => {
            if (cleared) return;
            cleared = true;
            suppressNextClickRef.current = false;
            if (suppressTimeoutRef.current) {
              window.clearTimeout(suppressTimeoutRef.current);
              suppressTimeoutRef.current = null;
            }
            vv?.removeEventListener("resize", clearSuppression);
          };
          vv?.addEventListener("resize", clearSuppression, { once: true });
          suppressTimeoutRef.current = window.setTimeout(clearSuppression, 600);
        }
      }
      if (IS_IOS_SAFARI) {
        runAfterKeyboardSettles(() => {
          action();
        });
      }
    },
    [dismissActiveInput]
  );

  const handlePointerActivation = useCallback(
    (action: () => void, event: React.PointerEvent<HTMLElement>) => {
      if (event.pointerType === "mouse") return;
      triggerTouchAction(action, event);
    },
    [triggerTouchAction]
  );

  const runWithClickSuppression = useCallback(
    (action: () => void, event?: React.SyntheticEvent<HTMLElement>) => {
      logTapDebug(
        "runWithClickSuppression",
        buildTapDebugPayload(event, suppressNextClickRef.current, null)
      );
      if (suppressNextClickRef.current) {
        suppressNextClickRef.current = false;
        if (suppressTimeoutRef.current) {
          window.clearTimeout(suppressTimeoutRef.current);
          suppressTimeoutRef.current = null;
        }
        return;
      }
      action();
    },
    []
  );

  const condensed = useHeaderVisibility({
    disabled: !config.condensedOnScroll,
    threshold: config.variant === "immersive" ? 96 : 40,
  });

  const updateHeaderMetrics = useCallback(() => {
    const shell = headerRef.current;
    if (!shell) return;

    const inner = innerRef.current;
    const innerHeight = inner?.offsetHeight ?? shell.offsetHeight ?? 0;

    let safeTop = 0;
    try {
      const rootStyles = getComputedStyle(document.documentElement);
      const satValue = rootStyles.getPropertyValue("--sat").trim();
      if (satValue) {
        const parsed = Number.parseFloat(satValue);
        if (Number.isFinite(parsed)) {
          safeTop = parsed;
        }
      }
    } catch {
      safeTop = 0;
    }

    let total = innerHeight + safeTop;
    if (!Number.isFinite(total) || total <= 0) {
      total = lastHeightRef.current;
    } else if (total > 220 && lastHeightRef.current > 0) {
      total = lastHeightRef.current;
    } else {
      lastHeightRef.current = total;
    }

    const sanitized = Math.min(Math.max(total, 56), 96);
    document.documentElement.style.setProperty("--header-h", `${Math.round(sanitized)}px`);
  }, []);

  useEffect(() => {
    updateHeaderMetrics();
    const shell = headerRef.current;
    if (!shell) return;
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => updateHeaderMetrics());
    ro.observe(shell);
    const inner = innerRef.current;
    if (inner) ro.observe(inner);
    return () => ro.disconnect();
  }, [updateHeaderMetrics]);

  useEffect(() => {
    return () => {
      if (suppressTimeoutRef.current) {
        window.clearTimeout(suppressTimeoutRef.current);
        suppressTimeoutRef.current = null;
      }
    };
  }, []);

  const isDockedToBottom = Boolean(config.sticky && config.mobileDocked);
  const effectiveTitleValue = config.title ?? null;
  const effectiveSubtitleValue = config.subtitle ?? null;
  const effectiveMobileTitleValue = config.mobileTitle ?? effectiveTitleValue;
  const effectiveMobileSubtitleValue = config.mobileSubtitle ?? effectiveSubtitleValue;
  const effectiveMobileAccessory = config.mobileAccessory ?? null;
  const hasMobileTitle = Boolean(effectiveMobileTitleValue || effectiveMobileSubtitleValue);
  const shellClasses = buildShellClasses(config.variant, config.sticky, condensed, config.mobileDocked);
  const innerClasses = buildLayoutClasses(config.variant, condensed, hasMobileTitle);

  const effectiveCta = useMemo<HeaderCta | null>(() => {
    return null;
  }, []);

  const defaultProBadge = useMemo(() => {
    if (!planActive) return null;
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold leading-none text-emerald-700"
        title="Plano Pro ativo"
      >
        <span aria-hidden="true">✅</span>
        <span className="truncate">Plano Pro ativo</span>
      </span>
    );
  }, [planActive]);

  const effectiveExtraContent = config.extraContent ?? defaultProBadge;

  const desktopTitleBlock = useMemo(() => {
    if (!effectiveTitleValue && !effectiveSubtitleValue) return null;
    return (
      <div className="flex min-w-0 flex-col text-center">
        {effectiveTitleValue && (
          <span className="truncate text-sm font-semibold tracking-[-0.01em] text-zinc-900">
            {effectiveTitleValue}
          </span>
        )}
        {effectiveSubtitleValue && (
          <span className="truncate text-[11px] text-zinc-500">
            {effectiveSubtitleValue}
          </span>
        )}
      </div>
    );
  }, [effectiveSubtitleValue, effectiveTitleValue]);

  const mobileTitleBlock = useMemo(() => {
    if (!effectiveMobileTitleValue && !effectiveMobileSubtitleValue) return null;
    return (
      <div className="flex min-w-0 max-w-full flex-col items-center text-center">
        {effectiveMobileTitleValue ? (
          <span className="truncate text-[0.95rem] font-semibold tracking-[-0.02em] text-zinc-900">
            {effectiveMobileTitleValue}
          </span>
        ) : null}
        {effectiveMobileSubtitleValue ? (
          <span className="truncate text-[11px] text-zinc-500">
            {effectiveMobileSubtitleValue}
          </span>
        ) : null}
      </div>
    );
  }, [effectiveMobileSubtitleValue, effectiveMobileTitleValue]);

  const renderLogo = (
    <Link
      href={MAIN_DASHBOARD_ROUTE}
      aria-label="Início"
      className={`group items-center gap-2 text-brand-dark ${config.hideBrandLogoOnMobile ? "hidden lg:flex" : "flex"}`}
    >
      <div className="relative h-9 w-9 overflow-hidden rounded-[16px] bg-[linear-gradient(135deg,#ec4899,#fb7185)] shadow-[0_16px_34px_rgba(236,72,153,0.24)] ring-1 ring-white/60">
        <Image
          src="/images/Colorido-Simbolo.png"
          alt="Data2Content"
          fill
          className="object-contain object-center transition-opacity group-hover:opacity-90 scale-[0.72]"
          priority
        />
      </div>
      <span className="sr-only">data2content</span>
    </Link>
  );

  return (
    <header
      ref={headerRef}
      className={shellClasses}
      style={
        isDockedToBottom
          ? { paddingBottom: "var(--sab, 0px)" }
          : config.sticky
            ? { paddingTop: "var(--sat, 0px)" }
            : undefined
      }
      aria-label="Barra superior do dashboard"
    >
      {/* -> CORREÇÃO: A classe pointer-events-auto foi removida deste container principal */}
      <div ref={innerRef} className={`relative ${innerClasses}`}>
        {/* -> CORREÇÃO: E aplicada diretamente nos containers filhos que precisam ser clicáveis */}
        <div className={`order-1 flex min-w-0 items-center pointer-events-auto sm:order-1 sm:flex-none ${hasMobileTitle ? "gap-1.5" : "gap-3"}`}>
          {config.showSidebarToggle && (
            <motion.button
              data-dashboard-sidebar-toggle="true"
              onPointerDown={(event) => handlePointerActivation(() => toggleSidebar(), event)}
              onClick={(event) => runWithClickSuppression(() => toggleSidebar(), event)}
              whileTap={{ scale: 0.92 }}
              transition={{ duration: 0.12, ease: "easeOut" }}
              className={`flex items-center justify-center rounded-full border border-white/70 bg-white/55 text-zinc-600 shadow-[0_10px_20px_rgba(24,24,27,0.04)] transition-colors hover:bg-white hover:text-zinc-900 touch-manipulation lg:hidden ${
                hasMobileTitle ? "h-8.5 w-8.5" : "h-10 w-10"
              }`}
              aria-label="Alternar menu lateral"
              title="Menu"
            >
              <FaBars className="h-5 w-5" />
            </motion.button>
          )}
          {renderLogo}
        </div>

        {mobileTitleBlock ? (
          <div className="pointer-events-none absolute inset-x-11 top-1/2 z-[1] flex -translate-y-1/2 justify-center px-2 sm:hidden">
            {mobileTitleBlock}
          </div>
        ) : null}

        {desktopTitleBlock ? (
          <div className="order-3 hidden w-full items-center justify-center px-3 pointer-events-auto sm:order-2 sm:flex sm:flex-1">
            {desktopTitleBlock}
          </div>
        ) : null}

        <div className="header-actions order-2 ml-auto flex min-w-[2.5rem] items-center justify-end gap-1.5 pointer-events-auto sm:order-3 sm:w-auto sm:flex-none sm:flex-nowrap sm:gap-2">
          {effectiveMobileAccessory ? (
            <div className="inline-flex items-center sm:hidden">{effectiveMobileAccessory}</div>
          ) : null}
          {effectiveExtraContent ? (
            <div className="hidden sm:inline-flex sm:items-center">{effectiveExtraContent}</div>
          ) : null}
          {effectiveCta ? (
            <div className="w-full sm:w-auto">
              <HeaderCtaButton cta={effectiveCta} />
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
