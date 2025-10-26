"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { SidebarProvider, useSidebar } from "./context/SidebarContext";
import { HeaderProvider, useHeaderConfig, useHeaderSetup, type HeaderVariant, type HeaderConfig } from "./context/HeaderContext";
import SidebarNav from "./components/SidebarNav";
import Header from "../components/Header";
import React from "react";
import BillingSubscribeModal from "./billing/BillingSubscribeModal";
import InstagramReconnectBanner from "./components/InstagramReconnectBanner";
import TrialBanner from "./components/TrialBanner";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <HeaderProvider>
        {/* container base do dashboard */}
        <div className="relative w-full bg-[#f7f8fa] overflow-x-hidden min-h-svh overscroll-none">
          <LayoutContent>{children}</LayoutContent>
        </div>
      </HeaderProvider>
    </SidebarProvider>
  );
}

function LayoutContent({ children }: { children: React.ReactNode }) {
  const { isCollapsed, toggleSidebar } = useSidebar();
  const pathname = usePathname();
  const { config: headerConfig } = useHeaderConfig();

  const isChatPage = pathname.startsWith("/dashboard/chat");
  const isMediaKitPage = pathname.startsWith("/dashboard/media-kit");
  const isGeminiHeaderPage = /^\/dashboard\/(chat|media-kit|settings|billing|discover|planning)/.test(pathname);
  const isGuidedFlow = /^\/dashboard\/instagram/.test(pathname);
  const isPlannerDemo = pathname.startsWith("/dashboard/planning");
  const isDiscover = pathname.startsWith("/dashboard/discover");

  const isOpen = !isCollapsed;
  const hasPageOverride = isMediaKitPage || isPlannerDemo || isDiscover;

  const layoutHeaderConfig = useMemo<Partial<HeaderConfig> | undefined>(
    () => {
      if (hasPageOverride) return undefined;
      const variant: HeaderVariant = isGuidedFlow ? "minimal" : "default";
      return {
        showSidebarToggle: !isGuidedFlow,
        showUserMenu: !isGuidedFlow,
        sticky: true,
        variant,
        contentTopPadding: undefined,
      };
    },
    [hasPageOverride, isGuidedFlow]
  );

  useHeaderSetup(layoutHeaderConfig, [hasPageOverride, isGuidedFlow]);

  // Fallback de --header-h apenas para páginas que NÃO usam o ChatHeader dinâmico
  useEffect(() => {
    if (!isGeminiHeaderPage) {
      document.documentElement.style.setProperty("--header-h", "4rem");
    }
  }, [isGeminiHeaderPage]);

  // deslocamento do main conforme sidebar no desktop
  const mainOffset = isGuidedFlow ? "" : isCollapsed ? "lg:ml-16" : "lg:ml-64";

  // Regras de scroll por rota
  const mainScrollClass = isMediaKitPage
    ? "overflow-y-auto"
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

  const wantsStickyHeader = headerConfig?.sticky !== false;
  const isMobileDocked = Boolean(headerConfig?.mobileDocked && wantsStickyHeader);
  const isStickyHeader = !isMediaKitPage && wantsStickyHeader && !isMobileDocked;

  const customPadding = headerConfig?.contentTopPadding;
  const resolvedContentTopPadding =
    typeof customPadding === "number"
      ? `${customPadding}px`
      : typeof customPadding === "string"
      ? customPadding
      : undefined;

  const baseTopPadding = "var(--header-h, 56px)";
  const resolvedPaddingTop = isMobileDocked
    ? "0px"
    : isStickyHeader
    ? `calc(${baseTopPadding} + ${resolvedContentTopPadding ?? "0px"})`
    : resolvedContentTopPadding ?? "0px";

  return (
    <>
      {/* Sidebar (oculta enquanto o usuário está no fluxo de conexão do Instagram) */}
      {!isGuidedFlow && (
        <SidebarNav isCollapsed={isCollapsed} onToggle={() => toggleSidebar()} />
      )}

      {/* Overlay escuro para mobile quando sidebar está aberta (acima do header, abaixo da sidebar) */}
      {isOpen && !isGuidedFlow && (
        <div
          onClick={() => toggleSidebar()}
          className="lg:hidden fixed inset-0 bg-black/40 z-50"
          aria-hidden="true"
        />
      )}

      {/* Área principal */}
      <div className="flex flex-col w-full min-h-svh" id="dashboard-shell">
        {/* Header sempre full-width (não recebe margem lateral) */}
        <Header />

        {/* Conteúdo sempre abaixo do header (respeita safe-area no iOS) */}
        <main
          id="dashboard-main"
          className={`flex flex-col flex-1 min-h-0 ${mainOffset} ${mainScrollClass}`}
          style={{ paddingTop: resolvedPaddingTop }}
        >
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 space-y-4">
            <InstagramReconnectBanner />
            <TrialBanner />
          </div>
          {children}
        </main>
      </div>

      {/* Modal de Assinatura (Checkout) — GLOBAL */}
      <BillingSubscribeModal open={showBillingModal} onClose={() => setShowBillingModal(false)} />
    </>
  );
}
