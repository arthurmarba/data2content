// src/app/api/onboarding/leitura-inaugural/route.ts
// GET  /api/onboarding/leitura-inaugural → retorna mapa + leitura do usuário
// POST /api/onboarding/leitura-inaugural → regenera a leitura inaugural
//      (útil se o mapa foi atualizado e a leitura precisa ser refeita)

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { resolveAuthOptions } from "@/app/api/auth/resolveAuthOptions";
import { connectToDatabase } from "@/app/lib/mongoose";
import { logger } from "@/app/lib/logger";
import { generateLeituraInaugural } from "@/app/lib/mapaSeed/generateLeituraInaugural";
import MapaSeedModel from "@/app/models/MapaSeed";

// ─── GET — retorna mapa e leitura existente ───────────────────────────────────

export async function GET() {
  const TAG = "[API GET /onboarding/leitura-inaugural]";

  const authOptions = await resolveAuthOptions();
  const session = await getServerSession(authOptions);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userId = (session as any)?.user?.id as string | undefined;

  if (!userId) {
    return NextResponse.json({ message: "Não autenticado." }, { status: 401 });
  }

  try {
    await connectToDatabase();

    const mapaDoc = await MapaSeedModel.findOne({ userId }).lean();

    if (!mapaDoc) {
      return NextResponse.json(
        { message: "Mapa seed não encontrado. Complete o onboarding primeiro." },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        mapa: mapaDoc.mapa,
        leituraInaugural: mapaDoc.leituraInaugural ?? null,
        onboardingAnswers: mapaDoc.onboardingAnswers,
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error(`${TAG} Erro ao buscar mapa para userId=${userId}:`, error);
    return NextResponse.json(
      { message: "Erro interno ao buscar o mapa." },
      { status: 500 }
    );
  }
}

// ─── POST — regenera a leitura inaugural ────────────────────────────────────

export async function POST() {
  const TAG = "[API POST /onboarding/leitura-inaugural]";

  const authOptions = await resolveAuthOptions();
  const session = await getServerSession(authOptions);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userId = (session as any)?.user?.id as string | undefined;

  if (!userId) {
    return NextResponse.json({ message: "Não autenticado." }, { status: 401 });
  }

  try {
    await connectToDatabase();

    const mapaDoc = await MapaSeedModel.findOne({ userId });

    if (!mapaDoc) {
      return NextResponse.json(
        { message: "Mapa seed não encontrado. Complete o onboarding primeiro." },
        { status: 404 }
      );
    }

    // Regenerar leitura — claude-sonnet-4-5 · high
    const leituraInaugural = await generateLeituraInaugural(mapaDoc.mapa);

    mapaDoc.leituraInaugural = leituraInaugural;
    await mapaDoc.save();

    logger.info(`${TAG} Leitura inaugural regenerada para userId=${userId}`);

    return NextResponse.json({ leituraInaugural }, { status: 200 });
  } catch (error) {
    logger.error(`${TAG} Erro ao regenerar leitura para userId=${userId}:`, error);
    return NextResponse.json(
      { message: "Não foi possível gerar a leitura. Tente novamente." },
      { status: 500 }
    );
  }
}
