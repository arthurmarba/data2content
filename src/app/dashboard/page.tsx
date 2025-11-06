// src/app/dashboard/page.tsx
import React from "react";
import HomeClientPage from "./home/HomeClientPage";

export const dynamic = "force-dynamic";

export default function DashboardHomePage() {
  return (
    <main className="w-full">
      <HomeClientPage />
    </main>
  );
}
