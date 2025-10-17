"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { FaHome, FaCompass, FaCalendarAlt, FaAddressCard, FaCreditCard, FaUsers } from "react-icons/fa";
import React, { useEffect, useMemo, useRef, useState } from "react";

interface SidebarNavProps {
  isCollapsed: boolean; // true = fechado; false = aberto
  onToggle: () => void;
}

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  exact?: boolean;
  section: "primary" | "secondary";
};

export default function SidebarNav({ isCollapsed, onToggle }: SidebarNavProps) {
  const pathname = usePathname();

  // Evita FOUC/flash: só consideramos breakpoints depois de montar no cliente
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [isMobile, setIsMobile] = useState(true);
  const wasOverflow = useRef<string | null>(null);

  // Lista de itens da navegação
  const items: NavItem[] = useMemo(
    () => [
      { href: "/dashboard/home", label: "Início", icon: <FaHome />, section: "primary", exact: true },
      { href: "/dashboard/discover", label: "Descoberta", icon: <FaCompass />, section: "primary" },
      { href: "/dashboard/media-kit", label: "Mídia Kit", icon: <FaAddressCard />, section: "primary" },
      { href: "/dashboard/planning", label: "Planejamento", icon: <FaCalendarAlt />, section: "primary" },
      { href: "/dashboard/afiliados", label: "Indique e Ganhe", icon: <FaUsers />, section: "secondary" },
      { href: "/dashboard/settings", label: "Gerir Assinatura", icon: <FaCreditCard />, section: "secondary" },
    ],
    []
  );

  const { primaryItems, secondaryItems } = useMemo(
    () => ({
      primaryItems: items.filter((item) => item.section === "primary"),
      secondaryItems: items.filter((item) => item.section === "secondary"),
    }),
    [items]
  );

  // Detecta breakpoint (mobile x desktop)
  useEffect(() => {
    if (!mounted) return;
    const mm = window.matchMedia("(min-width: 1024px)"); // lg
    const apply = () => setIsMobile(!mm.matches);
    apply();
    mm.addEventListener?.("change", apply);
    return () => mm.removeEventListener?.("change", apply);
  }, [mounted]);

  // Atualiza a largura global da sidebar (desktop apenas)
  useEffect(() => {
    const width = isMobile ? "0px" : isCollapsed ? "4rem" : "16rem";
    document.documentElement.style.setProperty("--sidebar-w", width);
    return () => {
      document.documentElement.style.removeProperty("--sidebar-w");
    };
  }, [isMobile, isCollapsed]);

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

  // Enquanto não montou, força fechado no mobile
  const mobileTransform = !mounted
    ? "-translate-x-full"
    : isOpen
    ? "translate-x-0"
    : "-translate-x-full";

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
  const itemPadding = showLabels ? "px-4 py-3.5" : "px-3.5 py-3";
  const itemGap = showLabels ? "gap-4" : "gap-0";
  const itemTextSize = showLabels ? "text-[15px]" : "text-[13px]";
  const iconSize = showLabels ? "h-10 w-10" : "h-9 w-9";
  const focusOffsetClass = isMobile ? "focus-visible:ring-offset-white" : "focus-visible:ring-offset-[#f7f8fa]";

  const asideSurface = isMobile ? "bg-white shadow-xl border-r" : "bg-transparent border-r";

  const renderNavList = (navItems: NavItem[]) => (
    <ul className="flex flex-col gap-1.5">
      {navItems.map((item) => {
        const active = pathname === item.href || (!item.exact && pathname.startsWith(item.href));
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              prefetch={false}
              onClick={() => {
                if (isMobile && isOpen) onToggle();
              }}
              className={`group relative flex items-center ${itemGap} ${itemPadding} ${itemTextSize} rounded-xl ${alignClass} transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-magenta/60 focus-visible:ring-offset-2 ${focusOffsetClass} ${
                active
                  ? "bg-slate-100 font-semibold text-slate-900"
                  : "font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              {active && (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute left-0 top-1/2 h-[60%] w-1 -translate-y-1/2 rounded-full bg-gradient-to-b from-brand-purple via-brand-magenta to-brand-orange"
                />
              )}

              <span
                aria-hidden="true"
                className={`flex ${iconSize} shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-lg transition-colors duration-200 ${
                  active
                    ? "border-brand-magenta/40 text-brand-purple shadow-sm"
                    : "text-slate-500 group-hover:border-brand-magenta/30 group-hover:text-brand-purple"
                }`}
              >
                {item.icon}
              </span>
              {showLabels && (
                <span
                  className={`truncate leading-tight ${
                    active ? "text-slate-900" : "text-slate-700 group-hover:text-slate-900"
                  }`}
                >
                  {item.label}
                </span>
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
      <nav className="flex-1 overflow-y-auto px-3 pb-6 pt-6 scrollbar-hide sm:px-4">
        {renderNavList(primaryItems)}
        {!!secondaryItems.length && (
          <div className="mt-8 border-t border-slate-200/80 pb-0 pt-8">
            {renderNavList(secondaryItems)}
          </div>
        )}
      </nav>

      <div className="select-none px-4 pb-5 pt-3 text-[11px] tracking-wide text-slate-400">
        {showLabels && (
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-200/90 bg-white px-3 py-1 uppercase text-slate-500">
            v1.0
          </span>
        )}
      </div>
    </aside>
  );
}
