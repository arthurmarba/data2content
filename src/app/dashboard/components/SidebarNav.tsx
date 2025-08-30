// src/app/dashboard/components/SidebarNav.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FaComments,
  FaFileContract,
  FaWhatsapp,
  FaCreditCard,
  FaAngleDoubleLeft,
  FaAngleDoubleRight,
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
  const [isMobile, setIsMobile] = useState(false);
  const wasOverflow = useRef<string | null>(null);

  const isOpen = !isCollapsed;

  const items: NavItem[] = useMemo(
    () => [
      { href: "/dashboard/chat", label: "Conversar com IA", icon: <FaComments /> },
      { href: "/dashboard/media-kit", label: "Mídia Kit", icon: <FaFileContract /> },
      { href: "/dashboard/whatsapp-pro", label: "WhatsApp PRO", icon: <FaWhatsapp /> },
      { href: "/dashboard/settings", label: "Gerir Assinatura", icon: <FaCreditCard /> },
    ],
    []
  );

  // Detecta breakpoint (mobile x desktop)
  useEffect(() => {
    const mm = window.matchMedia("(min-width: 1024px)"); // lg
    const apply = () => setIsMobile(!mm.matches);
    apply();
    mm.addEventListener?.("change", apply);
    return () => mm.removeEventListener?.("change", apply);
  }, []);

  // >>> Mantém a largura atual da sidebar em uma CSS var global
  useEffect(() => {
    // desktop: 16rem (aberta) ou 4rem (colapsada)
    // mobile (overlay): 0px — conteúdo ocupa 100%
    const width = isMobile ? "0px" : isCollapsed ? "4rem" : "16rem";
    document.documentElement.style.setProperty("--sidebar-w", width);
    return () => {
      document.documentElement.style.removeProperty("--sidebar-w");
    };
  }, [isMobile, isCollapsed]);
  // <<<

  // Scroll lock do body quando overlay mobile estiver aberto
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

  // Fecha com ESC (mobile aberto)
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

  // Classes:
  // - Mobile: fixed + slide
  // - Desktop: fixed, sem transform, largura 16/64, top/height via --header-h
  const asideBase =
    "border-r border-gray-200 bg-white flex flex-col transition-transform duration-200 ease-out";
  const mobileClasses = isMobile
  ? `fixed inset-y-0 left-0 z-40 w-64 transform ${isOpen ? "translate-x-0" : "-translate-x-full"}`
  : "";
  const desktopClasses = !isMobile ? `lg:fixed lg:left-0 lg:z-30 lg:transform-none` : "";
  const desktopWidth = !isMobile ? (isCollapsed ? "lg:w-16" : "lg:w-64") : "";

  return (
    <aside
      className={`${asideBase} ${mobileClasses} ${desktopClasses} ${desktopWidth}`}
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
      {/* Topo: botão de recolher/fechar */}
      <div className="p-2 flex items-center justify-end">
        <button
          onClick={onToggle}
          className="inline-flex items-center gap-2 text-xs text-gray-600 hover:text-gray-900 px-2 py-1 rounded-md hover:bg-gray-100"
          aria-label={isOpen ? "Fechar menu" : "Abrir menu"}
          title={isOpen ? "Fechar" : "Abrir"}
        >
          {isCollapsed ? (
            <FaAngleDoubleRight className="w-4 h-4" />
          ) : (
            <FaAngleDoubleLeft className="w-4 h-4" />
          )}
          {!isCollapsed && !isMobile && <span>Recolher</span>}
          {!isCollapsed && isMobile && <span>Fechar</span>}
        </button>
      </div>

      {/* Lista de navegação */}
      <nav className="flex-1 overflow-y-auto px-2">
        <ul className="space-y-1">
          {items.map((item) => {
            const active =
              pathname === item.href || (!item.exact && pathname.startsWith(item.href));
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={handleItemClick}
                  className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                    active ? "bg-gray-900 text-white" : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <span
                    className={`text-base ${
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
