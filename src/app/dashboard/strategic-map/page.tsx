"use client";

import StrategicMapPinnedBoard from "@/app/dashboard/boards/StrategicMapPinnedBoard";

/**
 * Visualização individual do board "Seu Mapa" (acessível pela sidebar). Coluna
 * única centrada na largura mobile — o padrão é o mobile. O board rola no próprio
 * h-full (o conteúdo da página é overflow-hidden no shell).
 */
export default function StrategicMapPage() {
  return (
    <div className="flex h-full w-full justify-center px-4 pt-4 lg:pt-6">
      <div className="h-full w-full max-w-[470px]">
        <StrategicMapPinnedBoard />
      </div>
    </div>
  );
}
