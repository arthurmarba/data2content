"use client";

import { useRouter } from "next/navigation";

import StrategicMapPinnedBoard from "@/app/dashboard/boards/StrategicMapPinnedBoard";
import { DiagnosticoNavHeader } from "@/app/dashboard/boards/components/videoUpload/appPreview/DiagnosticoNavHeader";
import DesktopWorkspaceHeader from "@/app/dashboard/components/DesktopWorkspaceHeader";
import { CREATOR_PROFILE_ROUTE } from "@/constants/routes";

/**
 * Workspace desktop da narrativa. A visualização dedicada usa a largura útil do
 * produto e mantém o board compacto somente no dashboard.
 *
 * O título é "Sua narrativa", não "Seu mapa": é para cá que o card de identidade
 * do Perfil manda quem toca em "Ver narrativa completa", e um botão que promete
 * uma coisa e entrega uma tela com outro nome faz a pessoa achar que errou o
 * caminho. O termo "mapa" segue vivo como nome da ESTRUTURA por dentro
 * (territórios, assets, tom); "narrativa" é o nome do que a tela entrega.
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
            title="Sua narrativa"
            onBack={() => router.push(CREATOR_PROFILE_ROUTE)}
          />
        </div>
        <div className="hidden lg:block">
          <DesktopWorkspaceHeader
            eyebrow="Direção de conteúdo"
            title="Sua narrativa"
            description="Revise o fio que a leitura da semana usa para comparar seus posts."
          />
        </div>
        <div className="min-h-0 flex-1 lg:pb-7">
          <StrategicMapPinnedBoard dedicatedView />
        </div>
      </div>
    </div>
  );
}
