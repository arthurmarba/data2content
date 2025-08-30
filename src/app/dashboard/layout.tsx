// src/app/dashboard/layout.tsx
"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { SidebarProvider, useSidebar } from "./context/SidebarContext";
import SidebarNav from "./components/SidebarNav";
import Header from "../components/Header";
import React from "react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      {/* container base do dashboard */}
      <div className="relative w-full bg-gray-50 overflow-x-hidden" style={{ minHeight: "100svh" }}>
        <LayoutContent>{children}</LayoutContent>
      </div>
    </SidebarProvider>
  );
}

function LayoutContent({ children }: { children: React.ReactNode }) {
  const { isCollapsed, toggleSidebar } = useSidebar();
  const pathname = usePathname();
  const isChatPage = pathname.startsWith("/dashboard/chat");
  const isOpen = !isCollapsed;

  // Em páginas que NÃO são o chat (onde o ChatHeader já seta dinamicamente),
  // definimos um fallback do --header-h para 4rem (h-16).
  useEffect(() => {
    if (!isChatPage) {
      document.documentElement.style.setProperty("--header-h", "4rem");
    }
  }, [isChatPage]);

  // No desktop, só o MAIN deve respeitar a largura do sidebar
  const mainOffset = isCollapsed ? "lg:ml-16" : "lg:ml-64";

  return (
    <>
      {/* Sidebar:
          - mobile: overlay fixed com slide (dentro do próprio componente)
          - desktop: coluna fixa alinhada ao header (usa --header-h)
      */}
      <SidebarNav isCollapsed={isCollapsed} onToggle={toggleSidebar} />

      {/* Overlay escuro para mobile quando sidebar está aberta */}
      {isOpen && (
        <div
          onClick={toggleSidebar}
          className="lg:hidden fixed inset-0 bg-black/40 z-30"
          aria-hidden="true"
        />
      )}

      {/* Área principal */}
      <div className="flex flex-col w-full min-h-full">
        {/* Header sempre full-width (não recebe margem lateral) */}
        <Header />

        {/* O conteúdo abaixo desloca no desktop para não ficar sob o sidebar */}
        <main
          className={`flex-1 ${mainOffset} ${
            isChatPage ? "overflow-visible" : "overflow-y-auto"
          }`}
        >
          {children}
        </main>
      </div>
    </>
  );
}
