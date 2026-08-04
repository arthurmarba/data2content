"use client";

import CollabsPinnedBoard from "@/app/dashboard/boards/CollabsPinnedBoard";
import DesktopWorkspaceHeader from "@/app/dashboard/components/DesktopWorkspaceHeader";

/**
 * Workspace desktop de pautas e conexões. O dashboard recebe apenas o resumo;
 * aqui a experiência completa pode usar a largura disponível.
 */
export default function CollabsPage() {
  return (
    <main className="h-full min-h-0 overflow-hidden bg-[#f5f5f4] px-4 sm:px-6 lg:px-8">
      <div className="mx-auto flex h-full min-h-0 w-full max-w-[1280px] flex-col">
        <DesktopWorkspaceHeader
          eyebrow="Pautas e conexões"
          title="Collabs"
          description="Explore ideias conectadas ao seu mapa e encontre criadores com afinidade narrativa."
        />
        <div className="min-h-0 flex-1 pb-5 lg:pb-7">
          <CollabsPinnedBoard dedicatedView />
        </div>
      </div>
    </main>
  );
}
