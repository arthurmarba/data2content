"use client";

import StrategicMapPinnedBoard from "@/app/dashboard/boards/StrategicMapPinnedBoard";
import DesktopWorkspaceHeader from "@/app/dashboard/components/DesktopWorkspaceHeader";

/**
 * Workspace desktop do "Seu Mapa". A visualização dedicada usa a largura útil
 * do produto e mantém o board compacto somente no dashboard.
 */
export default function StrategicMapPage() {
  return (
    <main className="h-full min-h-0 overflow-hidden bg-[#f5f5f4] px-4 sm:px-6 lg:px-8">
      <div className="mx-auto flex h-full min-h-0 w-full max-w-[1280px] flex-col">
        <DesktopWorkspaceHeader
          eyebrow="Direção de conteúdo"
          title="Seu Mapa"
          description="Revise sua narrativa, territórios e sinais da vida real em uma visão completa."
        />
        <div className="min-h-0 flex-1 pb-5 lg:pb-7">
          <StrategicMapPinnedBoard dedicatedView />
        </div>
      </div>
    </main>
  );
}
