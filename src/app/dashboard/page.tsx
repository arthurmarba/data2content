// src/app/dashboard/page.tsx
// Destino do login: a Jornada é a experiência principal. A Home antiga segue em
// /dashboard/home para quem precisar dela.
import { redirect } from "next/navigation";

import { buildJourneyHref } from "./jornada/journeyRoute";

// Decide o destino pelos parâmetros do endereço: nunca pré-gerar.
export const dynamic = "force-dynamic";

interface searchParams {
  [key: string]: string | string[] | undefined;
}

export default async function DashboardHomePage({
  searchParams,
}: {
  searchParams: Promise<searchParams>;
}) {
  const resolvedSearchParams = await searchParams;
  const query = new URLSearchParams();
  Object.entries(resolvedSearchParams).forEach(([key, value]) => {
    if (typeof value === "string") query.set(key, value);
    else if (Array.isArray(value)) value.forEach((v) => query.append(key, v));
  });

  if (query.get("board") === "post-creation") {
    query.delete("board");
    const queryString = query.toString();
    redirect(queryString ? `/calendar?${queryString}` : "/calendar");
  }

  redirect(buildJourneyHref(resolvedSearchParams));
}
