import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { resolveAuthOptions } from "@/app/api/auth/resolveAuthOptions";
import { connectToDatabase } from "@/app/lib/mongoose";
import UserModel from "@/app/models/User";
import { isPlanActiveLike } from "@/utils/planStatus";
import { loadDashboardOpportunities } from "@/app/lib/campaignRadar/dashboardCatalog";
import { applyOpportunityAccess } from "@/app/lib/campaignRadar/opportunityAccess";
export const dynamic = "force-dynamic";
export async function GET() {
  const session = (await getServerSession(await resolveAuthOptions())) as {
    user?: { id?: string };
  } | null;
  const userId = session?.user?.id;
  if (!userId)
    return NextResponse.json({ error: "Entre na sua conta." }, { status: 401 });
  try {
    // O plano vem do banco, não da sessão: ativação manual ou pelo Stripe não
    // deve esperar o próximo login para abrir as publis.
    await connectToDatabase();
    const user = await UserModel.findById(userId).select("planStatus role").lean();
    const hasProAccess =
      isPlanActiveLike((user as any)?.planStatus) ||
      String((user as any)?.role ?? "").toLowerCase() === "admin";
    return NextResponse.json(
      {
        opportunities: applyOpportunityAccess(await loadDashboardOpportunities(), { hasProAccess }),
      },
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
