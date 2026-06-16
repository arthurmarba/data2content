"use client";

import CollabsPinnedBoard from "@/app/dashboard/boards/CollabsPinnedBoard";

/**
 * Visualização individual do board "Collabs" (acessível pela sidebar). Coluna
 * única centrada na largura mobile — o padrão é o mobile. O board (feed de pautas
 * com criador compatível) rola dentro do próprio Board.
 */
export default function CollabsPage() {
  return (
    <div className="flex h-full w-full justify-center px-4 pt-4 lg:pt-6">
      <div className="h-full w-full max-w-[470px]">
        <CollabsPinnedBoard />
      </div>
    </div>
  );
}
