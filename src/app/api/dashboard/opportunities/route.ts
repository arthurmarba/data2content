import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { resolveAuthOptions } from "@/app/api/auth/resolveAuthOptions";
import { loadDashboardOpportunities } from "@/app/lib/campaignRadar/dashboardCatalog";
export const dynamic = "force-dynamic";
export async function GET() {
  const session = (await getServerSession(await resolveAuthOptions())) as {
    user?: { id?: string };
  } | null;
  if (!session?.user?.id)
    return NextResponse.json({ error: "Entre na sua conta." }, { status: 401 });
  try {
    return NextResponse.json(
      { opportunities: await loadDashboardOpportunities() },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    console.error("[jornada] Falha ao carregar oportunidades", error);
    return NextResponse.json(
      { error: "Não foi possível carregar as oportunidades." },
      { status: 503 },
    );
  }
}
