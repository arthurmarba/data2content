// src/app/dashboard/home/page.tsx
// Server component responsável por renderizar a Home do dashboard.

import React from "react";

import HomeClientPage from "./HomeClientPage";

export const dynamic = "force-dynamic";

export default function DashboardHomePage() {
  return (
    <main className="w-full">
      <HomeClientPage />
    </main>
  );
}

