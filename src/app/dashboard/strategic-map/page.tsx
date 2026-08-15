"use client";

import { useRouter } from "next/navigation";

import StrategicMapPinnedBoard from "@/app/dashboard/boards/StrategicMapPinnedBoard";
import { DiagnosticoNavHeader } from "@/app/dashboard/boards/components/videoUpload/appPreview/DiagnosticoNavHeader";
import DesktopWorkspaceHeader from "@/app/dashboard/components/DesktopWorkspaceHeader";
import { CREATOR_PROFILE_ROUTE } from "@/constants/routes";

/**
 * Workspace desktop do "Seu Mapa". A visualização dedicada usa a largura útil
 * do produto e mantém o board compacto somente no dashboard.
 */
export default function StrategicMapPage() {
  const router = useRouter();

  return (
    <div className="h-full min-h-0 overflow-hidden bg-[var(--ds-color-paper)] lg:bg-[#f5f5f4] lg:px-8">
      <div className="mx-auto flex h-full min-h-0 w-full max-w-[1280px] flex-col">
        <div
          className="shrink-0 border-b border-[var(--ds-color-line)] bg-[var(--ds-color-paper)] px-2 lg:hidden"
          style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
        >
          <DiagnosticoNavHeader
            title="Seu mapa"
            onBack={() => router.push(CREATOR_PROFILE_ROUTE)}
          />
        </div>
        <div className="hidden lg:block">
          <DesktopWorkspaceHeader
            eyebrow="Direção de conteúdo"
            title="Seu mapa"
            description="Revise os sinais que orientam seu conteúdo."
          />
        </div>
        <div className="min-h-0 flex-1 lg:pb-7">
          <StrategicMapPinnedBoard dedicatedView />
        </div>
      </div>
    </div>
  );
}
