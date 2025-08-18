// src/app/api/whatsapp/weeklyReport/route.ts - Correção v1.1

import { NextRequest, NextResponse } from "next/server";
import { guardPremiumRequest } from "@/app/lib/planGuard";
import { getToken } from "next-auth/jwt";
import { connectDB, safeSendWhatsAppMessage } from "@/app/lib/helpers"; // Verifique os caminhos
import User, { IUser } from "@/app/models/User"; // Verifique o caminho
import Metric, { IMetric } from "@/app/models/Metric"; // Verifique o caminho - NECESSÁRIO AGORA
import { buildAggregatedReport, AggregatedReport } from "@/app/lib/reportHelpers"; // Verifique o caminho - Importa a versão refatorada
import { generateStrategicWeeklySummary } from "@/app/lib/consultantService"; // Verifique o caminho
import { Types, Model } from "mongoose";
import { logger } from '@/app/lib/logger'; // Ajuste o caminho se necessário
import { subDays } from 'date-fns'; // Necessário para calcular sinceDate
import { MetricsNotFoundError, ReportAggregationError } from '@/app/lib/errors'; // Importa erros específicos

export const runtime = "nodejs";

/**
 * GET /api/whatsapp/weeklyReport
 * Handler para verificação do callback do webhook do WhatsApp/Facebook.
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
    token: token ? '***' : 'MISSING',
    expected: process.env.WHATSAPP_VERIFY_TOKEN ? '***' : 'UNDEFINED',
  });
  return NextResponse.json(
    { error: "Token de verificação inválido ou parâmetros faltando" },
    { status: 403 }
  );
}

/**
 * Interface para o resultado do envio de relatório para cada usuário.
 */
interface ReportResult {
  userId: string;
  success: boolean;
  reason?: string;
}

/**
 * POST /api/whatsapp/weeklyReport
 * Envia relatórios semanais ESTRATÉGICOS via WhatsApp para todos os usuários com plano ativo e número de WhatsApp cadastrado.
 * Este endpoint deve ser acionado somente em sextas-feiras (por exemplo, via job agendado/CRON).
 * Utiliza JWT para autenticação (getToken).
 */
export async function POST(request: NextRequest) {
  const guardResponse = await guardPremiumRequest(request);
  if (guardResponse) {
    return guardResponse;
  }

  const functionName = "[whatsapp/weeklyReport POST v1.1]"; // Atualiza tag da versão
  try {
    // Verifica se hoje é sexta-feira (dia 5)
    const today = new Date().getDay();
    if (today !== 5 && process.env.NODE_ENV !== 'development') {
        logger.warn(`${functionName} Endpoint chamado fora de sexta-feira (e não em dev). Nenhum relatório será enviado.`);
        return NextResponse.json({ message: "Relatórios só são enviados às sextas-feiras." }, { status: 200 });
    }
    if (today === 5) {
        logger.info(`${functionName} Hoje é sexta-feira, iniciando geração de relatórios...`);
    } else {
        logger.info(`${functionName} Executando em ambiente de desenvolvimento fora de sexta-feira...`);
    }

    // 1) Extrai o token JWT (Apenas para verificar se a chamada é autenticada, não usado para pegar usuário)
    // A autenticação real pode vir de um segredo na URL ou header se for um CRON job.
    // Se for chamado internamente, a autenticação pode não ser necessária aqui.
    // Vamos assumir que a chamada é segura (ex: via CRON com segredo ou chamada interna).
    // const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    // if (!token) {
    //   logger.error(`${functionName} Token não encontrado.`);
    //   return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    // }
    // logger.debug(`${functionName} Token extraído com sucesso.`);
    logger.info(`${functionName} Iniciando processo de envio de relatórios semanais...`);


    // 2) Conecta ao banco de dados
    await connectDB();
    logger.debug(`${functionName} Conectado ao MongoDB.`);

    // 3) Busca usuários ativos com WhatsApp
    logger.debug(`${functionName} Buscando usuários...`);
    const users = await User.find({
      planStatus: "active",
      whatsappPhone: {
        $exists: true,
        $nin: [null, ""]
      }
    }).lean();
    logger.info(`${functionName} Usuários ativos com WhatsApp encontrados: ${users.length}`);
    if (!users?.length) {
      return NextResponse.json(
        { message: "Nenhum usuário ativo com WhatsApp cadastrado para enviar relatório." },
        { status: 200 }
      );
    }

    // 4) Define o período para os dados: últimos 7 dias
    const now = new Date();
    const fromDate = subDays(now, 7); // Usa subDays importado
    fromDate.setHours(0, 0, 0, 0);
    logger.debug(`${functionName} Período de análise: ${fromDate.toISOString()} até ${now.toISOString()}`);

    // 5) Processa os usuários
    const results = await Promise.allSettled<ReportResult>(
      users.map(async (user): Promise<ReportResult> => {
        if (!user?._id || !user.whatsappPhone || typeof user.whatsappPhone !== 'string' || user.whatsappPhone.trim() === '') {
            logger.error(`${functionName} Usuário inválido ou sem WhatsApp válido:`, user?._id);
            return { userId: user?._id?.toString() || 'INVALID_USER', success: false, reason: "Dados inválidos do usuário" };
        }
        const userId = user._id.toString();
        const userIdObj = user._id; // Já é ObjectId por causa do .lean()

        try {
          logger.debug(`${functionName} Iniciando processamento para usuário ${userId}`);

          // <<< REMOVIDO: Não busca mais DailyMetrics aqui >>>

          // 5b) <<< CORRIGIDO: Chama buildAggregatedReport com 3 argumentos >>>
          logger.debug(`${functionName} Chamando buildAggregatedReport (v4.0) para ${userId}...`);
          // Nota: buildAggregatedReport pode lançar MetricsNotFoundError ou ReportAggregationError
          const aggregatedReport: AggregatedReport = await buildAggregatedReport(
            userIdObj,  // 1. userId (ObjectId)
            fromDate,   // 2. startDate (Date)
            Metric      // 3. metricModel (O modelo Metric importado)
          );
          logger.debug(`${functionName} Dados agregados para usuário ${userId} calculados.`);

          // Verifica se o relatório foi gerado (pode retornar vazio se não houver métricas no período)
          // A função buildAggregatedReport já deve lançar erro se não houver dados,
          // então esta verificação pode ser redundante, mas mantida por segurança.
          if (!aggregatedReport || !aggregatedReport.overallStats) {
               logger.warn(`${functionName} Nenhum dado encontrado no período para gerar relatório para usuário ${userId}.`);
               return { userId, success: false, reason: "Sem dados no período" };
          }


          // 5c) Gera o resumo estratégico semanal
          logger.debug(`${functionName} Gerando resumo estratégico para ${userId}...`);
          // <<< CORREÇÃO: Passa userId (string) em vez de aggregatedReport >>>
          const reportText = await generateStrategicWeeklySummary(user.name || "Usuário", userId);

          if (!reportText || reportText.includes("Não foi possível gerar") || reportText.includes("Erro ao Gerar") || reportText.includes("Não consegui buscar")) {
              logger.warn(`${functionName} Falha ao gerar texto do relatório para ${userId}. Resposta IA: ${reportText}`);
              return { userId, success: false, reason: "Falha na geração do texto do relatório pela IA" };
          }
          logger.debug(`${functionName} Relatório estratégico gerado para usuário ${userId} (Início: ${reportText.substring(0,100)}...).`);

          // 5d) Ajusta número de telefone (lógica mantida)
          let phoneWithPlus = user.whatsappPhone.trim();
          if (!phoneWithPlus.startsWith("+")) {
             // Lógica simples para adicionar +55, pode precisar de ajustes para outros DDIs
             if (phoneWithPlus.length === 11 || phoneWithPlus.length === 10) {
                 phoneWithPlus = "+55" + phoneWithPlus;
             } else if (phoneWithPlus.length === 13 && phoneWithPlus.startsWith('55')) {
                 phoneWithPlus = "+" + phoneWithPlus;
             }
             else {
                 logger.warn(`${functionName} Formato de telefone não reconhecido para adicionar '+' automaticamente para usuário ${userId}: ${user.whatsappPhone}`);
                 // Continua tentando enviar, mas pode falhar
             }
          }
          // Validação simples do formato E.164 (pode ser aprimorada)
          if (!/^\+\d{9,15}$/.test(phoneWithPlus)) {
              logger.warn(`${functionName} Número de telefone ${phoneWithPlus} (após ajuste) para usuário ${userId} parece inválido. Pulando envio.`);
              return { userId, success: false, reason: `Número de telefone inválido: ${user.whatsappPhone}` };
          }
          logger.debug(`${functionName} Número de telefone final para envio para usuário ${userId}:`, phoneWithPlus);

          // 5e) Envia o relatório via WhatsApp
          logger.debug(`${functionName} Enviando relatório para ${userId} (${phoneWithPlus})...`);
          await safeSendWhatsAppMessage(phoneWithPlus, reportText); // Usa a função segura
          logger.info(`${functionName} Relatório enviado para usuário ${userId}, telefone ${phoneWithPlus}`);
          return { userId, success: true };

        } catch (error: unknown) {
          logger.error(`${functionName} Erro ao processar relatório para usuário ${userId}:`, error);
          let reason = "Erro desconhecido no processamento";
          // Trata erros específicos lançados por buildAggregatedReport
          if (error instanceof MetricsNotFoundError || error instanceof ReportAggregationError) {
              reason = error.message; // Usa a mensagem do erro específico
          } else if (error instanceof Error) {
              logger.error(`${functionName} Error details for ${userId}: Name=${error.name}, Message=${error.message}, Stack=${error.stack?.substring(0, 500)}...`);
              reason = error.message;
          }
          return { userId, success: false, reason };
        }
      })
    );

    // 6) Conta sucessos e falhas (lógica mantida)
    const successResults = results.filter(r => r.status === 'fulfilled' && r.value.success);
    const failedResults = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success));

    logger.info(`${functionName} Processamento concluído. Sucessos: ${successResults.length}, Falhas: ${failedResults.length}`);
    if (failedResults.length > 0) {
        const failureDetails = failedResults.map(r => {
            if (r.status === 'rejected') return { status: r.status, reason: r.reason?.message || r.reason };
            if (r.status === 'fulfilled') return { status: r.status, value: { userId: r.value.userId, success: r.value.success, reason: r.value.reason } };
            return { status: 'unknown' };
        });
        logger.warn(`${functionName} Detalhes das falhas:`, JSON.stringify(failureDetails, null, 2));
    }

    return NextResponse.json(
      { message: `Relatórios enviados para ${successResults.length} usuários. Falhas: ${failedResults.length}.` },
      { status: 200 }
    );
  } catch (error: unknown) {
    logger.error(`${functionName} Erro GERAL no endpoint /api/whatsapp/weeklyReport:`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `Erro interno do servidor: ${errorMessage}` }, { status: 500 });
  }
}
