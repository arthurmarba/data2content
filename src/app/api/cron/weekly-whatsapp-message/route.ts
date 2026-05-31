/**
 * POST /api/cron/weekly-whatsapp-message
 *
 * Triggered weekly (e.g. every Monday 09:30 BRT) by QStash — 30 minutes
 * after regenerate-content-ideas so pautas estão frescas antes do envio.
 *
 * Para cada criador Pro com WhatsApp verificado e mensagem atrasada (> 6 dias):
 *   1. Gera o corpo da newsletter via Gemini (weeklyWhatsAppMessageService)
 *   2. Envia pelo sendTemplateMessage (Meta WhatsApp Cloud API)
 *   3. Escreve weeklyWhatsAppSentAt no User para throttle da próxima semana
 *
 * Erros por usuário são logados e não interrompem o batch.
 * BATCH_SIZE = 30 — mesma capacidade de regenerate-content-ideas.
 *
 * ⚠️  Depende dos templates Meta WABA aprovados:
 *       d2c_weekly_seed_v1
 *       d2c_weekly_newsletter_v1
 *     Ver docs/whatsapp-weekly-templates.md para spec de submissão.
 */

import { NextRequest, NextResponse } from "next/server";
import { Receiver } from "@upstash/qstash";
import { Types } from "mongoose";
import { logger } from "@/app/lib/logger";
import { connectToDatabase } from "@/app/lib/mongoose";
import { isMobileStrategicProfileEnabled } from "@/app/dashboard/boards/videoUpload/mobileStrategicProfileFeatureFlag";
import { generateWeeklyWhatsAppMessageForUser } from "@/app/dashboard/boards/videoUpload/weeklyWhatsAppMessageService";
import { sendTemplateMessage } from "@/app/lib/whatsappService";
import type { ITemplateComponent } from "@/app/lib/whatsappService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutos

// ─── QStash verification ─────────────────────────────────────────────────────

const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY;

let receiver: Receiver | null = null;
if (currentSigningKey && nextSigningKey) {
  receiver = new Receiver({ currentSigningKey, nextSigningKey });
}

// ─── Constants ────────────────────────────────────────────────────────────────

const BATCH_SIZE = 30;
const SIX_DAYS_AGO = () => new Date(Date.now() - 6 * 24 * 60 * 60 * 1000);

// ─── Per-user dispatch ────────────────────────────────────────────────────────

type DispatchResult =
  | { ok: true }
  | { ok: false; skipped: string };

async function dispatchMessageForUser(userId: string): Promise<DispatchResult> {
  try {
    // 1. Generate message content (eligibility + throttle + Gemini)
    const generated = await generateWeeklyWhatsAppMessageForUser(userId);

    if (!generated.ok) {
      return { ok: false, skipped: generated.skipped ?? "generation_skipped" };
    }

    const { payload } = generated;
    if (!payload) {
      return { ok: false, skipped: "no_payload" };
    }

    // 2. Build template components for Meta API
    //    Template body: "{{1}}, seu mapa...\n\n{{2}}\n\n→ {{3}}"
    //    bodyParams = [creatorFirstName, messageBody, ctaText]
    const components: ITemplateComponent[] = [
      {
        type: "body",
        parameters: payload.bodyParams.map((text) => ({
          type: "text",
          text,
        })),
      },
    ];

    // 3. Send via WhatsApp Cloud API
    await sendTemplateMessage(
      payload.whatsappPhone,
      payload.templateName,
      components,
      "pt_BR",
    );

    // 4. Write throttle stamp — only after confirmed send
    const { default: User } = await import("@/app/models/User");
    await User.findByIdAndUpdate(userId, {
      $set: { weeklyWhatsAppSentAt: new Date() },
    });

    logger.info(
      `[Cron WhatsAppWeekly] userId=${userId} tier=${payload.tier} template=${payload.templateName} enviado.`,
    );
    return { ok: true };
  } catch (err) {
    logger.error(`[Cron WhatsAppWeekly] userId=${userId} erro inesperado:`, err);
    return { ok: false, skipped: "unexpected_error" };
  }
}

// ─── Route handlers ───────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  if (!isMobileStrategicProfileEnabled()) {
    return NextResponse.json({ message: "Recurso não habilitado." }, { status: 404 });
  }

  // Verificar assinatura QStash (pular em desenvolvimento)
  if (process.env.NODE_ENV !== "development" && receiver) {
    const signature = request.headers.get("upstash-signature") ?? "";
    const body = await request.text();
    const isValid = await receiver.verify({ signature, body }).catch(() => false);
    if (!isValid) {
      logger.warn("[Cron WhatsAppWeekly] Assinatura QStash inválida.");
      return NextResponse.json({ message: "Assinatura inválida." }, { status: 401 });
    }
  }

  logger.info("[Cron WhatsAppWeekly] Iniciando despacho semanal de newsletters.");

  try {
    await connectToDatabase();
    const { default: User } = await import("@/app/models/User");

    // Buscar criadores elegíveis:
    // - WhatsApp verificado e não opt-out
    // - Mensagem nunca enviada OU enviada há mais de 6 dias
    const sixDaysAgo = SIX_DAYS_AGO();
    const eligibleUsers = await User.find({
      whatsappVerified: true,
      $and: [
        // Não opt-out (campo pode não existir em registros antigos)
        { $or: [{ whatsappOptOut: { $exists: false } }, { whatsappOptOut: false }] },
        // Mensagem nunca enviada OU enviada há mais de 6 dias
        {
          $or: [
            { weeklyWhatsAppSentAt: { $exists: false } },
            { weeklyWhatsAppSentAt: null },
            { weeklyWhatsAppSentAt: { $lte: sixDaysAgo } },
          ],
        },
      ],
    })
      .select("_id")
      .limit(BATCH_SIZE)
      .lean<Array<{ _id: Types.ObjectId }>>();

    logger.info(
      `[Cron WhatsAppWeekly] ${eligibleUsers.length} criadores elegíveis encontrados.`,
    );

    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const user of eligibleUsers) {
      const result = await dispatchMessageForUser(user._id.toString());

      if (result.ok) {
        sent++;
      } else if (
        result.skipped === "no_whatsapp" ||
        result.skipped === "opted_out" ||
        result.skipped === "not_eligible" ||
        result.skipped === "too_recent" ||
        result.skipped === "no_readings"
      ) {
        skipped++;
      } else {
        failed++;
      }
    }

    logger.info(
      `[Cron WhatsAppWeekly] Concluído. Enviados: ${sent}, Pulados: ${skipped}, Falhas: ${failed}.`,
    );

    return NextResponse.json({ ok: true, sent, skipped, failed });
  } catch (err) {
    logger.error("[Cron WhatsAppWeekly] Erro geral:", err);
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
