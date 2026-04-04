// src/app/dashboard/home/page.tsx
// Server component responsável por renderizar a Home (mesma experiência de /dashboard).

import React from "react";
import HomeClientPage from "./HomeClientPage";

export const dynamic = "force-dynamic";

export default function DashboardHomeEntryPoint() {
  return (
    <main className="flex h-full min-h-0 w-full flex-col overflow-hidden">
      <HomeClientPage />
    </main>
  );
}
