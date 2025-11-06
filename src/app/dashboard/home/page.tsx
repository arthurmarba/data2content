// src/app/dashboard/home/page.tsx
// Server component responsável por renderizar a Home do dashboard.

import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function LegacyDashboardHomePage() {
  redirect("/dashboard");
}
