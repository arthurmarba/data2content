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
  const isOnboardingFlow = /^\/dashboard\/(onboarding|instagram)/.test(pathname);
  const isPlannerDemo = pathname.startsWith("/dashboard/planning");
  const isDiscover = pathname.startsWith("/dashboard/discover");

  const isOpen = !isCollapsed;
  const hasPageOverride = isMediaKitPage || isPlannerDemo || isDiscover;

  const layoutHeaderConfig = useMemo<Partial<HeaderConfig> | undefined>(
    () => {
      if (hasPageOverride) return undefined;
      const variant: HeaderVariant = isOnboardingFlow ? "minimal" : "default";
      return {
        showSidebarToggle: !isOnboardingFlow,
        showUserMenu: !isOnboardingFlow,
        sticky: true,
        variant,
        contentTopPadding: undefined,
      };
    },
    [hasPageOverride, isOnboardingFlow]
  );

  useHeaderSetup(layoutHeaderConfig, [hasPageOverride, isOnboardingFlow]);

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

  const isHeaderSticky = headerConfig?.sticky !== false;
  const customPadding = headerConfig?.contentTopPadding;
  const baseTopPadding = "var(--header-h, 56px)";
  const topPaddingStyle =
    typeof customPadding === "number"
      ? `calc(${baseTopPadding} + ${customPadding}px)`
      : customPadding ?? baseTopPadding; // header já embute a safe-area via padding próprio

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

        {/* Conteúdo sempre abaixo do header (respeita safe-area no iOS) */}
        <main
          className={`flex-1 min-h-0 ${mainOffset} ${mainScrollClass}`}
          style={isHeaderSticky ? { paddingTop: topPaddingStyle } : undefined}
        >
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
            <InstagramReconnectBanner />
          </div>
          {children}
        </main>
      </div>

      {/* Modal de Assinatura (Checkout) — GLOBAL */}
      <BillingSubscribeModal open={showBillingModal} onClose={() => setShowBillingModal(false)} />
    </>
  );
}
