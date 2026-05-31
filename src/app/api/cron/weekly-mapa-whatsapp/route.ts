// src/app/api/cron/weekly-mapa-whatsapp/route.ts
// POST /api/cron/weekly-mapa-whatsapp
//
// ÚNICA mensagem WhatsApp semanal da plataforma — toda segunda às 09:00 BRT.
// As rotas whatsapp-tips e weekly-whatsapp-message foram desativadas do schedule;
// este endpoint é o canal exclusivo de WhatsApp para criadores Pro.
//
// Para cada criador Pro com WhatsApp verificado + mapa seed + sem envio nos últimos 6 dias:
//   1. Busca até 2 pautas "saved" ou "active" mais recentes (para mapa rico)
//   2. Gera o corpo da mensagem via gpt-4o-mini (generateWhatsappMessage)
//      → Segmento seed: sinal do mapa + convite a enriquecer (≤ 280 chars)
//      → Segmento rico: preview 2 pautas + descoberta se houver (≤ 320 chars)
//   3. Envia pelo safeSendWhatsAppMessage (generic template)
//   4. Persiste weeklyMapaWhatsAppSentAt no User (throttle gate de 6 dias)
//
// Erros por usuário são logados e não interrompem o batch.
// BATCH_SIZE = 50

import { NextRequest, NextResponse } from "next/server";
import { Receiver } from "@upstash/qstash";
import { Types } from "mongoose";
import { logger } from "@/app/lib/logger";
import { connectToDatabase } from "@/app/lib/mongoose";
import { safeSendWhatsAppMessage } from "@/app/lib/helpers";
import {
  generateWhatsappMessage,
  type WhatsappMessageContext,
} from "@/app/lib/mapaSeed/generateWhatsappMessage";
import type { IMapaData } from "@/app/models/MapaSeed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// ─── QStash verification ──────────────────────────────────────────────────────

const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
const nextSigningKey    = process.env.QSTASH_NEXT_SIGNING_KEY;

let receiver: Receiver | null = null;
if (currentSigningKey && nextSigningKey) {
  receiver = new Receiver({ currentSigningKey, nextSigningKey });
}

// ─── Constants ────────────────────────────────────────────────────────────────

const BATCH_SIZE   = 50;
const SIX_DAYS_AGO = () => new Date(Date.now() - 6 * 24 * 60 * 60 * 1000);
const BASE_URL     = process.env.NEXT_PUBLIC_BASE_URL ?? "https://data2content.com.br";

// ─── Per-user dispatch ────────────────────────────────────────────────────────

type SkipReason =
  | "no_phone"
  | "no_mapa"
  | "too_recent"
  | "generation_empty"
  | "unexpected_error";

type DispatchResult =
  | { ok: true }
  | { ok: false; skipped: SkipReason };

async function dispatchForUser(
  userId: string,
  creatorName: string,
  phone: string,
): Promise<DispatchResult> {
  const TAG = `[Cron MapaWhatsApp] userId=${userId}`;

  try {
    const { default: MapaSeedModel } = await import("@/app/models/MapaSeed");
    const { default: CreatorContentIdea } = await import(
      "@/app/models/CreatorContentIdea"
    );

    // 1. Carregar mapa seed
    const mapaDoc = await MapaSeedModel.findOne({ userId }).lean();
    if (!mapaDoc) {
      logger.info(`${TAG} sem mapa seed — pulando.`);
      return { ok: false, skipped: "no_mapa" };
    }

    const mapa = mapaDoc.mapa as IMapaData;

    // 2. Buscar pautas recentes (apenas para mapa rico)
    let pautasTitulos: string[] = [];
    if (mapa.maturidade !== "seed") {
      const pautas = await CreatorContentIdea.find({
        userId,
        status: { $in: ["saved", "active"] },
      })
        .sort({ generatedAt: -1 })
        .limit(2)
        .select("title")
        .lean<Array<{ title: string }>>();

      pautasTitulos = pautas.map((p) => p.title);
    }

    // 3. Gerar mensagem
    const ctx: WhatsappMessageContext = {
      mapa,
      creatorName,
      pautasTitulos,
      baseUrl: BASE_URL,
    };

    const { body } = await generateWhatsappMessage(ctx);

    if (!body.trim()) {
      logger.warn(`${TAG} mensagem gerada vazia — pulando.`);
      return { ok: false, skipped: "generation_empty" };
    }

    // 4. Enviar pelo canal WhatsApp
    await safeSendWhatsAppMessage(phone, body);

    // 5. Persistir throttle stamp — só após envio confirmado
    const { default: User } = await import("@/app/models/User");
    await User.findByIdAndUpdate(userId, {
      $set: { weeklyMapaWhatsAppSentAt: new Date() },
    });

    logger.info(`${TAG} mensagem enviada (${body.length} chars) | segmento=${mapa.maturidade === "seed" ? "seed" : "rico"}`);
    return { ok: true };
  } catch (err) {
    logger.error(`${TAG} erro inesperado:`, err);
    return { ok: false, skipped: "unexpected_error" };
  }
}

// ─── Route handlers ───────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const TAG = "[Cron MapaWhatsApp]";

  // Verificar assinatura QStash (pular em desenvolvimento)
  if (process.env.NODE_ENV !== "development" && receiver) {
    const signature = request.headers.get("upstash-signature") ?? "";
    const body      = await request.text();
    const isValid   = await receiver.verify({ signature, body }).catch(() => false);
    if (!isValid) {
      logger.warn(`${TAG} Assinatura QStash inválida.`);
      return NextResponse.json({ message: "Assinatura inválida." }, { status: 401 });
    }
  }

  logger.info(`${TAG} Iniciando despacho semanal de mensagens mapa.`);

  try {
    await connectToDatabase();
    const { default: User } = await import("@/app/models/User");
    const { default: MapaSeedModel } = await import("@/app/models/MapaSeed");

    // Buscar criadores Pro com WhatsApp verificado e sem envio recente
    const sixDaysAgo = SIX_DAYS_AGO();

    const eligibleUsers = await User.find({
      whatsappVerified: true,
      planStatus: { $in: ["active", "trialing", "past_due"] },
      $and: [
        { $or: [{ whatsappOptOut: { $exists: false } }, { whatsappOptOut: false }] },
        {
          $or: [
            { weeklyMapaWhatsAppSentAt: { $exists: false } },
            { weeklyMapaWhatsAppSentAt: null },
            { weeklyMapaWhatsAppSentAt: { $lte: sixDaysAgo } },
          ],
        },
      ],
    })
      .select("_id name whatsappPhone")
      .limit(BATCH_SIZE)
      .lean<Array<{ _id: Types.ObjectId; name?: string; whatsappPhone?: string | null }>>();

    logger.info(`${TAG} ${eligibleUsers.length} usuários elegíveis encontrados.`);

    // Filtrar apenas quem tem mapa seed (join em memória para manter query simples)
    const userIds = eligibleUsers.map((u) => u._id);
    const mapaUserIds = await MapaSeedModel.distinct("userId", {
      userId: { $in: userIds },
    });
    const mapaSet = new Set(mapaUserIds.map((id) => id.toString()));

    let sent    = 0;
    let skipped = 0;
    let failed  = 0;

    for (const user of eligibleUsers) {
      const userId = user._id.toString();

      // Sem mapa → pular
      if (!mapaSet.has(userId)) {
        skipped++;
        continue;
      }

      const phone = user.whatsappPhone;
      if (!phone) {
        skipped++;
        continue;
      }

      const creatorName = user.name ?? "Criador";
      const result = await dispatchForUser(userId, creatorName, phone);

      if (result.ok) {
        sent++;
      } else if (result.skipped === "unexpected_error") {
        failed++;
      } else {
        skipped++;
      }
    }

    logger.info(
      `${TAG} Concluído. Enviados: ${sent}, Pulados: ${skipped}, Falhas: ${failed}.`
    );

    return NextResponse.json({ ok: true, sent, skipped, failed });
  } catch (err) {
    logger.error(`${TAG} Erro geral:`, err);
    return NextResponse.json({ message: "Erro interno." }, { status: 500 });
  }
}

// Trigger manual em desenvolvimento
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ message: "Método não permitido." }, { status: 405 });
  }
  return POST(request);
}
