"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { SidebarProvider, useSidebar } from "./context/SidebarContext";
import SidebarNav from "./components/SidebarNav";
import Header from "../components/Header";
import React from "react";
import BillingSubscribeModal from "./billing/BillingSubscribeModal";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      {/* container base do dashboard */}
      <div className="relative w-full bg-gray-50 overflow-x-hidden min-h-svh overscroll-none">
        <LayoutContent>{children}</LayoutContent>
      </div>
    </SidebarProvider>
  );
}

function LayoutContent({ children }: { children: React.ReactNode }) {
  const { isCollapsed, toggleSidebar } = useSidebar();
  const pathname = usePathname();

  const isChatPage = pathname.startsWith("/dashboard/chat");
  const isMediaKitPage = pathname.startsWith("/dashboard/media-kit");
  const isGeminiHeaderPage = /^\/dashboard\/(chat|media-kit|settings|billing)/.test(pathname);
  const isOnboardingFlow = /^\/dashboard\/(onboarding|instagram)/.test(pathname);

  const isOpen = !isCollapsed;

  // Fallback de --header-h apenas para páginas que NÃO usam o ChatHeader dinâmico
  useEffect(() => {
    if (!isGeminiHeaderPage) {
      document.documentElement.style.setProperty("--header-h", "4rem");
    }
  }, [isGeminiHeaderPage]);

  // deslocamento do main conforme sidebar no desktop
  const mainOffset = isOnboardingFlow ? "" : isCollapsed ? "lg:ml-16" : "lg:ml-64";

  // Regras de scroll por rota
  const mainScrollClass = isMediaKitPage
    ? "overflow-hidden pt-header"
    : isChatPage
    ? "overflow-hidden"
    : "overflow-y-auto";

  // === Modal global de assinatura (escuta o evento "open-subscribe-modal") ===
  const [showBillingModal, setShowBillingModal] = useState(false);
  useEffect(() => {
    const handler = () => setShowBillingModal(true);
    window.addEventListener("open-subscribe-modal" as any, handler);
    return () => window.removeEventListener("open-subscribe-modal" as any, handler);
  }, []);

  return (
    <>
      {/* Sidebar (oculta no fluxo de onboarding/instagram) */}
      {!isOnboardingFlow && (
        <SidebarNav isCollapsed={isCollapsed} onToggle={() => toggleSidebar()} />
      )}

      {/* Overlay escuro para mobile quando sidebar está aberta (acima do header, abaixo da sidebar) */}
      {isOpen && !isOnboardingFlow && (
        <div
          onClick={() => toggleSidebar()}
          className="lg:hidden fixed inset-0 bg-black/40 z-50"
          aria-hidden="true"
        />
      )}

      {/* Área principal */}
      <div className="flex flex-col w-full min-h-0">
        {/* Header sempre full-width (não recebe margem lateral) */}
        <Header />

        {/* O conteúdo abaixo desloca no desktop para não ficar sob o sidebar */}
        <main className={`flex-1 min-h-0 ${mainOffset} ${mainScrollClass}`}>
          {children}
        </main>
      </div>

      {/* Modal de Assinatura (Checkout) — GLOBAL */}
      <BillingSubscribeModal open={showBillingModal} onClose={() => setShowBillingModal(false)} />
    </>
  );
}
