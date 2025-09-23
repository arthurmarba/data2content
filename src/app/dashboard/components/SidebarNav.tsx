// src/app/dashboard/components/SidebarNav.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FaCompass,
  FaCalendarAlt,
  FaCreditCard,
  FaUsers,
} from "react-icons/fa";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface SidebarNavProps {
  isCollapsed: boolean; // true = fechado; false = aberto
  onToggle: () => void;
}

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  exact?: boolean;
};

export default function SidebarNav({ isCollapsed, onToggle }: SidebarNavProps) {
  const pathname = usePathname();

  // Evita FOUC/flash: só consideramos breakpoints depois de montar no cliente
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [isMobile, setIsMobile] = useState(false);
  const wasOverflow = useRef<string | null>(null);

  // Lista de itens da navegação
  const items: NavItem[] = useMemo(
    () => [
      { href: "/dashboard/discover", label: "Descoberta", icon: <FaCompass /> },
      { href: "/dashboard/media-kit", label: "Planejamento", icon: <FaCalendarAlt /> },
      { href: "/dashboard/afiliados", label: "Indique e Ganhe", icon: <FaUsers /> },
      { href: "/dashboard/settings", label: "Gerir Assinatura", icon: <FaCreditCard /> },
    ],
    []
  );

  // Detecta breakpoint (mobile x desktop) — só após mounted para evitar SSR mismatch
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

  // Fecha com ESC (mobile)
  useEffect(() => {
    if (!(isMobile && isOpen)) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onToggle();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isMobile, isOpen, onToggle]);

  const handleItemClick = useCallback(() => {
    if (isMobile && isOpen) onToggle();
  }, [isMobile, isOpen, onToggle]);

  // Classes de base
  const asideBase =
    "bg-white flex flex-col transition-transform duration-200 ease-out";

  // Enquanto não montou, **forçamos fechado** no mobile e escondemos visualmente para evitar flash
  const mobileTransform = !mounted
    ? "-translate-x-full"
    : isOpen
    ? "translate-x-0"
    : "-translate-x-full";

  const mobileClasses = isMobile
    ? `fixed inset-y-0 left-0 z-[60] w-64 transform ${mobileTransform}`
    : "";

  const desktopClasses = !isMobile ? `lg:fixed lg:left-0 lg:z-40 lg:transform-none` : "";
  const desktopWidth = !isMobile ? (isCollapsed ? "lg:w-16" : "lg:w-64") : "";

  return (
    <aside
      className={`${asideBase} ${mobileClasses} ${desktopClasses} ${desktopWidth} ${
        !mounted ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
      aria-label="Navegação do dashboard"
      style={
        !isMobile
          ? {
              top: "var(--header-h, 4rem)",
              height: "calc(100svh - var(--header-h, 4rem))",
            }
          : undefined
      }
    >
      {/* Lista */}
      <nav className="flex-1 overflow-y-auto scrollbar-hide px-2 pt-2 sm:pt-3 lg:pt-4">
        <ul className="divide-y divide-gray-200">
          {items.map((item) => {
            const active =
              pathname === item.href || (!item.exact && pathname.startsWith(item.href));
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={handleItemClick}
                  className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-[15px] sm:text-base transition-colors ${
                    active ? "bg-gray-900 text-white" : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <span
                    className={`text-lg ${
                      active ? "text-white" : "text-gray-600 group-hover:text-gray-900"
                    }`}
                  >
                    {item.icon}
                  </span>
                  {(!isCollapsed || isMobile) && <span className="truncate">{item.label}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="p-2 text-[11px] text-gray-400 select-none">
        {(!isCollapsed || isMobile) && <span className="px-3">v1.0</span>}
      </div>
    </aside>
  );
}
