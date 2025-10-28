// src/app/api/whatsapp/weeklyReport/route.ts - Correção v1.2.1
// - Mantém active-like + WhatsApp verificado
// - FIX: remove '@ts-expect-error' não usado e faz narrowing tipado de failures

import { NextRequest, NextResponse } from "next/server";
import { guardPremiumRequest } from "@/app/lib/planGuard";
import { connectDB, safeSendWhatsAppMessage } from "@/app/lib/helpers";
import User from "@/app/models/User";
import Metric from "@/app/models/Metric";
import { buildAggregatedReport, AggregatedReport } from "@/app/lib/reportHelpers";
import { generateStrategicWeeklySummary } from "@/app/lib/consultantService";
import { logger } from "@/app/lib/logger";
import { subDays } from "date-fns";
import { MetricsNotFoundError, ReportAggregationError } from "@/app/lib/errors";
import { isActiveLike, type ActiveLikeStatus } from "@/app/lib/isActiveLike";

export const runtime = "nodejs";

/**
 * GET /api/whatsapp/weeklyReport
 * Handler para verificação do callback do WhatsApp/Facebook.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    logger.debug("[whatsapp/weeklyReport GET] Verificação de callback sucedida.");
    return new Response(challenge || "", { status: 200 });
  }
  logger.error("[whatsapp/weeklyReport GET] Falha na verificação do callback:", {
    mode,
    token: token ? "***" : "MISSING",
    expected: process.env.WHATSAPP_VERIFY_TOKEN ? "***" : "UNDEFINED",
  });
  return NextResponse.json(
    { error: "Token de verificação inválido ou parâmetros faltando" },
    { status: 403 }
  );
}

/** Resultado por usuário */
interface ReportResult {
  userId: string;
  success: boolean;
  reason?: string;
}

/** Type guards para Promise.allSettled */
function isFulfilled<T>(
  r: PromiseSettledResult<T>
): r is PromiseFulfilledResult<T> {
  return r.status === "fulfilled";
}
function isRejected<T>(
  r: PromiseSettledResult<T>
): r is PromiseRejectedResult {
  return r.status === "rejected";
}

/**
 * POST /api/whatsapp/weeklyReport
 * Envia relatórios semanais ESTRATÉGICOS via WhatsApp para todos os usuários
 * com plano ativo-like (active | non_renewing | trial | trialing) e WhatsApp verificado.
 * Idealmente acionado às sextas-feiras (CRON/job).
 */
export async function POST(request: NextRequest) {
  const guardResponse = await guardPremiumRequest(request);
  if (guardResponse) return guardResponse;

  const functionName = "[whatsapp/weeklyReport POST v1.2.1]";
  try {
    // Só roda na sexta, exceto em dev
    const today = new Date().getDay();
    if (today !== 5 && process.env.NODE_ENV !== "development") {
      logger.warn(
        `${functionName} Endpoint chamado fora de sexta-feira (e não em dev). Nenhum relatório será enviado.`
      );
      return NextResponse.json(
        { message: "Relatórios só são enviados às sextas-feiras." },
        { status: 200 }
      );
    }
    if (today === 5) {
      logger.info(`${functionName} Hoje é sexta-feira, iniciando geração de relatórios...`);
    } else {
      logger.info(`${functionName} Executando em ambiente de desenvolvimento fora de sexta-feira...`);
    }

    // 1) DB
    await connectDB();
    logger.debug(`${functionName} Conectado ao MongoDB.`);

    // 2) Usuários elegíveis: active-like + whatsapp verificado
    const ACTIVE_LIKE: ActiveLikeStatus[] = [
      "active",
      "non_renewing",
      "trial",
      "trialing",
    ].filter(isActiveLike);
    logger.debug(`${functionName} Buscando usuários elegíveis...`);
    const users = await User.find({
      planStatus: { $in: ACTIVE_LIKE },
      whatsappVerified: true,
      whatsappPhone: { $exists: true, $nin: [null, ""] },
      whatsappTrialActive: { $ne: true },
    }).lean();
    logger.info(
      `${functionName} Usuários elegíveis (active-like + verificado) encontrados: ${users.length}`
    );
    if (!users?.length) {
      return NextResponse.json(
        { message: "Nenhum usuário elegível com WhatsApp verificado para enviar relatório." },
        { status: 200 }
      );
    }

    // 3) Período dos últimos 7 dias
    const now = new Date();
    const fromDate = subDays(now, 7);
    fromDate.setHours(0, 0, 0, 0);
    logger.debug(
      `${functionName} Período de análise: ${fromDate.toISOString()} até ${now.toISOString()}`
    );

    // 4) Processa usuários em paralelo
    const results = await Promise.allSettled<ReportResult>(
      users.map(async (user): Promise<ReportResult> => {
        const userId = user?._id?.toString() || "INVALID_USER";
        try {
          if (!user?._id || typeof user.whatsappPhone !== "string" || !user.whatsappPhone.trim()) {
            logger.error(`${functionName} Usuário inválido ou sem WhatsApp válido:`, user?._id);
            return { userId, success: false, reason: "Dados inválidos do usuário" };
          }

          logger.debug(`${functionName} Construindo relatório agregado para ${userId}...`);
          // buildAggregatedReport(userId(ObjectId), startDate(Date), MetricModel)
          const aggregatedReport: AggregatedReport = await buildAggregatedReport(
            user._id,
            fromDate,
            Metric
          );
          logger.debug(`${functionName} Dados agregados para ${userId} calculados.`);

          if (!aggregatedReport || !aggregatedReport.overallStats) {
            logger.warn(
              `${functionName} Nenhum dado encontrado no período para gerar relatório para ${userId}.`
            );
            return { userId, success: false, reason: "Sem dados no período" };
          }

          // 5) Gera texto estratégico (usa userId conforme contrato atual)
          logger.debug(`${functionName} Gerando resumo estratégico para ${userId}...`);
          const reportText = await generateStrategicWeeklySummary(user.name || "Usuário", userId);

          if (
            !reportText ||
            reportText.includes("Não foi possível gerar") ||
            reportText.includes("Erro ao Gerar") ||
            reportText.includes("Não consegui buscar")
          ) {
            logger.warn(
              `${functionName} Falha ao gerar texto do relatório para ${userId}. Resposta IA: ${reportText}`
            );
            return { userId, success: false, reason: "Falha na geração do texto pela IA" };
          }

          // 6) Ajusta telefone para E.164 básico
          let phoneWithPlus = user.whatsappPhone.trim();
          if (!phoneWithPlus.startsWith("+")) {
            if (phoneWithPlus.length === 11 || phoneWithPlus.length === 10) {
              phoneWithPlus = "+55" + phoneWithPlus;
            } else if (phoneWithPlus.length === 13 && phoneWithPlus.startsWith("55")) {
              phoneWithPlus = "+" + phoneWithPlus;
            } else {
              logger.warn(
                `${functionName} Formato de telefone não reconhecido para ${userId}: ${user.whatsappPhone}`
              );
            }
          }
          if (!/^\+\d{9,15}$/.test(phoneWithPlus)) {
            logger.warn(
              `${functionName} Número de telefone inválido após ajuste (${phoneWithPlus}) para ${userId}. Pulando envio.`
            );
            return { userId, success: false, reason: `Telefone inválido: ${user.whatsappPhone}` };
          }

          // 7) Envia
          logger.debug(`${functionName} Enviando relatório para ${userId} (${phoneWithPlus})...`);
          await safeSendWhatsAppMessage(phoneWithPlus, reportText);
          logger.info(`${functionName} Relatório enviado para usuário ${userId}`);
          return { userId, success: true };
        } catch (error: unknown) {
          logger.error(`${functionName} Erro ao processar ${userId}:`, error);
          let reason = "Erro desconhecido no processamento";
          if (error instanceof MetricsNotFoundError || error instanceof ReportAggregationError) {
            reason = error.message;
          } else if (error instanceof Error) {
            logger.error(
              `${functionName} Detalhes do erro (${userId}): ${error.name} - ${error.message}`
            );
            reason = error.message;
          }
          return { userId, success: false, reason };
        }
      })
    );

    // 5) Consolida com narrowing tipado
    const successResults = results.filter(
      (r): r is PromiseFulfilledResult<ReportResult> =>
        r.status === "fulfilled" && r.value.success
    );
    const failedFulfilled = results.filter(
      (r): r is PromiseFulfilledResult<ReportResult> =>
        r.status === "fulfilled" && !r.value.success
    );
    const rejectedResults = results.filter(isRejected);

    logger.info(
      `${functionName} Concluído. Sucessos: ${successResults.length}, Falhas: ${
        failedFulfilled.length + rejectedResults.length
      }`
    );

    if (failedFulfilled.length + rejectedResults.length > 0) {
      const failureDetails = [
        ...rejectedResults.map((r) => ({
          status: r.status,
          reason: (r.reason?.message || r.reason) as string,
        })),
        ...failedFulfilled.map((r) => ({
          status: r.status,
          value: {
            userId: r.value.userId,
            success: r.value.success,
            reason: r.value.reason,
          },
        })),
      ];
      logger.warn(`${functionName} Detalhes das falhas:`, JSON.stringify(failureDetails, null, 2));
    }

    return NextResponse.json(
      {
        message: `Relatórios enviados para ${successResults.length} usuários. Falhas: ${
          failedFulfilled.length + rejectedResults.length
        }.`,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    logger.error(`${functionName} Erro GERAL no endpoint /api/whatsapp/weeklyReport:`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `Erro interno do servidor: ${errorMessage}` }, { status: 500 });
  }
}
