import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { connectDB, safeSendWhatsAppMessage } from "@/app/lib/helpers"; // Verifique os caminhos
import User from "@/app/models/User"; // Verifique o caminho
import { DailyMetric, IDailyMetric } from "@/app/models/DailyMetric"; // Verifique o caminho
import Metric, { IMetric } from "@/app/models/Metric"; // Verifique o caminho
import { buildAggregatedReport, AggregatedReport, DetailedContentStat } from "@/app/lib/reportHelpers"; // Verifique o caminho
import { generateStrategicWeeklySummary } from "@/app/lib/consultantService"; // Verifique o caminho
import { Types, Model } from "mongoose";
// import { subDays } from "date-fns"; // Importe se for usar subDays

export const runtime = "nodejs";
// Adicionado logger para este arquivo também, para consistência
import { logger } from '@/app/lib/logger'; // Ajuste o caminho se necessário

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
    logger.debug("[whatsapp/weeklyReport GET] Verificação de callback sucedida."); // Usando logger
    return new Response(challenge || "", { status: 200 });
  }
  logger.error("[whatsapp/weeklyReport GET] Falha na verificação do callback:", { // Usando logger
    mode,
    token: token ? '***' : 'MISSING', // Não logar o token recebido
    expected: process.env.WHATSAPP_VERIFY_TOKEN ? '***' : 'UNDEFINED', // Não logar o token esperado
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
  reason?: string; // Adicionado para detalhar falhas
}

/**
 * POST /api/whatsapp/weeklyReport
 * Envia relatórios semanais ESTRATÉGICOS via WhatsApp para todos os usuários com plano ativo e número de WhatsApp cadastrado.
 * Este endpoint deve ser acionado somente em sextas-feiras (por exemplo, via job agendado/CRON).
 * Utiliza JWT para autenticação (getToken).
 */
export async function POST(request: NextRequest) {
  const functionName = "[whatsapp/weeklyReport POST]"; // Para logs
  try {
    // Verifica se hoje é sexta-feira (dia 5)
    const today = new Date().getDay();
    // Permite rodar em ambiente de desenvolvimento em qualquer dia para testes
    if (today !== 5 && process.env.NODE_ENV !== 'development') {
        logger.warn(`${functionName} Endpoint chamado fora de sexta-feira (e não em dev). Nenhum relatório será enviado.`);
        return NextResponse.json({ message: "Relatórios só são enviados às sextas-feiras." }, { status: 200 });
    }
    if (today === 5) {
        logger.info(`${functionName} Hoje é sexta-feira, iniciando geração de relatórios...`);
    } else {
        logger.info(`${functionName} Executando em ambiente de desenvolvimento fora de sexta-feira...`);
    }

    // 1) Extrai o token JWT
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token) {
      logger.error(`${functionName} Token não encontrado.`);
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }
    logger.debug(`${functionName} Token extraído com sucesso.`);

    // 2) Conecta ao banco de dados
    await connectDB();
    logger.debug(`${functionName} Conectado ao MongoDB.`);

    // 3) Busca usuários ativos com WhatsApp
    logger.debug(`${functionName} Buscando usuários...`);
    const users = await User.find({
      planStatus: "active",
      // <<< CORREÇÃO APLICADA AQUI >>>
      whatsappPhone: {
        $exists: true,       // Garante que o campo existe
        $nin: [null, ""]     // Garante que o valor NÃO é null NEM ""
      }
      // <<< FIM DA CORREÇÃO >>>
    }).lean(); // lean() para performance
    logger.info(`${functionName} Usuários ativos com WhatsApp encontrados: ${users.length}`);
    if (!users?.length) {
      return NextResponse.json(
        { message: "Nenhum usuário ativo com WhatsApp cadastrado para enviar relatório." },
        { status: 200 }
      );
    }

    // 4) Define o período para os dados: últimos 7 dias
    const now = new Date();
    const fromDate = new Date(); // Cria uma nova instância
    fromDate.setDate(now.getDate() - 7); // Define a data para 7 dias atrás
    fromDate.setHours(0, 0, 0, 0); // Zera horas/minutos/segundos para pegar desde o início do dia
    logger.debug(`${functionName} Período de análise: ${fromDate.toISOString()} até ${now.toISOString()}`);

    // 5) Processa os usuários
    const results = await Promise.allSettled<ReportResult>(
      users.map(async (user): Promise<ReportResult> => { // Adiciona tipo de retorno explícito
        // Validação robusta do usuário e whatsappPhone
        if (!user?._id || !user.whatsappPhone || typeof user.whatsappPhone !== 'string' || user.whatsappPhone.trim() === '') {
            logger.error(`${functionName} Usuário inválido ou sem WhatsApp válido:`, user?._id);
            return { userId: user?._id?.toString() || 'INVALID_USER', success: false, reason: "Dados inválidos do usuário" };
        }
        const userId = user._id.toString(); // Converte para string para logs
        const userIdObj = new Types.ObjectId(userId); // Mantém como ObjectId para queries

        try {
          logger.debug(`${functionName} Iniciando processamento para usuário ${userId}`);

          // 5a) Carrega DailyMetrics dos últimos 7 dias
          const dailyMetrics = await DailyMetric.find({ // Usa o Model importado diretamente
            user: userIdObj, // Usa ObjectId
            postDate: { $gte: fromDate },
          }).lean();
          logger.debug(`${functionName} ${dailyMetrics.length} métricas carregadas para usuário ${userId}`);

          if (dailyMetrics.length === 0) {
            logger.warn(`${functionName} Nenhuma métrica encontrada nos últimos 7 dias para usuário ${userId}. Relatório não gerado.`);
            return { userId, success: false, reason: "Sem métricas recentes" };
          }

          // 5b) Agrega os dados usando buildAggregatedReport (v3.2)
          logger.debug(`${functionName} Chamando buildAggregatedReport para ${userId}...`);
          const aggregatedReport: AggregatedReport = await buildAggregatedReport(
            dailyMetrics,
            userIdObj,  // Passa ObjectId
            fromDate,   // Passa a data de início correta
            DailyMetric,// Passa o Model importado
            Metric      // Passa o Model importado
          );
          logger.debug(`${functionName} Dados agregados para usuário ${userId} calculados.`);

          // 5c) Gera o resumo estratégico semanal (v3.2 - ciente das limitações)
          logger.debug(`${functionName} Gerando resumo estratégico para ${userId}...`);
          const reportText = await generateStrategicWeeklySummary(user.name || "Usuário", aggregatedReport);

          if (!reportText || reportText.includes("Não foi possível gerar") || reportText.includes("Erro ao Gerar")) {
              logger.warn(`${functionName} Falha ao gerar texto do relatório para ${userId}. Resposta IA: ${reportText}`);
              return { userId, success: false, reason: "Falha na geração do texto do relatório pela IA" };
          }
          logger.debug(`${functionName} Relatório estratégico gerado para usuário ${userId} (Início: ${reportText.substring(0,100)}...).`);

          // 5d) Ajusta número de telefone
          let phoneWithPlus = user.whatsappPhone.trim(); // Remove espaços extras
          if (!phoneWithPlus.startsWith("+")) {
             // Lógica simples para tentar adicionar +55 (ajuste conforme necessário)
             if ((phoneWithPlus.length === 11 && (phoneWithPlus.startsWith('21') || phoneWithPlus.startsWith('11'))) || (phoneWithPlus.length === 10 && !(phoneWithPlus.startsWith('21') || phoneWithPlus.startsWith('11')))) { // Ex: 219XXXXXXXX ou 31XXXXXXXX
                phoneWithPlus = "+55" + phoneWithPlus;
             } else if (phoneWithPlus.length === 13 && phoneWithPlus.startsWith('55')) { // Já tem 55 mas sem o +
                phoneWithPlus = "+" + phoneWithPlus;
             }
             else {
                 // Outros casos podem precisar de lógica adicional ou serem considerados inválidos
                 logger.warn(`${functionName} Formato de telefone não reconhecido para adicionar '+' automaticamente para usuário ${userId}: ${user.whatsappPhone}`);
                 // Decide se quer tentar enviar mesmo assim ou falhar
                 // phoneWithPlus = "+" + phoneWithPlus; // Opção: tenta adicionar '+' de qualquer forma
             }
          }
          // Validação mais permissiva do formato internacional (apenas '+' seguido de números)
          if (!/^\+\d{9,15}$/.test(phoneWithPlus)) {
              logger.warn(`${functionName} Número de telefone ${phoneWithPlus} (após ajuste) para usuário ${userId} parece inválido. Pulando envio.`);
              return { userId, success: false, reason: `Número de telefone inválido: ${user.whatsappPhone}` };
          }
          logger.debug(`${functionName} Número de telefone final para envio para usuário ${userId}:`, phoneWithPlus);

          // 5e) Envia o relatório via WhatsApp
          logger.debug(`${functionName} Enviando relatório para ${userId} (${phoneWithPlus})...`);
          await safeSendWhatsAppMessage(phoneWithPlus, reportText);
          logger.info(`${functionName} Relatório enviado para usuário ${userId}, telefone ${phoneWithPlus}`);
          return { userId, success: true };

        } catch (error: unknown) {
          logger.error(`${functionName} Erro ao processar relatório para usuário ${userId}:`, error);
          let reason = "Erro desconhecido no processamento";
          if (error instanceof Error) {
              logger.error(`${functionName} Error details for ${userId}: Name=${error.name}, Message=${error.message}, Stack=${error.stack?.substring(0, 500)}...`);
              reason = error.message; // Usa a mensagem de erro como motivo
          }
          return { userId, success: false, reason };
        }
      })
    );

    // 6) Conta sucessos e falhas
    const successResults = results.filter(r => r.status === 'fulfilled' && r.value.success);
    const failedResults = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success));

    logger.info(`${functionName} Processamento concluído. Sucessos: ${successResults.length}, Falhas: ${failedResults.length}`);
    if (failedResults.length > 0) {
        // Loga detalhes das falhas
        const failureDetails = failedResults.map(r => {
            if (r.status === 'rejected') return { status: r.status, reason: r.reason?.message || r.reason };
            if (r.status === 'fulfilled') return { status: r.status, value: { userId: r.value.userId, success: r.value.success, reason: r.value.reason } };
            return { status: 'unknown' }; // Caso inesperado
        });
        logger.warn(`${functionName} Detalhes das falhas:`, JSON.stringify(failureDetails, null, 2)); // Formata para melhor leitura
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