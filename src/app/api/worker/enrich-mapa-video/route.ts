// src/app/api/worker/enrich-mapa-video/route.ts
//
// Worker QStash que enriquece o MapaSeed de um usuário com a síntese das suas
// leituras de vídeo publicadas. Disparado ao declarar publishIntent="yes" na
// rota publish-intent. Espelha o padrão de refresh-instagram-user.

import { NextRequest, NextResponse } from "next/server";
import { Receiver } from "@upstash/qstash";
import { logger } from "@/app/lib/logger";
import mongoose from "mongoose";
import { enrichMapaSeedWithVideoForUser } from "@/app/lib/mapaSeed/enrichMapaSeedWithVideoForUser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// --- INICIALIZAÇÃO DO QSTASH RECEIVER ---
const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY;

let receiver: Receiver | null = null;
let initError: string | null = null;

if (!currentSigningKey || !nextSigningKey) {
  initError = "Chaves de assinatura QStash (CURRENT ou NEXT) não definidas no ambiente.";
  logger.error(`[Worker EnrichMapaVideo Init] ${initError}`);
} else {
  try {
    receiver = new Receiver({
      currentSigningKey,
      nextSigningKey,
    });
    logger.info(`[Worker EnrichMapaVideo Init] QStash Receiver inicializado com sucesso.`);
  } catch (e: any) {
    initError = `Erro ao inicializar QStash Receiver: ${e.message}`;
    logger.error(`[Worker EnrichMapaVideo Init] ${initError}`);
  }
}
// --- FIM DA INICIALIZAÇÃO ---

/**
 * POST /api/worker/enrich-mapa-video
 * Endpoint "trabalhador" chamado pelo QStash para enriquecer o MapaSeed de UM
 * usuário a partir das suas leituras de vídeo publicadas.
 */
export async function POST(request: NextRequest) {
  const TAG = "[Worker EnrichMapaVideo]";
  logger.info(`${TAG} Handler POST iniciado.`);

  if (!receiver) {
    logger.error(`${TAG} Erro CRÍTICO: QStash Receiver não inicializado. ${initError}`);
    return NextResponse.json(
      { error: `Configuration error: ${initError || "Receiver not initialized."}` },
      { status: 500 },
    );
  }

  let userId: string | null = null;

  try {
    const signature = request.headers.get("upstash-signature");
    if (!signature) {
      logger.error(`${TAG} Header 'upstash-signature' ausente na requisição.`);
      return NextResponse.json({ error: "Missing signature header" }, { status: 401 });
    }

    const bodyText = await request.text();
    const isValid = await receiver.verify({ signature, body: bodyText });
    if (!isValid) {
      logger.error(`${TAG} Assinatura QStash inválida recebida.`);
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    let payload: any;
    try {
      payload = JSON.parse(bodyText);
      userId = payload?.userId;
    } catch (parseError) {
      logger.error(`${TAG} Erro ao parsear corpo da requisição JSON:`, parseError);
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (!userId || typeof userId !== "string" || !mongoose.isValidObjectId(userId)) {
      logger.error(`${TAG} 'userId' ausente ou inválido no corpo da requisição: ${userId}`);
      return NextResponse.json({ error: "Missing or invalid userId in request body" }, { status: 400 });
    }

    logger.info(`${TAG} Enriquecendo MapaSeed com vídeo para User ID: ${userId}...`);
    // enrichMapaSeedWithVideoForUser é non-fatal por dentro — sempre resolve.
    await enrichMapaSeedWithVideoForUser(userId);
    logger.info(`${TAG} Enriquecimento de vídeo concluído para User ID: ${userId}.`);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    logger.error(`${TAG} Erro GERAL não tratado no Worker para User ${userId ?? "desconhecido"}:`, error);
    return NextResponse.json({ error: "Internal server error in worker" }, { status: 500 });
  }
}
