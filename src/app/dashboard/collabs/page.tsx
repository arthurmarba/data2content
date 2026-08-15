"use client";

import { useRouter } from "next/navigation";

import CollabsPinnedBoard from "@/app/dashboard/boards/CollabsPinnedBoard";
import { DiagnosticoNavHeader } from "@/app/dashboard/boards/components/videoUpload/appPreview/DiagnosticoNavHeader";
import DesktopWorkspaceHeader from "@/app/dashboard/components/DesktopWorkspaceHeader";
import { d2cFontVariables } from "@/app/fonts/d2cFonts";
import { CREATOR_PROFILE_ROUTE } from "@/constants/routes";

/**
 * Workspace desktop de ideias e parcerias. O dashboard recebe apenas o resumo;
 * aqui a experiência completa pode usar a largura disponível.
 */
export default function CollabsPage() {
  const router = useRouter();

  return (
    <div className={`d2c-mobile-app ds-notebook h-full min-h-0 overflow-hidden bg-[var(--ds-color-neutral)] lg:px-8 ${d2cFontVariables}`}>
      <div className="mx-auto flex h-full min-h-0 w-full max-w-[1280px] flex-col">
        <div
          className="shrink-0 border-b border-[var(--ds-color-line)] bg-[var(--ds-color-surface)] px-2 lg:hidden"
          style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
        >
          <DiagnosticoNavHeader
            title="Collabs"
            onBack={() => router.push(CREATOR_PROFILE_ROUTE)}
          />
        </div>
        <div className="hidden lg:block">
          <DesktopWorkspaceHeader
            eyebrow="Ideias e parcerias"
            title="Collabs"
            description="Veja ideias prontas para gravar e sugestões de parceria quando outra pessoa realmente acrescenta algo."
          />
        </div>
        <div className="min-h-0 flex-1 lg:pb-7">
          <CollabsPinnedBoard dedicatedView />
        </div>
      </div>
    </div>
  );
}
