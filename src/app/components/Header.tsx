"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  FaBars,
  FaEnvelope,
  FaFileContract,
  FaHandshake,
  FaShieldAlt,
  FaSignOutAlt,
  FaTrashAlt,
  FaUserCircle,
  FaWhatsapp,
} from "react-icons/fa";
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

function buildLayoutClasses(variant: HeaderVariant, condensed: boolean) {
  const base = [
    "px-4",
    "sm:px-6",
    "flex",
    "flex-wrap",
    "gap-y-1.5",
    "sm:flex-nowrap",
    "items-center",
    "justify-between",
    "gap-x-3",
    "w-full",
    "min-h-[72px]",
  ];
  if (variant === "immersive") {
    base.push(condensed ? "py-2 sm:py-2.5" : "py-2.5 sm:py-3.5");
  } else if (variant === "compact") {
    base.push(condensed ? "py-1.5 sm:py-2" : "py-2 sm:py-2.5");
  } else if (condensed) {
    base.push("py-1.5", "sm:py-2", "h-16");
  } else {
    base.push("py-2", "h-[72px]");
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
      "backdrop-blur supports-[backdrop-filter]:bg-white/80",
      condensed ? "bg-white/90 shadow" : "bg-white/80 shadow-sm"
    );
  } else if (variant === "minimal") {
    base.push("bg-white");
  } else {
    const shadowClass = condensed
      ? "shadow-[0_3px_10px_rgba(15,23,42,0.08)]"
      : "shadow-none";
    base.push("bg-white", shadowClass, "border-none");
  }

  return base.join(" ");
}

function UserMenu({ user, onClose }: { user?: SessionUser; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: -10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -10 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
      className="origin-top-right absolute right-2 mt-2 w-64 max-w-[92vw] rounded-md shadow-lg py-1 bg-white ring-1 ring-black ring-opacity-5 focus:outline-none z-50"
      onMouseLeave={onClose}
      role="menu"
    >
      <div className="px-4 py-3 border-b border-gray-100">
        <p className="text-base font-semibold text-brand-dark truncate">
          {user?.name ?? "Usuário"}
        </p>
        <p className="text-sm text-gray-500 truncate">{user?.email || "Sem email"}</p>
      </div>
      <div className="py-1 border-t border-gray-100">
        <Link
          href="/termos-e-condicoes"
          className="w-full text-left flex items-center gap-3 px-4 py-2.5 text-base text-gray-700 hover:bg-gray-100 hover:text-brand-dark transition-colors rounded-md mx-1 my-0.5"
          onClick={onClose}
          target="_blank"
          rel="noopener noreferrer"
          role="menuitem"
        >
          <FaFileContract className="w-4 h-4 text-gray-400" /> Termos e Condições
        </Link>
        <Link
          href="/politica-de-privacidade"
          className="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-brand-dark transition-colors rounded-md mx-1 my-0.5"
          onClick={onClose}
          target="_blank"
          rel="noopener noreferrer"
          role="menuitem"
        >
          <FaShieldAlt className="w-4 h-4 text-gray-400" /> Política de Privacidade
        </Link>
      </div>
      <div className="py-1 border-t border-gray-100">
        <a
          href="mailto:arthur@data2content.ai"
          className="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-brand-dark transition-colors rounded-md mx-1 my-0.5"
          onClick={onClose}
          role="menuitem"
        >
          <FaEnvelope className="w-4 h-4 text-gray-400" /> Suporte por Email
        </a>
        <Link
          href="/afiliados"
          className="w-full text-left flex items-center gap-3 px-4 py-2.5 text-base text-gray-700 hover:bg-gray-100 hover:text-brand-dark transition-colors rounded-md mx-1 my-0.5"
          onClick={onClose}
          role="menuitem"
        >
          <FaHandshake className="w-4 h-4 text-gray-400" /> Programa de Afiliados
        </Link>
      </div>
      <div className="py-1 border-t border-gray-100">
        <Link
          href="/dashboard/settings#delete-account"
          className="w-full text-left flex items-center gap-3 px-4 py-2.5 text-base text-red-600 hover:bg-red-50 hover:text-brand-red transition-colors rounded-md mx-1 my-0.5"
          onClick={onClose}
          role="menuitem"
        >
          <FaTrashAlt className="w-4 h-4" /> Excluir Conta
        </Link>
      </div>
      <div className="py-1 border-t border-gray-100">
        <button
          onClick={() => {
            onClose();
            signOut({ callbackUrl: "/" });
          }}
          className="w-full text-left flex items-center gap-3 px-4 py-2.5 text-base text-gray-700 hover:bg-gray-100 hover:text-brand-dark transition-colors rounded-md mx-1 my-0.5"
          role="menuitem"
        >
          <FaSignOutAlt className="w-4 h-4" /> Sair
        </button>
      </div>
    </motion.div>
  );
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
  const user = session?.user as SessionUser | undefined;
  const rawSessionUser = session?.user as (SessionUser & { planStatus?: string | null }) | undefined;
  const normalizedPlanStatus = normalizePlanStatus(rawSessionUser?.planStatus);
  const planActive = isPlanActiveLike(normalizedPlanStatus);
  const { config } = useHeaderConfig();
  const { toggleSidebar } = useSidebar();
  const pathname = usePathname();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
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

  useEffect(() => {
    if (!config.showUserMenu) {
      setUserMenuOpen(false);
    }
  }, [config.showUserMenu]);

  const isDockedToBottom = Boolean(config.sticky && config.mobileDocked);
  const shellClasses = buildShellClasses(config.variant, config.sticky, condensed, config.mobileDocked);
  const innerClasses = buildLayoutClasses(config.variant, condensed);

  const handleOpenSubscribeModal = useCallback(() => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new Event("open-subscribe-modal"));
  }, []);

  const toggleUserMenu = useCallback(() => {
    setUserMenuOpen((prev) => !prev);
  }, []);



  const effectiveCta = useMemo<HeaderCta | null>(() => {
    const isHomePage = pathname === "/dashboard";
    if (isHomePage) return null;
    if (config.cta) return config.cta;
    if (planActive) return null;
    if (config.variant === "default") {
      return {
        label: "Ativar Plano Agência",
        icon: <FaWhatsapp className="w-5 h-5" />,
        onClick: handleOpenSubscribeModal,
      };
    }
    return null;
  }, [config, handleOpenSubscribeModal, pathname, planActive]);

  const effectiveTitleValue = config.title ?? null;
  const effectiveSubtitleValue = config.subtitle ?? null;

  const defaultProBadge = useMemo(() => {
    if (!planActive) return null;
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold leading-none text-emerald-700"
        title="Plano Agência ativo"
      >
        <span aria-hidden="true">✅</span>
        <span className="truncate">Plano Agência ativo</span>
      </span>
    );
  }, [planActive]);

  const effectiveExtraContent = config.extraContent ?? defaultProBadge;

  const titleBlock = useMemo(() => {
    if (!effectiveTitleValue && !effectiveSubtitleValue) return null;
    return (
      <div className="flex flex-col min-w-0 text-center">
        {effectiveTitleValue && (
          <span className="text-sm font-medium text-gray-500 truncate">
            {effectiveTitleValue}
          </span>
        )}
        {effectiveSubtitleValue && (
          <span className="text-xs text-gray-400 truncate">
            {effectiveSubtitleValue}
          </span>
        )}
      </div>
    );
  }, [effectiveSubtitleValue, effectiveTitleValue]);

  const renderLogo = (
    <Link
      href={MAIN_DASHBOARD_ROUTE}
      aria-label="Início"
      className="font-bold text-2xl text-brand-dark flex items-center gap-2 group"
    >
      <div className="relative h-8 w-8 overflow-hidden">
        <Image
          src="/images/Colorido-Simbolo.png"
          alt="Data2Content"
          fill
          className="object-contain object-center group-hover:opacity-90 transition-opacity scale-[2.2]"
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
      <div ref={innerRef} className={innerClasses}>
        {/* -> CORREÇÃO: E aplicada diretamente nos containers filhos que precisam ser clicáveis */}
        <div className="order-1 flex items-center gap-3 min-w-0 pointer-events-auto sm:order-1 sm:flex-none">
          {config.showSidebarToggle && (
            <motion.button
              onPointerDown={(event) => handlePointerActivation(() => toggleSidebar(), event)}
              onClick={(event) => runWithClickSuppression(() => toggleSidebar(), event)}
              whileTap={{ scale: 0.92 }}
              transition={{ duration: 0.12, ease: "easeOut" }}
              className="flex h-10 w-10 items-center justify-center rounded-full text-gray-700 transition-colors hover:bg-gray-100 hover:text-gray-900 touch-manipulation lg:hidden"
              aria-label="Alternar menu lateral"
              title="Menu"
            >
              <FaBars className="h-5 w-5" />
            </motion.button>
          )}
          {renderLogo}
        </div>

        {titleBlock ? (
          <div className="order-3 hidden w-full items-center justify-center px-3 pointer-events-auto sm:order-2 sm:flex sm:flex-1">
            {titleBlock}
          </div>
        ) : null}

        <div className="header-actions order-2 ml-auto flex min-w-0 flex-1 items-center justify-end gap-1.5 pointer-events-auto sm:order-3 sm:w-auto sm:flex-none sm:flex-nowrap sm:gap-2">
          {effectiveExtraContent ? (
            <div className="hidden sm:inline-flex sm:items-center">{effectiveExtraContent}</div>
          ) : null}
          {effectiveCta ? (
            <div className="w-full sm:w-auto">
              <HeaderCtaButton cta={effectiveCta} />
            </div>
          ) : null}
          {config.showUserMenu && (
            <div className="relative">
              <button
                onPointerDown={(event) => handlePointerActivation(toggleUserMenu, event)}
                onClick={(event) => runWithClickSuppression(toggleUserMenu, event)}
                className="h-10 w-10 rounded-full overflow-hidden bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 touch-manipulation"
                aria-haspopup="menu"
                aria-expanded={userMenuOpen}
                aria-label="Abrir menu do usuário"
              >
                {user?.image ? (
                  <Image
                    src={user.image}
                    alt={user.name || "Usuário"}
                    width={44}
                    height={44}
                    className="w-full h-full object-cover object-center"
                  />
                ) : (
                  <FaUserCircle className="w-full h-full text-gray-400" />
                )}
              </button>
              <AnimatePresence>
                {userMenuOpen && <UserMenu user={user} onClose={() => setUserMenuOpen(false)} />}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
