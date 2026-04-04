"use client";

import React from "react";
import DashboardShell from "./dashboard/components/DashboardShell";
import HomeClientPage from "./dashboard/home/HomeClientPage";

/**
 * DashboardRootClient
 * 
 * Componente que renderiza a Home do Dashboard dentro do DashboardShell.
 * Utilizado para exibir a plataforma como a página inicial (root) do site.
 */
export default function DashboardRootClient() {
  return (
    <DashboardShell>
      <main className="flex h-full min-h-0 w-full flex-col overflow-hidden">
        <HomeClientPage />
      </main>
    </DashboardShell>
  );
}
