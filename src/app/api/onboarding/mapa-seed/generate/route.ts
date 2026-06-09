// src/app/api/onboarding/mapa-seed/generate/route.ts
// POST /api/onboarding/mapa-seed/generate
//
// Recebe as 7 respostas do onboarding, gera o mapa seed via Claude
// (medium) e a leitura inaugural (high), salva no banco e retorna ambos.
//
// Body esperado: { answers: IOnboardingAnswers }
// Resposta: { mapa: IMapaData, leituraInaugural: ILeituraInaugural }

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { resolveAuthOptions } from "@/app/api/auth/resolveAuthOptions";
import { connectToDatabase } from "@/app/lib/mongoose";
import { logger } from "@/app/lib/logger";
import { generateMapaSeed } from "@/app/lib/mapaSeed/generateMapaSeed";
import { generateLeituraInaugural } from "@/app/lib/mapaSeed/generateLeituraInaugural";
import MapaSeedModel from "@/app/models/MapaSeed";
import type { IOnboardingAnswers } from "@/app/models/MapaSeed";

// ─── Validação do body ────────────────────────────────────────────────────────

const REQUIRED_FIELDS: (keyof IOnboardingAnswers)[] = [
  "apresentacao",
  "motivacao",
  "fioConductor",
  "territorios",
  "adjacencias",
  "tom",
  "formatos",
];

function parseBody(body: unknown): { ok: true; answers: IOnboardingAnswers } | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Body deve ser um objeto JSON." };
  }

  const b = body as Record<string, unknown>;

  if (!b.answers || typeof b.answers !== "object") {
    return { ok: false, error: "Campo 'answers' ausente ou inválido." };
  }

  const answers = b.answers as Record<string, unknown>;

  for (const field of REQUIRED_FIELDS) {
    if (typeof answers[field] !== "string" || !(answers[field] as string).trim()) {
      return { ok: false, error: `Campo '${field}' é obrigatório e não pode estar vazio.` };
    }
  }

  return {
    ok: true,
    answers: {
      apresentacao:  (answers.apresentacao  as string).trim().slice(0, 1000),
      motivacao:     (answers.motivacao     as string).trim().slice(0, 1000),
      fioConductor:  (answers.fioConductor  as string).trim().slice(0, 1000),
      territorios:   (answers.territorios   as string).trim().slice(0, 1000),
      adjacencias:   (answers.adjacencias   as string).trim().slice(0, 1000),
      tom:           (answers.tom           as string).trim().slice(0, 500),
      formatos:      (answers.formatos      as string).trim().slice(0, 500),
    },
  };
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const TAG = "[API /onboarding/mapa-seed/generate]";

  // Auth
  const authOptions = await resolveAuthOptions();
  const session = await getServerSession(authOptions);
  const userId = (session as any)?.user?.id as string | undefined;

  if (!userId) {
    logger.warn(`${TAG} Tentativa não autenticada.`);
    return NextResponse.json({ message: "Não autenticado." }, { status: 401 });
  }

  // Parse body
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ message: "Body inválido." }, { status: 400 });
  }

  const parsed = parseBody(rawBody);
  if (!parsed.ok) {
    return NextResponse.json({ message: parsed.error }, { status: 400 });
  }

  const { answers } = parsed;

  try {
    await connectToDatabase();

    // Verificar se já existe mapa para este usuário
    const existingMapa = await MapaSeedModel.findOne({ userId });
    if (existingMapa) {
      logger.info(`${TAG} Mapa seed já existe para userId=${userId}. Atualizando.`);
    }

    // Gerar mapa seed — claude-sonnet-4-5 · medium
    const mapa = await generateMapaSeed(answers);

    // Gerar leitura inaugural — claude-sonnet-4-5 · high
    const leituraInaugural = await generateLeituraInaugural(mapa);

    // Persistir no banco
    const mapaDoc = await MapaSeedModel.findOneAndUpdate(
      { userId },
      {
        $set: {
          userId,
          onboardingAnswers: answers,
          mapa,
          leituraInaugural,
        },
      },
      { upsert: true, new: true }
    );

    logger.info(`${TAG} Mapa seed salvo para userId=${userId}. _id=${mapaDoc._id}`);

    return NextResponse.json(
      {
        mapa: mapaDoc.mapa,
        leituraInaugural: mapaDoc.leituraInaugural,
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error(`${TAG} Erro ao gerar mapa seed para userId=${userId}:`, error);
    return NextResponse.json(
      { message: "Não foi possível gerar o mapa. Tente novamente." },
      { status: 500 }
    );
  }
}

// Bloquear outros métodos
export async function GET() {
  return NextResponse.json({ message: "Método não permitido." }, { status: 405 });
}
