import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { resolveAuthOptions } from "@/app/api/auth/resolveAuthOptions";
import { connectToDatabase } from "@/app/lib/mongoose";
import { isMobileStrategicProfileEnabled } from "@/app/dashboard/boards/videoUpload/mobileStrategicProfileFeatureFlag";

/**
 * POST /api/dashboard/mobile-strategic-profile/pricing-profile
 *
 * Fase 3 — salva o contexto de pricing coletado no intro opcional da Calculadora.
 * Os dados vão para User.creatorProfileExtended e alimentam o aiOrchestrator
 * (linhas "publis" e "medo_preco" do contexto do criador).
 *
 * Ambos os campos são opcionais — o criador pode pular o intro.
 *
 * Body:
 *   {
 *     hasDoneSponsoredPosts?: "varias" | "poucas" | "nunca-quero" | "nunca-sem-interesse";
 *     pricingFear?: "caro" | "barato" | "justificar" | "amador" | "outro";
 *   }
 */

const MONETIZATION_STATUS = ["varias", "poucas", "nunca-quero", "nunca-sem-interesse"] as const;
const PRICING_FEAR = ["caro", "barato", "justificar", "amador", "outro"] as const;

export async function POST(request: Request) {
  if (!isMobileStrategicProfileEnabled()) {
    return NextResponse.json({ message: "Recurso não habilitado." }, { status: 404 });
  }

  const authOptions = await resolveAuthOptions();
  const session = await getServerSession(authOptions);
  const userId = (session as any)?.user?.id as string | undefined;

  if (!userId) {
    return NextResponse.json({ message: "Não autenticado." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Body inválido." }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ message: "Body deve ser um objeto JSON." }, { status: 400 });
  }

  const b = body as Record<string, unknown>;

  const profileUpdate: Record<string, unknown> = {};

  if (typeof b.hasDoneSponsoredPosts === "string" && MONETIZATION_STATUS.includes(b.hasDoneSponsoredPosts as any)) {
    profileUpdate["creatorProfileExtended.hasDoneSponsoredPosts"] = b.hasDoneSponsoredPosts;
  }

  if (typeof b.pricingFear === "string" && PRICING_FEAR.includes(b.pricingFear as any)) {
    profileUpdate["creatorProfileExtended.pricingFear"] = b.pricingFear;
  }

  if (Object.keys(profileUpdate).length === 0) {
    return NextResponse.json({ ok: true, saved: 0 });
  }

  try {
    await connectToDatabase();
    const { default: UserModel } = await import("@/app/models/User");

    await UserModel.findByIdAndUpdate(userId, { $set: profileUpdate });

    return NextResponse.json({ ok: true, saved: Object.keys(profileUpdate).length });
  } catch (err) {
    console.error("[pricing-profile] Erro ao salvar contexto de pricing:", err);
    return NextResponse.json({ message: "Não foi possível salvar." }, { status: 500 });
  }
}
